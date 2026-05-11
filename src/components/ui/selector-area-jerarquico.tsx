'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ChevronDown, X, FolderOpen } from 'lucide-react'
import type { Area } from '@/lib/tipos'

interface Props {
  areas: Area[]
  valor: string
  onChange: (codigo: string) => void
  deshabilitado?: boolean
  cargando?: boolean
}

function construirEtiqueta(area: Area, areas: Area[]): string {
  const partes: string[] = [area.nombre]
  let actual = area
  let iteraciones = 0
  while (actual.codigo_area_superior && iteraciones < 10) {
    const padre = areas.find((a) => a.codigo_area === actual.codigo_area_superior)
    if (!padre) break
    partes.unshift(padre.nombre)
    actual = padre
    iteraciones++
  }
  return partes.join(' › ')
}

function ordenarJerarquico(areas: Area[]): Area[] {
  const map = new Map<string, Area[]>()
  const raices: Area[] = []
  for (const a of areas) {
    if (!a.codigo_area_superior) {
      raices.push(a)
    } else {
      const hijos = map.get(a.codigo_area_superior) ?? []
      hijos.push(a)
      map.set(a.codigo_area_superior, hijos)
    }
  }
  const resultado: Area[] = []
  function agregar(nodos: Area[]) {
    for (const n of nodos.sort((a, b) => a.nombre.localeCompare(b.nombre))) {
      resultado.push(n)
      const hijos = map.get(n.codigo_area) ?? []
      agregar(hijos)
    }
  }
  agregar(raices)
  return resultado
}

export function SelectorAreaJerarquico({ areas, valor, onChange, deshabilitado, cargando }: Props) {
  const tc = useTranslations('common')
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const areaSeleccionada = areas.find((a) => a.codigo_area === valor)
  const etiquetaSeleccionada = areaSeleccionada
    ? construirEtiqueta(areaSeleccionada, areas)
    : tc('sinArea')

  const areasOrdenadas = useMemo(() => ordenarJerarquico(areas), [areas])

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return areasOrdenadas
    const q = busqueda.toLowerCase()
    return areas.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        a.codigo_area.toLowerCase().includes(q) ||
        (a.alias ?? '').toLowerCase().includes(q),
    )
  }, [busqueda, areasOrdenadas, areas])

  useEffect(() => {
    if (!abierto) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [abierto])

  useEffect(() => {
    if (abierto) {
      setBusqueda('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [abierto])

  function seleccionar(codigo: string) {
    onChange(codigo)
    setAbierto(false)
  }

  const claseBoton =
    'w-full flex items-center justify-between rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50 text-left'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !deshabilitado && !cargando && setAbierto((v) => !v)}
        disabled={deshabilitado || cargando}
        className={claseBoton}
      >
        <span className={areaSeleccionada ? 'text-texto' : 'text-texto-muted'}>
          {cargando ? tc('cargandoAreas') : etiquetaSeleccionada}
        </span>
        <ChevronDown size={14} className="shrink-0 text-texto-muted" />
      </button>

      {abierto && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg flex flex-col max-h-64">
          {/* Buscador */}
          <div className="p-2 border-b border-borde">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-texto-muted" />
              <input
                ref={inputRef}
                type="text"
                placeholder={tc('buscarArea')}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-7 pr-6 py-1.5 text-sm rounded border border-borde bg-fondo text-texto focus:outline-none focus:ring-1 focus:ring-primario"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-texto-muted hover:text-texto"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {/* Opción "Sin área" */}
            <button
              type="button"
              onClick={() => seleccionar('')}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-primario/10 transition-colors ${
                !valor ? 'bg-primario/10 font-medium text-primario' : 'text-texto-muted'
              }`}
            >
              {tc('sinArea')}
            </button>

            {filtradas.length === 0 && (
              <div className="px-3 py-2 text-sm text-texto-muted">{tc('sinResultados')}</div>
            )}

            {filtradas.map((area) => {
              const indent = (area.nivel ?? 0) * 16
              const seleccionada = area.codigo_area === valor
              return (
                <button
                  key={area.codigo_area}
                  type="button"
                  onClick={() => seleccionar(area.codigo_area)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-primario/10 transition-colors flex items-center gap-2 ${
                    seleccionada ? 'bg-primario/10 font-medium text-primario' : 'text-texto'
                  }`}
                  style={{ paddingLeft: `${12 + indent}px` }}
                >
                  <FolderOpen
                    size={13}
                    className={`shrink-0 ${seleccionada ? 'text-primario' : 'text-amber-400'}`}
                  />
                  <span className="truncate flex-1">{area.nombre}</span>
                  {area.alias && (
                    <span className="text-xs text-texto-muted">({area.alias})</span>
                  )}
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700">
                    {tc('area')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
