'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  FolderOpen, Folder, FolderPlus, FolderSync,
  CheckCircle, AlertTriangle, RefreshCw, Upload, Download,
  ChevronRight, ChevronDown, ToggleLeft, ToggleRight, Shuffle, Plus, Pencil, Trash2, X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { documentosApi, colaEstadosDocsApi, ubicacionesDocsApi, promptsApi, procesosApi, parametrosApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { getDirectoryHandle, setDirectoryHandle } from '@/lib/file-handle-store'
import {
  escanearDirectorio,
  soportaDirectoryPicker, type DirectorioEscaneado,
} from '@/lib/escanear-directorio'
import {
  escanearParaCarga,
  ejecutarCarga as ejecutarCargaLib,
  ejecutarExtraer as ejecutarExtraerLib,
  ejecutarPasoBackend as ejecutarPasoBackendLib,
  type UbicacionOpt,
} from '../process-documents/_lib/ejecutar-paso'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { useColaRealtime } from '@/hooks/useColaRealtime'
import type { UbicacionDoc } from '@/lib/tipos'
import type { ResumenPipeline } from '@/lib/api'
import { BotonChat } from '@/components/ui/boton-chat'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { PipelineConversacional } from '@/components/pipeline/PipelineConversacional'
import { FASES_NARRATIVAS, formatearMinutos } from '@/lib/pipeline-narrativo'

// ── Pipeline ──────────────────────────────────────────────────────────────────
// Numeración global de pasos:
//   Paso 1 = INDEXAR_UBICACIONES (solo tab Ubicaciones)
//   Paso 2 = CARGAR     (filesystem → docs.CARGADO)
//   Paso 3 = EXTRAER    (CARGADO → METADATA, client-side)
//   Paso 4 = ANALIZAR   (METADATA → ESCANEADO)
//   Paso 5 = CHUNKEAR   (ESCANEADO → CHUNKEADO)
//   Paso 6 = VECTORIZAR (CHUNKEADO → VECTORIZADO)

// PASOS = pasos del pipeline de Documentos (2..6, sin Indexar Ubicaciones).
const PASOS = [
  { key: 'CARGAR',     estadoOrigen: '',          estadoDestino: 'CARGADO',     colorBarra: '#0EA5E9', clienteSide: true  },
  { key: 'EXTRAER',    estadoOrigen: 'CARGADO',   estadoDestino: 'METADATA',    colorBarra: '#074B91', clienteSide: true  },
  { key: 'ANALIZAR',   estadoOrigen: 'METADATA',  estadoDestino: 'ESCANEADO',   colorBarra: '#F97316', clienteSide: false },
  { key: 'CHUNKEAR',   estadoOrigen: 'ESCANEADO', estadoDestino: 'CHUNKEADO',   colorBarra: '#84CC16', clienteSide: false },
  { key: 'VECTORIZAR', estadoOrigen: 'CHUNKEADO', estadoDestino: 'VECTORIZADO', colorBarra: '#22C55E', clienteSide: false },
] as const

// Clasificación final de cada documento respecto al pipeline:
//   VECTORIZADOS      → llegaron al final OK (verde)
//   PENDIENTES        → en alguna etapa intermedia, recuperables (gris/azul)
//   NO_VECTORIZABLES  → quedaron en un estado terminal de error NO_* (amarillo)
// Total = VECTORIZADOS + PENDIENTES + NO_VECTORIZABLES (debe cuadrar con el total).
const ESTADOS_VECTORIZADOS = ['VECTORIZADO']
const ESTADOS_PENDIENTES = ['CARGADO', 'METADATA', 'ESCANEADO', 'CHUNKEADO']
const ESTADOS_NO_VECTORIZABLES = ['NO_ENCONTRADO', 'NO_METADATA', 'NO_ESCANEABLE', 'NO_ANALIZABLE', 'NO_CHUNKEADO', 'NO_VECTORIZADO']

type EstadoPaso = 'esperando' | 'activo' | 'listo' | 'error'
interface ProgresoPaso { total: number; completados: number; estado: EstadoPaso }

// Clave especial para el paso 1 (solo tab Ubicaciones). No forma parte de PASOS.
const PASO_INDEXAR = 'INDEXAR_UBICACIONES'

const progresosIniciales = (): Record<string, ProgresoPaso> => ({
  [PASO_INDEXAR]: { total: 0, completados: 0, estado: 'esperando' },
  ...Object.fromEntries(PASOS.map((p) => [p.key, { total: 0, completados: 0, estado: 'esperando' }])),
})

type EstadoEtapa = 'pendiente' | 'activo' | 'completado'

// ── Componente ────────────────────────────────────────────────────────────────

export default function PaginaCargaDocsUsuario() {
  const t = useTranslations('processPipeline')
  const tc = useTranslations('common')
  const { grupoActivo, usuario } = useAuth()
  const userId = usuario?.codigo_usuario ?? null

  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([])

  useEffect(() => {
    procesosApi.listar('PROCESAR').then((procs) => setProcesos(procs)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  // ════════════════════════════════════════════════════════════════════════════
  // ETAPA 1 — Indexar Ubicaciones
  // ════════════════════════════════════════════════════════════════════════════

  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargandoUbs, setCargandoUbs] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [busquedaUbs, setBusquedaUbs] = useState('')
  const [etapa1Estado, setEtapa1Estado] = useState<EstadoEtapa>('pendiente')

  // Selector de ubicación para acotar el pipeline (click sobre nodo del árbol)
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicExpandidos, setUbicExpandidos] = useState<Set<string>>(new Set())

  // Modal CRUD ubicaciones
  const [modalUb, setModalUb] = useState(false)
  const [editandoUb, setEditandoUb] = useState<UbicacionDoc | null>(null)
  const [tabModalUb, setTabModalUb] = useState<'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMdUb, setGenerandoMdUb] = useState(false)
  const [sincronizandoMdUb, setSincronizandoMdUb] = useState(false)
  const [mensajeMdUb, setMensajeMdUb] = useState<string | null>(null)
  const [mdUb, setMdUb] = useState('')
  const [formUb, setFormUb] = useState({
    codigo_ubicacion: '', nombre_ubicacion: '', alias_ubicacion: '',
    descripcion: '', codigo_ubicacion_superior: '', ubicacion_habilitada: true,
    prompt_insert: '', prompt_update: '', system_prompt: '',
    python_insert: '', python_update: '', javascript: '',
    python_editado_manual: false, javascript_editado_manual: false,
  })
  const [guardandoUb, setGuardandoUb] = useState(false)
  const [errorUb, setErrorUb] = useState('')

  // Modal confirmar eliminar
  const [confirmElim, setConfirmElim] = useState<UbicacionDoc | null>(null)
  const [previewElim, setPreviewElim] = useState<{ ubicaciones: number; documentos_afectados: number; documentos_a_eliminar: number } | null>(null)
  const [eliminandoUb, setEliminandoUb] = useState(false)

  // Modal confirmar cambio de tipo
  const [confirmarTipo, setConfirmarTipo] = useState<{ u: UbicacionDoc; nuevoTipo: 'AREA' | 'CONTENIDO' } | null>(null)
  const [cambiandoTipo, setCambiandoTipo] = useState(false)

  // Modal carga desde directorio
  const [modalCarga, setModalCarga] = useState(false)
  const [escaneandoDir, setEscaneandoDir] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [datosEscaneo, setDatosEscaneo] = useState<{ nombreRaiz: string; directorios: DirectorioEscaneado[] } | null>(null)
  const [resultadoSync, setResultadoSync] = useState<{ insertadas: number; eliminadas: number; actualizadas: number; total: number; excluidas: number } | null>(null)
  // Barra de progreso inline para sincronización (sin modal)
  type SyncEstado = 'idle' | 'escaneando' | 'sincronizando' | 'listo' | 'error'
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('idle')
  const [syncMensaje, setSyncMensaje] = useState('')

  const cargarUbicaciones = useCallback(async () => {
    setCargandoUbs(true)
    try { setUbicaciones(await ubicacionesDocsApi.listar()) }
    finally { setCargandoUbs(false) }
  }, [])

  useEffect(() => { cargarUbicaciones() }, [cargarUbicaciones])

  // ── Parámetro de grupo: NIVEL_CARGA_SEMANTICA (ALTO | BAJO) ──
  const [nivelCarga, setNivelCarga] = useState<'ALTO' | 'BAJO'>('ALTO')
  const [guardandoNivel, setGuardandoNivel] = useState(false)
  useEffect(() => {
    if (!grupoActivo) return
    parametrosApi
      .obtenerValor('PROCESAMIENTO', 'NIVEL_CARGA_SEMANTICA')
      .then((r) => {
        if (r?.valor === 'BAJO' || r?.valor === 'ALTO') setNivelCarga(r.valor)
      })
      .catch(() => {})
  }, [grupoActivo])
  const cambiarNivelCarga = async (v: 'ALTO' | 'BAJO') => {
    if (v === nivelCarga || guardandoNivel) return
    const prev = nivelCarga
    setNivelCarga(v)
    setGuardandoNivel(true)
    try {
      await parametrosApi.upsertUsuario({
        categoria_parametro: 'PROCESAMIENTO',
        tipo_parametro: 'NIVEL_CARGA_SEMANTICA',
        valor_parametro: v,
      })
    } catch {
      setNivelCarga(prev)
    } finally {
      setGuardandoNivel(false)
    }
  }

  // Devuelve la ubicación seleccionada + todos sus descendientes (incluye AREAs internas).
  const ubicacionesSeleccionadasConDescendientes = useCallback((): UbicacionDoc[] => {
    if (!ubicacionSel) return ubicaciones
    const codigos = new Set<string>([ubicacionSel])
    const stack = [ubicacionSel]
    while (stack.length) {
      const c = stack.pop()!
      for (const u of ubicaciones) {
        if (u.codigo_ubicacion_superior === c && !codigos.has(u.codigo_ubicacion)) {
          codigos.add(u.codigo_ubicacion)
          stack.push(u.codigo_ubicacion)
        }
      }
    }
    return ubicaciones.filter((u) => codigos.has(u.codigo_ubicacion))
  }, [ubicaciones, ubicacionSel])

  // Árbol
  const toggleExpandir = (codigo: string) => {
    setExpandidos((prev) => { const n = new Set(prev); n.has(codigo) ? n.delete(codigo) : n.add(codigo); return n })
  }
  const tieneHijos = (codigo: string) => ubicaciones.some((u) => u.codigo_ubicacion_superior === codigo)

  // CRUD ubicaciones
  const abrirNuevaUb = (padre?: string) => {
    setEditandoUb(null)
    setFormUb({ codigo_ubicacion: '', nombre_ubicacion: '', alias_ubicacion: '', descripcion: '', codigo_ubicacion_superior: padre || '', ubicacion_habilitada: true, prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setTabModalUb('datos'); setErrorUb(''); setModalUb(true)
  }
  const abrirEditarUb = (u: UbicacionDoc) => {
    setEditandoUb(u)
    const u2 = u as unknown as Record<string, unknown>
    setFormUb({ codigo_ubicacion: u.codigo_ubicacion, nombre_ubicacion: u.nombre_ubicacion, alias_ubicacion: u.alias_ubicacion || '', descripcion: u.descripcion || '', codigo_ubicacion_superior: u.codigo_ubicacion_superior || '', ubicacion_habilitada: u.ubicacion_habilitada, prompt_insert: u.prompt_insert || '', prompt_update: u.prompt_update || '', system_prompt: u.system_prompt || '', python_insert: u.python_insert || '', python_update: u.python_update || '', javascript: u2.javascript as string || '', python_editado_manual: u2.python_editado_manual as boolean || false, javascript_editado_manual: u2.javascript_editado_manual as boolean || false })
    setMdUb(u2.md as string || '')
    setMensajeMdUb(null)
    setTabModalUb('datos'); setErrorUb(''); setModalUb(true)
  }
  const guardarUb = async (cerrar: boolean) => {
    if (!formUb.nombre_ubicacion.trim()) { setErrorUb(t('errorNombreObligatorio')); return }
    setGuardandoUb(true)
    try {
      if (editandoUb) {
        await ubicacionesDocsApi.actualizar(editandoUb.codigo_ubicacion, {
          nombre_ubicacion: formUb.nombre_ubicacion, alias_ubicacion: formUb.alias_ubicacion || undefined,
          descripcion: formUb.descripcion || undefined, codigo_ubicacion_superior: formUb.codigo_ubicacion_superior || undefined,
          ubicacion_habilitada: formUb.ubicacion_habilitada,
          ...(editandoUb.tipo_ubicacion === 'AREA' ? { prompt_insert: formUb.prompt_insert || undefined, prompt_update: formUb.prompt_update || undefined, system_prompt: formUb.system_prompt || undefined, python_insert: formUb.python_insert || undefined, python_update: formUb.python_update || undefined, javascript: formUb.javascript || undefined, python_editado_manual: formUb.python_editado_manual, javascript_editado_manual: formUb.javascript_editado_manual } : {}),
        })
        if (cerrar) setModalUb(false)
      } else {
        const nueva = await ubicacionesDocsApi.crear({ codigo_grupo: grupoActivo!, nombre_ubicacion: formUb.nombre_ubicacion, alias_ubicacion: formUb.alias_ubicacion || undefined, descripcion: formUb.descripcion || undefined, codigo_ubicacion_superior: formUb.codigo_ubicacion_superior || undefined })
        if (cerrar) { setModalUb(false) } else { setEditandoUb(nueva); setFormUb({ ...formUb, codigo_ubicacion: nueva.codigo_ubicacion, nombre_ubicacion: nueva.nombre_ubicacion }) }
      }
      cargarUbicaciones()
    } catch (e) { setErrorUb(e instanceof Error ? e.message : tc('errorAlGuardar')) }
    finally { setGuardandoUb(false) }
  }
  const toggleHabilitada = async (u: UbicacionDoc) => {
    try { await ubicacionesDocsApi.actualizar(u.codigo_ubicacion, { ubicacion_habilitada: !u.ubicacion_habilitada }); cargarUbicaciones() } catch { /* ignorar */ }
  }
  const ejecutarCambioTipo = async () => {
    if (!confirmarTipo) return
    setCambiandoTipo(true)
    try { await ubicacionesDocsApi.cambiarTipo(confirmarTipo.u.codigo_ubicacion, confirmarTipo.nuevoTipo); setConfirmarTipo(null); cargarUbicaciones() }
    catch { setConfirmarTipo(null) } finally { setCambiandoTipo(false) }
  }
  const abrirConfirmElim = async (u: UbicacionDoc) => {
    setConfirmElim(u); setPreviewElim(null)
    try { setPreviewElim(await ubicacionesDocsApi.previewEliminar(u.codigo_ubicacion)) } catch { /* ignorar */ }
  }
  const ejecutarEliminar = async () => {
    if (!confirmElim) return
    setEliminandoUb(true)
    try { await ubicacionesDocsApi.eliminar(confirmElim.codigo_ubicacion); setConfirmElim(null); setPreviewElim(null); cargarUbicaciones() }
    catch { setConfirmElim(null); setPreviewElim(null) } finally { setEliminandoUb(false) }
  }

  // Carga desde directorio
  const iniciarEscaneoDir = async () => {
    if (!soportaDirectoryPicker()) { alert(t('alertNavegadorNoSoporta')); return }
    setEscaneandoDir(true); setResultadoSync(null)
    try {
      const r = await escanearDirectorio()
      if (!r) { setEscaneandoDir(false); return }
      setDirHandleState(r.dirHandle); await setDirectoryHandle(r.dirHandle, userId, grupoActivo)
      setDatosEscaneo(r); setModalCarga(true)
    } catch { alert(t('alertErrorEscaneo')) }
    finally { setEscaneandoDir(false) }
  }
  const ejecutarSincronizacion = async () => {
    if (!datosEscaneo) return
    setSincronizando(true)
    try {
      const res = await ubicacionesDocsApi.sincronizar({ directorios: datosEscaneo.directorios })
      setResultadoSync(res); cargarUbicaciones()
      setEtapa1Estado('completado')
    } catch (e) {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || t('alertErrorSincronizar') : t('alertErrorSincronizar')
      alert(msg)
    } finally { setSincronizando(false) }
  }
  const cerrarModalCarga = () => { setModalCarga(false); setDatosEscaneo(null); setResultadoSync(null) }

  // Escaneo + sincronización inline (sin modal, con barra de progreso)
  const sincronizarDirectamente = async () => {
    if (!soportaDirectoryPicker()) { alert(t('alertNavegadorNoSoporta')); return }
    setSyncEstado('escaneando'); setSyncMensaje('')
    try {
      const r = await escanearDirectorio()
      if (!r) { setSyncEstado('idle'); return }
      setDirHandleState(r.dirHandle); await setDirectoryHandle(r.dirHandle, userId, grupoActivo)
      setSyncEstado('sincronizando')
      const res = await ubicacionesDocsApi.sincronizar({ directorios: r.directorios })
      setSyncMensaje(`${res.insertadas} nuevas · ${res.actualizadas} actualizadas · ${res.eliminadas} eliminadas`)
      setSyncEstado('listo')
      setEtapa1Estado('completado')
      cargarUbicaciones()
    } catch (e) {
      setSyncEstado('error')
      setSyncMensaje(e instanceof Error ? e.message : t('alertErrorSincronizar'))
    }
  }

  // Preview diferencias
  const filtrarPorInhabilitadas = (dirs: DirectorioEscaneado[]) => {
    const inhab = new Set(ubicaciones.filter((u) => !u.ubicacion_habilitada).map((u) => u.codigo_ubicacion))
    if (!inhab.size) return { filtrados: dirs, excluidos: 0 }
    const padres: Record<string, string | undefined> = {}
    for (const d of dirs) padres[d.codigo_ubicacion] = d.codigo_ubicacion_superior || undefined
    const esDescInhab = (cod: string): boolean => {
      const vis = new Set<string>(); let actual = padres[cod] || ubicaciones.find((u) => u.codigo_ubicacion === cod)?.codigo_ubicacion_superior
      while (actual) { if (inhab.has(actual)) return true; if (vis.has(actual)) break; vis.add(actual); actual = padres[actual] || ubicaciones.find((u) => u.codigo_ubicacion === actual)?.codigo_ubicacion_superior || undefined }
      return false
    }
    const filtrados = dirs.filter((d) => !esDescInhab(d.codigo_ubicacion))
    return { filtrados, excluidos: dirs.length - filtrados.length }
  }
  const calcularDiff = () => {
    if (!datosEscaneo) return { nuevas: 0, aEliminar: 0, sinCambio: 0, excluidas: 0 }
    const { filtrados, excluidos } = filtrarPorInhabilitadas(datosEscaneo.directorios)
    const actuals = new Set(ubicaciones.map((u) => u.codigo_ubicacion))
    const escans = new Set(filtrados.map((d) => d.codigo_ubicacion))
    return { nuevas: filtrados.filter((d) => !actuals.has(d.codigo_ubicacion)).length, aEliminar: ubicaciones.filter((u) => !escans.has(u.codigo_ubicacion)).length, sinCambio: filtrados.filter((d) => actuals.has(d.codigo_ubicacion)).length, excluidas: excluidos }
  }

  // Render árbol
  const opcionesPadre = (excluir?: string): UbicacionDoc[] => {
    if (!excluir) return ubicaciones
    const desc = new Set<string>()
    const buscar = (c: string) => {
      for (const u of ubicaciones) {
        if (u.codigo_ubicacion_superior === c && !desc.has(u.codigo_ubicacion)) {
          desc.add(u.codigo_ubicacion)
          buscar(u.codigo_ubicacion)
        }
      }
    }
    desc.add(excluir)
    buscar(excluir)
    return ubicaciones.filter((u) => !desc.has(u.codigo_ubicacion))
  }
  const filtradosUbs = busquedaUbs
    ? ubicaciones.filter((u) => u.nombre_ubicacion.toLowerCase().includes(busquedaUbs.toLowerCase()) || u.codigo_ubicacion.toLowerCase().includes(busquedaUbs.toLowerCase()) || (u.url || '').toLowerCase().includes(busquedaUbs.toLowerCase()))
    : ubicaciones

  const renderNodo = (u: UbicacionDoc) => {
    const hijos = tieneHijos(u.codigo_ubicacion)
    const expandido = expandidos.has(u.codigo_ubicacion)
    const indent = u.nivel * 24
    const esArea = u.tipo_ubicacion === 'AREA'
    const rowBg = esArea ? 'bg-amber-50 hover:bg-amber-100' : 'bg-blue-50 hover:bg-blue-100'
    const folderColor = esArea ? 'text-amber-500' : 'text-blue-500'
    return (
      <div key={u.codigo_ubicacion}>
        <div
          className={`flex items-center gap-2 px-3 py-1 ${rowBg} rounded group transition-colors`}
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          <button
            onClick={() => toggleExpandir(u.codigo_ubicacion)}
            className={`p-0.5 rounded transition-colors ${hijos ? 'hover:bg-primario-muy-claro text-texto-muted hover:text-primario' : 'invisible'}`}
          >
            {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expandido && hijos ? (
            <FolderOpen size={14} className={`${folderColor} shrink-0`} />
          ) : (
            <Folder size={14} className={`${folderColor} shrink-0`} />
          )}
          <div className="flex-1 min-w-0 truncate cursor-pointer" title={`${u.nombre_ubicacion} (${u.codigo_ubicacion})`} onDoubleClick={() => abrirEditarUb(u)}>
            <span className="font-medium text-xs">{u.nombre_ubicacion}</span>
            <span className="text-xs text-texto-muted ml-2">({u.codigo_ubicacion})</span>
          </div>
          <span className="text-xs text-texto-muted truncate max-w-[300px] shrink-0 hidden lg:block" title={u.url || ''}>
            {u.url || ''}
          </span>
          <Insignia variante={u.tipo_ubicacion === 'AREA' ? 'advertencia' : 'primario'}>{u.tipo_ubicacion}</Insignia>
          <Insignia variante={u.ubicacion_habilitada ? 'exito' : 'advertencia'}>{u.ubicacion_habilitada ? t('habilitada') : t('inhabilitada')}</Insignia>
          <Insignia variante='exito'>{tc('activo')}</Insignia>
          <div className="flex items-center gap-0.5 shrink-0 transition-opacity">
            <button onClick={() => toggleHabilitada(u)} className={`p-1.5 rounded-lg transition-colors ${u.ubicacion_habilitada ? 'hover:bg-amber-50 text-texto-muted hover:text-amber-600' : 'hover:bg-green-50 text-texto-muted hover:text-green-600'}`} title={u.ubicacion_habilitada ? t('inhabilitarConHijos') : t('habilitarConHijos')}>
              {u.ubicacion_habilitada ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            </button>
            <button onClick={() => setConfirmarTipo({ u, nuevoTipo: u.tipo_ubicacion === 'AREA' ? 'CONTENIDO' : 'AREA' })} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={t('cambiarA', { tipo: u.tipo_ubicacion === 'AREA' ? 'CONTENIDO' : 'AREA' })}><Shuffle size={14} /></button>
            <button onClick={() => abrirEditarUb(u)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={tc('editar')}><Pencil size={14} /></button>
            <button onClick={() => abrirConfirmElim(u)} className="p-1.5 rounded-lg hover:bg-orange-50 text-texto-muted hover:text-orange-500 transition-colors" title={t('quitarDeBd')}><X size={14} className="stroke-[2.5]" /></button>
          </div>
        </div>
        {expandido && ubicaciones.filter((h) => h.codigo_ubicacion_superior === u.codigo_ubicacion).sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion)).map((h) => renderNodo(h))}
      </div>
    )
  }
  const raices = filtradosUbs.filter((u) => !u.codigo_ubicacion_superior).sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))

  // ════════════════════════════════════════════════════════════════════════════
  // ETAPA 2 — Indexar Documentos (pipeline)
  // ════════════════════════════════════════════════════════════════════════════

  const [progresos, setProgresos] = useState<Record<string, ProgresoPaso>>(progresosIniciales)
  const [ejecutando, setEjecutando] = useState(false)
  const [dirHandle, _setDirHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const setDirHandleState = (h: FileSystemDirectoryHandle | null) => {
    dirHandleRef.current = h
    _setDirHandleState(h)
  }
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [mensajeError, setMensajeError] = useState('')
  const [totalDocs, setTotalDocs] = useState(0)
  const [docsVectorizados, setDocsVectorizados] = useState(0)
  const [docsPendientes, setDocsPendientes] = useState(0)
  const [docsNoVectorizables, setDocsNoVectorizables] = useState(0)

  const abortRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveColaRef = useRef<(() => void) | null>(null)
  // Ref que siempre apunta al handle actual, evita stale closure en funciones async
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)

  // Resumen pipeline (polling backend) — desglose por fase + workers + velocidad
  const [resumenPipeline, setResumenPipeline] = useState<ResumenPipeline | null>(null)
  const resumenPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Nombre del documento que se está trabajando AHORA MISMO.
  // - Para pasos client-side (EXTRAER) lo seteamos vía onItem (feedback inmediato).
  // - Para pasos backend (ANALIZAR/CHUNKEAR/VECTORIZAR) lo lee `resumenPipeline.doc_en_proceso`.
  const [archivoActualLocal, setArchivoActualLocal] = useState<string | null>(null)

  // Diálogo de reanudación: detecta items EN_PROCESO huérfanos de sesión previa
  // (típicamente tras reinicio de Railway). Se chequea una vez al montar/cambiar
  // de grupo. Si hay > 0, abre ModalConfirmar; el usuario elige Continuar (libera
  // + reanuda) o Dejar pausados (cierra y no vuelve a preguntar en esa sesión).
  const HUERFANOS_MINUTOS = 5
  const [huerfanosCount, setHuerfanosCount] = useState<number>(0)
  const [mostrarModalReanudacion, setMostrarModalReanudacion] = useState(false)
  const [reanudando, setReanudando] = useState(false)

  const handleColaChange = useCallback(() => {
    if (resolveColaRef.current) { resolveColaRef.current(); resolveColaRef.current = null }
  }, [])
  const { suscribir: suscribirCola, desuscribir: desuscribirCola } = useColaRealtime(grupoActivo, handleColaChange)

  useEffect(() => {
    if (ejecutando && tiempoInicio) {
      timerRef.current = setInterval(() => setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000)), 1000)
    } else { if (timerRef.current) clearInterval(timerRef.current) }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [ejecutando, tiempoInicio])

  // Polling del resumen del pipeline mientras se está ejecutando
  useEffect(() => {
    const cargar = () => {
      colaEstadosDocsApi.resumenPipeline(120).then(setResumenPipeline).catch(() => { /* ignorar */ })
    }
    if (ejecutando) {
      cargar()
      resumenPollRef.current = setInterval(cargar, 2500)
    } else {
      // Una carga al montar/cuando deja de ejecutar para tener números frescos
      cargar()
      if (resumenPollRef.current) clearInterval(resumenPollRef.current)
    }
    return () => { if (resumenPollRef.current) clearInterval(resumenPollRef.current) }
  }, [ejecutando, grupoActivo])

  const cargarConteos = useCallback(async () => {
    try {
      const conteos = await documentosApi.contarPorEstado()
      setProgresos((prev) => {
        const next = { ...prev }
        for (const paso of PASOS) {
          // CARGAR no tiene estadoOrigen (lee del filesystem, no de docs)
          const totalEstado = paso.estadoOrigen ? (conteos[paso.estadoOrigen] ?? 0) : 0
          next[paso.key] = { ...next[paso.key], total: totalEstado, completados: 0, estado: 'esperando' }
        }
        return next
      })
      const vectorizados = ESTADOS_VECTORIZADOS.reduce((acc, e) => acc + (conteos[e] ?? 0), 0)
      const pendientes = ESTADOS_PENDIENTES.reduce((acc, e) => acc + (conteos[e] ?? 0), 0)
      const noVectorizables = ESTADOS_NO_VECTORIZABLES.reduce((acc, e) => acc + (conteos[e] ?? 0), 0)
      const total = Object.values(conteos as Record<string, number>).reduce((a, b) => a + b, 0)
      setTotalDocs(total)
      setDocsVectorizados(vectorizados)
      setDocsPendientes(pendientes)
      setDocsNoVectorizables(noVectorizables)
    } catch { /* ignorar */ }
  }, [])

  useEffect(() => {
    getDirectoryHandle(userId, grupoActivo).then((h) => { if (h) { dirHandleRef.current = h; setDirHandleState(h) } })
    cargarConteos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  // Chequeo de huérfanos al montar / cambiar de grupo. Sólo abre el modal si hay > 0.
  useEffect(() => {
    if (!grupoActivo) return
    colaEstadosDocsApi.contarHuerfanos(HUERFANOS_MINUTOS)
      .then(({ cantidad }) => {
        if (cantidad > 0) {
          setHuerfanosCount(cantidad)
          setMostrarModalReanudacion(true)
        }
      })
      .catch(() => { /* silencioso: si falla el chequeo no bloqueamos la pantalla */ })
  }, [grupoActivo])

  const confirmarReanudacion = async () => {
    setReanudando(true)
    try {
      await colaEstadosDocsApi.recuperarHuerfanos(HUERFANOS_MINUTOS)
      await colaEstadosDocsApi.ejecutar()
      setMostrarModalReanudacion(false)
      cargarConteos()
    } catch {
      // Si falla, el usuario puede reintentar manualmente desde el botón Ejecutar
      setMostrarModalReanudacion(false)
    } finally {
      setReanudando(false)
    }
  }

  const setPaso = (key: string, patch: Partial<ProgresoPaso>) =>
    setProgresos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  // EXTRAER (CARGADO → METADATA, client-side): delega en _lib/ejecutar-paso para
  // compartir lógica con /process-documents (OCR, antiword, fast-path de tipos no
  // textuales, truncado MAX_CHARS, DEBUG_TIEMPOS_PIPELINE).
  const ejecutarExtraer = async (tope?: number): Promise<boolean> => {
    setPaso('EXTRAER', { total: 0, completados: 0, estado: 'activo' })
    const result = await ejecutarExtraerLib({
      userId,
      grupoActivo,
      procesos,
      filtros: { tope: tope && tope > 0 ? String(tope) : undefined, ubicacionSel: ubicacionSel || undefined },
      dirHandle: dirHandleRef.current ?? dirHandle ?? undefined,
      abortRef,
      onDirHandle: (h) => { dirHandleRef.current = h; setDirHandleState(h) },
      onProgreso: (completados, total) => setPaso('EXTRAER', { completados, total }),
      onItem: (item) => {
        if (item.estado_cola === 'EN_PROCESO' && item.nombre_documento) {
          setArchivoActualLocal(item.nombre_documento)
        }
      },
    })
    // Limpiar override local: a partir de aquí "Ahora mismo" debe leer el
    // doc EN_PROCESO del backend (ESCANEAR/CHUNKEAR/VECTORIZAR), no el último
    // archivo de EXTRAER. Sin esto, archivoActualLocal queda congelado y
    // sombrea a resumenPipeline.doc_en_proceso en las fases posteriores.
    setArchivoActualLocal(null)
    setPaso('EXTRAER', { estado: result.ok ? 'listo' : (abortRef.current ? 'esperando' : 'error') })
    return result.ok
  }

  // ANALIZAR / CHUNKEAR / VECTORIZAR: delegan en _lib/ejecutar-paso → ejecutarPasoBackend
  // que usa inicializarPorEstado (filtros server-side: tope, ubicación, q) + dispara /ejecutar.
  const ejecutarPasoBackend = async (key: string, estadoOrigen: string, estadoDestino: string, tope?: number): Promise<boolean> => {
    setPaso(key, { total: 0, completados: 0, estado: 'activo' })
    const ok = await ejecutarPasoBackendLib({
      estadoOrigen,
      estadoDestino,
      codigoProceso: key,
      filtros: { tope: tope && tope > 0 ? String(tope) : undefined, ubicacionSel: ubicacionSel || undefined },
      abortRef,
      resolveColaRef,
      onProgreso: (completados, total) => setPaso(key, { completados, total }),
    })
    setPaso(key, { estado: ok ? 'listo' : (abortRef.current ? 'esperando' : 'error') })
    return ok
  }

  // Paso 2 — CARGAR: delega en _lib/ejecutar-paso (escanearParaCarga + ejecutarCarga).
  // /process-pipeline auto-confirma (sin diálogo intermedio) — el botón Ejecutar ya
  // es la confirmación implícita del usuario.
  const ejecutarCargar = async (): Promise<boolean> => {
    setPaso('CARGAR', { total: 1, completados: 0, estado: 'activo' })
    try {
      // Si hay ubicación seleccionada, acotar a esa rama (raíz + descendientes).
      const ubicacionesLib: UbicacionOpt[] = ubicacionesSeleccionadasConDescendientes().map((u) => ({
        codigo_ubicacion: u.codigo_ubicacion,
        nombre_ubicacion: u.nombre_ubicacion,
        url: u.url ?? '',
        nivel: u.nivel ?? 0,
        tipo_ubicacion: u.tipo_ubicacion,
        codigo_ubicacion_superior: u.codigo_ubicacion_superior ?? undefined,
        ubicacion_habilitada: u.ubicacion_habilitada,
      }))
      const pending = await escanearParaCarga({
        userId,
        grupoActivo,
        ubicaciones: ubicacionesLib,
        nivelesDirectorio: 5,
        dirHandle: dirHandleRef.current ?? dirHandle ?? undefined,
      })
      if (!pending) { setPaso('CARGAR', { estado: 'listo' }); return true }
      if (pending.scan.dirHandle && pending.scan.dirHandle !== dirHandle) {
        dirHandleRef.current = pending.scan.dirHandle
        setDirHandleState(pending.scan.dirHandle)
      }
      const totalArchivos = pending.archivosParaCargar.length || 1
      setPaso('CARGAR', { total: totalArchivos, completados: 0, estado: 'activo' })
      await ejecutarCargaLib(pending)
      setPaso('CARGAR', { total: totalArchivos, completados: totalArchivos, estado: 'listo' })
      return true
    } catch (e) {
      setPaso('CARGAR', { estado: 'error' })
      setMensajeError(e instanceof Error ? e.message : t('errorInesperado'))
      return false
    }
  }

  const ejecutarUnPaso = async (key: string, tope?: number): Promise<boolean> => {
    if (key === 'CARGAR') return ejecutarCargar()
    if (key === 'EXTRAER') return ejecutarExtraer(tope)
    const paso = PASOS.find((p) => p.key === key)
    if (!paso) return true
    return ejecutarPasoBackend(paso.key, paso.estadoOrigen, paso.estadoDestino, tope)
  }

  // Recorre las fases del pipeline en una sola ventana de hasta `tope` docs.
  // Si tope no viene, procesa todo lo pendiente (compatibilidad hacia atrás).
  const ejecutarFasesDelPipeline = async (tope?: number): Promise<boolean> => {
    for (const paso of PASOS) {
      if (abortRef.current) return false
      // CARGAR y EXTRAER son client-side: no reciben tope (procesan lo que el filesystem tiene).
      // Los pasos backend (ANALIZAR, CHUNKEAR, VECTORIZAR) sí reciben tope = TAMANO_PAQUETE.
      const topeFase = paso.clienteSide ? undefined : tope
      const ok = await ejecutarUnPaso(paso.key, topeFase)
      if (!ok) return false
    }
    return true
  }

  // Pipeline por paquetes operativos: procesa ventanas de TAMANO_PAQUETE docs,
  // limpia COMPLETADOs entre paquetes para acotar SQLite/WAL en cliente y dar
  // feedback amigable al usuario en pasos discretos. Ver:
  // docs/planes/PLAN_PROCESAMIENTO_PAQUETES.md § Paquete operativo
  const ejecutarPipeline = async () => {
    setMensajeError(''); abortRef.current = false; setEjecutando(true); setTiempoInicio(Date.now()); setTiempoTranscurrido(0); setProgresos(progresosIniciales()); setArchivoActualLocal(null); suscribirCola()
    try {
      // Leer tamaño de paquete del resumen del pipeline
      let tamanoPaquete = 0
      try {
        const resumen = await colaEstadosDocsApi.resumenPipeline(120)
        tamanoPaquete = resumen?.paquete?.tamano_paquete ?? 0
      } catch { /* si falla, modo legacy sin paquetes */ }

      if (tamanoPaquete <= 0) {
        // Modo legacy: procesa todo en una sola corrida
        for (const paso of PASOS) {
          if (abortRef.current) break
          const ok = await ejecutarUnPaso(paso.key)
          if (!ok) break
        }
      } else {
        // Loop de paquetes: corre fases con tope = TAMANO_PAQUETE, limpia, repite
        const ESTADOS_PIPELINE_INTERMEDIOS = ['CARGADO', 'METADATA', 'ESCANEADO', 'CHUNKEADO']
        let iteraciones = 0
        const MAX_ITERACIONES = 200 // safety guard
        // Siempre ejecutar al menos una ronda completa (incluye CARGAR).
        while (!abortRef.current && iteraciones < MAX_ITERACIONES) {
          iteraciones += 1

          // Procesar UNA ventana
          const ok = await ejecutarFasesDelPipeline(tamanoPaquete)
          if (!ok) break

          // Cierre del paquete: limpia COMPLETADOs para acotar la cola
          try { await colaEstadosDocsApi.limpiarCompletados() } catch { /* no bloquear si falla */ }

          // Refrescar contadores para que la BarraPaqueteOperativo avance
          await cargarConteos()
          try {
            const resumen2 = await colaEstadosDocsApi.resumenPipeline(120)
            setResumenPipeline(resumen2)
          } catch { /* ignorar */ }

          // Verificar si quedaron pendientes para seguir iterando
          let pendientes = 0
          try {
            const conteos = await documentosApi.contarPorEstado()
            pendientes = ESTADOS_PIPELINE_INTERMEDIOS.reduce((acc, e) => acc + (conteos[e] ?? 0), 0)
          } catch { break }
          if (pendientes <= 0) break
        }
      }
    } catch (e) { setMensajeError(e instanceof Error ? e.message : t('errorInesperado')) }
    finally { desuscribirCola(); setEjecutando(false); await cargarConteos() }
  }

  // Pipeline completo desde la tab Ubicaciones.
  // - Si ya hay ubicaciones en BD → salta el Paso 1 (no abre el finder) y va directo al pipeline.
  // - Si no hay ubicaciones → abre el finder para crearlas primero.
  const ejecutarPipelineUbicaciones = async () => {
    setMensajeError(''); abortRef.current = false; setEjecutando(true); setTiempoInicio(Date.now()); setTiempoTranscurrido(0); setProgresos(progresosIniciales()); setArchivoActualLocal(null); suscribirCola()
    try {
      // Paso 1: indexar ubicaciones — solo si no hay ubicaciones en BD
      if (ubicaciones.length === 0) {
        if (!soportaDirectoryPicker()) { setMensajeError(t('alertNavegadorNoSoporta') || 'Navegador no soporta File System Access API'); return }
        setPaso(PASO_INDEXAR, { total: 1, completados: 0, estado: 'activo' })
        try {
          const r = await escanearDirectorio()
          if (!r) { setPaso(PASO_INDEXAR, { estado: 'listo' }) /* usuario canceló */; return }
          setDirHandleState(r.dirHandle); await setDirectoryHandle(r.dirHandle, userId, grupoActivo)
          const res = await ubicacionesDocsApi.sincronizar({ directorios: r.directorios })
          setSyncMensaje(`${res.insertadas} nuevas · ${res.actualizadas} actualizadas · ${res.eliminadas} eliminadas`)
          setPaso(PASO_INDEXAR, { total: 1, completados: 1, estado: 'listo' })
          setEtapa1Estado('completado')
          await cargarUbicaciones()
        } catch (e) {
          setPaso(PASO_INDEXAR, { estado: 'error' })
          setMensajeError(e instanceof Error ? e.message : (t('alertErrorSincronizar') || 'Error al sincronizar'))
          return
        }
        if (abortRef.current) return
      } else {
        // Ya hay ubicaciones — marcar Paso 1 como completado sin abrir el finder
        setPaso(PASO_INDEXAR, { total: 1, completados: 1, estado: 'listo' })
      }
      // Pasos 2-6: pipeline de Documentos en paquetes operativos
      let tamanoPaquete = 0
      try {
        const resumen = await colaEstadosDocsApi.resumenPipeline(120)
        tamanoPaquete = resumen?.paquete?.tamano_paquete ?? 0
      } catch { /* modo legacy */ }

      if (tamanoPaquete <= 0) {
        for (const paso of PASOS) {
          if (abortRef.current) break
          const ok = await ejecutarUnPaso(paso.key)
          if (!ok) break
        }
      } else {
        const ESTADOS_PIPELINE_INTERMEDIOS = ['CARGADO', 'METADATA', 'ESCANEADO', 'CHUNKEADO']
        let iteraciones = 0
        const MAX_ITERACIONES = 200
        // Siempre ejecutar al menos una ronda completa (incluye CARGAR que llena los docs).
        // Luego verificar pendientes para decidir si hay que repetir con más paquetes.
        while (!abortRef.current && iteraciones < MAX_ITERACIONES) {
          iteraciones += 1
          const ok = await ejecutarFasesDelPipeline(tamanoPaquete)
          if (!ok) break
          try { await colaEstadosDocsApi.limpiarCompletados() } catch { /* no bloquear */ }
          await cargarConteos()
          try {
            const resumen2 = await colaEstadosDocsApi.resumenPipeline(120)
            setResumenPipeline(resumen2)
          } catch { /* ignorar */ }
          // Verificar si quedaron pendientes para seguir iterando
          let pendientes = 0
          try {
            const conteos = await documentosApi.contarPorEstado()
            pendientes = ESTADOS_PIPELINE_INTERMEDIOS.reduce((acc, e) => acc + (conteos[e] ?? 0), 0)
          } catch { break }
          if (pendientes <= 0) break
        }
      }
    } catch (e) { setMensajeError(e instanceof Error ? e.message : t('errorInesperado')) }
    finally { desuscribirCola(); setEjecutando(false); await cargarConteos() }
  }

  const detener = () => {
    abortRef.current = true
    if (resolveColaRef.current) { resolveColaRef.current(); resolveColaRef.current = null }
  }

  const formatTiempo = (seg: number) => { const m = Math.floor(seg / 60); return m > 0 ? `${m}m ${seg % 60}s` : `${seg % 60}s` }
  const todosListos = PASOS.every((p) => progresos[p.key]?.estado === 'listo')
  const etapa2Estado: EstadoEtapa = ejecutando ? 'activo' : todosListos ? 'completado' : 'pendiente'

  // Barra de paquete operativo — vista lógica sobre la corrida. Doble propósito:
  // (a) acotar SQLite/WAL en cliente para soportar 100k+ docs;
  // (b) mostrar avance al usuario en pasos discretos visibles aunque la corrida sea larga.
  // Detalle: docs/planes/PLAN_PROCESAMIENTO_PAQUETES.md § Paquete operativo
  const BarraPaqueteOperativo = () => {
    const paq = resumenPipeline?.paquete
    if (!paq || paq.docs_totales === 0) return null

    // Segmentos por estado del pipeline: cada uno muestra su porcentaje sobre el total de docs
    const SEGMENTOS_PIPELINE = [
      { estado: 'CARGADO',     color: '#0EA5E9', label: 'Cargado'     },
      { estado: 'METADATA',    color: '#074B91', label: 'Metadata'    },
      { estado: 'ESCANEADO',   color: '#F97316', label: 'Escaneado'   },
      { estado: 'CHUNKEADO',   color: '#84CC16', label: 'Chunkeado'   },
      { estado: 'VECTORIZADO', color: '#22C55E', label: 'Vectorizado' },
    ]

    // Conteos por estado provienen de por_destino (completado) más estimación desde paquete
    // Usamos por_destino cuando está disponible; para CARGADO no hay destino en cola, estimamos.
    const conteosPorEstado: Record<string, number> = {}
    if (resumenPipeline?.por_destino) {
      conteosPorEstado['METADATA']    = (resumenPipeline.por_destino['METADATA']?.completado    ?? 0) + (resumenPipeline.por_destino['METADATA']?.pendiente    ?? 0) + (resumenPipeline.por_destino['METADATA']?.en_proceso    ?? 0)
      conteosPorEstado['ESCANEADO']   = (resumenPipeline.por_destino['ESCANEADO']?.completado   ?? 0) + (resumenPipeline.por_destino['ESCANEADO']?.pendiente    ?? 0) + (resumenPipeline.por_destino['ESCANEADO']?.en_proceso    ?? 0)
      conteosPorEstado['CHUNKEADO']   = (resumenPipeline.por_destino['CHUNKEADO']?.completado   ?? 0) + (resumenPipeline.por_destino['CHUNKEADO']?.pendiente    ?? 0) + (resumenPipeline.por_destino['CHUNKEADO']?.en_proceso    ?? 0)
      conteosPorEstado['VECTORIZADO'] = (resumenPipeline.por_destino['VECTORIZADO']?.completado ?? 0) + (resumenPipeline.por_destino['VECTORIZADO']?.pendiente   ?? 0) + (resumenPipeline.por_destino['VECTORIZADO']?.en_proceso   ?? 0)
    }
    // CARGADO = docs_totales - suma de los demás
    const sumaOtros = (conteosPorEstado['METADATA'] ?? 0) + (conteosPorEstado['ESCANEADO'] ?? 0) + (conteosPorEstado['CHUNKEADO'] ?? 0) + (conteosPorEstado['VECTORIZADO'] ?? 0)
    conteosPorEstado['CARGADO'] = Math.max(0, paq.docs_totales - sumaOtros)

    return (
      <div
        className="flex flex-col gap-1.5 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-3"
        data-testid="barra-paquete-operativo"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-texto">
            Paquete <span data-testid="paquete-actual" className="tabular-nums">{paq.paquete_actual}</span> de <span data-testid="paquetes-totales" className="tabular-nums">{paq.paquetes_totales}</span>
          </span>
          <span className="tabular-nums text-texto-muted">
            <span data-testid="docs-completados">{paq.docs_completados.toLocaleString()}</span>
            {' de '}
            <span data-testid="docs-totales">{paq.docs_totales.toLocaleString()}</span>
            {' docs · lote '}
            <span data-testid="tamano-paquete">{paq.tamano_paquete.toLocaleString()}</span>
          </span>
        </div>
        {/* Barra segmentada por estado */}
        <div className="flex w-full h-2.5 rounded-full overflow-hidden gap-0.5" data-testid="paquete-progreso">
          {SEGMENTOS_PIPELINE.map(({ estado, color, label }) => {
            const count = conteosPorEstado[estado] ?? 0
            const pct = paq.docs_totales > 0 ? (count / paq.docs_totales) * 100 : 0
            if (pct <= 0) return null
            return (
              <div
                key={estado}
                title={`${label}: ${count.toLocaleString()}`}
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? 4 : 0 }}
              />
            )
          })}
        </div>
        {/* Leyenda de estados con docs */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums text-texto-muted pt-0.5">
          {SEGMENTOS_PIPELINE.map(({ estado, color, label }) => {
            const count = conteosPorEstado[estado] ?? 0
            if (count === 0) return null
            return (
              <span key={estado} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                {label}: {count.toLocaleString()}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  // Barra de progreso individual numerada — etiqueta "Paso N", conteo + desglose backend
  const BarraPasoNumerada = ({ pasoKey, numero, color }: { pasoKey: string; numero: number; color: string }) => {
    const prog = progresos[pasoKey]
    const estado = prog?.estado ?? 'esperando'
    const total = prog?.total ?? 0
    const completados = prog?.completados ?? 0
    const pct = total > 0 ? Math.min(100, Math.round((completados / total) * 100)) : (estado === 'listo' ? 100 : 0)
    const estaActivo = estado === 'activo'
    const estaListo = estado === 'listo'
    const estaError = estado === 'error'

    // Desglose backend: solo para pasos que mapean a un estado destino consultable
    const pasoCfg = PASOS.find((p) => p.key === pasoKey)
    const estadoDestino = pasoCfg?.estadoDestino
    const fase = estadoDestino ? resumenPipeline?.por_destino?.[estadoDestino] : undefined

    return (
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${estaActivo ? 'animate-pulse' : ''}`}
            style={{
              width: estaListo ? '100%' : `${pct}%`,
              backgroundColor: estaError ? '#EF4444' : (estaListo || estaActivo) ? color : '#D1D5DB',
              opacity: estaListo ? 1 : estaActivo ? 0.85 : 0.4,
            }}
          />
        </div>
        {fase && (fase.en_proceso > 0 || fase.pendiente > 0 || fase.completado > 0 || fase.error > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums leading-tight pt-0.5">
            {fase.en_proceso > 0 && (
              <span className="text-amber-700" title="En proceso (workers activos)">
                ▶ {fase.en_proceso}
                {fase.workers_activos > 0 && <span className="text-texto-muted"> ({fase.workers_activos}w)</span>}
              </span>
            )}
            {fase.pendiente > 0 && (
              <span className="text-texto-muted" title="Esperando">⧗ {fase.pendiente}</span>
            )}
            {fase.completado > 0 && (
              <span className="text-green-700" title="Completados">✓ {fase.completado}</span>
            )}
            {fase.error > 0 && (
              <span className="text-red-600" title="Errores">✕ {fase.error}</span>
            )}
            {fase.velocidad_docs_por_min > 0 && (
              <span className="text-texto-muted" title="Velocidad reciente (últimos 2 min)">
                · {fase.velocidad_docs_por_min}/min
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // ETA global y velocidad agregada del pipeline
  const etaInfo = (() => {
    if (!resumenPipeline) return null
    const fases = Object.values(resumenPipeline.por_destino)
    const totalEnCurso = fases.reduce((acc, f) => acc + f.pendiente + f.en_proceso, 0)
    const velocidadMin = fases.reduce((acc, f) => acc + f.velocidad_docs_por_min, 0)
    if (totalEnCurso === 0) return null
    const minutosEta = velocidadMin > 0 ? totalEnCurso / velocidadMin : null
    return { totalEnCurso, velocidadMin: Math.round(velocidadMin * 10) / 10, minutosEta }
  })()

  const formatEta = (min: number | null): string => {
    if (min === null) return '—'
    if (min < 1) return '<1 min'
    if (min < 60) return `~${Math.ceil(min)} min`
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return m > 0 ? `~${h} h ${m} min` : `~${h} h`
  }

  // ── Círculo de etapa ──────────────────────────────────────────────────────
  const circuloEtapa = (num: number, estado: EstadoEtapa) => {
    const bg = estado === 'completado' ? 'bg-green-500' : estado === 'activo' ? 'bg-primario' : 'bg-gray-300'
    const text = estado === 'pendiente' ? 'text-gray-600' : 'text-white'
    return (
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors duration-300 ${bg} ${text}`}>
        {estado === 'completado' ? <CheckCircle size={20} /> : num}
      </div>
    )
  }

  const diff = datosEscaneo ? calcularDiff() : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col gap-6 max-w-7xl">
      <BotonChat className="top-0 right-0" />
      <PageHeader className="pr-28" i18nNamespace="processPipeline" />

      {/* ══════════════════════════════════════════════════════════════════════
          Contenido: Documentos
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">
            {/* Pipeline Conversacional — estilo C (dial triple + mensaje del asistente) */}
            {(() => {
              const idxActivo = PASOS.findIndex(p => progresos[p.key]?.estado === 'activo')
              const idxFase = idxActivo >= 0
                ? FASES_NARRATIVAS.findIndex(f => f.estadoDestino === PASOS[idxActivo].estadoDestino)
                : -1
              const indiceActivo = idxFase >= 0 ? idxFase : 0
              const nombreEtapa = idxFase >= 0 ? FASES_NARRATIVAS[idxFase].etiquetaCorta : 'CARGANDO'

              const paq = resumenPipeline?.paquete
              const lote = paq && paq.paquetes_totales > 0
                ? { actual: paq.paquete_actual, total: paq.paquetes_totales }
                : { actual: 1, total: 1 }

              const progActiva = idxActivo >= 0 ? progresos[PASOS[idxActivo].key] : null
              // Documento "AHORA MISMO":
              // 1) prioriza local (EXTRAER client-side, feedback inmediato)
              // 2) cae al doc EN_PROCESO del backend (ANALIZAR/CHUNKEAR/VECTORIZAR)
              const archivoActual = archivoActualLocal
                ?? resumenPipeline?.doc_en_proceso?.nombre_documento
                ?? undefined
              const actual = {
                completados: progActiva?.completados ?? docsVectorizados,
                total: progActiva?.total || totalDocs || 1,
                archivoActual,
              }

              const minEta = etaInfo?.minutosEta ?? null
              const mensajeEnProc = minEta != null
                ? `${docsVectorizados.toLocaleString()} de ${totalDocs.toLocaleString()} documentos. Quedan unos ${formatearMinutos(minEta).replace('~', '')}.`
                : `${docsVectorizados.toLocaleString()} de ${totalDocs.toLocaleString()} documentos.`

              const tieneHijosUbic = (cod: string) =>
                ubicaciones.some((u) => u.codigo_ubicacion !== cod && u.codigo_ubicacion_superior === cod)
              const toggleExpandirUbic = (e: React.MouseEvent, cod: string) => {
                e.stopPropagation()
                setUbicExpandidos((prev) => {
                  const next = new Set(prev)
                  next.has(cod) ? next.delete(cod) : next.add(cod)
                  return next
                })
              }
              const renderNodoUbic = (u: UbicacionDoc): React.ReactNode => {
                const tieneHijos = tieneHijosUbic(u.codigo_ubicacion)
                const expandido = ubicExpandidos.has(u.codigo_ubicacion)
                const esArea = u.tipo_ubicacion === 'AREA'
                const selec = ubicacionSel === u.codigo_ubicacion
                const hijos = tieneHijos
                  ? ubicaciones
                      .filter((h) => h.codigo_ubicacion_superior === u.codigo_ubicacion)
                      .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
                  : []
                return (
                  <div key={u.codigo_ubicacion}>
                    <div
                      className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer select-none ${selec ? 'bg-primario-muy-claro' : ''}`}
                      style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }}
                      onClick={() => setUbicacionSel(ubicacionSel === u.codigo_ubicacion ? '' : u.codigo_ubicacion)}
                    >
                      {tieneHijos
                        ? <button onClick={(e) => toggleExpandirUbic(e, u.codigo_ubicacion)} className="shrink-0 hover:text-primario text-texto-muted p-0.5 -ml-0.5 rounded">
                            {expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        : <span className="w-3 shrink-0" />}
                      <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-amber-400' : 'text-sky-500'}`} />
                      <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
                    </div>
                    {expandido && hijos.map((h) => renderNodoUbic(h))}
                  </div>
                )
              }
              // ── Columna izquierda: carga + árbol expandible de ubicaciones ──
              const raicesUbic = ubicaciones
                .filter((u) => !u.codigo_ubicacion_superior)
                .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
              const columnaUbicaciones = (
                <div className="rounded-xl border border-borde bg-fondo-tarjeta p-4 flex flex-col gap-3 min-w-0">
                  <Boton
                    variante="contorno"
                    onClick={iniciarEscaneoDir}
                    disabled={escaneandoDir || ejecutando}
                    className="justify-center"
                  >
                    <FolderPlus size={14} className="mr-1.5" />
                    {escaneandoDir ? 'Escaneando…' : 'Cargar desde directorio'}
                  </Boton>

                  <div className="border-t border-borde pt-1 flex-1 min-h-0">
                    {cargandoUbs ? (
                      <p className="text-xs text-texto-muted text-center py-2">Cargando…</p>
                    ) : raicesUbic.length === 0 ? (
                      <p className="text-xs text-texto-muted text-center py-2 leading-relaxed">
                        Sin ubicaciones.<br />Carga un directorio para empezar.
                      </p>
                    ) : (
                      <div className="flex flex-col max-h-60 overflow-y-auto -mx-2">
                        {raicesUbic.map((u) => renderNodoUbic(u))}
                      </div>
                    )}
                  </div>
                </div>
              )

              return (
                <PipelineConversacional
                  antesDeEmpezar={{
                    mensajeTiempo: null,
                    onEmpezar: ejecutarPipeline,
                    textoBotonEmpezar: 'Cargar Semántica',
                    deshabilitado: false,
                  }}
                  enProceso={{
                    mensaje: mensajeEnProc,
                    lote,
                    etapa: { indiceActivo, total: FASES_NARRATIVAS.length, nombre: nombreEtapa },
                    actual,
                    submensaje: docsNoVectorizables > 0
                      ? `${docsNoVectorizables.toLocaleString()} no vectorizables`
                      : undefined,
                    onDetener: detener,
                  }}
                  ejecutando={ejecutando}
                  slotArribaBotones={(
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-texto-muted">
                        Nivel de carga semántica
                      </label>
                      <div
                        role="radiogroup"
                        aria-label="Nivel de carga semántica"
                        className="inline-flex rounded-lg border border-borde bg-fondo-tarjeta p-1 w-full"
                      >
                        {(['BAJO', 'ALTO'] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={nivelCarga === v}
                            disabled={guardandoNivel || ejecutando}
                            onClick={() => cambiarNivelCarga(v)}
                            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 ${
                              nivelCarga === v
                                ? 'bg-primario text-primario-texto'
                                : 'text-texto-muted hover:text-texto'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-texto-muted leading-snug">
                        {nivelCarga === 'ALTO'
                          ? 'ALTO, más preciso, primera carga más lenta.'
                          : 'BAJO, más rápido, indexación esencial.'}
                      </span>
                    </div>
                  )}
                  columnaIzquierda={columnaUbicaciones}
                  porQueTexto={t('narrativoPorQue')}
                  mensajeError={mensajeError || null}
                />
              )
            })()}

            {/* Timer informativo (los botones ya viven en PipelineNarrativo arriba) */}
            {(ejecutando || todosListos) && (
              <p className="text-center text-xs text-texto-muted">
                {ejecutando ? t('procesando', { tiempo: formatTiempo(tiempoTranscurrido) }) : t('completadoEn', { tiempo: formatTiempo(tiempoTranscurrido) })}
              </p>
            )}
        </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALES
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Modal CRUD ubicación */}
      <Modal abierto={modalUb} alCerrar={() => setModalUb(false)} titulo={editandoUb ? `Editar Ubicación: ${editandoUb.nombre_ubicacion} - ${editandoUb.codigo_ubicacion}` : t('modalUbNuevoTitulo')} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-h-[500px]">
          {editandoUb?.tipo_ubicacion === 'AREA' && (
            <div className="flex border-b border-borde">
              {([
                { key: 'datos', label: t('tabDatos') },
                { key: 'system_prompt', label: t('tabSystemPrompt') },
                { key: 'programacion_insert', label: t('tabProgInsert') },
                { key: 'programacion_update', label: t('tabProgUpdate') },
                { key: 'md', label: t('tabMd') },
              ] as { key: typeof tabModalUb; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setTabModalUb(key)} className={`px-4 py-2 tab-nav${tabModalUb === key ? ' tab-nav-activo' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {tabModalUb === 'datos' && (
            <div className="grid grid-cols-2 gap-4">
              {!editandoUb && (
                <div className="col-span-2">
                  <Input etiqueta={t('etiquetaNombre')} value={formUb.nombre_ubicacion} onChange={(e) => setFormUb({ ...formUb, nombre_ubicacion: e.target.value })} placeholder={t('placeholderNombreUbicacion')} />
                </div>
              )}
              <Input etiqueta={t('etiquetaAlias')} value={formUb.alias_ubicacion} onChange={(e) => setFormUb({ ...formUb, alias_ubicacion: e.target.value })} placeholder={t('placeholderAlias')} />
              {editandoUb && (
                <div>
                  <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaTipo')}</label>
                  <select
                    className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                    value={editandoUb.tipo_ubicacion}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value as 'AREA' | 'CONTENIDO'
                      if (nuevoTipo !== editandoUb.tipo_ubicacion) {
                        setConfirmarTipo({ u: editandoUb, nuevoTipo })
                      }
                    }}
                  >
                    <option value="AREA">AREA</option>
                    <option value="CONTENIDO">CONTENIDO</option>
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <Textarea etiqueta={t('etiquetaDescripcion')} value={formUb.descripcion} onChange={(e) => setFormUb({ ...formUb, descripcion: e.target.value })} placeholder={t('placeholderDescripcionUbicacion')} rows={2} />
              </div>
              {!editandoUb && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaCarpetaPadre')}</label>
                  <select className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none" value={formUb.codigo_ubicacion_superior} onChange={(e) => setFormUb({ ...formUb, codigo_ubicacion_superior: e.target.value })}>
                    <option value="">{t('opcionRaiz')}</option>
                    {/* Estamos en el bloque !editandoUb (modo crear), no hay nada que excluir */}
                    {opcionesPadre().map((u: UbicacionDoc) => <option key={u.codigo_ubicacion} value={u.codigo_ubicacion}>{'  '.repeat(u.nivel)}{u.nombre_ubicacion}</option>)}
                  </select>
                </div>
              )}
              {editandoUb && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={formUb.ubicacion_habilitada} onChange={(e) => setFormUb({ ...formUb, ubicacion_habilitada: e.target.checked })} className="w-4 h-4 rounded border-borde text-primario focus:ring-primario" />
                  <span className="text-sm font-medium text-texto">{t('ubicacionHabilitada')}</span>
                  <span className="text-xs text-texto-muted">{t('ubicacionHabilitadaHint')}</span>
                </label>
              )}
              {editandoUb && <Input etiqueta={t('etiquetaCodigo')} value={formUb.codigo_ubicacion} disabled readOnly />}
            </div>
          )}
          {tabModalUb === 'system_prompt' && editandoUb?.tipo_ubicacion === 'AREA' && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editandoUb.codigo_ubicacion}
              campos={formUb}
              onCampoCambiado={(campo, valor) => setFormUb((prev) => ({ ...prev, [campo]: valor }))}
              mostrarSystemPrompt={true}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}
          {tabModalUb === 'programacion_insert' && editandoUb?.tipo_ubicacion === 'AREA' && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editandoUb.codigo_ubicacion}
              campos={formUb}
              onCampoCambiado={(campo, valor) => setFormUb((prev) => ({ ...prev, [campo]: valor }))}
              mostrarSystemPrompt={false}
              mostrarPromptInsert={true}
              mostrarPromptUpdate={false}
              mostrarPythonInsert={true}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}
          {tabModalUb === 'programacion_update' && editandoUb?.tipo_ubicacion === 'AREA' && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editandoUb.codigo_ubicacion}
              campos={formUb}
              onCampoCambiado={(campo, valor) => setFormUb((prev) => ({ ...prev, [campo]: valor }))}
              mostrarSystemPrompt={false}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={true}
              mostrarJavaScript={true}
            />
          )}
          {tabModalUb === 'md' && editandoUb && (
            <div className="flex flex-col gap-3">
              <textarea
                readOnly
                rows={13}
                value={mdUb}
                className="w-full text-sm font-mono rounded-lg border border-borde px-3 py-2 bg-fondo text-texto resize-none focus:outline-none"
                placeholder={t('mdSinContenido')}
              />
              {mensajeMdUb && (
                <p className="text-xs text-texto-muted">{mensajeMdUb}</p>
              )}
              <div className="flex gap-2">
                <Boton
                  variante="secundario"
                  cargando={generandoMdUb}
                  onClick={async () => {
                    setGenerandoMdUb(true)
                    setMensajeMdUb(null)
                    try {
                      const res = await ubicacionesDocsApi.generarMd(editandoUb.codigo_ubicacion)
                      setMdUb((res as unknown as Record<string, unknown>).md as string || '')
                      setMensajeMdUb(t('mdGeneradoOk'))
                    } catch {
                      setMensajeMdUb(t('mdErrorGenerar'))
                    } finally {
                      setGenerandoMdUb(false)
                    }
                  }}
                >
                  {t('btnGenerar')}
                </Boton>
                <Boton
                  variante="secundario"
                  cargando={sincronizandoMdUb}
                  onClick={async () => {
                    setSincronizandoMdUb(true)
                    setMensajeMdUb(null)
                    try {
                      await promptsApi.sincronizarFila('ubicaciones_docs', 'codigo_ubicacion', editandoUb.codigo_ubicacion)
                      setMensajeMdUb(t('mdSincronizadoOk'))
                    } catch {
                      setMensajeMdUb(t('mdErrorSincronizar'))
                    } finally {
                      setSincronizandoMdUb(false)
                    }
                  }}
                >
                  {t('btnSincronizar')}
                </Boton>
              </div>
            </div>
          )}
          {errorUb && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorUb}</p></div>}
          {tabModalUb !== 'md' && (
            <PieBotonesModal
              editando={!!editandoUb}
              onGuardar={() => guardarUb(false)}
              onGuardarYSalir={() => guardarUb(true)}
              onCerrar={() => setModalUb(false)}
              cargando={guardandoUb}
              botonesIzquierda={(tabModalUb === 'system_prompt' || tabModalUb === 'programacion_insert' || tabModalUb === 'programacion_update') && editandoUb ? (
                <PieBotonesPrompts
                  tabla="ubicaciones_docs"
                  pkColumna="codigo_ubicacion"
                  pkValor={editandoUb.codigo_ubicacion}
                  promptInsert={formUb.prompt_insert || undefined}
                  promptUpdate={formUb.prompt_update || undefined}
                />
              ) : undefined}
            />
          )}
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <ModalConfirmar
        abierto={!!confirmElim} alCerrar={() => { setConfirmElim(null); setPreviewElim(null) }} alConfirmar={ejecutarEliminar}
        titulo={t('eliminarUbicacionTitulo')}
        mensaje={confirmElim ? (previewElim ? t('eliminarUbicacionMensaje', { ubicaciones: previewElim.ubicaciones, documentos: previewElim.documentos_a_eliminar }) : t('calculandoImpacto', { nombre: confirmElim.nombre_ubicacion })) : ''}
        textoConfirmar={tc('eliminar')} cargando={eliminandoUb || !previewElim}
      />

      {/* Modal confirmar cambio de tipo */}
      <ModalConfirmar
        abierto={!!confirmarTipo} alCerrar={() => setConfirmarTipo(null)} alConfirmar={ejecutarCambioTipo}
        titulo={t('cambiarTipoTitulo')}
        mensaje={confirmarTipo ? t('cambiarTipoMensaje', { nombre: confirmarTipo.u.nombre_ubicacion, tipo: confirmarTipo.nuevoTipo }) : ''}
        textoConfirmar={t('btnCambiar')} cargando={cambiandoTipo}
      />

      {/* Modal carga desde directorio */}
      <Modal abierto={modalCarga} alCerrar={cerrarModalCarga} titulo={t('cargarDesdeDirectorioTitulo')}>
        <div className="flex flex-col gap-4 min-w-[480px]">
          {!resultadoSync && datosEscaneo && (
            <>
              <div className="bg-fondo rounded-lg p-4 flex items-center gap-3">
                <FolderOpen size={22} className="text-primario shrink-0" />
                <div><p className="font-medium text-texto">{datosEscaneo.nombreRaiz}</p><p className="text-sm text-texto-muted">{t('directoriosEncontrados', { n: datosEscaneo.directorios.length })}</p></div>
              </div>
              {diff && (
                <div className={`grid ${diff.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-green-600">{diff.nuevas}</p><p className="text-xs text-texto-muted">{t('nuevas')}</p></div>
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-red-600">{diff.aEliminar}</p><p className="text-xs text-texto-muted">{t('aEliminar')}</p></div>
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-texto-muted">{diff.sinCambio}</p><p className="text-xs text-texto-muted">{t('sinCambio')}</p></div>
                  {diff.excluidas > 0 && <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center"><p className="stat-number text-amber-600">{diff.excluidas}</p><p className="text-xs text-amber-700">{t('excluidasLabel')}</p></div>}
                </div>
              )}
              <div className="border border-borde rounded-lg max-h-[260px] overflow-y-auto">
                <div className="py-1">
                  {(() => {
                    const { filtrados } = filtrarPorInhabilitadas(datosEscaneo.directorios)
                    const codsFilt = new Set(filtrados.map((d) => d.codigo_ubicacion))
                    return datosEscaneo.directorios.slice(0, 30).map((d) => {
                      const esNueva = !ubicaciones.some((u) => u.codigo_ubicacion === d.codigo_ubicacion)
                      const esExcluida = !codsFilt.has(d.codigo_ubicacion)
                      return (
                        <div key={d.codigo_ubicacion} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${esExcluida ? 'opacity-40' : ''}`} style={{ paddingLeft: `${d.nivel * 18 + 12}px` }}>
                          <Folder size={13} className="text-texto-muted shrink-0" />
                          <span className={esExcluida ? 'text-texto-muted line-through' : esNueva ? 'text-green-700 font-medium' : 'text-texto'}>{d.nombre_ubicacion}</span>
                          {!esExcluida && esNueva && <Insignia variante="exito">{t('insigniaNueva')}</Insignia>}
                          {esExcluida && <Insignia variante="advertencia">{t('insigniaExcluida')}</Insignia>}
                        </div>
                      )
                    })
                  })()}
                  {datosEscaneo.directorios.length > 30 && <p className="px-4 py-2 text-xs text-texto-muted text-center">{t('yMas', { n: datosEscaneo.directorios.length - 30 })}</p>}
                </div>
              </div>
              {diff && diff.aEliminar > 0 && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{t('avisoEliminacion', { n: diff.aEliminar })}</div>}
              <div className="flex gap-3 justify-end pt-1">
                <Boton variante="contorno" onClick={cerrarModalCarga}>{tc('cancelar')}</Boton>
                <Boton variante="primario" onClick={ejecutarSincronizacion} cargando={sincronizando}><RefreshCw size={14} />{t('btnSincronizar')}</Boton>
              </div>
            </>
          )}
          {resultadoSync && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center"><p className="text-lg font-medium text-green-800">{t('sincronizacionCompletada')}</p></div>
              <div className={`grid ${resultadoSync.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-green-600">{resultadoSync.insertadas}</p><p className="text-xs text-texto-muted">{t('insertadas')}</p></div>
                <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-red-600">{resultadoSync.eliminadas}</p><p className="text-xs text-texto-muted">{t('eliminadasLabel')}</p></div>
                <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-primario">{resultadoSync.actualizadas}</p><p className="text-xs text-texto-muted">{t('actualizadas')}</p></div>
                {resultadoSync.excluidas > 0 && <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center"><p className="stat-number text-amber-600">{resultadoSync.excluidas}</p><p className="text-xs text-amber-700">{t('excluidasLabel')}</p></div>}
              </div>
              <div className="flex justify-end pt-1"><Boton variante="primario" onClick={cerrarModalCarga}>{tc('salir')}</Boton></div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal reanudación: items EN_PROCESO huérfanos de sesión previa */}
      <ModalConfirmar
        abierto={mostrarModalReanudacion}
        alCerrar={() => setMostrarModalReanudacion(false)}
        alConfirmar={confirmarReanudacion}
        titulo="Reanudar procesamiento"
        mensaje={`Hay ${huerfanosCount} documento${huerfanosCount === 1 ? '' : 's'} colgado${huerfanosCount === 1 ? '' : 's'} de la última sesión (más de ${HUERFANOS_MINUTOS} min en proceso). ¿Reanudar el procesamiento ahora?`}
        textoConfirmar="Reanudar"
        textoCancelar="Dejar pausados"
        variante="primario"
        cargando={reanudando}
      />
    </div>
  )
}
