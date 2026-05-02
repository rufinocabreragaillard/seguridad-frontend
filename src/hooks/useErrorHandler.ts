'use client'

/**
 * Hook para manejo uniforme de errores en componentes.
 *
 * Ejemplo:
 *   const { error, mensaje, manejar, limpiar } = useErrorHandler()
 *   try { await api.get(...) } catch (e) { manejar(e, 'Error al cargar') }
 *
 * Si necesitas distinguir entre "sin error" y "error vacío", usa `error`
 * (Error|null). Para mostrar texto al usuario usa `mensaje` (string).
 */

import { useCallback, useState } from 'react'

export function useErrorHandler(mensajeDefault = 'Ocurrió un error') {
  const [error, setError] = useState<Error | null>(null)

  const manejar = useCallback((e: unknown, fallback?: string) => {
    if (e instanceof Error) {
      setError(e)
    } else if (typeof e === 'string') {
      setError(new Error(e))
    } else {
      setError(new Error(fallback || mensajeDefault))
    }
  }, [mensajeDefault])

  const limpiar = useCallback(() => setError(null), [])

  return {
    error,
    mensaje: error?.message || '',
    manejar,
    limpiar,
    setError,
  }
}
