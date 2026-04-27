'use client'

import { useEffect, useState } from 'react'
import { tiposAccesoApi } from '@/lib/api'

type FilaGrafo = { ancestro: string; descendiente: string; profundidad: number }

// Singleton en módulo: se carga una sola vez por sesión del browser
let _grafo: FilaGrafo[] | null = null
let _promesa: Promise<FilaGrafo[]> | null = null

function cargarGrafo(): Promise<FilaGrafo[]> {
  if (_grafo) return Promise.resolve(_grafo)
  if (_promesa) return _promesa
  _promesa = tiposAccesoApi.listarGrafo().then((data) => {
    _grafo = data
    return data
  })
  return _promesa
}

/**
 * Hook que expone el closure table tipo_acceso_grafo.
 * esDescendiente(ancestro, tipo) → true si `tipo` es visible para un usuario de tipo `ancestro`.
 */
export function useTipoAccesoGrafo() {
  const [grafo, setGrafo] = useState<FilaGrafo[]>(_grafo || [])

  useEffect(() => {
    if (_grafo) return
    cargarGrafo().then(setGrafo).catch(() => {})
  }, [])

  function esDescendiente(ancestro: string | undefined | null, tipo: string | undefined | null): boolean {
    if (!ancestro || !tipo) return false
    // Fallback si el grafo no cargó: comparación exacta
    if (grafo.length === 0) return ancestro === tipo
    return grafo.some((f) => f.ancestro === ancestro && f.descendiente === tipo)
  }

  function tiposVisibles(ancestro: string | undefined | null): string[] {
    if (!ancestro) return []
    if (grafo.length === 0) return [ancestro]
    return grafo.filter((f) => f.ancestro === ancestro).map((f) => f.descendiente)
  }

  return { grafo, esDescendiente, tiposVisibles }
}
