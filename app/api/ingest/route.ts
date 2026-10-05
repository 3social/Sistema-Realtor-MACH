// ============================================================
// app/api/ingest/route.ts
// Entrada de mensajes de GRUPOS vía puente no oficial (Evolution API)
//
// Evolution API (v2) envía aquí el evento MESSAGES_UPSERT de cada
// mensaje que recibe el número vinculado. Se normaliza a WebhookPayload
// y sigue el mismo pipeline que el webhook de Meta:
//   clasificar → embedding → guardar → matching.
//
// Auth: INGEST_SECRET, enviado en el header `x-ingest-secret` o, si el
// cliente no permite headers (Evolution Manager), en `?secret=` de la URL.
// Si no hay secreto configurado, el endpoint rechaza todo.
// ============================================================
import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { parseAndStoreMessage } from '@/lib/parser'
import type { WebhookPayload } from '@/types'

type ImageMime = NonNullable<WebhookPayload['imageMimeType']>
const SUPPORTED_MIMES: ImageMime[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** Subconjunto del evento messages.upsert de Evolution API v2 que usamos */
interface EvolutionEvent {
  event?: string
  data?: {
    key?: {
      id?: string
      remoteJid?: string
      fromMe?: boolean
      participant?: string
      participantAlt?: string
    }
    pushName?: string
    messageTimestamp?: number | string
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
      imageMessage?: { caption?: string; mimetype?: string }
      base64?: string
    }
    base64?: string
  }
}

function secretMatches(received: string | null): boolean {
  const secret = process.env.INGEST_SECRET
  if (!secret || !received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** "50688887777@s.whatsapp.net" → "50688887777" */
function jidToPhone(jid?: string): string | undefined {
  return jid?.split('@')[0]?.split(':')[0] || undefined
}

export async function POST(req: NextRequest) {
  const received = req.headers.get('x-ingest-secret') ?? req.nextUrl.searchParams.get('secret')
  if (!secretMatches(received)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: EvolutionEvent
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.event?.toLowerCase().includes('upsert')) {
    return NextResponse.json({ status: 'ignored', reason: 'evento no soportado' })
  }

  const data = body.data
  const key  = data?.key
  const jid  = key?.remoteJid

  // Solo mensajes de grupos, ajenos (el número no es un participante activo)
  if (!data || !key?.id || !jid?.endsWith('@g.us') || key.fromMe) {
    return NextResponse.json({ status: 'ignored', reason: 'no es mensaje entrante de grupo' })
  }

  const msg = data.message
  const imageMessage = msg?.imageMessage
  const text = msg?.conversation ?? msg?.extendedTextMessage?.text ?? imageMessage?.caption

  // En grupos con LID el teléfono real llega en participantAlt
  const sender = jidToPhone(
    key.participantAlt?.endsWith('@s.whatsapp.net') ? key.participantAlt : key.participant
  )

  const base: Pick<WebhookPayload, 'messageId' | 'from' | 'groupId' | 'timestamp'> = {
    messageId: key.id,
    from:      sender ?? 'unknown',
    groupId:   jid,
    timestamp: String(data.messageTimestamp ?? Math.floor(Date.now() / 1000))
  }

  let payload: WebhookPayload | null = null

  if (imageMessage) {
    const base64 = msg?.base64 ?? data.base64
    const mime   = imageMessage.mimetype?.split(';')[0] as ImageMime | undefined
    if (!base64 || !mime || !SUPPORTED_MIMES.includes(mime)) {
      return NextResponse.json({ status: 'ignored', reason: 'imagen sin base64 o formato no soportado' })
    }
    payload = {
      ...base,
      text:          text || undefined,
      source:        text ? 'image+text' : 'image',
      imageBase64:   base64,
      imageMimeType: mime,
      imageMediaId:  key.id
    }
  } else if (text) {
    payload = { ...base, text, source: 'text' }
  }

  if (!payload) {
    return NextResponse.json({ status: 'ignored', reason: 'tipo de mensaje no soportado' })
  }

  // Responder rápido; after() mantiene viva la función hasta terminar.
  const queued = payload
  after(async () => {
    await parseAndStoreMessage(queued).catch((err) =>
      console.error(`[ingest] Error procesando mensaje ${queued.messageId}:`, err)
    )
  })

  return NextResponse.json({ status: 'queued' })
}
