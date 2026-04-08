'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Play, FileText, CheckCircle, XCircle, Loader2, FolderOpen, Clock, Square, Search, CheckSquare, SquareIcon, Trash2, AlertTriangle, ListOrdered, Cpu } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { documentosApi, registroLLMApi, ubicacionesDocsApi, colaEstadosDocsApi, estadosDocsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, RegistroLLM, ColaEstadoDoc, EstadoDoc } from '@/lib/tipos'
import { extraerTextoDeArchivo, abrirArchivoPorRuta } from '@/lib/extraer-texto'

import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle } from '@/lib/file-handle-store'

const ESTADO_COLA_CONFIG: Record<string, { variante: 'exito' | 'error' | 'advertencia' | 'neutro'; icono: typeof Clock }> = {
  PENDIENTE: { variante: 'neutro', icono: Clock },
  EN_PROCESO: { variante: 'advertencia', icono: Play },
  COMPLETADO: { variante: 'exito', icono: CheckCircle },
  ERROR: { variante: 'error', icono: AlertTriangle },
}

type Proceso = 'resumir' | 'escanear'
type Alcance = 'pendientes' | 'ubicacion'

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  ruta_completa: string
  nivel: number
}

interface ItemCola {
  id_cola: number
  codigo_documento: number
  nombre_documento: string
  ubicacion_documento?: string
  estado_cola: string
  resultado?: string | null
  tiempo_ms?: number
}

export default function PaginaProcesarDocumentos() {
  const { grupoActivo } = useAuth()

  // Tabs
  const [tab, setTab] = useState<'procesar' | 'cola'>('procesar')

  // Config
  const [proceso, setProceso] = useState<Proceso>('resumir')
  const [alcance, setAlcance] = useState<Alcance>('pendientes')
  const [modelos, setModelos] = useState<RegistroLLM[]>([])
  const [modeloId, setModeloId] = useState<number>(0)
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
  const [ubicacionSel, setUbicacionSel] = useState('')

  // Documentos candidatos
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [yaCargado, setYaCargado] = useState(false)

  // Cola y ejecución
  const [cola, setCola] = useState<ItemCola[]>([])
  const [ejecutando, setEjecutando] = useState(false)
  const [procesados, setProcesados] = useState(0)
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [archivosEnDir, setArchivosEnDir] = useState<Set<string> | null>(null)
  const [escaneandoDir, setEscaneandoDir] = useState(false)
  const abortRef = useRef(false)

  // Tab Cola (datos persistidos)
  const [colaBackend, setColaBackend] = useState<ColaEstadoDoc[]>([])
  const [estadosDocs, setEstadosDocs] = useState<EstadoDoc[]>([])
  const [cargandoCola, setCargandoCola] = useState(false)
  const [busquedaCola, setBusquedaCola] = useState('')
  const [filtroEstadoCola, setFiltroEstadoCola] = useState('')
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<ColaEstadoDoc | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargarCola = useCallback(async () => {
    setCargandoCola(true)
    try {
      const [c, e] = await Promise.all([
        colaEstadosDocsApi.listar(),
        estadosDocsApi.listar(),
      ])
      setColaBackend(c)
      setEstadosDocs(e)
    } finally {
      setCargandoCola(false)
    }
  }, [])

  useEffect(() => { if (tab === 'cola') cargarCola() }, [tab, cargarCola])

  const nombreEstadoDoc = (codigo: string | null | undefined) =>
    codigo ? (estadosDocs.find((e) => e.codigo_estado_doc === codigo)?.nombre_estado || codigo) : '—'

  const completadosCola = useMemo(() => colaBackend.filter((c) => c.estado_cola === 'COMPLETADO').length, [colaBackend])

  const colaFiltrada = useMemo(() => colaBackend.filter((c) => {
    if (filtroEstadoCola && c.estado_cola !== filtroEstadoCola) return false
    if (busquedaCola) {
      const nombre = c.documentos?.nombre_documento || ''
      return (
        nombre.toLowerCase().includes(busquedaCola.toLowerCase()) ||
        String(c.codigo_documento).includes(busquedaCola) ||
        c.codigo_estado_doc_destino.toLowerCase().includes(busquedaCola.toLowerCase())
      )
    }
    return true
  }), [colaBackend, filtroEstadoCola, busquedaCola])

  const ejecutarCerrarCola = async () => {
    setCerrando(true)
    try {
      await colaEstadosDocsApi.cerrar()
      setConfirmCerrar(false)
      cargarCola()
    } finally {
      setCerrando(false)
    }
  }

  const ejecutarEliminarItem = async () => {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await colaEstadosDocsApi.eliminar(confirmEliminar.id_cola)
      setConfirmEliminar(null)
      cargarCola()
    } finally {
      setEliminando(false)
    }
  }

  // Cargar modelos y ubicaciones
  useEffect(() => {
    const init = async () => {
      const [m, u] = await Promise.all([
        registroLLMApi.listar(),
        ubicacionesDocsApi.listar().catch(() => []),
      ])
      const activos = m.filter((x) => x.activo && x.estado_valido)
      setModelos(activos)
      if (activos.length > 0) setModeloId(activos[0].id_modelo)
      setUbicaciones(
        (u as UbicacionOption[])
          .filter((x: UbicacionOption) => (x as UbicacionOption & { activo?: boolean }).activo !== false)
          .sort((a: UbicacionOption, b: UbicacionOption) => (a.ruta_completa || '').localeCompare(b.ruta_completa || ''))
      )
    }
    init()
  }, [])

  // Restaurar dirHandle persistido al entrar
  useEffect(() => {
    (async () => {
      const h = await idbGetHandle()
      if (!h) return
      try {
        // Verificar permisos; si los perdió, ignorar (el usuario re-pickeará manualmente)
        const perm = await (h as unknown as { queryPermission: (opts: { mode: string }) => Promise<PermissionState> }).queryPermission({ mode: 'read' })
        if (perm !== 'granted') return
        setDirHandle(h)
        setEscaneandoDir(true)
        try {
          const archivos = await escanearDirectorio(h)
          setArchivosEnDir(archivos)
        } finally {
          setEscaneandoDir(false)
        }
        cargarDocumentos()
      } catch { /* ignore */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cargar documentos candidatos
  const cargarDocumentos = useCallback(async () => {
    setCargando(true)
    try {
      const estadoFiltro = proceso === 'resumir' ? 'CARGADO' : 'RESUMIDO'
      const todos = await documentosApi.listar({
        codigo_estado_doc: estadoFiltro,
        activo: true,
        q: busqueda.trim() || undefined,
      })
      let filtrados = todos

      if (alcance === 'ubicacion' && ubicacionSel) {
        const ubic = ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)
        if (ubic?.ruta_completa) {
          filtrados = filtrados.filter((d) => d.ubicacion_documento?.includes(ubic.ruta_completa))
        }
      }

      setDocumentos(filtrados)
      setSeleccionados(new Set(filtrados.map((d) => d.codigo_documento)))
      setCola([])
      setYaCargado(true)
    } finally {
      setCargando(false)
    }
  }, [proceso, alcance, ubicacionSel, ubicaciones, busqueda])

  // Resetear lista cuando cambian filtros de proceso/alcance/ubicación.
  // Si el alcance es "pendientes" (no requiere filtro adicional), autocargamos
  // para que el usuario vea inmediatamente todos los documentos pendientes
  // sin tener que presionar "Listar". Para "ubicacion" esperamos a que el
  // usuario elija una y presione Listar.
  // Nota: a proposito NO incluimos `busqueda` en las deps; eso lo maneja el
  // boton/Enter del filtro para no re-cargar con cada tecla.
  useEffect(() => {
    setDocumentos([])
    setSeleccionados(new Set())
    setYaCargado(false)
    if (alcance === 'pendientes') {
      cargarDocumentos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proceso, alcance, ubicacionSel])

  const toggleSeleccion = (id: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const docsFiltrados = documentos.filter((d) => {
    if (archivosEnDir && !archivosEnDir.has(d.nombre_documento)) return false
    if (busqueda && !d.nombre_documento.toLowerCase().includes(busqueda.toLowerCase()) &&
        !(d.ubicacion_documento || '').toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  // Cuando se escanea un directorio, marcar automáticamente los documentos encontrados
  useEffect(() => {
    if (archivosEnDir) {
      const ids = documentos.filter((d) => archivosEnDir.has(d.nombre_documento)).map((d) => d.codigo_documento)
      setSeleccionados(new Set(ids))
    }
  }, [archivosEnDir, documentos])

  const seleccionarTodos = () => setSeleccionados(new Set(docsFiltrados.map((d) => d.codigo_documento)))
  const deseleccionarTodos = () => setSeleccionados(new Set())

  const escanearDirectorio = async (handle: FileSystemDirectoryHandle): Promise<Set<string>> => {
    const archivos = new Set<string>()
    const walk = async (dir: FileSystemDirectoryHandle) => {
      // @ts-expect-error - values() is FileSystemDirectoryHandle iterator
      for await (const entry of dir.values()) {
        if (entry.kind === 'file') archivos.add(entry.name)
        else if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle)
      }
    }
    await walk(handle)
    return archivos
  }

  const seleccionarDirectorio = async () => {
    try {
      const opts: Record<string, unknown> = { mode: 'read', id: 'cab-procesar-docs' }
      if (dirHandle) opts.startIn = dirHandle
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker(opts)
      setDirHandle(handle)
      idbSetHandle(handle)
      setEscaneandoDir(true)
      try {
        const archivos = await escanearDirectorio(handle)
        setArchivosEnDir(archivos)
      } finally {
        setEscaneandoDir(false)
      }
      cargarDocumentos()
    } catch { /* cancelado */ }
  }

  const limpiarDirectorio = () => {
    setDirHandle(null)
    setArchivosEnDir(null)
    idbSetHandle(null)
  }

  // Ejecutar: encolar + procesar
  const ejecutar = async () => {
    if (!modeloId || seleccionados.size === 0) return

    // Feedback inmediato: bloquear UI y mostrar estado de encolado
    setEjecutando(true)
    setProcesados(0)
    setCola([])
    abortRef.current = false

    const estadoDestino = proceso === 'resumir' ? 'RESUMIDO' : 'ESCANEADO'

    // 1. Encolar en cola_estados_docs
    const items = Array.from(seleccionados).map((id) => ({
      codigo_documento: id,
      codigo_estado_doc_destino: estadoDestino,
    }))

    let encoladosRes
    try {
      encoladosRes = await colaEstadosDocsApi.inicializar(items)
    } catch {
      setEjecutando(false)
      return
    }

    if (encoladosRes.encolados === 0) {
      setEjecutando(false)
      return
    }

    // 2. Obtener ítems PENDIENTES de la cola
    const pendientes = await colaEstadosDocsApi.listar('PENDIENTE')
    const misCola = pendientes.filter((p) =>
      seleccionados.has(p.codigo_documento) && p.codigo_estado_doc_destino === estadoDestino
    )

    // Inicializar vista de cola
    const colaInicial: ItemCola[] = misCola.map((p) => {
      const doc = documentos.find((d) => d.codigo_documento === p.codigo_documento)
      return {
        id_cola: p.id_cola,
        codigo_documento: p.codigo_documento,
        nombre_documento: doc?.nombre_documento || `Doc #${p.codigo_documento}`,
        ubicacion_documento: doc?.ubicacion_documento || undefined,
        estado_cola: 'PENDIENTE',
      }
    })
    setCola(colaInicial)

    // 3. Procesar uno por uno
    for (let i = 0; i < colaInicial.length; i++) {
      if (abortRef.current) break
      const item = colaInicial[i]

      // Marcar procesando en UI
      setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'EN_PROCESO' } : c))

      try {
        let texto: string | undefined
        // Intentar extraer texto si hay directorio seleccionado (opcional)
        if (proceso === 'resumir' && dirHandle && item.ubicacion_documento) {
          try {
            const fileHandle = await abrirArchivoPorRuta(dirHandle, item.ubicacion_documento)
            if (fileHandle) {
              const contenido = await extraerTextoDeArchivo(fileHandle)
              if (contenido) texto = contenido
            }
          } catch { /* sin acceso al archivo, continúa solo con metadatos */ }
        }

        const res = await colaEstadosDocsApi.procesar(item.id_cola, modeloId, texto)

        setCola((prev) => prev.map((c, idx) => idx === i ? {
          ...c,
          estado_cola: res.estado_cola,
          resultado: res.resultado || undefined,
          tiempo_ms: res.tiempo_ms,
        } : c))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error'
        setCola((prev) => prev.map((c, idx) => idx === i ? {
          ...c, estado_cola: 'ERROR', resultado: msg,
        } : c))
      }

      setProcesados((p) => p + 1)
    }

    setEjecutando(false)
    // Refrescar candidatos: los procesados ya cambiaron de estado y no deben aparecer
    setCola([])
    cargarDocumentos()
  }

  const detener = () => { abortRef.current = true }

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'
  const okCount = cola.filter((c) => c.estado_cola === 'COMPLETADO').length
  const errCount = cola.filter((c) => c.estado_cola === 'ERROR').length

  const iconoEstado = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return <Clock size={16} className="text-texto-muted" />
      case 'EN_PROCESO': return <Loader2 size={16} className="animate-spin text-primario" />
      case 'COMPLETADO': return <CheckCircle size={16} className="text-exito" />
      case 'ERROR': return <XCircle size={16} className="text-error" />
      default: return null
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Procesamiento de Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">Ejecuta procesos LLM sobre documentos del grupo</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-borde">
        <button
          onClick={() => setTab('procesar')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'procesar' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          <Cpu size={15} />Procesar
        </button>
        <button
          onClick={() => setTab('cola')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'cola' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          <ListOrdered size={15} />Cola{colaBackend.length > 0 && ` (${colaBackend.length})`}
        </button>
      </div>

      {tab === 'procesar' && (<>
      {/* Configuración */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Proceso</label>
              <select value={proceso} onChange={(e) => setProceso(e.target.value as Proceso)} className={selectClass} disabled={ejecutando}>
                <option value="resumir">Resumir (CARGADO → RESUMIDO)</option>
                <option value="escanear">Escanear (RESUMIDO → ESCANEADO)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Alcance</label>
              <select value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)} className={selectClass} disabled={ejecutando}>
                <option value="pendientes">Todos los pendientes</option>
                <option value="ubicacion">Por ubicación</option>
              </select>
            </div>

            {alcance === 'ubicacion' ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Ubicación</label>
                <select value={ubicacionSel} onChange={(e) => setUbicacionSel(e.target.value)} className={selectClass} disabled={ejecutando}>
                  <option value="">Todas</option>
                  {ubicaciones.map((u) => (
                    <option key={u.codigo_ubicacion} value={u.codigo_ubicacion}>
                      {'—'.repeat(u.nivel || 0)} {u.nombre_ubicacion}
                    </option>
                  ))}
                </select>
              </div>
            ) : <div />}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Modelo LLM</label>
              <select value={modeloId} onChange={(e) => setModeloId(Number(e.target.value))} className={selectClass} disabled={ejecutando}>
                {modelos.map((m) => (
                  <option key={m.id_modelo} value={m.id_modelo}>{m.nombre_visible}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde flex-wrap">
            {proceso === 'resumir' && (
              <>
                <Boton variante="contorno" tamano="sm" onClick={seleccionarDirectorio} disabled={ejecutando || escaneandoDir}>
                  {escaneandoDir ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                  {escaneandoDir ? 'Escaneando...' : dirHandle ? `📂 ${dirHandle.name}` : 'Seleccionar directorio (opcional)'}
                </Boton>
                {dirHandle && !escaneandoDir && (
                  <Boton variante="contorno" tamano="sm" onClick={limpiarDirectorio} disabled={ejecutando}>
                    Quitar
                  </Boton>
                )}
              </>
            )}
            {proceso === 'resumir' && !dirHandle && (
              <span className="text-xs text-texto-muted">Sin directorio: resumen basado solo en metadatos</span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-texto-muted">
                {seleccionados.size}/{documentos.length} seleccionados{archivosEnDir && ` (filtrado por directorio)`}
              </span>
              <Boton variante="primario" onClick={ejecutar}
                disabled={ejecutando || seleccionados.size === 0 || !modeloId}>
                {ejecutando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {ejecutando ? 'Procesando...' : 'Ejecutar'}
              </Boton>
              <Boton variante="contorno" onClick={detener} disabled={!ejecutando}>
                <Square size={14} />Detener
              </Boton>
            </div>
          </div>
        </TarjetaContenido>
      </Tarjeta>

      {/* Progreso */}
      {cola.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2 bg-fondo rounded-full overflow-hidden">
              <div className="h-full bg-primario transition-all duration-300"
                style={{ width: `${cola.length > 0 ? (procesados / cola.length) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-texto-muted mt-1">{procesados}/{cola.length} procesados</p>
          </div>
          <div className="flex gap-3 text-sm">
            {okCount > 0 && <span className="text-exito flex items-center gap-1"><CheckCircle size={14} />{okCount}</span>}
            {errCount > 0 && <span className="text-error flex items-center gap-1"><XCircle size={14} />{errCount}</span>}
          </div>
        </div>
      )}

      {/* Cola de procesamiento (visible durante/después de ejecución) */}
      {cola.length > 0 && (
        <Tabla>
          <TablaCabecera>
            <tr>
              <TablaTh className="w-10">Estado</TablaTh>
              <TablaTh>Documento</TablaTh>
              <TablaTh>Resultado</TablaTh>
              <TablaTh className="w-20">Tiempo</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {cola.map((c) => (
              <TablaFila key={c.id_cola} className={c.estado_cola === 'COMPLETADO' ? 'bg-green-50/50' : c.estado_cola === 'ERROR' ? 'bg-red-50/50' : ''}>
                <TablaTd>{iconoEstado(c.estado_cola)}</TablaTd>
                <TablaTd>
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-texto-muted shrink-0" />
                    <span className="font-medium text-sm">{c.nombre_documento}</span>
                  </div>
                </TablaTd>
                <TablaTd>
                  <span className={`text-xs max-w-[400px] truncate block ${c.estado_cola === 'ERROR' ? 'text-error' : 'text-texto-muted'}`}>
                    {c.resultado || '—'}
                  </span>
                </TablaTd>
                <TablaTd className="text-xs text-texto-muted">{c.tiempo_ms ? `${c.tiempo_ms}ms` : '—'}</TablaTd>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      {/* Lista de documentos candidatos (visible antes de ejecución) */}
      {cola.length === 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm" onClick={seleccionarTodos} disabled={ejecutando || docsFiltrados.length === 0}>
                <CheckSquare size={14} />Todos
              </Boton>
              <Boton variante="contorno" tamano="sm" onClick={deseleccionarTodos} disabled={ejecutando || seleccionados.size === 0}>
                <SquareIcon size={14} />Ninguno
              </Boton>
            </div>
            <div className="max-w-sm flex-1">
              <Input
                placeholder="Filtrar y Enter (vacío = todos)..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') cargarDocumentos() }}
                icono={<Search size={15} />}
              />
            </div>
            <Boton variante="contorno" tamano="sm" onClick={cargarDocumentos} disabled={cargando}>
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}Listar
            </Boton>
          </div>
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh className="w-10" />
                <TablaTh>Documento</TablaTh>
                <TablaTh>Ubicación</TablaTh>
                <TablaTh>Estado</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>Cargando...</TablaTd></TablaFila>
              ) : docsFiltrados.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>
                  {!yaCargado
                    ? 'Escribe un filtro y presiona Enter (vacío = todos) o haz clic en Listar'
                    : documentos.length === 0
                    ? `No hay documentos en estado ${proceso === 'resumir' ? 'CARGADO' : 'RESUMIDO'}`
                    : 'Sin resultados para la búsqueda'}
                </TablaTd></TablaFila>
              ) : docsFiltrados.map((d) => (
                <TablaFila key={d.codigo_documento}>
                  <TablaTd>
                    <input type="checkbox" checked={seleccionados.has(d.codigo_documento)}
                      onChange={() => toggleSeleccion(d.codigo_documento)} className="rounded border-borde" />
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-texto-muted shrink-0" />
                      <span className="font-medium text-sm">{d.nombre_documento}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted max-w-[250px] truncate">{d.ubicacion_documento || '—'}</TablaTd>
                  <TablaTd>
                    <Insignia variante="advertencia">{d.codigo_estado_doc}</Insignia>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </>
      )}
      </>)}

      {tab === 'cola' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="max-w-sm flex-1">
              <Input
                placeholder="Buscar por documento o estado..."
                value={busquedaCola}
                onChange={(e) => setBusquedaCola(e.target.value)}
                icono={<Search size={15} />}
              />
            </div>
            <select
              className="rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario outline-none"
              value={filtroEstadoCola}
              onChange={(e) => setFiltroEstadoCola(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="COMPLETADO">Completado</option>
              <option value="ERROR">Error</option>
            </select>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" onClick={cargarCola} disabled={cargandoCola}>
                <Loader2 size={14} className={cargandoCola ? 'animate-spin' : ''} />Refrescar
              </Boton>
              <Boton variante="contorno" onClick={() => setConfirmCerrar(true)} disabled={completadosCola === 0}>
                <XCircle size={16} />Cerrar cola ({completadosCola})
              </Boton>
            </div>
          </div>

          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>ID</TablaTh>
                <TablaTh>Documento</TablaTh>
                <TablaTh>Origen</TablaTh>
                <TablaTh>Destino</TablaTh>
                <TablaTh>Estado</TablaTh>
                <TablaTh>Fecha</TablaTh>
                <TablaTh>Intentos</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargandoCola ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>Cargando...</TablaTd></TablaFila>
              ) : colaFiltrada.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>Cola vacía</TablaTd></TablaFila>
              ) : colaFiltrada.map((c) => {
                const cfg = ESTADO_COLA_CONFIG[c.estado_cola] || ESTADO_COLA_CONFIG.PENDIENTE
                const Icono = cfg.icono
                return (
                  <TablaFila key={c.id_cola}>
                    <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{c.id_cola}</code></TablaTd>
                    <TablaTd className="font-medium text-sm">{c.documentos?.nombre_documento || `Doc #${c.codigo_documento}`}</TablaTd>
                    <TablaTd className="text-sm text-texto-muted">{nombreEstadoDoc(c.codigo_estado_doc_origen)}</TablaTd>
                    <TablaTd className="text-sm font-medium">{nombreEstadoDoc(c.codigo_estado_doc_destino)}</TablaTd>
                    <TablaTd>
                      <Insignia variante={cfg.variante}>
                        <Icono size={12} className="mr-1" />
                        {c.estado_cola}
                      </Insignia>
                    </TablaTd>
                    <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                      {new Date(c.fecha_cola).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </TablaTd>
                    <TablaTd className="text-sm text-center">{c.intentos}/{c.max_intentos}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setConfirmEliminar(c)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TablaTd>
                  </TablaFila>
                )
              })}
            </TablaCuerpo>
          </Tabla>
        </>
      )}

      <ModalConfirmar
        abierto={confirmCerrar}
        alCerrar={() => setConfirmCerrar(false)}
        alConfirmar={ejecutarCerrarCola}
        titulo="Cerrar cola"
        mensaje={`¿Eliminar los ${completadosCola} ítem(s) completados de la cola?`}
        textoConfirmar="Eliminar completados"
        cargando={cerrando}
      />
      <ModalConfirmar
        abierto={!!confirmEliminar}
        alCerrar={() => setConfirmEliminar(null)}
        alConfirmar={ejecutarEliminarItem}
        titulo="Eliminar ítem de la cola"
        mensaje={confirmEliminar ? `¿Eliminar el ítem #${confirmEliminar.id_cola}?` : ''}
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </div>
  )
}
