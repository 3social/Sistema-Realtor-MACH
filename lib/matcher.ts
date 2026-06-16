// ============================================================
// lib/matcher.ts
// Motor de matching: busca pares oferta-demanda compatibles
// usando búsqueda vectorial coseno en Supabase (pgvector)
// ============================================================
import { supabaseAdmin } from './supabase'
import type { Property } from '@/types'

/** Score mínimo de similitud coseno para registrar un match (0-1) */
const MATCH_THRESHOLD = 0.75

/** Cantidad máxima de candidatos por búsqueda */
const MATCH_COUNT = 10

/**
 * Dado una propiedad recién insertada, busca sus contrapartes compatibles
 * en el pool de Supabase y registra los matches encontrados.
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

  const searchType = newProperty.type === 'offer' ? 'demand' : 'offer'

  // Búsqueda vectorial via función SQL
  const { data: candidates, error } = await supabaseAdmin.rpc(
    'match_properties',
    {
      query_embedding: newProperty.embedding,
      search_type: searchType,
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
