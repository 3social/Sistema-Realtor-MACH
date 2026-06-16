// ============================================================
// app/api/properties/route.ts
// API para consultar el pool de propiedades
//
// GET → Lista propiedades activas con filtros opcionales
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const type     = searchParams.get('type')     // 'offer' | 'demand'
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const location = searchParams.get('location') // filtro por zona

  let query = supabaseAdmin
    .from('properties')
    .select('id, type, property_type, operation, location, price_min, price_max, bedrooms_min, features, extras, sender_phone, group_id, group_name, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type === 'offer' || type === 'demand') {
    query = query.eq('type', type)
  }

  if (location) {
    query = query.ilike('location', `%${location}%`)
  }

  const { data: properties, error } = await query

  if (error) {
    console.error('[api/properties GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ properties, count: properties?.length ?? 0 })
}
