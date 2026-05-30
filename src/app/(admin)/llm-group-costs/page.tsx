'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Paginador } from '@/components/ui/paginador'
import { PageHeader } from '@/components/layout/PageHeader'
import { TablaUsoLLM } from '@/components/llm/TablaUsoLLM'
import { llmUsoApi } from '@/lib/api'
import type { LLMUsoFila, LLMUsoResumen } from '@/lib/api'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'

function fmtUsd(n: number | undefined | null) {
  return `$${(Number(n) || 0).toFixed(4)}`
}
function fmtInt(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString('es-CL')
}

export default function PaginaCostosGrupo() {
  const t = useTranslations('llmGroupCosts')
  const { grupoActivo } = useAuth()

  const [resumen, setResumen] = useState<LLMUsoResumen | null>(null)
  const [filas, setFilas] = useState<LLMUsoFila[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', proveedor: '', modelo: '', codigo_funcion: '', solo_errores: false,
  })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const offset = (page - 1) * limit
      const [r, f] = await Promise.all([
        llmUsoApi.resumen(),
        llmUsoApi.listar({
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
          proveedor: filtros.proveedor || undefined,
          modelo: filtros.modelo || undefined,
          codigo_funcion: filtros.codigo_funcion || undefined,
          solo_errores: filtros.solo_errores || undefined,
          limit,
          offset,
        }),
      ])
      setResumen(r)
      setFilas(f.filas)
      setTotal(f.total)
    } finally {
      setCargando(false)
    }
  }, [filtros, page, limit])

  useEffect(() => { cargar() }, [cargar])

  const aplicarFiltros = () => {
    if (page !== 1) setPage(1)
    else cargar()
  }

  const exportar = () => {
    exportarExcel(
      filas as unknown as Record<string, unknown>[],
      [
        { titulo: t('colFecha'), campo: 'created_at' },
        { titulo: t('colProveedor'), campo: 'proveedor' },
        { titulo: t('colModelo'), campo: 'modelo' },
        { titulo: t('colAlias'), campo: 'alias_credencial' },
        { titulo: t('colKeyCasa'), campo: 'uso_key_casa', formato: (v) => (v ? 'SI' : 'NO') },
        { titulo: t('colUsuario'), campo: 'codigo_usuario' },
        { titulo: t('colFuncion'), campo: 'codigo_funcion' },
        { titulo: t('colOperacion'), campo: 'operacion' },
        { titulo: t('colTokensIn'), campo: 'tokens_input' },
        { titulo: t('colTokensOut'), campo: 'tokens_output' },
        { titulo: t('colCostoUsd'), campo: 'costo_estimado_usd' },
        { titulo: t('colDuracionMs'), campo: 'duracion_ms' },
        { titulo: t('colExito'), campo: 'exito', formato: (v) => (v ? 'SI' : 'NO') },
        { titulo: t('colError'), campo: 'error_mensaje' },
      ],
      `costos-grupo-${grupoActivo}-${new Date().toISOString().slice(0, 10)}`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          titulo={t('titulo')}
          subtitulo={t('subtitulo', { grupo: grupoActivo ?? '' })}
        />
        <div className="flex gap-2 shrink-0">
          <Boton variante="contorno" onClick={cargar}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('botonRefrescar')}
          </Boton>
          <Boton variante="contorno" onClick={exportar}>
            <Download className="w-4 h-4 mr-1" />{t('botonExportar')}
          </Boton>
        </div>
      </div>

      {/* Tarjetas resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{t('cardMesActual')}</div>
            <div className="text-xl font-bold text-[#074B91] mt-1">{resumen.mes}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{t('cardLlamadas')}</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{fmtInt(resumen.total_llamadas)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{t('cardCostoTotal')}</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{fmtUsd(resumen.total_costo_usd)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">{t('cardKeyCasaGrupo')}</div>
            <div className="text-sm font-medium text-gray-900 mt-2">
              <span className="text-amber-600">{fmtUsd(resumen.costo_key_casa_usd)}</span>{' '}/{' '}
              <span className="text-green-600">{fmtUsd(resumen.costo_key_grupo_usd)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tablas resumen por modelo y usuario */}
      {resumen && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('seccionPorModelo')}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b">
                  <th className="text-left py-1">{t('colModelo')}</th>
                  <th className="text-right py-1">{t('colLlamadas')}</th>
                  <th className="text-right py-1">{t('colTokIn')}</th>
                  <th className="text-right py-1">{t('colTokOut')}</th>
                  <th className="text-right py-1">{t('colCosto')}</th>
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
                  <tr><td colSpan={5} className="py-4 text-center text-gray-400">{t('sinDatosEsteMes')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('seccionPorUsuario')}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b">
                  <th className="text-left py-1">{t('colUsuario')}</th>
                  <th className="text-right py-1">{t('colLlamadas')}</th>
                  <th className="text-right py-1">{t('colCosto')}</th>
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
                  <tr><td colSpan={3} className="py-4 text-center text-gray-400">{t('sinDatosEsteMes')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle con filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('seccionDetalle')}</h3>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
            className="h-9 w-[130px] border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
            className="h-9 w-[130px] border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
          <select
            value={filtros.proveedor}
            onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })}
            className="h-9 w-36 border border-gray-300 rounded-lg px-2 py-1 text-sm"
          >
            <option value="">{t('colProveedor')}</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="openai">OpenAI</option>
          </select>
          <input
            placeholder={t('colModelo')}
            value={filtros.modelo}
            onChange={(e) => setFiltros({ ...filtros, modelo: e.target.value })}
            className="h-9 w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
          <input
            placeholder={t('colFuncion')}
            value={filtros.codigo_funcion}
            onChange={(e) => setFiltros({ ...filtros, codigo_funcion: e.target.value })}
            className="h-9 w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={filtros.solo_errores}
              onChange={(e) => setFiltros({ ...filtros, solo_errores: e.target.checked })}
              className="rounded border-gray-300"
            />
            {t('soloErrores')}
          </label>
          <Boton onClick={aplicarFiltros}>{t('botonAplicarFiltros')}</Boton>
        </div>
        {cargando ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <>
            <TablaUsoLLM filas={filas} mostrarGrupo={false} />
            <Paginador
              page={page}
              limit={limit}
              total={total}
              onChangePage={setPage}
              onChangeLimit={(n) => { setLimit(n); setPage(1) }}
              cargando={cargando}
              opcionesLimit={[20, 50, 100, 200]}
            />
          </>
        )}
      </div>
    </div>
  )
}
