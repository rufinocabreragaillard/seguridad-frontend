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
 *       [ Semanticar ]  [ Elegir otra carpeta ]
 *
 *   ── EN PROCESO ──
 *   [icono] Llevo 234 de 2,847 documentos. Quedan unos 10 minutos.
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
  /** Acciones del pipeline (Capturar / Detener / Elegir otra). */
  antesDeEmpezar: {
    mensajeTiempo?: string | null
    onEmpezar: () => void
    onElegirOtra?: () => void
    textoBotonEmpezar?: string
    textoBotonOtra?: string
    deshabilitado?: boolean
  }

  /** "En proceso" — mensaje + dial triple. */
  enProceso: {
    mensaje: string  // "Llevo 234 de 2,847…"
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

      {/* Dos columnas: ANTES DE EMPEZAR (izq) · MENSAJE + DIAL (der) — el layout no cambia al procesar */}
      <div className="grid gap-6 items-start grid-cols-1 md:grid-cols-2">

        {/* ── Columna izquierda: acciones del pipeline ── siempre visible */}
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border border-borde bg-fondo-tarjeta p-4 flex gap-4 items-start">
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {antesDeEmpezar.mensajeTiempo && (
                <p className="text-sm text-texto leading-relaxed">{antesDeEmpezar.mensajeTiempo}</p>
              )}
              <div className="flex flex-col gap-2">
                <Boton
                  variante="primario"
                  onClick={antesDeEmpezar.onEmpezar}
                  disabled={antesDeEmpezar.deshabilitado || ejecutando}
                  className="min-w-[180px] justify-center"
                >
                  {antesDeEmpezar.textoBotonEmpezar ?? 'Capturar Semántica'}
                </Boton>
                {enProceso.onDetener && (
                  <Boton
                    variante="contorno"
                    onClick={enProceso.onDetener}
                    disabled={!ejecutando}
                    className="min-w-[180px] justify-center"
                  >
                    Detener proceso
                  </Boton>
                )}
                {antesDeEmpezar.onElegirOtra && (
                  <Boton variante="contorno" onClick={antesDeEmpezar.onElegirOtra} className="min-w-[180px] justify-center">
                    {antesDeEmpezar.textoBotonOtra ?? 'Elegir otra carpeta'}
                  </Boton>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Columna derecha: Mensaje + dial triple ── */}
        <div className="flex flex-col gap-5">
          {/* Burbuja del bot */}
          <div className="flex gap-4 items-start">
            <p className="text-sm lg:text-base text-texto leading-relaxed flex-1">
              {enProceso.mensaje}
            </p>
          </div>

          {/* Dial triple + texto al lado */}
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
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
            <div className="flex-1 flex flex-col gap-1 sm:pt-6">
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

          {/* Pie: Ver detalles (Detener proceso vive ahora en la columna izquierda, junto a Capturar) */}
          {enProceso.onVerDetalles && (
            <div className="border-t border-borde pt-3 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={enProceso.onVerDetalles}
                className="text-sm text-texto underline-offset-4 hover:underline"
              >
                Ver detalles
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
