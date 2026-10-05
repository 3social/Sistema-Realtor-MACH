// ============================================================
// lib/embeddings.ts
// Generación de embeddings vectoriales con OpenAI
// Modelo: text-embedding-3-small (1536 dims, $0.02/1M tokens)
// ============================================================
import OpenAI from 'openai'

// Cliente perezoso: no se crea al importar el módulo, así `next build`
// no falla si OPENAI_API_KEY aún no está configurada (se exige en runtime).
let openai: OpenAI | undefined
function getOpenAI(): OpenAI {
  return (openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }))
}

/**
 * Genera un embedding vectorial de 1536 dimensiones para un texto dado.
 * Si la llamada a OpenAI falla, retorna un array de zeros como fallback
 * para no perder el registro en base de datos (el matching semántico
 * no funcionará para ese registro, pero el resto del sistema sigue).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000) // límite de tokens del modelo
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('[embeddings] OpenAI error, usando fallback de zeros:', error)
    // Fallback: array de zeros — el registro se guarda pero sin matching semántico
    return new Array(1536).fill(0)
  }
}

/**
 * Construye el texto que se convierte en embedding.
 * Combina los campos más relevantes para un matching semántico efectivo.
 */
export function buildEmbeddingText(parsed: {
  type: string
  property_type?: string | null
  operation?: string | null
  location?: string | null
  price_max?: number | null
  bedrooms_min?: number | null
  features?: string[]
  summary?: string
}): string {
  const parts: string[] = [
    parsed.type === 'offer' ? 'Propiedad disponible:' : 'Busco propiedad:',
    parsed.property_type ?? '',
    parsed.operation ?? '',
    parsed.location ? `en ${parsed.location}` : '',
    parsed.price_max ? `hasta $${parsed.price_max.toLocaleString()}` : '',
    parsed.bedrooms_min ? `${parsed.bedrooms_min} habitaciones` : '',
    ...(parsed.features ?? []),
    parsed.summary ?? ''
  ]

  return parts.filter(Boolean).join(', ')
}
