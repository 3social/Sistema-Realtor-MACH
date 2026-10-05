// ============================================================
// app/api/webhook/route.ts
// Webhook de Meta WhatsApp Business API
//
// GET  → Verificación del webhook (requerido por Meta al configurar)
// POST → Recepción de mensajes: texto, imagen, imagen+caption
// ============================================================
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { parseAndStoreMessage } from '@/lib/parser'
import { downloadWhatsAppMedia } from '@/lib/whatsapp'
import type { WebhookPayload, MessageSource } from '@/types'

// ── Firma de Meta (X-Hub-Signature-256) ────────────────────────
// Se valida cuando WHATSAPP_APP_SECRET está configurado (App Secret de la
// app en Meta). Sin la variable el webhook sigue funcionando como antes,
// pero registra una advertencia: configúrala en producción.
function hasValidSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) {
    console.warn('[webhook] WHATSAPP_APP_SECRET no configurado — firma NO verificada')
    return true
  }
  if (!header?.startsWith('sha256=')) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const received = Buffer.from(header.slice('sha256='.length), 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

// ── GET: Verificación del webhook ──────────────────────────────
export async function GET(req: NextRequest) {
  const params     = req.nextUrl.searchParams
  const mode       = params.get('hub.mode')
  const token      = params.get('hub.verify_token')
  const challenge  = params.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[webhook] Verificación exitosa con Meta')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[webhook] Verificación fallida — token incorrecto o modo inválido')
  return new NextResponse('Unauthorized', { status: 403 })
}

// ── POST: Recepción de mensajes ────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (!hasValidSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
      console.warn('[webhook] Firma inválida, rechazando request')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = JSON.parse(rawBody)

    const entry   = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value   = changes?.value

    if (!value?.messages || value.messages.length === 0) {
      return NextResponse.json({ status: 'no_messages' })
    }

    // Responder a Meta ANTES del procesamiento pesado (< 20s requerido)
    // Las imágenes se descargan aquí (síncronamente antes del return)
    // porque necesitamos el base64 para pasarlo al parser async.

    const processingPromises: Promise<void>[] = []

    for (const message of value.messages) {
      const msgType: string = message.type

      // Soportamos: texto puro | imagen pura | imagen+caption
      if (msgType !== 'text' && msgType !== 'image') {
        console.log(`[webhook] Tipo no soportado: ${msgType}, ignorando`)
        continue
      }

      const groupId =
        value.metadata?.display_phone_number ||
        value.metadata?.phone_number_id ||
        'unknown_group'

      const groupName = value.contacts?.[0]?.profile?.name ?? undefined

      let payload: WebhookPayload | null = null

      // ── Mensaje de solo texto ─────────────────────────────────
      if (msgType === 'text') {
        payload = {
          messageId: message.id,
          from:      message.from,
          groupId,
          groupName,
          text:      message.text.body,
          timestamp: message.timestamp,
          source:    'text'
        }

      // ── Mensaje con imagen (con o sin caption) ────────────────
      } else if (msgType === 'image') {
        const mediaId = message.image?.id as string | undefined
        const caption = message.image?.caption as string | undefined

        if (!mediaId) {
          console.warn('[webhook] Imagen sin mediaId, ignorando')
          continue
        }

        // Descargar imagen de Meta → base64 para visión de OpenAI
        const media = await downloadWhatsAppMedia(mediaId)
        if (!media) {
          console.warn(`[webhook] No se pudo descargar imagen ${mediaId}, ignorando`)
          continue
        }

        const source: MessageSource = caption ? 'image+text' : 'image'

        payload = {
          messageId:     message.id,
          from:          message.from,
          groupId,
          groupName,
          text:          caption,           // caption del realtor (puede ser undefined)
          timestamp:     message.timestamp,
          source,
          imageBase64:   media.base64,
          imageMimeType: media.mimeType,
          imageMediaId:  mediaId
        }
      }

      if (!payload) continue

      processingPromises.push(
        parseAndStoreMessage(payload).catch((err) =>
          console.error(`[webhook] Error procesando mensaje ${message.id}:`, err)
        )
      )
    }

    // after() mantiene viva la función serverless hasta terminar el
    // procesamiento (Vercel corta las promesas sueltas tras responder).
    after(async () => {
      await Promise.allSettled(processingPromises)
    })

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[webhook] Error crítico:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
