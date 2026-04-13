'use client'

import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Play, FileText, CheckCircle, XCircle, Loader2, FolderOpen, Clock, Square, Search, CheckSquare, SquareIcon, Trash2, AlertTriangle, ListOrdered, Cpu, Eye, ExternalLink } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Modal } from '@/components/ui/modal'
import { documentosApi, ubicacionesDocsApi, colaEstadosDocsApi, estadosDocsApi, procesosApi, parametrosApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, ColaEstadoDoc, EstadoDoc, CategoriaConCaracteristicasDocs } from '@/lib/tipos'
import { extraerTextoDeArchivo, abrirArchivoPorRuta, PdfProtegidoError, ArchivoNoEscaneable } from '@/lib/extraer-texto'

import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle, ensureReadPermission } from '@/lib/file-handle-store'
import { TabPipelineTodo } from './_components/tab-pipeline-todo'
import { ChatProcesar } from './_components/chat-procesar'
import { useColaRealtime } from '@/hooks/useColaRealtime'

const ESTADO_COLA_CONFIG: Record<string, { variante: 'exito' | 'error' | 'advertencia' | 'neutro'; icono: typeof Clock }> = {
  PENDIENTE: { variante: 'neutro', icono: Clock },
  EN_PROCESO: { variante: 'advertencia', icono: Play },
  COMPLETADO: { variante: 'exito', icono: CheckCircle },
  ERROR: { variante: 'error', icono: AlertTriangle },
}

// Código especial fuera del catálogo: reset de docs en NO_ESCANEABLE/NO_ENCONTRADO.
const PROCESO_RESTABLECER = '__RESTABLECER__'
type TabDetalle = 'datos' | 'caracteristicas' | 'chunks'
const ESTADOS_CON_CHUNKS = new Set(['CHUNKEADO', 'VECTORIZADO'])

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
  const t = useTranslations('procesarDocumentos')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()
  const searchParams = useSearchParams()
  // Estado del doc desde el que viene el dashboard (ej. "METADATA")
  const estadoDesdeUrl = searchParams.get('estado')

  // Tabs
  const [modoPipeline, setModoPipeline] = useState<'paso-a-paso' | 'todo'>('paso-a-paso')
  const [tab, setTab] = useState<'procesar' | 'cola'>('procesar')

  // Config
  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([])
  const [procesoSel, setProcesoSel] = useState<string>('')   // codigo_proceso del catálogo o PROCESO_RESTABLECER
  const [nParallelEdit, setNParallelEdit] = useState<number>(10)
  const [guardandoParalel, setGuardandoParalel] = useState(false)
  const [tope, setTope] = useState<string>('')  // vacío = sin tope (procesa todo)
  const [estadoFiltro, setEstadoFiltro] = useState<string>('')  // override de estado para la lista
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
  const [ubicacionSel, setUbicacionSel] = useState('')

  // Paso actual derivado del proceso seleccionado (primer paso por ahora).
  // Trae estado_origen/estado_destino y define el flujo a ejecutar.
  const pasoActual = useMemo(() => {
    if (procesoSel === PROCESO_RESTABLECER) return null
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
    return p?.pasos?.[0] || null
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
  const esExtraer = pasoActual?.estado_destino === 'METADATA'

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

  // Modal detalle documento (inline, reemplaza navegación a /documentos)
  const [docDetalle, setDocDetalle] = useState<Documento | null>(null)
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

  // Cargar procesos (catálogo), ubicaciones y parámetro de niveles
  useEffect(() => {
    const init = async () => {
      const [procsRaw, u, nivelParam, estados] = await Promise.all([
        procesosApi.listar('DOCUMENTOS').catch(() => []),
        ubicacionesDocsApi.listar().catch(() => []),
        parametrosApi.obtenerValor('DOCUMENTOS', 'NIVELES_DIRECTORIO').catch(() => null),
        estadosDocsApi.listar().catch(() => []),
      ])
      setEstadosDocs(estados as EstadoDoc[])
      if (nivelParam?.valor != null) {
        const n = parseInt(nivelParam.valor, 10)
        if (!isNaN(n) && n >= 0 && n <= 5) setNivelesDirectorio(n)
      }
      // Solo procesos con al menos un paso y que no sean CARGAR (CARGAR se
      // dispara automáticamente desde el módulo Cargar Docs, no desde aquí).
      const procs = (procsRaw || []).filter((p) => p.pasos && p.pasos.length > 0 && p.codigo_proceso !== 'CARGAR')
      setProcesos(procs)

      // Si venimos del dashboard con ?estado=XXX, seleccionar el proceso cuyo
      // estado_origen coincide. Estados terminales → RESTABLECER.
      const TERMINALES = ['NO_ESCANEABLE', 'NO_ENCONTRADO']
      if (estadoDesdeUrl) {
        if (TERMINALES.includes(estadoDesdeUrl)) {
          setProcesoSel(PROCESO_RESTABLECER)
        } else {
          const match = procs.find((p) => p.pasos?.[0]?.estado_origen === estadoDesdeUrl)
          if (match) setProcesoSel(match.codigo_proceso)
          else if (procs.length > 0) setProcesoSel(procs[0].codigo_proceso)
        }
      }
      // No default: el selector parte en blanco para usar la pantalla como visor

      setUbicaciones(
        (u as UbicacionOption[])
          .filter((x: UbicacionOption) => (x as UbicacionOption & { activo?: boolean }).activo !== false)
          .sort((a: UbicacionOption, b: UbicacionOption) => (a.ruta_completa || '').localeCompare(b.ruta_completa || ''))
      )
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Cargar documentos candidatos según el proceso seleccionado
  const cargarDocumentos = useCallback(async () => {
    // Requiere proceso seleccionado O filtro de estado manual
    if (!procesoSel && !estadoFiltro) return
    setCargando(true)
    try {
      let todos: Documento[]
      const estadoOverride = estadoFiltro || null
      if (estadoOverride) {
        // Filtro manual de estado — ignora el proceso seleccionado
        todos = await documentosApi.listar({ codigo_estado_doc: estadoOverride, activo: true, q: busqueda.trim() || undefined })
      } else if (esRestablecer) {
        // Restablecer: listar documentos en NO_ESCANEABLE + NO_ENCONTRADO
        const [a, b] = await Promise.all([
          documentosApi.listar({ codigo_estado_doc: 'NO_ESCANEABLE', activo: true, q: busqueda.trim() || undefined }),
          documentosApi.listar({ codigo_estado_doc: 'NO_ENCONTRADO', activo: true, q: busqueda.trim() || undefined }),
        ])
        todos = [...a, ...b]
      } else if (pasoActual?.estado_origen) {
        // Filtrar por el estado_origen del paso actual del proceso seleccionado
        todos = await documentosApi.listar({
          codigo_estado_doc: pasoActual.estado_origen,
          activo: true,
          q: busqueda.trim() || undefined,
        })
      } else {
        todos = []
      }
      let filtrados = todos

      if (ubicacionSel) {
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
  }, [procesoSel, esRestablecer, pasoActual, ubicacionSel, ubicaciones, busqueda, estadoFiltro])

  // Resetear lista cuando cambian filtros de proceso/alcance/ubicación.
  // Si se seleccionó un estado explícito, auto-cargar inmediatamente.
  // Nota: a proposito NO incluimos `busqueda` en las deps; eso lo maneja el
  // boton/Enter del filtro para no re-cargar con cada tecla.
  useEffect(() => {
    setDocumentos([])
    setSeleccionados(new Set())
    setYaCargado(false)
    if (estadoFiltro) {
      cargarDocumentos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoSel, ubicacionSel, estadoFiltro])

  const toggleSeleccion = (id: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const docsFiltrados = documentos.filter((d) => {
    // El filtro por archivos del filesystem solo aplica a EXTRAER (operación client-side).
    // Para otros procesos el directorio es solo un filtro lógico de ubicación (ya aplicado
    // en cargarDocumentos vía alcance=ubicacion / ubicacionSel).
    if (esExtraer && archivosEnDir && !archivosEnDir.has(d.nombre_documento)) return false
    if (busqueda && !d.nombre_documento.toLowerCase().includes(busqueda.toLowerCase()) &&
        !(d.ubicacion_documento || '').toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  // Cuando se escanea un directorio en modo EXTRAER, marcar automáticamente los encontrados
  useEffect(() => {
    if (esExtraer && archivosEnDir) {
      const ids = documentos.filter((d) => archivosEnDir.has(d.nombre_documento)).map((d) => d.codigo_documento)
      setSeleccionados(new Set(ids))
    }
  }, [esExtraer, archivosEnDir, documentos])

  const seleccionarTodos = () => setSeleccionados(new Set(docsFiltrados.map((d) => d.codigo_documento)))
  const deseleccionarTodos = () => setSeleccionados(new Set())

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
    if (!procesoSel || procesoSel === PROCESO_RESTABLECER) return
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

  const abrirDetalle = useCallback((d: Documento) => {
    setDocDetalle(d)
    setTabDetalle('datos')
    setCategoriasConCaract([])
    setChunksData(null)
    setBusquedaChunk('')
    setBusquedaChunkInput('')
    setPaginaChunk(1)
    cargarCaracteristicas(d.codigo_documento)
  }, [cargarCaracteristicas])

  const abrirDocumentoLocal = async (d: Documento) => {
    if (!d.ubicacion_documento) return
    const handle = await idbGetHandle()
    if (!handle) {
      alert('No hay carpeta raíz seleccionada. Selecciona el directorio raíz en esta pantalla primero.')
      return
    }
    const ok = await ensureReadPermission(handle)
    if (!ok) { alert('Permiso de lectura denegado.'); return }
    try {
      const fileHandle = await abrirArchivoPorRuta(handle, d.ubicacion_documento)
      if (!fileHandle) { alert(`No se encontró: ${d.ubicacion_documento}`); return }
      const file = await fileHandle.getFile()
      const url = URL.createObjectURL(file)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      alert(`Error al abrir: ${e instanceof Error ? e.message : e}`)
    }
  }

  const ejecutarEliminarDoc = async () => {
    if (!confirmEliminarDoc) return
    setEliminandoDoc(true)
    try {
      await documentosApi.desactivar(confirmEliminarDoc.codigo_documento)
      setSeleccionados((prev) => { const s = new Set(prev); s.delete(confirmEliminarDoc.codigo_documento); return s })
      setDocumentos((prev) => prev.filter((d) => d.codigo_documento !== confirmEliminarDoc!.codigo_documento))
      setConfirmEliminarDoc(null)
    } finally {
      setEliminandoDoc(false)
    }
  }

  //     con /cola-estados-docs/ejecutar + polling. El navegador ya no corre
  //     el loop LLM.
  const ejecutar = async () => {
    // EXTRAER y RESTABLECER requieren selección explícita.
    // Para procesos LLM (ANALIZAR, CHUNKEAR, VECTORIZAR) se puede ejecutar sin
    // selección: el worker backend ya tiene ítems en la cola y los procesa todos.
    if (seleccionados.size === 0 && (esExtraer || esRestablecer)) return

    setEjecutando(true)
    setProcesados(0)
    setCola([])
    abortRef.current = false

    // ── RESTABLECER ───────────────────────────────────────────────────────
    if (esRestablecer) {
      try {
        const ids = Array.from(seleccionados)
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
      // Obtener handle efectivo siguiendo la jerarquía:
      // 1. Handle ya activo en estado (permiso vigente)
      // 2. Handle guardado en IndexedDB + requestPermission (pequeño banner del browser, NO el Finder)
      // 3. Solo como último recurso: showDirectoryPicker (abre el Finder)
      // La raíz correcta es la ubicación con nivel mínimo del árbol de ubicaciones_docs.
      let handleEfectivo = dirHandle
      if (!handleEfectivo || !(await ensureReadPermission(handleEfectivo))) {
        // Intentar handle guardado en IndexedDB
        const stored = await idbGetHandle()
        if (stored && (await ensureReadPermission(stored))) {
          handleEfectivo = stored
          setDirHandle(stored)
        } else {
          // Último recurso: abrir Finder
          // El hint de texto en pantalla indica la ruta raíz del árbol de ubicaciones.
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

      const ids = Array.from(seleccionados)
      const colaInicial: ItemCola[] = ids.map((id) => {
        const doc = documentos.find((d) => d.codigo_documento === id)
        return {
          id_cola: id,  // usamos codigo_documento como id para visualización
          codigo_documento: id,
          nombre_documento: doc?.nombre_documento || `Doc #${id}`,
          ubicacion_documento: doc?.ubicacion_documento || undefined,
          estado_cola: 'PENDIENTE',
        }
      })
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
              const contenido = await extraerTextoDeArchivo(fileHandle)
              if (contenido === null) {
                await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: ext || 'desconocido' })
                setCola((prev) => prev.map((c, j) => j === idx ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (.${ext})`, tiempo_ms: Date.now() - t0 } : c))
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
                  caracteres: contenido.length,  // tamaño original para info
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
        // Leer estado final de la cola para decidir si recargar
        // Usamos un callback de setState para acceder al valor más reciente
        setCola((colaFinal) => {
          const hayErrores = colaFinal.some((c) => c.estado_cola === 'ERROR')
          if (!hayErrores) {
            cargarDocumentos()
          }
          return colaFinal
        })
      }
      return
    }

    // ── LLM (RESUMIR, ESCANEAR, …): worker backend + polling ──────────────
    if (!pasoActual) {
      setEjecutando(false)
      return
    }
    const estadoDestino = pasoActual.estado_destino

    // 1. Encolar — usar inicializarPorEstado para evitar el límite de 1000 filas de Supabase.
    // El backend consulta directamente todos los docs en el estado origen sin restricciones.
    const estadoOrigen = pasoActual.estado_origen
    try {
      if (estadoOrigen) {
        const ubicacionFiltro = ubicacionSel ? ubicacionSel : null
        await colaEstadosDocsApi.inicializarPorEstado(estadoOrigen, estadoDestino, undefined, tope ? parseInt(tope) : null, ubicacionFiltro)
      } else {
        // Fallback: encolar solo los seleccionados (no debería ocurrir en procesos normales)
        const items = Array.from(seleccionados).map((id) => ({
          codigo_documento: id,
          codigo_estado_doc_destino: estadoDestino,
        }))
        await colaEstadosDocsApi.inicializar(items)
      }
    } catch {
      setEjecutando(false)
      return
    }

    // 2. Cargar cola inicial para mostrar en UI.
    // Para procesos LLM mostramos TODOS los ítems activos del grupo para ese
    // destino, independientemente de qué docs tenga el usuario seleccionados en
    // la tabla. El worker backend procesa todos los PENDIENTE; limitar por
    // seleccionados hacía que la UI quedara vacía cuando los ítems ya existían
    // en la cola (encolados=0) y los docs seleccionados no coincidían con los
    // de la cola (ej. docs filtrados por nombre vs cola completa).
    const pendientes = await colaEstadosDocsApi.listar()
    const misItems = pendientes.filter((p) =>
      p.codigo_estado_doc_destino === estadoDestino,
    )
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
      await colaEstadosDocsApi.ejecutar(estadoDestino)
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
          const actual = await colaEstadosDocsApi.listar()
          const mapa = new Map(actual.filter((c) => idsSet.has(c.id_cola)).map((c) => [c.id_cola, c]))
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
    <div className="flex flex-col gap-6 w-full overflow-x-hidden">
      <div>
        <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Selector de modo: Paso a Paso / Pipeline Completo */}
      <div className="flex gap-2">
        <Boton variante={modoPipeline === 'paso-a-paso' ? 'primario' : 'contorno'} onClick={() => setModoPipeline('paso-a-paso')}>
          <ListOrdered size={16} />{t('tabPasoAPaso')}
        </Boton>
        <Boton variante={modoPipeline === 'todo' ? 'primario' : 'contorno'} onClick={() => setModoPipeline('todo')}>
          <Cpu size={16} />{t('tabTodo')}
        </Boton>
      </div>

      {modoPipeline === 'todo' && <TabPipelineTodo />}

      {modoPipeline === 'paso-a-paso' && (<>
      {/* Tabs internas */}
      <div className="flex gap-1 border-b border-borde">
        <button
          onClick={() => setTab('procesar')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'procesar' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          <Cpu size={15} />{t('tabProcesar')}
        </button>
        <button
          onClick={() => setTab('cola')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'cola' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          <ListOrdered size={15} />{t('tabCola')}{colaBackend.length > 0 && ` (${colaBackend.length})`}
        </button>
      </div>

      {tab === 'procesar' && (<>
      {/* Configuración */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">{t('etiquetaProceso')}</label>
              <select value={procesoSel} onChange={(e) => setProcesoSel(e.target.value)} className={selectClass} disabled={ejecutando}>
                <option value="">— Solo ver documentos —</option>
                {procesos.map((p) => {
                  const paso = p.pasos?.[0]
                  const flecha = paso ? `${paso.estado_origen || '—'} → ${paso.estado_destino}` : ''
                  return (
                    <option key={p.codigo_proceso} value={p.codigo_proceso}>
                      {p.nombre_proceso} ({flecha})
                    </option>
                  )
                })}
                <option value={PROCESO_RESTABLECER}>Restablecer (NO_ESCANEABLE / NO_ENCONTRADO → CARGADO/METADATA)</option>
              </select>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {procesoSel && procesoSel !== PROCESO_RESTABLECER && (
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
                      className="w-14 text-xs border border-borde rounded px-1.5 py-0.5 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50"
                    />
                    {guardandoParalel && <Loader2 className="w-3 h-3 animate-spin text-texto-muted" />}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-texto-muted">Tope:</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="todos"
                    value={tope}
                    onChange={(e) => setTope(e.target.value)}
                    disabled={ejecutando}
                    className="w-20 text-xs border border-borde rounded px-1.5 py-0.5 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">Estado (lista)</label>
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
                      const match = procesos.find((p) => p.pasos?.[0]?.estado_origen === nuevoEstado)
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

            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">{t('etiquetaUbicacion')}</label>
              <select value={ubicacionSel} onChange={(e) => setUbicacionSel(e.target.value)} className={selectClass} disabled={ejecutando}>
                <option value="">{t('todas')}</option>
                {ubicaciones.map((u) => (
                  <option key={u.codigo_ubicacion} value={u.codigo_ubicacion}>
                    {'—'.repeat(u.nivel || 0)} {u.nombre_ubicacion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde flex-wrap">
            {/* Directorio: siempre visible si hay handle activo (filtra la lista),
                más el selector completo cuando el proceso es EXTRAER */}
            {(esExtraer || dirHandle) && (
              <>
                <Boton variante="contorno" tamano="sm" onClick={seleccionarDirectorio} disabled={ejecutando || escaneandoDir}>
                  {escaneandoDir ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                  {escaneandoDir ? t('escaneando') : dirHandle ? `📂 ${dirHandle.name}` : t('seleccionarDirectorio')}
                </Boton>
                {dirHandle && !escaneandoDir && (
                  <Boton variante="contorno" tamano="sm" onClick={limpiarDirectorio} disabled={ejecutando}>
                    {t('quitar')}
                  </Boton>
                )}
                {esExtraer && (
                  <>
                    <span className="text-xs text-texto-muted" title="Niveles del árbol de directorios a escanear (configurable en Parámetros → DOCUMENTOS/NIVELES_DIRECTORIO)">
                      {nivelesDirectorio === 0 ? t('soloRaiz') : t('hastaXNiveles', { n: nivelesDirectorio })}
                    </span>
                    {!dirHandle && (() => {
                      const raiz = ubicaciones.length > 0
                        ? ubicaciones.reduce((min, u) => u.nivel < min.nivel ? u : min, ubicaciones[0])
                        : null
                      return (
                        <span className="text-xs text-texto-muted">
                          {raiz?.ruta_completa
                            ? <>Al ejecutar se pedirá acceso al directorio. Selecciona la carpeta raíz: <strong className="text-texto">{raiz.ruta_completa.split('/').filter(Boolean)[0] ?? raiz.ruta_completa}</strong> (no subcarpetas).</>
                            : 'Al ejecutar se pedirá acceso al directorio raíz de los archivos.'}
                        </span>
                      )
                    })()}
                  </>
                )}
              </>
            )}
            {usaLLM && (
              <span className="text-xs text-texto-muted">
                {t('correrServidor')}
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              {!procesoSel && documentos.length > 0 && (
                <span className="text-xs text-amarillo-600 font-medium">Selecciona un proceso para ejecutar</span>
              )}
              <span className="text-sm text-texto-muted">
                {t('xDeYSeleccionados', { x: seleccionados.size, y: documentos.length })}{esExtraer && archivosEnDir && ` ${t('filtradoPorDirectorio')}`}
              </span>
              <Boton variante="primario" onClick={ejecutar}
                disabled={ejecutando || !procesoSel || ((esExtraer || esRestablecer) && seleccionados.size === 0)}>
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
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh className="w-10">{t('colEstado')}</TablaTh>
                  <TablaTh>{t('colDocumento')}</TablaTh>
                  <TablaTh>{t('colResultado')}</TablaTh>
                  <TablaTh className="w-20">{t('colTiempo')}</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {visibles.map((c) => (
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
          </>
        )
      })()}

      {/* Lista de documentos candidatos (visible antes de ejecución) */}
      {cola.length === 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm" onClick={seleccionarTodos} disabled={ejecutando || docsFiltrados.length === 0}>
                <CheckSquare size={14} />{t('todos')}
              </Boton>
              <Boton variante="contorno" tamano="sm" onClick={deseleccionarTodos} disabled={ejecutando || seleccionados.size === 0}>
                <SquareIcon size={14} />{t('ninguno')}
              </Boton>
            </div>
            <div className="max-w-sm flex-1">
              <Input
                placeholder={t('buscarPlaceholder')}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') cargarDocumentos() }}
                icono={<Search size={15} />}
              />
            </div>
            <Boton variante="contorno" tamano="sm" onClick={cargarDocumentos} disabled={cargando}>
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}{t('buscar')}
            </Boton>
          </div>
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh className="w-10" />
                <TablaTh>{t('colDocumento')}</TablaTh>
                <TablaTh>{t('colUbicacion')}</TablaTh>
                <TablaTh>{t('colEstado')}</TablaTh>
                <TablaTh className="w-32 text-right">{tc('acciones')}</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>{tc('cargando')}</TablaTd></TablaFila>
              ) : docsFiltrados.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                  {!yaCargado
                    ? t('escribirFiltro')
                    : documentos.length === 0
                    ? t('sinDocumentosEnEstado', { estado: pasoActual?.estado_origen || 'origen' })
                    : t('sinResultadosBusqueda')}
                </TablaTd></TablaFila>
              ) : docsFiltrados.map((d) => (
                <TablaFila key={d.codigo_documento}>
                  <TablaTd>
                    <input type="checkbox" checked={seleccionados.has(d.codigo_documento)}
                      onChange={() => toggleSeleccion(d.codigo_documento)} className="rounded border-borde" />
                  </TablaTd>
                  <TablaTd className="max-w-0 w-[40%]">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-texto-muted shrink-0" />
                      <span className="font-medium text-sm truncate" title={d.nombre_documento}>{d.nombre_documento}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted max-w-0 w-[30%] truncate" title={d.ubicacion_documento || ''}>{d.ubicacion_documento || '—'}</TablaTd>
                  <TablaTd>
                    <Insignia variante="advertencia">{d.codigo_estado_doc}</Insignia>
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      {d.ubicacion_documento && /^https?:\/\//i.test(d.ubicacion_documento) && (
                        <a href={d.ubicacion_documento} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                          title="Abrir URL">
                          <ExternalLink size={15} />
                        </a>
                      )}
                      {d.ubicacion_documento && !/^https?:\/\//i.test(d.ubicacion_documento) && (
                        <button
                          onClick={() => fetch(`http://localhost:27182/abrir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruta: d.ubicacion_documento }) }).catch(() => {})}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                          title="Abrir archivo local">
                          <FileText size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => abrirDetalle(d)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title="Ver detalle">
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmEliminarDoc(d)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                        title="Eliminar documento">
                        <Trash2 size={15} />
                      </button>
                    </div>
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
                        <button
                          onClick={() => setConfirmEliminar(c)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                          title={tc('eliminar')}
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

      {/* Chat de procesamiento */}
      <ChatProcesar
        procesos={procesos}
        ubicaciones={ubicaciones}
        estadosDocs={estadosDocs}
        onEjecutar={(proceso, tope, ubicacion) => {
          setProcesoSel(proceso)
          if (tope) setTope(String(tope))
          if (ubicacion) setUbicacionSel(ubicacion)
          ejecutar()
        }}
        onCambiarEstado={(estadoOrigen, estadoDestino, ubicacion, topeVal) => {
          setEstadoFiltro(estadoOrigen)
          const match = procesos.find((p) => p.pasos?.[0]?.estado_origen === estadoOrigen && p.pasos?.[0]?.estado_destino === estadoDestino)
          if (match) setProcesoSel(match.codigo_proceso)
          if (ubicacion) setUbicacionSel(ubicacion)
          if (topeVal) setTope(String(topeVal))
        }}
      />

      <ModalConfirmar
        abierto={confirmCerrar}
        alCerrar={() => setConfirmCerrar(false)}
        alConfirmar={ejecutarCerrarCola}
        titulo={t('cerrarColaTitulo')}
        mensaje={t('cerrarColaConfirm', { n: completadosCola })}
        textoConfirmar={t('eliminarCompletados')}
        cargando={cerrando}
      />
      <ModalConfirmar
        abierto={!!confirmEliminar}
        alCerrar={() => setConfirmEliminar(null)}
        alConfirmar={ejecutarEliminarItem}
        titulo={t('eliminarItemTitulo')}
        mensaje={confirmEliminar ? t('eliminarItemConfirm', { id: confirmEliminar.id_cola }) : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
      <ModalConfirmar
        abierto={!!confirmEliminarDoc}
        alCerrar={() => setConfirmEliminarDoc(null)}
        alConfirmar={ejecutarEliminarDoc}
        titulo="Eliminar documento"
        mensaje={confirmEliminarDoc ? `¿Eliminar "${confirmEliminarDoc.nombre_documento}"? Esta acción no se puede deshacer.` : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminandoDoc}
      />

      {/* ── Modal detalle de documento ─────────────────────────────────── */}
      <Modal
        abierto={!!docDetalle}
        alCerrar={() => setDocDetalle(null)}
        titulo={docDetalle ? docDetalle.nombre_documento : ''}
      >
        {docDetalle && (
          <div className="flex flex-col gap-4 w-[900px] max-w-full">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-borde -mt-2">
              {(['datos', 'caracteristicas'] as TabDetalle[]).map((tab) => (
                <button key={tab} onClick={() => setTabDetalle(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tabDetalle === tab ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
                  {tab === 'datos' ? 'Datos' : 'Características'}
                </button>
              ))}
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
                  <div className="col-span-12 md:col-span-5">
                    <p className="text-xs text-texto-muted mb-1">Nombre</p>
                    <p className="text-sm font-medium text-texto">{docDetalle.nombre_documento}</p>
                  </div>
                  <div className="col-span-12 md:col-span-7">
                    <p className="text-xs text-texto-muted mb-1">Ubicación</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-texto break-all">{docDetalle.ubicacion_documento || '—'}</p>
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
                  <div className="col-span-6 md:col-span-3">
                    <p className="text-xs text-texto-muted mb-1">Estado</p>
                    {docDetalle.codigo_estado_doc
                      ? <Insignia variante="primario">{docDetalle.codigo_estado_doc}</Insignia>
                      : <span className="text-sm text-texto-muted">—</span>}
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <p className="text-xs text-texto-muted mb-1">Tamaño</p>
                    <p className="text-sm text-texto">{docDetalle.tamano_kb != null ? `${docDetalle.tamano_kb} KB` : '—'}</p>
                  </div>
                  <div className="col-span-6 md:col-span-6">
                    <p className="text-xs text-texto-muted mb-1">Modificado</p>
                    <p className="text-sm text-texto">{docDetalle.fecha_modificacion ? new Date(docDetalle.fecha_modificacion).toLocaleString('es-CL') : '—'}</p>
                  </div>
                  {docDetalle.detalle_estado && (
                    <div className="col-span-12">
                      <p className="text-xs text-texto-muted mb-1">Detalle de estado</p>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 whitespace-pre-wrap">{docDetalle.detalle_estado}</div>
                    </div>
                  )}
                  {docDetalle.resumen_documento && (
                    <div className="col-span-12">
                      <p className="text-xs text-texto-muted mb-1">Resumen</p>
                      <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto whitespace-pre-wrap max-h-48 overflow-y-auto">{docDetalle.resumen_documento}</div>
                    </div>
                  )}
                </div>
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
