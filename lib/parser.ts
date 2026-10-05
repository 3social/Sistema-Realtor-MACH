// ============================================================
// lib/parser.ts
// Clasificación y extracción de propiedades con Claude
//
// Soporta 3 modos de entrada:
//   'text'       → Claude recibe solo el texto del mensaje
//   'image'      → Claude Vision analiza la imagen (flyer, foto, captura)
//   'image+text' → Claude Vision analiza imagen + caption del realtor
//
// Flujo: payload → Claude (text o vision) → JSON → embed → Supabase → matcher
// ============================================================
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import { generateEmbedding, buildEmbeddingText } from './embeddings'
import { findMatches } from './matcher'
import type { WebhookPayload, ParsedProperty } from '@/types'

// Cliente perezoso (ver lib/embeddings.ts): evita fallos en build sin claves.
let claude: Anthropic | undefined
function getClaude(): Anthropic {
  return (claude ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }))
}

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
 * 1. Clasifica y extrae datos con Claude (texto o visión)
 * 2. Genera embedding semántico con OpenAI
 * 3. Guarda en Supabase
 * 4. Busca matches automáticamente
 */
export async function parseAndStoreMessage(payload: WebhookPayload): Promise<void> {
  console.log(`[parser] Procesando ${payload.source} de ${payload.from} en grupo ${payload.groupId}`)

  // ── PASO 1: Clasificar con Claude (texto o visión) ─────────
  let parsed: ParsedProperty

  try {
    parsed = await classifyWithClaude(payload)
  } catch (error) {
    console.error('[parser] Error al clasificar con Claude:', error)
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
// Clasificación con Claude — modo texto o visión
// ============================================================

async function classifyWithClaude(payload: WebhookPayload): Promise<ParsedProperty> {
  let messageContent: Anthropic.MessageParam['content']

  if (payload.source === 'text') {
    // ── Solo texto ─────────────────────────────────────────────
    messageContent = payload.text ?? ''

  } else if (payload.source === 'image') {
    // ── Solo imagen (flyer sin caption) ───────────────────────
    if (!payload.imageBase64 || !payload.imageMimeType) {
      throw new Error('Imagen sin datos base64')
    }

    messageContent = [
      {
        type: 'image',
        source: {
          type:       'base64',
          media_type: payload.imageMimeType,
          data:       payload.imageBase64
        }
      },
      {
        type: 'text',
        text: 'Analiza esta imagen inmobiliaria de WhatsApp y extrae toda la información de la propiedad que puedas ver.'
      }
    ]

  } else {
    // ── Imagen + caption ───────────────────────────────────────
    if (!payload.imageBase64 || !payload.imageMimeType) {
      throw new Error('Imagen+texto sin datos base64')
    }

    messageContent = [
      {
        type: 'image',
        source: {
          type:       'base64',
          media_type: payload.imageMimeType,
          data:       payload.imageBase64
        }
      },
      {
        type: 'text',
        text: `El realtor adjuntó esta imagen junto con el siguiente mensaje:\n\n"${payload.text}"\n\nAnaliza tanto la imagen como el texto para extraer toda la información de la propiedad.`
      }
    ]
  }

  const response = await getClaude().messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 700,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: messageContent }]
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Claude no retornó texto')

  // Limpiar posibles bloques markdown
  const cleanJson = content.text
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
