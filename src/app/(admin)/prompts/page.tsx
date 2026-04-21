'use client'

import { useEffect, useState, useCallback } from 'react'
import { Brain, RefreshCw, Upload, Zap, Languages, Globe, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { promptsApi, traduccionesApi, type EstadoPrompts, type TablaConteoPrompts } from '@/lib/api'
import type { EstadoTraducciones } from '@/lib/tipos'

/**
 * Panel unificado de Sincronización multi-elemento.
 *
 * Acá se gestionan todas las operaciones de sincronización del sistema:
 * - Prompts (documentos virtuales por tabla → pipeline → BD vectorial)
 * - Traducciones (UI y catálogos)
 * - APIs (regenerar api_endpoints desde v_funcion_api)
 *
 * Ver diseño en /serverlm-todoPorPrompts.md
 */
export default function PaginaPrompts() {
  const [estado, setEstado] = useState<EstadoPrompts | null>(null)
  const [estadoTrad, setEstadoTrad] = useState<EstadoTraducciones | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState<string | null>(null)
  const [regenerandoApis, setRegenerandoApis] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [ep, et] = await Promise.all([
        promptsApi.estado().catch(() => null),
        traduccionesApi.estado().catch(() => null),
      ])
      setEstado(ep)
      setEstadoTrad(et)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function sincronizarTabla(tabla: string, soloCambios: boolean) {
    setSincronizando(tabla)
    setMensaje(null)
    try {
      const res = await promptsApi.sincronizarTabla(tabla, soloCambios)
      setMensaje({
        tipo: 'ok',
        texto: `${tabla}: ${res.sincronizadas} de ${res.total} filas sincronizadas.`,
      })
      await cargar()
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error' })
    } finally {
      setSincronizando(null)
    }
  }

  async function sincronizarTodo() {
    setSincronizando('__todas__')
    setMensaje(null)
    try {
      const res = await promptsApi.sincronizarTodas(true)
      setMensaje({ tipo: 'ok', texto: res.mensaje })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error' })
    } finally {
      setSincronizando(null)
    }
  }

  async function regenerarApis() {
    setRegenerandoApis(true)
    setMensaje(null)
    try {
      const res = await promptsApi.regenerarApis()
      setMensaje({ tipo: 'ok', texto: `APIs regeneradas: ${res.upserted} endpoints desde ${res.total_vista} filas de v_funcion_api.` })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error' })
    } finally {
      setRegenerandoApis(false)
    }
  }

  const tablasConPendientes = (estado?.tablas || []).filter((t) => (t.pendientes_sync || 0) > 0)

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="page-heading flex items-center gap-2"><Brain /> Sincronización de Prompts</h2>
        <p className="text-sm text-texto-muted mt-1">
          Panel unificado para sincronizar prompts, traducciones y APIs. Ver{' '}
          <a href="/serverlm-todoPorPrompts.md" className="text-primario underline">diseño completo</a>.
        </p>
      </div>

      {mensaje && (
        <div
          className={
            mensaje.tipo === 'ok'
              ? 'p-3 rounded-lg bg-green-50 text-green-800 border border-green-200 flex items-center gap-2'
              : 'p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 flex items-center gap-2'
          }
        >
          {mensaje.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {mensaje.texto}
        </div>
      )}

      {/* Sección 1: Prompts */}
      <section className="bg-surface border border-borde rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Brain className="w-5 h-5" /> Prompts por tabla</h3>
            <p className="text-sm text-texto-muted">
              Cada fila configurable se convierte en un documento virtual que entra al pipeline RAG.
            </p>
          </div>
          <div className="flex gap-2">
            <Boton variante="contorno" tamano="sm" onClick={cargar} disabled={cargando}>
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Refrescar
            </Boton>
            <Boton
              variante="primario"
              tamano="sm"
              onClick={sincronizarTodo}
              disabled={sincronizando !== null || tablasConPendientes.length === 0}
            >
              <Upload className="w-4 h-4" /> Sincronizar todas ({tablasConPendientes.length})
            </Boton>
          </div>
        </div>

        {cargando && <p className="text-sm text-texto-muted">Cargando estado…</p>}

        {!cargando && estado && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-borde">
                <tr>
                  <th className="text-left py-2 px-2">Tabla</th>
                  <th className="text-right py-2 px-2">Total filas</th>
                  <th className="text-right py-2 px-2">Con prompt</th>
                  <th className="text-right py-2 px-2">Pendientes sync</th>
                  <th className="text-right py-2 px-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {estado.tablas.map((t: TablaConteoPrompts) => (
                  <tr key={t.tabla} className="border-b border-borde/50 hover:bg-gris-fondo/50">
                    <td className="py-2 px-2 font-mono text-xs">{t.tabla}</td>
                    <td className="py-2 px-2 text-right">{t.total_filas ?? '—'}</td>
                    <td className="py-2 px-2 text-right">{t.con_prompt ?? '—'}</td>
                    <td className="py-2 px-2 text-right">
                      {(t.pendientes_sync ?? 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                          {t.pendientes_sync}
                        </span>
                      ) : (
                        <span className="text-texto-muted">0</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Boton
                          variante="contorno"
                          tamano="sm"
                          onClick={() => sincronizarTabla(t.tabla, true)}
                          disabled={sincronizando !== null || (t.pendientes_sync ?? 0) === 0}
                        >
                          Sync cambios
                        </Boton>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          onClick={() => sincronizarTabla(t.tabla, false)}
                          disabled={sincronizando !== null}
                        >
                          Sync todas
                        </Boton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-texto-muted mt-2">
              Total pendientes: <strong>{estado.total_pendientes_sync}</strong>
            </p>
          </div>
        )}
      </section>

      {/* Sección 2: Traducciones */}
      <section className="bg-surface border border-borde rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Languages className="w-5 h-5" /> Traducciones</h3>
            <p className="text-sm text-texto-muted">
              {estadoTrad ? (
                <>
                  Última generación: <strong>{estadoTrad.ultima_generacion ? new Date(estadoTrad.ultima_generacion).toLocaleString('es-CL') : '—'}</strong>.{' '}
                  Pendiente: <strong>{estadoTrad.pendiente ? 'Sí' : 'No'}</strong>.
                </>
              ) : (
                'Cargando estado…'
              )}
            </p>
          </div>
          <a href="/traducciones" className="text-primario text-sm underline">Ir al panel completo →</a>
        </div>
      </section>

      {/* Sección 3: APIs */}
      <section className="bg-surface border border-borde rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Globe className="w-5 h-5" /> APIs (tabla api_endpoints)</h3>
            <p className="text-sm text-texto-muted">
              Regenera la tabla <code>api_endpoints</code> desde la vista <code>v_funcion_api</code>. Los LLMs solo acceden vía esta tabla.
            </p>
          </div>
          <Boton variante="primario" onClick={regenerarApis} disabled={regenerandoApis}>
            <Zap className="w-4 h-4" /> {regenerandoApis ? 'Regenerando…' : 'Regenerar APIs'}
          </Boton>
        </div>
      </section>
    </div>
  )
}
