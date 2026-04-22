'use client'

import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Play, FileText, CheckCircle, XCircle, Loader2, FolderOpen, Clock, Square, Search, Trash2, AlertTriangle, Eye, ExternalLink, X, ChevronDown, ChevronRight, Copy, Check, MapPin, Download } from 'lucide-react'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Modal } from '@/components/ui/modal'
import { documentosApi, ubicacionesDocsApi, colaEstadosDocsApi, procesosApi, parametrosApi } from '@/lib/api'
import { getEstadosDocs, getProcesosDocs } from '@/lib/catalogos'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, ColaEstadoDoc, EstadoDoc, CategoriaConCaracteristicasDocs } from '@/lib/tipos'
import { extraerTextoDeArchivo, abrirArchivoPorRuta, PdfProtegidoError, ArchivoNoEscaneable, NECESITA_OCR, type ExtraccionMixta } from '@/lib/extraer-texto'

import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle, ensureReadPermission } from '@/lib/file-handle-store'
import { abrirDocumento, descargarDocumento } from '@/lib/abrir-documento'
import { TabPipelineTodo } from './_components/tab-pipeline-todo'
import { ChatProcesar } from './_components/chat-procesar'
import { TabRevertir } from './_components/tab-revertir'
import { useColaRealtime } from '@/hooks/useColaRealtime'
import { BotonChat } from '@/components/ui/boton-chat'


/** Botón de acción con tooltip inferior */
function BotonAccion({ tooltip, onClick, className, children }: {
  tooltip: string
  onClick?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative group/tip">
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-50">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  )
}

/** Botón-link de acción con tooltip inferior */
function LinkAccion({ tooltip, href, className, children }: {
  tooltip: string
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative group/tip">
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-50">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  )
}

/** Botón copiar al portapapeles */
function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    })
  }
  return (
    <button onClick={copiar} className="shrink-0 p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Copiar">
      {copiado ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

const DOCS_POR_PAGINA_DEFAULT = 20

const ESTADO_COLA_CONFIG: Record<string, { variante: 'exito' | 'error' | 'advertencia' | 'neutro'; icono: typeof Clock }> = {
  PENDIENTE: { variante: 'neutro', icono: Clock },
  EN_PROCESO: { variante: 'advertencia', icono: Play },
  COMPLETADO: { variante: 'exito', icono: CheckCircle },
  ERROR: { variante: 'error', icono: AlertTriangle },
}

// Código especial fuera del catálogo: reset de docs en NO_ESCANEABLE/NO_ENCONTRADO.
const PROCESO_RESTABLECER = '__RESTABLECER__'
const PROCESO_RESETEAR_CARGADO = '__RESETEAR_CARGADO__'
type TabDetalle = 'datos' | 'resumen' | 'caracteristicas' | 'texto' | 'chunks'
const ESTADOS_CON_CHUNKS = new Set(['CHUNKEADO', 'VECTORIZADO'])
const ESTADOS_CON_TEXTO = new Set(['METADATA', 'ESCANEADO', 'CHUNKEADO', 'VECTORIZADO'])

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  ruta_completa: string
  nivel: number
  tipo_ubicacion?: 'AREA' | 'CONTENIDO'
  codigo_ubicacion_superior?: string
}

interface ItemCola {
  id_cola: number
  codigo_documento: number
  nombre_documento: string
  ubicacion_documento?: string
  estado_cola: string
  resultado?: string | null
  tiempo_ms?: number
  modelo_usado?: string | null
}

function PaginaProcesarDocumentosInterna() {
  const t = useTranslations('procesarDocumentos')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()
  const searchParams = useSearchParams()
  // Estado del doc desde el que viene el dashboard (ej. "METADATA")
  const estadoDesdeUrl = searchParams.get('estado')

  // Tabs
  const [tabPrincipal, setTabPrincipal] = useState<'procesar' | 'todo' | 'revertir'>('procesar')

  // Config
  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([])
  const [errorCargaInicial, setErrorCargaInicial] = useState(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [procesoSel, setProcesoSel] = useState<string>('')   // codigo_proceso del catálogo o PROCESO_RESTABLECER
  const [nParallelEdit, setNParallelEdit] = useState<number>(10)
  const [guardandoParalel, setGuardandoParalel] = useState(false)
  const [tope, setTope] = useState<string>('')  // vacío = sin tope (procesa todo)
  const [estadoFiltro, setEstadoFiltro] = useState<string>('')  // override de estado para la lista
  const [filtroLibre, setFiltroLibre] = useState<string>('')    // filtro libre de texto (nombre, ubicación, estado, comentarios)
  const [filtroLibreInput, setFiltroLibreInput] = useState<string>('')  // valor del input antes de confirmar
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicBusqueda, setUbicBusqueda] = useState('')
  const [ubicDropdownOpen, setUbicDropdownOpen] = useState(false)
  const [ubicExpandidos, setUbicExpandidos] = useState<Set<string>>(new Set())
  const ubicDropdownRef = useRef<HTMLDivElement>(null)

  // Proceso seleccionado (contiene estado_origen, estado_destino, id_modelo directamente).
  // Reemplaza el anterior pasoActual = p.pasos?.[0] (ya no hay pasos anidados).
  const pasoActual = useMemo(() => {
    if (procesoSel === PROCESO_RESTABLECER || procesoSel === PROCESO_RESETEAR_CARGADO) return null
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
    return p ?? null
  }, [procesos, procesoSel])

  // Sincronizar n_parallel con el proceso seleccionado
  useEffect(() => {
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
    if (p) setNParallelEdit(p.n_parallel ?? 10)
  }, [procesoSel, procesos])

  // ¿Este proceso usa LLM? Si tiene id_modelo en su paso, lo corre el worker backend.
  // Si no, es un paso client-side (ej. EXTRAER que usa dirHandle).
  const usaLLM = !!(pasoActual?.id_modelo)
  const esRestablecer = procesoSel === PROCESO_RESTABLECER
  const esResetearCargado = procesoSel === PROCESO_RESETEAR_CARGADO
  const esExtraer = pasoActual?.estado_destino === 'METADATA'

  // Documentos candidatos
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [yaCargado, setYaCargado] = useState(false)

  // Cola y ejecución
  const [cola, setCola] = useState<ItemCola[]>([])
  const [ejecutando, setEjecutando] = useState(false)
  const [chatAbierto, setChatAbierto] = useState(false)
  const [procesados, setProcesados] = useState(0)
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [archivosEnDir, setArchivosEnDir] = useState<Set<string> | null>(null)
  const [escaneandoDir, setEscaneandoDir] = useState(false)
  const [nivelesDirectorio, setNivelesDirectorio] = useState(5)
  const abortRef = useRef(false)
  const resolveColaRef = useRef<(() => void) | null>(null)

  // Realtime: notificación push cuando cambia la cola (reemplaza polling 3s)
  const handleColaChange = useCallback(() => {
    if (resolveColaRef.current) {
      resolveColaRef.current()
      resolveColaRef.current = null
    }
  }, [])
  const { suscribir: suscribirCola, desuscribir: desuscribirCola } = useColaRealtime(
    grupoActivo,
    handleColaChange,
  )

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

  // Confirmación para eliminar documento individual de la lista
  const [confirmEliminarDoc, setConfirmEliminarDoc] = useState<Documento | null>(null)
  const [eliminandoDoc, setEliminandoDoc] = useState(false)

  // Confirmación para eliminación en bloque de docs sin archivo en disco
  const [confirmEliminarBulkSinDisco, setConfirmEliminarBulkSinDisco] = useState(false)
  const [eliminandoBulkSinDisco, setEliminandoBulkSinDisco] = useState(false)

  // Paginación de lista de documentos (server-side para no-EXTRAER, client-side para EXTRAER)
  const [paginaDoc, setPaginaDoc] = useState(1)
  const [totalPaginasDoc, setTotalPaginasDoc] = useState(1)

  // Modal detalle documento (inline, reemplaza navegación a /documentos)
  const [docDetalle, setDocDetalle] = useState<Documento | null>(null)
  const [colaItemDetalle, setColaItemDetalle] = useState<ColaEstadoDoc | null>(null)
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('datos')
  const [categoriasConCaract, setCategoriasConCaract] = useState<CategoriaConCaracteristicasDocs[]>([])
  const [cargandoCaract, setCargandoCaract] = useState(false)
  const [chunksData, setChunksData] = useState<Awaited<ReturnType<typeof documentosApi.listarChunks>> | null>(null)
  const [cargandoChunks, setCargandoChunks] = useState(false)
  const [busquedaChunk, setBusquedaChunk] = useState('')
  const [busquedaChunkInput, setBusquedaChunkInput] = useState('')
  const [paginaChunk, setPaginaChunk] = useState(1)

  const cargarCola = useCallback(async () => {
    setCargandoCola(true)
    try {
      const [c, e] = await Promise.all([
        colaEstadosDocsApi.listar(),
        getEstadosDocs(),
      ])
      setColaBackend(c)
      setEstadosDocs(e)
    } finally {
      setCargandoCola(false)
    }
  }, [])

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

  // Cargar procesos (catálogo), ubicaciones y parámetro de niveles
  const cargarDatosIniciales = useCallback(async () => {
    setCargandoInicial(true)
    setErrorCargaInicial(false)
    try {
      const [procsRaw, u, nivelParam, estados] = await Promise.all([
        getProcesosDocs(),
        ubicacionesDocsApi.listar().catch(() => []),
        parametrosApi.obtenerValor('DOCUMENTOS', 'NIVELES_DIRECTORIO').catch(() => null),
        getEstadosDocs().catch(() => []),
      ])
      setEstadosDocs(estados as EstadoDoc[])
      if (nivelParam?.valor != null) {
        const n = parseInt(nivelParam.valor, 10)
        if (!isNaN(n) && n >= 0 && n <= 5) setNivelesDirectorio(n)
      }
      // Procesos de la categoría PROCESAR_DOCS, ordenados por `orden` (ya viene filtrado y ordenado del backend).
      const procs = (procsRaw || [])
        .filter((p: ProcesoCatalogo) => !!p.estado_destino)
        .sort((a: ProcesoCatalogo, b: ProcesoCatalogo) => (a.orden ?? 0) - (b.orden ?? 0))
      setProcesos(procs)

      // Si venimos del dashboard con ?estado=XXX, seleccionar el proceso cuyo
      // estado_origen coincide. Estados terminales → RESTABLECER.
      const TERMINALES = ['NO_ESCANEABLE', 'NO_ENCONTRADO']
      if (estadoDesdeUrl) {
        if (TERMINALES.includes(estadoDesdeUrl)) {
          setProcesoSel(PROCESO_RESTABLECER)
        } else {
          const match = procs.find((p: ProcesoCatalogo) => p.estado_origen === estadoDesdeUrl)
          if (match) setProcesoSel(match.codigo_proceso)
          else if (procs.length > 0) setProcesoSel(procs[0].codigo_proceso)
        }
      }

      setUbicaciones(
        (u as UbicacionOption[])
          .filter((x: UbicacionOption) => (x as UbicacionOption & { activo?: boolean }).activo !== false)
          .sort((a: UbicacionOption, b: UbicacionOption) => (a.ruta_completa || '').localeCompare(b.ruta_completa || ''))
      )
    } catch {
      setErrorCargaInicial(true)
    } finally {
      setCargandoInicial(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cargarDatosIniciales()
  }, [cargarDatosIniciales])

  // Click-outside para cerrar dropdown de ubicación
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ubicDropdownRef.current && !ubicDropdownRef.current.contains(e.target as Node)) {
        setUbicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
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

  // Cargar documentos candidatos (paginado server-side para procesos backend; all para EXTRAER)
  const cargarDocumentos = useCallback(async (pagina = 1) => {
    setCargando(true)
    try {
      const qBackend = busqueda.trim() || filtroLibre.trim() || undefined
      const rutaPrefijo = ubicacionSel
        ? ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)?.ruta_completa
        : undefined

      if (esExtraer || esRestablecer || esResetearCargado) {
        // EXTRAER necesita todos los docs para el matching con el filesystem.
        // RESTABLECER/RESETEAR también carga todo (son lotes pequeños de estados terminales).
        let todos: Documento[]
        if (esRestablecer) {
          const [a, b] = await Promise.all([
            documentosApi.listar({ codigo_estado_doc: 'NO_ESCANEABLE', activo: true, q: qBackend }),
            documentosApi.listar({ codigo_estado_doc: 'NO_ENCONTRADO', activo: true, q: qBackend }),
          ])
          todos = [...a, ...b]
        } else if (esResetearCargado) {
          todos = await documentosApi.listar({ activo: true, q: qBackend })
        } else {
          // EXTRAER
          const estadoOrigen = pasoActual?.estado_origen || 'CARGADO'
          todos = await documentosApi.listar({ codigo_estado_doc: estadoOrigen, activo: true, q: qBackend })
        }
        if (rutaPrefijo) {
          todos = todos.filter((d) => d.ubicacion_documento?.startsWith(rutaPrefijo))
        }
        setDocumentos(todos)
        setTotalDocs(todos.length)
        setTotalPaginasDoc(Math.max(1, Math.ceil(todos.length / DOCS_POR_PAGINA_DEFAULT)))
        setPaginaDoc(1)
      } else {
        // Procesos backend: paginación server-side real
        const estadoOrigen = estadoFiltro || pasoActual?.estado_origen || undefined
        const data = await documentosApi.listarPaginado({
          page: pagina,
          limit: DOCS_POR_PAGINA_DEFAULT,
          codigo_estado_doc: estadoOrigen,
          activo: true,
          q: qBackend,
          ruta_prefijo: rutaPrefijo,
        })
        setDocumentos(data.items || [])
        setTotalDocs(data.total)
        setTotalPaginasDoc(Math.max(1, Math.ceil(data.total / DOCS_POR_PAGINA_DEFAULT)))
        setPaginaDoc(pagina)
      }
      setCola([])
      setYaCargado(true)
    } finally {
      setCargando(false)
    }
  }, [procesoSel, esExtraer, esRestablecer, esResetearCargado, pasoActual, ubicacionSel, ubicaciones, busqueda, estadoFiltro, filtroLibre])

  // Resetear lista cuando cambian filtros de proceso/alcance/ubicación.
  // Si se seleccionó un estado explícito, auto-cargar inmediatamente.
  // Nota: a proposito NO incluimos `busqueda` en las deps; eso lo maneja el
  // boton/Enter del filtro para no re-cargar con cada tecla.
  useEffect(() => {
    setDocumentos([])
    setYaCargado(false)
    // Siempre recargar (sin proceso/estado mostramos todos los docs activos).
    cargarDocumentos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoSel, ubicacionSel, estadoFiltro, filtroLibre])

  // Separar en dos grupos: encontrados en disco y no encontrados.
  // Si no hay directorio escaneado, todos van al grupo "enDisco".
  const docsEnDisco = esExtraer && archivosEnDir
    ? documentos.filter((d) => archivosEnDir.has(d.nombre_documento))
    : documentos
  const docsSinDisco = esExtraer && archivosEnDir
    ? documentos.filter((d) => !archivosEnDir.has(d.nombre_documento))
    : []

  const escanearDirectorio = async (handle: FileSystemDirectoryHandle, maxNiveles: number = nivelesDirectorio): Promise<Set<string>> => {
    const archivos = new Set<string>()
    const walk = async (dir: FileSystemDirectoryHandle, nivel: number) => {
      // @ts-expect-error - values() is FileSystemDirectoryHandle iterator
      for await (const entry of dir.values()) {
        if (entry.kind === 'file') archivos.add(entry.name)
        else if (entry.kind === 'directory' && nivel < maxNiveles) await walk(entry as FileSystemDirectoryHandle, nivel + 1)
      }
    }
    await walk(handle, 0)
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

  // Ejecutar: rama por tipo de proceso
  //   - RESTABLECER: una llamada al backend, sin cola.
  //   - EXTRAER (destino METADATA): loop client-side que lee el archivo con
  //     dirHandle y sube el texto al backend (POST /documentos/{id}/texto).
  //   - Procesos con LLM (RESUMIR, ESCANEAR): encola + dispara worker backend
  const guardarNParallel = async () => {
    if (!procesoSel || procesoSel === PROCESO_RESTABLECER || procesoSel === PROCESO_RESETEAR_CARGADO) return
    setGuardandoParalel(true)
    try {
      const updated = await procesosApi.actualizar(procesoSel, { n_parallel: nParallelEdit })
      setProcesos((prev) => prev.map((p) => p.codigo_proceso === procesoSel ? { ...p, n_parallel: updated.n_parallel } : p))
    } finally {
      setGuardandoParalel(false)
    }
  }

  // ── Modal detalle de documento ──────────────────────────────────────────
  const cargarCaracteristicas = useCallback(async (idDocumento: number) => {
    setCargandoCaract(true)
    try {
      const data = await documentosApi.listarCaracteristicas(idDocumento)
      setCategoriasConCaract(data)
    } finally {
      setCargandoCaract(false)
    }
  }, [])

  const cargarChunksDetalle = useCallback(async (idDocumento: number, q?: string, page = 1) => {
    setCargandoChunks(true)
    try {
      const data = await documentosApi.listarChunks(idDocumento, { q: q || undefined, page, limit: 10 })
      setChunksData(data)
    } catch {
      setChunksData(null)
    } finally {
      setCargandoChunks(false)
    }
  }, [])

  const [textoDataDetalle, setTextoDataDetalle] = useState<Awaited<ReturnType<typeof documentosApi.obtenerTexto>> | null>(null)
  const [cargandoTextoDetalle, setCargandoTextoDetalle] = useState(false)
  const cargarTextoDetalle = useCallback(async (idDocumento: number) => {
    setCargandoTextoDetalle(true)
    try {
      const data = await documentosApi.obtenerTexto(idDocumento)
      setTextoDataDetalle(data)
    } catch {
      setTextoDataDetalle(null)
    } finally {
      setCargandoTextoDetalle(false)
    }
  }, [])

  const abrirDetalle = useCallback(async (d: Documento) => {
    setDocDetalle(d)
    setTabDetalle('datos')
    setCategoriasConCaract([])
    setChunksData(null)
    setTextoDataDetalle(null)
    setBusquedaChunk('')
    setBusquedaChunkInput('')
    setPaginaChunk(1)
    setColaItemDetalle(null)
    try {
      const itemsDoc = await colaEstadosDocsApi.porDocumento(d.codigo_documento)
      setColaItemDetalle(itemsDoc[0] ?? null)
    } catch { /* mostrar sin datos de cola */ }
    cargarCaracteristicas(d.codigo_documento)
  }, [cargarCaracteristicas])

  const abrirDocumentoLocal = (d: Documento) => abrirDocumento(d.ubicacion_documento)

  // Resuelve un Documento completo a partir de un ItemCola — busca en la lista
  // cargada; si no está, construye el mínimo viable para abrir el modal de
  // detalle (la carga de características/cola se hace vía API por código).
  const docDesdeCola = useCallback((c: ItemCola): Documento => {
    const existente = documentos.find((x) => x.codigo_documento === c.codigo_documento)
    if (existente) return existente
    return {
      codigo_documento: c.codigo_documento,
      codigo_grupo: grupoActivo || '',
      nombre_documento: c.nombre_documento,
      ubicacion_documento: c.ubicacion_documento ?? null,
      activo: true,
    } as Documento
  }, [documentos, grupoActivo])

  const abrirDetalleDesdeCola = useCallback((c: ItemCola) => {
    abrirDetalle(docDesdeCola(c))
  }, [abrirDetalle, docDesdeCola])

  const abrirArchivoDesdeCola = (c: ItemCola) => {
    const doc = documentos.find((x) => x.codigo_documento === c.codigo_documento)
    const ubic = doc?.ubicacion_documento ?? c.ubicacion_documento
    if (ubic) abrirDocumento(ubic)
  }

  const ejecutarEliminarDoc = async () => {
    if (!confirmEliminarDoc) return
    setEliminandoDoc(true)
    try {
      await documentosApi.desactivar(confirmEliminarDoc.codigo_documento)
      setDocumentos((prev) => prev.filter((d) => d.codigo_documento !== confirmEliminarDoc!.codigo_documento))
      setConfirmEliminarDoc(null)
    } finally {
      setEliminandoDoc(false)
    }
  }

  const ejecutarEliminarBulkSinDisco = async () => {
    const ids = docsSinDisco.map((d) => d.codigo_documento)
    if (ids.length === 0) return
    setEliminandoBulkSinDisco(true)
    try {
      const res = await documentosApi.eliminarBulk(ids)
      const eliminados = new Set(ids)
      setDocumentos((prev) => prev.filter((d) => !eliminados.has(d.codigo_documento)))
      setConfirmEliminarBulkSinDisco(false)
      if (res.eliminados === 0) alert('No se eliminó ningún documento (no pertenecen al grupo activo).')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Error al eliminar: ${msg}`)
    } finally {
      setEliminandoBulkSinDisco(false)
    }
  }

  //     con /cola-estados-docs/ejecutar + polling. El navegador ya no corre
  //     el loop LLM.
  const ejecutar = async () => {
    setEjecutando(true)
    setProcesados(0)
    setCola([])
    abortRef.current = false

    // ── RESETEAR A CARGADO ────────────────────────────────────────────────
    if (esResetearCargado) {
      try {
        const ids = docsEnDisco.map((d) => d.codigo_documento)
        const res = await documentosApi.resetearACargado(ids)
        setCola([{
          id_cola: 0,
          codigo_documento: 0,
          nombre_documento: `Reseteados a CARGADO: ${res.reseteados} documentos`,
          ubicacion_documento: undefined,
          estado_cola: 'COMPLETADO',
        }])
        setProcesados(res.reseteados)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al resetear'
        setCola([{ id_cola: 0, codigo_documento: 0, nombre_documento: msg, estado_cola: 'ERROR' }])
      }
      setEjecutando(false)
      cargarDocumentos()
      return
    }

    // ── RESTABLECER ───────────────────────────────────────────────────────
    if (esRestablecer) {
      try {
        const ids = docsEnDisco.map((d) => d.codigo_documento)
        const res = await documentosApi.restablecerEstado(ids)
        setCola([{
          id_cola: 0,
          codigo_documento: 0,
          nombre_documento: `Restablecidos: ${res.restablecidos} (${res.a_cargado} a CARGADO, ${res.a_metadata} a METADATA)`,
          ubicacion_documento: undefined,
          estado_cola: 'COMPLETADO',
        }])
        setProcesados(res.restablecidos)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al restablecer'
        setCola([{ id_cola: 0, codigo_documento: 0, nombre_documento: msg, estado_cola: 'ERROR' }])
      }
      setEjecutando(false)
      cargarDocumentos()
      return
    }

    // ── EXTRAER (client-side): CARGADO → METADATA ─────────────────────────
    if (esExtraer) {
      // 1. Handle activo con permisos vigentes
      // 2. Handle guardado en IndexedDB (banner silencioso del browser)
      // 3. Primera vez: showDirectoryPicker (abre Finder una sola vez, luego queda guardado)
      let handleEfectivo: FileSystemDirectoryHandle | null = dirHandle
      if (!handleEfectivo || !(await ensureReadPermission(handleEfectivo))) {
        const stored = await idbGetHandle()
        if (stored && (await ensureReadPermission(stored))) {
          handleEfectivo = stored
          setDirHandle(stored)
        } else {
          try {
            const opts: Record<string, unknown> = { mode: 'read', id: 'cab-procesar-docs' }
            handleEfectivo = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker(opts)
            setDirHandle(handleEfectivo)
            idbSetHandle(handleEfectivo)
            setEscaneandoDir(true)
            try {
              const archivos = await escanearDirectorio(handleEfectivo)
              setArchivosEnDir(archivos)
            } finally {
              setEscaneandoDir(false)
            }
          } catch {
            setEjecutando(false)
            return
          }
        }
      }

      let docsAExtraer = docsEnDisco
      if (tope) docsAExtraer = docsAExtraer.slice(0, parseInt(tope))
      const colaInicial: ItemCola[] = docsAExtraer.map((doc) => ({
        id_cola: doc.codigo_documento,
        codigo_documento: doc.codigo_documento,
        nombre_documento: doc.nombre_documento,
        ubicacion_documento: doc.ubicacion_documento || undefined,
        estado_cola: 'PENDIENTE',
      }))
      setCola(colaInicial)

      // Número de extracciones concurrentes. PDF.js usa su propio worker interno
      // por lo que varias extracciones pueden correr en paralelo sin bloquear el
      // hilo principal. El upload a Railway también beneficia del paralelismo.
      const N_CONCURRENTE = 6

      const procesarItemExtraer = async (item: ItemCola, idx: number) => {
        if (abortRef.current) return
        setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'EN_PROCESO' } : c))
        const t0 = Date.now()
        try {
          if (!item.ubicacion_documento) {
            await documentosApi.subirTexto(item.codigo_documento, {
              texto_fuente: '', archivo_no_encontrado: true,
            })
            setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO (sin ubicación)', tiempo_ms: Date.now() - t0 } : c))
          } else {
            const fileHandle = await abrirArchivoPorRuta(handleEfectivo!, item.ubicacion_documento)
            if (!fileHandle) {
              await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
              setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO', tiempo_ms: Date.now() - t0 } : c))
            } else {
              const ext = (item.ubicacion_documento.split('.').pop() || '').toLowerCase()
              const tExtraccion = Date.now()
              const contenidoRaw = await extraerTextoDeArchivo(fileHandle)
              const subDuracionMs = Date.now() - tExtraccion
              // Normalizar ExtraccionMixta (PDF con páginas imagen) al mismo flujo
              let contenido: string | typeof NECESITA_OCR | null
              let paginasImagen: ExtraccionMixta['paginasImagen'] | undefined
              if (typeof contenidoRaw === 'object' && contenidoRaw !== null && 'paginasImagen' in contenidoRaw) {
                contenido = (contenidoRaw as ExtraccionMixta).texto
                paginasImagen = (contenidoRaw as ExtraccionMixta).paginasImagen
              } else {
                contenido = contenidoRaw as string | typeof NECESITA_OCR | null
              }
              if (contenido === null) {
                await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: ext || 'desconocido' })
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (.${ext})`, tiempo_ms: Date.now() - t0 } : c))
              } else if (contenido === NECESITA_OCR) {
                // PDF sin capa de texto (imagen escaneada / DRM). Intentar OCR en backend.
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, resultado: 'OCR en proceso…' } : c))
                try {
                  const rawFile = await fileHandle.getFile()
                  const rawBytes = await rawFile.arrayBuffer()
                  const ocrRes = await documentosApi.subirOcr(item.codigo_documento, rawBytes)
                  setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: ocrRes.codigo_estado_doc === 'METADATA' ? `METADATA via OCR (${ocrRes.caracteres} chars)` : 'NO_ESCANEABLE (OCR sin texto)', tiempo_ms: Date.now() - t0 } : c))
                } catch (ocrErr) {
                  const ocrMsg = ocrErr instanceof Error ? ocrErr.message : 'Error OCR'
                  try {
                    await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: 'pdf-sin-texto-ocr-fallido' })
                  } catch { /* best effort */ }
                  setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (OCR: ${ocrMsg})`, tiempo_ms: Date.now() - t0 } : c))
                }
              } else if (!contenido.trim()) {
                await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', contenido_vacio: true })
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ESCANEABLE (vacío)', tiempo_ms: Date.now() - t0 } : c))
              } else {
                // Limpiar caracteres nulos (\u0000) — vienen de PDFs con encodings
                // especiales y hacen que FastAPI/PostgreSQL rechacen el request (status 0).
                // También truncar a 60.000 chars para no exceder límite de Railway.
                const MAX_CHARS_FRONTEND = 60_000
                // eslint-disable-next-line no-control-regex
                const textoLimpio = contenido.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
                const textoTruncado = textoLimpio.length > MAX_CHARS_FRONTEND
                  ? textoLimpio.slice(0, MAX_CHARS_FRONTEND)
                  : textoLimpio
                const res = await documentosApi.subirTexto(item.codigo_documento, {
                  texto_fuente: textoTruncado,
                  caracteres: contenido.length,
                  fecha_inicio_extraccion: new Date(t0).toISOString(),
                  sub_duracion_ms: subDuracionMs,
                  ...(paginasImagen ? { paginas_imagen: paginasImagen } : {}),
                })
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `METADATA (${res.caracteres} chars)`, tiempo_ms: Date.now() - t0 } : c))
              }
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error'
          // Archivo no procesable (PDF protegido, corrupto, DOCX/Excel inválido):
          // marcar como NO_ESCANEABLE en BD para que no quede en CARGADO.
          if (e instanceof PdfProtegidoError || e instanceof ArchivoNoEscaneable) {
            const detalle = e instanceof PdfProtegidoError ? 'pdf-protegido' : msg
            const etiqueta = e instanceof PdfProtegidoError ? 'PDF protegido' : msg
            try {
              await documentosApi.subirTexto(item.codigo_documento, {
                texto_fuente: '',
                formato_no_soportado: detalle,
              })
            } catch { /* si falla el upload, al menos dejamos visible en UI */ }
            setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (${etiqueta})`, tiempo_ms: Date.now() - t0 } : c))
          } else {
            setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'ERROR', resultado: msg, tiempo_ms: Date.now() - t0 } : c))
          }
        }
        setProcesados((p) => p + 1)
      }

      // Procesar en lotes concurrentes
      for (let i = 0; i < colaInicial.length; i += N_CONCURRENTE) {
        if (abortRef.current) break
        const lote = colaInicial.slice(i, i + N_CONCURRENTE)
        await Promise.all(lote.map((item, bIdx) => procesarItemExtraer(item, i + bIdx)))
      }

      setEjecutando(false)
      // Solo recargar si el proceso terminó normalmente Y sin errores.
      // Si hubo errores o se abortó, dejar la cola visible para que el usuario
      // pueda ver qué falló antes de volver a intentar.
      if (!abortRef.current) {
        cargarDocumentos()
      }
      return
    }

    // ── LLM (RESUMIR, ESCANEAR, …): worker backend + polling ──────────────
    if (!pasoActual) {
      setEjecutando(false)
      return
    }
    const estadoDestino = pasoActual.estado_destino ?? ''

    // 1. Encolar docs: INSERT masivo con los mismos filtros activos en la UI
    //    (estado origen, ubicacion, tope, filtro libre de texto).
    try {
      await colaEstadosDocsApi.inicializarPorEstado(
        pasoActual.estado_origen || '',
        estadoDestino,
        undefined,
        tope ? parseInt(tope) : null,
        ubicacionSel || null,
        filtroLibre || null,
      )
    } catch {
      setEjecutando(false)
      return
    }

    // 2. Cargar cola inicial — filtrar por estado_destino.
    const pendientesFiltrados = await colaEstadosDocsApi.listar('PENDIENTE', estadoDestino)
    const misItems = pendientesFiltrados
    const colaInicial: ItemCola[] = misItems.map((p) => {
      const doc = documentos.find((d) => d.codigo_documento === p.codigo_documento)
      return {
        id_cola: p.id_cola,
        codigo_documento: p.codigo_documento,
        nombre_documento: doc?.nombre_documento || p.documentos?.nombre_documento || `Doc #${p.codigo_documento}`,
        ubicacion_documento: doc?.ubicacion_documento || undefined,
        estado_cola: p.estado_cola,
      }
    })
    setCola(colaInicial)

    // 3. Disparar worker backend
    try {
      await colaEstadosDocsApi.ejecutar(estadoDestino, { codigo_proceso: procesoSel || undefined })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al disparar el worker'
      setCola((prev) => prev.map((c) => ({ ...c, estado_cola: 'ERROR', resultado: msg })))
      setEjecutando(false)
      return
    }

    // 4. Espera via Realtime (reemplaza polling 3s).
    // Cuando llega una notificación, refresca el estado de la cola.
    // Cuando ningún ítem está PENDIENTE o EN_PROCESO, termina.
    const idsSet = new Set(colaInicial.map((c) => c.id_cola))
    const esperarCambio = () => new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolveColaRef.current = null
        resolve()
      }, 30_000) // fallback si Realtime no llega en 30s
      resolveColaRef.current = () => {
        clearTimeout(timeoutId)
        resolve()
      }
    })
    const poll = async () => {
      while (!abortRef.current) {
        await esperarCambio()
        if (abortRef.current) break
        try {
          const actual = await colaEstadosDocsApi.porIds(Array.from(idsSet))
          const mapa = new Map(actual.map((c) => [c.id_cola, c]))
          // Contar activos fuera del setCola callback para evitar el problema de
          // closures con React 18 batching (el callback se ejecuta en reconciliación,
          // no de forma síncrona). activos = ítems aún PENDIENTE o EN_PROCESO.
          let activos = 0
          for (const item of mapa.values()) {
            if (item.estado_cola === 'PENDIENTE' || item.estado_cola === 'EN_PROCESO') activos++
          }
          setCola((prev) => prev.map((c) => {
            const nuevo = mapa.get(c.id_cola)
            if (!nuevo) return c
            let tiempoMs: number | undefined = c.tiempo_ms
            if (nuevo.fecha_inicio && nuevo.fecha_fin) {
              const t0 = new Date(nuevo.fecha_inicio).getTime()
              const t1 = new Date(nuevo.fecha_fin).getTime()
              if (!isNaN(t0) && !isNaN(t1)) tiempoMs = t1 - t0
            }
            return {
              ...c,
              estado_cola: nuevo.estado_cola,
              resultado: nuevo.resultado || c.resultado,
              tiempo_ms: tiempoMs,
              modelo_usado: nuevo.modelo_usado ?? c.modelo_usado,
            }
          }))
          setProcesados(colaInicial.length - activos)
          if (activos === 0) break
        } catch {
          // Si falla, espera la próxima notificación Realtime
        }
      }
      desuscribirCola()
      setEjecutando(false)
      if (!abortRef.current) cargarDocumentos()
    }
    suscribirCola()
    poll()
  }

  const detener = () => {
    // Corta el loop Realtime y el loop client-side de EXTRAER.
    // El worker backend sigue corriendo; el usuario puede ver el avance en la tab Cola.
    abortRef.current = true
    if (resolveColaRef.current) {
      resolveColaRef.current()
      resolveColaRef.current = null
    }
  }

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
    <div className="relative flex flex-col gap-6 w-full overflow-x-hidden">
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        {tabPrincipal === 'procesar' && (
          <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
        )}
      </div>

      {/* Lengüetas Procesar / Todo / Revertir */}
      <div className="flex gap-1 border-b border-borde -mt-2">
        <button
          onClick={() => setTabPrincipal('procesar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabPrincipal === 'procesar' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          {t('tabPasoAPaso')}
        </button>
        <button
          onClick={() => setTabPrincipal('todo')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabPrincipal === 'todo' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          {t('tabTodo')}
        </button>
        <button
          onClick={() => setTabPrincipal('revertir')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabPrincipal === 'revertir' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          Revertir
        </button>
      </div>

      {tabPrincipal === 'revertir' && <TabRevertir />}

      {tabPrincipal === 'todo' && (
        <TabPipelineTodo
          procesos={procesos}
          estadosDocs={estadosDocs}
          ubicaciones={ubicaciones}
        />
      )}

      {tabPrincipal === 'procesar' && (<>
      <BotonChat className="top-0 right-0" />
      {/* Error carga inicial */}
      {errorCargaInicial && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-error">
          <AlertTriangle size={16} className="shrink-0" />
          <span>No se pudieron cargar los procesos del sistema. El servidor puede estar iniciando.</span>
          <Boton variante="contorno" tamano="sm" onClick={cargarDatosIniciales} disabled={cargandoInicial}>
            {cargandoInicial ? <Loader2 size={14} className="animate-spin" /> : null}
            Reintentar
          </Boton>
        </div>
      )}
      {/* Configuración */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">{t('etiquetaProceso')}</label>
              <select value={procesoSel} onChange={(e) => setProcesoSel(e.target.value)} className={selectClass} disabled={ejecutando || cargandoInicial}>
                <option value="">— Sin valor —</option>
                {procesos.map((p) => {
                  const flecha = p.estado_destino ? `${p.estado_origen || '—'} → ${p.estado_destino}` : ''
                  return (
                    <option key={p.codigo_proceso} value={p.codigo_proceso}>
                      {p.nombre_proceso} ({flecha})
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">Estado</label>
              <select
                value={estadoFiltro}
                onChange={(e) => {
                  const nuevoEstado = e.target.value
                  setEstadoFiltro(nuevoEstado)
                  setYaCargado(false)
                  // Auto-seleccionar proceso cuyo estado_origen coincida
                  if (nuevoEstado && !procesoSel) {
                    const TERMINALES = ['NO_ESCANEABLE', 'NO_ENCONTRADO']
                    if (TERMINALES.includes(nuevoEstado)) {
                      setProcesoSel(PROCESO_RESTABLECER)
                    } else {
                      const match = procesos.find((p) => p.estado_origen === nuevoEstado)
                      if (match) setProcesoSel(match.codigo_proceso)
                    }
                  }
                }}
                className={selectClass}
                disabled={ejecutando}
              >
                <option value="">— según proceso —</option>
                {estadosDocs.map((e) => (
                  <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>
                    {e.nombre_estado || e.codigo_estado_doc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0" ref={ubicDropdownRef}>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-texto">Ubicación</label>
                <span className="text-xs text-texto-muted">Hasta 5 niveles</span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => !ejecutando && setUbicDropdownOpen(!ubicDropdownOpen)}
                  disabled={ejecutando}
                  className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors w-full disabled:opacity-50"
                >
                  <FolderOpen size={16} className={ubicacionSel ? 'text-primario shrink-0' : 'text-texto-muted shrink-0'} />
                  <span className="flex-1 text-left truncate">
                    {ubicacionSel
                      ? (ubicaciones.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion || 'Seleccionar ubicación')
                      : 'Seleccionar ubicación'}
                  </span>
                  {ubicacionSel ? (
                    <X
                      size={13}
                      className="text-texto-muted hover:text-error shrink-0"
                      onClick={(e) => { e.stopPropagation(); setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                    />
                  ) : (
                    <ChevronDown size={13} className="text-texto-muted shrink-0" />
                  )}
                </button>
                {ubicDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-borde rounded-lg shadow-lg flex flex-col" style={{ maxHeight: '18rem' }}>
                    {/* Input de búsqueda fijo arriba */}
                    <div className="p-2 border-b border-borde shrink-0">
                      <input
                        type="text"
                        placeholder="Buscar ubicación…"
                        value={ubicBusqueda}
                        onChange={(e) => setUbicBusqueda(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm border border-borde rounded px-2 py-1 bg-fondo text-texto focus:outline-none focus:ring-1 focus:ring-primario placeholder:text-texto-muted"
                        autoFocus
                      />
                    </div>
                    {/* Lista scrolleable */}
                    <div className="overflow-y-auto flex-1">
                      <div
                        className="px-3 py-2 hover:bg-fondo cursor-pointer text-sm text-texto-muted border-b border-borde"
                        onClick={() => { setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                      >
                        Todas
                      </div>
                      {(() => {
                        const tieneHijosUbic = (cod: string) => ubicaciones.some(u => u.codigo_ubicacion !== cod && u.codigo_ubicacion_superior === cod)
                        // Con búsqueda: mostrar todos los que coincidan sin restricción de árbol
                        if (ubicBusqueda) {
                          const filtradas = ubicaciones.filter(u =>
                            u.nombre_ubicacion.toLowerCase().includes(ubicBusqueda.toLowerCase()) ||
                            (u.ruta_completa || '').toLowerCase().includes(ubicBusqueda.toLowerCase())
                          )
                          if (filtradas.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">Sin coincidencias</div>
                          return filtradas.map(u => {
                            const esArea = u.tipo_ubicacion === 'AREA'
                            const selec = ubicacionSel === u.codigo_ubicacion
                            return (
                              <div
                                key={u.codigo_ubicacion}
                                className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer ${selec ? 'bg-primario-muy-claro' : ''}`}
                                style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }}
                                onClick={() => { setUbicacionSel(u.codigo_ubicacion); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                              >
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
                                <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
                              </div>
                            )
                          })
                        }
                        // Sin búsqueda: árbol colapsado — solo raíces y nodos expandidos
                        const toggleExpandirUbic = (e: React.MouseEvent, cod: string) => {
                          e.stopPropagation()
                          setUbicExpandidos(prev => { const next = new Set(prev); next.has(cod) ? next.delete(cod) : next.add(cod); return next })
                        }
                        const renderNodoUbic = (u: UbicacionOption): React.ReactNode => {
                          const tieneHijos = tieneHijosUbic(u.codigo_ubicacion)
                          const expandido = ubicExpandidos.has(u.codigo_ubicacion)
                          const esArea = u.tipo_ubicacion === 'AREA'
                          const selec = ubicacionSel === u.codigo_ubicacion
                          const hijos = tieneHijos
                            ? ubicaciones
                                .filter(h => h.codigo_ubicacion_superior === u.codigo_ubicacion)
                                .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
                            : []
                          return (
                            <div key={u.codigo_ubicacion}>
                              <div
                                className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer select-none ${selec ? 'bg-primario-muy-claro' : ''}`}
                                style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }}
                                onClick={() => { setUbicacionSel(u.codigo_ubicacion); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                              >
                                {tieneHijos
                                  ? <button onClick={(e) => toggleExpandirUbic(e, u.codigo_ubicacion)} className="shrink-0 hover:text-primario text-texto-muted p-0.5 -ml-0.5 rounded">
                                      {expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </button>
                                  : <span className="w-3 shrink-0" />
                                }
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
                                <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
                              </div>
                              {expandido && hijos.map(h => renderNodoUbic(h))}
                            </div>
                          )
                        }
                        const raicesUbic = ubicaciones
                          .filter(u => !u.codigo_ubicacion_superior)
                          .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
                        if (raicesUbic.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">Sin ubicaciones</div>
                        return raicesUbic.map(u => renderNodoUbic(u))
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filtro libre + Paralelo + Tope — misma línea */}
          <div className="flex items-end gap-3 mt-3 flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-texto">Filtro libre</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filtrar por nombre, directorio, estado o comentarios… (Enter para aplicar)"
                  value={filtroLibreInput}
                  onChange={(e) => setFiltroLibreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFiltroLibre(filtroLibreInput)
                      setYaCargado(false)
                    }
                  }}
                  disabled={ejecutando}
                  className="flex-1 text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
                />
                {filtroLibreInput && (
                  <button
                    type="button"
                    onClick={() => { setFiltroLibreInput(''); setFiltroLibre(''); setYaCargado(false) }}
                    disabled={ejecutando}
                    className="px-2 rounded-lg border border-borde text-texto-muted hover:text-error hover:border-error transition-colors disabled:opacity-50"
                    title="Limpiar filtro"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-texto-muted">Paralelo:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={nParallelEdit}
                onChange={(e) => setNParallelEdit(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={guardarNParallel}
                onKeyDown={(e) => e.key === 'Enter' && guardarNParallel()}
                disabled={ejecutando || guardandoParalel}
                className="w-14 text-xs border border-borde rounded px-1.5 py-2 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50"
              />
              {guardandoParalel && <Loader2 className="w-3 h-3 animate-spin text-texto-muted" />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-texto-muted">Tope:</span>
              <input
                type="number"
                min={1}
                placeholder="todos"
                value={tope}
                onChange={(e) => setTope(e.target.value)}
                disabled={ejecutando}
                className="w-20 text-xs border border-borde rounded px-1.5 py-2 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
              />
            </div>
          </div>

          {/* Conteo + Ejecutar/Detener — misma línea */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde flex-wrap">
            <span className="text-sm text-texto-muted flex items-center gap-2">
              {(() => {
                const topeNum = tope ? parseInt(tope) : 0
                const efectivos = topeNum > 0 ? Math.min(totalDocs, topeNum) : totalDocs
                return <span>{efectivos} {efectivos !== totalDocs ? `a procesar (de ${totalDocs} totales)` : 'documentos'}</span>
              })()}
              {docsSinDisco.length > 0 && (
                <span className="text-error font-medium">
                  · {docsSinDisco.length} sin archivo
                </span>
              )}
            </span>
            <div className="ml-auto flex items-center gap-3">
              {docsSinDisco.length > 0 && (
                <Boton variante="peligro" onClick={() => setConfirmEliminarBulkSinDisco(true)} disabled={ejecutando}>
                  <Trash2 size={14} />
                  Eliminar sin archivo ({docsSinDisco.length})
                </Boton>
              )}
              <Boton variante="primario" onClick={ejecutar}
                disabled={ejecutando || !procesoSel}>
                {ejecutando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {ejecutando ? t('ejecutando') : t('ejecutar')}
              </Boton>
              <Boton variante="contorno" onClick={detener} disabled={!ejecutando}>
                <Square size={14} />{t('detener')}
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
            <p className="text-xs text-texto-muted mt-1">{t('xDeYProcesados', { x: procesados, y: cola.length })}</p>
          </div>
          <div className="flex gap-3 text-sm">
            {okCount > 0 && <span className="text-exito flex items-center gap-1"><CheckCircle size={14} />{okCount}</span>}
            {errCount > 0 && <span className="text-error flex items-center gap-1"><XCircle size={14} />{errCount}</span>}
          </div>
        </div>
      )}

      {/* Cola de procesamiento (visible durante/después de ejecución) */}
      {cola.length > 0 && (() => {
        // Mostrar solo los últimos 100 ítems procesados/en proceso para no congelar el browser.
        // Siempre incluir los que aún están EN_PROCESO o PENDIENTE activos (lote actual).
        const MAX_FILAS = 100
        const terminados = cola.filter((c) => c.estado_cola === 'COMPLETADO' || c.estado_cola === 'ERROR')
        const activos    = cola.filter((c) => c.estado_cola === 'EN_PROCESO' || c.estado_cola === 'PENDIENTE')
        const visibles   = [...terminados.slice(-MAX_FILAS), ...activos.slice(0, MAX_FILAS)]
        const ocultos    = cola.length - visibles.length
        return (
          <>
            {ocultos > 0 && (
              <p className="text-xs text-texto-muted text-center py-1">
                … {ocultos} documentos procesados anteriores ocultos (mostrando últimos {MAX_FILAS})
              </p>
            )}
            <Tabla className="table-fixed">
              <TablaCabecera>
                <tr>
                  <TablaTh className="w-8">{t('colEstado')}</TablaTh>
                  <TablaTh className="w-[30%]">{t('colDocumento')}</TablaTh>
                  <TablaTh>{t('colResultado')}</TablaTh>
                  <TablaTh className="w-40">
                    <span title="Modelo de lenguaje (LLM) usado para procesar el documento">LLM</span>
                  </TablaTh>
                  <TablaTh className="w-24">{t('colTiempo')}</TablaTh>
                  <TablaTh className="w-24 text-right">{tc('acciones')}</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {visibles.map((c) => {
                  const ubic = documentos.find((x) => x.codigo_documento === c.codigo_documento)?.ubicacion_documento ?? c.ubicacion_documento
                  const esUrl = !!ubic && /^https?:\/\//i.test(ubic)
                  return (
                  <TablaFila key={c.id_cola} className={c.estado_cola === 'COMPLETADO' ? 'bg-green-50/50' : c.estado_cola === 'ERROR' ? 'bg-red-50/50' : ''}>
                    <TablaTd>{iconoEstado(c.estado_cola)}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center gap-2 min-w-0">
                        {iconoTipoArchivo(c.nombre_documento)}
                        <span className="font-medium text-sm truncate">{c.nombre_documento}</span>
                      </div>
                    </TablaTd>
                    <TablaTd>
                      <span className={`text-xs truncate block ${c.estado_cola === 'ERROR' ? 'text-error' : 'text-texto-muted'}`}>
                        {c.resultado || '—'}
                      </span>
                    </TablaTd>
                    <TablaTd className="text-xs text-texto-muted font-mono truncate">{c.modelo_usado || '—'}</TablaTd>
                    <TablaTd className="text-xs text-texto-muted tabular-nums">{c.tiempo_ms ? `${(c.tiempo_ms / 1000).toFixed(1)}s` : '—'}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        {ubic && esUrl && (
                          <LinkAccion
                            tooltip="Abrir URL"
                            href={ubic}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                            <ExternalLink size={15} />
                          </LinkAccion>
                        )}
                        {ubic && !esUrl && (
                          <BotonAccion
                            tooltip="Abrir archivo"
                            onClick={() => abrirArchivoDesdeCola(c)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                            <FileText size={15} />
                          </BotonAccion>
                        )}
                        {ubic && (
                          <BotonAccion
                            tooltip="Descargar"
                            onClick={() => descargarDocumento(ubic, c.nombre_documento)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                            <Download size={15} />
                          </BotonAccion>
                        )}
                        <BotonAccion
                          tooltip="Ver detalle"
                          onClick={() => abrirDetalleDesdeCola(c)}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                          <Eye size={15} />
                        </BotonAccion>
                      </div>
                    </TablaTd>
                  </TablaFila>
                  )
                })}
              </TablaCuerpo>
            </Tabla>
          </>
        )
      })()}

      {/* Lista de documentos candidatos (visible antes de ejecución) */}
      {cola.length === 0 && (
        <>
          {/* Paginación superior */}
          {totalDocs > DOCS_POR_PAGINA_DEFAULT && (
            <div className="flex items-center justify-between text-xs text-texto-muted">
              <span>
                {(paginaDoc - 1) * DOCS_POR_PAGINA_DEFAULT + 1}–{Math.min(paginaDoc * DOCS_POR_PAGINA_DEFAULT, totalDocs)} de {totalDocs}
              </span>
              <div className="flex gap-1">
                <button disabled={paginaDoc <= 1} onClick={() => { setPaginaDoc(1); cargarDocumentos(1) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                <button disabled={paginaDoc <= 1} onClick={() => { const p = paginaDoc - 1; setPaginaDoc(p); cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                <span className="px-3 py-1">{paginaDoc} / {totalPaginasDoc}</span>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { const p = paginaDoc + 1; setPaginaDoc(p); cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { setPaginaDoc(totalPaginasDoc); cargarDocumentos(totalPaginasDoc) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">»</button>
              </div>
            </div>
          )}
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>{t('colDocumento')}</TablaTh>
                <TablaTh>{t('colUbicacion')}</TablaTh>
                <TablaTh>{t('colEstado')}</TablaTh>
                <TablaTh className="w-32 text-right">{tc('acciones')}</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>{tc('cargando')}</TablaTd></TablaFila>
              ) : docsEnDisco.length === 0 && docsSinDisco.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>
                  {!yaCargado
                    ? t('escribirFiltro')
                    : documentos.length === 0
                    ? (pasoActual?.estado_origen || estadoFiltro)
                      ? t('sinDocumentosEnEstado', { estado: estadoFiltro || pasoActual?.estado_origen || 'origen' })
                      : 'No hay documentos que coincidan con los filtros'
                    : t('sinResultadosBusqueda')}
                </TablaTd></TablaFila>
              ) : (<>
                {docsEnDisco.map((d) => (
                <TablaFila key={d.codigo_documento}>
                  <TablaTd className="max-w-0 w-[40%]">
                    <div className="flex items-center gap-2 min-w-0">
                      {iconoTipoArchivo(d.nombre_documento)}
                      <span className="font-medium text-sm truncate" title={d.nombre_documento}>{d.nombre_documento}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted max-w-0 w-[30%] truncate" title={d.ubicacion_documento || ''}>{d.ubicacion_documento || '—'}</TablaTd>
                  <TablaTd>
                    <div className="flex items-center gap-2">
                      <Insignia variante="advertencia">{d.codigo_estado_doc}</Insignia>
                      {d.detalle_estado && (
                        <span className="text-xs text-texto-muted italic" title={d.detalle_estado}>
                          {d.detalle_estado.length > 35 ? d.detalle_estado.slice(0, 35) + '…' : d.detalle_estado}
                        </span>
                      )}
                    </div>
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      {d.ubicacion_documento && /^https?:\/\//i.test(d.ubicacion_documento) && (
                        <LinkAccion
                          tooltip="Abrir URL"
                          href={d.ubicacion_documento}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                          <ExternalLink size={15} />
                        </LinkAccion>
                      )}
                      {d.ubicacion_documento && !/^https?:\/\//i.test(d.ubicacion_documento) && (
                        <BotonAccion
                          tooltip="Abrir archivo"
                          onClick={() => abrirDocumentoLocal(d)}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                          <FileText size={15} />
                        </BotonAccion>
                      )}
                      {d.ubicacion_documento && (
                        <BotonAccion
                          tooltip="Descargar"
                          onClick={() => descargarDocumento(d.ubicacion_documento, d.nombre_documento)}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                          <Download size={15} />
                        </BotonAccion>
                      )}
                      <BotonAccion
                        tooltip="Ver detalle"
                        onClick={() => abrirDetalle(d)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                        <Eye size={15} />
                      </BotonAccion>
                      <BotonAccion
                        tooltip="Quitar de la BD"
                        onClick={() => setConfirmEliminarDoc(d)}
                        className="p-1.5 rounded-lg hover:bg-orange-50 text-texto-muted hover:text-orange-500 transition-colors">
                        <XCircle size={15} />
                      </BotonAccion>
                    </div>
                  </TablaTd>
                </TablaFila>
                ))}
                {docsSinDisco.length > 0 && (<>
                  <TablaFila>
                    <TablaTd colSpan={4 as never} className="bg-red-50 py-1.5 px-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-error">
                        <AlertTriangle size={13} className="shrink-0" />
                        {docsSinDisco.length} {docsSinDisco.length === 1 ? 'archivo no encontrado en el directorio seleccionado' : 'archivos no encontrados en el directorio seleccionado'} — no se procesarán
                      </div>
                    </TablaTd>
                  </TablaFila>
                  {docsSinDisco.map((d) => (
                    <TablaFila key={d.codigo_documento}>
                      <TablaTd className="max-w-0 w-[40%]">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle size={14} className="text-error shrink-0" />
                          <span className="font-medium text-sm truncate" title={d.nombre_documento}>{d.nombre_documento}</span>
                        </div>
                      </TablaTd>
                      <TablaTd className="text-xs max-w-0 w-[30%] truncate bg-red-50 text-error/70 font-medium" title={d.ubicacion_documento || ''}>{d.ubicacion_documento || '—'}</TablaTd>
                      <TablaTd>
                        <div className="flex items-center gap-2">
                          <Insignia variante="error">{d.codigo_estado_doc}</Insignia>
                          {d.detalle_estado && (
                            <span className="text-xs text-texto-muted italic" title={d.detalle_estado}>
                              {d.detalle_estado.length > 35 ? d.detalle_estado.slice(0, 35) + '…' : d.detalle_estado}
                            </span>
                          )}
                        </div>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <BotonAccion
                            tooltip="Ver detalle"
                            onClick={() => abrirDetalle(d)}
                            className="p-1.5 rounded-lg hover:bg-fondo text-texto-muted hover:text-primario transition-colors">
                            <Eye size={15} />
                          </BotonAccion>
                          <BotonAccion
                            tooltip="Eliminar"
                            onClick={() => setConfirmEliminarDoc(d)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-texto-muted hover:text-error transition-colors">
                            <Trash2 size={15} />
                          </BotonAccion>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </>)}
              </>)}
            </TablaCuerpo>
          </Tabla>
          {/* Paginación inferior */}
          {totalDocs > DOCS_POR_PAGINA_DEFAULT && (
            <div className="flex items-center justify-between text-xs text-texto-muted mt-1">
              <span>
                {(paginaDoc - 1) * DOCS_POR_PAGINA_DEFAULT + 1}–{Math.min(paginaDoc * DOCS_POR_PAGINA_DEFAULT, totalDocs)} de {totalDocs}
              </span>
              <div className="flex gap-1">
                <button disabled={paginaDoc <= 1} onClick={() => { setPaginaDoc(1); cargarDocumentos(1) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                <button disabled={paginaDoc <= 1} onClick={() => { const p = paginaDoc - 1; setPaginaDoc(p); cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                <span className="px-3 py-1">{paginaDoc} / {totalPaginasDoc}</span>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { const p = paginaDoc + 1; setPaginaDoc(p); cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { setPaginaDoc(totalPaginasDoc); cargarDocumentos(totalPaginasDoc) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">»</button>
              </div>
            </div>
          )}
        </>
      )}

      {false && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="max-w-sm flex-1">
              <Input
                placeholder={t('buscarColaPlaceholder')}
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
              <option value="">{t('todosEstados')}</option>
              <option value="PENDIENTE">{t('pendiente')}</option>
              <option value="EN_PROCESO">{t('enProceso')}</option>
              <option value="COMPLETADO">{t('completado')}</option>
              <option value="ERROR">{t('error')}</option>
            </select>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" onClick={cargarCola} disabled={cargandoCola}>
                <Loader2 size={14} className={cargandoCola ? 'animate-spin' : ''} />{t('refrescar')}
              </Boton>
              <Boton variante="contorno" onClick={() => setConfirmCerrar(true)} disabled={completadosCola === 0}>
                <XCircle size={16} />{t('cerrarCola', { n: completadosCola })}
              </Boton>
            </div>
          </div>

          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>{t('colIdCola')}</TablaTh>
                <TablaTh>{t('colDocumento')}</TablaTh>
                <TablaTh>{t('colOrigen')}</TablaTh>
                <TablaTh>{t('colDestino')}</TablaTh>
                <TablaTh>{t('colEstadoCola')}</TablaTh>
                <TablaTh>{t('colFecha')}</TablaTh>
                <TablaTh>{t('colIntentos')}</TablaTh>
                <TablaTh className="text-right">{tc('acciones')}</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargandoCola ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>{tc('cargando')}</TablaTd></TablaFila>
              ) : colaFiltrada.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>{t('colaVacia')}</TablaTd></TablaFila>
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
                        <BotonAccion
                          tooltip="Eliminar"
                          onClick={() => setConfirmEliminar(c)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors">
                          <Trash2 size={14} />
                        </BotonAccion>
                      </div>
                    </TablaTd>
                  </TablaFila>
                )
              })}
            </TablaCuerpo>
          </Tabla>
        </>
      )}

      {/* Chat de procesamiento */}
      <ChatProcesar
        procesos={procesos}
        ubicaciones={ubicaciones}
        estadosDocs={estadosDocs}
        onAbiertoChange={setChatAbierto}
        onEjecutar={(proceso, tope, ubicacion) => {
          setProcesoSel(proceso)
          if (tope) setTope(String(tope))
          if (ubicacion) setUbicacionSel(ubicacion)
          ejecutar()
        }}
        onCambiarEstado={(estadoOrigen, estadoDestino, ubicacion, topeVal) => {
          setEstadoFiltro(estadoOrigen)
          const match = procesos.find((p) => p.estado_origen === estadoOrigen && p.estado_destino === estadoDestino)
          if (match) setProcesoSel(match.codigo_proceso)
          if (ubicacion) setUbicacionSel(ubicacion)
          if (topeVal) setTope(String(topeVal))
        }}
      />

      <ModalConfirmar
        abierto={!!confirmEliminarDoc}
        alCerrar={() => { setConfirmEliminarDoc(null); setEliminandoDoc(false) }}
        alConfirmar={ejecutarEliminarDoc}
        titulo="Eliminar documento"
        mensaje={confirmEliminarDoc ? `¿Eliminar "${confirmEliminarDoc.nombre_documento}"? Esta acción no se puede deshacer.` : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminandoDoc}
      />

      <ModalConfirmar
        abierto={confirmEliminarBulkSinDisco}
        alCerrar={() => { setConfirmEliminarBulkSinDisco(false); setEliminandoBulkSinDisco(false) }}
        alConfirmar={ejecutarEliminarBulkSinDisco}
        titulo="Eliminar archivos no encontrados"
        mensaje={`¿Eliminar ${docsSinDisco.length} documento(s) que no están en el directorio? Esta acción no se puede deshacer.`}
        textoConfirmar={tc('eliminar')}
        cargando={eliminandoBulkSinDisco}
      />

      {/* ── Modal detalle de documento ─────────────────────────────────── */}
      <Modal
        abierto={!!docDetalle}
        alCerrar={() => setDocDetalle(null)}
        titulo={docDetalle ? docDetalle.nombre_documento : ''}
        className="max-w-4xl"
      >
        {docDetalle && (
          <div className="flex flex-col gap-4 min-h-[500px]">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-borde -mt-2">
              <button onClick={() => setTabDetalle('datos')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabDetalle === 'datos' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
                Datos
              </button>
              {docDetalle.resumen_documento && (
                <button onClick={() => setTabDetalle('resumen')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabDetalle === 'resumen' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
                  Resumen
                </button>
              )}
              <button onClick={() => setTabDetalle('caracteristicas')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabDetalle === 'caracteristicas' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
                Características
              </button>
              {ESTADOS_CON_TEXTO.has(docDetalle.codigo_estado_doc || '') && (
                <button
                  onClick={() => {
                    setTabDetalle('texto')
                    if (!textoDataDetalle || textoDataDetalle.codigo_documento !== docDetalle.codigo_documento) {
                      cargarTextoDetalle(docDetalle.codigo_documento)
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabDetalle === 'texto' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
                  Texto {textoDataDetalle && textoDataDetalle.codigo_documento === docDetalle.codigo_documento ? `(${(textoDataDetalle.caracteres || 0).toLocaleString()})` : ''}
                </button>
              )}
              {ESTADOS_CON_CHUNKS.has(docDetalle.codigo_estado_doc || '') && (
                <button
                  onClick={() => {
                    setTabDetalle('chunks')
                    if (!chunksData) cargarChunksDetalle(docDetalle.codigo_documento)
                  }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabDetalle === 'chunks' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
                  Chunks {chunksData ? `(${chunksData.stats.total_chunks})` : ''}
                </button>
              )}
            </div>

            {/* Tab Datos — solo lectura */}
            {tabDetalle === 'datos' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                  <div className="col-span-12">
                    <p className="text-xs text-texto-muted mb-1">Nombre</p>
                    <div className="flex items-center gap-2">
                      {iconoTipoArchivo(docDetalle.nombre_documento, 16)}
                      <p className="text-sm font-medium text-texto">{docDetalle.nombre_documento}</p>
                      <BotonCopiar texto={docDetalle.nombre_documento} />
                    </div>
                  </div>
                  <div className="col-span-12">
                    <p className="text-xs text-texto-muted mb-1">Ubicación</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-texto break-all">{docDetalle.ubicacion_documento || '—'}</p>
                      {docDetalle.ubicacion_documento && <BotonCopiar texto={docDetalle.ubicacion_documento} />}
                      {docDetalle.ubicacion_documento && /^https?:\/\//i.test(docDetalle.ubicacion_documento) && (
                        <a href={docDetalle.ubicacion_documento} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario" title="Abrir URL">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {docDetalle.ubicacion_documento && !/^https?:\/\//i.test(docDetalle.ubicacion_documento) && (
                        <button onClick={() => abrirDocumentoLocal(docDetalle)}
                          className="shrink-0 p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario" title="Abrir archivo local">
                          <FileText size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-3 flex flex-col">
                    <p className="text-xs text-texto-muted mb-1">Estado</p>
                    <div className="flex items-end flex-1">
                      {docDetalle.codigo_estado_doc
                        ? <Insignia variante={['NO_ESCANEABLE', 'NO_ENCONTRADO'].includes(docDetalle.codigo_estado_doc) ? 'error' : 'primario'}>{docDetalle.codigo_estado_doc}</Insignia>
                        : <span className="text-sm text-texto-muted">—</span>}
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-3 flex flex-col">
                    <p className="text-xs text-texto-muted mb-1">Tamaño</p>
                    <div className="flex items-end flex-1">
                      <p className="text-sm text-texto">{docDetalle.tamano_kb != null ? `${docDetalle.tamano_kb} KB` : '—'}</p>
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-6 flex flex-col">
                    <p className="text-xs text-texto-muted mb-1">Modificado</p>
                    <div className="flex items-end flex-1">
                      <p className="text-sm text-texto">{docDetalle.fecha_modificacion ? new Date(docDetalle.fecha_modificacion).toLocaleString('es-CL') : '—'}</p>
                    </div>
                  </div>
                  {docDetalle.detalle_estado && (
                    <div className="col-span-12">
                      <p className="text-xs text-texto-muted mb-1">Razón del estado</p>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 whitespace-pre-wrap">{docDetalle.detalle_estado}</div>
                    </div>
                  )}
                  {!docDetalle.detalle_estado && ['NO_ESCANEABLE', 'NO_ENCONTRADO', 'VACIO'].includes(docDetalle.codigo_estado_doc || '') && (
                    <div className="col-span-12">
                      <p className="text-xs text-texto-muted mb-1">Razón del estado</p>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Sin detalle registrado. Restablece el documento y reprocésalo para obtener el motivo.</div>
                    </div>
                  )}
                </div>

                {/* Datos del último procesamiento en cola — siempre visible */}
                <div className="mt-2 rounded-lg border border-borde bg-fondo px-4 py-3 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-texto-muted uppercase tracking-wide">Último proceso</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <div>
                      <span className="text-xs text-texto-muted block">Proceso</span>
                      <span className="font-medium">{colaItemDetalle?.codigo_estado_doc_destino || '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-texto-muted block">Resultado</span>
                      <span className={colaItemDetalle?.estado_cola === 'ERROR' ? 'text-error font-medium' : 'font-medium'}>{colaItemDetalle?.estado_cola || '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-texto-muted block">Inicio</span>
                      <span>{colaItemDetalle?.fecha_inicio ? new Date(colaItemDetalle.fecha_inicio).toLocaleString('es-CL') : '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-texto-muted block">Término</span>
                      <span>{colaItemDetalle?.fecha_fin ? new Date(colaItemDetalle.fecha_fin).toLocaleString('es-CL') : '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-texto-muted block">Duración</span>
                      <span>
                        {colaItemDetalle?.fecha_inicio && colaItemDetalle?.fecha_fin
                          ? (() => { const ms = new Date(colaItemDetalle.fecha_fin).getTime() - new Date(colaItemDetalle.fecha_inicio).getTime(); return ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s` })()
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-texto-muted block">LLM</span>
                      <span className="font-mono text-xs">{colaItemDetalle?.modelo_usado || '—'}</span>
                    </div>
                  </div>
                  {colaItemDetalle?.resultado && (
                    <div>
                      <span className="text-xs text-texto-muted block mb-1">Detalle resultado</span>
                      <p className="text-xs text-texto-muted">{colaItemDetalle.resultado}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab Resumen */}
            {tabDetalle === 'resumen' && (
              <div className="flex flex-col gap-3">
                {docDetalle.resumen_documento ? (
                  <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto whitespace-pre-wrap max-h-[60vh] overflow-y-auto">{docDetalle.resumen_documento}</div>
                ) : (
                  <p className="text-sm text-texto-muted py-4 text-center">Sin resumen registrado.</p>
                )}
              </div>
            )}

            {/* Tab Texto — texto_fuente de documento_texto */}
            {tabDetalle === 'texto' && (
              <div className="flex flex-col gap-3">
                {cargandoTextoDetalle ? (
                  <div className="text-sm text-texto-muted text-center py-8">Cargando texto…</div>
                ) : !textoDataDetalle ? (
                  <div className="text-sm text-texto-muted text-center py-8">No se pudo cargar el texto.</div>
                ) : !textoDataDetalle.tiene_texto ? (
                  <div className="text-sm text-texto-muted text-center py-8 border border-dashed border-borde rounded p-4">
                    Este documento no tiene texto extraído. Estado actual: <b>{textoDataDetalle.codigo_estado_doc}</b>
                    {textoDataDetalle.detalle_estado ? <><br /><span className="text-xs">Detalle: {textoDataDetalle.detalle_estado}</span></> : null}
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4 text-sm text-texto-muted pb-2 border-b border-borde">
                      <span><b className="text-texto">{(textoDataDetalle.caracteres || 0).toLocaleString()}</b> caracteres</span>
                      {textoDataDetalle.paginas ? <span><b className="text-texto">{textoDataDetalle.paginas}</b> páginas</span> : null}
                      {textoDataDetalle.fecha_extraccion ? (
                        <span>Extraído: <b className="text-texto">{new Date(textoDataDetalle.fecha_extraccion).toLocaleString('es-CL')}</b></span>
                      ) : null}
                    </div>
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-fondo border border-borde rounded p-3 max-h-[60vh] overflow-auto">
                      {textoDataDetalle.texto_fuente}
                    </pre>
                  </>
                )}
              </div>
            )}

            {/* Tab Características */}
            {tabDetalle === 'caracteristicas' && (
              <div className="flex flex-col gap-3">
                {cargandoCaract ? (
                  <p className="text-sm text-texto-muted py-4 text-center">Cargando…</p>
                ) : categoriasConCaract.filter((cc) => cc.caracteristicas.length > 0).length === 0 ? (
                  <p className="text-sm text-texto-muted py-4 text-center">Sin características registradas.</p>
                ) : (
                  categoriasConCaract.filter((cc) => cc.caracteristicas.length > 0).map((cc) => {
                    const cat = cc.categoria
                    return (
                      <div key={cat.codigo_cat_docs}>
                        <div className="text-xs font-semibold text-texto-muted uppercase mb-1">{cat.nombre_cat_docs}</div>
                        <div className="flex flex-col gap-1">
                          {cc.caracteristicas.map((c) => {
                            const tipoNombre = c.tipos_caract_docs?.nombre_tipo_docs || c.codigo_tipo_docs
                            const valor = c.valor_texto_docs || c.valor_numerico_docs || c.valor_fecha_docs
                            if (!valor) return null
                            return (
                              <div key={c.id_caracteristica_docs} className="text-sm flex items-start gap-2">
                                <span className="text-texto-muted shrink-0">{tipoNombre}:</span>
                                <span className="text-texto">{valor}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Tab Chunks */}
            {tabDetalle === 'chunks' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      className="w-full rounded-lg border border-borde bg-fondo-tarjeta pl-8 pr-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                      placeholder="Buscar en chunks…"
                      value={busquedaChunkInput}
                      onChange={(e) => setBusquedaChunkInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setBusquedaChunk(busquedaChunkInput)
                          setPaginaChunk(1)
                          cargarChunksDetalle(docDetalle.codigo_documento, busquedaChunkInput, 1)
                        }
                      }}
                    />
                  </div>
                  <Boton variante="contorno" onClick={() => {
                    setBusquedaChunk(busquedaChunkInput)
                    setPaginaChunk(1)
                    cargarChunksDetalle(docDetalle.codigo_documento, busquedaChunkInput, 1)
                  }}>Buscar</Boton>
                  {busquedaChunk && (
                    <Boton variante="contorno" onClick={() => {
                      setBusquedaChunk(''); setBusquedaChunkInput(''); setPaginaChunk(1)
                      cargarChunksDetalle(docDetalle.codigo_documento, '', 1)
                    }}>Limpiar</Boton>
                  )}
                </div>
                {chunksData && (
                  <div className="flex gap-4 text-xs text-texto-muted bg-fondo px-3 py-2 rounded-lg">
                    <span><b className="text-texto">{chunksData.stats.total_chunks}</b> chunks</span>
                    <span><b className="text-texto">{chunksData.stats.avg_chars.toLocaleString()}</b> chars promedio</span>
                    <span><b className="text-texto">{(chunksData.stats.n_chars_total / 1000).toFixed(1)}k</b> chars total</span>
                    {chunksData.stats.vectorizado
                      ? <span className="text-green-600 font-medium">Vectorizado</span>
                      : <span className="text-amber-600">Sin vectorizar</span>}
                  </div>
                )}
                {cargandoChunks ? (
                  <p className="text-sm text-texto-muted py-4 text-center">Cargando chunks…</p>
                ) : !chunksData ? (
                  <p className="text-sm text-texto-muted py-4 text-center">Sin datos de chunks.</p>
                ) : chunksData.chunks.length === 0 ? (
                  <p className="text-sm text-texto-muted py-4 text-center">Sin chunks{busquedaChunk ? ` para "${busquedaChunk}"` : ' generados'}.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                    {chunksData.chunks.map((chunk) => {
                      const texto = chunk.texto
                      const mi = chunk.match_inicio
                      const mf = chunk.match_fin
                      const tieneMatch = mi >= 0 && mf > mi
                      return (
                        <div key={chunk.id_chunk} className="rounded-lg border border-borde bg-fondo px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-texto-muted">Chunk {chunk.nro_chunk}</span>
                            <span className="text-xs text-texto-muted">{chunk.n_chars.toLocaleString()} chars</span>
                          </div>
                          <p className="text-xs text-texto leading-relaxed whitespace-pre-wrap break-words">
                            {tieneMatch ? (
                              <>
                                {texto.slice(0, mi)}
                                <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{texto.slice(mi, mf)}</mark>
                                {texto.slice(mf)}
                              </>
                            ) : (texto.length > 400 ? texto.slice(0, 400) + '…' : texto)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
                {chunksData && chunksData.busqueda.total_filtrado > 10 && (
                  <div className="flex items-center justify-between text-xs text-texto-muted pt-1">
                    <span>{((paginaChunk - 1) * 10) + 1}–{Math.min(paginaChunk * 10, chunksData.busqueda.total_filtrado)} de {chunksData.busqueda.total_filtrado}</span>
                    <div className="flex gap-1">
                      <Boton variante="contorno" disabled={paginaChunk <= 1} onClick={() => { const p = paginaChunk - 1; setPaginaChunk(p); cargarChunksDetalle(docDetalle.codigo_documento, busquedaChunk, p) }}>‹</Boton>
                      <Boton variante="contorno" disabled={paginaChunk * 10 >= chunksData.busqueda.total_filtrado} onClick={() => { const p = paginaChunk + 1; setPaginaChunk(p); cargarChunksDetalle(docDetalle.codigo_documento, busquedaChunk, p) }}>›</Boton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>)}
    </div>
  )
}

export default function PaginaProcesarDocumentos() {
  return (
    <Suspense fallback={<div className="p-8 text-texto-muted text-sm">Cargando...</div>}>
      <PaginaProcesarDocumentosInterna />
    </Suspense>
  )
}
