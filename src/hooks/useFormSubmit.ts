'use client'

/**
 * Hook genérico para envío de formularios con manejo uniforme de
 * loading state y errores. Útil para formularios fuera de useCrudPage.
 *
 * Ejemplo:
 *   const { guardando, error, enviar } = useFormSubmit({
 *     onSuccess: () => router.push('/lista'),
 *   })
 *
 *   const onSubmit = () => enviar(async () => {
 *     return await api.post('/algo', form)
 *   })
 */

import { useCallback, useState } from 'react'

interface UseFormSubmitOptions<T> {
  onSuccess?: (data: T) => void | Promise<void>
  onError?: (error: Error) => void
  onFinally?: () => void
  /** Mensaje fallback si el error no es Error instance. */
  mensajeFallback?: string
}

export function useFormSubmit<T = unknown>(opts: UseFormSubmitOptions<T> = {}) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const enviar = useCallback(
    async (submitFn: () => Promise<T>): Promise<T | undefined> => {
      setGuardando(true)
      setError('')
      try {
        const result = await submitFn()
        if (opts.onSuccess) await opts.onSuccess(result)
        return result
      } catch (e) {
        const msg = e instanceof Error
          ? e.message
          : (opts.mensajeFallback || 'Error al guardar')
        setError(msg)
        if (opts.onError) opts.onError(e instanceof Error ? e : new Error(msg))
        return undefined
      } finally {
        setGuardando(false)
        if (opts.onFinally) opts.onFinally()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return { guardando, error, setError, enviar }
}
