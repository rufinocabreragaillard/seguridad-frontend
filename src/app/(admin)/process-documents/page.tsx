'use client'

import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Play, FileText, CheckCircle, XCircle, Loader2, FolderOpen, Clock, Square, Search, Trash2, AlertTriangle, Eye, ExternalLink, X, ChevronDown, ChevronRight, MapPin, Download } from 'lucide-react'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PageHeader } from '@/components/layout/PageHeader'
import { documentosApi, ubicacionesDocsApi, colaEstadosDocsApi, procesosApi, parametrosApi, cargaDocumentosApi } from '@/lib/api'
import { getEstadosDocs, getProcesosDocs } from '@/lib/catalogos'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, ColaEstadoDoc, EstadoDoc } from '@/lib/tipos'
import { extraerTextoDeArchivo, abrirArchivoPorRuta, PdfProtegidoError, ArchivoNoEscaneable, NECESITA_OCR, NECESITA_DOC_BACKEND, EXTENSIONES_NO_TEXTUALES, type ExtraccionMixta, type TimingsExtraccion } from '@/lib/extraer-texto'

import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle, ensureReadPermission } from '@/lib/file-handle-store'
import { abrirDocumento, descargarDocumento, abrirVentanaLoading, esVisualizableEnBrowser, asegurarHandleConPermiso } from '@/lib/abrir-documento'
import { TabPipelineTodo } from './_components/tab-pipeline-todo'
import { ChatProcesar } from './_components/chat-procesar'
import { TabRevertir } from './_components/tab-revertir'
import { escanearArchivosDirectorio, escanearDirectorio as escanearDirectorioUbicaciones } from '@/lib/escanear-directorio'
import { PipelineNarrativo, type FaseNarrativa as FaseNarrativaUI, type ArchivoEnCurso } from '@/components/pipeline/PipelineNarrativo'
import { FASES_NARRATIVAS, formatearMinutos } from '@/lib/pipeline-narrativo'
import { useColaRealtime } from '@/hooks/useColaRealtime'
import { BotonChat } from '@/components/ui/boton-chat'
import { DocumentoDetalleModal } from '@/components/documentos/documento-detalle-modal'


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

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  url: string
  nivel: number
  tipo_ubicacion?: 'AREA' | 'CONTENIDO'
  codigo_ubicacion_superior?: string
  ubicacion_habilitada?: boolean
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
  const t = useTranslations('processDocuments')
  const tc = useTranslations('common')
  const { grupoActivo, usuario } = useAuth()
  const userId = usuario?.codigo_usuario ?? null
  const searchParams = useSearchParams()
  // Estado del doc desde el que viene el dashboard (ej. "METADATA")
  const estadoDesdeUrl = searchParams.get('estado')

  // Tabs
  const [tabPrincipal, setTabPrincipal] = useState<'procesar' | 'todo' | 'revertir'>('procesar')

  // Config
  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([])
  const [procesosCorregir, setProcesosCorregir] = useState<ProcesoCatalogo[]>([])
  const [procesosRevertir, setProcesosRevertir] = useState<ProcesoCatalogo[]>([])
  const [errorCargaInicial, setErrorCargaInicial] = useState(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [procesoSel, setProcesoSel] = useState<string>('')   // codigo_proceso del catálogo o PROCESO_RESTABLECER
  const [categoriaSel, setCategoriaSel] = useState<'PROCESAR' | 'CORREGIR' | null>(null)
  const [dropdownProcesoAbierto, setDropdownProcesoAbierto] = useState(false)
  const dropdownProcesoRef = useRef<HTMLDivElement>(null)
  const [nParallelEdit, setNParallelEdit] = useState<number>(10)
  const [guardandoParalel, setGuardandoParalel] = useState(false)
  const [tope, setTope] = useState<string>('')  // vacío = sin tope (procesa todo)
  const [generarResumen, setGenerarResumen] = useState<boolean>(true)
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
  // Si categoriaSel es CORREGIR, busca en procesosCorregir primero para evitar colisión de códigos.
  const pasoActual = useMemo(() => {
    if (procesoSel === PROCESO_RESTABLECER || procesoSel === PROCESO_RESETEAR_CARGADO) return null
    if (categoriaSel === 'CORREGIR') {
      return procesosCorregir.find((x) => x.codigo_proceso === procesoSel)
        ?? procesos.find((x) => x.codigo_proceso === procesoSel)
        ?? null
    }
    return procesos.find((x) => x.codigo_proceso === procesoSel)
      ?? procesosCorregir.find((x) => x.codigo_proceso === procesoSel)
      ?? null
  }, [procesos, procesosCorregir, procesoSel, categoriaSel])

  // Sincronizar n_parallel con el proceso seleccionado
  useEffect(() => {
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
      ?? procesosCorregir.find((x) => x.codigo_proceso === procesoSel)
    if (p) setNParallelEdit(p.n_parallel ?? 10)
  }, [procesoSel, procesos, procesosCorregir])

  useEffect(() => {
    if (!dropdownProcesoAbierto) return
    const handler = (e: MouseEvent) => {
      if (dropdownProcesoRef.current && !dropdownProcesoRef.current.contains(e.target as Node)) {
        setDropdownProcesoAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownProcesoAbierto])

  // ¿Este proceso usa LLM? Si tiene id_modelo en su paso, lo corre el worker backend.
  // Si no, es un paso client-side (ej. EXTRAER que usa dirHandle).
  const usaLLM = !!(pasoActual?.id_modelo)
  const esRestablecer = procesoSel === PROCESO_RESTABLECER
  const esResetearCargado = procesoSel === PROCESO_RESETEAR_CARGADO
  const esCargar = pasoActual?.estado_origen === 'FILESYSTEM' && pasoActual?.estado_destino === 'CARGADO'
  const esExtraer = pasoActual?.estado_origen === 'CARGADO' && pasoActual?.estado_destino === 'METADATA'
  // Estos modos cargan todos los docs en memoria y paginan client-side
  const esModoClienteSide = esCargar || esExtraer || esRestablecer || esResetearCargado

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
  const scanAbortRef = useRef<AbortController | null>(null)
  const estadoUrlAplicadoRef = useRef(false)
  // true una vez que la selección inicial de proceso quedó aplicada (evita carga prematura de docs)
  const [seleccionInicialLista, setSeleccionInicialLista] = useState(false)

  // Modal confirmación carga: guarda el resultado del escaneo hasta que el usuario confirme
  type ScanResult = NonNullable<Awaited<ReturnType<typeof escanearArchivosDirectorio>>>
  type PendingCarga = {
    scan: ScanResult
    archivosParaCargar: ScanResult['archivos']
    codigosUbicacionEscaneadas: string[]
  }
  const [pendingCarga, setPendingCarga] = useState<PendingCarga | null>(null)
  const [mensajeCarga, setMensajeCarga] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

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

  // Modal detalle documento (componente compartido con /documents)
  const [docDetalle, setDocDetalle] = useState<Documento | null>(null)

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
      const [procsRaw, procsCorregirRaw, procsRevertirRaw, u, nivelParam, estados] = await Promise.all([
        getProcesosDocs(),
        procesosApi.listar('CORREGIR').catch(() => []),
        procesosApi.listar('REVERTIR').catch(() => []),
        ubicacionesDocsApi.listar().catch(() => []),
        parametrosApi.obtenerValor('DOCUMENTOS', 'NIVELES_DIRECTORIO').catch(() => null),
        getEstadosDocs().catch(() => []),
      ])
      setEstadosDocs(estados as EstadoDoc[])
      if (nivelParam?.valor != null) {
        const n = parseInt(nivelParam.valor, 10)
        if (!isNaN(n) && n >= 0 && n <= 5) setNivelesDirectorio(n)
      }
      // Procesos PROCESAR, ordenados por `orden`.
      const procs = (procsRaw || [])
        .filter((p: ProcesoCatalogo) => !!p.estado_destino)
        .sort((a: ProcesoCatalogo, b: ProcesoCatalogo) => (a.orden ?? 0) - (b.orden ?? 0))
      setProcesos(procs)
      const procsCorregir = (procsCorregirRaw || [])
        .filter((p: ProcesoCatalogo) => !!p.estado_destino)
        .sort((a: ProcesoCatalogo, b: ProcesoCatalogo) => (a.orden ?? 0) - (b.orden ?? 0))
      setProcesosCorregir(procsCorregir)
      const procsRevertir = (procsRevertirRaw || [])
        .filter((p: ProcesoCatalogo) => !!p.estado_destino)
        .sort((a: ProcesoCatalogo, b: ProcesoCatalogo) => (a.orden ?? 0) - (b.orden ?? 0))
      setProcesosRevertir(procsRevertir)

      setUbicaciones(
        (u as UbicacionOption[])
          .filter((x: UbicacionOption) => x)
          .sort((a: UbicacionOption, b: UbicacionOption) => (a.url || '').localeCompare(b.url || ''))
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

  // Seleccionar proceso al cargar: si hay ?estado=XXX lo usa, si no autoselecciona el primero
  useEffect(() => {
    if (cargandoInicial || (procesos.length === 0 && procesosCorregir.length === 0)) return
    if (estadoUrlAplicadoRef.current) return
    estadoUrlAplicadoRef.current = true
    if (estadoDesdeUrl) {
      const matchProcesar = procesos.find((p) => p.estado_origen === estadoDesdeUrl)
      const matchCorregir = procesosCorregir.find((p) => p.estado_origen === estadoDesdeUrl)
      if (matchProcesar) { setProcesoSel(matchProcesar.codigo_proceso); setCategoriaSel('PROCESAR'); setSeleccionInicialLista(true); return }
      if (matchCorregir) { setProcesoSel(matchCorregir.codigo_proceso); setCategoriaSel('CORREGIR'); setSeleccionInicialLista(true); return }
    }
    // Sin ?estado= (o sin coincidencia): autoseleccionar el primer proceso PROCESAR
    if (procesos.length > 0) { setProcesoSel(procesos[0].codigo_proceso); setCategoriaSel('PROCESAR') }
    setSeleccionInicialLista(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoDesdeUrl, cargandoInicial, procesos, procesosCorregir])

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

  // Al abrir el dropdown de ubicaciones, expandir automáticamente las raíces
  // para que se vea desde el inicio el árbol (no quedar en blanco esperando filtro).
  useEffect(() => {
    if (!ubicDropdownOpen) return
    const raices = ubicaciones.filter(u => !u.codigo_ubicacion_superior).map(u => u.codigo_ubicacion)
    if (raices.length === 0) return
    setUbicExpandidos(prev => {
      const next = new Set(prev)
      let cambio = false
      for (const cod of raices) {
        if (!next.has(cod)) { next.add(cod); cambio = true }
      }
      return cambio ? next : prev
    })
  }, [ubicDropdownOpen, ubicaciones])

  // Restaurar dirHandle persistido al entrar.
  // El walker del filesystem SOLO es útil para EXTRAER (matching client-side
  // contra `archivosEnDir`). Para el resto de procesos backend (CHUNKEAR,
  // ESCANEAR, VECTORIZAR, ANALIZAR, etc.) no se consume `archivosEnDir`, así
  // que solo restauramos el handle sin escanear.
  useEffect(() => {
    (async () => {
      const h = await idbGetHandle(userId, grupoActivo)
      if (!h) return
      try {
        const perm = await (h as unknown as { queryPermission: (opts: { mode: string }) => Promise<PermissionState> }).queryPermission({ mode: 'read' })
        if (perm !== 'granted') return
        setDirHandle(h)
        if (!esExtraer) return
        setEscaneandoDir(true)
        try {
          const archivos = await escanearDirectorio(h)
          setArchivosEnDir(archivos)
        } finally {
          setEscaneandoDir(false)
        }
      } catch { /* ignore */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esExtraer])

  // Cargar documentos candidatos (paginado server-side para procesos backend; all para EXTRAER)
  const cargarDocumentos = useCallback(async (pagina = 1) => {
    setCargando(true)
    try {
      const qBackend = busqueda.trim() || filtroLibre.trim() || undefined
      const rutaPrefijo = ubicacionSel
        ? ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)?.url
        : undefined

      if (esCargar) {
        // CARGAR (FILESYSTEM → CARGADO): los docs vienen del filesystem, no de BD.
        // La tabla se llena al ejecutar; aquí solo mostramos CARGADO existentes como referencia.
        const todos = await documentosApi.listar({ codigo_estado_doc: 'CARGADO', q: qBackend })
        if (rutaPrefijo) {
          setDocumentos(todos.filter((d) => d.ubicacion_documento?.startsWith(rutaPrefijo)))
        } else {
          setDocumentos(todos)
        }
        setTotalDocs(todos.length)
        setTotalPaginasDoc(Math.max(1, Math.ceil(todos.length / DOCS_POR_PAGINA_DEFAULT)))
        setPaginaDoc(1)
      } else if (esExtraer || esRestablecer || esResetearCargado) {
        // EXTRAER necesita todos los docs para el matching con el filesystem.
        // RESTABLECER/RESETEAR también carga todo (son lotes pequeños de estados terminales).
        let todos: Documento[]
        if (esRestablecer) {
          const [a, b] = await Promise.all([
            documentosApi.listar({ codigo_estado_doc: 'NO_ESCANEABLE', q: qBackend }),
            documentosApi.listar({ codigo_estado_doc: 'NO_ENCONTRADO', q: qBackend }),
          ])
          todos = [...a, ...b]
        } else if (esResetearCargado) {
          todos = await documentosApi.listar({ q: qBackend })
        } else {
          // EXTRAER
          const estadoOrigen = pasoActual?.estado_origen || 'CARGADO'
          todos = await documentosApi.listar({ codigo_estado_doc: estadoOrigen, q: qBackend })
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
  }, [procesoSel, esCargar, esExtraer, esRestablecer, esResetearCargado, pasoActual, ubicacionSel, ubicaciones, busqueda, estadoFiltro, filtroLibre])

  // Resetear lista cuando cambian filtros de proceso/alcance/ubicación.
  // No cargar mientras los datos iniciales (catálogo de procesos) aún están cargando,
  // ni antes de que la selección inicial de proceso haya sido aplicada (evita mostrar todos
  // los docs por un render mientras el autoselect del primer proceso aún no ocurrió).
  // Nota: a proposito NO incluimos `busqueda` en las deps; eso lo maneja el
  // boton/Enter del filtro para no re-cargar con cada tecla.
  useEffect(() => {
    if (cargandoInicial) return
    if (!seleccionInicialLista) return
    setDocumentos([])
    setYaCargado(false)
    cargarDocumentos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoSel, ubicacionSel, estadoFiltro, filtroLibre, cargandoInicial, seleccionInicialLista])

  // Separar en dos grupos: encontrados en disco y no encontrados.
  // Si no hay directorio escaneado, todos van al grupo "enDisco".
  const todosEnDisco = esExtraer && archivosEnDir
    ? documentos.filter((d) => archivosEnDir.has(d.nombre_documento))
    : documentos
  const todosSinDisco = esExtraer && archivosEnDir
    ? documentos.filter((d) => !archivosEnDir.has(d.nombre_documento))
    : []
  // En modo client-side la paginación es por slice; en server-side el backend ya pagina
  const inicio = esModoClienteSide ? (paginaDoc - 1) * DOCS_POR_PAGINA_DEFAULT : 0
  const fin = esModoClienteSide ? paginaDoc * DOCS_POR_PAGINA_DEFAULT : todosEnDisco.length
  const docsEnDisco = esModoClienteSide ? todosEnDisco.slice(inicio, fin) : todosEnDisco
  const docsSinDisco = todosSinDisco

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
      const opts: Record<string, unknown> = { mode: 'read', id: 'serverlm-docs' }
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker(opts)
      setDirHandle(handle)
      idbSetHandle(handle, userId, grupoActivo)
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
    idbSetHandle(null, userId, grupoActivo)
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
      setProcesosCorregir((prev) => prev.map((p) => p.codigo_proceso === procesoSel ? { ...p, n_parallel: updated.n_parallel } : p))
    } finally {
      setGuardandoParalel(false)
    }
  }

  // ── Modal detalle de documento ──────────────────────────────────────────
  // El modal compartido carga características, item de cola, texto y chunks
  // por sí solo; aquí solo seteamos el documento a mostrar.
  const abrirDetalle = useCallback((d: Documento) => {
    setDocDetalle(d)
  }, [])

  const abrirDocumentoLocal = async (d: Documento) => {
    // Asegurar handle + permiso ANTES de abrir la pestaña: requestPermission()
    // y showDirectoryPicker() requieren un user gesture activo.
    const { continuar, handle } = await asegurarHandleConPermiso(userId, grupoActivo)
    if (!continuar) return
    const win = abrirVentanaLoading()
    abrirDocumento(d.ubicacion_documento, win, userId, grupoActivo, handle)
  }

  // Resuelve un Documento completo a partir de un ItemCola — busca en la lista
  // cargada; si no está, hace fetch del documento completo al backend para que
  // el modal tenga estado/ubicación/tamaño/fecha y muestre todas las pestañas.
  const docDesdeCola = useCallback(async (c: ItemCola): Promise<Documento> => {
    const existente = documentos.find((x) => x.codigo_documento === c.codigo_documento)
    if (existente) return existente
    try {
      return await documentosApi.obtener(c.codigo_documento)
    } catch {
      return {
        codigo_documento: c.codigo_documento,
        codigo_grupo: grupoActivo || '',
        nombre_documento: c.nombre_documento,
        ubicacion_documento: c.ubicacion_documento ?? null,
      } as Documento
    }
  }, [documentos, grupoActivo])

  const abrirDetalleDesdeCola = useCallback(async (c: ItemCola) => {
    abrirDetalle(await docDesdeCola(c))
  }, [abrirDetalle, docDesdeCola])

  const abrirArchivoDesdeCola = async (c: ItemCola) => {
    const doc = documentos.find((x) => x.codigo_documento === c.codigo_documento)
    const ubic = doc?.ubicacion_documento ?? c.ubicacion_documento
    if (!ubic) return
    const { continuar, handle } = await asegurarHandleConPermiso(userId, grupoActivo)
    if (!continuar) return
    const win = abrirVentanaLoading()
    abrirDocumento(ubic, win, userId, grupoActivo, handle)
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
    // Confirmar el filtro libre si el usuario escribió pero no presionó Enter
    const filtroEfectivo = filtroLibreInput.trim() || filtroLibre.trim() || ''
    if (filtroEfectivo !== filtroLibre) {
      setFiltroLibre(filtroEfectivo)
    }
    setEjecutando(true)
    setProcesados(0)
    setCola([])
    abortRef.current = false

    // ── RESETEAR A CARGADO ────────────────────────────────────────────────
    if (esResetearCargado) {
      try {
        const ids = todosEnDisco.map((d) => d.codigo_documento)
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
        const ids = todosEnDisco.map((d) => d.codigo_documento)
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

    // ── CARGAR (client-side): FILESYSTEM → CARGADO ───────────────────────
    if (esCargar) {
      let handleEfectivo: FileSystemDirectoryHandle | null = dirHandle
      if (!handleEfectivo || !(await ensureReadPermission(handleEfectivo))) {
        const stored = await idbGetHandle(userId, grupoActivo)
        if (stored && (await ensureReadPermission(stored))) {
          handleEfectivo = stored
          setDirHandle(stored)
        }
        // Si no hay handle guardado, escanearArchivosDirectorio abrirá el picker
      }

      // Crear AbortController para poder cancelar el escaneo con Detener
      const scanAbort = new AbortController()
      scanAbortRef.current = scanAbort

      // Rutas deshabilitadas en BD: no se deben escanear ni contar sus archivos
      const rutasDeshabilitadas = new Set(
        ubicaciones
          .filter((u) => u.ubicacion_habilitada === false && u.url)
          .map((u) => u.url)
      )

      setEscaneandoDir(true)
      let scan: Awaited<ReturnType<typeof escanearArchivosDirectorio>>
      try {
        scan = await escanearArchivosDirectorio(handleEfectivo ?? undefined, nivelesDirectorio, scanAbort.signal, rutasDeshabilitadas)
      } finally {
        setEscaneandoDir(false)
        scanAbortRef.current = null
      }

      if (!scan || abortRef.current) {
        setEjecutando(false)
        return
      }

      // Guardar handle para reutilizar sin volver a pedir permisos
      setDirHandle(scan.dirHandle)
      idbSetHandle(scan.dirHandle, userId, grupoActivo)
      // Actualizar set de nombres para filtro visual
      setArchivosEnDir(new Set(scan.archivos.map((a) => a.nombre)))

      const archivosParaCargar = tope
        ? scan.archivos.slice(0, parseInt(tope))
        : scan.archivos

      // Códigos de ubicaciones escaneadas (para detección de huérfanos en BD)
      const codigosUbicacionEscaneadas = ubicaciones
        .filter((u) => u.url && scan!.rutasEscaneadas.includes(u.url))
        .map((u) => u.codigo_ubicacion)

      // Pausar y mostrar modal de confirmación con el conteo de archivos encontrados.
      // La ejecución continúa solo cuando el usuario confirma (ver confirmarCarga).
      setPendingCarga({ scan, archivosParaCargar, codigosUbicacionEscaneadas })
      setEjecutando(false)
      return
    }

    // ── EXTRAER (client-side): CARGADO → METADATA ─────────────────────────
    if (esExtraer) {
      // 1. Handle activo con permisos vigentes
      // 2. Handle guardado en IndexedDB (banner silencioso del browser)
      // 3. Primera vez: showDirectoryPicker (abre Finder una sola vez, luego queda guardado)
      let handleEfectivo: FileSystemDirectoryHandle | null = dirHandle
      if (!handleEfectivo || !(await ensureReadPermission(handleEfectivo))) {
        const stored = await idbGetHandle(userId, grupoActivo)
        if (stored && (await ensureReadPermission(stored))) {
          handleEfectivo = stored
          setDirHandle(stored)
        } else {
          try {
            const opts: Record<string, unknown> = { mode: 'read', id: 'serverlm-docs' }
            handleEfectivo = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker(opts)
            setDirHandle(handleEfectivo)
            idbSetHandle(handleEfectivo, userId, grupoActivo)
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

      // Aplicar filtro efectivo sobre TODOS los docs cargados (no solo la página visible).
      // La paginación es solo para visualización; al ejecutar se procesan todos los matcheados.
      let docsAExtraer = filtroEfectivo
        ? todosEnDisco.filter((d) =>
            d.nombre_documento?.toLowerCase().includes(filtroEfectivo.toLowerCase()) ||
            d.ubicacion_documento?.toLowerCase().includes(filtroEfectivo.toLowerCase())
          )
        : todosEnDisco
      if (tope) docsAExtraer = docsAExtraer.slice(0, parseInt(tope))
      const colaInicial: ItemCola[] = docsAExtraer.map((doc) => ({
        id_cola: doc.codigo_documento,
        codigo_documento: doc.codigo_documento,
        nombre_documento: doc.nombre_documento,
        ubicacion_documento: doc.ubicacion_documento || undefined,
        estado_cola: 'PENDIENTE',
      }))
      setCola(colaInicial)

      const procesoExtraer = procesos.find((p) => p.estado_origen === 'CARGADO' && p.estado_destino === 'METADATA')
      const N_CONCURRENTE = procesoExtraer?.n_parallel ?? 6
      const timeoutExtraccionMs = procesoExtraer?.timeout_extraccion_seg ? procesoExtraer.timeout_extraccion_seg * 1000 : undefined

      // Flag DOCUMENTOS/DEBUG_TIEMPOS_PIPELINE: si está activo medimos cada
      // sub-paso del EXTRAER y lo enviamos al backend para diagnóstico.
      // Lectura una sola vez por corrida (no por doc), overhead despreciable.
      let _debugTiempos = false
      try {
        const _r = await parametrosApi.obtenerValor('DOCUMENTOS', 'DEBUG_TIEMPOS_PIPELINE')
        _debugTiempos = (_r?.valor || '').toLowerCase() === 'true'
      } catch { /* si falla, sigue apagado */ }
      const debugTiempos = _debugTiempos

      const procesarItemExtraer = async (item: ItemCola, idx: number) => {
        if (abortRef.current) return
        setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'EN_PROCESO' } : c))
        const t0 = Date.now()
        // Declarados al scope del try para que el catch (PDF protegido, corrupto, etc.)
        // también pueda persistirlos cuando debugTiempos está activo.
        const timings: TimingsExtraccion | undefined = debugTiempos ? {} : undefined
        let tAbrirHandleMs = 0
        let subDuracionMs = 0
        try {
          if (!item.ubicacion_documento) {
            await documentosApi.subirTexto(item.codigo_documento, {
              texto_fuente: '', archivo_no_encontrado: true,
            })
            setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO (sin ubicación)', tiempo_ms: Date.now() - t0 } : c))
          } else {
            // Fast-path: extensiones que sabemos que no son texto (imágenes, audio,
            // video, binarios). Evitamos abrirArchivoPorRuta + extractor + getFile()
            // que con N workers paralelos puede tomar varios segundos por doc.
            const extPrev = (item.ubicacion_documento.split('.').pop() || '').toLowerCase()
            if (EXTENSIONES_NO_TEXTUALES.has(extPrev)) {
              await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: extPrev })
              setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (.${extPrev})`, tiempo_ms: Date.now() - t0 } : c))
              return
            }
            const _tAbrir = Date.now()
            const fileHandle = await abrirArchivoPorRuta(handleEfectivo!, item.ubicacion_documento)
            tAbrirHandleMs = Date.now() - _tAbrir
            if (!fileHandle) {
              await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
              setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO', tiempo_ms: Date.now() - t0 } : c))
            } else {
              const ext = (item.ubicacion_documento.split('.').pop() || '').toLowerCase()
              const tExtraccion = Date.now()
              const contenidoRaw = await extraerTextoDeArchivo(fileHandle, timeoutExtraccionMs, timings)
              subDuracionMs = Date.now() - tExtraccion
              // Normalizar ExtraccionMixta (PDF con páginas imagen) al mismo flujo
              let contenido: string | typeof NECESITA_OCR | typeof NECESITA_DOC_BACKEND | null
              let paginasImagen: ExtraccionMixta['paginasImagen'] | undefined
              if (typeof contenidoRaw === 'object' && contenidoRaw !== null && 'paginasImagen' in contenidoRaw) {
                contenido = (contenidoRaw as ExtraccionMixta).texto
                paginasImagen = (contenidoRaw as ExtraccionMixta).paginasImagen
              } else {
                contenido = contenidoRaw as string | typeof NECESITA_OCR | typeof NECESITA_DOC_BACKEND | null
              }
              if (contenido === null) {
                await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: ext || 'desconocido' })
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (.${ext})`, tiempo_ms: Date.now() - t0 } : c))
              } else if (contenido === NECESITA_DOC_BACKEND) {
                // .doc binario (OLE) — extracción vía antiword en backend
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, resultado: 'antiword en proceso…' } : c))
                try {
                  const rawFile = await fileHandle.getFile()
                  const rawBytes = await rawFile.arrayBuffer()
                  const docRes = await documentosApi.subirDoc(item.codigo_documento, rawBytes)
                  setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: docRes.codigo_estado_doc === 'METADATA' ? `METADATA via antiword (${docRes.caracteres} chars)` : 'NO_ESCANEABLE (antiword sin texto)', tiempo_ms: Date.now() - t0 } : c))
                } catch (docErr) {
                  // Mismo patrón idempotente que OCR: si el backend completó pero la respuesta
                  // se perdió, consultar el estado real antes de marcar la fila como ERROR.
                  const docMsg = docErr instanceof Error ? docErr.message : 'Error antiword'
                  let estadoReal: string | null = null
                  try {
                    const docActual = await documentosApi.obtener(item.codigo_documento)
                    estadoReal = docActual?.codigo_estado_doc || null
                  } catch { /* best effort */ }
                  if (estadoReal === 'METADATA') {
                    setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: 'METADATA via antiword (respuesta perdida — backend OK)', tiempo_ms: Date.now() - t0 } : c))
                  } else {
                    setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'ERROR', resultado: `antiword falló: ${docMsg}`, tiempo_ms: Date.now() - t0 } : c))
                  }
                }
              } else if (contenido === NECESITA_OCR) {
                // PDF sin capa de texto (imagen escaneada / DRM). Intentar OCR en backend.
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, resultado: 'OCR en proceso…' } : c))
                try {
                  const rawFile = await fileHandle.getFile()
                  const rawBytes = await rawFile.arrayBuffer()
                  const ocrRes = await documentosApi.subirOcr(item.codigo_documento, rawBytes)
                  setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: ocrRes.codigo_estado_doc === 'METADATA' ? `METADATA via OCR (${ocrRes.caracteres} chars)` : 'NO_ESCANEABLE (OCR sin texto)', tiempo_ms: Date.now() - t0 } : c))
                } catch (ocrErr) {
                  // El OCR puede haber completado en el backend aunque la respuesta se haya perdido
                  // (corte de proxy, timeout intermedio). NO revertimos el estado del documento desde
                  // el frontend: si el backend completó OCR ya quedó en METADATA, y si falló sigue
                  // en CARGADO listo para el próximo reintento. Verificamos el estado real antes de
                  // marcar la fila de cola.
                  const ocrMsg = ocrErr instanceof Error ? ocrErr.message : 'Error OCR'
                  let estadoReal: string | null = null
                  try {
                    const docActual = await documentosApi.obtener(item.codigo_documento)
                    estadoReal = docActual?.codigo_estado_doc || null
                  } catch { /* best effort */ }
                  if (estadoReal === 'METADATA') {
                    setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: 'METADATA via OCR (respuesta perdida — backend OK)', tiempo_ms: Date.now() - t0 } : c))
                  } else {
                    setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'ERROR', resultado: `OCR falló: ${ocrMsg}`, tiempo_ms: Date.now() - t0 } : c))
                  }
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
                // Timings que conocemos ANTES del POST (todo lo que precede a subirTexto).
                // El tiempo del POST en sí se calcula como tiempo_ms - sub_duracion_ms
                // - t_abrir_handle_ms al consultar la cola (tiempo_ms se persiste en
                // cola_estados_docs como diferencia fecha_fin - fecha_inicio).
                const timingsDebug = timings
                  ? { ...timings, t_abrir_handle_ms: tAbrirHandleMs, t_total_extraccion_ms: subDuracionMs }
                  : undefined
                const _tSubir = Date.now()
                const res = await documentosApi.subirTexto(item.codigo_documento, {
                  texto_fuente: textoTruncado,
                  caracteres: contenido.length,
                  fecha_inicio_extraccion: new Date(t0).toISOString(),
                  sub_duracion_ms: subDuracionMs,
                  ...(paginasImagen ? { paginas_imagen: paginasImagen } : {}),
                  ...(timingsDebug ? { timings_debug: timingsDebug } : {}),
                })
                if (timingsDebug) {
                  const tSubirMs = Date.now() - _tSubir
                  console.debug('[EXTRAER timings]', item.codigo_documento, { ...timingsDebug, t_subir_backend_ms: tSubirMs, t_total_ms: Date.now() - t0 })
                }
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
            // En este path "abortado" timings ya tiene t_arrayBuffer_ms y
            // t_pdfjs_getDocument_ms (PDF.js los registró antes de lanzar).
            // Eso permite ver si los 16s se fueron en arrayBuffer (Dropbox sync,
            // archivo grande) o en getDocument (parsing antes de password challenge).
            const timingsDebug = timings
              ? { ...timings, t_abrir_handle_ms: tAbrirHandleMs, t_total_extraccion_ms: subDuracionMs, fallo_tipo: e instanceof PdfProtegidoError ? 'pdf_protegido' : 'archivo_no_escaneable' }
              : undefined
            try {
              await documentosApi.subirTexto(item.codigo_documento, {
                texto_fuente: '',
                formato_no_soportado: detalle,
                ...(timingsDebug ? { timings_debug: timingsDebug } : {}),
              })
            } catch { /* si falla el upload, al menos dejamos visible en UI */ }
            if (timingsDebug) {
              console.debug('[EXTRAER timings (fail)]', item.codigo_documento, { ...timingsDebug, t_total_ms: Date.now() - t0 })
            }
            setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (${etiqueta})`, tiempo_ms: Date.now() - t0 } : c))
          } else {
            setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'ERROR', resultado: msg, tiempo_ms: Date.now() - t0 } : c))
          }
        }
        setProcesados((p) => p + 1)
      }

      // Procesar con sliding window: mantiene N_CONCURRENTE workers activos.
      // Apenas un slot termina, agarra el siguiente PENDIENTE de la cola.
      // Evita que un doc lento (ej. PDF jurídico de 19s) bloquee a otros 5 slots.
      let nextIdx = 0
      const worker = async () => {
        while (!abortRef.current) {
          const myIdx = nextIdx++
          if (myIdx >= colaInicial.length) return
          await procesarItemExtraer(colaInicial[myIdx], myIdx)
        }
      }
      await Promise.all(Array.from({ length: N_CONCURRENTE }, () => worker()))

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
      const opcionesAnalizar = pasoActual.estado_destino === 'ESCANEADO'
        ? { generar_resumen: generarResumen }
        : null
      await colaEstadosDocsApi.inicializarPorEstado(
        pasoActual.estado_origen || '',
        estadoDestino,
        undefined,
        tope ? parseInt(tope) : null,
        ubicacionSel || null,
        filtroEfectivo || null,
        procesoSel || null,
        opcionesAnalizar,
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
        ubicacion_documento: doc?.ubicacion_documento || p.documentos?.ubicacion_documento || undefined,
        estado_cola: p.estado_cola,
      }
    })
    setCola(colaInicial)

    // 3. Disparar procesamiento en el backend (BackgroundTask).
    try {
      await colaEstadosDocsApi.ejecutar(estadoDestino, procesoSel || undefined)
    } catch {
      // No-op: el backend puede estar procesando otro lote — el Realtime lo reflejará
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
    // Corta el escaneo en curso, el loop Realtime y el loop client-side de EXTRAER.
    // El worker backend sigue corriendo; el usuario puede ver el avance en la tab Cola.
    abortRef.current = true
    if (scanAbortRef.current) {
      scanAbortRef.current.abort()
      scanAbortRef.current = null
    }
    if (resolveColaRef.current) {
      resolveColaRef.current()
      resolveColaRef.current = null
    }
  }

  const confirmarCarga = async () => {
    if (!pendingCarga) return
    const { scan, archivosParaCargar, codigosUbicacionEscaneadas } = pendingCarga
    setPendingCarga(null)
    setEjecutando(true)
    abortRef.current = false
    setCola([{
      id_cola: 0,
      codigo_documento: 0,
      nombre_documento: `Cargando ${archivosParaCargar.length} archivos desde ${scan.nombreRaiz}…`,
      estado_cola: 'EN_PROCESO',
    }])
    try {
      const res = await cargaDocumentosApi.cargar({
        archivos: archivosParaCargar,
        codigos_ubicacion_escaneadas: codigosUbicacionEscaneadas.length > 0 ? codigosUbicacionEscaneadas : undefined,
      })
      const resumen = `Cargados: ${res.insertados} nuevos, ${res.actualizados} actualizados, ${res.eliminados ?? 0} eliminados`
      setCola([{
        id_cola: 0,
        codigo_documento: 0,
        nombre_documento: resumen,
        estado_cola: 'COMPLETADO',
      }])
      setProcesados(res.insertados + res.actualizados)
      setMensajeCarga({ tipo: 'exito', texto: resumen })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar'
      setCola([{ id_cola: 0, codigo_documento: 0, nombre_documento: msg, estado_cola: 'ERROR' }])
      console.error('[CARGAR] error:', e)
      setMensajeCarga({ tipo: 'error', texto: msg })
    }
    setEjecutando(false)
    // Llamar directamente sin pasar por el useEffect (que requiere procesoSel)
    cargarDocumentos()
  }

  const cancelarCarga = () => {
    setPendingCarga(null)
    setCola([])
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

  // Datos del pipeline narrativo (se usan en dos lugares: bloque superior "Antes de empezar"
  // y bloque de estadísticas arriba de la grilla de documentos).
  const carpetaSel = ubicaciones.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion ?? 'todas las ubicaciones'
  const erroresActuales = cola.filter(c => c.estado_cola === 'ERROR').length
  const fasesUI: FaseNarrativaUI[] = FASES_NARRATIVAS.map((f) => ({
    clave: f.clave,
    etiqueta: f.etiquetaCorta,
    count: pasoActual?.estado_destino === f.estadoDestino && ejecutando ? procesados : 0,
    color: f.color,
    estado: (pasoActual?.estado_destino === f.estadoDestino && ejecutando ? 'activo' : 'esperando') as FaseNarrativaUI['estado'],
  }))
  fasesUI.push({
    clave: 'LISTOS',
    etiqueta: 'LISTOS',
    count: procesados,
    color: '#16A34A',
    estado: procesados > 0 ? 'listo' : 'esperando',
  })
  const archivosPipeline: ArchivoEnCurso[] = cola.slice(-4).map(c => ({
    nombre: c.nombre_documento.split('/').pop() ?? c.nombre_documento,
    estado: c.estado_cola === 'COMPLETADO' ? 'listo'
          : c.estado_cola === 'ERROR' ? 'error'
          : c.estado_cola === 'EN_PROCESO' ? 'activo'
          : 'esperando',
  }))
  const resumenPipeline = {
    completados: procesados,
    total: totalDocs,
    etaTexto: null as string | null,
    listosCount: procesados,
    erroresCount: erroresActuales,
  }

  return (
    <div className="relative flex flex-col gap-6 w-full overflow-x-hidden">
      <PageHeader
        className="pr-28"
        conSubtitulo={tabPrincipal === 'procesar'}
        i18nNamespace="processDocuments"
      />

      {/* Lengüetas Procesar / Vectorizar / Revertir */}
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
          {t('tabVectorizar')}
        </button>
        <button
          onClick={() => setTabPrincipal('revertir')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabPrincipal === 'revertir' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          {t('tabRevertir')}
        </button>
      </div>

      {tabPrincipal === 'revertir' && <TabRevertir procesos={procesosRevertir} procesosCorregir={procesosCorregir} ubicaciones={ubicaciones} estadosDocs={estadosDocs} />}

      {tabPrincipal === 'todo' && (
        <TabPipelineTodo
          procesos={procesos}
          estadosDocs={estadosDocs}
          ubicaciones={ubicaciones}
        />
      )}

      {tabPrincipal === 'procesar' && (<>
      <BotonChat className="top-0 right-0" />
      {/* Resultado de carga masiva */}
      {mensajeCarga && (
        <div className={`flex items-center gap-3 p-3 border rounded-lg text-sm ${mensajeCarga.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-error'}`}>
          {mensajeCarga.tipo === 'exito' ? <CheckCircle size={16} className="shrink-0 text-exito" /> : <AlertTriangle size={16} className="shrink-0" />}
          <span>{mensajeCarga.texto}</span>
          <button onClick={() => setMensajeCarga(null)} className="ml-auto text-texto-muted hover:text-texto">✕</button>
        </div>
      )}
      {/* Error carga inicial */}
      {errorCargaInicial && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-error">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{t('errorCargaInicial')}</span>
          <Boton variante="contorno" tamano="sm" onClick={cargarDatosIniciales} disabled={cargandoInicial}>
            {cargandoInicial ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('reintentar')}
          </Boton>
        </div>
      )}

      {/* Configuración — formato inline "Label: campo" */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="flex items-center gap-x-6 gap-y-3 flex-wrap">
            {/* Proceso */}
            <div className="flex items-center gap-2 min-w-0 flex-1 min-w-[280px]" ref={dropdownProcesoRef}>
              <label className="text-sm font-medium text-texto shrink-0">{t('etiquetaProceso')}:</label>
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  disabled={ejecutando || cargandoInicial}
                  onClick={() => setDropdownProcesoAbierto((v) => !v)}
                  className={`${selectClass} flex items-center justify-between gap-2 text-left`}
                >
                  <span className="truncate">
                    {(() => {
                      if (!procesoSel) return <span className="text-texto-muted">{t('sinValor')}</span>
                      const p = [...procesos, ...procesosCorregir].find((x) => x.codigo_proceso === procesoSel)
                      if (!p) return procesoSel
                      const flecha = p.estado_destino ? `${p.estado_origen || '—'} → ${p.estado_destino}` : ''
                      return (
                        <span>
                          {p.nombre_proceso}{flecha && <span className="text-xs text-texto-muted ml-1">({flecha})</span>}
                        </span>
                      )
                    })()}
                  </span>
                  <ChevronDown size={14} className="shrink-0 text-texto-muted" />
                </button>
                {dropdownProcesoAbierto && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-fondo border border-borde rounded-md shadow-lg py-1 max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro text-texto-muted"
                      onClick={() => { setProcesoSel(''); setCategoriaSel(null); setEstadoFiltro(''); setDropdownProcesoAbierto(false) }}
                    >
                      {t('sinValor')}
                    </button>
                    <div className="px-3 pt-2 pb-1 text-xs font-semibold text-texto-muted uppercase tracking-wide">{t('procesar')}</div>
                    {procesos.map((p) => {
                      const flecha = p.estado_destino ? `${p.estado_origen || '—'} → ${p.estado_destino}` : ''
                      const selec = procesoSel === p.codigo_proceso && categoriaSel !== 'CORREGIR'
                      return (
                        <button
                          key={p.codigo_proceso}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro flex items-baseline gap-1 ${selec ? 'bg-primario-muy-claro font-medium' : ''}`}
                          onClick={() => { setProcesoSel(p.codigo_proceso); setCategoriaSel('PROCESAR'); setEstadoFiltro(''); setDropdownProcesoAbierto(false) }}
                        >
                          <span className="text-texto">{p.nombre_proceso}</span>
                          {flecha && <span className="text-xs text-texto-muted">({flecha})</span>}
                        </button>
                      )
                    })}
                    {procesosCorregir.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-texto-muted uppercase tracking-wide border-t border-borde mt-1">{t('corregirInvalidos')}</div>
                        {procesosCorregir.map((p) => {
                          const flecha = p.estado_destino ? `${p.estado_origen || '—'} → ${p.estado_destino}` : ''
                          const selec = procesoSel === p.codigo_proceso && categoriaSel === 'CORREGIR'
                          return (
                            <button
                              key={`CORREGIR:${p.codigo_proceso}`}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro flex items-baseline gap-1 ${selec ? 'bg-primario-muy-claro font-medium' : ''}`}
                              onClick={() => { setProcesoSel(p.codigo_proceso); setCategoriaSel('CORREGIR'); setEstadoFiltro(''); setDropdownProcesoAbierto(false) }}
                            >
                              <span className="text-texto">{p.nombre_proceso}</span>
                              {flecha && <span className="text-xs text-texto-muted">({flecha})</span>}
                            </button>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ubicación */}
            <div className="flex items-center gap-2 min-w-0 flex-1 min-w-[280px]" ref={ubicDropdownRef}>
              <label className="text-sm font-medium text-texto shrink-0">{t('etiquetaUbicacion')}:</label>
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => !ejecutando && setUbicDropdownOpen(!ubicDropdownOpen)}
                  disabled={ejecutando}
                  className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors w-full disabled:opacity-50"
                >
                  <FolderOpen size={16} className={ubicacionSel ? 'text-primario shrink-0' : 'text-texto-muted shrink-0'} />
                  <span className="flex-1 text-left truncate">
                    {ubicacionSel
                      ? (ubicaciones.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion || t('seleccionarUbicacion'))
                      : t('todasUbicaciones')}
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
                    <div className="p-2 border-b border-borde shrink-0">
                      <input
                        type="text"
                        placeholder={t('buscarUbicacion')}
                        value={ubicBusqueda}
                        onChange={(e) => setUbicBusqueda(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm border border-borde rounded px-2 py-1 bg-fondo text-texto focus:outline-none focus:ring-1 focus:ring-primario placeholder:text-texto-muted"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <div
                        className="px-3 py-2 hover:bg-fondo cursor-pointer text-sm text-texto-muted border-b border-borde"
                        onClick={() => { setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                      >
                        {t('todasUbicaciones')}
                      </div>
                      {(() => {
                        const tieneHijosUbic = (cod: string) => ubicaciones.some(u => u.codigo_ubicacion !== cod && u.codigo_ubicacion_superior === cod)
                        if (ubicBusqueda) {
                          const filtradas = ubicaciones.filter(u =>
                            u.nombre_ubicacion.toLowerCase().includes(ubicBusqueda.toLowerCase()) ||
                            (u.url || '').toLowerCase().includes(ubicBusqueda.toLowerCase())
                          )
                          if (filtradas.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">{t('sinCoincidencias')}</div>
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
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-amber-400' : 'text-sky-500'}`} />
                                <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
                              </div>
                            )
                          })
                        }
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
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-amber-400' : 'text-sky-500'}`} />
                                <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
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

            {/* Estado */}
            <div className="flex items-center gap-2 min-w-0 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-texto shrink-0">{t('etiquetaEstado')}:</label>
              <select
                value={estadoFiltro}
                onChange={(e) => {
                  setEstadoFiltro(e.target.value)
                  setYaCargado(false)
                }}
                className={`${selectClass} flex-1 min-w-0`}
                disabled={ejecutando}
              >
                <option value="">{t('todosEstadoLabel')}</option>
                {(() => {
                  const validos = estadosDocs.filter(e => !e.codigo_estado_doc.startsWith('NO_') && !['REVISAR','ELIMINADO'].includes(e.codigo_estado_doc))
                  const noValidos = estadosDocs.filter(e => e.codigo_estado_doc.startsWith('NO_') || ['REVISAR','ELIMINADO'].includes(e.codigo_estado_doc))
                  return (
                    <>
                      {validos.map((e) => <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>{e.nombre_estado || e.codigo_estado_doc}</option>)}
                      {noValidos.length > 0 && validos.length > 0 && <option disabled>──────────────</option>}
                      {noValidos.map((e) => <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>{e.nombre_estado || e.codigo_estado_doc}</option>)}
                    </>
                  )
                })()}
              </select>
            </div>

            {/* Filtro libre */}
            <div className="flex items-center gap-2 min-w-0 flex-1 min-w-[220px]">
              <label className="text-sm font-medium text-texto shrink-0">{t('filtroLibreLabel')}:</label>
              <div className="flex gap-2 flex-1 min-w-0">
                <input
                  type="text"
                  placeholder={t('filtroLibrePlaceholder')}
                  value={filtroLibreInput}
                  onChange={(e) => setFiltroLibreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFiltroLibre(filtroLibreInput)
                      setYaCargado(false)
                    }
                  }}
                  disabled={ejecutando}
                  className="flex-1 min-w-0 text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
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

            {/* Paralelo */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium text-texto shrink-0">{t('paralelo')}:</label>
              <input
                type="number"
                min={1}
                max={100}
                value={nParallelEdit}
                onChange={(e) => setNParallelEdit(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={guardarNParallel}
                onKeyDown={(e) => e.key === 'Enter' && guardarNParallel()}
                disabled={ejecutando || guardandoParalel}
                className="w-16 text-sm border border-borde rounded-lg px-2 py-2 text-center bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50"
              />
              {guardandoParalel && <Loader2 className="w-3 h-3 animate-spin text-texto-muted" />}
            </div>

            {/* Tope */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium text-texto shrink-0">{t('tope')}:</label>
              <input
                type="number"
                min={1}
                placeholder={t('todosPlaceholder')}
                value={tope}
                onChange={(e) => setTope(e.target.value)}
                disabled={ejecutando}
                className="w-20 text-sm border border-borde rounded-lg px-2 py-2 text-center bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
              />
            </div>

            {pasoActual?.estado_destino === 'ESCANEADO' && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={generarResumen}
                  onChange={(e) => setGenerarResumen(e.target.checked)}
                  disabled={ejecutando}
                  className="w-3.5 h-3.5 accent-primario disabled:opacity-50 cursor-pointer"
                />
                <span className="text-xs text-texto-muted">{t('generarResumen')}</span>
              </label>
            )}
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
                  Eliminar índices sin archivo ({docsSinDisco.length})
                </Boton>
              )}
              <Boton variante="primario" onClick={ejecutar}
                disabled={ejecutando || (!!procesoSel && escaneandoDir) || !procesoSel}>
                {(ejecutando || (!!procesoSel && escaneandoDir)) ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {(!!procesoSel && escaneandoDir) ? 'Escaneando…' : ejecutando ? t('ejecutando') : t('ejecutar')}
              </Boton>
              <Boton variante="contorno" onClick={detener} disabled={!ejecutando && !(!!procesoSel && escaneandoDir)}>
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
                  <TablaTh className="w-80">
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
                            tooltip={t('tooltipAbrirUrl')}
                            href={ubic}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                            <ExternalLink size={15} />
                          </LinkAccion>
                        )}
                        {ubic && !esUrl && (
                          <BotonAccion
                            tooltip={t('tooltipAbrirArchivo')}
                            onClick={() => abrirArchivoDesdeCola(c)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                            <FileText size={15} />
                          </BotonAccion>
                        )}
                        {ubic && (
                          <BotonAccion
                            tooltip={t('tooltipDescargar')}
                            onClick={() => descargarDocumento(ubic, c.nombre_documento, userId, grupoActivo)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                            <Download size={15} />
                          </BotonAccion>
                        )}
                        <BotonAccion
                          tooltip={t('tooltipVerDetalle')}
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

      {/* Estadísticas del pipeline — sólo la primera tarjeta de fase, sobre la grilla de documentos */}
      <PipelineNarrativo
        antesDeEmpezar={{
          carpetaNombre: carpetaSel,
          documentos: totalDocs,
          onEmpezar: ejecutar,
          textoBotonEmpezar: t('narrativoEmpezar') ?? 'Empezar',
          deshabilitado: ejecutando || !procesoSel,
        }}
        fases={fasesUI.slice(0, 1)}
        resumen={resumenPipeline}
        archivos={[]}
        ejecutando={ejecutando}
        onDetener={detener}
        porQueTexto={t('narrativoPorQue') ?? ''}
        mostrarAntesDeEmpezar={false}
        mostrarProgresoYResumen={false}
      />

      {/* Lista de documentos candidatos (visible cuando NO está ejecutando — antes y después).
          Durante la ejecución se oculta para no buscar más registros mientras corre el lote. */}
      {!ejecutando && (
        <>
          {/* Paginación superior */}
          {totalDocs > DOCS_POR_PAGINA_DEFAULT && (
            <div className="flex items-center justify-between text-xs text-texto-muted">
              <span>
                {(paginaDoc - 1) * DOCS_POR_PAGINA_DEFAULT + 1}–{Math.min(paginaDoc * DOCS_POR_PAGINA_DEFAULT, totalDocs)} de {totalDocs}
              </span>
              <div className="flex gap-1">
                <button disabled={paginaDoc <= 1} onClick={() => { setPaginaDoc(1); if (!esModoClienteSide) cargarDocumentos(1) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                <button disabled={paginaDoc <= 1} onClick={() => { const p = paginaDoc - 1; setPaginaDoc(p); if (!esModoClienteSide) cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                <span className="px-3 py-1">{paginaDoc} / {totalPaginasDoc}</span>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { const p = paginaDoc + 1; setPaginaDoc(p); if (!esModoClienteSide) cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { setPaginaDoc(totalPaginasDoc); if (!esModoClienteSide) cargarDocumentos(totalPaginasDoc) }}
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
                    ? esCargar
                      ? 'Sin documentos cargados aún. Presiona Ejecutar para escanear el directorio.'
                      : (pasoActual?.estado_origen || estadoFiltro)
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
                          tooltip={t('tooltipAbrirUrl')}
                          href={d.ubicacion_documento}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                          <ExternalLink size={15} />
                        </LinkAccion>
                      )}
                      {d.ubicacion_documento && !/^https?:\/\//i.test(d.ubicacion_documento) && (
                        <BotonAccion
                          tooltip={t('tooltipAbrirArchivo')}
                          onClick={() => abrirDocumentoLocal(d)}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                          <FileText size={15} />
                        </BotonAccion>
                      )}
                      {d.ubicacion_documento && (
                        <BotonAccion
                          tooltip={t('tooltipDescargar')}
                          onClick={() => descargarDocumento(d.ubicacion_documento, d.nombre_documento, userId, grupoActivo)}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                          <Download size={15} />
                        </BotonAccion>
                      )}
                      <BotonAccion
                        tooltip={t('tooltipVerDetalle')}
                        onClick={() => abrirDetalle(d)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                        <Eye size={15} />
                      </BotonAccion>
                      <BotonAccion
                        tooltip={t('tooltipQuitarBd')}
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
                        {docsSinDisco.length} {docsSinDisco.length === 1 ? 'índice sin archivo en el directorio seleccionado' : 'índices sin archivo en el directorio seleccionado'} — no se procesarán
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
                            tooltip={t('tooltipVerDetalle')}
                            onClick={() => abrirDetalle(d)}
                            className="p-1.5 rounded-lg hover:bg-fondo text-texto-muted hover:text-primario transition-colors">
                            <Eye size={15} />
                          </BotonAccion>
                          <BotonAccion
                            tooltip={t('tooltipEliminar')}
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
                <button disabled={paginaDoc <= 1} onClick={() => { setPaginaDoc(1); if (!esModoClienteSide) cargarDocumentos(1) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                <button disabled={paginaDoc <= 1} onClick={() => { const p = paginaDoc - 1; setPaginaDoc(p); if (!esModoClienteSide) cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                <span className="px-3 py-1">{paginaDoc} / {totalPaginasDoc}</span>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { const p = paginaDoc + 1; setPaginaDoc(p); if (!esModoClienteSide) cargarDocumentos(p) }}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                <button disabled={paginaDoc >= totalPaginasDoc} onClick={() => { setPaginaDoc(totalPaginasDoc); if (!esModoClienteSide) cargarDocumentos(totalPaginasDoc) }}
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
                      {new Date(c.fecha_cola).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}
                    </TablaTd>
                    <TablaTd className="text-sm text-center">{c.intentos}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <BotonAccion
                          tooltip={t('tooltipEliminar')}
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
          setCategoriaSel('PROCESAR')
          if (tope) setTope(String(tope))
          if (ubicacion) setUbicacionSel(ubicacion)
          ejecutar()
        }}
        onCambiarEstado={(estadoOrigen, estadoDestino, ubicacion, topeVal) => {
          setEstadoFiltro(estadoOrigen)
          const matchP = procesos.find((p) => p.estado_origen === estadoOrigen && p.estado_destino === estadoDestino)
          const matchC = procesosCorregir.find((p) => p.estado_origen === estadoOrigen && p.estado_destino === estadoDestino)
          if (matchP) { setProcesoSel(matchP.codigo_proceso); setCategoriaSel('PROCESAR') }
          else if (matchC) { setProcesoSel(matchC.codigo_proceso); setCategoriaSel('CORREGIR') }
          if (ubicacion) setUbicacionSel(ubicacion)
          if (topeVal) setTope(String(topeVal))
        }}
      />

      {/* ── Modal confirmación antes de cargar documentos desde filesystem ── */}
      <ModalConfirmar
        abierto={!!pendingCarga}
        alCerrar={cancelarCarga}
        alConfirmar={confirmarCarga}
        titulo={t('confirmarCargaTitulo')}
        mensaje={pendingCarga
          ? `Se encontraron ${pendingCarga.archivosParaCargar.length.toLocaleString()} archivos en "${pendingCarga.scan.nombreRaiz}". ¿Continuar con la carga?`
          : ''}
        textoConfirmar={t('confirmarCargar')}
      />

      <ModalConfirmar
        abierto={!!confirmEliminarDoc}
        alCerrar={() => { setConfirmEliminarDoc(null); setEliminandoDoc(false) }}
        alConfirmar={ejecutarEliminarDoc}
        titulo={t('eliminarDocTitulo')}
        mensaje={confirmEliminarDoc ? `¿Eliminar "${confirmEliminarDoc.nombre_documento}"? Esta acción no se puede deshacer.` : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminandoDoc}
      />

      <ModalConfirmar
        abierto={confirmEliminarBulkSinDisco}
        alCerrar={() => { setConfirmEliminarBulkSinDisco(false); setEliminandoBulkSinDisco(false) }}
        alConfirmar={ejecutarEliminarBulkSinDisco}
        titulo={t('eliminarIndicesTitulo')}
        mensaje={`¿Eliminar los índices de ${docsSinDisco.length} documento(s) que no están en el directorio? Esta acción no se puede deshacer.`}
        textoConfirmar={tc('eliminar')}
        cargando={eliminandoBulkSinDisco}
      />

      {/* ── Modal detalle de documento (componente compartido) ─────────── */}
      <DocumentoDetalleModal
        documento={docDetalle}
        abierto={!!docDetalle}
        alCerrar={() => setDocDetalle(null)}
        userId={userId}
        grupoActivo={grupoActivo}
      />
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
