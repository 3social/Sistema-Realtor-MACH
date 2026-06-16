// ============================================================
// lib/supabase.ts
// Clientes de Supabase para uso público y admin (server-side)
// ============================================================
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/** Cliente público — para uso en componentes del lado del cliente */
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Cliente admin con service role key — SOLO usar en server-side (API routes, lib/).
 * Tiene permisos completos, nunca exponer al cliente.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
