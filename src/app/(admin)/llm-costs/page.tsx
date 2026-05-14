'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { llmUsoApi } from '@/lib/api'
import type { LLMUsoFila, LLMUsoResumen } from '@/lib/api'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'

function fmtUsd(n: number | undefined | null) {
  return `$${(Number(n) || 0).toFixed(4)}`
}

function fmtInt(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString('es-CL')
}

export default function PaginaCostosLLM() {
  const tUso = useTranslations('llmUso')
  const { grupoActivo } = useAuth()

  const [resumen, setResumen] = useState<LLMUsoResumen | null>(null)
  const [filas, setFilas] = useState<LLMUsoFila[]>([])
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [cargandoFilas, setCargandoFilas] = useState(true)
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', proveedor: '', modelo: '', codigo_usuario: '' })

  const cargarResumen = useCallback(async () => {
    setCargandoResumen(true)
    try { setResumen(await llmUsoApi.resumen()) } finally { setCargandoResumen(false) }
  }, [])

  const cargarFilas = useCallback(async () => {
    setCargandoFilas(true)
    try {
      setFilas(await llmUsoApi.listar({
        desde: filtros.desde || undefined,
        hasta: filtros.hasta || undefined,
        proveedor: filtros.proveedor || undefined,
        modelo: filtros.modelo || undefined,
        codigo_usuario: filtros.codigo_usuario || undefined,
      }))
    } finally { setCargandoFilas(false) }
  }, [filtros])

  useEffect(() => { cargarResumen(); cargarFilas() }, [cargarResumen, cargarFilas])

  const exportarUso = () => {
    exportarExcel(
      filas as unknown as Record<string, unknown>[],
      [
        { titulo: 'Fecha', campo: 'created_at' },
        { titulo: 'Proveedor', campo: 'proveedor' },
        { titulo: 'Modelo', campo: 'modelo' },
        { titulo: 'Usuario', campo: 'codigo_usuario' },
        { titulo: 'Función', campo: 'codigo_funcion' },
        { titulo: 'Habilidad', campo: 'codigo_habilidad' },
        { titulo: 'Tok. In', campo: 'tokens_input' },
        { titulo: 'Tok. Out', campo: 'tokens_output' },
        { titulo: 'Costo USD', campo: 'costo_estimado_usd' },
        { titulo: 'Estado', campo: 'exito', formato: (v) => (v ? 'OK' : 'Error') },
      ],
      `costos-llm-${grupoActivo}`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader titulo={tUso('titulo')} subtitulo={tUso('descripcion', { grupo: grupoActivo ?? '' })} />
        <div className="flex gap-2 shrink-0">
          <Boton variante="contorno" onClick={() => { cargarResumen(); cargarFilas() }}>
            <RefreshCw className="w-4 h-4 mr-1" />{tUso('refrescar')}
          </Boton>
          <Boton variante="contorno" onClick={exportarUso}>
            <Download className="w-4 h-4 mr-1" />{tUso('exportar')}
          </Boton>
        </div>
      </div>

      {/* Tarjetas resumen del mes */}
      {cargandoResumen ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : resumen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{tUso('mesActual')}</div>
            <div className="text-xl font-bold text-[#074B91] mt-1">{resumen.mes}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{tUso('llamadas')}</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{fmtInt(resumen.total_llamadas)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{tUso('costoTotal')}</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{fmtUsd(resumen.total_costo_usd)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{tUso('keyCasaGrupo')}</div>
            <div className="text-sm font-medium text-gray-900 mt-2">
              <span className="text-amber-600">{fmtUsd(resumen.costo_key_casa_usd)}</span>{' '}/{' '}
              <span className="text-green-600">{fmtUsd(resumen.costo_key_grupo_usd)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tablas por modelo y por usuario */}
      {resumen && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{tUso('porModelo')}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b">
                  <th className="text-left py-1">{tUso('colModelo')}</th>
                  <th className="text-right py-1">{tUso('colLlamadas')}</th>
                  <th className="text-right py-1">{tUso('colTokenIn')}</th>
                  <th className="text-right py-1">{tUso('colTokenOut')}</th>
                  <th className="text-right py-1">{tUso('colCosto')}</th>
                </tr>
              </thead>
              <tbody>
                {resumen.por_modelo.map((m) => (
                  <tr key={m.clave} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{m.clave}</td>
                    <td className="text-right">{fmtInt(m.llamadas)}</td>
                    <td className="text-right">{fmtInt(m.tokens_input)}</td>
                    <td className="text-right">{fmtInt(m.tokens_output)}</td>
                    <td className="text-right font-medium">{fmtUsd(m.costo_usd)}</td>
                  </tr>
                ))}
                {resumen.por_modelo.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-400">{tUso('sinDatosMes')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{tUso('porUsuario')}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b">
                  <th className="text-left py-1">{tUso('colNombre')}</th>
                  <th className="text-right py-1">{tUso('colLlamadas')}</th>
                  <th className="text-right py-1">{tUso('colCosto')}</th>
                </tr>
              </thead>
              <tbody>
                {resumen.por_usuario.map((u) => (
                  <tr key={u.clave} className="border-b last:border-0">
                    <td className="py-2 text-xs">{u.clave}</td>
                    <td className="text-right">{fmtInt(u.llamadas)}</td>
                    <td className="text-right font-medium">{fmtUsd(u.costo_usd)}</td>
                  </tr>
                ))}
                {resumen.por_usuario.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-gray-400">{tUso('sinDatosMes')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle de llamadas con filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{tUso('detalleLlamadas')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <Input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} placeholder={tUso('filterDesde')} />
          <Input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} placeholder={tUso('filterHasta')} />
          <select value={filtros.proveedor} onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
            <option value="">{tUso('filterTodosProveedores')}</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
          </select>
          <Input placeholder={tUso('filterModelo')} value={filtros.modelo} onChange={(e) => setFiltros({ ...filtros, modelo: e.target.value })} />
          <Input placeholder={tUso('filterUsuario')} value={filtros.codigo_usuario} onChange={(e) => setFiltros({ ...filtros, codigo_usuario: e.target.value })} />
        </div>
        <div className="flex justify-end mb-3">
          <Boton onClick={cargarFilas}>{tUso('aplicar')}</Boton>
        </div>
        {cargandoFilas ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaTh>{tUso('colFecha')}</TablaTh>
                <TablaTh>{tUso('colProveedor')}</TablaTh>
                <TablaTh>{tUso('colModelo')}</TablaTh>
                <TablaTh>{tUso('colKey')}</TablaTh>
                <TablaTh>{tUso('colUsuario')}</TablaTh>
                <TablaTh>{tUso('colFuncion')}</TablaTh>
                <TablaTh>{tUso('colHabilidad')}</TablaTh>
                <TablaTh className="text-right">{tUso('colTokIn')}</TablaTh>
                <TablaTh className="text-right">{tUso('colTokOut')}</TablaTh>
                <TablaTh className="text-right">{tUso('colCosto')}</TablaTh>
                <TablaTh>{tUso('colEstado')}</TablaTh>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {filas.map((f) => (
                <TablaFila key={f.id}>
                  <TablaTd className="text-xs">{new Date(f.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</TablaTd>
                  <TablaTd className="capitalize">{f.proveedor}</TablaTd>
                  <TablaTd className="font-mono text-xs">{f.modelo}</TablaTd>
                  <TablaTd>{f.uso_key_casa ? <Insignia variante="advertencia">Casa</Insignia> : <Insignia variante="exito">{f.alias_credencial}</Insignia>}</TablaTd>
                  <TablaTd className="text-xs">{f.codigo_usuario}</TablaTd>
                  <TablaTd className="text-xs">{f.codigo_funcion ?? '—'}</TablaTd>
                  <TablaTd className="text-xs">{f.codigo_habilidad ?? '—'}</TablaTd>
                  <TablaTd className="text-right">{fmtInt(f.tokens_input)}</TablaTd>
                  <TablaTd className="text-right">{fmtInt(f.tokens_output)}</TablaTd>
                  <TablaTd className="text-right">{fmtUsd(f.costo_estimado_usd)}</TablaTd>
                  <TablaTd>{f.exito ? <Insignia variante="exito">OK</Insignia> : <Insignia variante="error">Error</Insignia>}</TablaTd>
                </TablaFila>
              ))}
              {filas.length === 0 && (
                <TablaFila><TablaTd colSpan={11} className="text-center text-gray-400 py-6">{tUso('sinLlamadas')}</TablaTd></TablaFila>
              )}
            </TablaCuerpo>
          </Tabla>
        )}
      </div>
    </div>
  )
}
