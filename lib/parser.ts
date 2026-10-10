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
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'
import { getOpenAI } from './openai'
import { supabaseAdmin } from './supabase'
import { generateEmbedding, buildEmbeddingText } from './embeddings'
import { findMatches } from './matcher'
import type { WebhookPayload, ParsedProperty } from '@/types'

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
- UBICACIÓN: nombre de la zona/cantón/distrito tal como lo escribe el remitente (ej. "Escazú", "Santa Ana", "Playa Hermosa"); si busca en varias zonas, sepáralas por coma
- features puede incluir: piscina, jardín, garaje, seguridad 24h, vista al mar, rancho, bodega, terraza, etc.
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

  // Evitar duplicados: Meta y Evolution reintentan webhooks
  if (await isDuplicate(payload.messageId)) {
    console.log(`[parser] Mensaje ${payload.messageId} ya procesado, ignorando`)
    return
  }

  // ── PASO 1: Clasificar con OpenAI (texto o visión) ─────────
  let parsed: ParsedProperty

  try {
    parsed = await classifyWithOpenAI(payload)
  } catch (error) {
    console.error('[parser] Error al clasificar con OpenAI:', error)
    return
  }

  // Ignorar mensajes irrelevantes
  if (parsed.type === 'ignore') {
    console.log('[parser] Contenido clasificado como ignore, descartando')
    return
  }

  console.log(`[parser] Tipo: ${parsed.type} | ${parsed.property_type} | ${parsed.location} | $${parsed.price_max}`)

  // ── PASO 2: Generar embedding semántico (OpenAI) ───────────
  const embeddingText = buildEmbeddingText(parsed)
  const embedding = await generateEmbedding(embeddingText)

  // Construir el raw_message para guardar en BD:
  // Si tiene imagen, guardamos el caption + descripción de la fuente
  const rawMessage = buildRawMessage(payload)

  // ── PASO 3: Insertar en Supabase ───────────────────────────
  const { data: property, error: insertError } = await supabaseAdmin
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
        mediaId:   payload.imageMediaId ?? null
      },
      embedding
    })
    .select()
    .single()

  if (insertError || !property) {
    console.error('[parser] Error al insertar en Supabase:', insertError)
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

  return {
    type,
    property_type: PROPERTY_TYPES.find((t) => t === propertyType) ?? null,
    operation:     OPERATIONS.find((o) => o === raw.operation) ?? null,
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

/** ¿Ya existe una propiedad guardada desde este mensaje? (ignora errores) */
async function isDuplicate(messageId?: string): Promise<boolean> {
  if (!messageId) return false
  const { data } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('extras->>messageId', messageId)
    .limit(1)
  return (data?.length ?? 0) > 0
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
