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
- Tipo de propiedad visible (casa, apartamento, local comercial, terreno)
- Características visuales (piscina, jardín, garaje, número de plantas, estado aparente)
- Logotipos o nombres de inmobiliaria (van en extras)

RESPONDE ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin bloques de código:

{
  "type": "offer" | "demand" | "ignore",
  "property_type": "casa" | "apartamento" | "local" | "terreno" | "oficina" | null,
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

  return JSON.parse(cleanJson) as ParsedProperty
}

// ============================================================
// Helpers
// ============================================================

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
