'use client'

import { useEffect, useState, useCallback } from 'react'
import { Pencil, Download, ChevronRight, ChevronDown, FolderTree, Folder, FolderOpen, FolderInput, FolderPlus, RefreshCw, ToggleLeft, ToggleRight, Shuffle, XCircle, Upload, FileText, AlertTriangle, CheckCircle, Search, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { ubicacionesDocsApi, cargaDocumentosApi, parametrosApi, promptsApi } from '@/lib/api'
import type { UbicacionDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { escanearDirectorio, escanearDirectorioSinHijos, soportaDirectoryPicker, type DirectorioEscaneado, escanearArchivosDirectorio, type ArchivoEscaneado } from '@/lib/escanear-directorio'
import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle } from '@/lib/file-handle-store'
import { BotonChat } from '@/components/ui/boton-chat'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'

export default function PaginaUbicacionesDocs() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('ubicacionesDocs')
  const tc = useTranslations('common')
  const tcd = useTranslations('cargarDocumentos')

  // ── State ─────────────────────────────────────────────────────────────────
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargando, setCargando] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // ── Modal CRUD ────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<UbicacionDoc | null>(null)
  const [tabModal, setTabModal] = useState<'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [md, setMd] = useState('')
  const [form, setForm] = useState({
    codigo_ubicacion: '',
    nombre_ubicacion: '',
    alias_ubicacion: '',
    descripcion: '',
    codigo_ubicacion_superior: '',
    ubicacion_habilitada: true,
    prompt_insert: '',
    prompt_update: '',
    system_prompt: '',
    python_insert: '',
    python_update: '',
    javascript: '',
    python_editado_manual: false,
    javascript_editado_manual: false,
  })
  const [confirmarTipo, setConfirmarTipo] = useState<{ u: UbicacionDoc; nuevoTipo: 'AREA' | 'CONTENIDO' } | null>(null)
  const [cambiandoTipo, setCambiandoTipo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Modal Confirmar ───────────────────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<UbicacionDoc | null>(null)
  const [previewEliminar, setPreviewEliminar] = useState<{
    ubicaciones: number
    documentos_afectados: number
    documentos_a_eliminar: number
  } | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Cargar Ubicaciones (escaneo) ──────────────────────────────────────────
  const [modalCarga, setModalCarga] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [datosEscaneo, setDatosEscaneo] = useState<{
    nombreRaiz: string
    directorios: DirectorioEscaneado[]
  } | null>(null)
  const [resultadoSync, setResultadoSync] = useState<{
    insertadas: number
    eliminadas: number
    actualizadas: number
    total: number
    excluidas: number
  } | null>(null)

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setUbicaciones(await ubicacionesDocsApi.listar())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Expandir/Colapsar ─────────────────────────────────────────────────────
  const toggleExpandir = (codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const expandirTodos = () => {
    setExpandidos(new Set(ubicaciones.map((u) => u.codigo_ubicacion)))
  }

  const colapsarTodos = () => {
    setExpandidos(new Set())
  }

  // ── Helpers jerarquía ─────────────────────────────────────────────────────
  const tieneHijos = (codigo: string) =>
    ubicaciones.some((u) => u.codigo_ubicacion_superior === codigo)

  const opcionesPadre = (excluirCodigo?: string) => {
    if (!excluirCodigo) return ubicaciones
    const descendientes = new Set<string>()
    const buscarDesc = (cod: string) => {
      for (const u of ubicaciones) {
        if (u.codigo_ubicacion_superior === cod && !descendientes.has(u.codigo_ubicacion)) {
          descendientes.add(u.codigo_ubicacion)
          buscarDesc(u.codigo_ubicacion)
        }
      }
    }
    descendientes.add(excluirCodigo)
    buscarDesc(excluirCodigo)
    return ubicaciones.filter((u) => !descendientes.has(u.codigo_ubicacion))
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const abrirEditar = (u: UbicacionDoc) => {
    setEditando(u)
    setForm({
      codigo_ubicacion: u.codigo_ubicacion,
      nombre_ubicacion: u.nombre_ubicacion,
      alias_ubicacion: u.alias_ubicacion || '',
      descripcion: u.descripcion || '',
      codigo_ubicacion_superior: u.codigo_ubicacion_superior || '',
      ubicacion_habilitada: u.ubicacion_habilitada,
      prompt_insert: (u as unknown as Record<string, unknown>).prompt_insert as string || '',
      prompt_update: (u as unknown as Record<string, unknown>).prompt_update as string || '',
      system_prompt: u.system_prompt || '',
      python_insert: (u as unknown as Record<string, unknown>).python_insert as string || '',
      python_update: (u as unknown as Record<string, unknown>).python_update as string || '',
      javascript: (u as unknown as Record<string, unknown>).javascript as string || '',
      python_editado_manual: ((u as unknown as Record<string, unknown>).python_editado_manual as boolean) ?? false,
      javascript_editado_manual: ((u as unknown as Record<string, unknown>).javascript_editado_manual as boolean) ?? false,
    })
    setTabModal('datos')
    setError('')
    setMd((u as unknown as Record<string, unknown>).md as string || '')
    setMensajeMd(null)
    setModal(true)
  }

  const guardar = async (cerrar: boolean) => {
    if (!editando || !form.nombre_ubicacion.trim()) {
      setError(t('errorNombreObligatorio'))
      return
    }
    setGuardando(true)
    try {
      await ubicacionesDocsApi.actualizar(editando.codigo_ubicacion, {
        nombre_ubicacion: form.nombre_ubicacion,
        alias_ubicacion: form.alias_ubicacion || undefined,
        descripcion: form.descripcion || undefined,
        codigo_ubicacion_superior: form.codigo_ubicacion_superior || undefined,
        ubicacion_habilitada: form.ubicacion_habilitada,
        prompt_insert: form.prompt_insert || undefined,
        prompt_update: form.prompt_update || undefined,
        system_prompt: form.system_prompt || undefined,
        python_insert: form.python_insert || undefined,
        python_update: form.python_update || undefined,
        javascript: form.javascript || undefined,
        python_editado_manual: form.python_editado_manual,
        javascript_editado_manual: form.javascript_editado_manual,
      } as Record<string, unknown>)
      if (cerrar) setModal(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarCambioTipo = async () => {
    if (!confirmarTipo) return
    setCambiandoTipo(true)
    try {
      await ubicacionesDocsApi.cambiarTipo(confirmarTipo.u.codigo_ubicacion, confirmarTipo.nuevoTipo)
      setConfirmarTipo(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
      setConfirmarTipo(null)
    } finally {
      setCambiandoTipo(false)
    }
  }

  const toggleHabilitada = async (u: UbicacionDoc) => {
    try {
      await ubicacionesDocsApi.actualizar(u.codigo_ubicacion, {
        ubicacion_habilitada: !u.ubicacion_habilitada,
      })
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    }
  }

  const abrirConfirmacionEliminar = async (u: UbicacionDoc) => {
    setConfirmacion(u)
    setPreviewEliminar(null)
    try {
      const p = await ubicacionesDocsApi.previewEliminar(u.codigo_ubicacion)
      setPreviewEliminar(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('error'))
    }
  }

  const ejecutarEliminacion = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await ubicacionesDocsApi.eliminar(confirmacion.codigo_ubicacion)
      setConfirmacion(null)
      setPreviewEliminar(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlEliminar'))
      setConfirmacion(null)
      setPreviewEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  // ── Cargar Ubicaciones (escaneo + sincronización) ─────────────────────────
  const iniciarEscaneo = async () => {
    if (!soportaDirectoryPicker()) {
      alert(t('errorBrowserNoSoporta'))
      return
    }
    setEscaneando(true)
    setResultadoSync(null)
    try {
      const resultado = await escanearDirectorio()
      if (!resultado) {
        setEscaneando(false)
        return // usuario canceló
      }
      setDatosEscaneo(resultado)
      setModalCarga(true)
    } catch {
      alert('Error al escanear el directorio.')
    } finally {
      setEscaneando(false)
    }
  }

  const ejecutarSincronizacion = async () => {
    if (!datosEscaneo) return
    setSincronizando(true)
    try {
      const res = await ubicacionesDocsApi.sincronizar({
        directorios: datosEscaneo.directorios,
      })
      setResultadoSync(res)
      cargar()
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al sincronizar ubicaciones.'
        : 'Error al sincronizar ubicaciones.'
      alert(msg)
    } finally {
      setSincronizando(false)
    }
  }

  const cerrarModalCarga = () => {
    setModalCarga(false)
    setDatosEscaneo(null)
    setResultadoSync(null)
  }

  // ── Cargar Ubicación individual (sin hijos) ──────────────────────────────
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false)

  const cargarUbicacionIndividual = async () => {
    if (!soportaDirectoryPicker()) {
      alert(t('errorBrowserNoSoporta'))
      return
    }
    setCargandoUbicacion(true)
    try {
      const resultado = await escanearDirectorioSinHijos()
      if (!resultado) {
        setCargandoUbicacion(false)
        return
      }
      const { directorio } = resultado
      await ubicacionesDocsApi.crear({
        codigo_ubicacion: directorio.codigo_ubicacion,
        codigo_grupo: grupoActivo!,
        nombre_ubicacion: directorio.nombre_ubicacion,
      })
      cargar()
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al crear ubicación.'
        : e instanceof Error ? e.message : 'Error al crear ubicación.'
      alert(msg)
    } finally {
      setCargandoUbicacion(false)
    }
  }

  // ── Preview: calcular diferencias ─────────────────────────────────────────
  // ── Filtrar directorios escaneados: excluir hijos de inhabilitadas ────────
  const filtrarPorInhabilitadas = (directorios: DirectorioEscaneado[]) => {
    const inhabilitadas = new Set(
      ubicaciones.filter((u) => !u.ubicacion_habilitada).map((u) => u.codigo_ubicacion)
    )
    if (inhabilitadas.size === 0) return { filtrados: directorios, excluidos: 0 }

    const padres: Record<string, string | undefined> = {}
    for (const d of directorios) {
      padres[d.codigo_ubicacion] = d.codigo_ubicacion_superior || undefined
    }

    const esDescendienteInhabilitada = (codigo: string): boolean => {
      const visitados = new Set<string>()
      let actual = padres[codigo] || ubicaciones.find((u) => u.codigo_ubicacion === codigo)?.codigo_ubicacion_superior
      while (actual) {
        if (inhabilitadas.has(actual)) return true
        if (visitados.has(actual)) break
        visitados.add(actual)
        actual = padres[actual] || ubicaciones.find((u) => u.codigo_ubicacion === actual)?.codigo_ubicacion_superior || undefined
      }
      return false
    }

    const filtrados = directorios.filter((d) => !esDescendienteInhabilitada(d.codigo_ubicacion))
    return { filtrados, excluidos: directorios.length - filtrados.length }
  }

  const calcularDiferencias = () => {
    if (!datosEscaneo) return { nuevas: 0, aEliminar: 0, sinCambio: 0, excluidas: 0 }
    const { filtrados: dirsFiltrados, excluidos } = filtrarPorInhabilitadas(datosEscaneo.directorios)
    const codigosActuales = new Set(ubicaciones.map((u) => u.codigo_ubicacion))
    const codigosEscaneados = new Set(dirsFiltrados.map((d) => d.codigo_ubicacion))
    const nuevas = dirsFiltrados.filter((d) => !codigosActuales.has(d.codigo_ubicacion)).length
    const aEliminar = ubicaciones.filter((u) => !codigosEscaneados.has(u.codigo_ubicacion)).length
    const sinCambio = dirsFiltrados.length - nuevas
    return { nuevas, aEliminar, sinCambio, excluidas: excluidos }
  }

  const filtrados = ubicaciones

  // ── Cargar Documentos (sección inferior) ──────────────────────────────────
  const [cdNiveles, setCdNiveles] = useState(5)
  const [cdDirHandle, setCdDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [cdEscaneando, setCdEscaneando] = useState(false)
  const [cdDatos, setCdDatos] = useState<{
    nombreRaiz: string
    archivos: ArchivoEscaneado[]
    carpetasSinMatch: string[]
    archivosConMatch: ArchivoEscaneado[]
    archivosEnNoHabilitadas: ArchivoEscaneado[]
  } | null>(null)
  const [cdCargando, setCdCargando] = useState(false)
  const [cdResultado, setCdResultado] = useState<{ insertados: number; actualizados: number; total: number } | null>(null)
  const [cdBusqueda, setCdBusqueda] = useState('')

  useEffect(() => {
    const init = async () => {
      const nivelParam = await parametrosApi.obtenerValor('DOCUMENTOS', 'NIVELES_DIRECTORIO').catch(() => null)
      if (nivelParam?.valor != null) {
        const n = parseInt(nivelParam.valor, 10)
        if (!isNaN(n) && n >= 0 && n <= 5) setCdNiveles(n)
      }
      const h = await idbGetHandle()
      if (!h) return
      try {
        const perm = await (h as unknown as { queryPermission: (opts: { mode: string }) => Promise<PermissionState> }).queryPermission({ mode: 'read' })
        if (perm === 'granted') setCdDirHandle(h)
      } catch { /* ignore */ }
    }
    init()
  }, [])

  const cdClasificar = useCallback((
    scan: Awaited<ReturnType<typeof escanearArchivosDirectorio>> & object,
    ubicacionesAct: UbicacionDoc[],
  ) => {
    const rutaRaizFS = `/${scan.nombreRaiz}`
    const ubicacionRaiz = ubicacionesAct.find(
      (u) => u.ruta_completa?.endsWith(`/${scan.nombreRaiz}`) || u.ruta_completa === `/${scan.nombreRaiz}`
    )
    let prefijoRemap = ''
    if (ubicacionRaiz?.ruta_completa) {
      prefijoRemap = ubicacionRaiz.ruta_completa.slice(0, ubicacionRaiz.ruta_completa.length - rutaRaizFS.length)
    }
    const remapear = (rutaFS: string) => prefijoRemap + rutaFS
    const rutasHabilitadas = new Set<string>()
    const rutasNoHabilitadas = new Set<string>()
    const todasRutasBD = new Set<string>()
    for (const u of ubicacionesAct) {
      if (u.ruta_completa) {
        todasRutasBD.add(u.ruta_completa)
        if (u.ubicacion_habilitada) rutasHabilitadas.add(u.ruta_completa)
        else rutasNoHabilitadas.add(u.ruta_completa)
      }
    }
    const archivosConMatch: ArchivoEscaneado[] = []
    const archivosEnNoHabilitadas: ArchivoEscaneado[] = []
    for (const archivo of scan.archivos) {
      const rutaBD = remapear(archivo.ruta_directorio)
      if (rutasHabilitadas.has(rutaBD)) {
        archivosConMatch.push({ ...archivo, ruta_directorio: rutaBD, ruta_completa: remapear(archivo.ruta_completa) })
      } else if (rutasNoHabilitadas.has(rutaBD)) {
        archivosEnNoHabilitadas.push(archivo)
      }
    }
    const carpetasSinMatch = scan.rutasEscaneadas.map(remapear).filter((ruta) => !todasRutasBD.has(ruta))
    return { nombreRaiz: scan.nombreRaiz, archivos: scan.archivos, carpetasSinMatch, archivosConMatch, archivosEnNoHabilitadas }
  }, [])

  const cdEjecutarEscaneo = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setCdEscaneando(true)
    setCdResultado(null)
    setCdDatos(null)
    setCdBusqueda('')
    try {
      const scan = await escanearArchivosDirectorio(handle, cdNiveles)
      if (!scan) return
      setUbicaciones((prev) => {
        setCdDatos(cdClasificar(scan, prev))
        return prev
      })
    } catch {
      alert('Error al escanear el directorio.')
    } finally {
      setCdEscaneando(false)
    }
  }, [cdNiveles, cdClasificar])

  const cdSeleccionarDirectorio = async () => {
    if (!soportaDirectoryPicker()) {
      alert('Su navegador no soporta la selección de directorios. Use Chrome, Edge o Safari.')
      return
    }
    try {
      const opts: Record<string, unknown> = { mode: 'read', id: 'cab-procesar-docs' }
      if (cdDirHandle) opts.startIn = cdDirHandle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showDirectoryPicker(opts)
      setCdDirHandle(handle)
      idbSetHandle(handle)
      await cdEjecutarEscaneo(handle)
    } catch { /* cancelado */ }
  }

  const cdEjecutarCarga = async () => {
    if (!cdDatos) return
    setCdCargando(true)
    try {
      const res = await cargaDocumentosApi.cargar({
        archivos: cdDatos.archivosConMatch.map((a) => ({
          nombre: a.nombre,
          ruta_completa: a.ruta_completa,
          ruta_directorio: a.ruta_directorio,
          tamano_kb: a.tamano_kb,
          fecha_modificacion: a.fecha_modificacion,
        })),
      })
      setCdResultado(res)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al cargar documentos.'
        : 'Error al cargar documentos.'
      alert(msg)
    } finally {
      setCdCargando(false)
    }
  }

  const cdResetear = () => {
    setCdDatos(null)
    setCdResultado(null)
    setCdBusqueda('')
  }

  const cdUbicacionesHabilitadas = ubicaciones.filter((u) => u.ubicacion_habilitada)
  const cdCarpetaRaiz = ubicaciones.length > 0
    ? ubicaciones.reduce((min, u) => (u.nivel ?? 99) < (min.nivel ?? 99) ? u : min, ubicaciones[0])
    : null
  const cdArchivosFiltrados = cdDatos
    ? cdBusqueda
      ? cdDatos.archivosConMatch.filter((a) =>
          a.nombre.toLowerCase().includes(cdBusqueda.toLowerCase()) ||
          a.ruta_directorio.toLowerCase().includes(cdBusqueda.toLowerCase())
        )
      : cdDatos.archivosConMatch
    : []

  // ── Render nodos jerárquicos ──────────────────────────────────────────────
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

          <div className="flex-1 min-w-0 truncate" title={`${u.nombre_ubicacion} (${u.codigo_ubicacion})`}>
            <span className="font-medium text-xs">{u.nombre_ubicacion}</span>
            <span className="text-xs text-texto-muted ml-2">({u.codigo_ubicacion})</span>
          </div>

          <span className="text-xs text-texto-muted truncate max-w-[300px] shrink-0 hidden lg:block" title={u.ruta_completa || ''}>
            {u.ruta_completa || ''}
          </span>

          <Insignia variante={u.tipo_ubicacion === 'AREA' ? 'primario' : 'advertencia'}>
            {u.tipo_ubicacion}
          </Insignia>

          <Insignia variante={u.ubicacion_habilitada ? 'exito' : 'advertencia'}>
            {u.ubicacion_habilitada ? t('habilitada') : t('inhabilitada')}
          </Insignia>

          <Insignia variante='exito'>
            Activo
          </Insignia>

          <div className="flex items-center gap-0.5 shrink-0 transition-opacity">
            <button
              onClick={() => toggleHabilitada(u)}
              className={`p-1.5 rounded-lg transition-colors ${
                u.ubicacion_habilitada
                  ? 'hover:bg-amber-50 text-texto-muted hover:text-amber-600'
                  : 'hover:bg-green-50 text-texto-muted hover:text-green-600'
              }`}
              title={u.ubicacion_habilitada ? 'Inhabilitar (incluye hijos)' : 'Habilitar (incluye hijos)'}
            >
              {u.ubicacion_habilitada ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            </button>
            <button
              onClick={() => setConfirmarTipo({ u, nuevoTipo: u.tipo_ubicacion === 'AREA' ? 'CONTENIDO' : 'AREA' })}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title={`Cambiar a ${u.tipo_ubicacion === 'AREA' ? 'CONTENIDO' : 'AREA'}`}
            >
              <Shuffle size={14} />
            </button>
            <button
              onClick={() => abrirEditar(u)}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => abrirConfirmacionEliminar(u)}
              className="p-1.5 rounded-lg hover:bg-orange-50 text-texto-muted hover:text-orange-500 transition-colors"
              title="Quitar de la BD"
            >
              <XCircle size={14} />
            </button>
          </div>
        </div>

        {expandido &&
          ubicaciones
            .filter((h) => h.codigo_ubicacion_superior === u.codigo_ubicacion)
            .sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
            .map((h) => renderNodo(h))}
      </div>
    )
  }

  const raices = filtrados
    .filter((u) => !u.codigo_ubicacion_superior)
    .sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))

  const diff = datosEscaneo ? calcularDiferencias() : null

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      {/* Header */}
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap items-start">
          <div className="flex flex-col items-center">
            <Boton variante="contorno" onClick={cargarUbicacionIndividual} cargando={cargandoUbicacion}>
              <FolderPlus size={16} />
              {t('cargarUbicacion')}
            </Boton>
            <span className="text-[11px] text-texto-muted mt-0.5">solo un directorio</span>
          </div>
          <div className="flex flex-col items-center">
            <Boton variante="contorno" onClick={iniciarEscaneo} cargando={escaneando}>
              <FolderInput size={16} />
              {t('cargarDesdeDirectorioTitulo')}
            </Boton>
            <span className="text-[11px] text-texto-muted mt-0.5">y todos los sub-directorios</span>
          </div>
          <Boton variante="contorno" className="h-[38px]" onClick={expandirTodos} disabled={ubicaciones.length === 0}>
            {t('expandirTodo')}
          </Boton>
          <Boton variante="contorno" className="h-[38px]" onClick={colapsarTodos} disabled={ubicaciones.length === 0}>
            {t('colapsarTodo')}
          </Boton>
          <Boton
            variante="contorno"
            className="h-[38px]"
            onClick={() =>
              exportarExcel(
                filtrados as unknown as Record<string, unknown>[],
                [
                  { titulo: 'Código', campo: 'codigo_ubicacion' },
                  { titulo: 'Nombre', campo: 'nombre_ubicacion' },
                  { titulo: 'Ruta', campo: 'ruta_completa' },
                  { titulo: 'Padre', campo: 'codigo_ubicacion_superior' },
                  { titulo: 'Nivel', campo: 'nivel' },
                  { titulo: 'Habilitada', campo: 'ubicacion_habilitada', formato: (v: unknown) => (v ? 'Sí' : 'No') },
                  { titulo: 'Habilitada', campo: 'ubicacion_habilitada', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
                ],
                'ubicaciones-docs'
              )
            }
            disabled={filtrados.length === 0}
          >
            <Download size={15} />
            Excel
          </Boton>
        </div>
      </div>

      {/* Árbol jerárquico */}
      <div className="border border-borde rounded-lg bg-fondo-tarjeta">
        {cargando ? (
          <div className="py-8 text-center text-texto-muted">{tc('cargando')}</div>
        ) : raices.length === 0 ? (
          <div className="py-8 text-center text-texto-muted flex flex-col items-center gap-2">
            <FolderTree size={32} className="text-texto-muted/50" />
            <p>{t('sinUbicaciones')}</p>
          </div>
        ) : (
          <div className="py-2">
            {raices.map((u) => renderNodo(u))}
          </div>
        )}
      </div>

      {/* Modal CRUD */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={editando ? t('editarTitulo', { nombre: editando.nombre_ubicacion }) : ''}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Tabs — siempre en edición */}
          {editando && (
            <div className="flex border-b border-borde">
              {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabModal(tab)}
                  className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${
                    tabModal === tab
                      ? 'border-b-2 border-primario text-primario'
                      : 'text-texto-muted hover:text-texto'
                  }`}
                >
                  {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : tab === 'programacion_update' ? 'Prog. Update' : '.md'}
                </button>
              ))}
            </div>
          )}

          {/* Tab Datos */}
          {tabModal === 'datos' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                etiqueta={t('etiquetaAlias')}
                value={form.alias_ubicacion}
                onChange={(e) => setForm({ ...form, alias_ubicacion: e.target.value })}
                placeholder={t('placeholderAlias')}
              />

              {editando && (
                <div>
                  <label className="block text-sm font-medium text-texto mb-1.5">Tipo</label>
                  <select
                    className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                    value={editando.tipo_ubicacion}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value as 'AREA' | 'CONTENIDO'
                      if (nuevoTipo !== editando.tipo_ubicacion) {
                        setConfirmarTipo({ u: editando, nuevoTipo })
                      }
                    }}
                  >
                    <option value="AREA">AREA</option>
                    <option value="CONTENIDO">CONTENIDO</option>
                  </select>
                </div>
              )}

              <div className="col-span-2">
                <Textarea
                  etiqueta={t('etiquetaDescripcion')}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder={t('placeholderDescripcion')}
                  rows={2}
                />
              </div>

              {editando && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ubicacion_habilitada}
                    onChange={(e) => setForm({ ...form, ubicacion_habilitada: e.target.checked })}
                    className="w-4 h-4 rounded border-borde text-primario focus:ring-primario"
                  />
                  <span className="text-sm font-medium text-texto">{t('etiquetaHabilitada')}</span>
                  <span className="text-xs text-texto-muted">{t('habilitadaHint')}</span>
                </label>
              )}
              {editando && (
                <Input etiqueta={t('etiquetaCodigo')} value={form.codigo_ubicacion} disabled readOnly />
              )}
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModal === 'system_prompt' && editando && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editando.codigo_ubicacion}
              campos={{
                prompt_insert: form.prompt_insert,
                prompt_update: form.prompt_update,
                system_prompt: form.system_prompt,
                python_insert: form.python_insert,
                python_update: form.python_update,
                javascript: form.javascript,
                python_editado_manual: form.python_editado_manual,
                javascript_editado_manual: form.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {/* Tab Programación Insert */}
          {tabModal === 'programacion_insert' && editando && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editando.codigo_ubicacion}
              campos={{
                prompt_insert: form.prompt_insert,
                prompt_update: form.prompt_update,
                system_prompt: form.system_prompt,
                python_insert: form.python_insert,
                python_update: form.python_update,
                javascript: form.javascript,
                python_editado_manual: form.python_editado_manual,
                javascript_editado_manual: form.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptUpdate={false}
              mostrarPythonUpdate={false}
            />
          )}
          {/* Tab Programación Update */}
          {tabModal === 'programacion_update' && editando && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editando.codigo_ubicacion}
              campos={{
                prompt_insert: form.prompt_insert,
                prompt_update: form.prompt_update,
                system_prompt: form.system_prompt,
                python_insert: form.python_insert,
                python_update: form.python_update,
                javascript: form.javascript,
                python_editado_manual: form.python_editado_manual,
                javascript_editado_manual: form.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptInsert={false}
              mostrarPythonInsert={false}
            />
          )}

          {/* Tab .md */}
          {editando && tabModal === 'md' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={md}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMd && (
                <p className={`text-xs px-1 ${mensajeMd.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMd.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMd(true); setMensajeMd(null)
                      try {
                        const r = await ubicacionesDocsApi.generarMd(editando.codigo_ubicacion)
                        setMd(r.md)
                        setMensajeMd({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMd(false) }
                    }}
                    cargando={generandoMd}
                    disabled={generandoMd || sincronizandoMd}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMd(true); setMensajeMd(null)
                      try {
                        const r = await promptsApi.sincronizarFila('ubicaciones_docs', 'codigo_ubicacion', editando.codigo_ubicacion)
                        setMensajeMd({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMd(false) }
                    }}
                    cargando={sincronizandoMd}
                    disabled={generandoMd || sincronizandoMd || !md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModal(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {tabModal !== 'md' && (
          <PieBotonesModal
            editando={!!editando}
            onGuardar={() => guardar(false)}
            onGuardarYSalir={() => guardar(true)}
            onCerrar={() => setModal(false)}
            cargando={guardando}
            botonesIzquierda={(tabModal === 'system_prompt' || tabModal === 'programacion_insert' || tabModal === 'programacion_update') && editando ? (
              <PieBotonesPrompts
                tabla="ubicaciones_docs"
                pkColumna="codigo_ubicacion"
                pkValor={editando.codigo_ubicacion}
                promptInsert={form.prompt_insert || undefined}
                promptUpdate={form.prompt_update || undefined}
                modo={tabModal === 'programacion_update' ? 'update' : 'insert'}
              />
            ) : undefined}
          />
          )}
        </div>
      </Modal>

      {/* Modal Confirmar — Hard delete cascade */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => { setConfirmacion(null); setPreviewEliminar(null) }}
        alConfirmar={ejecutarEliminacion}
        titulo={t('eliminarTitulo')}
        mensaje={
          confirmacion
            ? (previewEliminar
                ? t('eliminarConfirm', {
                    nombre: confirmacion.nombre_ubicacion,
                    ubicaciones: previewEliminar.ubicaciones,
                    documentosAfectados: previewEliminar.documentos_afectados,
                    documentosEliminar: previewEliminar.documentos_a_eliminar,
                  })
                : t('calculandoImpacto', { nombre: confirmacion.nombre_ubicacion }))
            : ''
        }
        textoConfirmar={tc('eliminar')}
        cargando={eliminando || !previewEliminar}
      />

      {/* Modal Confirmar Cambio de Tipo */}
      <ModalConfirmar
        abierto={!!confirmarTipo}
        alCerrar={() => setConfirmarTipo(null)}
        alConfirmar={ejecutarCambioTipo}
        titulo={confirmarTipo ? t('cambiarTipoTitulo', { tipo: confirmarTipo.nuevoTipo }) : ''}
        mensaje={
          confirmarTipo
            ? t('cambiarTipoConfirm', { nombre: confirmarTipo.u.nombre_ubicacion, nuevoTipo: confirmarTipo.nuevoTipo })
            : ''
        }
        textoConfirmar={tc('guardar')}
        cargando={cambiandoTipo}
      />

      {/* ── Sección Cargar Documentos ─────────────────────────────────────── */}
      <div className="border-t border-borde pt-6 flex flex-col gap-4">
        <div>
          <h3 className="modal-heading">{tcd('titulo')}</h3>
          <p className="text-sm text-texto-muted mt-1">{tcd('subtitulo')}</p>
        </div>

        {/* Info ubicaciones habilitadas */}
        <div className="border border-borde rounded-lg bg-fondo-tarjeta p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Folder size={20} className="text-primario shrink-0" />
            <div>
              <p className="text-sm font-medium text-texto">
                {cargando ? tc('cargando') : tcd('ubicacionesHabilitadas', { n: cdUbicacionesHabilitadas.length })}
              </p>
              <p className="text-xs text-texto-muted">
                {!cargando && ubicaciones.length > 0
                  ? tcd('deTotales', { n: ubicaciones.length })
                  : tcd('configUbicaciones')}
              </p>
            </div>
          </div>
          {!cargando && cdUbicacionesHabilitadas.length > 0 && (
            <Insignia variante="exito">{tcd('activas', { n: cdUbicacionesHabilitadas.length })}</Insignia>
          )}
        </div>

        {/* Selector de directorio */}
        {!cdDatos && !cdResultado && (
          <div className="border-2 border-dashed border-borde rounded-lg p-8 text-center flex flex-col items-center gap-4">
            <Upload size={48} className="text-texto-muted/50" />
            <div>
              <p className="text-texto mb-1">{tcd('seleccionarDirectorioTitulo')}</p>
              <p className="text-sm text-texto-muted">{tcd('seleccionarDirectorioDesc')}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <Boton
                variante="primario"
                onClick={cdSeleccionarDirectorio}
                disabled={cdUbicacionesHabilitadas.length === 0 || cdEscaneando}
              >
                {cdEscaneando
                  ? <><Loader2 size={16} className="animate-spin" />{tcd('escaneando')}</>
                  : <><FolderOpen size={16} />{cdDirHandle ? `📂 ${cdDirHandle.name}` : tcd('seleccionarDirectorioBtn')}</>
                }
              </Boton>
              {cdDirHandle && !cdEscaneando && (
                <Boton variante="contorno" onClick={() => cdEjecutarEscaneo(cdDirHandle!)}>
                  {tcd('reEscanear')}
                </Boton>
              )}
            </div>
            <p className="text-xs text-texto-muted">
              {cdCarpetaRaiz?.ruta_completa
                ? <>{tcd('seleccionarCarpetaRaiz')} <strong className="text-texto">{cdCarpetaRaiz.ruta_completa.split('/').filter(Boolean)[0] ?? cdCarpetaRaiz.ruta_completa}</strong> {tcd('noSubcarpetas')} · </>
                : null}
              {cdNiveles === 0 ? tcd('soloRaiz') : tcd('hastaXNiveles', { n: cdNiveles })}
              {' '}· {tcd('configNiveles')}
            </p>
          </div>
        )}

        {/* Preview */}
        {cdDatos && !cdResultado && (
          <div className="flex flex-col gap-4">
            <div className="bg-fondo rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen size={24} className="text-primario shrink-0" />
                <div>
                  <p className="font-medium text-texto">{cdDatos.nombreRaiz}</p>
                  <p className="text-sm text-texto-muted">
                    {tcd('xArchivosEncontrados', { n: cdDatos.archivos.length })}
                    {' '}· {cdNiveles === 0 ? tcd('soloRaiz') : tcd('hastaXNiveles', { n: cdNiveles })}
                  </p>
                </div>
              </div>
              <Boton variante="contorno" tamano="sm" onClick={cdSeleccionarDirectorio} disabled={cdEscaneando}>
                <FolderOpen size={14} />{tcd('cambiar')}
              </Boton>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="border border-borde rounded-lg p-3 text-center">
                <p className="stat-number text-green-600">{cdDatos.archivosConMatch.length}</p>
                <p className="text-xs text-texto-muted">{tcd('aCargar')}</p>
              </div>
              <div className="border border-borde rounded-lg p-3 text-center">
                <p className="stat-number text-amber-600">{cdDatos.archivosEnNoHabilitadas.length}</p>
                <p className="text-xs text-texto-muted">{tcd('enInhabilitadas')}</p>
              </div>
              <div className="border border-borde rounded-lg p-3 text-center">
                <p className="stat-number text-texto-muted">
                  {cdDatos.archivos.length - cdDatos.archivosConMatch.length - cdDatos.archivosEnNoHabilitadas.length}
                </p>
                <p className="text-xs text-texto-muted">{tcd('sinUbicacion')}</p>
              </div>
            </div>

            {cdDatos.carpetasSinMatch.length > 0 && (
              <details className="bg-amber-50 border border-amber-200 rounded-lg">
                <summary className="px-4 py-3 cursor-pointer flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span className="text-sm font-medium text-amber-800">
                    {tcd('carpetasSinMatch', { n: cdDatos.carpetasSinMatch.length })}
                  </span>
                </summary>
                <div className="px-4 pb-3 max-h-[150px] overflow-y-auto border-t border-amber-200 pt-2">
                  {cdDatos.carpetasSinMatch.map((ruta) => (
                    <p key={ruta} className="text-xs text-amber-700 py-0.5">{ruta}</p>
                  ))}
                </div>
              </details>
            )}

            {cdDatos.archivosConMatch.length > 0 && (
              <div className="border border-borde rounded-lg">
                <div className="px-3 py-2 border-b border-borde bg-fondo rounded-t-lg">
                  <Input
                    placeholder={tcd('filtrarArchivos')}
                    value={cdBusqueda}
                    onChange={(e) => setCdBusqueda(e.target.value)}
                    icono={<Search size={14} />}
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <div className="py-1">
                    {cdArchivosFiltrados.slice(0, 30).map((a, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-fondo">
                        <FileText size={14} className="text-texto-muted shrink-0" />
                        <span className="flex-1 truncate">{a.nombre}</span>
                        <span className="text-xs text-texto-muted shrink-0">
                          {a.tamano_kb < 1024 ? `${a.tamano_kb.toFixed(1)} KB` : `${(a.tamano_kb / 1024).toFixed(1)} MB`}
                        </span>
                        <span className="text-xs text-texto-muted truncate max-w-[200px] hidden lg:block">
                          {a.ruta_directorio}
                        </span>
                      </div>
                    ))}
                    {cdArchivosFiltrados.length > 30 && (
                      <p className="px-4 py-2 text-xs text-texto-muted text-center">
                        {tcd('yMasArchivos', { n: cdArchivosFiltrados.length - 30 })}
                      </p>
                    )}
                    {cdArchivosFiltrados.length === 0 && cdBusqueda && (
                      <p className="px-4 py-3 text-sm text-texto-muted text-center">
                        {tcd('sinResultadosFiltro', { filtro: cdBusqueda })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-borde bg-fondo rounded-b-lg text-xs text-texto-muted">
                  {cdBusqueda
                    ? tcd('xDenArchivos', { filtrados: cdArchivosFiltrados.length, total: cdDatos.archivosConMatch.length })
                    : tcd('xArchivosACargar', { n: cdDatos.archivosConMatch.length })}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Boton variante="contorno" onClick={cdResetear}>{tc('cancelar')}</Boton>
              <Boton
                variante="primario"
                onClick={cdEjecutarCarga}
                cargando={cdCargando}
                disabled={cdDatos.archivosConMatch.length === 0}
              >
                <Upload size={15} />
                {tcd('cargarNDocumentos', { n: cdDatos.archivosConMatch.length })}
              </Boton>
            </div>
          </div>
        )}

        {/* Resultado */}
        {cdResultado && (
          <div className="flex flex-col gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
              <p className="text-lg font-medium text-green-800">{tcd('cargaCompletada')}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-borde rounded-lg p-3 text-center">
                <p className="stat-number text-green-600">{cdResultado.insertados}</p>
                <p className="text-xs text-texto-muted">{tcd('nuevos')}</p>
              </div>
              <div className="border border-borde rounded-lg p-3 text-center">
                <p className="stat-number text-primario">{cdResultado.actualizados}</p>
                <p className="text-xs text-texto-muted">{tcd('actualizados')}</p>
              </div>
              <div className="border border-borde rounded-lg p-3 text-center">
                <p className="stat-number text-texto-muted">{cdResultado.total}</p>
                <p className="text-xs text-texto-muted">{tcd('totalProcesados')}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Boton variante="primario" onClick={cdResetear}>{tcd('nuevaCarga')}</Boton>
            </div>
          </div>
        )}
      </div>

      {/* Modal Cargar Ubicaciones */}
      <Modal
        abierto={modalCarga}
        alCerrar={cerrarModalCarga}
        titulo={t('cargarDesdeDirectorioTitulo')}
      >
        <div className="flex flex-col gap-4 min-w-[500px]">
          {/* Pre-sincronización: preview */}
          {!resultadoSync && datosEscaneo && (
            <>
              <div className="bg-fondo rounded-lg p-4 flex items-center gap-3">
                <FolderOpen size={24} className="text-primario shrink-0" />
                <div>
                  <p className="font-medium text-texto">{datosEscaneo.nombreRaiz}</p>
                  <p className="text-sm text-texto-muted">
                    {datosEscaneo.directorios.length} directorio{datosEscaneo.directorios.length !== 1 ? 's' : ''} encontrado{datosEscaneo.directorios.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Resumen de cambios */}
              {diff && (
                <div className={`grid ${diff.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="stat-number text-green-600">{diff.nuevas}</p>
                    <p className="text-xs text-texto-muted">Nuevas</p>
                  </div>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="stat-number text-red-600">{diff.aEliminar}</p>
                    <p className="text-xs text-texto-muted">A eliminar</p>
                  </div>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="stat-number text-texto-muted">{diff.sinCambio}</p>
                    <p className="text-xs text-texto-muted">Sin cambio</p>
                  </div>
                  {diff.excluidas > 0 && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center">
                      <p className="stat-number text-amber-600">{diff.excluidas}</p>
                      <p className="text-xs text-amber-700">Excluidas</p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview del árbol escaneado */}
              <div className="border border-borde rounded-lg max-h-[300px] overflow-y-auto">
                <div className="py-1">
                  {(() => {
                    const { filtrados: dirsFiltrados } = filtrarPorInhabilitadas(datosEscaneo.directorios)
                    const codsFiltrados = new Set(dirsFiltrados.map((d) => d.codigo_ubicacion))
                    return datosEscaneo.directorios.slice(0, 30).map((d) => {
                      const esNueva = !ubicaciones.some((u) => u.codigo_ubicacion === d.codigo_ubicacion)
                      const esExcluida = !codsFiltrados.has(d.codigo_ubicacion)
                      return (
                        <div
                          key={d.codigo_ubicacion}
                          className={`flex items-center gap-2 px-3 py-1.5 text-sm ${esExcluida ? 'opacity-40' : ''}`}
                          style={{ paddingLeft: `${d.nivel * 20 + 12}px` }}
                        >
                          <Folder size={14} className="text-texto-muted shrink-0" />
                          <span className={esExcluida ? 'text-texto-muted line-through' : esNueva ? 'text-green-700 font-medium' : 'text-texto'}>
                            {d.nombre_ubicacion}
                          </span>
                          {esExcluida && (
                            <Insignia variante="advertencia">Excluida</Insignia>
                          )}
                          {!esExcluida && esNueva && (
                            <Insignia variante="exito">Nueva</Insignia>
                          )}
                        </div>
                      )
                    })
                  })()}
                  {datosEscaneo.directorios.length > 30 && (
                    <p className="px-4 py-2 text-xs text-texto-muted text-center">
                      ...y {datosEscaneo.directorios.length - 30} directorio(s) más
                    </p>
                  )}
                </div>
              </div>

              {diff && diff.excluidas > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-700">
                    {diff.excluidas} directorio(s) excluido(s) por estar bajo una ubicación inhabilitada.
                  </p>
                </div>
              )}

              {diff && diff.aEliminar > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700">
                    Se eliminarán {diff.aEliminar} ubicación(es) que ya no existen en el directorio seleccionado.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={cerrarModalCarga}>
                  {tc('cancelar')}
                </Boton>
                <Boton variante="primario" onClick={ejecutarSincronizacion} cargando={sincronizando}>
                  <RefreshCw size={15} />
                  Sincronizar
                </Boton>
              </div>
            </>
          )}

          {/* Post-sincronización: resultado */}
          {resultadoSync && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-lg font-medium text-green-800">Sincronización completada</p>
              </div>

              <div className={`grid ${resultadoSync.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-green-600">{resultadoSync.insertadas}</p>
                  <p className="text-xs text-texto-muted">Insertadas</p>
                </div>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-red-600">{resultadoSync.eliminadas}</p>
                  <p className="text-xs text-texto-muted">Eliminadas</p>
                </div>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-primario">{resultadoSync.actualizadas}</p>
                  <p className="text-xs text-texto-muted">Actualizadas</p>
                </div>
                {resultadoSync.excluidas > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center">
                    <p className="stat-number text-amber-600">{resultadoSync.excluidas}</p>
                    <p className="text-xs text-amber-700">Excluidas</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Boton variante="primario" onClick={cerrarModalCarga}>
                  {tc('cerrar')}
                </Boton>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
