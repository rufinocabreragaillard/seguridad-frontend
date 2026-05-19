'use client'

import React, { useEffect, useState } from 'react'
import { parametrosApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface NivelCargaToggleProps {
  disabled?: boolean
  className?: string
}

export function NivelCargaToggle({ disabled = false, className = '' }: NivelCargaToggleProps) {
  const { grupoActivo } = useAuth()
  const [nivelCarga, setNivelCarga] = useState<'ALTO' | 'BAJO'>('ALTO')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!grupoActivo) return
    parametrosApi
      .obtenerValor('PROCESAMIENTO', 'NIVEL_CARGA_SEMANTICA')
      .then((r) => {
        if (r?.valor === 'BAJO' || r?.valor === 'ALTO') setNivelCarga(r.valor)
      })
      .catch(() => {})
  }, [grupoActivo])

  const cambiar = async (v: 'ALTO' | 'BAJO') => {
    if (v === nivelCarga || guardando) return
    const prev = nivelCarga
    setNivelCarga(v)
    setGuardando(true)
    try {
      await parametrosApi.upsertUsuario({
        categoria_parametro: 'PROCESAMIENTO',
        tipo_parametro: 'NIVEL_CARGA_SEMANTICA',
        valor_parametro: v,
      })
    } catch {
      setNivelCarga(prev)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`}>
      <label className="text-sm font-medium text-texto shrink-0">Nivel de carga semántica:</label>
      <div
        role="radiogroup"
        aria-label="Nivel de carga semántica"
        className="inline-flex rounded-lg border border-borde bg-fondo-tarjeta p-0.5"
      >
        {(['BAJO', 'ALTO'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={nivelCarga === v}
            disabled={guardando || disabled}
            onClick={() => cambiar(v)}
            title={v === 'ALTO' ? 'ALTO: más preciso, primera carga más lenta.' : 'BAJO: más rápido, indexación esencial.'}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 ${
              nivelCarga === v
                ? 'bg-primario text-primario-texto'
                : 'text-texto-muted hover:text-texto'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
