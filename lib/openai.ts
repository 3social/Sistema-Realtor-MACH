// ============================================================
// lib/openai.ts
// Cliente único de OpenAI (clasificación + embeddings)
// ============================================================
import OpenAI from 'openai'

// Cliente perezoso: no se crea al importar el módulo, así `next build`
// no falla si OPENAI_API_KEY aún no está configurada (se exige en runtime).
let client: OpenAI | undefined

export function getOpenAI(): OpenAI {
  return (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }))
}
