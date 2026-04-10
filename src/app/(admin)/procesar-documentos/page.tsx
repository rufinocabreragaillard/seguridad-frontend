'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Play, FileText, CheckCircle, XCircle, Loader2, FolderOpen, Clock, Square, Search, CheckSquare, SquareIcon, Trash2, AlertTriangle, ListOrdered, Cpu } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { documentosApi, ubicacionesDocsApi, colaEstadosDocsApi, estadosDocsApi, procesosApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, ColaEstadoDoc, EstadoDoc } from '@/lib/tipos'
import { extraerTextoDeArchivo, abrirArchivoPorRuta } from '@/lib/extraer-texto'

import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle, ensureReadPermission } from '@/lib/file-handle-store'

const ESTADO_COLA_CONFIG: Record<string, { variante: 'exito' | 'error' | 'advertencia' | 'neutro'; icono: typeof Clock }> = {
  PENDIENTE: { variante: 'neutro', icono: Clock },
  EN_PROCESO: { variante: 'advertencia', icono: Play },
  COMPLETADO: { variante: 'exito', icono: CheckCircle },
  ERROR: { variante: 'error', icono: AlertTriangle },
}

// Código especial fuera del catálogo: reset de docs en NO_ESCANEABLE/NO_ENCONTRADO.
const PROCESO_RESTABLECER = '__RESTABLECER__'
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
  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([])
  const [procesoSel, setProcesoSel] = useState<string>('')   // codigo_proceso del catálogo o PROCESO_RESTABLECER
  const [alcance, setAlcance] = useState<Alcance>('pendientes')
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
  const [ubicacionSel, setUbicacionSel] = useState('')

  // Paso actual derivado del proceso seleccionado (primer paso por ahora).
  // Trae estado_origen/estado_destino y define el flujo a ejecutar.
  const pasoActual = useMemo(() => {
    if (procesoSel === PROCESO_RESTABLECER) return null
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
    return p?.pasos?.[0] || null
  }, [procesos, procesoSel])

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

  // Cargar procesos (catálogo) y ubicaciones
  useEffect(() => {
    const init = async () => {
      const [procsRaw, u] = await Promise.all([
        procesosApi.listar('DOCUMENTOS').catch(() => []),
        ubicacionesDocsApi.listar().catch(() => []),
      ])
      // Solo procesos con al menos un paso y que no sean CARGAR (CARGAR se
      // dispara automáticamente desde el módulo Cargar Docs, no desde aquí).
      const procs = (procsRaw || []).filter((p) => p.pasos && p.pasos.length > 0 && p.codigo_proceso !== 'CARGAR')
      setProcesos(procs)
      if (procs.length > 0 && !procesoSel) setProcesoSel(procs[0].codigo_proceso)
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
    if (!procesoSel) return
    setCargando(true)
    try {
      let todos: Documento[]
      if (esRestablecer) {
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
  }, [procesoSel, esRestablecer, pasoActual, alcance, ubicacionSel, ubicaciones, busqueda])

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
    if (alcance === 'pendientes' && procesoSel) {
      cargarDocumentos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoSel, alcance, ubicacionSel])

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

  // Ejecutar: rama por tipo de proceso
  //   - RESTABLECER: una llamada al backend, sin cola.
  //   - EXTRAER (destino METADATA): loop client-side que lee el archivo con
  //     dirHandle y sube el texto al backend (POST /documentos/{id}/texto).
  //   - Procesos con LLM (RESUMIR, ESCANEAR): encola + dispara worker backend
  //     con /cola-estados-docs/ejecutar + polling. El navegador ya no corre
  //     el loop LLM.
  const ejecutar = async () => {
    if (seleccionados.size === 0) return

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
          nombre_documento: `Restablecidos: ${res.restablecidos} (${res.a_cargado} a CARGADO, ${res.a_resumido} a RESUMIDO)`,
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

      for (let i = 0; i < colaInicial.length; i++) {
        if (abortRef.current) break
        const item = colaInicial[i]
        setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'EN_PROCESO' } : c))

        const t0 = Date.now()
        try {
          if (!item.ubicacion_documento) {
            await documentosApi.subirTexto(item.codigo_documento, {
              texto_fuente: '', archivo_no_encontrado: true,
            })
            setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO (sin ubicación)', tiempo_ms: Date.now() - t0 } : c))
          } else {
            const fileHandle = await abrirArchivoPorRuta(handleEfectivo, item.ubicacion_documento)
            if (!fileHandle) {
              await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
              setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO', tiempo_ms: Date.now() - t0 } : c))
            } else {
              const ext = (item.ubicacion_documento.split('.').pop() || '').toLowerCase()
              const contenido = await extraerTextoDeArchivo(fileHandle)
              if (contenido === null) {
                await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: ext || 'desconocido' })
                setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (.${ext})`, tiempo_ms: Date.now() - t0 } : c))
              } else if (!contenido.trim()) {
                await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', contenido_vacio: true })
                setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'COMPLETADO', resultado: 'NO_ESCANEABLE (vacío)', tiempo_ms: Date.now() - t0 } : c))
              } else {
                const res = await documentosApi.subirTexto(item.codigo_documento, {
                  texto_fuente: contenido,
                  caracteres: contenido.length,
                })
                setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'COMPLETADO', resultado: `METADATA (${res.caracteres} chars)`, tiempo_ms: Date.now() - t0 } : c))
              }
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error'
          setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'ERROR', resultado: msg, tiempo_ms: Date.now() - t0 } : c))
        }
        setProcesados((p) => p + 1)
      }

      setEjecutando(false)
      // Solo recargar si el proceso terminó normalmente; si se abortó, dejar
      // la lista como está para que el usuario pueda relanzar con Ejecutar.
      if (!abortRef.current) cargarDocumentos()
      return
    }

    // ── LLM (RESUMIR, ESCANEAR, …): worker backend + polling ──────────────
    if (!pasoActual) {
      setEjecutando(false)
      return
    }
    const estadoDestino = pasoActual.estado_destino

    // 1. Encolar
    const items = Array.from(seleccionados).map((id) => ({
      codigo_documento: id,
      codigo_estado_doc_destino: estadoDestino,
    }))
    try {
      await colaEstadosDocsApi.inicializar(items)
    } catch {
      setEjecutando(false)
      return
    }

    // 2. Cargar cola inicial para mostrar en UI
    const pendientes = await colaEstadosDocsApi.listar()
    const misItems = pendientes.filter((p) =>
      seleccionados.has(p.codigo_documento) && p.codigo_estado_doc_destino === estadoDestino,
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

    // 4. Polling: cada 3 seg refresca el estado. Cuando ninguno está
    // PENDIENTE ni EN_PROCESO, termina.
    const idsSet = new Set(colaInicial.map((c) => c.id_cola))
    const poll = async () => {
      while (!abortRef.current) {
        await new Promise((r) => setTimeout(r, 3000))
        if (abortRef.current) break
        try {
          const actual = await colaEstadosDocsApi.listar()
          const mapa = new Map(actual.filter((c) => idsSet.has(c.id_cola)).map((c) => [c.id_cola, c]))
          let activos = 0
          setCola((prev) => prev.map((c) => {
            const nuevo = mapa.get(c.id_cola)
            if (!nuevo) return c
            if (nuevo.estado_cola === 'PENDIENTE' || nuevo.estado_cola === 'EN_PROCESO') activos++
            // Calcular tiempo_ms a partir de fechas si están disponibles
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
          // Si el polling falla, seguimos intentando un par de veces más.
        }
      }
      setEjecutando(false)
      if (!abortRef.current) cargarDocumentos()
    }
    poll()
  }

  const detener = () => {
    // "Detener" ahora solo corta el polling y el loop client-side de EXTRAER.
    // El worker backend sigue corriendo hasta terminar; el usuario puede
    // cerrar la pestaña y ver el avance más tarde en la tab Cola.
    abortRef.current = true
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Proceso</label>
              <select value={procesoSel} onChange={(e) => setProcesoSel(e.target.value)} className={selectClass} disabled={ejecutando}>
                {procesos.map((p) => {
                  const paso = p.pasos?.[0]
                  const flecha = paso ? `${paso.estado_origen || '—'} → ${paso.estado_destino}` : ''
                  return (
                    <option key={p.codigo_proceso} value={p.codigo_proceso}>
                      {p.nombre_proceso} ({flecha})
                    </option>
                  )
                })}
                <option value={PROCESO_RESTABLECER}>Restablecer (NO_ESCANEABLE / NO_ENCONTRADO → CARGADO/RESUMIDO)</option>
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
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde flex-wrap">
            {esExtraer && (
              <>
                <Boton variante="contorno" tamano="sm" onClick={seleccionarDirectorio} disabled={ejecutando || escaneandoDir}>
                  {escaneandoDir ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                  {escaneandoDir ? 'Escaneando...' : dirHandle ? `📂 ${dirHandle.name}` : 'Seleccionar directorio raíz'}
                </Boton>
                {dirHandle && !escaneandoDir && (
                  <Boton variante="contorno" tamano="sm" onClick={limpiarDirectorio} disabled={ejecutando}>
                    Quitar
                  </Boton>
                )}
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
            {usaLLM && (
              <span className="text-xs text-texto-muted">
                Corre en el servidor (modelo configurado por paso). Puedes cerrar la pestaña, el avance sigue.
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-texto-muted">
                {seleccionados.size}/{documentos.length} seleccionados{archivosEnDir && ` (filtrado por directorio)`}
              </span>
              <Boton variante="primario" onClick={ejecutar}
                disabled={ejecutando || seleccionados.size === 0 || !procesoSel}>
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
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}Buscar
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
                    ? 'Escribe un filtro y presiona Enter (vacío = todos) o haz clic en Buscar'
                    : documentos.length === 0
                    ? `No hay documentos en estado ${pasoActual?.estado_origen || 'origen'}`
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
