'use client'

import type { ReactNode } from 'react'
import { useFuncionActual } from '@/hooks/useFuncionActual'
import { useTranslations } from 'next-intl'

interface PageHeaderProps {
  /** Sobrescribe el título. Si no se provee, usa funciones.nombre_funcion (BD). */
  titulo?: string
  /** Sobrescribe el subtítulo. Si no se provee, usa funciones.ayuda_de_funcion (BD). */
  subtitulo?: string
  /** Icono opcional a la izquierda del título. */
  icono?: ReactNode
  /** Si false, no renderiza el subtítulo. */
  conSubtitulo?: boolean
  /** Namespace de i18n para el fallback (cuando la fila de funciones no tiene nombre/ayuda). */
  i18nNamespace?: string
  /** className adicional para el contenedor. */
  className?: string
}

/**
 * Header estándar de pantalla.
 * Lee título y subtítulo de funciones.nombre_funcion / funciones.ayuda_de_funcion
 * (vía menú del usuario, ya traducido al locale activo).
 *
 * Si la fila de funciones no tiene nombre/ayuda, cae a `t('titulo')` y `t('subtitulo')`
 * del namespace indicado o del namespace inferido por la ruta.
 */
export function PageHeader({
  titulo,
  subtitulo,
  icono,
  conSubtitulo = true,
  i18nNamespace,
  className = '',
}: PageHeaderProps) {
  const funcion = useFuncionActual()
  // Solo cargamos el namespace de i18n si hay uno explícito (para fallback).
  // Sin namespace explícito, el fallback es nada (mostramos lo de BD o vacío).
  const t = useTranslations(i18nNamespace || 'common')

  const tituloFinal = titulo ?? funcion?.nombre ?? (i18nNamespace ? safeT(t, 'titulo') : null)
  const subtituloFinal = subtitulo ?? funcion?.ayuda ?? (i18nNamespace ? safeT(t, 'subtitulo') : null)

  return (
    <div className={className}>
      <h2 className={`page-heading ${icono ? 'flex items-center gap-2' : ''}`}>
        {icono}
        {tituloFinal}
      </h2>
      {conSubtitulo && subtituloFinal && (
        <p className="text-sm text-texto-muted mt-1">{subtituloFinal}</p>
      )}
    </div>
  )
}

/** Llama a t(key) y devuelve null si la clave no existe (en vez de mostrar la key). */
function safeT(t: ReturnType<typeof useTranslations>, key: string): string | null {
  try {
    const v = t(key)
    // next-intl retorna la key si no encuentra la traducción
    if (v === key) return null
    return v
  } catch {
    return null
  }
}
