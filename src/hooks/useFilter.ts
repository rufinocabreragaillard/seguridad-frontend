'use client'

/**
 * Hook puro de filtrado multi-campo. No carga datos, solo filtra una lista
 * que ya tienes en memoria.
 *
 * Ejemplo:
 *   const filtrados = useFilter(items, busqueda, [
 *     { campo: 'codigo_usuario' },
 *     { campo: 'operacion' },
 *     { campo: 'fecha', matcher: (v, q) => v.startsWith(q) },
 *   ])
 */

import { useMemo } from 'react'

export interface FilterRule<T> {
  /** Nombre del campo a comparar. */
  campo: keyof T
  /** Si true compara con sensibilidad de mayúsculas (default false). */
  caseSensitive?: boolean
  /** Matcher custom; recibe el valor del campo y la query normalizada. */
  matcher?: (valor: any, query: string) => boolean
}

export function useFilter<T extends Record<string, any>>(
  items: T[],
  busqueda: string,
  reglas: FilterRule<T>[],
): T[] {
  return useMemo(() => {
    const q = (busqueda || '').trim()
    if (!q) return items
    const qLower = q.toLowerCase()
    return items.filter(item =>
      reglas.some(regla => {
        const valor = item[regla.campo]
        if (valor === null || valor === undefined) return false
        if (regla.matcher) {
          return regla.matcher(valor, regla.caseSensitive ? q : qLower)
        }
        const v = regla.caseSensitive ? String(valor) : String(valor).toLowerCase()
        return v.includes(regla.caseSensitive ? q : qLower)
      })
    )
  }, [items, busqueda, reglas])
}
