'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  FolderOpen, Folder, FolderInput, FolderPlus, FolderTree,
  CheckCircle, AlertTriangle, RefreshCw, Upload,
  ChevronRight, ChevronDown, ToggleLeft, ToggleRight, Shuffle, Plus, Pencil, Trash2, X,
} from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { documentosApi, colaEstadosDocsApi, ubicacionesDocsApi } from '@/lib/api'
import { extraerTextoDeArchivo, abrirArchivoPorRuta, NECESITA_OCR } from '@/lib/extraer-texto'
import { getDirectoryHandle, setDirectoryHandle, ensureReadPermission } from '@/lib/file-handle-store'
import {
  escanearDirectorio, escanearDirectorioSinHijos,
  soportaDirectoryPicker, type DirectorioEscaneado,
} from '@/lib/escanear-directorio'
import { useAuth } from '@/context/AuthContext'
import { useColaRealtime } from '@/hooks/useColaRealtime'
import type { UbicacionDoc, Documento } from '@/lib/tipos'

// ── Pipeline ──────────────────────────────────────────────────────────────────

const PASOS = [
  { key: 'EXTRAER',  nombre: 'EXTRAER',  estadoOrigen: 'CARGADO',   estadoDestino: 'METADATA',  colorBarra: '#074B91', clienteSide: true  },
  { key: 'ANALIZAR', nombre: 'ANALIZAR', estadoOrigen: 'METADATA',  estadoDestino: 'ESCANEADO', colorBarra: '#F97316', clienteSide: false },
  { key: 'CHUNKEAR', nombre: 'CHUNKEAR', estadoOrigen: 'ESCANEADO', estadoDestino: 'CHUNKEADO', colorBarra: '#22C55E', clienteSide: false },
] as const

// Estados válidos (documentos que avanzaron correctamente) e inválidos (rechazados)
const ESTADOS_VALIDOS = ['METADATA', 'ESCANEADO', 'CHUNKEADO', 'VECTORIZADO']
const ESTADOS_INVALIDOS = ['NO_ANALIZABLE', 'NO_ESCANEABLE']

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
  const [totalDocs, setTotalDocs] = useState(0)
  const [docsValidos, setDocsValidos] = useState(0)
  const [docsRechazados, setDocsRechazados] = useState(0)

  // Lista paginada de documentos en etapa 2
  const [docsLista, setDocsLista] = useState<Documento[]>([])
  const [docsListaPagina, setDocsListaPagina] = useState(1)
  const [docsListaTotal, setDocsListaTotal] = useState(0)
  const [cargandoDocsLista, setCargandoDocsLista] = useState(false)
  const DOCS_LISTA_POR_PAGINA = 20

  // Selector de ubicación para etapa 2 (árbol de ubicaciones, no directorio físico)
  const [ubicacionDocSel, setUbicacionDocSel] = useState('')
  const [ubicDocDropdownOpen, setUbicDocDropdownOpen] = useState(false)
  const [ubicDocBusqueda, setUbicDocBusqueda] = useState('')
  const [ubicDocExpandidos, setUbicDocExpandidos] = useState<Set<string>>(new Set())
  const ubicDocDropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ubicDocDropdownRef.current && !ubicDocDropdownRef.current.contains(e.target as Node)) {
        setUbicDocDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
      const validos = ESTADOS_VALIDOS.reduce((acc, e) => acc + (conteos[e] ?? 0), 0)
      const rechazados = ESTADOS_INVALIDOS.reduce((acc, e) => acc + (conteos[e] ?? 0), 0)
      const total = Object.values(conteos as Record<string, number>).reduce((a, b) => a + b, 0)
      setTotalDocs(total)
      setDocsValidos(validos)
      setDocsRechazados(rechazados)
    } catch { /* ignorar */ }
  }, [])

  const cargarDocsLista = useCallback(async (pagina: number, estadoDoc: string) => {
    setCargandoDocsLista(true)
    try {
      const res = await documentosApi.listarPaginado({ page: pagina, limit: 20, codigo_estado_doc: estadoDoc, activo: true })
      // Filtrar por ubicación si hay una seleccionada (client-side, la API no tiene ese param)
      const ubic = ubicacionDocSel ? ubicaciones.find(u => u.codigo_ubicacion === ubicacionDocSel) : null
      const rutaUbic = ubic?.ruta_completa ?? null
      const items = rutaUbic
        ? res.items.filter(d => d.ubicacion_documento?.startsWith(rutaUbic))
        : res.items
      setDocsLista(items)
      setDocsListaTotal(ubic ? items.length : res.total)
    } catch { /* ignorar */ }
    finally { setCargandoDocsLista(false) }
  }, [ubicacionDocSel, ubicaciones])

  useEffect(() => {
    getDirectoryHandle().then((h) => { if (h) setDirHandleState(h) })
    cargarConteos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  const setPaso = (key: string, patch: Partial<ProgresoPaso>) =>
    setProgresos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const ejecutarExtraer = async (): Promise<boolean> => {
    const docs = await documentosApi.listar({ codigo_estado_doc: 'CARGADO', activo: true })
    if (!docs.length) { setPaso('EXTRAER', { estado: 'listo' }); return true }

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
          for (const doc of docs) {
            await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true }).catch(() => {})
          }
          setPaso('EXTRAER', { completados: docs.length, estado: 'listo' })
          return true
        }
      }
    }

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
            if (contenido === null || contenido === NECESITA_OCR) await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', formato_no_soportado: ext })
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
    setMensajeError(''); abortRef.current = false; setEjecutando(true); setTiempoInicio(Date.now()); setTiempoTranscurrido(0); setProgresos(progresosIniciales()); suscribirCola()
    try {
      for (const paso of PASOS) {
        if (abortRef.current) break
        const ok = paso.clienteSide ? await ejecutarExtraer() : await ejecutarPasoBackend(paso.key, paso.estadoOrigen, paso.estadoDestino)
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

  // Cargar lista de docs cuando cambia la paginación, el estado del pipeline o la ubicación
  useEffect(() => {
    setDocsListaPagina(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosListos, ubicacionDocSel])

  useEffect(() => {
    const estadoDoc = todosListos ? 'CHUNKEADO' : 'CARGADO'
    cargarDocsLista(docsListaPagina, estadoDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsListaPagina, todosListos, ubicacionDocSel])

  // Barra de progreso individual
  const BarraPaso = ({ pasoKey, color }: { pasoKey: string; color: string }) => {
    const prog = progresos[pasoKey]
    const estado = prog?.estado ?? 'esperando'
    const pct = (prog?.total ?? 0) > 0 ? Math.min(100, Math.round(((prog?.completados ?? 0) / (prog?.total ?? 1)) * 100)) : (estado === 'listo' ? 100 : 0)
    const pulso = estado === 'activo' ? 'animate-pulse' : ''
    return (
      <div className="flex-1 h-5 rounded-full overflow-hidden bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pulso}`}
          style={{ width: `${pct}%`, backgroundColor: estado === 'esperando' ? '#D1D5DB' : color }}
        />
      </div>
    )
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

  // ── State para tabs ────────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<'ubicaciones' | 'documentos'>('ubicaciones')

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Carga tus Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">Configura las ubicaciones y procesa tus documentos paso a paso.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-borde">
        <button
          onClick={() => setTabActiva('ubicaciones')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'ubicaciones'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          <span className="flex items-center gap-2"><FolderTree size={15} />Ubicaciones</span>
        </button>
        <button
          onClick={() => setTabActiva('documentos')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'documentos'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          <span className="flex items-center gap-2"><Upload size={15} />Documentos</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Ubicaciones
      ══════════════════════════════════════════════════════════════════════ */}
      {tabActiva === 'ubicaciones' && (
        <div>
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Documentos
      ══════════════════════════════════════════════════════════════════════ */}
      {tabActiva === 'documentos' && (
        <div>

          <div className="rounded-lg border border-borde bg-fondo-tarjeta p-5 flex flex-col gap-5">
            {/* Selector: árbol de ubicaciones (izquierda) + directorio físico (derecha, mismo borde) */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Dropdown árbol de ubicaciones */}
              <div className="relative flex-1 min-w-[200px]" ref={ubicDocDropdownRef}>
                <button
                  type="button"
                  onClick={() => !ejecutando && setUbicDocDropdownOpen(!ubicDocDropdownOpen)}
                  disabled={ejecutando}
                  className="flex items-center gap-2 rounded-lg border border-primario bg-fondo-tarjeta px-3 py-2 text-sm text-texto hover:border-primario transition-colors w-full disabled:opacity-50"
                >
                  <FolderOpen size={15} className={ubicacionDocSel ? 'text-primario shrink-0' : 'text-texto-muted shrink-0'} />
                  <span className="flex-1 text-left truncate">
                    {ubicacionDocSel
                      ? (ubicaciones.find(u => u.codigo_ubicacion === ubicacionDocSel)?.nombre_ubicacion ?? 'Seleccionar ubicación')
                      : 'Seleccionar ubicación'}
                  </span>
                  {ubicacionDocSel ? (
                    <X size={13} className="text-texto-muted hover:text-error shrink-0" onClick={(e) => { e.stopPropagation(); setUbicacionDocSel(''); setUbicDocBusqueda(''); setUbicDocDropdownOpen(false) }} />
                  ) : (
                    <ChevronDown size={13} className="text-texto-muted shrink-0" />
                  )}
                </button>
                {ubicDocDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-borde rounded-lg shadow-lg flex flex-col" style={{ maxHeight: '16rem' }}>
                    <div className="p-2 border-b border-borde shrink-0">
                      <input
                        type="text"
                        placeholder="Buscar ubicación…"
                        value={ubicDocBusqueda}
                        onChange={(e) => setUbicDocBusqueda(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm border border-borde rounded px-2 py-1 bg-fondo text-texto focus:outline-none focus:ring-1 focus:ring-primario placeholder:text-texto-muted"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <div className="px-3 py-2 hover:bg-fondo cursor-pointer text-sm text-texto-muted border-b border-borde" onClick={() => { setUbicacionDocSel(''); setUbicDocBusqueda(''); setUbicDocDropdownOpen(false) }}>
                        Todas las ubicaciones
                      </div>
                      {(() => {
                        const tieneHijosDoc = (cod: string) => ubicaciones.some(u => u.codigo_ubicacion_superior === cod)
                        // Con búsqueda: mostrar todos los que coincidan sin restricción de árbol
                        if (ubicDocBusqueda) {
                          const filtradas = ubicaciones.filter(u =>
                            u.nombre_ubicacion.toLowerCase().includes(ubicDocBusqueda.toLowerCase()) ||
                            (u.ruta_completa || '').toLowerCase().includes(ubicDocBusqueda.toLowerCase())
                          )
                          if (filtradas.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">Sin coincidencias</div>
                          return filtradas.map(u => {
                            const esArea = u.tipo_ubicacion === 'AREA'
                            const selec = ubicacionDocSel === u.codigo_ubicacion
                            return (
                              <div
                                key={u.codigo_ubicacion}
                                className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer ${selec ? 'bg-primario-muy-claro' : ''}`}
                                style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }}
                                onClick={() => { setUbicacionDocSel(u.codigo_ubicacion); setUbicDocBusqueda(''); setUbicDocDropdownOpen(false) }}
                              >
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
                                <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
                              </div>
                            )
                          })
                        }
                        // Sin búsqueda: árbol colapsado — solo raíces y nodos expandidos
                        const toggleExpandirDoc = (e: React.MouseEvent, cod: string) => {
                          e.stopPropagation()
                          setUbicDocExpandidos(prev => { const next = new Set(prev); next.has(cod) ? next.delete(cod) : next.add(cod); return next })
                        }
                        const renderNodoDropdown = (u: UbicacionDoc): React.ReactNode => {
                          const tieneHijos = tieneHijosDoc(u.codigo_ubicacion)
                          const expandido = ubicDocExpandidos.has(u.codigo_ubicacion)
                          const esArea = u.tipo_ubicacion === 'AREA'
                          const selec = ubicacionDocSel === u.codigo_ubicacion
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
                                onClick={() => { setUbicacionDocSel(u.codigo_ubicacion); setUbicDocBusqueda(''); setUbicDocDropdownOpen(false) }}
                              >
                                {tieneHijos
                                  ? <button onClick={(e) => toggleExpandirDoc(e, u.codigo_ubicacion)} className="shrink-0 hover:text-primario text-texto-muted p-0.5 -ml-0.5 rounded">
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
                        const raicesDoc = ubicaciones
                          .filter(u => !u.codigo_ubicacion_superior)
                          .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
                        if (raicesDoc.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">Sin ubicaciones</div>
                        return raicesDoc.map(u => renderNodoDropdown(u))
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Directorio físico (para leer archivos del disco) */}
              <button
                onClick={async () => {
                  try {
                    const h = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
                    setDirHandleState(h); await setDirectoryHandle(h)
                  } catch { /* cancelado */ }
                }}
                className="flex items-center gap-2 rounded-lg border border-primario bg-fondo-tarjeta px-3 py-2 text-sm text-texto hover:border-primario transition-colors shrink-0"
                title="Seleccionar carpeta raíz en tu computador"
              >
                <FolderOpen size={15} className={dirHandle ? 'text-primario' : 'text-texto-muted'} />
                {dirHandle ? dirHandle.name : 'Carpeta'}
              </button>
            </div>

            {mensajeError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />{mensajeError}
              </div>
            )}

            {/* Barras de progreso del pipeline */}
            <div className="flex items-center gap-2">
              {PASOS.map((paso, i) => (
                <div key={paso.key} className="flex items-center gap-2 flex-1">
                  <BarraPaso pasoKey={paso.key} color={paso.colorBarra} />
                  {i < PASOS.length - 1 && <div className="w-2 h-0.5 bg-gray-300 shrink-0" />}
                </div>
              ))}
            </div>

            {/* Contadores */}
            <div className="grid grid-cols-3 gap-4 pt-1">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-2xl font-bold text-texto">{totalDocs}</span>
                <span className="text-xs text-texto-muted">Documentos totales</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-2xl font-bold text-green-600">{docsValidos}</span>
                <span className="text-xs text-texto-muted">Procesados correctamente</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-2xl font-bold text-red-500">{docsRechazados}</span>
                <span className="text-xs text-texto-muted">Rechazados</span>
              </div>
            </div>

            {/* Lista paginada de documentos */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-texto-muted uppercase">
                  {todosListos ? 'Documentos procesados (CHUNKEADO)' : 'Documentos pendientes (CARGADO)'}
                </p>
                {cargandoDocsLista && <span className="text-xs text-texto-muted animate-pulse">Cargando...</span>}
              </div>
              {docsLista.length === 0 && !cargandoDocsLista ? (
                <p className="text-xs text-texto-muted text-center py-3">Sin documentos en este estado</p>
              ) : (
                <>
                  <div className="rounded-lg border border-borde overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-fondo border-b border-borde">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-texto-muted">Archivo</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-texto-muted w-32">Estado</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-texto-muted w-36 hidden sm:table-cell">Modificado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsLista.map((doc) => {
                          const esRechazado = doc.codigo_estado_doc === 'NO_ANALIZABLE' || doc.codigo_estado_doc === 'NO_ESCANEABLE'
                          const nombreArchivo = doc.nombre_documento.split('/').pop() ?? doc.nombre_documento
                          const fecha = doc.fecha_modificacion
                            ? new Date(doc.fecha_modificacion).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                            : '—'
                          return (
                            <tr key={doc.codigo_documento} className="border-b border-borde last:border-0 hover:bg-fondo/50 transition-colors">
                              <td className="px-3 py-2 text-texto truncate max-w-0">
                                <span className="block truncate" title={doc.ubicacion_documento ?? doc.nombre_documento}>{nombreArchivo}</span>
                              </td>
                              <td className="px-3 py-2 w-32">
                                <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  esRechazado
                                    ? 'bg-red-100 text-red-700'
                                    : doc.codigo_estado_doc === 'CHUNKEADO' || doc.codigo_estado_doc === 'VECTORIZADO'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {doc.codigo_estado_doc ?? '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-texto-muted w-36 hidden sm:table-cell">{fecha}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Paginación */}
                  {docsListaTotal > DOCS_LISTA_POR_PAGINA && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-texto-muted">
                        Página {docsListaPagina} de {Math.ceil(docsListaTotal / DOCS_LISTA_POR_PAGINA)}
                      </span>
                      <div className="flex gap-2">
                        <Boton
                          variante="contorno"
                          tamano="sm"
                          onClick={() => setDocsListaPagina(p => Math.max(1, p - 1))}
                          disabled={docsListaPagina <= 1 || cargandoDocsLista}
                        >
                          Anterior
                        </Boton>
                        <Boton
                          variante="contorno"
                          tamano="sm"
                          onClick={() => setDocsListaPagina(p => Math.min(Math.ceil(docsListaTotal / DOCS_LISTA_POR_PAGINA), p + 1))}
                          disabled={docsListaPagina >= Math.ceil(docsListaTotal / DOCS_LISTA_POR_PAGINA) || cargandoDocsLista}
                        >
                          Siguiente
                        </Boton>
                      </div>
                    </div>
                  )}
                </>
              )}
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
      )}

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
