// ============================================================
// types/index.ts
// Interfaces TypeScript centralizadas para todo el sistema
// ============================================================

/** Tipo de fuente del mensaje de WhatsApp */
export type MessageSource = 'text' | 'image' | 'image+text'

/** Payload crudo que llega desde el webhook de Meta */
export interface WebhookPayload {
  messageId:     string
  from:          string          // número del remitente (ej: "50688887777")
  groupId:       string          // ID del grupo de WhatsApp
  groupName?:    string          // nombre del grupo si disponible
  text?:         string          // cuerpo del mensaje (vacío en imágenes sin caption)
  timestamp:     string          // unix timestamp como string
  source:        MessageSource   // origen: texto puro, imagen pura o imagen+caption
  // Campos para mensajes con imagen
  imageBase64?:  string          // imagen codificada en base64 (sin prefijo data:)
  imageMimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  imageMediaId?: string          // ID de media en Meta (para debugging)
}

/** Resultado que devuelve el modelo al clasificar un mensaje */
export interface ParsedProperty {
  type: 'offer' | 'demand' | 'ignore'
  property_type: 'casa' | 'apartamento' | 'lote' | 'finca' | 'local' | 'oficina' | null
  operation: 'venta' | 'alquiler' | null
  location: string | null
  price_min: number | null
  price_max: number | null
  bedrooms_min: number | null
  bedrooms_max: number | null
  bathrooms: number | null
  area_m2: number | null
  features: string[]
  condition: 'nuevo' | 'usado' | 'en planos' | null
  summary: string
}

/** Registro completo en la tabla `properties` de Supabase */
export interface Property {
  id: string
  group_id: string
  group_name?: string
  sender_phone: string
  sender_name?: string
  raw_message: string
  type: 'offer' | 'demand'
  property_type?: string
  location?: string
  price_min?: number
  price_max?: number
  bedrooms_min?: number
  bedrooms_max?: number
  bathrooms?: number
  area_m2?: number
  features?: string[]
  condition?: string
  operation?: string
  extras?: { summary?: string; [key: string]: unknown }
  embedding?: number[]
  created_at: string
  is_active: boolean
}

/** Registro en la tabla `matches` */
export interface Match {
  id: string
  offer_id: string
  demand_id: string
  score: number
  status: 'pending' | 'contacted' | 'closed' | 'dismissed'
  created_at: string
}

/** Match enriquecido con datos de ambas propiedades (para el dashboard) */
export interface MatchWithProperties extends Match {
  offer: Property
  demand: Property
}

/** Status posibles para actualizar un match */
export type MatchStatus = 'pending' | 'contacted' | 'closed' | 'dismissed'
