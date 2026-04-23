'use client'

import { useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import {
  descifrarPayload,
  getClaveSesion,
  setClaveSesion,
  type PayloadCifrado,
} from '@/lib/descifrar'
import { Boton } from './boton'

interface Props {
  payload: PayloadCifrado | null | undefined
  /** Render del texto ya en claro (para highlights, formato, etc.). Default: <pre>. */
  render?: (textoPlano: string) => React.ReactNode
  className?: string
  /** Texto al mostrar cuando el payload llega vacío (no cifrado). */
  vacioLabel?: string
}

/**
 * Muestra contenido cifrado con un botón "Descifrar".
 * Al hacer click, pide la clave (modal inline) y descifra. Si la clave ya fue
 * ingresada en la sesión, descifra automáticamente.
 */
export function TextoCifrado({ payload, render, className, vacioLabel }: Props) {
  const [textoPlano, setTextoPlano] = useState<string | null>(null)
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [claveInput, setClaveInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Intento automático con la clave ya cacheada.
  useEffect(() => {
    if (!payload || !payload.cifrado) return
    const cacheada = getClaveSesion()
    if (!cacheada) return
    descifrarPayload(payload, cacheada)
      .then(setTextoPlano)
      .catch(() => { /* ignoramos: el usuario abrirá el modal si quiere reintentar */ })
  }, [payload])

  if (!payload || !payload.cifrado) {
    return <span className="text-sm text-texto-muted italic">{vacioLabel ?? 'Sin contenido.'}</span>
  }

  if (textoPlano !== null) {
    return <>{render ? render(textoPlano) : (
      <pre className={className ?? 'whitespace-pre-wrap text-sm font-mono bg-fondo border border-borde rounded p-3 max-h-[60vh] overflow-auto'}>
        {textoPlano}
      </pre>
    )}</>
  }

  const intentarDescifrar = async () => {
    setError(null)
    try {
      const plano = await descifrarPayload(payload, claveInput)
      setClaveSesion(claveInput)
      setTextoPlano(plano)
      setPidiendoClave(false)
      setClaveInput('')
    } catch (e) {
      const msg = (e as Error).message
      setError(msg === 'clave-incorrecta' ? 'Clave incorrecta.' : 'Ingresa una clave.')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-texto-muted border border-dashed border-borde rounded p-3 bg-fondo">
        <Lock size={16} />
        <span className="flex-1">Contenido cifrado. Nivel de clave: <b>{payload.nivel_clave}</b>.</span>
        {!pidiendoClave ? (
          <Boton variante="contorno" onClick={() => setPidiendoClave(true)}>
            <Unlock size={14} className="mr-1" /> Descifrar
          </Boton>
        ) : null}
      </div>

      {pidiendoClave && (
        <div className="flex flex-col gap-2 border border-borde rounded p-3 bg-fondo-tarjeta">
          <label className="text-xs text-texto-muted">Clave de descifrado</label>
          <input
            type="password"
            autoFocus
            value={claveInput}
            onChange={(e) => setClaveInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') intentarDescifrar() }}
            className="w-full rounded border border-borde bg-fondo px-3 py-2 text-sm focus:border-primario focus:ring-1 focus:ring-primario outline-none"
            placeholder="Ingresa la clave"
          />
          {error && <span className="text-xs text-red-600">{error}</span>}
          <div className="flex gap-2 justify-end">
            <Boton variante="contorno" onClick={() => { setPidiendoClave(false); setClaveInput(''); setError(null) }}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={intentarDescifrar}>Descifrar</Boton>
          </div>
        </div>
      )}
    </div>
  )
}
