import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Obtiene el token JWT de la sesión activa de Supabase.
 * Se deduplica para evitar múltiples llamadas concurrentes a getSession(),
 * que causaban errores de lock en el cliente de Supabase.
 */
let _tokenPromise: Promise<string | null> | null = null

export async function obtenerToken(): Promise<string | null> {
  if (!_tokenPromise) {
    _tokenPromise = supabase.auth.getSession()
      .then(({ data }) => data.session?.access_token ?? null)
      .finally(() => { _tokenPromise = null })
  }
  return _tokenPromise
}
