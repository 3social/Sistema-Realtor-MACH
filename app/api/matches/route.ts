// ============================================================
// app/api/matches/route.ts
// API para gestionar los matches del dashboard
//
// GET   → Lista matches pendientes con datos de ambas propiedades
// PATCH → Actualizar el status de un match
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { MatchStatus } from '@/types'

// ── GET: Lista de matches ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = (searchParams.get('status') ?? 'pending') as MatchStatus
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select(`
      id,
      score,
      status,
      created_at,
      offer:properties!offer_id (
        id, sender_phone, sender_name, group_id, group_name,
        property_type, operation, location,
        price_min, price_max, bedrooms_min, bedrooms_max, bathrooms,
        area_m2, features, condition, extras, raw_message, created_at
      ),
      demand:properties!demand_id (
        id, sender_phone, sender_name, group_id, group_name,
        property_type, operation, location,
        price_min, price_max, bedrooms_min, bedrooms_max, bathrooms,
        area_m2, features, condition, extras, raw_message, created_at
      )
    `)
    .eq('status', status)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[api/matches GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ matches, count: matches?.length ?? 0 })
}

// ── PATCH: Actualizar status de un match ───────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { matchId, status } = body as { matchId: string; status: MatchStatus }

    const validStatuses: MatchStatus[] = ['pending', 'contacted', 'closed', 'dismissed']
    if (!matchId || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'matchId y status válido son requeridos' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('matches')
      .update({ status })
      .eq('id', matchId)

    if (error) {
      console.error('[api/matches PATCH] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, matchId, status })
  } catch {
    return NextResponse.json({ error: 'Request inválido' }, { status: 400 })
  }
}
