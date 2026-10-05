// ============================================================
// lib/matcher.ts
// Motor de matching: busca pares oferta-demanda compatibles
// usando búsqueda vectorial coseno en Supabase (pgvector)
// ============================================================
import { supabaseAdmin } from './supabase'
import type { Property } from '@/types'

/**
 * Similitud coseno mínima (0-1) entre los embeddings. Los criterios duros
 * (tipo de propiedad, operación, zona, precio, habitaciones, remitente)
 * se aplican en SQL dentro de `match_properties`; el embedding solo ordena y
 * descarta lo que no se parece en características/resumen. Calibrar con datos reales.
 */
const MATCH_THRESHOLD = 0.6

/** Cantidad máxima de candidatos por búsqueda */
const MATCH_COUNT = 10

/**
 * Dado una propiedad recién insertada, busca sus contrapartes compatibles
 * en el pool de Supabase y registra los matches encontrados.
 * La compatibilidad se decide en la función SQL `match_properties`
 * (ver supabase/schema.sql).
 *
 * - Si llegó una OFERTA → busca DEMANDAS compatibles
 * - Si llegó una DEMANDA → busca OFERTAS compatibles
 */
export async function findMatches(newProperty: Property): Promise<void> {
  // Sin embedding no podemos hacer matching semántico
  if (!newProperty.embedding || newProperty.embedding.every(v => v === 0)) {
    console.warn(`[matcher] Propiedad ${newProperty.id} sin embedding válido, skipping match`)
    return
  }

  // Filtros duros + similitud vectorial via función SQL
  const { data: candidates, error } = await supabaseAdmin.rpc(
    'match_properties',
    {
      p_property_id: newProperty.id,
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT
    }
  )

  if (error) {
    console.error('[matcher] Error en búsqueda vectorial:', error)
    return
  }

  if (!candidates || candidates.length === 0) {
    console.log(`[matcher] Sin matches para propiedad ${newProperty.id}`)
    return
  }

  console.log(`[matcher] ${candidates.length} candidatos encontrados para ${newProperty.id}`)

  // Registrar cada match evitando duplicados
  for (const candidate of candidates) {
    const offerId  = newProperty.type === 'offer' ? newProperty.id : candidate.id
    const demandId = newProperty.type === 'demand' ? newProperty.id : candidate.id

    const { error: upsertError } = await supabaseAdmin
      .from('matches')
      .upsert(
        {
          offer_id:  offerId,
          demand_id: demandId,
          score:     candidate.similarity
        },
        {
          onConflict: 'offer_id,demand_id',
          ignoreDuplicates: true
        }
      )

    if (upsertError) {
      console.error('[matcher] Error al guardar match:', upsertError)
    } else {
      console.log(`[matcher] Match guardado: offer=${offerId} <-> demand=${demandId} score=${candidate.similarity.toFixed(3)}`)
    }
  }
}
