// Carga las fases narrativas desde tipos_proceso (categoría PROCESAR_DOCS) usando
// el alias de BD como etiquetaCorta. Si la API falla o no hay alias, cae al
// array hardcoded en pipeline-narrativo.ts para no romper la UI.
//
// Las claves técnicas (CARGAR/EXTRAER/ANALIZAR/CHUNKEAR/VECTORIZAR) son contrato
// entre BD (codigo_tipo_proceso) y código (ClavePaso). Solo los textos visibles
// se editan desde la pantalla de Tipos de Proceso.

'use client'

import { useEffect, useState } from 'react'
import { procesosDatosBasicosApi } from '@/lib/api'
import {
  FASES_NARRATIVAS,
  type ClavePaso,
  type ClaveEstadoDoc,
  type FaseNarrativa,
} from '@/lib/pipeline-narrativo'

const CATEGORIA = 'PROCESAR_DOCS'

const ESTADO_DESTINO_POR_PASO: Record<ClavePaso, ClaveEstadoDoc> = {
  CARGAR: 'CARGADO',
  EXTRAER: 'METADATA',
  ANALIZAR: 'ESCANEADO',
  CHUNKEAR: 'CHUNKEADO',
  VECTORIZAR: 'VECTORIZADO',
}

const COLOR_POR_PASO: Record<ClavePaso, string> = {
  CARGAR: '#0EA5E9',
  EXTRAER: '#F59E0B',
  ANALIZAR: '#F97316',
  CHUNKEAR: '#84CC16',
  VECTORIZAR: '#22C55E',
}

const PASOS_VALIDOS = new Set<ClavePaso>([
  'CARGAR', 'EXTRAER', 'ANALIZAR', 'CHUNKEAR', 'VECTORIZAR',
])

export function useFasesNarrativas(): FaseNarrativa[] {
  const [fases, setFases] = useState<FaseNarrativa[]>(FASES_NARRATIVAS)

  useEffect(() => {
    let cancelado = false
    procesosDatosBasicosApi
      .listarTipos(CATEGORIA)
      .then((tipos) => {
        if (cancelado) return
        const filas = (tipos ?? [])
          .filter((t) => PASOS_VALIDOS.has(t.codigo_tipo_proceso as ClavePaso))
          .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
        if (filas.length === 0) return
        const dinamicas: FaseNarrativa[] = filas.map((t) => {
          const clave = t.codigo_tipo_proceso as ClavePaso
          const alias = (t.alias ?? '').trim()
          const nombre = (t.nombre_tipo_proceso ?? '').trim()
          const etiquetaCorta = (alias || nombre || clave).toUpperCase()
          const etiquetaLarga = alias || nombre || clave
          return {
            clave,
            estadoDestino: ESTADO_DESTINO_POR_PASO[clave],
            etiquetaCorta,
            etiquetaLarga,
            color: COLOR_POR_PASO[clave],
            i18nKey: `fase${clave}`,
          }
        })
        setFases(dinamicas)
      })
      .catch(() => {
        // Mantener fallback hardcoded
      })
    return () => {
      cancelado = true
    }
  }, [])

  return fases
}
