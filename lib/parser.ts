// ============================================================
// lib/parser.ts
// Clasificación y extracción de propiedades con OpenAI
//
// Soporta 3 modos de entrada:
//   'text'       → el modelo recibe solo el texto del mensaje
//   'image'      → visión de OpenAI analiza la imagen (flyer, foto, captura)
//   'image+text' → visión de OpenAI analiza imagen + caption del realtor
//
// Flujo: payload → OpenAI (text o vision) → JSON → embed → Supabase → matcher
// ============================================================
import { createHash } from 'node:crypto'
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'
import { getOpenAI } from './openai'
import { supabaseAdmin } from './supabase'
import { generateEmbedding, buildEmbeddingText } from './embeddings'
import { findMatches } from './matcher'
import { dbRetry, isTransientDbError, TransientError } from './retry'
import type { WebhookPayload, ParsedProperty } from '@/types'

/**
 * Un mensaje de solo texto con menos caracteres que esto ("ok", "gracias", un emoji) no puede ser
 * una publicación: se descarta sin llamar a OpenAI ni a la base de datos. No aplica a imágenes.
 */
const MIN_TEXT_LENGTH = 15

/** Días durante los que la misma publicación de la misma persona se considera repetida (crosspost) */
const REPEAT_WINDOW_DAYS = 30

/** Modelo con visión usado para clasificar texto, flyers e imágenes */
const CLASSIFY_MODEL = 'gpt-4o-mini'

// ============================================================
// System prompt — especializado en Costa Rica / LATAM
// Aplica tanto para texto como para imágenes
// ============================================================
const SYSTEM_PROMPT = `Eres un experto en análisis de mensajes y flyers inmobiliarios de WhatsApp en Costa Rica y Latinoamérica.

Tu tarea es clasificar el contenido (texto, imagen o ambos) y extraer información estructurada.

TIPOS DE CONTENIDO:
- "offer": El remitente TIENE una propiedad disponible (vende, alquila, ofrece, tengo disponible, etc.)
- "demand": El remitente BUSCA una propiedad (busco, necesito, quiero, cliente interesado en, etc.)
- "ignore": No es relevante (saludos, preguntas generales, fotos de paisajes sin info, memes, etc.)

Cuando analices una IMAGEN, extrae toda la información visible:
- Texto en la imagen (precios, direcciones, teléfonos, características)
- Tipo de propiedad visible (casa, apartamento, lote, finca, local comercial, oficina)
- Características visuales (piscina, jardín, garaje, número de plantas, estado aparente)
- Logotipos o nombres de inmobiliaria (van en extras)

RESPONDE ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin bloques de código:

{
  "type": "offer" | "demand" | "ignore",
  "property_type": "casa" | "apartamento" | "lote" | "finca" | "local" | "oficina" | null,
  "operation": "venta" | "alquiler" | null,
  "location": "nombre del lugar o zona" | null,
  "price_min": número en USD o null,
  "price_max": número en USD o null,
  "bedrooms_min": número o null,
  "bedrooms_max": número o null,
  "bathrooms": número o null,
  "area_m2": número o null,
  "features": ["lista", "de", "características"],
  "condition": "nuevo" | "usado" | "en planos" | null,
  "summary": "resumen de 1 línea de qué ofrece o busca"
}

REGLAS:
- Si el precio viene en colones (₡ o CRC), conviértelo a USD dividiendo entre 530
- "hasta $200k" → price_max: 200000 | "desde $150k" → price_min: 150000
- "cuartos", "piezas", "dormitorios" → bedrooms
- TIPO DE PROPIEDAD (distínguelo con cuidado, es clave para el matching):
  · "lote": terreno o lote urbano/para construir, "terreno", "lote", "lotes en urbanización"
  · "finca": propiedad rural o agrícola/ganadera, "finca", "quinta", "hectáreas", "manzanas", "con cultivos/ganado"
  · "casa": casa, villa, quinta residencial, "casa en condominio"
  · "apartamento": apartamento, apto, "torre", "condominio vertical", estudio
  · "local" (local comercial/bodega) y "oficina"
  · Si no es claro, usa null (no adivines)
- ÁREA: area_m2 siempre en metros cuadrados (1 hectárea = 10000 m², 1 manzana ≈ 7000 m²)
- PRECIO en OFERTAS: precio de venta o alquiler mensual en price_max (usa price_min solo si da un rango)
- PRECIO en DEMANDAS: presupuesto máximo en price_max; "desde X" en price_min
- UBICACIÓN: solo lugares geográficos (zona, distrito, cantón, provincia). NUNCA uses nombres de ferias, eventos, proyectos o empresas (ej. "Concasa") como ubicación; si no hay un lugar claro, null. Es el nombre de la zona/cantón/distrito tal como lo escribe el remitente (ej. "Escazú", "Santa Ana", "Playa Hermosa"); si busca en varias zonas, sepáralas por coma
- features puede incluir: piscina, jardín, garaje, seguridad 24h, vista al mar, rancho, bodega, terraza, etc.
- OPERACIÓN: "venta" o "alquiler" solo si el mensaje lo dice o lo implica claramente; si no, null (el sistema la deduce por el precio)
- Si no puedes extraer un campo con confianza, usa null
- Para contenido ambiguo entre offer/demand, elige el más probable`

// ============================================================
// Función principal
// ============================================================

/**
 * Procesa un mensaje de WhatsApp (texto, imagen o imagen+caption):
 * 1. Clasifica y extrae datos con OpenAI (texto o visión)
 * 2. Genera embedding semántico con OpenAI
 * 3. Guarda en Supabase
 * 4. Busca matches automáticamente
 */
export async function parseAndStoreMessage(payload: WebhookPayload): Promise<void> {
  console.log(`[parser] Procesando ${payload.source} de ${payload.from} en grupo ${payload.groupId}`)

  // Filtro de ahorro: texto demasiado corto para ser una oferta o demanda
  if (payload.source === 'text' && (payload.text ?? '').trim().length < MIN_TEXT_LENGTH) {
    console.log(`[parser] Texto de menos de ${MIN_TEXT_LENGTH} caracteres, descartando sin llamar a OpenAI`)
    return
  }

  // Evitar duplicados: Meta y Evolution reintentan webhooks
  if (await isDuplicate(payload.messageId)) {
    console.log(`[parser] Mensaje ${payload.messageId} ya procesado, ignorando`)
    return
  }

  // Misma persona publicando lo mismo en varios grupos (crosspost): se procesa una sola vez
  const contentHash = computeContentHash(payload)
  if (contentHash && await isRepeatedPost(contentHash)) {
    console.log(`[parser] Publicación repetida de ${payload.from} (otro grupo), ignorando`)
    return
  }

  // ── PASO 1: Clasificar con OpenAI (texto o visión) ─────────
  let parsed: ParsedProperty

  try {
    parsed = await classifyWithOpenAI(payload)
  } catch (error) {
    // Cuota/límite de OpenAI, 5xx o red: el emisor del webhook puede reintentar
    const status = (error as { status?: number }).status
    const name = (error as { name?: string }).name ?? ''
    if (status === 429 || (status !== undefined && status >= 500) || /Connection|Timeout/.test(name)) {
      throw new TransientError(`OpenAI no disponible: ${(error as Error).message}`)
    }
    console.error('[parser] Error al clasificar con OpenAI:', error)
    return
  }

  // Ignorar mensajes irrelevantes
  if (parsed.type === 'ignore') {
    console.log('[parser] Contenido clasificado como ignore, descartando')
    return
  }

  console.log(`[parser] Tipo: ${parsed.type} | ${parsed.property_type} | ${parsed.location} | $${parsed.price_max}`)

  // Mismo anuncio con texto distinto (p. ej. precio convertido de colones con pequeñas variaciones)
  if (await isSimilarPost(payload.from, parsed)) {
    console.log(`[parser] Anuncio equivalente de ${payload.from} ya registrado, ignorando`)
    return
  }

  // ── PASO 2: Generar embedding semántico (OpenAI) ───────────
  const embeddingText = buildEmbeddingText(parsed)
  const embedding = await generateEmbedding(embeddingText)

  // Construir el raw_message para guardar en BD:
  // Si tiene imagen, guardamos el caption + descripción de la fuente
  const rawMessage = buildRawMessage(payload)

  // ── PASO 3: Insertar en Supabase ───────────────────────────
  const { data: property, error: insertError, status: insertStatus } = await dbRetry(() => supabaseAdmin
    .from('properties')
    .insert({
      group_id:      payload.groupId,
      group_name:    payload.groupName ?? null,
      sender_phone:  payload.from,
      raw_message:   rawMessage,
      type:          parsed.type,
      property_type: parsed.property_type ?? null,
      location:      parsed.location ?? null,
      price_min:     parsed.price_min ?? null,
      price_max:     parsed.price_max ?? null,
      bedrooms_min:  parsed.bedrooms_min ?? null,
      bedrooms_max:  parsed.bedrooms_max ?? null,
      bathrooms:     parsed.bathrooms ?? null,
      area_m2:       parsed.area_m2 ?? null,
      features:      parsed.features ?? [],
      condition:     parsed.condition ?? null,
      operation:     parsed.operation ?? null,
      extras: {
        summary:   parsed.summary,
        source:    payload.source,
        messageId: payload.messageId,
        contentHash: contentHash ?? null,
        mediaId:   payload.imageMediaId ?? null
      },
      embedding
    })
    .select()
    .single(), 'insertar propiedad')

  if (insertError || !property) {
    console.error('[parser] Error al insertar en Supabase:', insertError)
    if (isTransientDbError({ error: insertError, status: insertStatus })) {
      throw new TransientError('Supabase no disponible al guardar la propiedad')
    }
    return
  }

  console.log(`[parser] Propiedad guardada: ${property.id} (fuente: ${payload.source})`)

  // ── PASO 4: Buscar matches automáticamente ─────────────────
  await findMatches({ ...property, embedding })
}

// ============================================================
// Clasificación con OpenAI — modo texto o visión
// ============================================================

async function classifyWithOpenAI(payload: WebhookPayload): Promise<ParsedProperty> {
  let userContent: string | ChatCompletionContentPart[]

  if (payload.source === 'text') {
    // ── Solo texto ─────────────────────────────────────────────
    userContent = payload.text ?? ''

  } else {
    // ── Imagen (flyer) con o sin caption ───────────────────────
    if (!payload.imageBase64 || !payload.imageMimeType) {
      throw new Error('Imagen sin datos base64')
    }

    const instruction = payload.source === 'image'
      ? 'Analiza esta imagen inmobiliaria de WhatsApp y extrae toda la información de la propiedad que puedas ver.'
      : `El realtor adjuntó esta imagen junto con el siguiente mensaje:\n\n"${payload.text}"\n\nAnaliza tanto la imagen como el texto para extraer toda la información de la propiedad.`

    userContent = [
      {
        type: 'image_url',
        image_url: { url: `data:${payload.imageMimeType};base64,${payload.imageBase64}` }
      },
      { type: 'text', text: instruction }
    ]
  }

  const response = await getOpenAI().chat.completions.create({
    model:           CLASSIFY_MODEL,
    max_tokens:      700,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userContent }
    ]
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI no retornó contenido')

  // Limpiar posibles bloques markdown
  const cleanJson = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return normalizeParsed(JSON.parse(cleanJson))
}

const PROPERTY_TYPES = ['casa', 'apartamento', 'lote', 'finca', 'local', 'oficina'] as const
const OPERATIONS = ['venta', 'alquiler'] as const

/** Si el mensaje no dice venta/alquiler: ≥ 20 000 USD se asume venta; ≤ 8 000 USD, alquiler mensual */
const MIN_PLAUSIBLE_SALE_USD = 1_000
const SALE_PRICE_FLOOR_USD = 20_000
const RENT_PRICE_CEILING_USD = 8_000

/** Sanea la salida del modelo para que respete los CHECK de la base de datos */
function normalizeParsed(raw: Partial<Omit<ParsedProperty, 'property_type'>> & { property_type?: string | null }): ParsedProperty {
  const type = raw.type === 'offer' || raw.type === 'demand' ? raw.type : 'ignore'
  const propertyType = raw.property_type === 'terreno' ? 'lote' : raw.property_type
  // Acepta números y cadenas numéricas ("180000", "180,000")
  const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v.replace(/[,\s$]/g, '')) : v
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  }

  // Una oferta con un solo precio: siempre en price_max (el modelo a veces lo pone en price_min)
  let priceMin = num(raw.price_min)
  let priceMax = num(raw.price_max)
  if (type === 'offer' && priceMax === null && priceMin !== null) {
    priceMax = priceMin
    priceMin = null
  }
  // Habitaciones son enteros en la base de datos; baños admiten medios (2.5)
  const whole = (v: unknown) => {
    const n = num(v)
    return n === null ? null : Math.round(n)
  }

  // Operación faltante: se deduce por el orden de magnitud del precio en USD (alquiler mensual vs compra)
  let operation: ParsedProperty['operation'] = OPERATIONS.find((o) => o === raw.operation) ?? null
  const price = priceMax ?? priceMin
  if (operation === null && price !== null) {
    if (price >= SALE_PRICE_FLOOR_USD) operation = 'venta'
    else if (price <= RENT_PRICE_CEILING_USD) operation = 'alquiler'
  }

  // Una venta por menos de 1 000 USD no es un precio total (suele ser $/m² o miles abreviados): se descarta el precio
  if (operation === 'venta' && price !== null && price < MIN_PLAUSIBLE_SALE_USD) {
    priceMin = null
    priceMax = null
  }

  return {
    type,
    property_type: PROPERTY_TYPES.find((t) => t === propertyType) ?? null,
    operation,
    location:      typeof raw.location === 'string' && raw.location.trim() ? raw.location.trim() : null,
    price_min:     priceMin,
    price_max:     priceMax,
    bedrooms_min:  whole(raw.bedrooms_min),
    bedrooms_max:  whole(raw.bedrooms_max),
    bathrooms:     num(raw.bathrooms),
    area_m2:       num(raw.area_m2),
    features:      Array.isArray(raw.features) ? raw.features.filter((f) => typeof f === 'string') : [],
    condition:     (['nuevo', 'usado', 'en planos'] as const).find((c) => c === raw.condition) ?? null,
    summary:       typeof raw.summary === 'string' ? raw.summary : ''
  }
}

// ============================================================
// Helpers
// ============================================================

/** ¿Ya existe una propiedad guardada desde este mensaje? */
async function isDuplicate(messageId?: string): Promise<boolean> {
  if (!messageId) return false
  const res = await dbRetry(() => supabaseAdmin
    .from('properties')
    .select('id')
    .eq('extras->>messageId', messageId)
    .limit(1), 'buscar duplicado')

  if (res.error) {
    // Sin base de datos no se puede procesar: que el emisor reintente
    if (isTransientDbError(res)) throw new TransientError('Supabase no disponible al buscar duplicados')
    return false
  }
  return (res.data?.length ?? 0) > 0
}

/**
 * Huella del contenido: remitente + texto normalizado (o bytes de la imagen). Los mensajes de un mismo
 * crosspost tienen distinto messageId en cada grupo pero la misma huella. Sin remitente conocido no se
 * deduplica (se podrían fusionar personas distintas).
 */
function computeContentHash(payload: WebhookPayload): string | undefined {
  if (!payload.from || payload.from === 'unknown') return undefined
  const body = payload.imageBase64
    ? `img:${createHash('sha256').update(payload.imageBase64).digest('hex')}`
    : `txt:${(payload.text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()}`
  return createHash('sha256').update(`${payload.from}|${body}`).digest('hex')
}

/** ¿Esta persona ya publicó lo mismo (en cualquier grupo) en los últimos días? */
async function isRepeatedPost(contentHash: string): Promise<boolean> {
  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 86_400_000).toISOString()
  const res = await dbRetry(() => supabaseAdmin
    .from('properties')
    .select('id')
    .eq('extras->>contentHash', contentHash)
    .gte('created_at', since)
    .limit(1), 'buscar publicación repetida')

  if (res.error) {
    if (isTransientDbError(res)) throw new TransientError('Supabase no disponible al buscar publicaciones repetidas')
    return false
  }
  return (res.data?.length ?? 0) > 0
}

/**
 * ¿La misma persona ya publicó un anuncio equivalente? Mismo tipo y tipo de propiedad, mismas habitaciones
 * y precio dentro de ±2 % (las conversiones de colones varían unos dólares entre publicaciones).
 * Sin precio o sin remitente conocido no se deduplica.
 */
async function isSimilarPost(from: string, parsed: ParsedProperty): Promise<boolean> {
  if (!from || from === 'unknown' || parsed.price_max === null) return false

  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 86_400_000).toISOString()
  const res = await dbRetry(() => {
    let query = supabaseAdmin
      .from('properties')
      .select('id')
      .eq('sender_phone', from)
      .eq('type', parsed.type)
      .gte('created_at', since)
      .gte('price_max', parsed.price_max! * 0.98)
      .lte('price_max', parsed.price_max! * 1.02)
    if (parsed.property_type) query = query.eq('property_type', parsed.property_type)
    if (parsed.bedrooms_min !== null) query = query.eq('bedrooms_min', parsed.bedrooms_min)
    return query.limit(1)
  }, 'buscar anuncio equivalente')

  if (res.error) {
    if (isTransientDbError(res)) throw new TransientError('Supabase no disponible al buscar anuncios equivalentes')
    return false
  }
  return (res.data?.length ?? 0) > 0
}

/** Construye el texto a guardar en raw_message */
function buildRawMessage(payload: WebhookPayload): string {
  if (payload.source === 'text') {
    return payload.text ?? ''
  }
  if (payload.source === 'image') {
    return `[Imagen] mediaId: ${payload.imageMediaId ?? 'desconocido'}`
  }
  // image+text
  return `[Imagen + Caption] ${payload.text ?? ''}`
}
