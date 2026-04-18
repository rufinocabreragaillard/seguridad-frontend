'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Play, FileText, CheckCircle, XCircle, Loader2, Clock, Square, Search, CheckSquare, SquareIcon, AlertTriangle, ListOrdered, Eye, ExternalLink, X, ChevronDown, ChevronRight, Copy, Check, MapPin } from 'lucide-react'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { documentosApi, ubicacionesDocsApi, colaEstadosDocsApi, procesosApi } from '@/lib/api'
import { getEstadosDocs } from '@/lib/catalogos'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, ColaEstadoDoc, EstadoDoc, CategoriaConCaracteristicasDocs } from '@/lib/tipos'
import { abrirDocumento } from '@/lib/abrir-documento'
import { useColaRealtime } from '@/hooks/useColaRealtime'

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

type TabDetalle = 'datos' | 'caracteristicas'

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

export default function PaginaRevertirProcesarDocs() {
  const { grupoActivo } = useAuth()

  // Config
  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([])
  const [errorCargaInicial, setErrorCargaInicial] = useState(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [procesoSel, setProcesoSel] = useState<string>('')
  const [nParallelEdit, setNParallelEdit] = useState<number>(10)
  const [guardandoParalel, setGuardandoParalel] = useState(false)
  const [tope, setTope] = useState<string>('')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('')
  const [filtroLibre, setFiltroLibre] = useState<string>('')
  const [filtroLibreInput, setFiltroLibreInput] = useState<string>('')
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicBusqueda, setUbicBusqueda] = useState('')
  const [ubicDropdownOpen, setUbicDropdownOpen] = useState(false)
  const [ubicExpandidos, setUbicExpandidos] = useState<Set<string>>(new Set())
  const ubicDropdownRef = useRef<HTMLDivElement>(null)

  // Paso actual derivado del proceso seleccionado
  const pasoActual = useMemo(() => {
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
    return p?.pasos?.[0] || null
  }, [procesos, procesoSel])

  // Sincronizar n_parallel con el proceso seleccionado
  useEffect(() => {
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
    if (p) setNParallelEdit(p.n_parallel ?? 10)
  }, [procesoSel, procesos])

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
  const abortRef = useRef(false)
  const resolveColaRef = useRef<(() => void) | null>(null)

  // Realtime
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

  // Tab Cola
  const [colaBackend, setColaBackend] = useState<ColaEstadoDoc[]>([])
  const [estadosDocs, setEstadosDocs] = useState<EstadoDoc[]>([])
  const [cargandoCola, setCargandoCola] = useState(false)
  const [busquedaCola, setBusquedaCola] = useState('')
  const [filtroEstadoCola, setFiltroEstadoCola] = useState('')
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<ColaEstadoDoc | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [confirmEliminarDoc, setConfirmEliminarDoc] = useState<Documento | null>(null)
  const [eliminandoDoc, setEliminandoDoc] = useState(false)

  const [paginaDoc, setPaginaDoc] = useState(1)
  const [filtroUbicacion, setFiltroUbicacion] = useState('')

  // Modal detalle documento
  const [docDetalle, setDocDetalle] = useState<Documento | null>(null)
  const [colaItemDetalle, setColaItemDetalle] = useState<ColaEstadoDoc | null>(null)
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('datos')
  const [categoriasConCaract, setCategoriasConCaract] = useState<CategoriaConCaracteristicasDocs[]>([])
  const [cargandoCaract, setCargandoCaract] = useState(false)

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

  // Cargar procesos de reversa (función REVERT_PROC_DOCS), ubicaciones y estados
  const cargarDatosIniciales = useCallback(async () => {
    setCargandoInicial(true)
    setErrorCargaInicial(false)
    try {
      const [procsRaw, u, estados] = await Promise.all([
        procesosApi.listar('DOCUMENTOS'),
        ubicacionesDocsApi.listar().catch(() => []),
        getEstadosDocs().catch(() => []),
      ])
      setEstadosDocs(estados as EstadoDoc[])
      const procs = (procsRaw || [])
        .filter((p: ProcesoCatalogo) => p.pasos && p.pasos.length > 0 && p.codigo_funcion === 'REVERT_PROC_DOCS')
        .sort((a: ProcesoCatalogo, b: ProcesoCatalogo) => (a.orden ?? 0) - (b.orden ?? 0))
      setProcesos(procs)

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

  // Cargar documentos candidatos según el proceso seleccionado
  const cargarDocumentos = useCallback(async () => {
    setCargando(true)
    try {
      let todos: Documento[]
      const estadoOverride = estadoFiltro || null
      const qBackend = busqueda.trim() || filtroLibre.trim() || undefined
      if (estadoOverride) {
        todos = await documentosApi.listar({ codigo_estado_doc: estadoOverride, activo: true, q: qBackend })
      } else if (pasoActual?.estado_origen) {
        const estadoOrigenFiltro = pasoActual.estado_origen
        const [docsRaw, idsInv] = await Promise.all([
          documentosApi.listar({ codigo_estado_doc: estadoOrigenFiltro, activo: true, q: qBackend }),
          colaEstadosDocsApi.idsInvalidos(estadoOrigenFiltro),
        ])
        const idsInvalidos = new Set(idsInv)
        todos = idsInvalidos.size > 0
          ? docsRaw.filter(d => !idsInvalidos.has(d.codigo_documento))
          : docsRaw
      } else {
        todos = await documentosApi.listar({ activo: true, q: qBackend })
      }

      let filtrados = todos
      if (filtroLibre.trim()) {
        const q = filtroLibre.trim().toLowerCase()
        filtrados = filtrados.filter((d) =>
          (d.codigo_estado_doc || '').toLowerCase().includes(q) ||
          (d.detalle_estado || '').toLowerCase().includes(q) ||
          (d.nombre_documento || '').toLowerCase().includes(q) ||
          (d.ubicacion_documento || '').toLowerCase().includes(q)
        )
      }

      if (ubicacionSel) {
        const ubic = ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)
        if (ubic?.ruta_completa) {
          filtrados = filtrados.filter((d) => d.ubicacion_documento?.startsWith(ubic.ruta_completa))
        }
      }

      setDocumentos(filtrados)
      setSeleccionados(new Set(filtrados.map((d) => d.codigo_documento)))
      setCola([])
      setYaCargado(true)
    } finally {
      setCargando(false)
    }
  }, [procesoSel, pasoActual, ubicacionSel, ubicaciones, busqueda, estadoFiltro, filtroLibre])

  useEffect(() => {
    setDocumentos([])
    setSeleccionados(new Set())
    setYaCargado(false)
    cargarDocumentos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoSel, ubicacionSel, estadoFiltro, filtroLibre])

  const toggleSeleccion = (id: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const docsFiltrados = documentos.filter((d) => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const coincide =
        d.nombre_documento.toLowerCase().includes(q) ||
        (d.ubicacion_documento || '').toLowerCase().includes(q) ||
        (d.codigo_estado_doc || '').toLowerCase().includes(q) ||
        (d.detalle_estado || '').toLowerCase().includes(q)
      if (!coincide) return false
    }
    if (filtroUbicacion && !(d.ubicacion_documento || '').toLowerCase().includes(filtroUbicacion.toLowerCase())) return false
    return true
  })

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(docsFiltrados.length / DOCS_POR_PAGINA_DEFAULT))
  const paginaActual = Math.min(paginaDoc, totalPaginas)
  const docsPaginados = docsFiltrados.slice((paginaActual - 1) * DOCS_POR_PAGINA_DEFAULT, paginaActual * DOCS_POR_PAGINA_DEFAULT)

  const seleccionarTodos = () => setSeleccionados(new Set(docsFiltrados.map((d) => d.codigo_documento)))
  const deseleccionarTodos = () => setSeleccionados(new Set())

  const guardarNParallel = async () => {
    if (!procesoSel) return
    setGuardandoParalel(true)
    try {
      const updated = await procesosApi.actualizar(procesoSel, { n_parallel: nParallelEdit })
      setProcesos((prev) => prev.map((p) => p.codigo_proceso === procesoSel ? { ...p, n_parallel: updated.n_parallel } : p))
    } finally {
      setGuardandoParalel(false)
    }
  }

  // Modal detalle de documento
  const cargarCaracteristicas = useCallback(async (idDocumento: number) => {
    setCargandoCaract(true)
    try {
      const data = await documentosApi.listarCaracteristicas(idDocumento)
      setCategoriasConCaract(data)
    } finally {
      setCargandoCaract(false)
    }
  }, [])

  const abrirDetalle = useCallback(async (d: Documento) => {
    setDocDetalle(d)
    setTabDetalle('datos')
    setCategoriasConCaract([])
    setColaItemDetalle(null)
    try {
      const itemsDoc = await colaEstadosDocsApi.porDocumento(d.codigo_documento)
      setColaItemDetalle(itemsDoc[0] ?? null)
    } catch { /* mostrar sin datos de cola */ }
    cargarCaracteristicas(d.codigo_documento)
  }, [cargarCaracteristicas])

  const abrirDocumentoLocal = (d: Documento) => abrirDocumento(d.ubicacion_documento)

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

  // Ejecutar proceso de reversa: siempre via cola + worker backend
  const ejecutar = async () => {
    if (!pasoActual) return

    setEjecutando(true)
    setProcesados(0)
    setCola([])
    abortRef.current = false

    const estadoDestino = pasoActual.estado_destino

    // 1. Encolar docs seleccionados
    try {
      let ids = Array.from(seleccionados)
      if (tope) ids = ids.slice(0, parseInt(tope))
      const items = ids.map((id) => ({
        codigo_documento: id,
        codigo_estado_doc_destino: estadoDestino,
      }))
      await colaEstadosDocsApi.inicializar(items)
    } catch {
      setEjecutando(false)
      return
    }

    // 2. Cargar cola inicial
    const idsSeleccionados = new Set(Array.from(seleccionados).slice(0, tope ? parseInt(tope) : undefined))
    const pendientes = await colaEstadosDocsApi.listar('PENDIENTE')
    const misItems = pendientes.filter((p) =>
      p.codigo_estado_doc_destino === estadoDestino && idsSeleccionados.has(p.codigo_documento),
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

    // 4. Esperar via Realtime
    const idsSet = new Set(colaInicial.map((c) => c.id_cola))
    const esperarCambio = () => new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolveColaRef.current = null
        resolve()
      }, 30_000)
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
        } catch { /* esperar próxima notificación */ }
      }
      desuscribirCola()
      setEjecutando(false)
      if (!abortRef.current) cargarDocumentos()
    }
    suscribirCola()
    poll()
  }

  const detener = () => {
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

  // Árbol de ubicaciones
  const ubicacionesRaiz = ubicaciones.filter((u) => !u.codigo_ubicacion_superior)
  const ubicacionesHijas = (codigoPadre: string) =>
    ubicaciones.filter((u) => u.codigo_ubicacion_superior === codigoPadre)

  const renderUbicacion = (u: UbicacionOption): React.ReactNode => {
    const hijas = ubicacionesHijas(u.codigo_ubicacion)
    const expandida = ubicExpandidos.has(u.codigo_ubicacion)
    const matchBusqueda = !ubicBusqueda || u.nombre_ubicacion.toLowerCase().includes(ubicBusqueda.toLowerCase()) || u.ruta_completa.toLowerCase().includes(ubicBusqueda.toLowerCase())
    if (!matchBusqueda && hijas.length === 0) return null
    return (
      <div key={u.codigo_ubicacion}>
        <button
          type="button"
          className={`flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm hover:bg-primario-muy-claro rounded transition-colors ${ubicacionSel === u.codigo_ubicacion ? 'bg-primario-muy-claro text-primario font-medium' : 'text-texto'}`}
          style={{ paddingLeft: `${(u.nivel ?? 0) * 12 + 8}px` }}
          onClick={() => {
            setUbicacionSel(u.codigo_ubicacion === ubicacionSel ? '' : u.codigo_ubicacion)
            setUbicDropdownOpen(false)
          }}
        >
          {hijas.length > 0 && (
            <span onClick={(e) => { e.stopPropagation(); setUbicExpandidos((prev) => { const s = new Set(prev); s.has(u.codigo_ubicacion) ? s.delete(u.codigo_ubicacion) : s.add(u.codigo_ubicacion); return s }) }}>
              {expandida ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}
          <span className="truncate">{u.nombre_ubicacion}</span>
        </button>
        {expandida && hijas.map((h) => renderUbicacion(h))}
      </div>
    )
  }

  // Tabs
  const [tabActiva, setTabActiva] = useState<'paso-a-paso' | 'cola'>('paso-a-paso')

  return (
    <div className="flex flex-col gap-6 w-full overflow-x-hidden">
      <div>
        <h2 className="text-xl font-semibold text-texto">Revertir Procesos Docs.</h2>
        <p className="text-sm text-texto-muted mt-1">Revierte documentos a estados anteriores del pipeline (ej. VECTORIZADO → CHUNKEADO, ESCANEADO → METADATA).</p>
      </div>

      {/* Tabs Proceso / Cola */}
      <div className="flex gap-2">
        <Boton variante={tabActiva === 'paso-a-paso' ? 'primario' : 'contorno'} onClick={() => setTabActiva('paso-a-paso')}>
          <ListOrdered size={16} />Proceso
        </Boton>
        <Boton variante={tabActiva === 'cola' ? 'primario' : 'contorno'} onClick={() => { setTabActiva('cola'); cargarCola() }}>
          Cola
          {colaBackend.length > 0 && (
            <Insignia variante="neutro">{colaBackend.length}</Insignia>
          )}
        </Boton>
      </div>

      {/* ── Tab Cola ──────────────────────────────────────────────────── */}
      {tabActiva === 'cola' && (
        <Tarjeta>
          <TarjetaContenido>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Buscar en cola…"
                  value={busquedaCola}
                  onChange={(e) => setBusquedaCola(e.target.value)}
                  className="flex-1 min-w-40"
                />
                <select value={filtroEstadoCola} onChange={(e) => setFiltroEstadoCola(e.target.value)} className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto">
                  <option value="">Todos los estados</option>
                  {Object.keys(ESTADO_COLA_CONFIG).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <Boton variante="contorno" onClick={cargarCola} disabled={cargandoCola}>
                  {cargandoCola ? <Loader2 size={14} className="animate-spin" /> : null}
                  Refrescar
                </Boton>
                {colaBackend.length > 0 && (
                  <Boton variante="contorno" tamano="sm" onClick={() => setConfirmCerrar(true)}>
                    Cerrar cola
                  </Boton>
                )}
              </div>
              {completadosCola > 0 && (
                <p className="text-xs text-texto-muted">{completadosCola} completados de {colaBackend.length} total</p>
              )}
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaTh>Documento</TablaTh>
                    <TablaTh>Destino</TablaTh>
                    <TablaTh>Estado</TablaTh>
                    <TablaTh>Resultado</TablaTh>
                    <TablaTh></TablaTh>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {colaFiltrada.map((item) => {
                    const cfg = ESTADO_COLA_CONFIG[item.estado_cola] || ESTADO_COLA_CONFIG.PENDIENTE
                    const IcoEstadoCola = cfg.icono
                    return (
                      <TablaFila key={item.id_cola}>
                        <TablaTd>{item.documentos?.nombre_documento || `Doc #${item.codigo_documento}`}</TablaTd>
                        <TablaTd><Insignia variante="neutro">{item.codigo_estado_doc_destino}</Insignia></TablaTd>
                        <TablaTd>
                          <Insignia variante={cfg.variante}>
                            <IcoEstadoCola size={12} />
                            {item.estado_cola}
                          </Insignia>
                        </TablaTd>
                        <TablaTd className="text-xs text-texto-muted max-w-xs truncate">{item.resultado || item.mensaje_error || '—'}</TablaTd>
                        <TablaTd>
                          <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmEliminar(item)}>
                            <XCircle size={14} />
                          </Boton>
                        </TablaTd>
                      </TablaFila>
                    )
                  })}
                  {colaFiltrada.length === 0 && (
                    <TablaFila>
                      <TablaTd colSpan={5} className="text-center text-texto-muted py-8">Sin ítems en cola</TablaTd>
                    </TablaFila>
                  )}
                </TablaCuerpo>
              </Tabla>
            </div>
          </TarjetaContenido>
        </Tarjeta>
      )}

      {/* ── Tab Proceso ───────────────────────────────────────────────── */}
      {tabActiva === 'paso-a-paso' && (<>
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
                <label className="text-sm font-medium text-texto">Proceso de Reversa</label>
                <select value={procesoSel} onChange={(e) => setProcesoSel(e.target.value)} className={selectClass} disabled={ejecutando || cargandoInicial}>
                  <option value="">— Sin valor —</option>
                  {procesos.map((p) => {
                    const paso = p.pasos?.[0]
                    const flecha = paso ? `${paso.estado_origen || '—'} → ${paso.estado_destino}` : ''
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
                  onChange={(e) => { setEstadoFiltro(e.target.value); setYaCargado(false) }}
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
                <label className="text-sm font-medium text-texto">Ubicación</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !ejecutando && setUbicDropdownOpen(!ubicDropdownOpen)}
                    disabled={ejecutando}
                    className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors w-full disabled:opacity-50"
                  >
                    <span className="flex-1 text-left truncate">
                      {ubicacionSel
                        ? (ubicaciones.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion || 'Seleccionar ubicación')
                        : 'Seleccionar ubicación'}
                    </span>
                    {ubicacionSel ? (
                      <X size={13} className="text-texto-muted hover:text-error shrink-0"
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
                          placeholder="Buscar ubicación…"
                          value={ubicBusqueda}
                          onChange={(e) => setUbicBusqueda(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm border border-borde rounded px-2 py-1 bg-fondo text-texto focus:outline-none focus:ring-1 focus:ring-primario placeholder:text-texto-muted"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto flex-1 p-1">
                        {ubicacionesRaiz.map((u) => renderUbicacion(u))}
                        {ubicaciones.length === 0 && (
                          <p className="text-xs text-texto-muted px-2 py-3 text-center">Sin ubicaciones</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Segunda fila: Tope + N parallel + Filtro texto */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Máx. a revertir</label>
                <Input
                  type="number"
                  placeholder="Sin límite"
                  value={tope}
                  onChange={(e) => setTope(e.target.value)}
                  min={1}
                  disabled={ejecutando}
                />
              </div>

              {procesoSel && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Paralelas</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={nParallelEdit}
                      onChange={(e) => setNParallelEdit(parseInt(e.target.value) || 1)}
                      min={1}
                      max={100}
                      disabled={ejecutando || guardandoParalel}
                      onBlur={guardarNParallel}
                      onKeyDown={(e) => e.key === 'Enter' && guardarNParallel()}
                      className="w-24"
                    />
                    {guardandoParalel && <Loader2 size={14} className="animate-spin text-texto-muted self-center" />}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Filtro libre</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Estado, nombre, ruta…"
                    value={filtroLibreInput}
                    onChange={(e) => setFiltroLibreInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setFiltroLibre(filtroLibreInput); setPaginaDoc(1) } }}
                    disabled={ejecutando}
                  />
                  <Boton variante="contorno" tamano="sm" onClick={() => { setFiltroLibre(filtroLibreInput); setPaginaDoc(1) }}>
                    <Search size={14} />
                  </Boton>
                  {filtroLibre && (
                    <Boton variante="fantasma" tamano="sm" onClick={() => { setFiltroLibre(''); setFiltroLibreInput('') }}>
                      <X size={14} />
                    </Boton>
                  )}
                </div>
              </div>
            </div>
          </TarjetaContenido>
        </Tarjeta>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center gap-3">
          <Boton
            variante="primario"
            onClick={ejecutar}
            disabled={ejecutando || !procesoSel || seleccionados.size === 0}
          >
            {ejecutando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Ejecutar{seleccionados.size > 0 ? ` (${seleccionados.size})` : ''}
          </Boton>
          <Boton variante="contorno" onClick={detener} disabled={!ejecutando}>
            <Square size={16} />Detener
          </Boton>
          <Boton variante="contorno" onClick={() => { cargarDocumentos(); setPaginaDoc(1) }} disabled={ejecutando || cargando}>
            {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </Boton>
          {yaCargado && (
            <>
              <Boton variante="fantasma" tamano="sm" onClick={seleccionarTodos}>
                <CheckSquare size={14} />Todo
              </Boton>
              <Boton variante="fantasma" tamano="sm" onClick={deseleccionarTodos}>
                <SquareIcon size={14} />Ninguno
              </Boton>
              <span className="text-sm text-texto-muted">{documentos.length} docs · {seleccionados.size} sel.</span>
            </>
          )}
          {cola.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              {okCount > 0 && <Insignia variante="exito"><CheckCircle size={12} />{okCount} ok</Insignia>}
              {errCount > 0 && <Insignia variante="error"><XCircle size={12} />{errCount} error</Insignia>}
              <span className="text-sm text-texto-muted">{procesados}/{cola.length}</span>
            </div>
          )}
        </div>

        {/* Lista de documentos */}
        {yaCargado && (
          <Tarjeta>
            <TarjetaContenido>
              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="Filtrar por nombre o ruta…"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setPaginaDoc(1) }}
                  className="flex-1"
                />
                <Input
                  placeholder="Filtrar por ubicación…"
                  value={filtroUbicacion}
                  onChange={(e) => { setFiltroUbicacion(e.target.value); setPaginaDoc(1) }}
                  className="flex-1"
                />
              </div>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaTh className="w-8">
                      <button onClick={() => seleccionados.size === docsFiltrados.length ? deseleccionarTodos() : seleccionarTodos()}>
                        {seleccionados.size === docsFiltrados.length && docsFiltrados.length > 0
                          ? <CheckSquare size={16} className="text-primario" />
                          : <SquareIcon size={16} className="text-texto-muted" />
                        }
                      </button>
                    </TablaTh>
                    <TablaTh>Documento</TablaTh>
                    <TablaTh>Ubicación</TablaTh>
                    <TablaTh>Estado</TablaTh>
                    <TablaTh>Cola</TablaTh>
                    <TablaTh></TablaTh>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {docsPaginados.map((doc) => {
                    const sel = seleccionados.has(doc.codigo_documento)
                    const itemCola = cola.find((c) => c.codigo_documento === doc.codigo_documento)
                    return (
                      <TablaFila key={doc.codigo_documento} className={sel ? 'bg-primario-muy-claro/40' : ''}>
                        <TablaTd>
                          <button onClick={() => toggleSeleccion(doc.codigo_documento)} type="button">
                            {sel
                              ? <CheckSquare size={16} className="text-primario" />
                              : <SquareIcon size={16} className="text-texto-muted" />
                            }
                          </button>
                        </TablaTd>
                        <TablaTd>
                          <div className="flex items-center gap-2">
                            {iconoTipoArchivo(doc.nombre_documento)}
                            <span className="truncate max-w-xs text-sm">{doc.nombre_documento}</span>
                          </div>
                        </TablaTd>
                        <TablaTd className="text-xs text-texto-muted max-w-xs truncate">
                          <div className="flex items-center gap-1">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{doc.ubicacion_documento || '—'}</span>
                            {doc.ubicacion_documento && <BotonCopiar texto={doc.ubicacion_documento} />}
                          </div>
                        </TablaTd>
                        <TablaTd>
                          <div className="flex flex-col gap-1">
                            <Insignia variante="neutro">{doc.codigo_estado_doc || '—'}</Insignia>
                            {doc.detalle_estado && (
                              <span className="text-xs text-error truncate max-w-28" title={doc.detalle_estado}>{doc.detalle_estado}</span>
                            )}
                          </div>
                        </TablaTd>
                        <TablaTd>
                          {itemCola && (
                            <div className="flex items-center gap-1.5">
                              {iconoEstado(itemCola.estado_cola)}
                              {itemCola.resultado && (
                                <span className="text-xs text-texto-muted truncate max-w-28" title={itemCola.resultado}>{itemCola.resultado}</span>
                              )}
                            </div>
                          )}
                        </TablaTd>
                        <TablaTd>
                          <div className="flex items-center gap-1">
                            <BotonAccion tooltip="Ver detalle" onClick={() => abrirDetalle(doc)} className="p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                              <Eye size={14} />
                            </BotonAccion>
                            {doc.ubicacion_documento?.startsWith('http') && (
                              <a href={doc.ubicacion_documento} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Abrir documento">
                                <ExternalLink size={14} />
                              </a>
                            )}
                            {doc.ubicacion_documento && !doc.ubicacion_documento.startsWith('http') && (
                              <BotonAccion tooltip="Abrir localmente" onClick={() => abrirDocumentoLocal(doc)} className="p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors">
                                <ExternalLink size={14} />
                              </BotonAccion>
                            )}
                            <BotonAccion tooltip="Eliminar" onClick={() => setConfirmEliminarDoc(doc)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors">
                              <XCircle size={14} />
                            </BotonAccion>
                          </div>
                        </TablaTd>
                      </TablaFila>
                    )
                  })}
                  {docsPaginados.length === 0 && (
                    <TablaFila>
                      <TablaTd colSpan={6} className="text-center text-texto-muted py-8">
                        {cargando ? 'Cargando documentos…' : 'Sin documentos para este proceso'}
                      </TablaTd>
                    </TablaFila>
                  )}
                </TablaCuerpo>
              </Tabla>
              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-texto-muted">
                    Mostrando {(paginaActual - 1) * DOCS_POR_PAGINA_DEFAULT + 1}–{Math.min(paginaActual * DOCS_POR_PAGINA_DEFAULT, docsFiltrados.length)} de {docsFiltrados.length}
                  </span>
                  <div className="flex gap-1">
                    <Boton variante="fantasma" tamano="sm" disabled={paginaActual === 1} onClick={() => setPaginaDoc(1)}>«</Boton>
                    <Boton variante="fantasma" tamano="sm" disabled={paginaActual === 1} onClick={() => setPaginaDoc(p => p - 1)}>‹</Boton>
                    <span className="px-3 py-1 text-sm text-texto">{paginaActual}/{totalPaginas}</span>
                    <Boton variante="fantasma" tamano="sm" disabled={paginaActual === totalPaginas} onClick={() => setPaginaDoc(p => p + 1)}>›</Boton>
                    <Boton variante="fantasma" tamano="sm" disabled={paginaActual === totalPaginas} onClick={() => setPaginaDoc(totalPaginas)}>»</Boton>
                  </div>
                </div>
              )}
            </TarjetaContenido>
          </Tarjeta>
        )}
      </>)}

      {/* Modal detalle documento */}
      {docDetalle && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 p-4" onClick={() => setDocDetalle(null)}>
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-4 border-b border-borde">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primario shrink-0" />
                  <h3 className="font-semibold text-texto truncate">{docDetalle.nombre_documento}</h3>
                </div>
                {docDetalle.ubicacion_documento && (
                  <p className="text-xs text-texto-muted mt-1 flex items-center gap-1 truncate">
                    <MapPin size={11} className="shrink-0" />
                    {docDetalle.ubicacion_documento}
                    <BotonCopiar texto={docDetalle.ubicacion_documento} />
                  </p>
                )}
              </div>
              <button onClick={() => setDocDetalle(null)} className="p-1 rounded hover:bg-fondo text-texto-muted ml-2">
                <X size={16} />
              </button>
            </div>

            {/* Tabs detalle */}
            <div className="flex gap-1 px-4 pt-3">
              {(['datos', 'caracteristicas'] as TabDetalle[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setTabDetalle(tab); if (tab === 'caracteristicas' && categoriasConCaract.length === 0) cargarCaracteristicas(docDetalle.codigo_documento) }}
                  className={`px-3 py-1.5 text-sm rounded-t border-b-2 transition-colors ${tabDetalle === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted hover:text-texto'}`}
                >
                  {tab === 'datos' ? 'Datos' : 'Características'}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tabDetalle === 'datos' && (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-texto-muted">ID:</span> <span className="font-mono">{docDetalle.codigo_documento}</span></div>
                    <div><span className="text-texto-muted">Estado:</span> <Insignia variante="neutro">{docDetalle.codigo_estado_doc || '—'}</Insignia></div>
                    <div><span className="text-texto-muted">Grupo:</span> {docDetalle.codigo_grupo || '—'}</div>
                    <div><span className="text-texto-muted">Entidad:</span> {docDetalle.codigo_entidad || '—'}</div>
                  </div>
                  {docDetalle.detalle_estado && (
                    <div className="p-2 bg-red-50 border border-red-100 rounded text-xs text-error">
                      {docDetalle.detalle_estado}
                    </div>
                  )}
                  {colaItemDetalle && (
                    <div className="p-2 bg-fondo border border-borde rounded text-xs flex flex-col gap-1">
                      <span className="font-medium">Último ítem de cola:</span>
                      <span>Destino: <Insignia variante="neutro">{colaItemDetalle.codigo_estado_doc_destino}</Insignia></span>
                      <span>Estado: {colaItemDetalle.estado_cola}</span>
                      {colaItemDetalle.resultado && <span>Resultado: {colaItemDetalle.resultado}</span>}
                      {colaItemDetalle.mensaje_error && <span className="text-error">{colaItemDetalle.mensaje_error}</span>}
                    </div>
                  )}
                </div>
              )}
              {tabDetalle === 'caracteristicas' && (
                <div className="flex flex-col gap-3">
                  {cargandoCaract && <Loader2 size={16} className="animate-spin text-primario mx-auto" />}
                  {!cargandoCaract && categoriasConCaract.length === 0 && (
                    <p className="text-sm text-texto-muted text-center py-4">Sin características</p>
                  )}
                  {categoriasConCaract.map((cat, i) => (
                    <div key={cat.categoria?.codigo_cat_docs || i} className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-texto">{cat.categoria?.nombre_cat_docs}</p>
                      {cat.caracteristicas?.map((c) => (
                        <div key={c.id_caracteristica_docs} className="flex justify-between text-sm">
                          <span className="text-texto-muted">{c.tipos_caract_docs?.nombre_tipo_docs || c.codigo_tipo_docs}</span>
                          <span className="font-medium">{c.valor_texto_docs || c.valor_numerico_docs?.toString() || c.valor_fecha_docs || '—'}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmaciones */}
      <ModalConfirmar
        abierto={confirmCerrar}
        titulo="Cerrar cola"
        mensaje="¿Confirmar cierre de toda la cola? Los ítems PENDIENTE y EN_PROCESO se eliminarán."
        onConfirmar={ejecutarCerrarCola}
        onCancelar={() => setConfirmCerrar(false)}
        cargando={cerrando}
        variante="advertencia"
      />
      <ModalConfirmar
        abierto={!!confirmEliminar}
        titulo="Eliminar ítem"
        mensaje={`¿Eliminar el ítem de cola del documento "${confirmEliminar?.documentos?.nombre_documento || confirmEliminar?.codigo_documento}"?`}
        onConfirmar={ejecutarEliminarItem}
        onCancelar={() => setConfirmEliminar(null)}
        cargando={eliminando}
        variante="error"
      />
      <ModalConfirmar
        abierto={!!confirmEliminarDoc}
        titulo="Eliminar documento"
        mensaje={`¿Eliminar "${confirmEliminarDoc?.nombre_documento}" de la lista? Esta acción lo desactiva en el sistema.`}
        onConfirmar={ejecutarEliminarDoc}
        onCancelar={() => setConfirmEliminarDoc(null)}
        cargando={eliminandoDoc}
        variante="error"
      />
    </div>
  )
}
