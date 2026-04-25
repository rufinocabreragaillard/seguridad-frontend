'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Brain, RefreshCw, Upload, Zap, Languages, Globe,
  AlertCircle, CheckCircle2, Code2, FileText, Play, ChevronDown, ChevronUp, Search,
  Network, Workflow,
} from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import {
  promptsApi, traduccionesApi, funcionesApi, jerarquiasApi,
  type EstadoPrompts, type TablaConteoPrompts, type GrafoJerarquia,
} from '@/lib/api'
import type { EstadoTraducciones, Funcion } from '@/lib/tipos'
import ES_MESSAGES from '../../../../messages/es.json'

type Tab = 'prompts' | 'codigo' | 'mensajes' | 'traducciones' | 'apis' | 'jerarquias' | 'grafo'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'prompts',      label: 'Prompts',      icon: <Brain className="w-4 h-4" /> },
  { id: 'codigo',       label: 'Código y MD',  icon: <Code2 className="w-4 h-4" /> },
  { id: 'mensajes',     label: 'Mensajes UI',  icon: <Languages className="w-4 h-4" /> },
  { id: 'traducciones', label: 'Traducciones', icon: <Languages className="w-4 h-4" /> },
  { id: 'apis',         label: 'APIs',         icon: <Globe className="w-4 h-4" /> },
  { id: 'jerarquias',   label: 'Jerarquías',   icon: <Network className="w-4 h-4" /> },
  { id: 'grafo',        label: 'Grafo Funciones', icon: <Workflow className="w-4 h-4" /> },
]

// Componente reutilizable para la barra filtro + acciones
function BarraHerramientas({
  filtro,
  onFiltro,
  placeholder,
  acciones,
}: {
  filtro: string
  onFiltro: (v: string) => void
  placeholder: string
  acciones: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-texto-muted pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={filtro}
          onChange={(e) => onFiltro(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-borde rounded-lg bg-gris-fondo focus:outline-none focus:ring-2 focus:ring-primario/30"
        />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {acciones}
      </div>
    </div>
  )
}

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

  // Filtros por pestaña
  const [filtroTabla, setFiltroTabla] = useState('')
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroMensajes, setFiltroMensajes] = useState('')
  const [filtroTraducciones, setFiltroTraducciones] = useState('')
  const [filtroApis, setFiltroApis] = useState('')
  const [filtroJerarquias, setFiltroJerarquias] = useState('')

  // Jerarquías (closure tables)
  const [grafos, setGrafos] = useState<GrafoJerarquia[]>([])
  const [cargandoGrafos, setCargandoGrafos] = useState(false)
  const [refrescandoGrafo, setRefrescandoGrafo] = useState<string | null>(null)

  const cargarGrafos = useCallback(async () => {
    setCargandoGrafos(true)
    try { setGrafos(await jerarquiasApi.listarGrafos()) }
    catch { setGrafos([]) }
    finally { setCargandoGrafos(false) }
  }, [])

  async function refrescarGrafo(tabla: string) {
    setRefrescandoGrafo(tabla)
    setMensaje(null)
    try {
      const r = await jerarquiasApi.refrescar(tabla)
      setMensaje({ tipo: 'ok', texto: `${tabla}: ${r.filas} pares insertados.` })
      cargarGrafos()
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error' })
    } finally { setRefrescandoGrafo(null) }
  }

  async function refrescarTodosGrafos() {
    setRefrescandoGrafo('__todos__')
    setMensaje(null)
    try {
      const r = await jerarquiasApi.refrescarTodos()
      const ok = r.resultados.filter((x) => x.ok).length
      const ko = r.resultados.length - ok
      setMensaje({
        tipo: ko === 0 ? 'ok' : 'error',
        texto: `Refrescadas ${ok}/${r.resultados.length} jerarquías.${ko ? ` Errores: ${r.resultados.filter((x) => !x.ok).map((x) => x.tabla).join(', ')}` : ''}`,
      })
      cargarGrafos()
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error' })
    } finally { setRefrescandoGrafo(null) }
  }

  useEffect(() => {
    if (tab === 'jerarquias' && grafos.length === 0) cargarGrafos()
  }, [tab, grafos.length, cargarGrafos])

  const grafosFiltrados = grafos.filter((g) =>
    filtroJerarquias === '' ||
    g.tabla.toLowerCase().includes(filtroJerarquias.toLowerCase()) ||
    g.nombre.toLowerCase().includes(filtroJerarquias.toLowerCase())
  )

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

  // Listas filtradas para Código y MD
  const insertFiltradas = elegiblasInsert.filter((f) =>
    filtroCodigo === '' || f.codigo_funcion.toLowerCase().includes(filtroCodigo.toLowerCase())
  )
  const updateFiltradas = elegiblasUpdate.filter((f) =>
    filtroCodigo === '' || f.codigo_funcion.toLowerCase().includes(filtroCodigo.toLowerCase())
  )
  const mdFiltradas = elegiablesMd.filter((f) =>
    filtroCodigo === '' || f.codigo_funcion.toLowerCase().includes(filtroCodigo.toLowerCase())
  )

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
    const lista = modo === 'insert' ? insertFiltradas : modo === 'update' ? updateFiltradas : mdFiltradas
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
      setMensaje({ tipo: 'ok', texto: `Mensajes generados para: ${idiomas.join(', ')}.` })
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
  const tablasFiltradas = (estado?.tablas || []).filter((t) =>
    filtroTabla === '' || t.tabla.toLowerCase().includes(filtroTabla.toLowerCase())
  )

  // Filtro mensajes UI sobre locales generados
  const localesFiltrados = mensajesUiResultado
    ? Object.entries(mensajesUiResultado).filter(([locale]) =>
        filtroMensajes === '' || locale.toLowerCase().includes(filtroMensajes.toLowerCase())
      )
    : []

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
        <div className={
          mensaje.tipo === 'ok'
            ? 'p-3 rounded-lg bg-green-50 text-green-800 border border-green-200 flex items-center gap-2'
            : 'p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 flex items-center gap-2'
        }>
          {mensaje.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {mensaje.texto}
        </div>
      )}

      {/* ── Tab: Prompts ── */}
      {tab === 'prompts' && (
        <div>
          <BarraHerramientas
            filtro={filtroTabla}
            onFiltro={setFiltroTabla}
            placeholder="Filtrar tabla…"
            acciones={
              <>
                <Boton variante="contorno" tamano="sm" onClick={cargar} disabled={cargando}>
                  <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Refrescar
                </Boton>
                <Boton
                  variante="primario"
                  tamano="sm"
                  onClick={sincronizarTodo}
                  disabled={sincronizando !== null || tablasConPendientes.length === 0}
                >
                  <Upload className="w-4 h-4" /> Sincronizar pendientes ({tablasConPendientes.length})
                </Boton>
              </>
            }
          />

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
                  </tr>
                </thead>
                <tbody>
                  {tablasFiltradas.map((t: TablaConteoPrompts) => (
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
                    </tr>
                  ))}
                  {tablasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-sm text-texto-muted">
                        Sin resultados para &ldquo;{filtroTabla}&rdquo;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="text-xs text-texto-muted mt-2">
                Total pendientes: <strong>{estado.total_pendientes_sync}</strong>
                {filtroTabla && ` · Mostrando ${tablasFiltradas.length} de ${estado.tablas.length} tablas`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Código y MD ── */}
      {tab === 'codigo' && (
        <div>
          <BarraHerramientas
            filtro={filtroCodigo}
            onFiltro={setFiltroCodigo}
            placeholder="Filtrar función…"
            acciones={
              <>
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => generarMasivo('insert')}
                  disabled={generandoMasivo || cargandoFunciones || insertFiltradas.length === 0}
                >
                  <Play className="w-4 h-4 text-green-600" /> Python Insert ({insertFiltradas.length})
                </Boton>
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => generarMasivo('update')}
                  disabled={generandoMasivo || cargandoFunciones || updateFiltradas.length === 0}
                >
                  <Play className="w-4 h-4 text-blue-600" /> Python Update ({updateFiltradas.length})
                </Boton>
                <Boton
                  variante="primario"
                  tamano="sm"
                  onClick={() => generarMasivo('md')}
                  disabled={generandoMasivo || cargandoFunciones || mdFiltradas.length === 0}
                >
                  <FileText className="w-4 h-4" /> Generar MD ({mdFiltradas.length})
                </Boton>
                {generandoMasivo && (
                  <Boton variante="contorno" tamano="sm" onClick={detenerGeneracion}>
                    Detener
                  </Boton>
                )}
              </>
            }
          />

          {generandoMasivo && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  {genProgress.modo === 'insert' ? 'Generando Python Insert' :
                   genProgress.modo === 'update' ? 'Generando Python Update' : 'Generando MD'}{' '}
                  — {genProgress.actual} / {genProgress.total}
                </span>
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

          <p className="text-sm text-texto-muted">
            {cargandoFunciones ? 'Cargando funciones…' : `${funciones.length} funciones totales.`}
            {filtroCodigo && ` · Filtro activo: mostrando ${mdFiltradas.length} funciones.`}
          </p>
        </div>
      )}

      {/* ── Tab: Mensajes UI ── */}
      {tab === 'mensajes' && (
        <div>
          <BarraHerramientas
            filtro={filtroMensajes}
            onFiltro={setFiltroMensajes}
            placeholder="Filtrar idioma…"
            acciones={
              <Boton variante="primario" tamano="sm" onClick={generarMensajesUi} disabled={generandoMensajes}>
                <Languages className="w-4 h-4" />
                {generandoMensajes ? 'Generando…' : 'Generar mensajes UI'}
              </Boton>
            }
          />

          <p className="text-sm text-texto-muted mb-4">
            Traduce los archivos <code>messages/*.json</code> del frontend. Genera EN, PT, FR, DE desde el español.
            Una vez generados, descarga cada archivo y reemplázalo en <code>frontend/messages/</code> antes del próximo deploy.
          </p>

          {mensajesUiResultado && (
            <div>
              <p className="text-sm font-medium mb-2">Descargar archivos generados:</p>
              <div className="flex flex-wrap gap-2">
                {localesFiltrados.map(([locale, data]) => (
                  <Boton
                    key={locale}
                    variante="contorno"
                    tamano="sm"
                    onClick={() => descargarMensajeJson(locale, data)}
                  >
                    ⬇ {locale}.json
                  </Boton>
                ))}
                {localesFiltrados.length === 0 && filtroMensajes && (
                  <p className="text-sm text-texto-muted">Sin resultados para &ldquo;{filtroMensajes}&rdquo;</p>
                )}
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
        <div>
          <BarraHerramientas
            filtro={filtroTraducciones}
            onFiltro={setFiltroTraducciones}
            placeholder="Filtrar catálogo…"
            acciones={
              <a href="/traducciones" className="text-primario text-sm underline whitespace-nowrap">
                Ir al panel completo →
              </a>
            }
          />

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
      )}

      {/* ── Tab: Jerarquías ── */}
      {tab === 'jerarquias' && (
        <div>
          <BarraHerramientas
            filtro={filtroJerarquias}
            onFiltro={setFiltroJerarquias}
            placeholder="Filtrar jerarquía…"
            acciones={
              <Boton
                variante="primario"
                tamano="sm"
                onClick={refrescarTodosGrafos}
                disabled={refrescandoGrafo !== null || grafos.length === 0}
              >
                <RefreshCw className={`w-4 h-4 ${refrescandoGrafo === '__todos__' ? 'animate-spin' : ''}`} />
                {refrescandoGrafo === '__todos__' ? 'Refrescando…' : `Refrescar todos (${grafos.length})`}
              </Boton>
            }
          />

          <p className="text-sm text-texto-muted mb-4">
            Refresca la closure table (grafo desnormalizado) de cada jerarquía recomputándola desde la tabla origen.
            En operación normal el refresco se hace automáticamente al editar un nodo; este panel sirve para rebuild masivo si quedó desincronizada.
          </p>

          {cargandoGrafos ? (
            <p className="text-sm text-texto-muted">Cargando grafos…</p>
          ) : grafosFiltrados.length === 0 ? (
            <p className="text-sm text-texto-muted">
              {filtroJerarquias ? `Sin resultados para "${filtroJerarquias}".` : 'No hay jerarquías registradas.'}
            </p>
          ) : (
            <div className="border border-borde rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gris-fondo border-b border-borde">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Jerarquía</th>
                    <th className="px-3 py-2 font-medium">Tabla origen</th>
                    <th className="px-3 py-2 font-medium text-right">Nodos</th>
                    <th className="px-3 py-2 font-medium text-right">Pares</th>
                    <th className="px-3 py-2 font-medium text-right">Máx. profundidad</th>
                    <th className="px-3 py-2 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {grafosFiltrados.map((g) => (
                    <tr key={g.tabla} className="border-b border-borde last:border-b-0 hover:bg-gris-fondo">
                      <td className="px-3 py-2 font-medium">{g.nombre}</td>
                      <td className="px-3 py-2 text-xs text-texto-muted">
                        <code>{g.tabla}</code> → <code>{g.grafo}</code>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.nodos}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.pares}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.max_profundidad}</td>
                      <td className="px-3 py-2 text-right">
                        <Boton
                          variante="contorno"
                          tamano="sm"
                          onClick={() => refrescarGrafo(g.tabla)}
                          disabled={refrescandoGrafo !== null}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${refrescandoGrafo === g.tabla ? 'animate-spin' : ''}`} />
                          {refrescandoGrafo === g.tabla ? 'Refrescando…' : 'Refrescar'}
                        </Boton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: APIs ── */}
      {tab === 'apis' && (
        <div>
          <BarraHerramientas
            filtro={filtroApis}
            onFiltro={setFiltroApis}
            placeholder="Filtrar endpoint…"
            acciones={
              <Boton variante="primario" tamano="sm" onClick={regenerarApis} disabled={regenerandoApis}>
                <Zap className="w-4 h-4" /> {regenerandoApis ? 'Regenerando…' : 'Regenerar APIs'}
              </Boton>
            }
          />

          <p className="text-sm text-texto-muted">
            Regenera la tabla <code>api_endpoints</code> desde la vista <code>v_funcion_api</code>. Los LLMs solo acceden vía esta tabla.
          </p>
        </div>
      )}

      {tab === 'grafo' && <TabGrafoFunciones />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Grafo Funciones — sincronización masiva del grafo de dependencias entre funciones
// ─────────────────────────────────────────────────────────────────────────────
function TabGrafoFunciones() {
  const [sincronizando, setSincronizando] = useState(false)
  const [resultado, setResultado] = useState<{
    arcos_totales: number
    arcos_nuevos: number
    docs_virtuales: string
    mensaje: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sincronizarTodas = async () => {
    if (sincronizando) return
    setSincronizando(true)
    setError(null)
    setResultado(null)
    try {
      const res = await funcionesApi.sincronizarTodas()
      setResultado(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-texto-muted">
            Recomputa los arcos de <code>rel_funcion_dependencia</code> de TODAS las funciones desde
            <code> api_endpoints.tabla_asociada</code> cruzado con FKs. No sobreescribe arcos con código manual
            (preserva <code>python_*</code>, <code>prompt_*</code>, <code>orden</code>). Además dispara la
            regeneración de los documentos virtuales del RAG en background. Solo super-admin.
          </p>
        </div>
        <Boton variante="primario" tamano="sm" onClick={sincronizarTodas} disabled={sincronizando}>
          {sincronizando
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sincronizando…</>
            : <><Workflow className="w-4 h-4" /> Sincronizar todas</>}
        </Boton>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {resultado && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-emerald-800">{resultado.mensaje}</p>
            <p className="text-emerald-700 mt-1">
              Arcos totales: <strong>{resultado.arcos_totales}</strong> · Nuevos: <strong>{resultado.arcos_nuevos}</strong>
              {' · '}Docs virtuales: <em>{resultado.docs_virtuales}</em>
            </p>
          </div>
        </div>
      )}

      <div className="text-xs text-texto-muted border-t border-borde pt-3">
        Para sincronizar UNA sola función, usa el botón <RefreshCw className="w-3 h-3 inline" /> en la tabla de <a className="text-primario hover:underline" href="/funciones">/funciones</a>,
        o el skill <code>/serverlm-actualizar-funcion CODIGO</code> conversando con Claude.
      </div>
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
