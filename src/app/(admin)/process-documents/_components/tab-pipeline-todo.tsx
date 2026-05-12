'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen, X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { documentosApi, ubicacionesDocsApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { getDirectoryHandle, setDirectoryHandle } from '@/lib/file-handle-store'
import { escanearDirectorio as escanearDirectorioUbicaciones } from '@/lib/escanear-directorio'
import { useAuth } from '@/context/AuthContext'
import { useColaRealtime } from '@/hooks/useColaRealtime'
import type { EstadoDoc } from '@/lib/tipos'
import {
  escanearParaCarga,
  ejecutarCarga,
  ejecutarExtraer,
  ejecutarPasoBackend,
  type PendingCarga,
  type UbicacionOpt,
} from '../_lib/ejecutar-paso'

// Pasos 3-6: procesamiento de documentos
const PASOS_PIPELINE = [
  { key: 'EXTRAER',    nombre: 'Extraer',    label: 'CARGADO → METADATA',     estadoOrigen: 'CARGADO',   estadoDestino: 'METADATA',    color: '#EF4444', clienteSide: true  },
  { key: 'ANALIZAR',   nombre: 'Analizar',   label: 'METADATA → ESCANEADO',   estadoOrigen: 'METADATA',  estadoDestino: 'ESCANEADO',   color: '#F97316', clienteSide: false },
  { key: 'CHUNKEAR',   nombre: 'Chunkear',   label: 'ESCANEADO → CHUNKEADO',  estadoOrigen: 'ESCANEADO', estadoDestino: 'CHUNKEADO',   color: '#84CC16', clienteSide: false },
  { key: 'VECTORIZAR', nombre: 'Vectorizar', label: 'CHUNKEADO → VECTORIZADO', estadoOrigen: 'CHUNKEADO', estadoDestino: 'VECTORIZADO', color: '#22C55E', clienteSide: false },
] as const

type EstadoBarra = 'esperando' | 'activo' | 'listo' | 'error'
interface ProgresoPaso { total: number; completados: number; estado: EstadoBarra; error?: string }

const progresosIniciales = (): Record<string, ProgresoPaso> =>
  Object.fromEntries(PASOS_PIPELINE.map((p) => [p.key, { total: 0, completados: 0, estado: 'esperando' }]))

const ESTADOS_PIPELINE = [
  { codigo: 'CARGADO',       nombre: 'Cargado',       color: '#6B7280' },
  { codigo: 'METADATA',      nombre: 'Metadata',      color: '#3B82F6' },
  { codigo: 'ESCANEADO',     nombre: 'Escaneado',     color: '#F97316' },
  { codigo: 'CHUNKEADO',     nombre: 'Chunkeado',     color: '#84CC16' },
  { codigo: 'VECTORIZADO',   nombre: 'Vectorizado',   color: '#22C55E' },
  { codigo: 'NO_ANALIZABLE', nombre: 'No analizable', color: '#EF4444' },
  { codigo: 'NO_ESCANEABLE', nombre: 'No escaneable', color: '#DC2626' },
] as const

interface TabPipelineTodoProps {
  procesos?: ProcesoCatalogo[]
  estadosDocs?: EstadoDoc[]
  ubicaciones?: UbicacionOpt[]
}

export function TabPipelineTodo({ procesos = [], ubicaciones: ubicacionesProp = [] }: TabPipelineTodoProps) {
  const t = useTranslations('processDocuments')
  const { grupoActivo, usuario } = useAuth()
  const userId = usuario?.codigo_usuario ?? null

  // ── Pasos 1-2 (ubicaciones + cargar) ──────────────────────────────────────
  const [p1Estado, setP1Estado] = useState<EstadoBarra>('esperando')
  const [p1Total, setP1Total] = useState(0)
  const [p1Completados, setP1Completados] = useState(0)
  const [p1Mensaje, setP1Mensaje] = useState('')

  const [p2Estado, setP2Estado] = useState<EstadoBarra>('esperando')
  const [p2Total, setP2Total] = useState(0)
  const [p2Completados, setP2Completados] = useState(0)
  const [p2Mensaje, setP2Mensaje] = useState('')

  const [pendingCarga, setPendingCarga] = useState<PendingCarga | null>(null)

  // ── Pasos 3-6 (pipeline) ──────────────────────────────────────────────────
  const [progresos, setProgresos] = useState<Record<string, ProgresoPaso>>(progresosIniciales)
  const [ejecutando, setEjecutando] = useState(false)
  const [dirHandle, setDirHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [mensajeError, setMensajeError] = useState('')
  const [carpetaRaiz, setCarpetaRaiz] = useState<string>('')
  const [pasoActualIdx, setPasoActualIdx] = useState<number | null>(null)

  // Filtros
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicBusqueda, setUbicBusqueda] = useState('')
  const [ubicDropdownOpen, setUbicDropdownOpen] = useState(false)
  const [ubicExpandidos, setUbicExpandidos] = useState<Set<string>>(new Set())
  const [tope, setTope] = useState<string>('')
  const [filtroLibreInput, setFiltroLibreInput] = useState<string>('')
  const [filtroLibre, setFiltroLibre] = useState<string>('')
  const ubicDropdownRef = useRef<HTMLDivElement>(null)

  // Modo reversa
  const [revertir, setRevertir] = useState(false)
  const [progresoRevertir, setProgresoRevertir] = useState<{ total: number; revertidos: number; estado: EstadoBarra }>({ total: 0, revertidos: 0, estado: 'esperando' })
  const [mensajeRevertir, setMensajeRevertir] = useState('')

  const [conteosPorEstado, setConteosPorEstado] = useState<Record<string, number>>({})

  const abortRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveColaRef = useRef<(() => void) | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)

  const handleColaChange = useCallback(() => {
    if (resolveColaRef.current) { resolveColaRef.current(); resolveColaRef.current = null }
  }, [])
  const { suscribir: suscribirCola, desuscribir: desuscribirCola } = useColaRealtime(grupoActivo, handleColaChange)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ubicDropdownRef.current && !ubicDropdownRef.current.contains(e.target as Node)) setUbicDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const conteosTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargarConteos = useCallback(async () => {
    try {
      const conteos = await documentosApi.contarPorEstado()
      setConteosPorEstado(conteos as Record<string, number>)
      setProgresos((prev) => {
        const next = { ...prev }
        for (const paso of PASOS_PIPELINE) {
          next[paso.key] = { ...next[paso.key], total: (conteos as Record<string, number>)[paso.estadoOrigen] ?? 0, completados: 0, estado: 'esperando' }
        }
        return next
      })
    } catch { /* ignorar */ }
  }, [])

  useEffect(() => {
    if (ejecutando && tiempoInicio) {
      timerRef.current = setInterval(() => setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000)), 1000)
      conteosTimerRef.current = setInterval(cargarConteos, 5000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (conteosTimerRef.current) clearInterval(conteosTimerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (conteosTimerRef.current) clearInterval(conteosTimerRef.current)
    }
  }, [ejecutando, tiempoInicio, cargarConteos])

  useEffect(() => {
    getDirectoryHandle(userId, grupoActivo).then((h) => { if (h) setDirHandleState(h) })
    cargarConteos()
    ubicacionesDocsApi.listar().then((ubs) => {
      if (!ubs?.length) return
      const raiz = (ubs as { nivel: number; url?: string }[]).reduce((min, u) => u.nivel < min.nivel ? u : min, ubs[0] as { nivel: number; url?: string })
      const nombre = raiz?.url?.split('/').filter(Boolean)[0] ?? ''
      if (nombre) setCarpetaRaiz(nombre)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  // ── Paso 1: Indexar ubicaciones ────────────────────────────────────────────
  const ejecutarPaso1 = async (): Promise<boolean> => {
    setP1Estado('activo'); setP1Total(0); setP1Completados(0); setP1Mensaje('')
    try {
      const resultado = await escanearDirectorioUbicaciones()
      if (!resultado) { setP1Estado('esperando'); return false }
      const total = resultado.directorios.length
      setP1Total(total)
      const sync = await ubicacionesDocsApi.sincronizar({ directorios: resultado.directorios })
      setP1Completados(total)
      setP1Estado('listo')
      setP1Mensaje(t('p1Resultado', { insertadas: sync.insertadas ?? 0, actualizadas: sync.actualizadas ?? 0, eliminadas: sync.eliminadas ?? 0 }))
      return true
    } catch (e) {
      setP1Estado('error'); setP1Mensaje(e instanceof Error ? e.message : t('errorIndexar')); return false
    }
  }

  // ── Paso 2: FILESYSTEM → CARGADO (escaneo) ────────────────────────────────
  // Usa exactamente escanearParaCarga de _lib/ejecutar-paso — misma lógica que page.tsx
  const ejecutarPaso2Escaneo = async (): Promise<boolean> => {
    setP2Estado('activo'); setP2Total(0); setP2Completados(0); setP2Mensaje(t('escaneandoDirectorio')); setPendingCarga(null)
    const scanAbort = new AbortController()
    scanAbortRef.current = scanAbort
    try {
      const pending = await escanearParaCarga({
        userId,
        grupoActivo,
        ubicaciones: ubicacionesProp,
        nivelesDirectorio: 5,
        tope,
        dirHandle,
        abortSignal: scanAbort.signal,
      })
      if (!pending) { setP2Estado('esperando'); setP2Mensaje(''); return false }
      if (pending.scan.dirHandle !== dirHandle) {
        setDirHandleState(pending.scan.dirHandle)
        await setDirectoryHandle(pending.scan.dirHandle, userId, grupoActivo)
      }
      setP2Total(pending.archivosParaCargar.length)
      setP2Mensaje(t('nArchivosEncontrados', { n: pending.archivosParaCargar.length }))
      setPendingCarga(pending)
      setP2Estado('esperando')
      return false
    } catch (e) {
      setP2Estado('error'); setP2Mensaje(e instanceof Error ? e.message : t('errorEscanear')); return false
    } finally {
      scanAbortRef.current = null
    }
  }

  // Usa ejecutarCarga de _lib/ejecutar-paso — misma lógica que page.tsx confirmarCarga()
  const confirmarCarga = async (): Promise<boolean> => {
    if (!pendingCarga) return true
    const pending = pendingCarga
    setPendingCarga(null)
    setP2Estado('activo')
    setP2Completados(0)
    setP2Mensaje(t('cargandoNArchivos', { n: pending.archivosParaCargar.length }))
    try {
      const res = await ejecutarCarga(pending)
      setP2Completados(pending.archivosParaCargar.length)
      setP2Estado('listo')
      setP2Mensaje(t('cargaResultado', { insertados: res.insertados, actualizados: res.actualizados, eliminados: res.eliminados }))
      await cargarConteos()
      return true
    } catch (e) {
      setP2Estado('error')
      setP2Mensaje(e instanceof Error ? e.message : t('errorCargar'))
      return false
    }
  }

  // ── Pasos 3-6: usa las mismas funciones que page.tsx ──────────────────────
  const seleccionarDirectorio = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'read', id: 'serverlm-docs' })
      setDirHandleState(handle)
      await setDirectoryHandle(handle, userId, grupoActivo)
    } catch { /* usuario canceló */ }
  }

  const setPaso = (key: string, patch: Partial<ProgresoPaso>) =>
    setProgresos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const filtros = { ubicacionSel, filtroLibre, tope }

  // Usa ejecutarExtraer de _lib/ejecutar-paso — misma lógica completa que page.tsx
  // incluye: OCR, antiword, DEBUG_TIEMPOS, EXTENSIONES_NO_TEXTUALES, truncado 60k, etc.
  const runExtraer = async (): Promise<boolean> => {
    setPaso('EXTRAER', { estado: 'activo', completados: 0 })
    const result = await ejecutarExtraer({
      userId,
      grupoActivo,
      procesos,
      filtros,
      dirHandle,
      abortRef,
      onDirHandle: (h) => { setDirHandleState(h) },
      onProgreso: (completados, total) => setPaso('EXTRAER', { completados, total }),
    })
    if (result.ok) {
      setPaso('EXTRAER', { estado: 'listo' })
    } else {
      setPaso('EXTRAER', { estado: 'error' })
    }
    return result.ok
  }

  // Usa ejecutarPasoBackend de _lib/ejecutar-paso — misma lógica que page.tsx (LLM loop)
  const runPasoBackend = async (key: string, estadoOrigen: string, estadoDestino: string): Promise<boolean> => {
    setPaso(key, { estado: 'activo', completados: 0 })
    const ok = await ejecutarPasoBackend({
      estadoOrigen,
      estadoDestino,
      codigoProceso: key,
      filtros,
      abortRef,
      resolveColaRef,
      onProgreso: (completados, total) => setPaso(key, { completados, total }),
    })
    setPaso(key, { estado: ok ? 'listo' : 'error' })
    return ok
  }

  const ESTADOS_VECTORIZAR = ['VECTORIZADO', 'NO_VECTORIZADO'] as const

  const ejecutarRevertir = async () => {
    setMensajeError(''); setMensajeRevertir(''); abortRef.current = false; setEjecutando(true)
    setTiempoInicio(Date.now()); setTiempoTranscurrido(0)
    setProgresoRevertir({ total: 0, revertidos: 0, estado: 'activo' })
    try {
      const filtrosBase: Record<string, unknown> = {}
      if (ubicacionSel) filtrosBase.codigo_ubicacion = ubicacionSel
      if (filtroLibre.trim()) filtrosBase.q = filtroLibre.trim()
      const topeNum = tope ? parseInt(tope) : 0
      const [docsVect, docsNoVect] = await Promise.all([
        documentosApi.listar({ ...filtrosBase, codigo_estado_doc: 'VECTORIZADO' } as Parameters<typeof documentosApi.listar>[0]),
        documentosApi.listar({ ...filtrosBase, codigo_estado_doc: 'NO_VECTORIZADO' } as Parameters<typeof documentosApi.listar>[0]),
      ])
      const docsRaw = [...docsVect, ...docsNoVect]
      const docs = topeNum > 0 ? docsRaw.slice(0, topeNum) : docsRaw
      if (docs.length === 0) {
        setProgresoRevertir({ total: 0, revertidos: 0, estado: 'listo' })
        setMensajeRevertir(t('sinDocsRevertir'))
        return
      }
      setProgresoRevertir({ total: docs.length, revertidos: 0, estado: 'activo' })
      const ids = docs.map((d) => d.codigo_documento)
      const resultado = await documentosApi.revertirEstado(ids, [...ESTADOS_VECTORIZAR], 'CHUNKEADO')
      setProgresoRevertir({ total: docs.length, revertidos: resultado.revertidos, estado: 'listo' })
      setMensajeRevertir(t('nDocsRevertidosA', { n: resultado.revertidos }))
    } catch (e) {
      setProgresoRevertir((prev) => ({ ...prev, estado: 'error' }))
      setMensajeError(e instanceof Error ? e.message : t('errorRevertir'))
    } finally {
      setEjecutando(false); await cargarConteos()
    }
  }

  const ejecutarPipeline = async () => {
    setMensajeError(''); abortRef.current = false; setEjecutando(true); setPasoActualIdx(null)
    setTiempoInicio(Date.now()); setTiempoTranscurrido(0); setProgresos(progresosIniciales())
    suscribirCola()
    try {
      // Si hay carga pendiente de confirmar, ejecutarla primero (misma lógica que page.tsx)
      if (pendingCarga) {
        const ok = await confirmarCarga()
        if (!ok) return
      }
      for (let i = 0; i < PASOS_PIPELINE.length; i++) {
        if (abortRef.current) break
        setPasoActualIdx(i)
        const paso = PASOS_PIPELINE[i]
        const ok = paso.clienteSide
          ? await runExtraer()
          : await runPasoBackend(paso.key, paso.estadoOrigen, paso.estadoDestino)
        if (!ok) break
      }
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : t('errorPipeline'))
    } finally {
      desuscribirCola(); setEjecutando(false); setPasoActualIdx(null); await cargarConteos()
    }
  }

  const detener = () => {
    abortRef.current = true
    if (scanAbortRef.current) { scanAbortRef.current.abort(); scanAbortRef.current = null }
    if (resolveColaRef.current) { resolveColaRef.current(); resolveColaRef.current = null }
  }

  const formatTiempo = (seg: number) => { const m = Math.floor(seg / 60); const s = seg % 60; return m > 0 ? `${m}m ${s}s` : `${s}s` }
  const todosListos = PASOS_PIPELINE.every((p) => progresos[p.key]?.estado === 'listo')

  // ── Dropdown árbol ubicaciones ─────────────────────────────────────────────
  const tieneHijosUbic = (cod: string) => ubicacionesProp.some(u => u.codigo_ubicacion !== cod && u.codigo_ubicacion_superior === cod)
  const toggleExpandirUbic = (e: React.MouseEvent, cod: string) => {
    e.stopPropagation()
    setUbicExpandidos(prev => { const next = new Set(prev); next.has(cod) ? next.delete(cod) : next.add(cod); return next })
  }
  const renderNodoDropdown = (u: UbicacionOpt): React.ReactNode => {
    const tieneHijos = tieneHijosUbic(u.codigo_ubicacion)
    const expandido = ubicExpandidos.has(u.codigo_ubicacion)
    const esArea = u.tipo_ubicacion === 'AREA'
    const selec = ubicacionSel === u.codigo_ubicacion
    const hijos = tieneHijos ? ubicacionesProp.filter(h => h.codigo_ubicacion_superior === u.codigo_ubicacion).sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion)) : []
    return (
      <div key={u.codigo_ubicacion}>
        <div className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer select-none ${selec ? 'bg-primario-muy-claro' : ''}`} style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }} onClick={() => { setUbicacionSel(u.codigo_ubicacion); setUbicBusqueda(''); setUbicDropdownOpen(false) }}>
          {tieneHijos ? <button onClick={(e) => toggleExpandirUbic(e, u.codigo_ubicacion)} className="shrink-0 hover:text-primario text-texto-muted p-0.5 -ml-0.5 rounded">{expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button> : <span className="w-3 shrink-0" />}
          <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
          <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? t('tipoArea') : t('tipoContenido')}</span>
        </div>
        {expandido && hijos.map(h => renderNodoDropdown(h))}
      </div>
    )
  }
  const raicesUbic = ubicacionesProp.filter(u => !u.codigo_ubicacion_superior).sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))

  // ── Barra individual horizontal ────────────────────────────────────────────
  const BarraHorizontal = ({ num, nombre, label, estado, completados, total, color, mensaje }: {
    num: number; nombre: string; label: string; estado: EstadoBarra; completados: number; total: number; color: string; mensaje?: string
  }) => {
    const pct = total > 0 ? Math.round((completados / total) * 100) : 0
    const estaActivo = estado === 'activo'
    const estaListo = estado === 'listo'
    const estaError = estado === 'error'
    const barColor = estaError ? '#EF4444' : color
    return (
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[11px] font-semibold truncate flex items-center gap-1 ${estaActivo ? 'text-texto' : estaListo ? 'text-texto-muted' : 'text-texto-muted opacity-50'}`}>
            {estaActivo && <Loader2 size={10} className="animate-spin shrink-0" />}
            {num}. {nombre}
          </span>
          <span className="text-[11px] text-texto-muted tabular-nums shrink-0">
            {estaListo ? '✓' : estaActivo ? `${completados}/${total || '…'}` : '—'}
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${estaActivo ? 'animate-pulse' : ''}`}
            style={{ width: estaListo ? '100%' : `${pct}%`, backgroundColor: barColor, opacity: estado === 'esperando' ? 0.25 : 0.9 }}
          />
        </div>
        <span className={`text-[10px] truncate ${estaError ? 'text-red-500' : 'text-texto-muted opacity-70'}`} title={label}>{mensaje || label}</span>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-borde bg-fondo-tarjeta p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-texto-muted uppercase">{t('filtrosPipeline')}</p>

        <div className="flex items-end gap-2" ref={ubicDropdownRef}>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-sm font-medium text-texto">{t('etiquetaUbicacion')}</label>
            <div className="relative">
              <button type="button" onClick={() => !ejecutando && setUbicDropdownOpen(!ubicDropdownOpen)} disabled={ejecutando} className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto hover:border-primario transition-colors w-full disabled:opacity-50">
                <FolderOpen size={15} className={ubicacionSel ? 'text-primario shrink-0' : 'text-texto-muted shrink-0'} />
                <span className="flex-1 text-left truncate">{ubicacionSel ? (ubicacionesProp.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion ?? t('seleccionarUbicacion')) : t('seleccionarUbicacion')}</span>
                {ubicacionSel ? <X size={13} className="text-texto-muted hover:text-error shrink-0" onClick={(e) => { e.stopPropagation(); setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }} /> : <ChevronDown size={13} className="text-texto-muted shrink-0" />}
              </button>
              {ubicDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-borde rounded-lg shadow-lg flex flex-col" style={{ maxHeight: '16rem' }}>
                  <div className="p-2 border-b border-borde shrink-0">
                    <input type="text" placeholder={t('buscarUbicacion')} value={ubicBusqueda} onChange={(e) => setUbicBusqueda(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-sm border border-borde rounded px-2 py-1 bg-fondo text-texto focus:outline-none focus:ring-1 focus:ring-primario placeholder:text-texto-muted" autoFocus />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    <div className="px-3 py-2 hover:bg-fondo cursor-pointer text-sm text-texto-muted border-b border-borde" onClick={() => { setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }}>{t('todasUbicaciones')}</div>
                    {ubicBusqueda ? (() => {
                      const filtradas = ubicacionesProp.filter(u => u.nombre_ubicacion.toLowerCase().includes(ubicBusqueda.toLowerCase()) || (u.url || '').toLowerCase().includes(ubicBusqueda.toLowerCase()))
                      if (filtradas.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">{t('sinCoincidencias')}</div>
                      return filtradas.map(u => {
                        const esArea = u.tipo_ubicacion === 'AREA'; const selec = ubicacionSel === u.codigo_ubicacion
                        return (
                          <div key={u.codigo_ubicacion} className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer ${selec ? 'bg-primario-muy-claro' : ''}`} style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }} onClick={() => { setUbicacionSel(u.codigo_ubicacion); setUbicBusqueda(''); setUbicDropdownOpen(false) }}>
                            <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
                            <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? t('tipoArea') : t('tipoContenido')}</span>
                          </div>
                        )
                      })
                    })() : (raicesUbic.length === 0 ? <div className="px-3 py-4 text-sm text-texto-muted text-center">{t('sinUbicaciones')}</div> : raicesUbic.map(u => renderNodoDropdown(u)))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button onClick={seleccionarDirectorio} className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors">
              <FolderOpen size={16} className={dirHandle ? 'text-primario' : 'text-texto-muted'} />
              {dirHandle ? dirHandle.name : t('seleccionarDirectorio')}
            </button>
            {!dirHandle && carpetaRaiz && (
              <span className="text-xs text-texto-muted text-right">{t('selecciona')} <strong className="text-texto">{carpetaRaiz}</strong></span>
            )}
          </div>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-texto-muted font-medium">{t('topeLabel')}</label>
            <input type="number" min={1} placeholder={t('todosPlaceholder')} value={tope} onChange={(e) => setTope(e.target.value)} disabled={ejecutando} className="w-20 text-sm border border-borde rounded-lg px-2 py-1.5 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted" />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs text-texto-muted font-medium">{t('filtroLibreLabel')}</label>
            <div className="flex gap-2">
              <input type="text" placeholder={t('filtroLibrePlaceholder')} value={filtroLibreInput} onChange={(e) => setFiltroLibreInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setFiltroLibre(filtroLibreInput) }} disabled={ejecutando} className="flex-1 text-sm border border-borde rounded-lg px-3 py-1.5 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted" />
              {filtroLibreInput && <button type="button" onClick={() => { setFiltroLibreInput(''); setFiltroLibre('') }} disabled={ejecutando} className="px-2 rounded-lg border border-borde text-texto-muted hover:text-error hover:border-error transition-colors disabled:opacity-50"><X size={14} /></button>}
            </div>
          </div>
        </div>
      </div>

      {mensajeError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensajeError}</div>}

      {/* ── 6 barras horizontales ─────────────────────────────────────────── */}
      {!revertir ? (
        <div className="rounded-lg border border-borde bg-fondo-tarjeta p-5 flex flex-col gap-3">
          <div className="grid grid-cols-6 gap-3">
            <BarraHorizontal num={1} nombre={t('p1Nombre')} label={t('p1Label')} estado={p1Estado} completados={p1Completados} total={p1Total} color="#6B7280" mensaje={p1Mensaje || undefined} />
            <BarraHorizontal num={2} nombre={t('p2Nombre')} label={t('p2Label')} estado={p2Estado} completados={p2Completados} total={p2Total} color="#3B82F6" mensaje={p2Mensaje || undefined} />
            {PASOS_PIPELINE.map((paso, i) => {
              const prog = progresos[paso.key]
              return (
                <BarraHorizontal key={paso.key} num={i + 3} nombre={paso.nombre} label={paso.label} estado={prog.estado} completados={prog.completados} total={prog.total} color={paso.color} />
              )
            })}
          </div>

          {/* Confirmación inline carga (Paso 2) */}
          {pendingCarga && (
            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-4">
              <p className="text-sm text-blue-800 flex-1">
                {t('archivosEncontradosConfirmar', { n: pendingCarga.archivosParaCargar.length, raiz: pendingCarga.scan.nombreRaiz })}
              </p>
              <div className="flex gap-2 shrink-0">
                <Boton variante="primario" tamano="sm" onClick={() => confirmarCarga()}>{t('confirmar')}</Boton>
                <Boton variante="contorno" tamano="sm" onClick={() => { setPendingCarga(null); setP2Estado('esperando'); setP2Mensaje('') }}>{t('cancelar')}</Boton>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-800">{t('revertirEncabezado')}</span>
            <span className="text-amber-700 tabular-nums">
              {progresoRevertir.estado === 'listo' ? t('nRevertidos', { n: progresoRevertir.revertidos }) : progresoRevertir.estado === 'activo' ? `${progresoRevertir.revertidos}/${progresoRevertir.total}` : t('nDocs', { n: (conteosPorEstado['VECTORIZADO'] ?? 0) + (conteosPorEstado['NO_VECTORIZADO'] ?? 0) })}
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#FEF3C7' }}>
            <div className={`h-full rounded-full transition-all duration-300 ${progresoRevertir.estado === 'activo' ? 'animate-pulse' : ''}`} style={{ width: progresoRevertir.estado === 'listo' ? '100%' : progresoRevertir.total > 0 ? `${Math.round((progresoRevertir.revertidos / progresoRevertir.total) * 100)}%` : '0%', backgroundColor: '#F59E0B', opacity: progresoRevertir.estado === 'esperando' ? 0.3 : 0.9 }} />
          </div>
          {mensajeRevertir && <p className={`text-xs ${progresoRevertir.estado === 'listo' ? 'text-green-700' : 'text-amber-700'}`}>{mensajeRevertir}</p>}
        </div>
      )}

      {(ejecutando || todosListos || (revertir && progresoRevertir.estado === 'listo')) && (
        <p className="text-center text-sm text-texto-muted">
          {ejecutando ? t('tiempoTranscurridoFmt', { t: formatTiempo(tiempoTranscurrido) }) : t('completadoEnFmt', { t: formatTiempo(tiempoTranscurrido) })}
        </p>
      )}

      {/* ── Botones de acción ──────────────────────────────────────────────── */}
      <div className="flex gap-3 justify-center flex-wrap">
        {!revertir ? (
          <>
            <Boton variante="contorno" onClick={async () => { const ok = await ejecutarPaso1(); if (ok) await ejecutarPaso2Escaneo() }} disabled={ejecutando || p1Estado === 'activo' || p2Estado === 'activo' || !!pendingCarga}>
              {t('botonSincronizarYCargar')}
            </Boton>
            <Boton variante="primario" onClick={ejecutarPipeline} disabled={ejecutando}>
              {ejecutando && pasoActualIdx !== null ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {t('etapaXdeY', { n: pasoActualIdx + 3, total: 6, nombre: PASOS_PIPELINE[pasoActualIdx].nombre })}
                </span>
              ) : t('botonVectorizar')}
            </Boton>
            <Boton variante="contorno" onClick={detener} disabled={!ejecutando}>
              {t('cancelar')}
            </Boton>
            <Boton variante="contorno" onClick={() => { setRevertir(true); setMensajeError('') }} disabled={ejecutando} className="text-amber-600 border-amber-300 hover:border-amber-500">
              {t('modoRevertir')}
            </Boton>
          </>
        ) : (
          <>
            <Boton variante="primario" onClick={ejecutarRevertir} disabled={ejecutando} className="bg-amber-600 hover:bg-amber-700 border-amber-600">
              {ejecutando ? t('revirtiendo') : t('botonRevertirEstado')}
            </Boton>
            <Boton variante="contorno" onClick={() => { setRevertir(false); setMensajeRevertir('') }} disabled={ejecutando}>
              {t('cancelar')}
            </Boton>
          </>
        )}
      </div>

      {/* ── Estado del pipeline ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-borde bg-fondo-tarjeta p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-texto-muted uppercase flex items-center gap-2">
            {t('estadoPipeline')}
            {ejecutando && <Loader2 size={11} className="animate-spin text-primario" />}
          </p>
          {!ejecutando && <button type="button" onClick={cargarConteos} className="text-xs text-texto-muted hover:text-primario transition-colors">{t('actualizar')}</button>}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {ESTADOS_PIPELINE.map((estado) => {
            const count = conteosPorEstado[estado.codigo] ?? 0
            return (
              <div key={estado.codigo} className="flex flex-col items-center gap-1 py-2">
                <span className="stat-number tabular-nums" style={{ color: count > 0 ? estado.color : '#9CA3AF' }}>{count}</span>
                <span className="text-[10px] text-texto-muted text-center leading-tight font-medium uppercase tracking-wide">{estado.nombre}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
