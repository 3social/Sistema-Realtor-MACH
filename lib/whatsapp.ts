// ============================================================
// lib/whatsapp.ts
// Helpers para interactuar con la Meta WhatsApp Business API
//
// Responsabilidad: descargar media (imágenes) usando el media ID
// que llega en el webhook y convertirla a base64 para Claude Vision
// ============================================================

/** Tipos MIME soportados por Claude Vision */
type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const SUPPORTED_MIMES: SupportedMime[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const META_GRAPH_URL = 'https://graph.facebook.com/v19.0'

/** Resultado de descargar una imagen de Meta */
export interface MediaDownloadResult {
  base64: string
  mimeType: SupportedMime
}

/**
 * Descarga una imagen de WhatsApp usando su media ID.
 *
 * Flujo Meta API:
 * 1. GET /{media-id} → obtiene la URL temporal de descarga
 * 2. GET {url}       → descarga los bytes de la imagen
 * 3. Convertir a base64
 *
 * Ambas peticiones requieren: Authorization: Bearer {access_token}
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<MediaDownloadResult | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!accessToken) {
    console.error('[whatsapp] WHATSAPP_ACCESS_TOKEN no configurado')
    return null
  }

  try {
    // ── PASO 1: Obtener URL de descarga ───────────────────────
    const metaRes = await fetch(`${META_GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!metaRes.ok) {
      console.error(`[whatsapp] Error obteniendo URL de media ${mediaId}: ${metaRes.status}`)
      return null
    }

    const metaData = await metaRes.json() as {
      url: string
      mime_type: string
      file_size: number
      id: string
    }

    const { url, mime_type } = metaData

    // Verificar tipo MIME soportado
    if (!SUPPORTED_MIMES.includes(mime_type as SupportedMime)) {
      console.warn(`[whatsapp] Tipo MIME no soportado: ${mime_type}`)
      return null
    }

    // ── PASO 2: Descargar la imagen ───────────────────────────
    const imageRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!imageRes.ok) {
      console.error(`[whatsapp] Error descargando imagen: ${imageRes.status}`)
      return null
    }

    // ── PASO 3: Convertir a base64 ────────────────────────────
    const arrayBuffer = await imageRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    console.log(`[whatsapp] Imagen descargada: ${mime_type}, ${Math.round(arrayBuffer.byteLength / 1024)}KB`)

    return {
      base64,
      mimeType: mime_type as SupportedMime
    }
  } catch (error) {
    console.error(`[whatsapp] Error al descargar media ${mediaId}:`, error)
    return null
  }
}
