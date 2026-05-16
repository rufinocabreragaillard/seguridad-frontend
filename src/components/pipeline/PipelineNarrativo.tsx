'use client'

/**
 * Pipeline Narrativo — versión "enfoque B".
 *
 * Render esperado:
 *   [ENFOQUE B · PIPELINE NARRATIVO]
 *   Muestra a dónde van los documentos
 *   Las etapas se hacen visibles. El usuario entiende qué hace
 *   'vectorizar' sin saber qué significa.
 *
 *   ── ANTES DE EMPEZAR ──
 *   [icono carpeta] rufinocabrera · 2,847 docs · 184 MB    [ Empezar ]
 *
 *   ── EN PROCESO ──
 *   [CARGANDO 12] → [LEYENDO TEXTO 8] → [INDEXANDO 4] → [LISTOS 234]
 *   234 de 2,847 listos · 8% completado                ~10 min restantes
 *   ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 *
 *   ✓ acta_directorio_q3.pdf
 *   ✓ presupuesto_2025.xlsx
 *   ● contrato_servicios.pdf
 *   · política_viajes.docx
 *
 *   [234 listos]  [1 con error]                          Detener
 *
 *   Por qué · Las cuatro etapas dan una historia: "tus documentos
 *   están entrando por aquí y saliendo por allá". El ticker en vivo
 *   es lo que más calma en procesos largos: ves que algo pasa.
 */

import type { ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'
import { Boton } from '@/components/ui/boton'

export type FaseEstado = 'esperando' | 'activo' | 'listo' | 'error'

export interface FaseNarrativa {
  clave: string
  etiqueta: string  // "CARGANDO", "LEYENDO TEXTO"
  count: number
  color: string
  estado: FaseEstado
}

export interface ArchivoEnCurso {
  nombre: string
  estado: 'listo' | 'activo' | 'esperando' | 'error'
}

interface PipelineNarrativoProps {
  /** Bloque "Antes de empezar". */
  antesDeEmpezar: {
    carpetaNombre: string
    documentos: number
    pesoTexto?: string  // "184 MB"
    onEmpezar: () => void
    textoBotonEmpezar?: string
    deshabilitado?: boolean
    /** Si se entrega, reemplaza el bloque `[icono] carpetaNombre + documentos` por un slot personalizado (ej. un selector de ubicación). */
    slot?: ReactNode
  }

  /** Fases del pipeline (4 tarjetas). */
  fases: FaseNarrativa[]
  /** Resumen global del avance. */
  resumen: {
    completados: number
    total: number
    etaTexto: string | null  // "~10 min restantes"
    listosCount: number
    erroresCount: number
  }
  /** Archivos visibles en la zona "en curso". */
  archivos?: ArchivoEnCurso[]
  /** Si está corriendo, muestra Detener; si no, muestra el bloque "antes de empezar". */
  ejecutando: boolean
  onDetener?: () => void

  /** Texto del bloque "Por qué" — ya no se renderiza, conservado por compatibilidad con callers. */
  porQueTexto?: string

  /** Mensaje de error/aviso opcional. */
  mensajeError?: string | null

  /** Si false, oculta el bloque "Antes de empezar" (carpeta + Empezar). Default: true. */
  mostrarAntesDeEmpezar?: boolean
  /** Si false, oculta el bloque de estadísticas (fases + progreso + pill). Default: true. */
  mostrarEstadisticas?: boolean
  /** Si false, oculta la barra de progreso y la pill de listos/errores; deja sólo las tarjetas de fase. Default: true. */
  mostrarProgresoYResumen?: boolean
}

function TarjetaFase({ etiqueta, count, color, estado }: FaseNarrativa) {
  const esListo = estado === 'listo'
  const esActivo = estado === 'activo'
  const esError = estado === 'error'

  return (
    <div
      className={`relative flex-1 min-w-0 rounded-xl border shadow-sm px-4 py-4 flex flex-col items-center justify-center gap-1 transition-all ${
        esListo
          ? 'border-green-200 bg-green-50'
          : esError
          ? 'border-red-200 bg-red-50'
          : esActivo
          ? 'border-borde bg-surface'
          : 'border-borde bg-surface'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-texto-muted">
          {etiqueta}
        </span>
        {esActivo && (
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        )}
      </div>
      <span
        className="tabular-nums font-semibold"
        style={{ fontSize: 28, color: esListo ? '#16A34A' : esError ? '#DC2626' : color }}
      >
        {count.toLocaleString()}
      </span>
    </div>
  )
}

function Flecha() {
  return (
    <span className="text-texto-muted/60 self-center text-lg select-none shrink-0" aria-hidden>
      →
    </span>
  )
}

function IconoArchivoEstado({ estado }: { estado: ArchivoEnCurso['estado'] }) {
  if (estado === 'listo') return <span className="text-green-600">✓</span>
  if (estado === 'error') return <span className="text-red-600">✕</span>
  if (estado === 'activo') return <span className="text-primario">●</span>
  return <span className="text-texto-muted">·</span>
}

export function PipelineNarrativo({
  antesDeEmpezar,
  fases,
  resumen,
  archivos = [],
  ejecutando,
  onDetener,
  mensajeError,
  mostrarAntesDeEmpezar = true,
  mostrarEstadisticas = true,
  mostrarProgresoYResumen = true,
}: PipelineNarrativoProps) {
  const pct = resumen.total > 0 ? Math.min(100, Math.round((resumen.completados / resumen.total) * 100)) : 0
  const pctListos = resumen.total > 0 ? Math.min(100, Math.round((resumen.listosCount / resumen.total) * 100)) : 0

  return (
    <div className="flex flex-col gap-3">
      {mensajeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {/* ANTES DE EMPEZAR (solo si no estamos ejecutando) */}
      {mostrarAntesDeEmpezar && !ejecutando && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-texto-muted">
            Antes de empezar
          </span>
          <div className="rounded-xl border border-borde bg-surface p-3 flex items-center gap-3 flex-wrap">
            {antesDeEmpezar.slot ? (
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex-1 min-w-0">{antesDeEmpezar.slot}</div>
                <span className="text-xs text-texto-muted tabular-nums shrink-0">
                  {antesDeEmpezar.documentos.toLocaleString()} documentos
                  {antesDeEmpezar.pesoTexto ? ` · ${antesDeEmpezar.pesoTexto}` : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <FolderOpen size={18} className="text-texto-muted shrink-0" />
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-semibold text-texto truncate">{antesDeEmpezar.carpetaNombre}</span>
                  <span className="text-xs text-texto-muted tabular-nums">
                    {antesDeEmpezar.documentos.toLocaleString()} documentos
                    {antesDeEmpezar.pesoTexto ? ` · ${antesDeEmpezar.pesoTexto}` : ''}
                  </span>
                </div>
              </div>
            )}
            <Boton
              variante="primario"
              onClick={antesDeEmpezar.onEmpezar}
              disabled={antesDeEmpezar.deshabilitado}
              className="min-w-[140px] justify-center"
            >
              {antesDeEmpezar.textoBotonEmpezar ?? 'Empezar'}
            </Boton>
          </div>
        </div>
      )}

      {/* Pipeline (sin tarjeta exterior — más compacto) */}
      {mostrarEstadisticas && (
        <div className="flex flex-col gap-3">
          {/* Tarjetas de fases */}
          <div className="flex items-stretch gap-2">
            {fases.map((f, i) => (
              <div key={f.clave} className="flex items-stretch gap-2 flex-1 min-w-0">
                <TarjetaFase {...f} />
                {i < fases.length - 1 && <Flecha />}
              </div>
            ))}
          </div>

          {mostrarProgresoYResumen && (
            <>
              {/* Barra de progreso global + ETA */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <span className="text-sm text-texto tabular-nums">
                    <span className="font-semibold">{resumen.completados.toLocaleString()}</span>
                    {' de '}
                    <span className="font-semibold">{resumen.total.toLocaleString()}</span>
                    {' listos · '}
                    <span className="font-semibold">{pct}%</span>
                    {' completado'}
                  </span>
                  {resumen.etaTexto && (
                    <span className="text-xs text-texto-muted tabular-nums">{resumen.etaTexto}</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-fondo overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Lista de archivos en curso */}
              {archivos.length > 0 && (
                <div className="rounded-lg border border-borde bg-surface shadow-sm px-3 py-2 flex flex-col gap-0.5 font-mono text-xs">
                  {archivos.map((a, i) => (
                    <div key={`${a.nombre}-${i}`} className="flex items-center gap-2 truncate">
                      <IconoArchivoEstado estado={a.estado} />
                      <span className="truncate text-texto">{a.nombre}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pill de listos + errores + botón Detener */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 tabular-nums">
                  {resumen.listosCount.toLocaleString()} listos · {pctListos}%
                </span>
                {resumen.erroresCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 tabular-nums">
                    {resumen.erroresCount.toLocaleString()} con error
                  </span>
                )}
                {ejecutando && onDetener && (
                  <Boton variante="contorno" onClick={onDetener} className="ml-auto">
                    Detener
                  </Boton>
                )}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
