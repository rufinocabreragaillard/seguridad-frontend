'use client'

/**
 * Hook ligero para páginas read-only que solo necesitan listar + filtrar.
 *
 * Complementa a `useCrudPage` (que es más pesado y orientado a CRUD completo).
 * Casos de uso típicos: pantallas de auditoría, históricos, dashboards,
 * cualquier listado sin modal de crear/editar.
 *
 * Ejemplo:
 *   const { filtrados, cargando, busqueda, setBusqueda, error, recargar } =
 *     useListadoSimple<RegistroAuditoria>({
 *       cargarFn: () => auditoriaApi.listar({ tipo: 'usuarios', por_pagina: 100 }),
 *       camposBusqueda: r => [r.codigo_usuario, r.operacion, r.codigo_registro],
 *     })
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'

interface UseListadoSimpleOptions<T> {
  cargarFn: () => Promise<T[]>
  /** Campos a comparar contra la búsqueda. Si no se provee, no hay filtro. */
  camposBusqueda?: (item: T) => Array<string | number | null | undefined>
  /** Cargar al montar (default true). */
  cargarInicial?: boolean
  /** Mensaje de fallback de error. */
  mensajeError?: string
}

export function useListadoSimple<T>(opts: UseListadoSimpleOptions<T>) {
  const t = useTranslations('common')
  const [items, setItems] = useState<T[]>([])
  const [cargando, setCargando] = useState(opts.cargarInicial !== false)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const data = await opts.cargarFn()
      setItems(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : (opts.mensajeError || t('errorAlCargar'))
      setError(msg)
    } finally {
      setCargando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (opts.cargarInicial !== false) {
      recargar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    if (!busqueda || !opts.camposBusqueda) return items
    const q = busqueda.toLowerCase().trim()
    if (!q) return items
    return items.filter(item =>
      opts.camposBusqueda!(item).some(campo => {
        if (campo === null || campo === undefined) return false
        return String(campo).toLowerCase().includes(q)
      })
    )
  }, [items, busqueda, opts.camposBusqueda])

  return {
    items,
    filtrados,
    cargando,
    busqueda,
    setBusqueda,
    error,
    setError,
    recargar,
    setItems,
  }
}
