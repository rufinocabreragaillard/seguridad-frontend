'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

export type OpcionBuscable = { valor: string; etiqueta: string; hint?: string }

export function SelectorBuscable({
  etiqueta,
  valor,
  opciones,
  onSeleccionar,
  placeholder = 'Buscar...',
  disabled = false,
}: {
  etiqueta: string
  valor: string
  opciones: OpcionBuscable[]
  onSeleccionar: (valor: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => {
    if (abierto) return
    const sel = opciones.find((o) => o.valor === valor)
    setBusqueda(sel ? sel.etiqueta : '')
  }, [valor, opciones, abierto])

  const filtradas = opciones.filter((o) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      o.etiqueta.toLowerCase().includes(q) ||
      o.valor.toLowerCase().includes(q) ||
      (o.hint ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-1 [.modal-body_&]:flex-row [.modal-body_&]:items-center [.modal-body_&]:gap-3">
      <label className="text-sm font-medium text-texto [.modal-body_&]:w-40 [.modal-body_&]:flex-shrink-0 [.modal-body_&]:text-right [.modal-body_&]:after:content-[':']">{etiqueta}</label>
      <div className="relative [.modal-body_&]:flex-1" ref={ref}>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={busqueda}
          disabled={disabled}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setAbierto(true)
            if (!e.target.value) onSeleccionar('')
          }}
          onFocus={() => !disabled && setAbierto(true)}
          className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
        />
        {abierto && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onSeleccionar(''); setBusqueda(''); setAbierto(false) }}
              className="w-full text-left px-3 py-2 text-sm text-texto-muted italic hover:bg-primario-muy-claro hover:text-primario transition-colors"
            >
              — Sin selección —
            </button>
            {filtradas.slice(0, 30).map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => { onSeleccionar(o.valor); setBusqueda(o.etiqueta); setAbierto(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors flex items-center gap-2"
              >
                <span className="font-medium">{o.etiqueta}</span>
                {o.hint && <span className="text-texto-muted text-xs">{o.hint}</span>}
              </button>
            ))}
            {filtradas.length === 0 && (
              <div className="px-3 py-2 text-sm text-texto-muted">Sin resultados</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
