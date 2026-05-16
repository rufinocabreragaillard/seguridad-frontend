import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// Lock que usa navigator.locks con `steal: true` desde el primer intento.
// Evita el cuelgue de 5s de "Iniciando sesión…" cuando un lock quedó huérfano
// (React Strict Mode, tab anterior que no liberó, F5 durante auth, etc.).
// El watchdog por defecto de gotrue-js espera 5s antes de hacer steal; acá
// directamente hacemos steal para que no haya espera.
// Safe para uso single-tab: un lock stolen solo afecta a una operación de
// auth concurrente en otro tab, y Supabase maneja el conflicto internamente.
const lockConSteal = async <R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return fn()
  }
  return new Promise<R>((resolve, reject) => {
    navigator.locks
      .request(name, { mode: 'exclusive', steal: true }, async () => {
        try {
          resolve(await fn())
        } catch (e) {
          reject(e)
        }
      })
      .catch(reject)
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: lockConSteal,
  },
})

/**
 * Obtiene el token JWT de la sesión activa de Supabase.
 * - Deduplicado para evitar refreshes concurrentes (N_CONCURRENTE=6 causaba deadlocks).
 * - Con timeout en getSession() y refreshSession() para evitar requests colgados
 *   tras inactividad prolongada (el preflight OPTIONS al endpoint /token
 *   ocasionalmente no despacha el POST). Sin timeout, axios queda esperando
 *   indefinidamente en el interceptor y la UI se ve "Cargando…" sin avanzar.
 * - Si falla el refresh, se hace signOut local para forzar redirect a /login.
 */
const TIMEOUT_TOKEN_MS = 4000
let _tokenPromise: Promise<string | null> | null = null

function conTimeout<T>(promesa: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout_${etiqueta}`)), ms),
    ),
  ])
}

export async function obtenerToken(): Promise<string | null> {
  if (!_tokenPromise) {
    _tokenPromise = (async () => {
      try {
        const { data: { session } } = await conTimeout(
          supabase.auth.getSession(),
          TIMEOUT_TOKEN_MS,
          'getSession',
        )
        if (!session) return null
        const expira = session.expires_at ?? 0
        const ahora = Math.floor(Date.now() / 1000)
        const minutosRestantes = (expira - ahora) / 60
        if (minutosRestantes < 5) {
          try {
            const { data: { session: nueva } } = await conTimeout(
              supabase.auth.refreshSession(),
              TIMEOUT_TOKEN_MS,
              'refreshSession',
            )
            return nueva?.access_token ?? null
          } catch {
            // refresh colgado/fallido tras inactividad larga: limpiar sesión local
            // para que el próximo render del AuthContext redirija al login.
            supabase.auth.signOut({ scope: 'local' }).catch(() => {})
            return null
          }
        }
        return session.access_token
      } catch {
        return null
      }
    })().finally(() => { _tokenPromise = null })
  }
  return _tokenPromise
}
