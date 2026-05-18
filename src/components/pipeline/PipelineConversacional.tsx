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
 *   [icono] 234 de 2,847 documentos. Quedan unos 10 minutos.
 *
 *            ╭──────────╮
 *           ╱   8%       ╲     ← DIAL TRIPLE (lotes / etapas / actual)
 *           │   LEYENDO   │
 *           ╲   TEXTO    ╱
 *            ╰──────────╯
 *           contrato_servicios_2024.pdf
 *           documento 234 · 1 no analizables hasta ahora
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
    mensaje: string  // "234 de 2,847…"
    lote: { actual: number; total: number }
    etapa: { indiceActivo: number; total: number; nombre: string }
    actual: { completados: number; total: number; archivoActual?: string }
    /** Mensaje secundario abajo del dial (ej. "documento 234 · 1 no analizables hasta ahora"). */
    submensaje?: string
    onVerDetalles?: () => void
    onDetener?: () => void
  }

  ejecutando: boolean
  /** Texto del bloque "Por qué" — ya no se renderiza, conservado por compatibilidad con callers. */
  porQueTexto?: string
  mensajeError?: string | null
  /** Slot opcional que se renderiza dentro de la tarjeta izquierda, justo arriba de los botones. */
  slotArribaBotones?: React.ReactNode
  /**
   * Slot opcional para una PRIMERA columna a la izquierda del dial.
   * Cuando se entrega, el layout pasa de 2 columnas a 3:
   * [columnaIzquierda] · [dial+mensaje] · [tarjeta botones + Ahora mismo]
   */
  columnaIzquierda?: React.ReactNode
}

export function PipelineConversacional({
  antesDeEmpezar,
  enProceso,
  ejecutando,
  mensajeError,
  slotArribaBotones,
  columnaIzquierda,
}: PipelineConversacionalProps) {
  const tresColumnas = !!columnaIzquierda
  return (
    <div className="flex flex-col gap-3">
      {mensajeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {/*
        Layout:
        - Sin columnaIzquierda → 2 columnas: [botones] · [dial]
        - Con columnaIzquierda → 3 columnas: [ubicaciones] · [dial] · [botones]
      */}
      <div className={`grid gap-6 items-start grid-cols-1 ${tresColumnas ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>

        {tresColumnas && (
          <div className="flex flex-col gap-2 min-w-0">
            {columnaIzquierda}
          </div>
        )}

        {/* Tarjeta de botones (en layout de 3 cols se mueve a la derecha, en layout de 2 cols queda a la izquierda) */}
        <div className={`flex flex-col gap-2 ${tresColumnas ? 'md:order-last' : ''}`}>
          <div className="rounded-xl border border-borde bg-fondo-tarjeta p-4 flex flex-col gap-3 min-w-0">
            {antesDeEmpezar.mensajeTiempo && !ejecutando && (
              <p className="text-sm text-texto leading-relaxed">{antesDeEmpezar.mensajeTiempo}</p>
            )}

            {slotArribaBotones}

            {/* Botones */}
            <div className="flex flex-col gap-2">
              <Boton
                variante="primario"
                onClick={antesDeEmpezar.onEmpezar}
                disabled={antesDeEmpezar.deshabilitado || ejecutando}
                className="min-w-[180px] justify-center"
              >
                {antesDeEmpezar.textoBotonEmpezar ?? 'Cargar Semántica'}
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

            {/* En proceso: AHORA MISMO bajo los botones */}
            {ejecutando && (
              <div className="border-t border-borde pt-3 mt-1 flex flex-col gap-3 min-w-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-texto-muted">
                    Ahora mismo
                  </span>
                  <span className="font-mono text-sm text-texto break-all">
                    {enProceso.actual.archivoActual ?? '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: dial + estadística a su derecha ── */}
        <div className="flex flex-row gap-5 items-center md:items-start">
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

          {ejecutando && (
            <div className="flex flex-col gap-1 min-w-0 self-center">
              <p className="text-sm text-texto leading-relaxed">{enProceso.mensaje}</p>
              {enProceso.submensaje && (
                <p className="text-sm text-texto leading-relaxed">{enProceso.submensaje}</p>
              )}
            </div>
          )}

          {/* Pie: Ver detalles (Detener proceso vive ahora en la columna izquierda, junto a Capturar) */}
          {enProceso.onVerDetalles && (
            <div className="border-t border-borde pt-3 flex items-center justify-between gap-3 flex-wrap w-full">
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
