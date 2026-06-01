'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  FolderOpen, Folder, FolderPlus, FolderSync,
  CheckCircle, AlertTriangle, RefreshCw, Upload, Download,
  ChevronRight, ChevronDown, ToggleLeft, ToggleRight, Shuffle, Plus, Pencil, Trash2, X,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { ModalError } from '@/components/ui/modal-error'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { documentosApi, colaEstadosDocsApi, ubicacionesDocsApi, promptsApi, procesosApi, parametrosApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import { getDirectoryHandle, setDirectoryHandle } from '@/lib/file-handle-store'
import {
  escanearDirectorio,
  soportaDirectoryPicker, type DirectorioEscaneado,
  contarArchivosVacios,
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
import { formatearMinutos } from '@/lib/pipeline-narrativo'
import { useFasesNarrativas } from '@/hooks/useFasesNarrativas'
import {
  esperarClientLM,
  elegirCarpetaLocal,
  ingestarLocal,
  ejecutarLocal,
  statusLocal,
} from '@/lib/client-lm'

// ── Pipeline (v2) ─────────────────────────────────────────────────────────────
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
  const fasesNarrativas = useFasesNarrativas()
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
  const [resultadoSync, setResultadoSync] = useState<{ insertadas: number; deshabilitadas: number; actualizadas: number; total: number; excluidas: number } | null>(null)
  // Barra de progreso inline para sincronización (sin modal)
  type SyncEstado = 'idle' | 'escaneando' | 'sincronizando' | 'listo' | 'error'
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('idle')
  const [syncMensaje, setSyncMensaje] = useState('')

  // Modal estándar de error (reemplaza window.alert en los flujos de sincronización)
  const [errorModal, setErrorModal] = useState<{ titulo: string; mensaje: string; detalle?: string } | null>(null)
  const mostrarError = useCallback((titulo: string, e: unknown) => {
    console.error(`[process-pipeline] ${titulo}:`, e)
    const mensaje = e instanceof Error ? e.message : (typeof e === 'string' ? e : t('alertErrorSincronizar'))
    const detalle = e instanceof Error && e.stack ? e.stack : undefined
    setErrorModal({ titulo, mensaje, detalle })
  }, [t])

  const cargarUbicaciones = useCallback(async () => {
    setCargandoUbs(true)
    try { setUbicaciones(await ubicacionesDocsApi.listar()) }
    catch { /* el estado vacío se renderiza igual */ }
    finally { setCargandoUbs(false) }
  }, [])

  // Espera a que el usuario esté hidratado (userId) para evitar la primera
  // llamada sin JWT, que vuelve sin datos y deja la UI vacía hasta que el
  // usuario refresca. También re-carga si cambia el grupo activo.
  useEffect(() => {
    if (!userId) return
    cargarUbicaciones()
  }, [cargarUbicaciones, userId, grupoActivo])

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

  // Set de claves "${padre ?? ''}/${codigo}" para ubicaciones inhabilitadas
  // en BD del grupo/entidad actual. El escaneo omite estas carpetas (y sus
  // hijos) — evita generar códigos duplicados y reparenteos a nodos que
  // nunca se van a insertar.
  const clavesDeshabilitadasBD = useCallback((): Set<string> => {
    // Paths (url) de ubicaciones inhabilitadas en BD. El escáner los usa para
    // omitir las carpetas físicas correspondientes (y sus hijos) durante la
    // recursión.
    const s = new Set<string>()
    for (const u of ubicaciones) {
      if (!u.ubicacion_habilitada && u.url) {
        s.add(u.url)
      }
    }
    return s
  }, [ubicaciones])

  // Carga desde directorio
  const iniciarEscaneoDir = async () => {
    if (!soportaDirectoryPicker()) { mostrarError(t('alertNavegadorNoSoporta'), new Error(t('alertNavegadorNoSoporta'))); return }
    setEscaneandoDir(true); setResultadoSync(null)
    try {
      const r = await escanearDirectorio(null, clavesDeshabilitadasBD())
      if (!r) { setEscaneandoDir(false); return }
      setDirHandleState(r.dirHandle); await setDirectoryHandle(r.dirHandle, userId, grupoActivo)
      setDatosEscaneo(r); setModalCarga(true)
    } catch (e) { mostrarError(t('alertErrorEscaneo'), e) }
    finally { setEscaneandoDir(false) }
  }
  const ejecutarSincronizacion = async () => {
    if (!datosEscaneo) return
    setSincronizando(true)
    try {
      // Pasar codigo_ubicacion_raiz para que el backend deshabilite las
      // ubicaciones del subárbol que ya no aparecen en el escaneo.
      const raiz = datosEscaneo.directorios.find((d) => d.nivel === 0)
      const res = await ubicacionesDocsApi.sincronizar({
        directorios: datosEscaneo.directorios,
        ruta_completa_raiz: raiz?.ruta_completa,
      })
      setResultadoSync(res); cargarUbicaciones()
      setEtapa1Estado('completado')
    } catch (e) {
      // El interceptor axios (src/lib/api.ts) ya entrega Error con mensaje rico:
      // mensaje_usuario + sugerencia + referencia, o detail FastAPI, o explicación PG.
      mostrarError(t('alertErrorSincronizar'), e)
    } finally { setSincronizando(false) }
  }
  const cerrarModalCarga = () => { setModalCarga(false); setDatosEscaneo(null); setResultadoSync(null) }

  // Escaneo + sincronización inline (sin modal, con barra de progreso)
  const sincronizarDirectamente = async () => {
    if (!soportaDirectoryPicker()) { mostrarError(t('alertNavegadorNoSoporta'), new Error(t('alertNavegadorNoSoporta'))); return }
    setSyncEstado('escaneando'); setSyncMensaje('')
    try {
      const r = await escanearDirectorio(null, clavesDeshabilitadasBD())
      if (!r) { setSyncEstado('idle'); return }
      setDirHandleState(r.dirHandle); await setDirectoryHandle(r.dirHandle, userId, grupoActivo)
      setSyncEstado('sincronizando')
      const raiz = r.directorios.find((d) => d.nivel === 0)
      const res = await ubicacionesDocsApi.sincronizar({
        directorios: r.directorios,
        ruta_completa_raiz: raiz?.ruta_completa,
      })
      setSyncMensaje(t('sincronizacionDetalleDeshabilitadas', { insertadas: res.insertadas, actualizadas: res.actualizadas, deshabilitadas: res.deshabilitadas }))
      setSyncEstado('listo')
      setEtapa1Estado('completado')
      cargarUbicaciones()
    } catch (e) {
      console.error('[process-pipeline] sincronizarDirectamente:', e)
      setSyncEstado('error')
      const msg = e instanceof Error ? e.message : t('alertErrorSincronizar')
      setSyncMensaje(msg)
      mostrarError(t('alertErrorSincronizar'), e)
    }
  }

  // Preview diferencias — el escaneo no genera codigo_ubicacion (lo autogenera
  // el backend), así que el cruce con BD se hace por path: ruta_completa del
  // escaneo vs url de la ubicación en BD.
  const filtrarPorInhabilitadas = (dirs: DirectorioEscaneado[]) => {
    const urlsInhab = new Set(
      ubicaciones.filter((u) => !u.ubicacion_habilitada && u.url).map((u) => u.url as string)
    )
    if (!urlsInhab.size) return { filtrados: dirs, excluidos: 0 }
    const padres: Record<string, string | null | undefined> = {}
    for (const d of dirs) padres[d.ruta_completa] = d.ruta_completa_superior
    const esDescInhab = (ruta: string): boolean => {
      const vis = new Set<string>()
      let actual: string | null | undefined = padres[ruta]
      while (actual) {
        if (urlsInhab.has(actual)) return true
        if (vis.has(actual)) break
        vis.add(actual)
        actual = padres[actual]
      }
      return false
    }
    const filtrados = dirs.filter((d) => !esDescInhab(d.ruta_completa))
    return { filtrados, excluidos: dirs.length - filtrados.length }
  }
  const calcularDiff = () => {
    if (!datosEscaneo) return { nuevas: 0, aDeshabilitar: 0, sinCambio: 0, excluidas: 0 }
    const { filtrados, excluidos } = filtrarPorInhabilitadas(datosEscaneo.directorios)
    const urlsBd = new Set(ubicaciones.map((u) => u.url).filter((u): u is string => !!u))
    const rutasEscan = new Set(filtrados.map((d) => d.ruta_completa))
    // "A deshabilitar" = ubicaciones que están en BD habilitadas y NO aparecen en el escaneo.
    // El backend marcará ubicacion_habilitada=false; nunca borra datos.
    const aDeshabilitar = ubicaciones.filter(
      (u) => u.ubicacion_habilitada && u.url && !rutasEscan.has(u.url)
    ).length
    return {
      nuevas: filtrados.filter((d) => !urlsBd.has(d.ruta_completa)).length,
      aDeshabilitar,
      sinCambio: filtrados.filter((d) => urlsBd.has(d.ruta_completa)).length,
      excluidas: excluidos,
    }
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
    const rowBg = esArea ? 'bg-blue-50 hover:bg-blue-100' : 'bg-amber-50 hover:bg-amber-100'
    const folderColor = esArea ? 'text-blue-500' : 'text-amber-500'
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
          <Insignia variante={u.tipo_ubicacion === 'AREA' ? 'primario' : 'advertencia'}>{u.tipo_ubicacion}</Insignia>
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
  // True cuando la última corrida terminó sin documentos nuevos que procesar
  // (todo ya estaba vectorizado/no procesable). Se usa para informar en el
  // bloque "Ahora mismo" que está todo al día. Se resetea al iniciar cada corrida.
  const [sinDocsNuevos, setSinDocsNuevos] = useState(false)
  // Marca si la corrida actual avanzó algún documento real (algún paso accionable
  // —distinto de CARGAR, que siempre reporta total=1— recibió docs a procesar).
  const huboTrabajoRef = useRef(false)
  // Modo local (Client LM): pipeline 100% local contra el FastAPI 127.0.0.1.
  const [modoLocal, setModoLocal] = useState(false)
  const modoLocalRef = useRef(false)
  const [carpetaLocal, setCarpetaLocal] = useState('')
  const [dirHandle, _setDirHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const setDirHandleState = (h: FileSystemDirectoryHandle | null) => {
    dirHandleRef.current = h
    _setDirHandleState(h)
  }
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [mensajeError, setMensajeError] = useState('')
  const [mensajeAdvertencia, setMensajeAdvertencia] = useState('')
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

  const cargarConteosLocal = useCallback(async () => {
    try {
      const s = await statusLocal()
      const docs = s.docs_por_estado ?? {}
      const pendientes = ESTADOS_PENDIENTES.reduce((acc, e) => acc + (docs[e] ?? 0), 0)
      setTotalDocs(s.total_docs ?? 0)
      setDocsVectorizados(s.vectorizados ?? 0)
      setDocsPendientes(pendientes)
      setDocsNoVectorizables(s.no_procesables ?? 0)
    } catch { /* ignorar */ }
  }, [])

  const cargarConteos = useCallback(async () => {
    if (modoLocalRef.current) { await cargarConteosLocal(); return }
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
  }, [cargarConteosLocal])

  // Detecta presencia del Client LM una sola vez al montar (puente async).
  useEffect(() => {
    let cancelado = false
    esperarClientLM().then((ok) => {
      if (cancelado || !ok) return
      modoLocalRef.current = true
      setModoLocal(true)
      cargarConteosLocal()
    })
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getDirectoryHandle(userId, grupoActivo).then((h) => { if (h) { dirHandleRef.current = h; setDirHandleState(h) } })
    // Solo dispara la carga de conteos cuando el usuario ya está hidratado;
    // de otro modo la primera llamada puede salir sin JWT y devolver 0.
    if (userId) cargarConteos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo, userId])

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

  const setPaso = (key: string, patch: Partial<ProgresoPaso>) => {
    // Si un paso accionable (no CARGAR) reporta documentos a procesar, hubo trabajo
    // real en la corrida → no se mostrará "no hay nuevos documentos".
    if (key !== 'CARGAR' && typeof patch.total === 'number' && patch.total > 0) {
      huboTrabajoRef.current = true
    }
    setProgresos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

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
      await ejecutarCargaLib(pending, (completados, total) =>
        setPaso('CARGAR', { completados, total: total || totalArchivos }))
      setPaso('CARGAR', { total: totalArchivos, completados: totalArchivos, estado: 'listo' })
      const vacios = contarArchivosVacios(pending.archivosParaCargar)
      if (vacios > 0) {
        setMensajeAdvertencia(t('advertenciaArchivosVacios', { n: vacios }))
      }
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
  // Pipeline 100% LOCAL (Client LM): elegir carpeta nativa → ingestar → procesar
  // → poll del estado local. El contenido y los embeddings nunca suben al servidor.
  const ejecutarPipelineLocal = async () => {
    setMensajeError(''); setMensajeAdvertencia(''); setSinDocsNuevos(false); abortRef.current = false; setEjecutando(true)
    setTiempoInicio(Date.now()); setTiempoTranscurrido(0)
    setProgresos(progresosIniciales()); setArchivoActualLocal(null)
    try {
      let dir = carpetaLocal
      if (!dir) {
        dir = await elegirCarpetaLocal()
        if (!dir) { setEjecutando(false); return }
        setCarpetaLocal(dir)
      }
      await ingestarLocal(dir)
      await ejecutarLocal()
      let estable = 0
      for (;;) {
        if (abortRef.current) break
        await new Promise((r) => setTimeout(r, 1500))
        const s = await statusLocal()
        const docs = s.docs_por_estado ?? {}
        const pendientesDoc = ESTADOS_PENDIENTES.reduce((acc, e) => acc + (docs[e] ?? 0), 0)
        setTotalDocs(s.total_docs ?? 0)
        setDocsVectorizados(s.vectorizados ?? 0)
        setDocsPendientes(pendientesDoc)
        setDocsNoVectorizables(s.no_procesables ?? 0)
        const restantes = (s.tareas_pendientes ?? 0) + (s.en_proceso ?? 0)
        if (restantes === 0) { if (++estable >= 2) break } else { estable = 0 }
      }
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : t('errorInesperado'))
    } finally {
      setEjecutando(false); await cargarConteosLocal()
    }
  }

  // Estados de documento que cuentan como "pendiente" (el pipeline aún debe avanzarlos).
  const ESTADOS_PIPELINE_INTERMEDIOS = ['CARGADO', 'METADATA', 'ESCANEADO', 'CHUNKEADO']
  // Ciclos consecutivos sin avance antes de apartar un doc a REVISAR.
  const MAX_CICLOS_SIN_AVANCE = 5
  // Techo global de seguridad por corrida (mucho menor que el viejo 200).
  const MAX_ITERACIONES = 30

  // Loop de paquetes compartido por ejecutarPipeline y ejecutarPipelineUbicaciones.
  // Corre una ventana, limpia COMPLETADOs y refresca contadores. Si los MISMOS
  // documentos siguen en estados intermedios sin avanzar durante MAX_CICLOS_SIN_AVANCE
  // ciclos, los aparta a REVISAR (nombrándolos en pantalla) y continúa con el resto,
  // evitando el loop infinito que provocaba un doc que nunca completa.
  const correrLoopPaquetes = async (tamanoPaquete: number) => {
    let iteraciones = 0
    let ciclosSinAvance = 0
    // Firma del conjunto pendiente del ciclo anterior, para detectar estancamiento.
    let firmaAnterior = ''
    const yaRevisar = new Set<string>()

    while (!abortRef.current && iteraciones < MAX_ITERACIONES) {
      iteraciones += 1

      // Procesar UNA ventana.
      const ok = await ejecutarFasesDelPipeline(tamanoPaquete)
      if (!ok) break

      // Cierre del paquete: limpia COMPLETADOs para acotar la cola.
      try { await colaEstadosDocsApi.limpiarCompletados() } catch { /* no bloquear si falla */ }

      // Refrescar contadores para que la BarraPaqueteOperativo avance.
      await cargarConteos()
      try {
        const resumen2 = await colaEstadosDocsApi.resumenPipeline(120)
        setResumenPipeline(resumen2)
      } catch { /* ignorar */ }

      // ¿Quedan pendientes? Listar los docs en estados intermedios para conocer
      // su identidad (no solo el total) y poder detectar estancamiento y nombrarlos.
      let docsPendientes: { codigo_documento: string; nombre_documento?: string | null; codigo_estado_doc?: string | null }[] = []
      try {
        const listas = await Promise.all(
          ESTADOS_PIPELINE_INTERMEDIOS.map((e) =>
            documentosApi.listar({ codigo_estado_doc: e, limit: 500 }).catch(() => [] as never[])
          )
        )
        docsPendientes = listas.flat().filter((d) => !yaRevisar.has(d.codigo_documento))
      } catch { break }

      if (docsPendientes.length <= 0) break

      // Firma = conjunto ordenado de (codigo:estado). Si no cambia entre ciclos,
      // ningún doc avanzó.
      const firmaActual = docsPendientes
        .map((d) => `${d.codigo_documento}:${d.codigo_estado_doc ?? ''}`)
        .sort()
        .join('|')

      if (firmaActual === firmaAnterior) {
        ciclosSinAvance += 1
      } else {
        ciclosSinAvance = 0
        firmaAnterior = firmaActual
      }

      if (ciclosSinAvance >= MAX_CICLOS_SIN_AVANCE) {
        // Apartar los atascados a REVISAR y seguir.
        const codigos = docsPendientes.map((d) => d.codigo_documento)
        const nombres = docsPendientes
          .map((d) => d.nombre_documento || d.codigo_documento)
          .slice(0, 5)
        try {
          await documentosApi.marcarRevisar(
            codigos,
            'El pipeline no logró avanzar este documento tras varios intentos.',
          )
        } catch { /* si falla el marcado, igual cortamos para no quedar en loop */ }
        codigos.forEach((c) => yaRevisar.add(c))
        const extra = docsPendientes.length > nombres.length
          ? t('revisarYMasDocs', { n: docsPendientes.length - nombres.length }) || ` y ${docsPendientes.length - nombres.length} más`
          : ''
        setMensajeAdvertencia(
          (t('avisoDocsARevisar', { docs: nombres.join(', '), extra }) ||
            `Se apartaron a "Revisar" ${docsPendientes.length} documento(s) que no avanzaron: ${nombres.join(', ')}${extra}. El pipeline continuó con el resto.`),
        )
        // Refrescar y reiniciar el detector; el resto puede seguir.
        await cargarConteos()
        firmaAnterior = ''
        ciclosSinAvance = 0
        continue
      }
    }
  }

  const ejecutarPipeline = async () => {
    if (modoLocalRef.current) { await ejecutarPipelineLocal(); return }
    setMensajeError(''); setMensajeAdvertencia(''); setSinDocsNuevos(false); huboTrabajoRef.current = false; abortRef.current = false; setEjecutando(true); setTiempoInicio(Date.now()); setTiempoTranscurrido(0); setProgresos(progresosIniciales()); setArchivoActualLocal(null); suscribirCola()
    let huboError = false
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
        // Loop de paquetes: corre fases con tope = TAMANO_PAQUETE, limpia, repite.
        // Si el conteo de pendientes NO baja en varios ciclos, hay docs atascados:
        // se apartan a REVISAR (nombrándolos) y el pipeline sigue con el resto.
        await correrLoopPaquetes(tamanoPaquete)
      }
    } catch (e) { huboError = true; setMensajeError(e instanceof Error ? e.message : t('errorInesperado')) }
    finally {
      desuscribirCola(); setEjecutando(false); await cargarConteos()
      // Si la corrida completó sin abortar ni error y no avanzó ningún documento,
      // todo estaba ya al día → informar "no hay nuevos documentos a procesar".
      if (!abortRef.current && !huboError) setSinDocsNuevos(!huboTrabajoRef.current)
    }
  }

  // Pipeline completo desde la tab Ubicaciones.
  // - Si ya hay ubicaciones en BD → salta el Paso 1 (no abre el finder) y va directo al pipeline.
  // - Si no hay ubicaciones → abre el finder para crearlas primero.
  const ejecutarPipelineUbicaciones = async () => {
    if (modoLocalRef.current) { await ejecutarPipelineLocal(); return }
    setMensajeError(''); setMensajeAdvertencia(''); setSinDocsNuevos(false); huboTrabajoRef.current = false; abortRef.current = false; setEjecutando(true); setTiempoInicio(Date.now()); setTiempoTranscurrido(0); setProgresos(progresosIniciales()); setArchivoActualLocal(null); suscribirCola()
    let huboError = false
    try {
      // Paso 1: indexar ubicaciones — solo si no hay ubicaciones en BD
      if (ubicaciones.length === 0) {
        if (!soportaDirectoryPicker()) { huboError = true; setMensajeError(t('alertNavegadorNoSoporta') || 'Navegador no soporta File System Access API'); return }
        setPaso(PASO_INDEXAR, { total: 1, completados: 0, estado: 'activo' })
        try {
          const r = await escanearDirectorio(null, clavesDeshabilitadasBD())
          if (!r) { huboError = true; setPaso(PASO_INDEXAR, { estado: 'listo' }) /* usuario canceló */; return }
          setDirHandleState(r.dirHandle); await setDirectoryHandle(r.dirHandle, userId, grupoActivo)
          const raiz = r.directorios.find((d) => d.nivel === 0)
          const res = await ubicacionesDocsApi.sincronizar({
            directorios: r.directorios,
            ruta_completa_raiz: raiz?.ruta_completa,
          })
          setSyncMensaje(t('sincronizacionDetalleDeshabilitadas', { insertadas: res.insertadas, actualizadas: res.actualizadas, deshabilitadas: res.deshabilitadas }))
          setPaso(PASO_INDEXAR, { total: 1, completados: 1, estado: 'listo' })
          setEtapa1Estado('completado')
          await cargarUbicaciones()
        } catch (e) {
          huboError = true
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
        await correrLoopPaquetes(tamanoPaquete)
      }
    } catch (e) { huboError = true; setMensajeError(e instanceof Error ? e.message : t('errorInesperado')) }
    finally {
      desuscribirCola(); setEjecutando(false); await cargarConteos()
      if (!abortRef.current && !huboError) setSinDocsNuevos(!huboTrabajoRef.current)
    }
  }

  const [deteniendo, setDeteniendo] = useState(false)
  const detener = async () => {
    abortRef.current = true
    if (resolveColaRef.current) { resolveColaRef.current(); resolveColaRef.current = null }
    setDeteniendo(true)
    try {
      // minutos=0 libera TODOS los EN_PROCESO del grupo (no solo los con lease vencido).
      // Si el usuario presionó Detener, debemos abortar también los leases vivos del
      // backend, no solo el loop del frontend. Sin esto, los items quedarían EN_PROCESO
      // hasta que venza el lease (5 min) y el pipeline "no se detiene de verdad".
      await colaEstadosDocsApi.recuperarHuerfanos(0)
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : t('errorInesperado'))
    } finally {
      setDeteniendo(false)
      setEjecutando(false)
      await cargarConteos()
    }
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
      { estado: 'CARGADO',     color: '#0EA5E9', label: t('estadoCargado')     },
      { estado: 'METADATA',    color: '#074B91', label: t('estadoMetadata')    },
      { estado: 'ESCANEADO',   color: '#F97316', label: t('estadoEscaneado')   },
      { estado: 'CHUNKEADO',   color: '#84CC16', label: t('estadoChunkeado')   },
      { estado: 'VECTORIZADO', color: '#22C55E', label: t('estadoVectorizado') },
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
          <span className="font-semibold text-texto" data-testid="paquete-actual-total">
            {t('paqueteActualDeTotal', { actual: paq.paquete_actual, total: paq.paquetes_totales })}
          </span>
          <span className="tabular-nums text-texto-muted" data-testid="paquete-docs-lote">
            {t('paqueteDocsLote', {
              completados: paq.docs_completados.toLocaleString(),
              total: paq.docs_totales.toLocaleString(),
              tamano: paq.tamano_paquete.toLocaleString(),
            })}
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
              <span className="text-amber-700" title={t('tooltipEnProceso')}>
                ▶ {fase.en_proceso}
                {fase.workers_activos > 0 && <span className="text-texto-muted"> ({fase.workers_activos}w)</span>}
              </span>
            )}
            {fase.pendiente > 0 && (
              <span className="text-texto-muted" title={t('tooltipEsperando')}>⧗ {fase.pendiente}</span>
            )}
            {fase.completado > 0 && (
              <span className="text-green-700" title={t('tooltipCompletados')}>✓ {fase.completado}</span>
            )}
            {fase.error > 0 && (
              <span className="text-red-600" title={t('tooltipErrores')}>✕ {fase.error}</span>
            )}
            {fase.velocidad_docs_por_min > 0 && (
              <span className="text-texto-muted" title={t('tooltipVelocidadReciente')}>
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

  // Mensaje "X de Y documentos" — se muestra bajo el dial, debajo de "Procesando…".
  // La estimación "Quedan unos…" va en su propia línea (debajo), centrada.
  const minEtaPipeline = etaInfo?.minutosEta ?? null
  const mensajeEnProc = t('mensajeXdeYDocumentos', {
    vectorizados: docsVectorizados.toLocaleString(),
    total: totalDocs.toLocaleString(),
  })
  const mensajeEtaPipeline = minEtaPipeline != null
    ? t('mensajeQuedanUnos', { tiempo: formatearMinutos(minEtaPipeline).replace('~', '') })
    : null

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
          Banner de alerta LLM (spending cap, quota agotada, api key inválida).
          Solo aparece cuando el provider está rechazando llamadas y reintentar
          no resuelve nada — pide al admin actuar (subir cap, rotar key, etc.).
          La alerta se lee desde resumen-pipeline.alerta_llm y se marca como
          resuelta cuando el admin pulsa el botón.
      ══════════════════════════════════════════════════════════════════════ */}
      {resumenPipeline?.alerta_llm && (
        <div
          data-testid="banner-alerta-llm"
          data-categoria={resumenPipeline.alerta_llm.categoria}
          className="mb-3 rounded-lg border-2 border-red-500 bg-red-50 p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none" aria-hidden>⛔</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-red-900 text-base">
                {t('alertaLLM.titulo')}
              </h3>
              <p className="mt-1 text-sm text-red-900">
                <span className="font-semibold">{resumenPipeline.alerta_llm.proveedor}</span>
                {' · '}
                <span className="font-mono text-xs">{resumenPipeline.alerta_llm.modelo}</span>
                {' · '}
                <span>{t(`alertaLLM.categoria.${resumenPipeline.alerta_llm.categoria}`)}</span>
              </p>
              <p className="mt-2 text-sm text-red-800 break-words">
                {resumenPipeline.alerta_llm.mensaje}
              </p>
              {resumenPipeline.alerta_llm.sugerencia && (
                <p className="mt-2 text-sm text-red-900 font-medium">
                  💡 {resumenPipeline.alerta_llm.sugerencia}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                {resumenPipeline.alerta_llm.url_ayuda && (
                  <a
                    href={resumenPipeline.alerta_llm.url_ayuda}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
                  >
                    {t('alertaLLM.botonAbrirConsola')} ↗
                  </a>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!resumenPipeline?.alerta_llm) return
                    try {
                      await colaEstadosDocsApi.resolverAlertaLLM(
                        resumenPipeline.alerta_llm.proveedor,
                        resumenPipeline.alerta_llm.modelo,
                        resumenPipeline.alerta_llm.categoria,
                      )
                      const r = await colaEstadosDocsApi.resumenPipeline(120)
                      setResumenPipeline(r)
                    } catch { /* ignorar */ }
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-600 text-red-700 text-sm font-medium rounded hover:bg-red-50"
                >
                  {t('alertaLLM.botonMarcarResuelto')}
                </button>
                <span className="text-xs text-red-700">
                  {t('alertaLLM.apariciones', { n: resumenPipeline.alerta_llm.total_apariciones })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Contenido: Documentos
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">
            {/* Pipeline Conversacional — estilo C (dial triple + mensaje del asistente) */}
            {(() => {
              const idxActivo = PASOS.findIndex(p => progresos[p.key]?.estado === 'activo')
              const idxFase = idxActivo >= 0
                ? fasesNarrativas.findIndex(f => f.estadoDestino === PASOS[idxActivo].estadoDestino)
                : -1
              const indiceActivo = idxFase >= 0 ? idxFase : 0
              const nombreEtapa = idxFase >= 0 ? fasesNarrativas[idxFase].etiquetaCorta : t('narrativoFaseCargando')

              const paq = resumenPipeline?.paquete
              const lote = paq && paq.paquetes_totales > 0
                ? { actual: paq.paquete_actual, total: paq.paquetes_totales }
                : { actual: 1, total: 1 }
              const tamanoPaq = paq?.tamano_paquete ?? 0

              const progActiva = idxActivo >= 0 ? progresos[PASOS[idxActivo].key] : null
              // Documento "AHORA MISMO":
              // 1) prioriza local (EXTRAER client-side, feedback inmediato)
              // 2) cae al doc EN_PROCESO del backend (ANALIZAR/CHUNKEAR/VECTORIZAR)
              const archivoActual = archivoActualLocal
                ?? resumenPipeline?.doc_en_proceso?.nombre_documento
                ?? undefined
              // Rueda interna = operación actual DENTRO del lote, en bloques de
              // `tamanoPaq` docs. Las fases client-side (CARGAR/EXTRAER) no respetan
              // el tope y procesan TODO el dataset en una sola pasada, reportando
              // completados que crecen por encima de tamanoPaq (p.ej. 0→1387).
              // Antes acotábamos con Math.min(..., tamanoPaq) → el anillo se CONGELABA
              // en 500/500 mientras el trabajo seguía. Ahora el anillo CICLA: al
              // completar un bloque de N vuelve a 0 y cuenta el siguiente bloque, dando
              // feedback continuo de avance.
              const totalActivaRaw = progActiva?.total || 0
              const completadosRaw = progActiva?.completados ?? docsVectorizados
              let totalActiva: number
              let completadosActiva: number
              if (tamanoPaq > 0 && totalActivaRaw > tamanoPaq) {
                // Fase que excede el tamaño de paquete (client-side full-dataset): ciclar.
                totalActiva = tamanoPaq
                completadosActiva = completadosRaw % tamanoPaq
                // Al cerrar un bloque exacto (mod 0) con trabajo aún pendiente, mostrar
                // el anillo lleno un instante antes de reiniciar a 0 con el siguiente doc.
                if (completadosActiva === 0 && completadosRaw > 0 && completadosRaw < totalActivaRaw) {
                  completadosActiva = tamanoPaq
                }
              } else {
                // Fase backend acotada al paquete (tope=tamanoPaq) o modo legacy sin paquetes.
                totalActiva = tamanoPaq > 0
                  ? Math.min(totalActivaRaw || tamanoPaq, tamanoPaq)
                  : (totalActivaRaw || totalDocs || 1)
                completadosActiva = Math.min(completadosRaw, totalActiva)
              }
              const actual = {
                completados: completadosActiva,
                total: totalActiva,
                archivoActual,
              }

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
                      <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
                      <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-700'}`}>{esArea ? t('area') : t('contenido')}</span>
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
                  <div className="flex flex-col gap-0.5">
                    <span className="text-lg font-semibold text-texto-muted leading-tight">{t('paso1Titulo')}</span>
                    <span className="text-sm text-texto-muted">{t('paso1Subtitulo')}</span>
                  </div>
                  <Boton
                    variante="contorno"
                    onClick={iniciarEscaneoDir}
                    disabled={escaneandoDir || ejecutando}
                    className="justify-center"
                  >
                    <FolderPlus size={14} className="mr-1.5" />
                    {escaneandoDir ? t('escaneandoCorto') : t('btnCargarDesdeDirectorio')}
                  </Boton>

                  <div className="border-t border-borde pt-1 flex-1 min-h-0">
                    {escaneandoDir || sincronizando ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-6">
                        <Loader2 size={48} className="text-primario animate-spin" />
                        <p className="text-xs font-medium text-texto text-center">
                          {sincronizando ? t('sincronizandoUbicaciones') : t('escaneandoDirectorioCorto')}
                        </p>
                        {dirHandle?.name && (
                          <p className="text-[11px] text-texto-muted font-mono text-center truncate max-w-full px-2" title={dirHandle.name}>
                            {dirHandle.name}
                          </p>
                        )}
                      </div>
                    ) : raicesUbic.length > 0 ? (
                      <div className="flex flex-col max-h-60 overflow-y-auto -mx-2">
                        {raicesUbic.map((u) => renderNodoUbic(u))}
                      </div>
                    ) : cargandoUbs ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 size={14} className="text-texto-muted animate-spin" />
                        <span className="text-xs text-texto-muted">{t('cargandoUbicaciones')}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-texto-muted text-center py-2 leading-relaxed">
                        {t('sinUbicacionesArbol')}<br />{t('sinUbicacionesArbolHint')}
                      </p>
                    )}
                  </div>
                </div>
              )

              return (
                <PipelineConversacional
                  antesDeEmpezar={{
                    mensajeTiempo: modoLocal ? t('procesamientoLocalHint') : null,
                    onEmpezar: ejecutarPipeline,
                    textoBotonEmpezar: modoLocal ? t('cargarSemanticaLocal') : t('cargarSemantica'),
                    deshabilitado: false,
                  }}
                  enProceso={{
                    lote,
                    etapa: { indiceActivo, total: fasesNarrativas.length, nombre: nombreEtapa },
                    actual,
                    estadisticas: {
                      vectorizados: docsVectorizados,
                      noProcesables: docsNoVectorizables,
                    },
                    onDetener: detener,
                    deteniendo,
                  }}
                  ejecutando={ejecutando}
                  sinDocsNuevos={sinDocsNuevos}
                  slotArribaBotones={(
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-0.5 -mt-1">
                        <span className="text-lg font-semibold text-texto-muted leading-tight">{t('paso2Titulo')}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-texto-muted">
                        {t('nivelCargaSemantica')}
                      </label>
                      <div
                        role="radiogroup"
                        aria-label={t('nivelCargaSemantica')}
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
                            {v === 'ALTO' ? t('nivelAlto') : t('nivelBajo')}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-texto-muted leading-snug">
                        {nivelCarga === 'ALTO' ? t('nivelAltoDesc') : t('nivelBajoDesc')}
                      </span>
                      </div>
                    </div>
                  )}
                  columnaIzquierda={columnaUbicaciones}
                  porQueTexto={t('narrativoPorQue')}
                  mensajeError={mensajeError || null}
                  mensajeAdvertencia={mensajeAdvertencia || null}
                  slotBajoDial={(ejecutando || todosListos) ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <p className="text-center text-base text-texto-muted">
                        {ejecutando ? t('procesando', { tiempo: formatTiempo(tiempoTranscurrido) }) : t('completadoEn', { tiempo: formatTiempo(tiempoTranscurrido) })}
                      </p>
                      {ejecutando && (
                        <>
                          <p className="text-center text-base text-texto-muted">{mensajeEnProc}</p>
                          {mensajeEtaPipeline && (
                            <p className="text-center text-base text-texto-muted">{mensajeEtaPipeline}</p>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                />
              )
            })()}
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
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-amber-600">{diff.aDeshabilitar}</p><p className="text-xs text-texto-muted">{t('aDeshabilitar')}</p></div>
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-texto-muted">{diff.sinCambio}</p><p className="text-xs text-texto-muted">{t('sinCambio')}</p></div>
                  {diff.excluidas > 0 && <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center"><p className="stat-number text-amber-600">{diff.excluidas}</p><p className="text-xs text-amber-700">{t('excluidasLabel')}</p></div>}
                </div>
              )}
              <div className="border border-borde rounded-lg max-h-[260px] overflow-y-auto">
                <div className="py-1">
                  {(() => {
                    const { filtrados } = filtrarPorInhabilitadas(datosEscaneo.directorios)
                    const rutasFilt = new Set(filtrados.map((d) => d.ruta_completa))
                    const urlsBd = new Set(ubicaciones.map((u) => u.url).filter((u): u is string => !!u))
                    return datosEscaneo.directorios.slice(0, 30).map((d) => {
                      const esNueva = !urlsBd.has(d.ruta_completa)
                      const esExcluida = !rutasFilt.has(d.ruta_completa)
                      return (
                        <div key={d.ruta_completa} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${esExcluida ? 'opacity-40' : ''}`} style={{ paddingLeft: `${d.nivel * 18 + 12}px` }}>
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
              {diff && diff.aDeshabilitar > 0 && <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">{t('avisoDeshabilitacion', { n: diff.aDeshabilitar })}</div>}
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
                <div className="border border-borde rounded-lg p-3 text-center"><p className="stat-number text-amber-600">{resultadoSync.deshabilitadas}</p><p className="text-xs text-texto-muted">{t('deshabilitadasLabel')}</p></div>
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
        titulo={t('reanudarTitulo')}
        mensaje={t('reanudarMensaje', { count: huerfanosCount, minutos: HUERFANOS_MINUTOS })}
        textoConfirmar={t('btnReanudar')}
        textoCancelar={t('btnDejarPausados')}
        variante="primario"
        cargando={reanudando}
      />

      {/* Modal estándar de error para flujos de sincronización (reemplaza window.alert) */}
      <ModalError
        abierto={!!errorModal}
        alCerrar={() => setErrorModal(null)}
        titulo={errorModal?.titulo ?? t('alertErrorSincronizar')}
        mensaje={errorModal?.mensaje ?? ''}
        detalle={errorModal?.detalle}
      />
    </div>
  )
}
