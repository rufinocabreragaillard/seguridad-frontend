'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { TablaUsoLLM } from '@/components/llm/TablaUsoLLM'
import { llmUsoApi } from '@/lib/api'
import type { LLMUsoFila, LLMUsoResumenGlobal } from '@/lib/api'
import { exportarExcel } from '@/lib/exportar-excel'

function fmtUsd(n: number | undefined | null) {
  return `$${(Number(n) || 0).toFixed(4)}`
}
function fmtInt(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString('es-CL')
}

const GRUPOS = [
  { codigo: '', nombre: 'Todos los grupos' },
  { codigo: 'ADMIN', nombre: 'SuperSeguridad' },
  { codigo: 'CAB LTDA', nombre: 'Cab Limitada' },
  { codigo: 'MUNIPIRQUE', nombre: 'Municipalidad de Pirque' },
  { codigo: 'IANET', nombre: 'iAnet' },
  { codigo: 'TROMU', nombre: 'TROMU' },
  { codigo: '000001', nombre: 'MARION' },
  { codigo: '000016', nombre: 'Empresa Test SA' },
  { codigo: '000017', nombre: 'Demo Company Test' },
  { codigo: '000018', nombre: 'Empresa Tres SA' },
  { codigo: '000019', nombre: 'Acme Corp Demo' },
  { codigo: '000020', nombre: 'ServerLM' },
  { codigo: '000021', nombre: 'Serverlm.ai' },
  { codigo: '000027', nombre: 'Usumacinta' },
]

export default function PaginaCostosSistema() {
  const [resumen, setResumen] = useState<LLMUsoResumenGlobal | null>(null)
  const [filas, setFilas] = useState<LLMUsoFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', proveedor: '', modelo: '', codigo_grupo: '', codigo_funcion: '', solo_errores: false,
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [r, f] = await Promise.all([
        llmUsoApi.resumenGlobal(filtros.codigo_grupo || undefined),
        llmUsoApi.listarGlobal({
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
          proveedor: filtros.proveedor || undefined,
          modelo: filtros.modelo || undefined,
          codigo_grupo: filtros.codigo_grupo || undefined,
          codigo_funcion: filtros.codigo_funcion || undefined,
          solo_errores: filtros.solo_errores || undefined,
          limit: 500,
        }),
      ])
      setResumen(r)
      setFilas(f)
    } finally {
      setCargando(false)
    }
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const exportar = () => {
    exportarExcel(
      filas as unknown as Record<string, unknown>[],
      [
        { titulo: 'Fecha', campo: 'created_at' },
        { titulo: 'Grupo', campo: 'codigo_grupo' },
        { titulo: 'Entidad', campo: 'codigo_entidad' },
        { titulo: 'Proveedor', campo: 'proveedor' },
        { titulo: 'Modelo', campo: 'modelo' },
        { titulo: 'Alias', campo: 'alias_credencial' },
        { titulo: 'Key casa', campo: 'uso_key_casa', formato: (v) => (v ? 'SI' : 'NO') },
        { titulo: 'Usuario', campo: 'codigo_usuario' },
        { titulo: 'Función', campo: 'codigo_funcion' },
        { titulo: 'Habilidad', campo: 'codigo_habilidad' },
        { titulo: 'Proceso', campo: 'codigo_proceso' },
        { titulo: 'Tokens in', campo: 'tokens_input' },
        { titulo: 'Tokens out', campo: 'tokens_output' },
        { titulo: 'Costo USD', campo: 'costo_estimado_usd' },
        { titulo: 'Duración ms', campo: 'duracion_ms' },
        { titulo: 'Éxito', campo: 'exito', formato: (v) => (v ? 'SI' : 'NO') },
        { titulo: 'Error', campo: 'error_mensaje' },
      ],
      `costos-sistema-${new Date().toISOString().slice(0, 10)}`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          titulo="Costos LLM — Sistema"
          subtitulo="Vista global de uso de modelos LLM en todos los grupos"
        />
        <div className="flex gap-2 shrink-0">
          <Boton variante="contorno" onClick={cargar}>
            <RefreshCw className="w-4 h-4 mr-1" />Refrescar
          </Boton>
          <Boton variante="contorno" onClick={exportar}>
            <Download className="w-4 h-4 mr-1" />Exportar
          </Boton>
        </div>
      </div>

      {/* Tarjetas resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Mes actual</div>
            <div className="text-xl font-bold text-[#074B91] mt-1">{resumen.mes}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Llamadas totales</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{fmtInt(resumen.total_llamadas)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Costo total</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{fmtUsd(resumen.total_costo_usd)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase">Key casa / Grupos</div>
            <div className="text-sm font-medium text-gray-900 mt-2">
              <span className="text-amber-600">{fmtUsd(resumen.costo_key_casa_usd)}</span>{' '}/{' '}
              <span className="text-green-600">{fmtUsd(resumen.costo_key_grupo_usd)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tablas resumen por modelo y por grupo */}
      {resumen && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Por modelo (mes actual)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b">
                  <th className="text-left py-1">Modelo</th>
                  <th className="text-right py-1">Llamadas</th>
                  <th className="text-right py-1">Errores</th>
                  <th className="text-right py-1">Costo</th>
                </tr>
              </thead>
              <tbody>
                {resumen.por_modelo.map((m) => (
                  <tr key={m.clave} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{m.clave}</td>
                    <td className="text-right">{fmtInt(m.llamadas)}</td>
                    <td className="text-right text-red-600">{m.errores > 0 ? m.errores : '—'}</td>
                    <td className="text-right font-medium">{fmtUsd(m.costo_usd)}</td>
                  </tr>
                ))}
                {resumen.por_modelo.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sin datos este mes</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Por grupo (mes actual)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b">
                  <th className="text-left py-1">Grupo</th>
                  <th className="text-right py-1">Llamadas</th>
                  <th className="text-right py-1">Errores</th>
                  <th className="text-right py-1">Costo</th>
                </tr>
              </thead>
              <tbody>
                {resumen.por_grupo.map((g) => (
                  <tr key={g.clave} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{g.clave}</td>
                    <td className="text-right">{fmtInt(g.llamadas)}</td>
                    <td className="text-right text-red-600">{g.errores > 0 ? g.errores : '—'}</td>
                    <td className="text-right font-medium">{fmtUsd(g.costo_usd)}</td>
                  </tr>
                ))}
                {resumen.por_grupo.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sin datos este mes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle con filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Detalle de llamadas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 mb-3">
          <Input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} placeholder="Desde" />
          <Input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} placeholder="Hasta" />
          <select
            value={filtros.proveedor}
            onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">Todos los proveedores</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="openai">OpenAI</option>
          </select>
          <select
            value={filtros.codigo_grupo}
            onChange={(e) => setFiltros({ ...filtros, codigo_grupo: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {GRUPOS.map((g) => (
              <option key={g.codigo} value={g.codigo}>{g.nombre}</option>
            ))}
          </select>
          <Input placeholder="Modelo" value={filtros.modelo} onChange={(e) => setFiltros({ ...filtros, modelo: e.target.value })} />
          <Input placeholder="Función" value={filtros.codigo_funcion} onChange={(e) => setFiltros({ ...filtros, codigo_funcion: e.target.value })} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filtros.solo_errores}
                onChange={(e) => setFiltros({ ...filtros, solo_errores: e.target.checked })}
                className="rounded border-gray-300"
              />
              Solo errores
            </label>
          </div>
        </div>
        <div className="flex justify-end mb-3">
          <Boton onClick={cargar}>Aplicar filtros</Boton>
        </div>
        {cargando ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <TablaUsoLLM filas={filas} mostrarGrupo={true} />
        )}
      </div>
    </div>
  )
}
