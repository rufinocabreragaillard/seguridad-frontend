'use client'

/**
 * Pipeline Conversacional — versión "enfoque C".
 *
 * Render esperado:
 *   [ENFOQUE C · CONVERSACIONAL]
 *   El sistema explica lo que hace
 *   Como un asistente paciente. Cero jerga.
 *
 *   ── ANTES DE EMPEZAR ──
 *   [S] Encontré 2,847 documentos en rufinocabrera. Si te parece,
 *       los preparo para que puedas hacerles preguntas.
 *       Tardará unos 12 minutos la primera vez.
 *       [ Sí, empezar ]  [ Elegir otra carpeta ]
 *
 *   ── EN PROCESO ──
 *   [icono] Voy bien. Llevo 234 de 2,847 documentos. Quedan unos 10 minutos.
 *
 *            ╭──────────╮
 *           ╱   8%       ╲     ← DIAL TRIPLE (lotes / etapas / actual)
 *           │   LEYENDO   │
 *           ╲   TEXTO    ╱
 *            ╰──────────╯
 *           contrato_servicios_2024.pdf
 *           documento 234 · 1 con error hasta ahora
 *
 *   Ver detalles                          Detener proceso
 *
 *   Por qué · Quita el peso de "barras de progreso" y lo cambia
 *   por un mensaje legible.
 */

import { DialTriple } from './DialTriple'
import { Boton } from '@/components/ui/boton'

interface PipelineConversacionalProps {
  /** "Antes de empezar" — burbuja del asistente. */
  antesDeEmpezar: {
    mensajePrincipal: string
    mensajeTiempo?: string | null
    onEmpezar: () => void
    onElegirOtra?: () => void
    textoBotonEmpezar?: string
    textoBotonOtra?: string
    deshabilitado?: boolean
  }

  /** "En proceso" — mensaje + dial triple. */
  enProceso: {
    mensaje: string  // "Voy bien. Llevo 234 de 2,847…"
    lote: { actual: number; total: number }
    etapa: { indiceActivo: number; total: number; nombre: string }
    actual: { completados: number; total: number; archivoActual?: string }
    /** Mensaje secundario abajo del dial (ej. "documento 234 · 1 con error hasta ahora"). */
    submensaje?: string
    onVerDetalles?: () => void
    onDetener?: () => void
  }

  ejecutando: boolean
  /** Texto del bloque "Por qué" — ya no se renderiza, conservado por compatibilidad con callers. */
  porQueTexto?: string
  mensajeError?: string | null
}

export function PipelineConversacional({
  antesDeEmpezar,
  enProceso,
  ejecutando,
  mensajeError,
}: PipelineConversacionalProps) {
  return (
    <div className="flex flex-col gap-3">
      {mensajeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {/* ANTES DE EMPEZAR — burbuja del asistente */}
      {!ejecutando && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-texto-muted">
            Antes de empezar
          </span>
          <div className="rounded-xl border border-borde bg-fondo-tarjeta p-4 flex gap-4 items-start">
            <div
              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-primario text-primario-texto font-bold text-sm"
              aria-hidden
            >
              S
            </div>
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <p className="text-sm lg:text-base text-texto leading-relaxed">
                {antesDeEmpezar.mensajePrincipal}
              </p>
              {antesDeEmpezar.mensajeTiempo && (
                <p className="text-sm text-texto leading-relaxed">{antesDeEmpezar.mensajeTiempo}</p>
              )}
              <div className="flex gap-3 flex-wrap pt-1">
                <Boton
                  variante="primario"
                  onClick={antesDeEmpezar.onEmpezar}
                  disabled={antesDeEmpezar.deshabilitado}
                  className="min-w-[180px] justify-center"
                >
                  {antesDeEmpezar.textoBotonEmpezar ?? 'Sí, empezar'}
                </Boton>
                {antesDeEmpezar.onElegirOtra && (
                  <Boton variante="contorno" onClick={antesDeEmpezar.onElegirOtra}>
                    {antesDeEmpezar.textoBotonOtra ?? 'Elegir otra carpeta'}
                  </Boton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje + dial triple (sin tarjeta exterior — más compacto) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-5">
          {/* Burbuja del bot */}
          <div className="flex gap-4 items-start">
            <div
              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-primario"
              aria-hidden
            >
              <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
            <p className="text-sm lg:text-base text-texto leading-relaxed flex-1">
              {enProceso.mensaje}
            </p>
          </div>

          {/* Dial triple + texto debajo */}
          <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
            <DialTriple
              lote={enProceso.lote}
              etapa={{
                indiceActivo: enProceso.etapa.indiceActivo,
                total: enProceso.etapa.total,
                nombre: enProceso.etapa.nombre,
              }}
              actual={enProceso.actual}
              pulsando={ejecutando ? 'interno' : null}
              tamano={220}
            />
            <div className="flex-1 flex flex-col gap-1 lg:pt-6">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-texto-muted">
                Ahora mismo
              </span>
              <span className="font-mono text-sm text-texto break-all">
                {enProceso.actual.archivoActual ?? '—'}
              </span>
              {enProceso.submensaje && (
                <span className="text-xs text-texto-muted mt-1">{enProceso.submensaje}</span>
              )}
            </div>
          </div>

          {/* Pie: Ver detalles / Detener proceso */}
          {(enProceso.onVerDetalles || enProceso.onDetener) && (
            <div className="border-t border-borde pt-3 flex items-center justify-between gap-3 flex-wrap">
              {enProceso.onVerDetalles ? (
                <button
                  type="button"
                  onClick={enProceso.onVerDetalles}
                  className="text-sm text-texto underline-offset-4 hover:underline"
                >
                  Ver detalles
                </button>
              ) : <span />}
              {enProceso.onDetener && ejecutando && (
                <button
                  type="button"
                  onClick={enProceso.onDetener}
                  className="text-sm text-red-600 underline-offset-4 hover:underline"
                >
                  Detener proceso
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
