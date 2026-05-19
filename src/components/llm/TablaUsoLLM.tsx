'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Boton } from '@/components/ui/boton'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import type { LLMUsoFila } from '@/lib/api'

function fmtUsd(n: number | undefined | null) {
  return `$${(Number(n) || 0).toFixed(4)}`
}
function fmtInt(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString('es-CL')
}
function fmtMs(n: number | undefined | null) {
  if (!n) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`
}

interface Props {
  filas: LLMUsoFila[]
  mostrarGrupo?: boolean
  sinFilas?: string
}

export function TablaUsoLLM({ filas, mostrarGrupo = false, sinFilas = 'Sin llamadas registradas' }: Props) {
  const [detalle, setDetalle] = useState<LLMUsoFila | null>(null)

  const colSpan = mostrarGrupo ? 14 : 13

  return (
    <>
      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaTh>Fecha</TablaTh>
            {mostrarGrupo && <TablaTh>Grupo</TablaTh>}
            <TablaTh>Proveedor</TablaTh>
            <TablaTh>Modelo</TablaTh>
            <TablaTh>Key</TablaTh>
            <TablaTh>Usuario</TablaTh>
            <TablaTh>Función</TablaTh>
            <TablaTh>Habilidad</TablaTh>
            <TablaTh>Proceso</TablaTh>
            <TablaTh className="text-right">Tok. In</TablaTh>
            <TablaTh className="text-right">Tok. Out</TablaTh>
            <TablaTh className="text-right">Costo</TablaTh>
            <TablaTh className="text-right">Tiempo</TablaTh>
            <TablaTh>Estado</TablaTh>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {filas.map((f) => (
            <TablaFila
              key={f.id}
              className="cursor-pointer hover:bg-blue-50"
              onClick={() => setDetalle(f)}
            >
              <TablaTd className="text-xs whitespace-nowrap">
                {new Date(f.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
              </TablaTd>
              {mostrarGrupo && <TablaTd className="text-xs font-mono">{f.codigo_grupo}</TablaTd>}
              <TablaTd className="capitalize">{f.proveedor}</TablaTd>
              <TablaTd className="font-mono text-xs">{f.modelo}</TablaTd>
              <TablaTd>
                {f.uso_key_casa
                  ? <Insignia variante="advertencia">Casa</Insignia>
                  : <Insignia variante="exito">{f.alias_credencial ?? 'Grupo'}</Insignia>
                }
              </TablaTd>
              <TablaTd className="text-xs">{f.codigo_usuario ?? '—'}</TablaTd>
              <TablaTd className="text-xs">{f.codigo_funcion ?? '—'}</TablaTd>
              <TablaTd className="text-xs font-mono">{f.codigo_habilidad}</TablaTd>
              <TablaTd className="text-xs font-mono">{f.codigo_proceso ?? '—'}</TablaTd>
              <TablaTd className="text-right">{fmtInt(f.tokens_input)}</TablaTd>
              <TablaTd className="text-right">{fmtInt(f.tokens_output)}</TablaTd>
              <TablaTd className="text-right font-medium">{fmtUsd(f.costo_estimado_usd)}</TablaTd>
              <TablaTd className="text-right text-xs">{fmtMs(f.duracion_ms)}</TablaTd>
              <TablaTd>
                {f.exito
                  ? <Insignia variante="exito"><CheckCircle className="w-3 h-3 inline mr-1" />OK</Insignia>
                  : <Insignia variante="error"><AlertCircle className="w-3 h-3 inline mr-1" />Error</Insignia>
                }
              </TablaTd>
            </TablaFila>
          ))}
          {filas.length === 0 && (
            <TablaFila>
              <TablaTd colSpan={colSpan as never} className="text-center text-gray-400 py-6">{sinFilas}</TablaTd>
            </TablaFila>
          )}
        </TablaCuerpo>
      </Tabla>

      {/* Modal de detalle */}
      <Modal
        abierto={!!detalle}
        alCerrar={() => setDetalle(null)}
        titulo={`Detalle llamada #${detalle?.id}`}
        className="max-w-2xl"
      >
        {detalle && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha" valor={new Date(detalle.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })} />
              <Campo label="Duración" valor={fmtMs(detalle.duracion_ms)} />
              <Campo label="Grupo" valor={detalle.codigo_grupo} />
              <Campo label="Entidad" valor={detalle.codigo_entidad ?? '—'} />
              <Campo label="Usuario" valor={detalle.codigo_usuario ?? '—'} />
              <Campo label="Función" valor={detalle.codigo_funcion ?? '—'} />
              <Campo label="Habilidad" valor={detalle.codigo_habilidad} />
              <Campo label="Proceso" valor={detalle.codigo_proceso ?? '—'} mono />
              <Campo label="Proveedor" valor={detalle.proveedor} />
              <Campo label="Modelo" valor={detalle.modelo} mono />
              <Campo label="Key" valor={detalle.uso_key_casa ? 'Casa (key propia)' : (detalle.alias_credencial ?? 'Grupo')} />
              <Campo label="Doc. ID" valor={detalle.id_documento != null ? String(detalle.id_documento) : '—'} />
            </div>

            <div className="grid grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">Tok. Input</div>
                <div className="font-bold text-gray-900">{fmtInt(detalle.tokens_input)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">Tok. Output</div>
                <div className="font-bold text-gray-900">{fmtInt(detalle.tokens_output)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">Cache Read</div>
                <div className="font-bold text-gray-900">{fmtInt(detalle.tokens_cache_read)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">Costo USD</div>
                <div className="font-bold text-[#074B91]">{fmtUsd(detalle.costo_estimado_usd)}</div>
              </div>
            </div>

            {!detalle.exito && detalle.error_mensaje && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-sm font-semibold text-red-700">Mensaje de error</span>
                </div>
                <pre className="text-xs text-red-800 whitespace-pre-wrap break-words font-mono">{detalle.error_mensaje}</pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Boton variante="contorno" onClick={() => setDetalle(null)}>Cerrar</Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function Campo({ label, valor, mono = false }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase mb-0.5">{label}</div>
      <div className={`text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{valor}</div>
    </div>
  )
}
