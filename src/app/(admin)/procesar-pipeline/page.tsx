'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  FolderOpen, Folder, FolderInput, FolderPlus, FolderTree,
  CheckCircle, AlertTriangle, RefreshCw, Upload,
  ChevronRight, ChevronDown, ToggleLeft, ToggleRight, Shuffle, Plus, Pencil, Trash2,
} from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { CirculoProgreso } from '@/components/ui/circulo-progreso'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { documentosApi, colaEstadosDocsApi, ubicacionesDocsApi } from '@/lib/api'
import { extraerTextoDeArchivo, abrirArchivoPorRuta } from '@/lib/extraer-texto'
import { getDirectoryHandle, setDirectoryHandle, ensureReadPermission } from '@/lib/file-handle-store'
import {
  escanearDirectorio, escanearDirectorioSinHijos,
  soportaDirectoryPicker, type DirectorioEscaneado,
} from '@/lib/escanear-directorio'
import { useAuth } from '@/context/AuthContext'
import { useColaRealtime } from '@/hooks/useColaRealtime'
import type { UbicacionDoc } from '@/lib/tipos'

// ── Pipeline ──────────────────────────────────────────────────────────────────

const PASOS = [
  { key: 'EXTRAER',    nombre: 'EXTRAER',    estadoOrigen: 'CARGADO',   estadoDestino: 'METADATA',    colorDisco: '#EF4444', clienteSide: true },
  { key: 'ANALIZAR',   nombre: 'ANALIZAR',   estadoOrigen: 'METADATA',  estadoDestino: 'ESCANEADO',   colorDisco: '#F97316', clienteSide: false },
  { key: 'CHUNKEAR',   nombre: 'CHUNKEAR',   estadoOrigen: 'ESCANEADO', estadoDestino: 'CHUNKEADO',   colorDisco: '#84CC16', clienteSide: false },
  { key: 'VECTORIZAR', nombre: 'VECTORIZAR', estadoOrigen: 'CHUNKEADO', estadoDestino: 'VECTORIZADO', colorDisco: '#22C55E', clienteSide: false },
] as const

type EstadoPaso = 'esperando' | 'activo' | 'listo' | 'error'
interface ProgresoPaso { total: number; completados: number; estado: EstadoPaso }

const progresosIniciales = (): Record<string, ProgresoPaso> =>
  Object.fromEntries(PASOS.map((p) => [p.key, { total: 0, completados: 0, estado: 'esperando' }]))

type EstadoEtapa = 'pendiente' | 'activo' | 'completado'

// ── Componente ────────────────────────────────────────────────────────────────

export default function PaginaCargaDocsUsuario() {
  const { grupoActivo } = useAuth()

  // ════════════════════════════════════════════════════════════════════════════
  // ETAPA 1 — Cargar Ubicaciones
  // ════════════════════════════════════════════════════════════════════════════

  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargandoUbs, setCargandoUbs] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [busquedaUbs, setBusquedaUbs] = useState('')
  const [etapa1Estado, setEtapa1Estado] = useState<EstadoEtapa>('pendiente')

  // Modal CRUD ubicaciones
  const [modalUb, setModalUb] = useState(false)
  const [editandoUb, setEditandoUb] = useState<UbicacionDoc | null>(null)
  const [tabModalUb, setTabModalUb] = useState<'datos' | 'prompt' | 'system_prompt'>('datos')
  const [formUb, setFormUb] = useState({
    codigo_ubicacion: '', nombre_ubicacion: '', alias_ubicacion: '',
    descripcion: '', codigo_ubicacion_superior: '', ubicacion_habilitada: true,
    prompt: '', system_prompt: '',
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
  const [cargandoUbIndividual, setCargandoUbIndividual] = useState(false)

  const cargarUbicaciones = useCallback(async () => {
    setCargandoUbs(true)
    try { setUbicaciones(await ubicacionesDocsApi.listar()) }
    finally { setCargandoUbs(false) }
  }, [])

  useEffect(() => { cargarUbicaciones() }, [cargarUbicaciones])

  // Árbol
  const toggleExpandir = (codigo: string) => {
    setExpandidos((prev) => { const n = new Set(prev); n.has(codigo) ? n.delete(codigo) : n.add(codigo); return n })
  }
  const tieneHijos = (codigo: string) => ubicaciones.some((u) => u.codigo_ubicacion_superior === codigo)

  // CRUD ubicaciones
  const abrirNuevaUb = (padre?: string) => {
    setEditandoUb(null)
    setFormUb({ codigo_ubicacion: '', nombre_ubicacion: '', alias_ubicacion: '', descripcion: '', codigo_ubicacion_superior: padre || '', ubicacion_habilitada: true, prompt: '', system_prompt: '' })
    setTabModalUb('datos'); setErrorUb(''); setModalUb(true)
  }
  const abrirEditarUb = (u: UbicacionDoc) => {
    setEditandoUb(u)
    setFormUb({ codigo_ubicacion: u.codigo_ubicacion, nombre_ubicacion: u.nombre_ubicacion, alias_ubicacion: u.alias_ubicacion || '', descripcion: u.descripcion || '', codigo_ubicacion_superior: u.codigo_ubicacion_superior || '', ubicacion_habilitada: u.ubicacion_habilitada, prompt: u.prompt || '', system_prompt: u.system_prompt || '' })
    setTabModalUb('datos'); setErrorUb(''); setModalUb(true)
  }
  const guardarUb = async (cerrar: boolean) => {
    if (!formUb.nombre_ubicacion.trim()) { setErrorUb('El nombre es obligatorio'); return }
    setGuardandoUb(true)
    try {
      if (editandoUb) {
        await ubicacionesDocsApi.actualizar(editandoUb.codigo_ubicacion, {
          nombre_ubicacion: formUb.nombre_ubicacion, alias_ubicacion: formUb.alias_ubicacion || undefined,
          descripcion: formUb.descripcion || undefined, codigo_ubicacion_superior: formUb.codigo_ubicacion_superior || undefined,
          ubicacion_habilitada: formUb.ubicacion_habilitada,
          ...(editandoUb.tipo_ubicacion === 'AREA' ? { prompt: formUb.prompt || undefined, system_prompt: formUb.system_prompt || undefined } : {}),
        })
        if (cerrar) setModalUb(false)
      } else {
        const nueva = await ubicacionesDocsApi.crear({ codigo_grupo: grupoActivo!, nombre_ubicacion: formUb.nombre_ubicacion, alias_ubicacion: formUb.alias_ubicacion || undefined, descripcion: formUb.descripcion || undefined, codigo_ubicacion_superior: formUb.codigo_ubicacion_superior || undefined })
        if (cerrar) { setModalUb(false) } else { setEditandoUb(nueva); setFormUb({ ...formUb, codigo_ubicacion: nueva.codigo_ubicacion, nombre_ubicacion: nueva.nombre_ubicacion }) }
      }
      cargarUbicaciones()
    } catch (e) { setErrorUb(e instanceof Error ? e.message : 'Error al guardar') }
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
    if (!soportaDirectoryPicker()) { alert('Tu navegador no soporta esta funcionalidad. Usa Chrome o Edge.'); return }
    setEscaneandoDir(true); setResultadoSync(null)
    try {
      const r = await escanearDirectorio()
      if (!r) { setEscaneandoDir(false); return }
      setDatosEscaneo(r); setModalCarga(true)
    } catch { alert('Error al escanear el directorio.') }
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
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al sincronizar.' : 'Error al sincronizar.'
      alert(msg)
    } finally { setSincronizando(false) }
  }
  const cerrarModalCarga = () => { setModalCarga(false); setDatosEscaneo(null); setResultadoSync(null) }

  const cargarUbicacionIndividual = async () => {
    if (!soportaDirectoryPicker()) { alert('Tu navegador no soporta esta funcionalidad.'); return }
    setCargandoUbIndividual(true)
    try {
      const r = await escanearDirectorioSinHijos()
      if (!r) { setCargandoUbIndividual(false); return }
      await ubicacionesDocsApi.crear({ codigo_ubicacion: r.directorio.codigo_ubicacion, codigo_grupo: grupoActivo!, nombre_ubicacion: r.directorio.nombre_ubicacion })
      cargarUbicaciones()
    } catch (e) {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error.' : e instanceof Error ? e.message : 'Error.'
      alert(msg)
    } finally { setCargandoUbIndividual(false) }
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
  const opcionesPadre = (excluir?: string) => {
    if (!excluir) return ubicaciones
    const desc = new Set<string>(); const buscar = (c: string) => { for (const u of ubicaciones) { if (u.codigo_ubicacion_superior === c && !desc.has(u.codigo_ubicacion)) { desc.add(u.codigo_ubicacion); buscar(u.codigo_ubicacion) } } }
    desc.add(excluir); buscar(excluir)
    return ubicaciones.filter((u) => !desc.has(u.codigo_ubicacion))
  }
  const filtradosUbs = busquedaUbs
    ? ubicaciones.filter((u) => u.nombre_ubicacion.toLowerCase().includes(busquedaUbs.toLowerCase()) || u.codigo_ubicacion.toLowerCase().includes(busquedaUbs.toLowerCase()) || (u.ruta_completa || '').toLowerCase().includes(busquedaUbs.toLowerCase()))
    : ubicaciones

  const renderNodo = (u: UbicacionDoc) => {
    const hijos = tieneHijos(u.codigo_ubicacion)
    const expandido = expandidos.has(u.codigo_ubicacion)
    const indent = u.nivel * 20
    const esArea = u.tipo_ubicacion === 'AREA'
    const rowBg = esArea ? 'bg-blue-50 hover:bg-blue-100' : 'bg-amber-50 hover:bg-amber-100'
    const folderColor = esArea ? 'text-blue-500' : 'text-amber-500'
    return (
      <div key={u.codigo_ubicacion}>
        <div className={`flex items-center gap-2 px-3 py-1.5 ${rowBg} rounded-lg group transition-colors`} style={{ paddingLeft: `${indent + 12}px` }}>
          <button onClick={() => toggleExpandir(u.codigo_ubicacion)} className={`p-0.5 rounded transition-colors ${hijos ? 'hover:bg-primario-muy-claro text-texto-muted hover:text-primario' : 'invisible'}`}>
            {expandido ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {expandido && hijos ? <FolderOpen size={15} className={`${folderColor} shrink-0`} /> : <Folder size={15} className={`${folderColor} shrink-0`} />}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{u.nombre_ubicacion}</span>
            <span className="text-xs text-texto-muted ml-1.5">({u.codigo_ubicacion})</span>
          </div>
          <Insignia variante={u.tipo_ubicacion === 'AREA' ? 'primario' : 'advertencia'}>{u.tipo_ubicacion}</Insignia>
          <Insignia variante={u.ubicacion_habilitada ? 'exito' : 'advertencia'}>{u.ubicacion_habilitada ? 'Habilitada' : 'Inhabilitada'}</Insignia>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => toggleHabilitada(u)} className={`p-1.5 rounded-lg transition-colors ${u.ubicacion_habilitada ? 'hover:bg-amber-50 text-texto-muted hover:text-amber-600' : 'hover:bg-green-50 text-texto-muted hover:text-green-600'}`} title={u.ubicacion_habilitada ? 'Inhabilitar' : 'Habilitar'}>
              {u.ubicacion_habilitada ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            </button>
            <button onClick={() => setConfirmarTipo({ u, nuevoTipo: u.tipo_ubicacion === 'AREA' ? 'CONTENIDO' : 'AREA' })} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Cambiar tipo"><Shuffle size={13} /></button>
            <button onClick={() => abrirNuevaUb(u.codigo_ubicacion)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Agregar hijo"><Plus size={13} /></button>
            <button onClick={() => abrirEditarUb(u)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={13} /></button>
            <button onClick={() => abrirConfirmElim(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={13} /></button>
          </div>
        </div>
        {expandido && ubicaciones.filter((h) => h.codigo_ubicacion_superior === u.codigo_ubicacion).sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion)).map((h) => renderNodo(h))}
      </div>
    )
  }
  const raices = filtradosUbs.filter((u) => !u.codigo_ubicacion_superior).sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))

  // ════════════════════════════════════════════════════════════════════════════
  // ETAPA 2 — Cargar Documentos (pipeline)
  // ════════════════════════════════════════════════════════════════════════════

  const [progresos, setProgresos] = useState<Record<string, ProgresoPaso>>(progresosIniciales)
  const [ejecutando, setEjecutando] = useState(false)
  const [dirHandle, setDirHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [mensajeError, setMensajeError] = useState('')
  const [carpetaRaiz, setCarpetaRaiz] = useState<string>('')

  const abortRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveColaRef = useRef<(() => void) | null>(null)

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

  const cargarConteos = useCallback(async () => {
    try {
      const conteos = await documentosApi.contarPorEstado()
      setProgresos((prev) => {
        const next = { ...prev }
        for (const paso of PASOS) next[paso.key] = { ...next[paso.key], total: conteos[paso.estadoOrigen] ?? 0, completados: 0, estado: 'esperando' }
        return next
      })
    } catch { /* ignorar */ }
  }, [])

  useEffect(() => {
    getDirectoryHandle().then((h) => { if (h) setDirHandleState(h) })
    cargarConteos()
    ubicacionesDocsApi.listar().then((ubs) => {
      if (!ubs?.length) return
      const raiz = (ubs as { nivel: number; ruta_completa?: string }[]).reduce((min, u) => u.nivel < min.nivel ? u : min, ubs[0] as { nivel: number; ruta_completa?: string })
      const nombre = raiz?.ruta_completa?.split('/').filter(Boolean)[0] ?? ''
      if (nombre) setCarpetaRaiz(nombre)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  const setPaso = (key: string, patch: Partial<ProgresoPaso>) =>
    setProgresos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const ejecutarExtraer = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    const docs = await documentosApi.listar({ codigo_estado_doc: 'CARGADO', activo: true })
    if (!docs.length) { setPaso('EXTRAER', { estado: 'listo' }); return true }
    setPaso('EXTRAER', { total: docs.length, completados: 0, estado: 'activo' })
    let completados = 0
    for (const doc of docs) {
      if (abortRef.current) return false
      try {
        const t0 = Date.now()
        if (!doc.ubicacion_documento) {
          await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
        } else {
          const fh = await abrirArchivoPorRuta(handle, doc.ubicacion_documento)
          if (!fh) {
            await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
          } else {
            const ext = (doc.ubicacion_documento.split('.').pop() || '').toLowerCase()
            const contenido = await extraerTextoDeArchivo(fh)
            if (contenido === null) await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', formato_no_soportado: ext })
            else if (!contenido.trim()) await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', contenido_vacio: true })
            else await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: contenido, caracteres: contenido.length, fecha_inicio_extraccion: new Date(t0).toISOString() })
          }
        }
      } catch { /* continuar */ }
      completados++
      setPaso('EXTRAER', { completados })
    }
    setPaso('EXTRAER', { completados: docs.length, estado: 'listo' })
    return true
  }

  const ejecutarPasoBackend = async (key: string, estadoOrigen: string, estadoDestino: string): Promise<boolean> => {
    const docs = await documentosApi.listar({ codigo_estado_doc: estadoOrigen, activo: true })
    if (!docs.length) { setPaso(key, { estado: 'listo' }); return true }
    setPaso(key, { total: docs.length, completados: 0, estado: 'activo' })
    const items = docs.map((d) => ({ codigo_documento: d.codigo_documento, codigo_estado_doc_destino: estadoDestino }))
    await colaEstadosDocsApi.inicializar(items)
    await colaEstadosDocsApi.ejecutar(estadoDestino)
    const idsSet = new Set(docs.map((d) => d.codigo_documento))
    const refrescarCola = async () => {
      const cola = await colaEstadosDocsApi.listar(undefined, estadoDestino)
      const propios = cola.filter((c) => idsSet.has(c.codigo_documento))
      const activos = propios.filter((c) => c.estado_cola === 'PENDIENTE' || c.estado_cola === 'EN_PROCESO').length
      setPaso(key, { completados: propios.filter((c) => c.estado_cola === 'COMPLETADO').length })
      return activos
    }
    const esperarCambio = () => new Promise<void>((resolve) => {
      const tid = setTimeout(() => { resolveColaRef.current = null; resolve() }, 30_000)
      resolveColaRef.current = () => { clearTimeout(tid); resolve() }
    })
    try { if ((await refrescarCola()) === 0) { setPaso(key, { completados: docs.length, estado: 'listo' }); return true } } catch { /* continuar */ }
    while (!abortRef.current) {
      await esperarCambio()
      if (abortRef.current) return false
      try { if ((await refrescarCola()) === 0) break } catch { /* reintentar */ }
    }
    if (abortRef.current) return false
    setPaso(key, { completados: docs.length, estado: 'listo' })
    return true
  }

  const ejecutarPipeline = async () => {
    let handleEfectivo = dirHandle
    if (!handleEfectivo || !(await ensureReadPermission(handleEfectivo))) {
      const stored = await getDirectoryHandle()
      if (stored && (await ensureReadPermission(stored))) { handleEfectivo = stored; setDirHandleState(stored); await setDirectoryHandle(stored) }
      else {
        try { handleEfectivo = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker(); setDirHandleState(handleEfectivo); await setDirectoryHandle(handleEfectivo) }
        catch { return }
      }
    }
    if (!(await ensureReadPermission(handleEfectivo))) { setMensajeError('Sin permiso de lectura sobre el directorio.'); return }
    setMensajeError(''); abortRef.current = false; setEjecutando(true); setTiempoInicio(Date.now()); setTiempoTranscurrido(0); setProgresos(progresosIniciales()); suscribirCola()
    try {
      for (const paso of PASOS) {
        if (abortRef.current) break
        const ok = paso.clienteSide ? await ejecutarExtraer(handleEfectivo) : await ejecutarPasoBackend(paso.key, paso.estadoOrigen, paso.estadoDestino)
        if (!ok) break
      }
    } catch (e) { setMensajeError(e instanceof Error ? e.message : 'Error inesperado') }
    finally { desuscribirCola(); setEjecutando(false); await cargarConteos() }
  }

  const detener = () => {
    abortRef.current = true
    if (resolveColaRef.current) { resolveColaRef.current(); resolveColaRef.current = null }
  }

  const formatTiempo = (seg: number) => { const m = Math.floor(seg / 60); return m > 0 ? `${m}m ${seg % 60}s` : `${seg % 60}s` }
  const todosListos = PASOS.every((p) => progresos[p.key]?.estado === 'listo')
  const etapa2Estado: EstadoEtapa = ejecutando ? 'activo' : todosListos ? 'completado' : 'pendiente'

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
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Carga tus Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">Configura las ubicaciones y procesa tus documentos paso a paso.</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ETAPA 1: Cargar Ubicaciones
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          {circuloEtapa(1, etapa1Estado)}
          <div className="w-0.5 flex-1 bg-gray-200 mt-1 min-h-[40px]" />
        </div>

        <div className="flex-1 pb-8">
          <h3 className="text-lg font-semibold text-texto mb-0.5">Cargar Ubicaciones</h3>
          <p className="text-xs text-texto-muted mb-4">Define las carpetas del sistema donde se almacenan tus documentos.</p>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Input
              placeholder="Buscar ubicación..."
              value={busquedaUbs}
              onChange={(e) => setBusquedaUbs(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex gap-1.5 ml-auto flex-wrap">
              <Boton variante="contorno" tamano="sm" onClick={() => setExpandidos(new Set(ubicaciones.map((u) => u.codigo_ubicacion)))} disabled={!ubicaciones.length}>Expandir</Boton>
              <Boton variante="contorno" tamano="sm" onClick={() => setExpandidos(new Set())} disabled={!ubicaciones.length}>Colapsar</Boton>
              <Boton variante="contorno" tamano="sm" onClick={cargarUbicacionIndividual} cargando={cargandoUbIndividual}>
                <FolderPlus size={14} /> Carpeta
              </Boton>
              <Boton variante="contorno" tamano="sm" onClick={iniciarEscaneoDir} cargando={escaneandoDir}>
                <FolderInput size={14} /> Desde directorio
              </Boton>
              <Boton variante="primario" tamano="sm" onClick={() => abrirNuevaUb()}>
                <Plus size={14} /> Nueva
              </Boton>
            </div>
          </div>

          {/* Árbol jerárquico */}
          <div className="border border-borde rounded-lg bg-fondo-tarjeta">
            {cargandoUbs ? (
              <div className="py-6 text-center text-texto-muted text-sm">Cargando ubicaciones...</div>
            ) : raices.length === 0 ? (
              <div className="py-8 text-center text-texto-muted flex flex-col items-center gap-2">
                <FolderTree size={28} className="text-texto-muted/50" />
                <p className="text-sm">Sin ubicaciones configuradas</p>
                <p className="text-xs text-texto-muted/70">Usa &quot;Desde directorio&quot; para cargar desde una carpeta de tu computador.</p>
              </div>
            ) : (
              <div className="py-1.5">{raices.map((u) => renderNodo(u))}</div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ETAPA 2: Cargar Documentos
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          {circuloEtapa(2, etapa2Estado)}
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-texto mb-0.5">Cargar Documentos</h3>
          <p className="text-xs text-texto-muted mb-4">Ejecuta el pipeline completo sobre tus documentos: extrae, analiza, chunkea y vectoriza.</p>

          <div className="rounded-lg border border-borde bg-fondo-tarjeta p-5 flex flex-col gap-5">
            {/* Selector de directorio */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-medium text-texto">Directorio de documentos</p>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={async () => {
                    try {
                      const h = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
                      setDirHandleState(h); await setDirectoryHandle(h)
                    } catch { /* cancelado */ }
                  }}
                  className="flex items-center gap-2 rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto hover:border-primario transition-colors"
                >
                  <FolderOpen size={15} className={dirHandle ? 'text-primario' : 'text-texto-muted'} />
                  {dirHandle ? dirHandle.name : 'Seleccionar directorio'}
                </button>
                {!dirHandle && carpetaRaiz && (
                  <span className="text-xs text-texto-muted text-right">
                    Al ejecutar se pedirá acceso a: <strong className="text-texto">{carpetaRaiz}</strong>
                  </span>
                )}
              </div>
            </div>

            {mensajeError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />{mensajeError}
              </div>
            )}

            {/* Pipeline visual — círculos horizontales */}
            <div className="flex items-center justify-center gap-0 flex-wrap">
              {PASOS.map((paso, i) => {
                const prog = progresos[paso.key]
                return (
                  <div key={paso.key} className="flex items-center">
                    <CirculoProgreso
                      nombre={paso.nombre}
                      total={prog?.total ?? 0}
                      completados={prog?.completados ?? 0}
                      estado={prog?.estado ?? 'esperando'}
                      colorDisco={paso.colorDisco}
                      size={88}
                    />
                    {i < PASOS.length - 1 && (
                      <div className="flex items-center self-center px-0.5">
                        <svg width="32" height="18" viewBox="0 0 32 18">
                          <line x1="0" y1="9" x2="20" y2="9" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" />
                          <polygon points="18,3 30,9 18,15" fill="#9CA3AF" />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Timer */}
            {(ejecutando || todosListos) && (
              <p className="text-center text-sm text-texto-muted">
                {ejecutando ? `Procesando... ${formatTiempo(tiempoTranscurrido)}` : `Completado en ${formatTiempo(tiempoTranscurrido)}`}
              </p>
            )}

            {/* Botones acción */}
            <div className="flex gap-3">
              {!ejecutando ? (
                <Boton variante="primario" className="flex-1" onClick={ejecutarPipeline}>
                  <Upload size={15} />
                  {todosListos ? 'Cargar de nuevo' : 'Cargar Documentos'}
                </Boton>
              ) : (
                <Boton variante="peligro" className="flex-1" onClick={detener}>Detener</Boton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALES
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Modal CRUD ubicación */}
      <Modal abierto={modalUb} alCerrar={() => setModalUb(false)} titulo={editandoUb ? `Editar: ${editandoUb.nombre_ubicacion}` : 'Nueva Ubicación'} className={editandoUb?.tipo_ubicacion === 'AREA' ? 'max-w-2xl' : undefined}>
        <div className="flex flex-col gap-4 min-w-[420px]">
          {editandoUb?.tipo_ubicacion === 'AREA' && (
            <div className="flex border-b border-borde">
              {(['datos', 'prompt', 'system_prompt'] as const).map((tab) => (
                <button key={tab} onClick={() => setTabModalUb(tab)} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalUb === tab ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>
                  {tab === 'datos' ? 'Datos' : tab === 'prompt' ? 'Prompt' : 'System Prompt'}
                </button>
              ))}
            </div>
          )}
          {tabModalUb === 'datos' && (
            <>
              <Input etiqueta="Nombre" value={formUb.nombre_ubicacion} onChange={(e) => setFormUb({ ...formUb, nombre_ubicacion: e.target.value })} placeholder="Nombre de la ubicación" />
              <Input etiqueta="Alias" value={formUb.alias_ubicacion} onChange={(e) => setFormUb({ ...formUb, alias_ubicacion: e.target.value })} placeholder="Nombre amigable" />
              <Textarea etiqueta="Descripción" value={formUb.descripcion} onChange={(e) => setFormUb({ ...formUb, descripcion: e.target.value })} placeholder="Descripción opcional" rows={2} />
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">Carpeta padre</label>
                <select className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none" value={formUb.codigo_ubicacion_superior} onChange={(e) => setFormUb({ ...formUb, codigo_ubicacion_superior: e.target.value })}>
                  <option value="">— Raíz —</option>
                  {opcionesPadre(editandoUb?.codigo_ubicacion).map((u) => <option key={u.codigo_ubicacion} value={u.codigo_ubicacion}>{'  '.repeat(u.nivel)}{u.nombre_ubicacion}</option>)}
                </select>
              </div>
              {editandoUb && <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={formUb.ubicacion_habilitada} onChange={(e) => setFormUb({ ...formUb, ubicacion_habilitada: e.target.checked })} className="w-4 h-4 rounded border-borde text-primario" /><span className="text-sm font-medium text-texto">Habilitada</span></label>}
              {editandoUb && <Input etiqueta="Código" value={formUb.codigo_ubicacion} disabled readOnly />}
            </>
          )}
          {tabModalUb === 'prompt' && editandoUb?.tipo_ubicacion === 'AREA' && (
            <textarea className="w-full h-40 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30" placeholder="Prompt para esta área..." value={formUb.prompt} onChange={(e) => setFormUb({ ...formUb, prompt: e.target.value })} />
          )}
          {tabModalUb === 'system_prompt' && editandoUb?.tipo_ubicacion === 'AREA' && (
            <textarea className="w-full h-40 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30" placeholder="System prompt para esta área..." value={formUb.system_prompt} onChange={(e) => setFormUb({ ...formUb, system_prompt: e.target.value })} />
          )}
          {errorUb && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-error">{errorUb}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <Boton variante="contorno" onClick={() => setModalUb(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={() => guardarUb(true)} cargando={guardandoUb}>Guardar</Boton>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <ModalConfirmar
        abierto={!!confirmElim} alCerrar={() => { setConfirmElim(null); setPreviewElim(null) }} alConfirmar={ejecutarEliminar}
        titulo="Eliminar ubicación"
        mensaje={confirmElim ? (previewElim ? `Se eliminarán ${previewElim.ubicaciones} ubicación(es) y ${previewElim.documentos_a_eliminar} documento(s). ¿Confirmas?` : `Calculando impacto de "${confirmElim.nombre_ubicacion}"...`) : ''}
        textoConfirmar="Eliminar" cargando={eliminandoUb || !previewElim}
      />

      {/* Modal confirmar cambio de tipo */}
      <ModalConfirmar
        abierto={!!confirmarTipo} alCerrar={() => setConfirmarTipo(null)} alConfirmar={ejecutarCambioTipo}
        titulo="Cambiar tipo de ubicación"
        mensaje={confirmarTipo ? `¿Cambiar "${confirmarTipo.u.nombre_ubicacion}" a tipo ${confirmarTipo.nuevoTipo}?` : ''}
        textoConfirmar="Cambiar" cargando={cambiandoTipo}
      />

      {/* Modal carga desde directorio */}
      <Modal abierto={modalCarga} alCerrar={cerrarModalCarga} titulo="Cargar desde directorio">
        <div className="flex flex-col gap-4 min-w-[480px]">
          {!resultadoSync && datosEscaneo && (
            <>
              <div className="bg-fondo rounded-lg p-4 flex items-center gap-3">
                <FolderOpen size={22} className="text-primario shrink-0" />
                <div><p className="font-medium text-texto">{datosEscaneo.nombreRaiz}</p><p className="text-sm text-texto-muted">{datosEscaneo.directorios.length} directorio(s) encontrado(s)</p></div>
              </div>
              {diff && (
                <div className={`grid ${diff.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="text-2xl font-bold text-green-600">{diff.nuevas}</p><p className="text-xs text-texto-muted">Nuevas</p></div>
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="text-2xl font-bold text-red-600">{diff.aEliminar}</p><p className="text-xs text-texto-muted">A eliminar</p></div>
                  <div className="border border-borde rounded-lg p-3 text-center"><p className="text-2xl font-bold text-texto-muted">{diff.sinCambio}</p><p className="text-xs text-texto-muted">Sin cambio</p></div>
                  {diff.excluidas > 0 && <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-amber-600">{diff.excluidas}</p><p className="text-xs text-amber-700">Excluidas</p></div>}
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
                          {!esExcluida && esNueva && <Insignia variante="exito">Nueva</Insignia>}
                          {esExcluida && <Insignia variante="advertencia">Excluida</Insignia>}
                        </div>
                      )
                    })
                  })()}
                  {datosEscaneo.directorios.length > 30 && <p className="px-4 py-2 text-xs text-texto-muted text-center">...y {datosEscaneo.directorios.length - 30} más</p>}
                </div>
              </div>
              {diff && diff.aEliminar > 0 && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">Se eliminarán {diff.aEliminar} ubicación(es) que ya no existen en el directorio.</div>}
              <div className="flex gap-3 justify-end pt-1">
                <Boton variante="contorno" onClick={cerrarModalCarga}>Cancelar</Boton>
                <Boton variante="primario" onClick={ejecutarSincronizacion} cargando={sincronizando}><RefreshCw size={14} />Sincronizar</Boton>
              </div>
            </>
          )}
          {resultadoSync && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center"><p className="text-lg font-medium text-green-800">Sincronización completada</p></div>
              <div className={`grid ${resultadoSync.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                <div className="border border-borde rounded-lg p-3 text-center"><p className="text-2xl font-bold text-green-600">{resultadoSync.insertadas}</p><p className="text-xs text-texto-muted">Insertadas</p></div>
                <div className="border border-borde rounded-lg p-3 text-center"><p className="text-2xl font-bold text-red-600">{resultadoSync.eliminadas}</p><p className="text-xs text-texto-muted">Eliminadas</p></div>
                <div className="border border-borde rounded-lg p-3 text-center"><p className="text-2xl font-bold text-primario">{resultadoSync.actualizadas}</p><p className="text-xs text-texto-muted">Actualizadas</p></div>
                {resultadoSync.excluidas > 0 && <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-amber-600">{resultadoSync.excluidas}</p><p className="text-xs text-amber-700">Excluidas</p></div>}
              </div>
              <div className="flex justify-end pt-1"><Boton variante="primario" onClick={cerrarModalCarga}>Cerrar</Boton></div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
