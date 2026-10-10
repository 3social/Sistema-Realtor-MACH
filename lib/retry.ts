// ============================================================
// lib/retry.ts
// Reintentos para fallos TRANSITORIOS de la base de datos (Supabase)
//
// Un corte de red/DNS (ENOTFOUND), un 5xx de Supabase o de Cloudflare
// (521...) se reintentan con espera creciente. Los errores de datos
// (constraint, tipo inválido, etc.) NO se reintentan: nunca van a funcionar.
// ============================================================

/** Fallo transitorio que justifica que el emisor del webhook reintente */
export class TransientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransientError'
  }
}

/** Esperas entre reintentos (ms). Se pueden sobreescribir con DB_RETRY_DELAYS_MS="1000,3000". */
const DEFAULT_DELAYS_MS = [1000, 3000, 8000, 20000]

function retryDelays(): number[] {
  const raw = process.env.DB_RETRY_DELAYS_MS
  if (!raw) return DEFAULT_DELAYS_MS
  const parsed = raw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n >= 0)
  return parsed.length ? parsed : DEFAULT_DELAYS_MS
}

const TRANSIENT_MESSAGE = /fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|<!DOCTYPE html|Web server is down/i

/** Respuesta mínima de supabase-js que necesitamos para decidir si reintentar */
export interface DbResponse {
  error: { message?: string } | null
  status: number
}

/** ¿El error es de infraestructura (red, 5xx, 429) y no de los datos? */
export function isTransientDbError(res: DbResponse): boolean {
  if (!res.error) return false
  if (res.status === 0 || res.status === 408 || res.status === 429 || res.status >= 500) return true
  return TRANSIENT_MESSAGE.test(res.error.message ?? '')
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Ejecuta una operación de Supabase y la repite mientras falle por causas transitorias.
 * Devuelve siempre la última respuesta; el llamador decide qué hacer si sigue con error.
 */
export async function dbRetry<R extends DbResponse>(op: () => PromiseLike<R>, label: string): Promise<R> {
  let res = await op()
  for (const wait of retryDelays()) {
    if (!isTransientDbError(res)) return res
    console.warn(`[db] ${label}: fallo transitorio (${res.status}), reintentando en ${wait}ms`)
    await sleep(wait)
    res = await op()
  }
  return res
}
