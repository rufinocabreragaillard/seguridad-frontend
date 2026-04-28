'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Brain, RefreshCw, Upload, Zap, Languages, Globe,
  AlertCircle, CheckCircle2, Code2, FileText, Play, ChevronDown, ChevronUp, Search,
  Network, Workflow, Eye,
} from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import {
  promptsApi, traduccionesApi, funcionesApi, jerarquiasApi,
  type EstadoPrompts, type TablaConteoPrompts, type GrafoJerarquia,
} from '@/lib/api'
import type { EstadoTraducciones, Funcion } from '@/lib/tipos'
import ES_MESSAGES from '../../../../messages/es.json'

type Tab = 'prompts' | 'codigo' | 'vistas' | 'mensajes' | 'traducciones' | 'apis' | 'jerarquias' | 'grafo'

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
  const t = useTranslations('prompts')
  const tc = useTranslations('common')

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'prompts',      label: t('tabPrompts'),      icon: <Brain className="w-4 h-4" /> },
    { id: 'codigo',       label: t('tabCodigoMd'),     icon: <Code2 className="w-4 h-4" /> },
    { id: 'vistas',       label: t('tabVistasChat'),   icon: <Eye className="w-4 h-4" /> },
    { id: 'mensajes',     label: t('tabMensajesUi'),   icon: <Languages className="w-4 h-4" /> },
    { id: 'traducciones', label: t('tabTraducciones'), icon: <Languages className="w-4 h-4" /> },
    { id: 'apis',         label: t('tabApis'),         icon: <Globe className="w-4 h-4" /> },
    { id: 'jerarquias',   label: t('tabJerarquias'),   icon: <Network className="w-4 h-4" /> },
    { id: 'grafo',        label: t('tabGrafoFunciones'), icon: <Workflow className="w-4 h-4" /> },
  ]

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

  // Vistas del chat (sección masiva)
  const [resumenVistas, setResumenVistas] = useState<{
    total: number
    con_prompt_view: number
    con_sql_view: number
    pendientes_sync: number
  } | null>(null)
  const [cargandoVistas, setCargandoVistas] = useState(false)
  const [filtroVistas, setFiltroVistas] = useState('')
  const [genVistasProgress, setGenVistasProgress] = useState<{
    modo: 'gen' | 'sync' | null
    actual: number
    total: number
    errores: { codigo: string; error: string }[]
    terminado: boolean
  }>({ modo: null, actual: 0, total: 0, errores: [], terminado: false })
  const abortVistasRef = useRef(false)

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
      setMensaje({ tipo: 'ok', texto: t('grafoRefrescadoOk', { tabla, filas: r.filas }) })
      cargarGrafos()
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || tc('error') })
    } finally { setRefrescandoGrafo(null) }
  }

  async function refrescarTodosGrafos() {
    setRefrescandoGrafo('__todos__')
    setMensaje(null)
    try {
      const r = await jerarquiasApi.refrescarTodos()
      const ok = r.resultados.filter((x) => x.ok).length
      const ko = r.resultados.length - ok
      const baseMsg = t('jerarquiasRefrescadas', { ok, total: r.resultados.length })
      const errMsg = ko ? ` ${t('erroresEnTablas', { tablas: r.resultados.filter((x) => !x.ok).map((x) => x.tabla).join(', ') })}` : ''
      setMensaje({
        tipo: ko === 0 ? 'ok' : 'error',
        texto: baseMsg + errMsg,
      })
      cargarGrafos()
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || tc('error') })
    } finally { setRefrescandoGrafo(null) }
  }

  useEffect(() => {
    if (tab === 'jerarquias' && grafos.length === 0) cargarGrafos()
  }, [tab, grafos.length, cargarGrafos])

  const cargarResumenVistas = useCallback(async () => {
    setCargandoVistas(true)
    try {
      setResumenVistas(await funcionesApi.resumenVistas())
    } catch { setResumenVistas(null) }
    finally { setCargandoVistas(false) }
  }, [])

  useEffect(() => {
    if (tab === 'vistas' && resumenVistas === null) cargarResumenVistas()
  }, [tab, resumenVistas, cargarResumenVistas])

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
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || tc('error') })
    } finally {
      setSincronizando(null)
    }
  }

  async function regenerarApis() {
    setRegenerandoApis(true)
    setMensaje(null)
    try {
      const res = await promptsApi.regenerarApis()
      setMensaje({ tipo: 'ok', texto: t('apisRegeneradasOk', { upserted: res.upserted, total: res.total_vista }) })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || tc('error') })
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
        errores.push({ codigo: f.codigo_funcion, error: err?.response?.data?.detail || err?.message || tc('error') })
      }
    }
    setGenProgress((p) => ({ ...p, terminado: true, errores }))
    const tituloModo = modo === 'md' ? t('modoGenerarMd') : modo === 'insert' ? t('modoPythonInsert') : t('modoPythonUpdate')
    setMensaje({
      tipo: errores.length === 0 ? 'ok' : 'error',
      texto: t('resultadoMasivo', { modo: tituloModo, ok, errores: errores.length }),
    })
    cargarFunciones()
  }

  function detenerGeneracion() {
    abortGenRef.current = true
  }

  async function vistasMasivo(modo: 'gen' | 'sync') {
    abortVistasRef.current = false
    setMensaje(null)
    let lista: { codigo_funcion: string }[] = []
    try {
      const filtro = modo === 'gen' ? 'con_prompt_view' : 'pendientes_sync'
      const r = await funcionesApi.listarCodigosVistas(filtro)
      lista = r.codigos.filter((c) =>
        filtroVistas === '' || c.codigo_funcion.toLowerCase().includes(filtroVistas.toLowerCase()),
      )
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || t('errorObteniendoLista') })
      return
    }
    setGenVistasProgress({ modo, actual: 0, total: lista.length, errores: [], terminado: false })
    let ok = 0
    const errores: { codigo: string; error: string }[] = []
    for (let i = 0; i < lista.length; i++) {
      if (abortVistasRef.current) break
      const f = lista[i]
      setGenVistasProgress((p) => ({ ...p, actual: i + 1 }))
      try {
        if (modo === 'gen') await funcionesApi.generarVista(f.codigo_funcion)
        else await funcionesApi.sincronizarVista(f.codigo_funcion)
        ok++
      } catch (e: unknown) {
        const err = e as { message?: string; response?: { data?: { detail?: string } } }
        errores.push({ codigo: f.codigo_funcion, error: err?.response?.data?.detail || err?.message || tc('error') })
      }
    }
    setGenVistasProgress((p) => ({ ...p, terminado: true, errores }))
    const tituloModo = modo === 'gen' ? t('modoGenerarVistas') : t('modoSincronizarVistas')
    setMensaje({
      tipo: errores.length === 0 ? 'ok' : 'error',
      texto: t('resultadoMasivo', { modo: tituloModo, ok, errores: errores.length }),
    })
    cargarResumenVistas()
  }

  function detenerVistas() {
    abortVistasRef.current = true
  }

  async function generarMensajesUi() {
    setGenerandoMensajes(true)
    setMensajesUiResultado(null)
    setMensaje(null)
    try {
      const resultado = await traduccionesApi.generarMensajesUi(ES_MESSAGES)
      setMensajesUiResultado(resultado)
      const idiomas = Object.keys(resultado)
      setMensaje({ tipo: 'ok', texto: t('mensajesGeneradosOk', { idiomas: idiomas.join(', ') }) })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || t('errorGenerarMensajes') })
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
        <Brain /> {t('titulo')}
      </h2>

      {/* Pestañas */}
      <div className="border-b border-borde">
        <nav className="flex gap-0" aria-label={t('tabsAriaLabel')}>
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
            placeholder={t('filtrarTabla')}
            acciones={
              <>
                <Boton variante="contorno" tamano="sm" onClick={cargar} disabled={cargando}>
                  <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> {t('refrescar')}
                </Boton>
                <Boton
                  variante="primario"
                  tamano="sm"
                  onClick={sincronizarTodo}
                  disabled={sincronizando !== null || tablasConPendientes.length === 0}
                >
                  <Upload className="w-4 h-4" /> {t('sincronizarPendientes', { total: tablasConPendientes.length })}
                </Boton>
              </>
            }
          />

          {cargando && <p className="text-sm text-texto-muted">{t('cargandoEstado')}</p>}

          {!cargando && estado && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-borde">
                  <tr>
                    <th className="text-left py-2 px-2">{t('colTabla')}</th>
                    <th className="text-right py-2 px-2">{t('colTotalFilas')}</th>
                    <th className="text-right py-2 px-2">{t('colConPrompt')}</th>
                    <th className="text-right py-2 px-2">{t('colPendientesSync')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tablasFiltradas.map((row: TablaConteoPrompts) => (
                    <tr key={row.tabla} className="border-b border-borde/50 hover:bg-gris-fondo/50">
                      <td className="py-2 px-2 font-mono text-xs">{row.tabla}</td>
                      <td className="py-2 px-2 text-right">{row.total_filas ?? '—'}</td>
                      <td className="py-2 px-2 text-right">{row.con_prompt ?? '—'}</td>
                      <td className="py-2 px-2 text-right">
                        {(row.pendientes_sync ?? 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                            {row.pendientes_sync}
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
                        {t('sinResultadosFiltro', { filtro: filtroTabla })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="text-xs text-texto-muted mt-2">
                {t('totalPendientes')}: <strong>{estado.total_pendientes_sync}</strong>
                {filtroTabla && ` · ${t('mostrandoTablas', { mostradas: tablasFiltradas.length, total: estado.tablas.length })}`}
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
            placeholder={t('filtrarFuncion')}
            acciones={
              <>
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => generarMasivo('insert')}
                  disabled={generandoMasivo || cargandoFunciones || insertFiltradas.length === 0}
                >
                  <Play className="w-4 h-4 text-green-600" /> {t('pythonInsertConTotal', { total: insertFiltradas.length })}
                </Boton>
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => generarMasivo('update')}
                  disabled={generandoMasivo || cargandoFunciones || updateFiltradas.length === 0}
                >
                  <Play className="w-4 h-4 text-blue-600" /> {t('pythonUpdateConTotal', { total: updateFiltradas.length })}
                </Boton>
                <Boton
                  variante="primario"
                  tamano="sm"
                  onClick={() => generarMasivo('md')}
                  disabled={generandoMasivo || cargandoFunciones || mdFiltradas.length === 0}
                >
                  <FileText className="w-4 h-4" /> {t('generarMdConTotal', { total: mdFiltradas.length })}
                </Boton>
                {generandoMasivo && (
                  <Boton variante="contorno" tamano="sm" onClick={detenerGeneracion}>
                    {t('detener')}
                  </Boton>
                )}
              </>
            }
          />

          {generandoMasivo && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  {genProgress.modo === 'insert' ? t('generandoPythonInsert') :
                   genProgress.modo === 'update' ? t('generandoPythonUpdate') : t('generandoMd')}{' '}
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
            {cargandoFunciones ? t('cargandoFunciones') : t('funcionesTotales', { total: funciones.length })}
            {filtroCodigo && ` · ${t('filtroActivoFunciones', { mostradas: mdFiltradas.length })}`}
          </p>
        </div>
      )}

      {/* ── Tab: Vistas chat ── */}
      {tab === 'vistas' && (() => {
        const generandoVistas = genVistasProgress.modo !== null && !genVistasProgress.terminado
        return (
          <div>
            <BarraHerramientas
              filtro={filtroVistas}
              onFiltro={setFiltroVistas}
              placeholder={t('filtrarFuncion')}
              acciones={
                <>
                  <Boton variante="contorno" tamano="sm" onClick={cargarResumenVistas} disabled={cargandoVistas || generandoVistas}>
                    <RefreshCw className={`w-4 h-4 ${cargandoVistas ? 'animate-spin' : ''}`} /> {t('refrescar')}
                  </Boton>
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => vistasMasivo('gen')}
                    disabled={generandoVistas || cargandoVistas || (resumenVistas?.con_prompt_view ?? 0) === 0}
                  >
                    <Play className="w-4 h-4 text-green-600" /> {t('generarSqlConTotal', { total: resumenVistas?.con_prompt_view ?? 0 })}
                  </Boton>
                  <Boton
                    variante="primario"
                    tamano="sm"
                    onClick={() => vistasMasivo('sync')}
                    disabled={generandoVistas || cargandoVistas || (resumenVistas?.pendientes_sync ?? 0) === 0}
                  >
                    <Upload className="w-4 h-4" /> {t('sincronizarPendientes', { total: resumenVistas?.pendientes_sync ?? 0 })}
                  </Boton>
                  {generandoVistas && (
                    <Boton variante="contorno" tamano="sm" onClick={detenerVistas}>
                      {t('detener')}
                    </Boton>
                  )}
                </>
              }
            />

            {generandoVistas && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">
                    {genVistasProgress.modo === 'gen' ? t('generandoSqlVistas') : t('sincronizandoVistas')}{' '}
                    — {genVistasProgress.actual} / {genVistasProgress.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${genVistasProgress.total > 0 ? (genVistasProgress.actual / genVistasProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {genVistasProgress.terminado && genVistasProgress.errores.length > 0 && (
              <ErroresGeneracion errores={genVistasProgress.errores} />
            )}

            {cargandoVistas && <p className="text-sm text-texto-muted">{t('cargandoEstadoVistas')}</p>}

            {!cargandoVistas && resumenVistas && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-borde">
                    <tr>
                      <th className="text-left py-2 px-2">{t('colIndicador')}</th>
                      <th className="text-right py-2 px-2">{t('colCantidad')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-borde/50">
                      <td className="py-2 px-2">{t('vistasFuncionesTotales')}</td>
                      <td className="py-2 px-2 text-right">{resumenVistas.total}</td>
                    </tr>
                    <tr className="border-b border-borde/50">
                      <td className="py-2 px-2">{t('vistasConPromptView')} <code>prompt_view</code> ({t('vistasElegiblesGenerar')})</td>
                      <td className="py-2 px-2 text-right">{resumenVistas.con_prompt_view}</td>
                    </tr>
                    <tr className="border-b border-borde/50">
                      <td className="py-2 px-2">{t('vistasConSqlView')} <code>sql_view</code> ({t('vistasGeneradas')})</td>
                      <td className="py-2 px-2 text-right">{resumenVistas.con_sql_view}</td>
                    </tr>
                    <tr className="border-b border-borde/50">
                      <td className="py-2 px-2">{t('vistasPendientesSyncBd')}</td>
                      <td className="py-2 px-2 text-right">
                        {resumenVistas.pendientes_sync > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                            {resumenVistas.pendientes_sync}
                          </span>
                        ) : (
                          <span className="text-texto-muted">0</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-texto-muted mt-2">
                  <strong>{t('vistasGenerarSql')}</strong>: {t('vistasGenerarSqlDesc')}
                  {' '}<strong>{t('vistasSincronizar')}</strong>: {t('vistasSincronizarDesc')}
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Tab: Mensajes UI ── */}
      {tab === 'mensajes' && (
        <div>
          <BarraHerramientas
            filtro={filtroMensajes}
            onFiltro={setFiltroMensajes}
            placeholder={t('filtrarIdioma')}
            acciones={
              <Boton variante="primario" tamano="sm" onClick={generarMensajesUi} disabled={generandoMensajes}>
                <Languages className="w-4 h-4" />
                {generandoMensajes ? t('generando') : t('generarMensajesUi')}
              </Boton>
            }
          />

          <p className="text-sm text-texto-muted mb-4">
            {t('mensajesUiDesc1')} <code>messages/*.json</code> {t('mensajesUiDesc2')} <code>frontend/messages/</code> {t('mensajesUiDesc3')}
          </p>

          {mensajesUiResultado && (
            <div>
              <p className="text-sm font-medium mb-2">{t('descargarArchivosGenerados')}</p>
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
                  <p className="text-sm text-texto-muted">{t('sinResultadosFiltro', { filtro: filtroMensajes })}</p>
                )}
              </div>
              <p className="text-xs text-texto-muted mt-2">
                {t('reemplazaArchivos1')} <code>frontend/messages/</code> {t('reemplazaArchivos2')}
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
            placeholder={t('filtrarCatalogo')}
            acciones={
              <a href="/traducciones" className="text-primario text-sm underline whitespace-nowrap">
                {t('irPanelCompleto')}
              </a>
            }
          />

          <p className="text-sm text-texto-muted">
            {estadoTrad ? (
              <>
                {t('ultimaGeneracion')}: <strong>{estadoTrad.ultima_generacion ? new Date(estadoTrad.ultima_generacion).toLocaleString('es-CL') : '—'}</strong>.{' '}
                {t('pendiente')}: <strong>{estadoTrad.pendiente ? tc('si') : tc('no')}</strong>.
              </>
            ) : (
              t('cargandoEstado')
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
            placeholder={t('filtrarJerarquia')}
            acciones={
              <Boton
                variante="primario"
                tamano="sm"
                onClick={refrescarTodosGrafos}
                disabled={refrescandoGrafo !== null || grafos.length === 0}
              >
                <RefreshCw className={`w-4 h-4 ${refrescandoGrafo === '__todos__' ? 'animate-spin' : ''}`} />
                {refrescandoGrafo === '__todos__' ? t('refrescando') : t('refrescarTodos', { total: grafos.length })}
              </Boton>
            }
          />

          <p className="text-sm text-texto-muted mb-4">
            {t('jerarquiasDesc')}
          </p>

          {cargandoGrafos ? (
            <p className="text-sm text-texto-muted">{t('cargandoGrafos')}</p>
          ) : grafosFiltrados.length === 0 ? (
            <p className="text-sm text-texto-muted">
              {filtroJerarquias ? t('sinResultadosFiltro', { filtro: filtroJerarquias }) : t('sinJerarquias')}
            </p>
          ) : (
            <div className="border border-borde rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gris-fondo border-b border-borde">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">{t('colJerarquia')}</th>
                    <th className="px-3 py-2 font-medium">{t('colTablaOrigen')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('colNodos')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('colPares')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('colMaxProfundidad')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('colAccion')}</th>
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
                          {refrescandoGrafo === g.tabla ? t('refrescando') : t('refrescar')}
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
            placeholder={t('filtrarEndpoint')}
            acciones={
              <Boton variante="primario" tamano="sm" onClick={regenerarApis} disabled={regenerandoApis}>
                <Zap className="w-4 h-4" /> {regenerandoApis ? t('regenerando') : t('regenerarApis')}
              </Boton>
            }
          />

          <p className="text-sm text-texto-muted">
            {t('apisDesc1')} <code>api_endpoints</code> {t('apisDesc2')} <code>v_funcion_api</code>{t('apisDesc3')}
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
  const t = useTranslations('prompts')
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
      setError(e instanceof Error ? e.message : t('errorDesconocido'))
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-texto-muted">
            {t('grafoDesc1')} <code>rel_funcion_dependencia</code> {t('grafoDesc2')}
            <code> api_endpoints.tabla_asociada</code> {t('grafoDesc3')}
            <code>python_*</code>, <code>prompt_*</code>, <code>orden</code>{t('grafoDesc4')}
          </p>
        </div>
        <Boton variante="primario" tamano="sm" onClick={sincronizarTodas} disabled={sincronizando}>
          {sincronizando
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t('sincronizando')}</>
            : <><Workflow className="w-4 h-4" /> {t('sincronizarTodas')}</>}
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
              {t('arcosTotales')}: <strong>{resultado.arcos_totales}</strong> · {t('nuevos')}: <strong>{resultado.arcos_nuevos}</strong>
              {' · '}{t('docsVirtuales')}: <em>{resultado.docs_virtuales}</em>
            </p>
          </div>
        </div>
      )}

      <div className="text-xs text-texto-muted border-t border-borde pt-3">
        {t('grafoFooter1')} <RefreshCw className="w-3 h-3 inline" /> {t('grafoFooter2')} <a className="text-primario hover:underline" href="/funciones">/funciones</a>{t('grafoFooter3')} <code>/serverlm-actualizar-funcion CODIGO</code> {t('grafoFooter4')}
      </div>
    </div>
  )
}

function ErroresGeneracion({ errores }: { errores: { codigo: string; error: string }[] }) {
  const t = useTranslations('prompts')
  const [expandido, setExpandido] = useState(false)
  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <button
        className="flex items-center gap-2 text-sm font-medium text-amber-800 w-full"
        onClick={() => setExpandido((v) => !v)}
      >
        <AlertCircle className="w-4 h-4" />
        {t('erroresDuranteGeneracion', { total: errores.length })}
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
