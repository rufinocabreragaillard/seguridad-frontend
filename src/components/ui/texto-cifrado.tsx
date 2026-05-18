'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, Unlock } from 'lucide-react'
import {
  descifrarPayload,
  getClaveSesion,
  setClaveSesion,
  suscribirClaveSesion,
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
  /**
   * Modo compacto: oculta el chip "Contenido cifrado…" y el botón "Descifrar"
   * individual. Cuando aún no se ha descifrado muestra un placeholder mínimo
   * (•••). Pensado para listas donde un botón global desbloquea todo.
   */
  inline?: boolean
}

/**
 * Muestra contenido cifrado con un botón "Descifrar".
 * Al hacer click, pide la clave (modal inline) y descifra. Si la clave ya fue
 * ingresada en la sesión, descifra automáticamente.
 */
export function TextoCifrado({ payload, render, className, vacioLabel, inline }: Props) {
  const tc = useTranslations('common')
  const [textoPlano, setTextoPlano] = useState<string | null>(null)
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [claveInput, setClaveInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Intento automático con la clave ya cacheada + reintento cuando la clave
  // cambia en la sesión (p.ej. el usuario la ingresa desde un botón global).
  useEffect(() => {
    if (!payload || !payload.cifrado) return
    let cancelado = false
    const intentar = (clave: string | null) => {
      if (!clave) return
      descifrarPayload(payload, clave)
        .then((plano) => { if (!cancelado) setTextoPlano(plano) })
        .catch(() => { /* el usuario reintentará si quiere */ })
    }
    intentar(getClaveSesion())
    const unsub = suscribirClaveSesion(intentar)
    return () => { cancelado = true; unsub() }
  }, [payload])

  if (!payload || !payload.cifrado) {
    return <span className="text-sm text-texto-muted italic">{vacioLabel ?? tc('sinContenido')}</span>
  }

  if (textoPlano !== null) {
    return <>{render ? render(textoPlano) : (
      <pre className={className ?? 'whitespace-pre-wrap text-sm font-mono bg-fondo border border-borde rounded p-3 max-h-[60vh] overflow-auto'}>
        {textoPlano}
      </pre>
    )}</>
  }

  // Modo compacto: sin chip ni botón individual — placeholder mínimo.
  if (inline) {
    return <span className="text-sm text-texto-muted font-mono tracking-wider select-none">••••••</span>
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
      setError(msg === 'clave-incorrecta' ? tc('claveIncorrecta') : tc('ingresaUnaClave'))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-texto-muted border border-dashed border-borde rounded p-3 bg-fondo">
        <Lock size={16} />
        <span className="flex-1">{tc('contenidoCifrado', { nivel: payload.nivel_clave })}</span>
        {!pidiendoClave ? (
          <Boton variante="contorno" onClick={() => setPidiendoClave(true)}>
            <Unlock size={14} className="mr-1" /> {tc('descifrar')}
          </Boton>
        ) : null}
      </div>

      {pidiendoClave && (
        <div className="flex flex-col gap-2 border border-borde rounded p-3 bg-fondo-tarjeta">
          <label className="text-xs text-texto-muted">{tc('claveDescifrado')}</label>
          <input
            type="password"
            autoFocus
            value={claveInput}
            onChange={(e) => setClaveInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') intentarDescifrar() }}
            className="w-full rounded border border-borde bg-fondo px-3 py-2 text-sm focus:border-primario focus:ring-1 focus:ring-primario outline-none"
            placeholder={tc('ingresarPlaceholder')}
          />
          {error && <span className="text-xs text-red-600">{error}</span>}
          <div className="flex gap-2 justify-end">
            <Boton variante="contorno" onClick={() => { setPidiendoClave(false); setClaveInput(''); setError(null) }}>
              {tc('cancelar')}
            </Boton>
            <Boton variante="primario" onClick={intentarDescifrar}>{tc('descifrar')}</Boton>
          </div>
        </div>
      )}
    </div>
  )
}
