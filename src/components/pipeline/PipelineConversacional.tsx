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

import { useTranslations } from 'next-intl'
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

  /** "En proceso" — dial triple. */
  enProceso: {
    lote: { actual: number; total: number }
    etapa: { indiceActivo: number; total: number; nombre: string }
    actual: { completados: number; total: number; archivoActual?: string }
    /** Contadores acumulados que se muestran SIEMPRE debajo del dial. */
    estadisticas?: { vectorizados: number; noProcesables: number }
    onVerDetalles?: () => void
    onDetener?: () => void
    /** Si true, el botón Detener muestra "Deteniendo..." y queda deshabilitado
     * mientras se libera la cola en backend. */
    deteniendo?: boolean
  }

  ejecutando: boolean
  /** True cuando la última corrida terminó sin documentos nuevos que procesar:
   * el bloque "Ahora mismo" informa que está todo al día en vez del archivo en curso. */
  sinDocsNuevos?: boolean
  /** True cuando aún no hay ubicaciones cargadas (no se ejecutó el Paso 1):
   * el bloque "Ahora mismo" invita a cargar primero un directorio, en vez de
   * decir que está todo al día. Tiene prioridad sobre `sinDocsNuevos`. */
  sinUbicaciones?: boolean
  /** Texto del bloque "Por qué" — ya no se renderiza, conservado por compatibilidad con callers. */
  porQueTexto?: string
  /** Mensaje de error inhabilitador (rojo). */
  mensajeError?: string | null
  /** Mensaje de advertencia no bloqueante (amarillo). */
  mensajeAdvertencia?: string | null
  /** Slot opcional que se renderiza dentro de la tarjeta izquierda, justo arriba de los botones. */
  slotArribaBotones?: React.ReactNode
  /**
   * Slot opcional para una PRIMERA columna a la izquierda del dial.
   * Cuando se entrega, el layout pasa de 2 columnas a 3:
   * [columnaIzquierda] · [dial+mensaje] · [tarjeta botones + Ahora mismo]
   */
  columnaIzquierda?: React.ReactNode
  /** Slot opcional que se renderiza debajo del dial, centrado en su misma columna. */
  slotBajoDial?: React.ReactNode
}

export function PipelineConversacional({
  antesDeEmpezar,
  enProceso,
  ejecutando,
  sinDocsNuevos,
  sinUbicaciones,
  mensajeError,
  mensajeAdvertencia,
  slotArribaBotones,
  columnaIzquierda,
  slotBajoDial,
}: PipelineConversacionalProps) {
  const t = useTranslations('pipelineConversacional')
  const tresColumnas = !!columnaIzquierda
  return (
    <div className="flex flex-col gap-3">
      {mensajeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {mensajeAdvertencia && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {mensajeAdvertencia}
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
                {antesDeEmpezar.textoBotonEmpezar ?? t('cargarSemantica')}
              </Boton>
              {enProceso.onDetener && (
                <Boton
                  variante="contorno"
                  onClick={enProceso.onDetener}
                  disabled={!ejecutando || !!enProceso.deteniendo}
                  className="min-w-[180px] justify-center"
                >
                  {enProceso.deteniendo ? t('deteniendoProceso') : t('detenerProceso')}
                </Boton>
              )}
              {antesDeEmpezar.onElegirOtra && (
                <Boton variante="contorno" onClick={antesDeEmpezar.onElegirOtra} className="min-w-[180px] justify-center">
                  {antesDeEmpezar.textoBotonOtra ?? t('elegirOtraCarpeta')}
                </Boton>
              )}
            </div>

            {/* En proceso: AHORA MISMO bajo los botones.
                - Ejecutando → archivo en curso.
                - Terminó sin docs nuevos → mensaje "todo al día" (informa al usuario
                  que no quedó nada pendiente de procesar). */}
            {(ejecutando || sinDocsNuevos || sinUbicaciones) && (
              <div className="border-t border-borde pt-3 mt-1 flex flex-col gap-3 min-w-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-texto-muted">
                    {t('ahoraMismo')}
                  </span>
                  {!ejecutando && sinUbicaciones ? (
                    <span className="text-sm text-texto leading-snug">
                      {t('cargarPrimeroDirectorios')}
                    </span>
                  ) : !ejecutando && sinDocsNuevos ? (
                    <span className="text-sm text-texto leading-snug">
                      {t('sinDocsNuevos')}
                    </span>
                  ) : (
                    <span className="font-mono text-sm text-texto break-all">
                      {enProceso.actual.archivoActual ?? '—'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: dial + estadística (vectorizados / no procesables) ── */}
        <div className="flex flex-row gap-5 items-center md:items-start">
          <div className="flex flex-col items-center gap-3">
            <DialTriple
              lote={enProceso.lote}
              etapa={{
                indiceActivo: enProceso.etapa.indiceActivo,
                total: enProceso.etapa.total,
                nombre: enProceso.etapa.nombre,
              }}
              actual={enProceso.actual}
              pulsando={ejecutando ? 'interno' : null}
              ejecutando={ejecutando}
              tamano={220}
            />
            {slotBajoDial && (
              <div className="w-full flex flex-col items-center">
                {slotBajoDial}
              </div>
            )}
            {enProceso.estadisticas && (
              <div className="flex items-center gap-4 text-xs tabular-nums">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="font-semibold text-texto">
                    {enProceso.estadisticas.vectorizados.toLocaleString()}
                  </span>
                  <span className="text-texto-muted">{t('vectorizados')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="font-semibold text-texto">
                    {enProceso.estadisticas.noProcesables.toLocaleString()}
                  </span>
                  <span className="text-texto-muted">{t('noProcesables')}</span>
                </span>
              </div>
            )}
          </div>

          {/* Pie: Ver detalles (Detener proceso vive ahora en la columna izquierda, junto a Capturar) */}
          {enProceso.onVerDetalles && (
            <div className="border-t border-borde pt-3 flex items-center justify-between gap-3 flex-wrap w-full">
              <button
                type="button"
                onClick={enProceso.onVerDetalles}
                className="text-sm text-texto underline-offset-4 hover:underline"
              >
                {t('verDetalles')}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
