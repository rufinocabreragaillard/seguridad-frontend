'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { FolderOpen, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { CirculoProgreso } from '@/components/ui/circulo-progreso'
import { documentosApi, colaEstadosDocsApi, ubicacionesDocsApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { extraerTextoDeArchivo, abrirArchivoPorRuta, NECESITA_OCR, PdfProtegidoError, ArchivoNoEscaneable, type ExtraccionMixta } from '@/lib/extraer-texto'
import { getDirectoryHandle, setDirectoryHandle, ensureReadPermission } from '@/lib/file-handle-store'
import { useAuth } from '@/context/AuthContext'
import { useColaRealtime } from '@/hooks/useColaRealtime'
import type { EstadoDoc } from '@/lib/tipos'

const PASOS = [
  { key: 'EXTRAER',    nombre: 'EXTRAER',    estadoOrigen: 'CARGADO',   estadoDestino: 'METADATA',    colorDisco: '#EF4444', clienteSide: true },
  { key: 'ANALIZAR',   nombre: 'ANALIZAR',   estadoOrigen: 'METADATA',  estadoDestino: 'ESCANEADO',   colorDisco: '#F97316', clienteSide: false },
  { key: 'CHUNKEAR',   nombre: 'CHUNKEAR',   estadoOrigen: 'ESCANEADO', estadoDestino: 'CHUNKEADO',   colorDisco: '#84CC16', clienteSide: false },
  { key: 'VECTORIZAR', nombre: 'VECTORIZAR', estadoOrigen: 'CHUNKEADO', estadoDestino: 'VECTORIZADO', colorDisco: '#22C55E', clienteSide: false },
] as const

type EstadoPaso = 'esperando' | 'activo' | 'listo' | 'error'
interface ProgresoPaso { total: number; completados: number; estado: EstadoPaso; error?: string }

const progresosIniciales = (): Record<string, ProgresoPaso> =>
  Object.fromEntries(PASOS.map((p) => [p.key, { total: 0, completados: 0, estado: 'esperando' }]))

// Configuración de estados del pipeline para las estadísticas
const ESTADOS_PIPELINE = [
  { codigo: 'CARGADO',        nombre: 'Cargado',        color: '#6B7280' },
  { codigo: 'METADATA',       nombre: 'Metadata',       color: '#3B82F6' },
  { codigo: 'ESCANEADO',      nombre: 'Escaneado',      color: '#F97316' },
  { codigo: 'CHUNKEADO',      nombre: 'Chunkeado',      color: '#84CC16' },
  { codigo: 'VECTORIZADO',    nombre: 'Vectorizado',    color: '#22C55E' },
  { codigo: 'NO_ANALIZABLE',  nombre: 'No analizable',  color: '#EF4444' },
  { codigo: 'NO_ESCANEABLE',  nombre: 'No escaneable',  color: '#DC2626' },
] as const

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  ruta_completa: string
  nivel: number
  tipo_ubicacion?: 'AREA' | 'CONTENIDO'
  codigo_ubicacion_superior?: string
}

interface TabPipelineTodoProps {
  procesos?: ProcesoCatalogo[]
  estadosDocs?: EstadoDoc[]
  ubicaciones?: UbicacionOption[]
}

export function TabPipelineTodo({ procesos = [], estadosDocs = [], ubicaciones: ubicacionesProp = [] }: TabPipelineTodoProps) {
  const { grupoActivo } = useAuth()

  const [progresos, setProgresos] = useState<Record<string, ProgresoPaso>>(progresosIniciales)
  const [ejecutando, setEjecutando] = useState(false)
  const [dirHandle, setDirHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [mensajeError, setMensajeError] = useState('')
  const [carpetaRaiz, setCarpetaRaiz] = useState<string>('')

  // Filtros (Cambio 2)
  const [procesoFiltro, setProcesoFiltro] = useState<string>('')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('')
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicBusqueda, setUbicBusqueda] = useState('')
  const [ubicDropdownOpen, setUbicDropdownOpen] = useState(false)
  const [ubicExpandidos, setUbicExpandidos] = useState<Set<string>>(new Set())
  const [nParalelo, setNParalelo] = useState<number>(10)
  const [tope, setTope] = useState<string>('')
  const [filtroLibreInput, setFiltroLibreInput] = useState<string>('')
  const [filtroLibre, setFiltroLibre] = useState<string>('')
  const ubicDropdownRef = useRef<HTMLDivElement>(null)

  // Modo reversa
  const [revertir, setRevertir] = useState(false)
  const [progresoRevertir, setProgresoRevertir] = useState<{ total: number; revertidos: number; estado: 'esperando' | 'activo' | 'listo' | 'error' }>({ total: 0, revertidos: 0, estado: 'esperando' })
  const [mensajeRevertir, setMensajeRevertir] = useState('')

  // Estadísticas por estado (Cambio 4)
  const [conteosPorEstado, setConteosPorEstado] = useState<Record<string, number>>({})

  const abortRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveColaRef = useRef<(() => void) | null>(null)

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

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ubicDropdownRef.current && !ubicDropdownRef.current.contains(e.target as Node)) {
        setUbicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (ejecutando && tiempoInicio) {
      timerRef.current = setInterval(() => {
        setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [ejecutando, tiempoInicio])

  const cargarConteos = useCallback(async () => {
    try {
      const conteos = await documentosApi.contarPorEstado()
      setConteosPorEstado(conteos as Record<string, number>)
      setProgresos((prev) => {
        const next = { ...prev }
        for (const paso of PASOS) {
          next[paso.key] = { ...next[paso.key], total: (conteos as Record<string, number>)[paso.estadoOrigen] ?? 0, completados: 0, estado: 'esperando' }
        }
        return next
      })
    } catch { /* ignorar */ }
  }, [])

  useEffect(() => {
    getDirectoryHandle().then((h) => { if (h) setDirHandleState(h) })
    cargarConteos()
    ubicacionesDocsApi.listar().then((ubs) => {
      if (!ubs?.length) return
      const raiz = (ubs as { nivel: number; ruta_completa?: string }[])
        .reduce((min, u) => u.nivel < min.nivel ? u : min, ubs[0] as { nivel: number; ruta_completa?: string })
      const nombre = raiz?.ruta_completa?.split('/').filter(Boolean)[0] ?? ''
      if (nombre) setCarpetaRaiz(nombre)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  const seleccionarDirectorio = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
      setDirHandleState(handle)
      await setDirectoryHandle(handle)
    } catch { /* usuario canceló */ }
  }

  const setPaso = (key: string, patch: Partial<ProgresoPaso>) =>
    setProgresos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const ejecutarExtraer = async (): Promise<boolean> => {
    const params: Record<string, unknown> = { codigo_estado_doc: 'CARGADO' }
    if (ubicacionSel) params.codigo_ubicacion = ubicacionSel
    if (filtroLibre.trim()) params.q = filtroLibre.trim()
    const topeNum = tope ? parseInt(tope) : 0
    const docs = await documentosApi.listar(params as Parameters<typeof documentosApi.listar>[0])
    const docsFinal = topeNum > 0 ? docs.slice(0, topeNum) : docs
    if (docsFinal.length === 0) { setPaso('EXTRAER', { estado: 'listo' }); return true }

    // Solo pedimos handle cuando hay docs CARGADO que necesitan lectura física
    let handle = dirHandle
    if (!handle || !(await ensureReadPermission(handle))) {
      const stored = await getDirectoryHandle()
      if (stored && (await ensureReadPermission(stored))) {
        handle = stored; setDirHandleState(stored); await setDirectoryHandle(stored)
      } else {
        try {
          handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
          setDirHandleState(handle); await setDirectoryHandle(handle)
        } catch {
          // Sin permiso: marcar todos como no encontrados
          for (const doc of docsFinal) {
            await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true }).catch(() => {})
          }
          setPaso('EXTRAER', { completados: docsFinal.length, estado: 'listo' })
          return true
        }
      }
    }

    setPaso('EXTRAER', { total: docsFinal.length, completados: 0, estado: 'activo' })
    let completados = 0
    for (const doc of docsFinal) {
      if (abortRef.current) return false
      try {
        const t0 = Date.now()
        if (!doc.ubicacion_documento) {
          await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
        } else {
          const fileHandle = await abrirArchivoPorRuta(handle, doc.ubicacion_documento)
          if (!fileHandle) {
            await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
          } else {
            const ext = (doc.ubicacion_documento.split('.').pop() || '').toLowerCase()
            const tExtraccion = Date.now()
            const contenidoRaw = await extraerTextoDeArchivo(fileHandle)
            const subDuracionMs = Date.now() - tExtraccion
            // Normalizar ExtraccionMixta (PDF con páginas imagen)
            let contenido: string | typeof NECESITA_OCR | null
            let paginasImagen: ExtraccionMixta['paginasImagen'] | undefined
            if (typeof contenidoRaw === 'object' && contenidoRaw !== null && 'paginasImagen' in contenidoRaw) {
              contenido = (contenidoRaw as ExtraccionMixta).texto
              paginasImagen = (contenidoRaw as ExtraccionMixta).paginasImagen
            } else {
              contenido = contenidoRaw as string | typeof NECESITA_OCR | null
            }
            if (contenido === null || contenido === NECESITA_OCR) {
              await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', formato_no_soportado: ext })
            } else if (!contenido.trim() && !paginasImagen?.length) {
              await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', contenido_vacio: true })
            } else {
              await documentosApi.subirTexto(doc.codigo_documento, {
                texto_fuente: contenido,
                caracteres: contenido.length,
                fecha_inicio_extraccion: new Date(t0).toISOString(),
                sub_duracion_ms: subDuracionMs,
                ...(paginasImagen ? { paginas_imagen: paginasImagen } : {}),
              })
            }
          }
        }
      } catch (e) {
        if (e instanceof PdfProtegidoError) {
          await documentosApi.subirTexto(doc.codigo_documento, {
            texto_fuente: '', detalle_error: 'PDF protegido con contraseña (desproteger el archivo antes de procesar)',
          }).catch(() => {})
        } else if (e instanceof ArchivoNoEscaneable) {
          await documentosApi.subirTexto(doc.codigo_documento, {
            texto_fuente: '', detalle_error: e.message,
          }).catch(() => {})
        }
        // Otros errores (red, permisos): silencioso para no cortar el loop
      }
      completados++
      setPaso('EXTRAER', { completados })
    }
    setPaso('EXTRAER', { completados: docsFinal.length, estado: 'listo' })
    return true
  }

  const ejecutarPasoBackend = async (key: string, estadoOrigen: string, estadoDestino: string): Promise<boolean> => {
    const params: Record<string, unknown> = { codigo_estado_doc: estadoOrigen }
    if (ubicacionSel) params.codigo_ubicacion = ubicacionSel
    if (filtroLibre.trim()) params.q = filtroLibre.trim()
    const topeNum = tope ? parseInt(tope) : 0
    const docsRaw = await documentosApi.listar(params as Parameters<typeof documentosApi.listar>[0])
    const docs = topeNum > 0 ? docsRaw.slice(0, topeNum) : docsRaw
    if (docs.length === 0) { setPaso(key, { estado: 'listo' }); return true }
    setPaso(key, { total: docs.length, completados: 0, estado: 'activo' })
    const items = docs.map((d) => ({ codigo_documento: d.codigo_documento, codigo_estado_doc_destino: estadoDestino }))
    await colaEstadosDocsApi.inicializar(items, { codigo_proceso: key })
    await colaEstadosDocsApi.ejecutar(estadoDestino, { codigo_proceso: key })

    const idsSet = new Set(docs.map((d) => d.codigo_documento))

    const refrescarCola = async (): Promise<{ activos: number; completados: number }> => {
      const cola = await colaEstadosDocsApi.listar(undefined, estadoDestino)
      const propios = cola.filter((c) => idsSet.has(c.codigo_documento))
      const activos = propios.filter((c) => c.estado_cola === 'PENDIENTE' || c.estado_cola === 'EN_PROCESO').length
      const completados = propios.filter((c) => c.estado_cola === 'COMPLETADO').length
      setPaso(key, { completados })
      return { activos, completados }
    }

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

    try {
      const { activos } = await refrescarCola()
      if (activos === 0) {
        setPaso(key, { completados: docs.length, estado: 'listo' })
        return true
      }
    } catch { /* continuar */ }

    while (!abortRef.current) {
      await esperarCambio()
      if (abortRef.current) return false
      try {
        const { activos } = await refrescarCola()
        if (activos === 0) break
      } catch { /* reintentar en próxima notificación */ }
    }

    if (abortRef.current) return false
    setPaso(key, { completados: docs.length, estado: 'listo' })
    return true
  }

  // Estados que corresponden al paso VECTORIZAR (éxito + inválido del mismo paso)
  // NO incluye NO_CHUNKEADO (eso es del paso anterior)
  const ESTADOS_VECTORIZAR = ['VECTORIZADO', 'NO_VECTORIZADO'] as const

  const ejecutarRevertir = async () => {
    setMensajeError('')
    setMensajeRevertir('')
    abortRef.current = false
    setEjecutando(true)
    setTiempoInicio(Date.now())
    setTiempoTranscurrido(0)
    setProgresoRevertir({ total: 0, revertidos: 0, estado: 'activo' })
    try {
      const filtrosBase: Record<string, unknown> = {}
      if (ubicacionSel) filtrosBase.codigo_ubicacion = ubicacionSel
      if (filtroLibre.trim()) filtrosBase.q = filtroLibre.trim()
      const topeNum = tope ? parseInt(tope) : 0

      // Buscar documentos en VECTORIZADO y NO_VECTORIZADO (ambos estados del paso VECTORIZAR)
      const [docsVect, docsNoVect] = await Promise.all([
        documentosApi.listar({ ...filtrosBase, codigo_estado_doc: 'VECTORIZADO' } as Parameters<typeof documentosApi.listar>[0]),
        documentosApi.listar({ ...filtrosBase, codigo_estado_doc: 'NO_VECTORIZADO' } as Parameters<typeof documentosApi.listar>[0]),
      ])
      const docsRaw = [...docsVect, ...docsNoVect]
      const docs = topeNum > 0 ? docsRaw.slice(0, topeNum) : docsRaw

      if (docs.length === 0) {
        setProgresoRevertir({ total: 0, revertidos: 0, estado: 'listo' })
        setMensajeRevertir('No hay documentos en estado VECTORIZADO ni NO_VECTORIZADO con los filtros aplicados.')
        return
      }
      setProgresoRevertir({ total: docs.length, revertidos: 0, estado: 'activo' })
      const ids = docs.map((d) => d.codigo_documento)
      const resultado = await documentosApi.revertirEstado(ids, [...ESTADOS_VECTORIZAR], 'CHUNKEADO')
      setProgresoRevertir({ total: docs.length, revertidos: resultado.revertidos, estado: 'listo' })
      setMensajeRevertir(`${resultado.revertidos} documento(s) revertidos a CHUNKEADO (VECTORIZADO: ${docsVect.length}, NO_VECTORIZADO: ${docsNoVect.length}).`)
    } catch (e) {
      setProgresoRevertir((prev) => ({ ...prev, estado: 'error' }))
      setMensajeError(e instanceof Error ? e.message : 'Error al revertir estado')
    } finally {
      setEjecutando(false)
      await cargarConteos()
    }
  }

  const ejecutarPipeline = async () => {
    setMensajeError('')
    abortRef.current = false
    setEjecutando(true)
    setTiempoInicio(Date.now())
    setTiempoTranscurrido(0)
    setProgresos(progresosIniciales())
    suscribirCola()
    try {
      for (const paso of PASOS) {
        if (abortRef.current) break
        const ok = paso.clienteSide
          ? await ejecutarExtraer()
          : await ejecutarPasoBackend(paso.key, paso.estadoOrigen, paso.estadoDestino)
        if (!ok) break
      }
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : 'Error inesperado en el pipeline')
    } finally {
      desuscribirCola()
      setEjecutando(false)
      await cargarConteos()
    }
  }

  const detener = () => {
    abortRef.current = true
    if (resolveColaRef.current) {
      resolveColaRef.current()
      resolveColaRef.current = null
    }
  }

  const formatTiempo = (seg: number) => {
    const m = Math.floor(seg / 60)
    const s = seg % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const todosListos = PASOS.every((p) => progresos[p.key]?.estado === 'listo')

  // Render árbol de ubicaciones para el dropdown (igual que procesar-documentos)
  const tieneHijosUbic = (cod: string) => ubicacionesProp.some(u => u.codigo_ubicacion !== cod && u.codigo_ubicacion_superior === cod)

  const toggleExpandirUbic = (e: React.MouseEvent, cod: string) => {
    e.stopPropagation()
    setUbicExpandidos(prev => { const next = new Set(prev); next.has(cod) ? next.delete(cod) : next.add(cod); return next })
  }

  const renderNodoDropdown = (u: UbicacionOption): React.ReactNode => {
    const tieneHijos = tieneHijosUbic(u.codigo_ubicacion)
    const expandido = ubicExpandidos.has(u.codigo_ubicacion)
    const esArea = u.tipo_ubicacion === 'AREA'
    const selec = ubicacionSel === u.codigo_ubicacion
    const hijos = tieneHijos
      ? ubicacionesProp
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
        {expandido && hijos.map(h => renderNodoDropdown(h))}
      </div>
    )
  }

  const raicesUbic = ubicacionesProp
    .filter(u => !u.codigo_ubicacion_superior)
    .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  return (
    <div className="flex flex-col gap-6">

      {/* ── Filtros (Cambio 2) ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-borde bg-fondo-tarjeta p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-texto-muted uppercase">Filtros del pipeline</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ubicación */}
          <div className="flex flex-col gap-1.5" ref={ubicDropdownRef}>
            <label className="text-sm font-medium text-texto">Ubicación</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => !ejecutando && setUbicDropdownOpen(!ubicDropdownOpen)}
                disabled={ejecutando}
                className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto hover:border-primario transition-colors w-full disabled:opacity-50"
              >
                <FolderOpen size={15} className={ubicacionSel ? 'text-primario shrink-0' : 'text-texto-muted shrink-0'} />
                <span className="flex-1 text-left truncate">
                  {ubicacionSel
                    ? (ubicacionesProp.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion ?? 'Seleccionar ubicación')
                    : 'Seleccionar ubicación'}
                </span>
                {ubicacionSel ? (
                  <X size={13} className="text-texto-muted hover:text-error shrink-0" onClick={(e) => { e.stopPropagation(); setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }} />
                ) : (
                  <ChevronDown size={13} className="text-texto-muted shrink-0" />
                )}
              </button>
              {ubicDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-borde rounded-lg shadow-lg flex flex-col" style={{ maxHeight: '16rem' }}>
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
                  <div className="overflow-y-auto flex-1">
                    <div className="px-3 py-2 hover:bg-fondo cursor-pointer text-sm text-texto-muted border-b border-borde" onClick={() => { setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }}>
                      Todas las ubicaciones
                    </div>
                    {ubicBusqueda ? (
                      (() => {
                        const filtradas = ubicacionesProp.filter(u =>
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
                      })()
                    ) : (
                      raicesUbic.length === 0
                        ? <div className="px-3 py-4 text-sm text-texto-muted text-center">Sin ubicaciones</div>
                        : raicesUbic.map(u => renderNodoDropdown(u))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Checkbox Revertir */}
        <div className="flex items-center gap-3 pt-1 border-t border-borde">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={revertir}
              onChange={(e) => {
                setRevertir(e.target.checked)
                setMensajeRevertir('')
                setProgresoRevertir({ total: 0, revertidos: 0, estado: 'esperando' })
              }}
              disabled={ejecutando}
              className="w-4 h-4 rounded border-borde text-amber-600 focus:ring-amber-500 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-texto">Revertir</span>
          </label>
          {revertir && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Cambiará documentos <strong>VECTORIZADO → CHUNKEADO</strong> (solo UPDATE, sin reprocesar)
            </span>
          )}
        </div>

        {/* Segunda fila: Paralelo + Tope + Filtro libre */}
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-texto-muted font-medium">Paralelo</label>
            <input
              type="number"
              min={1}
              max={100}
              value={nParalelo}
              onChange={(e) => setNParalelo(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={ejecutando}
              className="w-16 text-sm border border-borde rounded-lg px-2 py-1.5 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-texto-muted font-medium">Tope</label>
            <input
              type="number"
              min={1}
              placeholder="todos"
              value={tope}
              onChange={(e) => setTope(e.target.value)}
              disabled={ejecutando}
              className="w-20 text-sm border border-borde rounded-lg px-2 py-1.5 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs text-texto-muted font-medium">Filtro libre</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Filtrar por nombre, directorio… (Enter para aplicar)"
                value={filtroLibreInput}
                onChange={(e) => setFiltroLibreInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setFiltroLibre(filtroLibreInput) }}
                disabled={ejecutando}
                className="flex-1 text-sm border border-borde rounded-lg px-3 py-1.5 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
              />
              {filtroLibreInput && (
                <button type="button" onClick={() => { setFiltroLibreInput(''); setFiltroLibre('') }} disabled={ejecutando} className="px-2 rounded-lg border border-borde text-texto-muted hover:text-error hover:border-error transition-colors disabled:opacity-50">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Selector de directorio ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-texto-muted">
          Ejecuta el pipeline completo: Extraer → Analizar → Chunkear → Vectorizar
        </p>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={seleccionarDirectorio}
            className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors"
          >
            <FolderOpen size={16} className={dirHandle ? 'text-primario' : 'text-texto-muted'} />
            {dirHandle ? dirHandle.name : 'Seleccionar directorio'}
          </button>
          {!dirHandle && carpetaRaiz && (
            <span className="text-xs text-texto-muted text-right">
              Al ejecutar se pedirá acceso. Selecciona: <strong className="text-texto">{carpetaRaiz}</strong> (no subcarpetas)
            </span>
          )}
        </div>
      </div>

      {mensajeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {/* ── Pipeline visual ────────────────────────────────────────────────── */}
      {!revertir ? (
        /* Modo normal: 4 círculos hacia adelante */
        <div className="flex items-center justify-center gap-0 flex-wrap">
          {PASOS.map((paso, i) => {
            const prog = progresos[paso.key]
            return (
              <div key={paso.key} className="flex items-center">
                <CirculoProgreso
                  nombre={paso.nombre}
                  total={prog.total}
                  completados={prog.completados}
                  estado={prog.estado}
                  colorDisco={paso.colorDisco}
                  size={99}
                />
                {i < PASOS.length - 1 && (
                  <div className="flex items-center self-center px-1">
                    <svg width="48" height="24" viewBox="0 0 48 24">
                      <line x1="0" y1="12" x2="34" y2="12" stroke="#9CA3AF" strokeWidth="6" strokeLinecap="round" />
                      <polygon points="30,4 46,12 30,20" fill="#9CA3AF" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Modo reversa: indicador VECTORIZADO ← CHUNKEADO */
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            {/* Círculo VECTORIZADO (origen) */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${progresoRevertir.estado === 'activo' ? 'animate-pulse' : ''}`}
                style={{
                  borderColor: '#22C55E',
                  backgroundColor: progresoRevertir.estado === 'listo' ? '#F0FDF4' : '#fff',
                }}
              >
                <span className="stat-number" style={{ color: '#22C55E' }}>
                  {progresoRevertir.estado === 'esperando'
                    ? ((conteosPorEstado['VECTORIZADO'] ?? 0) + (conteosPorEstado['NO_VECTORIZADO'] ?? 0))
                    : progresoRevertir.total}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-texto-muted">docs</span>
              </div>
              <span className="text-xs font-semibold uppercase" style={{ color: '#22C55E' }}>VECTORIZADO</span>
              {(conteosPorEstado['NO_VECTORIZADO'] ?? 0) > 0 && progresoRevertir.estado === 'esperando' && (
                <span className="text-[10px] text-texto-muted mt-0.5">
                  ({conteosPorEstado['VECTORIZADO'] ?? 0} ok + {conteosPorEstado['NO_VECTORIZADO']} err)
                </span>
              )}
            </div>

            {/* Flecha reversa ← */}
            <div className="flex items-center self-center">
              <svg width="64" height="24" viewBox="0 0 64 24">
                <line x1="64" y1="12" x2="18" y2="12" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                <polygon points="22,4 6,12 22,20" fill="#F59E0B" />
              </svg>
            </div>

            {/* Círculo CHUNKEADO (destino) */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-24 h-24 rounded-full flex flex-col items-center justify-center border-4"
                style={{ borderColor: '#84CC16', backgroundColor: progresoRevertir.estado === 'listo' ? '#F7FEE7' : '#fff' }}
              >
                <span className="stat-number" style={{ color: '#84CC16' }}>
                  {progresoRevertir.estado === 'listo' ? progresoRevertir.revertidos : '—'}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-texto-muted">
                  {progresoRevertir.estado === 'listo' ? 'ok' : 'destino'}
                </span>
              </div>
              <span className="text-xs font-semibold uppercase" style={{ color: '#84CC16' }}>CHUNKEADO</span>
            </div>
          </div>

          {/* Mensaje resultado / progreso */}
          {mensajeRevertir && (
            <div className={`text-sm px-4 py-2 rounded-lg border ${progresoRevertir.estado === 'listo' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {mensajeRevertir}
            </div>
          )}
        </div>
      )}

      {(ejecutando || todosListos || (revertir && progresoRevertir.estado === 'listo')) && (
        <p className="text-center text-sm text-texto-muted">
          {ejecutando
            ? `Tiempo transcurrido: ${formatTiempo(tiempoTranscurrido)}`
            : `Completado en ${formatTiempo(tiempoTranscurrido)}`}
        </p>
      )}

      <div className="flex gap-3 justify-center">
        {!revertir ? (
          <>
            <Boton variante="primario" onClick={ejecutarPipeline} disabled={ejecutando}>
              Procesar
            </Boton>
            <Boton variante="peligro" onClick={detener} disabled={!ejecutando}>
              Cancelar
            </Boton>
          </>
        ) : (
          <Boton
            variante="primario"
            onClick={ejecutarRevertir}
            disabled={ejecutando}
            className="bg-amber-600 hover:bg-amber-700 border-amber-600"
          >
            {ejecutando ? 'Revirtiendo…' : 'Revertir VECTORIZADO → CHUNKEADO'}
          </Boton>
        )}
      </div>

      {/* ── Estadísticas por estado (Cambio 4) ────────────────────────────── */}
      <div className="rounded-lg border border-borde bg-fondo-tarjeta p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-texto-muted uppercase">Estado del pipeline</p>
          <button
            type="button"
            onClick={cargarConteos}
            className="text-xs text-texto-muted hover:text-primario transition-colors"
            disabled={ejecutando}
          >
            Actualizar
          </button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {ESTADOS_PIPELINE.map((estado) => {
            const count = conteosPorEstado[estado.codigo] ?? 0
            return (
              <div key={estado.codigo} className="flex flex-col items-center gap-1 py-2">
                <span
                  className="stat-number tabular-nums"
                  style={{ color: count > 0 ? estado.color : '#9CA3AF' }}
                >
                  {count}
                </span>
                <span className="text-[10px] text-texto-muted text-center leading-tight font-medium uppercase tracking-wide">
                  {estado.nombre}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Nota: el bloque "DOCUMENTOS POR PROCESAR" anterior fue reemplazado por las estadísticas de arriba */}
    </div>
  )
}
