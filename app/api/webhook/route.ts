// ============================================================
// app/api/webhook/route.ts
// Webhook de Meta WhatsApp Business API
//
// GET  → Verificación del webhook (requerido por Meta al configurar)
// POST → Recepción de mensajes: texto, imagen, imagen+caption
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { parseAndStoreMessage } from '@/lib/parser'
import { downloadWhatsAppMedia } from '@/lib/whatsapp'
import type { WebhookPayload, MessageSource } from '@/types'

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
    const body = await req.json()

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

        // Descargar imagen de Meta → base64 para Claude Vision
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

    Promise.allSettled(processingPromises).catch(console.error)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[webhook] Error crítico:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
