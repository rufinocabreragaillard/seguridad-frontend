'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Brain, RefreshCw, Upload, Zap, Languages, Globe,
  AlertCircle, CheckCircle2, Code2, FileText, Play, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import {
  promptsApi, traduccionesApi, funcionesApi,
  type EstadoPrompts, type TablaConteoPrompts,
} from '@/lib/api'
import type { EstadoTraducciones, Funcion } from '@/lib/tipos'
import ES_MESSAGES from '../../../../messages/es.json'

type Tab = 'prompts' | 'codigo' | 'mensajes' | 'traducciones' | 'apis'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'prompts',      label: 'Prompts',      icon: <Brain className="w-4 h-4" /> },
  { id: 'codigo',       label: 'Código y MD',  icon: <Code2 className="w-4 h-4" /> },
  { id: 'mensajes',     label: 'Mensajes UI',  icon: <Languages className="w-4 h-4" /> },
  { id: 'traducciones', label: 'Traducciones', icon: <Languages className="w-4 h-4" /> },
  { id: 'apis',         label: 'APIs',         icon: <Globe className="w-4 h-4" /> },
]

export default function PaginaPrompts() {
  const [tab, setTab] = useState<Tab>('prompts')
  const [estado, setEstado] = useState<EstadoPrompts | null>(null)
  const [estadoTrad, setEstadoTrad] = useState<EstadoTraducciones | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState<string | null>(null)
  const [regenerandoApis, setRegenerandoApis] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [cargandoFunciones, setCargandoFunciones] = useState(false)
  const [genProgress, setGenProgress] = useState<{
    modo: 'insert' | 'update' | 'md' | null
    actual: number
    total: number
    errores: { codigo: string; error: string }[]
    terminado: boolean
  }>({ modo: null, actual: 0, total: 0, errores: [], terminado: false })
  const abortGenRef = useRef(false)

  const [generandoMensajes, setGenerandoMensajes] = useState(false)
  const [mensajesUiResultado, setMensajesUiResultado] = useState<Record<string, Record<string, unknown>> | null>(null)

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

  const cargarFunciones = useCallback(async () => {
    setCargandoFunciones(true)
    try {
      const lista = await funcionesApi.listar()
      setFunciones(lista)
    } catch {
      // silencioso
    } finally {
      setCargandoFunciones(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    cargarFunciones()
  }, [cargar, cargarFunciones])

  const elegiblasInsert = funciones.filter((f) => f.prompt_insert && !f.python_editado_manual)
  const elegiblasUpdate = funciones.filter((f) => f.prompt_update && !f.python_editado_manual)
  const elegiablesMd = funciones

  async function sincronizarTabla(tabla: string, soloCambios: boolean) {
    setSincronizando(tabla)
    setMensaje(null)
    try {
      const res = await promptsApi.sincronizarTabla(tabla, soloCambios)
      setMensaje({ tipo: 'ok', texto: `${tabla}: ${res.sincronizadas} de ${res.total} filas sincronizadas.` })
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

  async function generarMasivo(modo: 'insert' | 'update' | 'md') {
    const lista = modo === 'insert' ? elegiblasInsert : modo === 'update' ? elegiblasUpdate : elegiablesMd
    abortGenRef.current = false
    setGenProgress({ modo, actual: 0, total: lista.length, errores: [], terminado: false })
    setMensaje(null)
    let ok = 0
    const errores: { codigo: string; error: string }[] = []
    for (let i = 0; i < lista.length; i++) {
      if (abortGenRef.current) break
      const f = lista[i]
      setGenProgress((p) => ({ ...p, actual: i + 1 }))
      try {
        if (modo === 'md') {
          await funcionesApi.generarMd(f.codigo_funcion)
        } else {
          await promptsApi.compilar({
            tabla: 'funciones',
            pk_columna: 'codigo_funcion',
            pk_valor: f.codigo_funcion,
            lenguaje: modo === 'insert' ? 'python_insert' : 'python_update',
          })
        }
        ok++
      } catch (e: unknown) {
        const err = e as { message?: string; response?: { data?: { detail?: string } } }
        errores.push({ codigo: f.codigo_funcion, error: err?.response?.data?.detail || err?.message || 'Error' })
      }
    }
    setGenProgress((p) => ({ ...p, terminado: true, errores }))
    setMensaje({
      tipo: errores.length === 0 ? 'ok' : 'error',
      texto: `${modo === 'md' ? 'Generar MD' : modo === 'insert' ? 'Python Insert' : 'Python Update'}: ${ok} ok, ${errores.length} errores.`,
    })
    cargarFunciones()
  }

  function detenerGeneracion() {
    abortGenRef.current = true
  }

  async function generarMensajesUi() {
    setGenerandoMensajes(true)
    setMensajesUiResultado(null)
    setMensaje(null)
    try {
      const resultado = await traduccionesApi.generarMensajesUi(ES_MESSAGES)
      setMensajesUiResultado(resultado)
      const idiomas = Object.keys(resultado)
      setMensaje({ tipo: 'ok', texto: `Mensajes generados para: ${idiomas.join(', ')}. Descarga los JSON y reemplaza los archivos en frontend/messages/.` })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al generar mensajes' })
    } finally {
      setGenerandoMensajes(false)
    }
  }

  function descargarMensajeJson(locale: string, data: Record<string, unknown>) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${locale}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tablasConPendientes = (estado?.tablas || []).filter((t) => (t.pendientes_sync || 0) > 0)
  const generandoMasivo = genProgress.modo !== null && !genProgress.terminado

  return (
    <div className="flex flex-col gap-4 max-w-6xl">
      <h2 className="page-heading flex items-center gap-2">
        <Brain /> Sincronización
      </h2>

      {/* Pestañas */}
      <div className="border-b border-borde">
        <nav className="flex gap-0" aria-label="Pestañas de sincronización">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMensaje(null) }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${tab === t.id
                  ? 'border-primario text-primario'
                  : 'border-transparent text-texto-muted hover:text-texto hover:border-borde'
                }`}
            >
              {t.icon}
              {t.label}
              {/* Badge de pendientes en pestaña Prompts */}
              {t.id === 'prompts' && tablasConPendientes.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold leading-none">
                  {tablasConPendientes.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Mensaje de resultado */}
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

      {/* ── Tab: Prompts ── */}
      {tab === 'prompts' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-texto-muted">
              Cada fila configurable se convierte en un documento virtual que entra al pipeline RAG.
            </p>
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
        </div>
      )}

      {/* ── Tab: Código y MD ── */}
      {tab === 'codigo' && (
        <div>
          <p className="text-sm text-texto-muted mb-4">
            Genera Python Insert, Python Update y documentación MD para todas las funciones elegibles en un solo proceso.
            {cargandoFunciones && ' Cargando funciones…'}
          </p>

          {generandoMasivo && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  {genProgress.modo === 'insert' ? 'Generando Python Insert' :
                   genProgress.modo === 'update' ? 'Generando Python Update' : 'Generando MD'}{' '}
                  — {genProgress.actual} / {genProgress.total}
                </span>
                <Boton variante="contorno" tamano="sm" onClick={detenerGeneracion}>
                  Detener
                </Boton>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${genProgress.total > 0 ? (genProgress.actual / genProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {genProgress.terminado && genProgress.errores.length > 0 && (
            <ErroresGeneracion errores={genProgress.errores} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-borde rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-4 h-4 text-green-600" />
                <span className="font-medium text-sm">Python Insert</span>
              </div>
              <p className="text-xs text-texto-muted mb-3">
                Funciones con <code>prompt_insert</code> y sin edición manual:{' '}
                <strong>{elegiblasInsert.length}</strong>
              </p>
              <Boton
                variante="primario"
                tamano="sm"
                onClick={() => generarMasivo('insert')}
                disabled={generandoMasivo || cargandoFunciones || elegiblasInsert.length === 0}
              >
                <Code2 className="w-4 h-4" /> Generar Python Insert
              </Boton>
            </div>

            <div className="border border-borde rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm">Python Update</span>
              </div>
              <p className="text-xs text-texto-muted mb-3">
                Funciones con <code>prompt_update</code> y sin edición manual:{' '}
                <strong>{elegiblasUpdate.length}</strong>
              </p>
              <Boton
                variante="primario"
                tamano="sm"
                onClick={() => generarMasivo('update')}
                disabled={generandoMasivo || cargandoFunciones || elegiblasUpdate.length === 0}
              >
                <Code2 className="w-4 h-4" /> Generar Python Update
              </Boton>
            </div>

            <div className="border border-borde rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-sm">Documentación MD</span>
              </div>
              <p className="text-xs text-texto-muted mb-3">
                Genera/regenera el MD de todas las funciones:{' '}
                <strong>{elegiablesMd.length}</strong>
              </p>
              <Boton
                variante="primario"
                tamano="sm"
                onClick={() => generarMasivo('md')}
                disabled={generandoMasivo || cargandoFunciones || elegiablesMd.length === 0}
              >
                <FileText className="w-4 h-4" /> Generar MD masivo
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Mensajes UI ── */}
      {tab === 'mensajes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-texto-muted">
              Traduce los archivos <code>messages/*.json</code> del frontend. Genera EN, PT, FR, DE desde el español.
              Una vez generados, descarga cada archivo y reemplázalo en <code>frontend/messages/</code> antes del próximo deploy.
            </p>
            <Boton variante="primario" tamano="sm" onClick={generarMensajesUi} disabled={generandoMensajes}>
              <Languages className="w-4 h-4" />
              {generandoMensajes ? 'Generando…' : 'Generar mensajes UI'}
            </Boton>
          </div>

          {mensajesUiResultado && (
            <div className="mt-3">
              <p className="text-sm font-medium mb-2">Descargar archivos generados:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(mensajesUiResultado).map(([locale, data]) => (
                  <Boton
                    key={locale}
                    variante="contorno"
                    tamano="sm"
                    onClick={() => descargarMensajeJson(locale, data)}
                  >
                    ⬇ {locale}.json
                  </Boton>
                ))}
              </div>
              <p className="text-xs text-texto-muted mt-2">
                Reemplaza los archivos descargados en <code>frontend/messages/</code> y haz commit+push para que Vercel despliegue con los nuevos textos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Traducciones ── */}
      {tab === 'traducciones' && (
        <div className="flex items-center justify-between">
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
          <a href="/traducciones" className="text-primario text-sm underline">Ir al panel completo →</a>
        </div>
      )}

      {/* ── Tab: APIs ── */}
      {tab === 'apis' && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-texto-muted">
            Regenera la tabla <code>api_endpoints</code> desde la vista <code>v_funcion_api</code>. Los LLMs solo acceden vía esta tabla.
          </p>
          <Boton variante="primario" onClick={regenerarApis} disabled={regenerandoApis}>
            <Zap className="w-4 h-4" /> {regenerandoApis ? 'Regenerando…' : 'Regenerar APIs'}
          </Boton>
        </div>
      )}
    </div>
  )
}

function ErroresGeneracion({ errores }: { errores: { codigo: string; error: string }[] }) {
  const [expandido, setExpandido] = useState(false)
  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <button
        className="flex items-center gap-2 text-sm font-medium text-amber-800 w-full"
        onClick={() => setExpandido((v) => !v)}
      >
        <AlertCircle className="w-4 h-4" />
        {errores.length} error{errores.length > 1 ? 'es' : ''} durante la generación
        {expandido ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
      </button>
      {expandido && (
        <ul className="mt-2 text-xs text-amber-700 space-y-1">
          {errores.map((e) => (
            <li key={e.codigo}>
              <code>{e.codigo}</code>: {e.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
