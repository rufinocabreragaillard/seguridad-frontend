'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef, useCallback, useMemo, KeyboardEvent } from 'react'
import { Plus, Trash2, Send, MessageCircle, FolderOpen, Search, FileText, X, RefreshCw, ArrowUp, FolderPlus, Sparkles, ChevronRight, ChevronDown, Info, Eye, Copy, Zap, Download, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { chatApi, documentosApi, ubicacionesDocsApi, espaciosTrabajoApi } from '@/lib/api'
import { abrirDocumento, descargarDocumento } from '@/lib/abrir-documento'
import { useAuth } from '@/context/AuthContext'
import type { ChatConversacion, ChatMensaje, Documento, UbicacionDoc, EspacioTrabajo, TipoEspacio, AlcanceEspacio, DocumentoEspacio } from '@/lib/tipos'

const CODIGO_FUNCION = 'CHAT-USUARIO'

function etiquetaActividadTool(nombreTool: string, t: (k: string) => string): string {
  const n = (nombreTool || '').toLowerCase()
  const fb = (clave: string, defecto: string) => {
    try {
      const txt = t(clave)
      if (txt && !txt.startsWith('chat.')) return txt
    } catch { /* */ }
    return defecto
  }
  if (n.includes('buscar_documentos')) return fb('buscandoDocumentos', 'Buscando en tus documentos…')
  if (n.includes('consultar_documentos')) return fb('consultandoDocumentos', 'Consultando documentos…')
  if (n.includes('buscar_funciones') || n.includes('listar_pantallas')) return fb('buscandoPantallas', 'Buscando pantallas disponibles…')
  if (n.includes('consultar_parametros')) return fb('consultandoParametros', 'Consultando parámetros…')
  if (n.includes('consultar_usuarios')) return fb('consultandoUsuarios', 'Consultando usuarios…')
  if (n.includes('consultar_roles')) return fb('consultandoRoles', 'Consultando roles y permisos…')
  if (n.includes('consultar_auditoria')) return fb('consultandoAuditoria', 'Revisando auditoría…')
  if (n.includes('consultar_aplicaciones')) return fb('consultandoApps', 'Consultando aplicaciones…')
  if (n.includes('como_funciona_seguridad')) return fb('leyendoGuia', 'Leyendo guía de seguridad…')
  if (n.includes('llamar_api')) return fb('ejecutandoAccion', 'Ejecutando acción en el sistema…')
  if (n.includes('listar_apis')) return fb('listandoApis', 'Buscando endpoints disponibles…')
  if (n.includes('entregar_mensaje')) return fb('preparandoMensaje', 'Preparando mensajes pendientes…')
  return fb('consultandoSistema', 'Consultando el sistema…')
}

function iconoEstado(estado: string | null | undefined) {
  if (!estado) return 'neutro' as const
  if (estado === 'VECTORIZADO') return 'exito' as const
  if (estado === 'CHUNKEADO') return 'exito' as const
  if (estado === 'ESCANEADO') return 'advertencia' as const
  if (estado === 'METADATA') return 'neutro' as const
  return 'neutro' as const
}

function iconoEstadoArea(estado: string | null | undefined) {
  if (!estado) return 'neutro' as const
  if (estado === 'ABIERTO') return 'exito' as const
  if (estado === 'EN_PROCESO') return 'advertencia' as const
  if (estado === 'CERRADO') return 'neutro' as const
  if (estado === 'CANCELADO') return 'error' as const
  return 'neutro' as const
}

function iconoEstadoCola(estado: string | null | undefined) {
  if (!estado) return 'neutro' as const
  if (estado === 'COMPLETADO') return 'exito' as const
  if (estado === 'EN_PROCESO') return 'advertencia' as const
  if (estado === 'PENDIENTE') return 'neutro' as const
  if (estado === 'ERROR') return 'error' as const
  return 'neutro' as const
}

export default function PaginaChatUsuario() {
  const { grupoActivo, usuario } = useAuth()
  const codigoUsuario = usuario?.codigo_usuario ?? ''
  const t = useTranslations('chat')

  // ── Tabs de la página ──
  const [tabPagina, setTabPagina] = useState<'chat' | 'documentos'>('chat')

  const tabStyle = (activo: boolean) =>
    `pb-3 text-sm font-medium border-b-2 transition ${
      activo
        ? 'border-primario text-primario'
        : 'border-transparent text-texto-muted hover:text-texto'
    }`

  // ══════════════════════════════════════════
  // TAB 1 — Chat (lógica original completa)
  // ══════════════════════════════════════════
  const [conversaciones, setConversaciones] = useState<ChatConversacion[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState('')
  const [convActivaId, setConvActivaId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [cargandoConv, setCargandoConv] = useState(false)
  const [errorConv, setErrorConv] = useState('')
  const [textoInput, setTextoInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [respuestaEnCurso, setRespuestaEnCurso] = useState('')
  const [actividad, setActividad] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Preview del system_prompt (debug, solo super-admin) ──
  const [modalSpAbierto, setModalSpAbierto] = useState(false)
  const [cargandoSp, setCargandoSp] = useState(false)
  const [errorSp, setErrorSp] = useState('')
  const [spInfo, setSpInfo] = useState<{
    system_prompt: string
    n_caracteres: number
    n_funciones_disponibles: number
    n_funciones_con_permisos: number
  } | null>(null)
  const [spCopiado, setSpCopiado] = useState(false)
  const esSuperAdmin = grupoActivo === 'ADMIN'

  // ── Modal visor de documento (desde links del chat) ──
  const [modalDocCodigo, setModalDocCodigo] = useState<number | null>(null)

  const verSystemPrompt = async () => {
    if (convActivaId == null) return
    setModalSpAbierto(true)
    setCargandoSp(true)
    setErrorSp('')
    setSpInfo(null)
    setSpCopiado(false)
    try {
      const data = await chatApi.previewSystemPrompt(convActivaId)
      setSpInfo(data)
    } catch (e: unknown) {
      let msg = 'Error al cargar el system prompt'
      if (e && typeof e === 'object' && 'response' in e) {
        const r = (e as { response?: { data?: { detail?: string } } }).response
        msg = r?.data?.detail || msg
      } else if (e instanceof Error) {
        msg = e.message
      }
      setErrorSp(msg)
    } finally {
      setCargandoSp(false)
    }
  }

  const copiarSystemPrompt = async () => {
    if (!spInfo?.system_prompt) return
    try {
      await navigator.clipboard.writeText(spInfo.system_prompt)
      setSpCopiado(true)
      setTimeout(() => setSpCopiado(false), 2000)
    } catch { /* */ }
  }

  const cargarLista = useCallback(async () => {
    setCargandoLista(true)
    setErrorLista('')
    try {
      const data = await chatApi.listarConversaciones({ codigo_funcion: CODIGO_FUNCION })
      setConversaciones(data)
      if (data.length > 0 && convActivaId == null) {
        setConvActivaId(data[0].id_conversacion)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar conversaciones'
      setErrorLista(msg)
    } finally {
      setCargandoLista(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cargarLista()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  useEffect(() => {
    setConvActivaId(null)
    setMensajes([])
  }, [grupoActivo])

  const cargarConversacion = useCallback(async (id: number) => {
    setCargandoConv(true)
    setErrorConv('')
    try {
      const data = await chatApi.obtenerConversacion(id)
      setMensajes(data.mensajes || [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar conversación'
      setErrorConv(msg)
    } finally {
      setCargandoConv(false)
    }
  }, [])

  useEffect(() => {
    if (convActivaId != null) cargarConversacion(convActivaId)
  }, [convActivaId, cargarConversacion])

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, respuestaEnCurso])

  const nuevaConversacion = async () => {
    setErrorLista('')
    try {
      const nueva = await chatApi.crearConversacion(CODIGO_FUNCION)
      await cargarLista()
      setConvActivaId(nueva.id_conversacion)
    } catch (e: unknown) {
      let msg = 'Error al crear conversación'
      if (e && typeof e === 'object' && 'response' in e) {
        const r = (e as { response?: { data?: { detail?: string } } }).response
        msg = r?.data?.detail || msg
      } else if (e instanceof Error) {
        msg = e.message
      }
      setErrorLista(msg)
    }
  }

  const enviarMensaje = async () => {
    const texto = textoInput.trim()
    if (!texto || !convActivaId || enviando) return
    setEnviando(true)
    setRespuestaEnCurso('')
    setActividad(t('pensando') ?? 'Pensando…')
    setErrorConv('')
    const tempUserMsg: ChatMensaje = {
      id_mensaje: -Date.now(),
      id_conversacion: convActivaId,
      rol: 'user',
      contenido: texto,
      fecha_creacion: new Date().toISOString(),
    }
    setMensajes((prev) => [...prev, tempUserMsg])
    setTextoInput('')
    let acumulado = ''
    await chatApi.enviarMensajeStream(
      convActivaId,
      texto,
      {
        onChunk: (chunk) => {
          acumulado += chunk
          if (acumulado.length > 0) setActividad('')
          setRespuestaEnCurso(acumulado)
        },
        onToolUse: (info) => {
          setActividad(etiquetaActividadTool(info.name, t))
        },
        onToolResult: (info) => {
          if (info.ok === false) {
            setActividad(t('errorTool') ?? 'Hubo un problema con la consulta. Reintentando…')
          } else {
            setActividad(t('procesandoResultados') ?? 'Procesando resultados…')
          }
        },
        onDone: ({ id_mensaje_user, id_mensaje_assistant }) => {
          const ahora = new Date().toISOString()
          setMensajes((prev) => {
            // Reemplazar mensaje temporal del usuario con ID real
            const sinTemp = prev.filter((m) => m.id_mensaje !== tempUserMsg.id_mensaje)
            const mensajeUser: ChatMensaje = {
              ...tempUserMsg,
              id_mensaje: id_mensaje_user ?? tempUserMsg.id_mensaje,
            }
            // Agregar respuesta del asistente con ID real
            const mensajeAsistente: ChatMensaje = {
              id_mensaje: id_mensaje_assistant ?? -Date.now(),
              id_conversacion: convActivaId,
              rol: 'assistant',
              contenido: acumulado,
              fecha_creacion: ahora,
            }
            return [...sinTemp, mensajeUser, ...(acumulado ? [mensajeAsistente] : [])]
          })
          setRespuestaEnCurso('')
          setActividad('')
          cargarLista()
        },
        onError: (mensaje) => {
          setErrorConv(mensaje)
          setRespuestaEnCurso('')
          setActividad('')
          setMensajes((prev) => prev.filter((m) => m.id_mensaje !== tempUserMsg.id_mensaje))
        },
      },
      {
        codigo_ubicacion_area: areaSel || null,
        id_espacio: espacioSel,
      },
    )
    setEnviando(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje()
    }
  }

  const eliminarConversacion = async (conv: ChatConversacion) => {
    if (eliminando) return
    setEliminando(true)
    try {
      await chatApi.eliminarConversacion(conv.id_conversacion)
      if (convActivaId === conv.id_conversacion) {
        setConvActivaId(null)
        setMensajes([])
      }
      await cargarLista()
    } catch { /* */ }
    setEliminando(false)
  }

  // ══════════════════════════════════════════
  // FILTROS DEL CHAT (Área + Espacio) — barra inferior del Tab 1
  // ══════════════════════════════════════════
  // Vacíos al entrar (decisión: sin persistencia entre sesiones).
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [areas, setAreas] = useState<UbicacionDoc[]>([])
  const [areaSel, setAreaSel] = useState<string>('')   // codigo_ubicacion del área filtro
  const [areaBusqueda, setAreaBusqueda] = useState('')
  const [areaDropdownAbierto, setAreaDropdownAbierto] = useState(false)
  const [areaExpandidos, setAreaExpandidos] = useState<Set<string>>(new Set())

  const [espacios, setEspacios] = useState<EspacioTrabajo[]>([])
  const [espacioSel, setEspacioSel] = useState<number | null>(null)
  const [espacioBusqueda, setEspacioBusqueda] = useState('')
  const [espacioDropdownAbierto, setEspacioDropdownAbierto] = useState(false)

  const cargarUbicaciones = useCallback(async () => {
    try {
      const data = await ubicacionesDocsApi.listar()
      setUbicaciones(data)
      const areasData = data.filter((u) => u.tipo_ubicacion === 'AREA')
      setAreas(areasData)
      // Pre-seleccionar el área del usuario si tiene una asignada y existe en la lista
      const areaDefecto = usuario?.codigo_area
      if (areaDefecto) {
        const areaUsuario = areasData.find((a) => a.codigo_ubicacion === areaDefecto)
        if (areaUsuario) setAreaSel(areaDefecto)
      }
    } catch { /* */ }
  }, [usuario?.codigo_area])

  const cargarEspacios = useCallback(async () => {
    try {
      const r = await espaciosTrabajoApi.listarPaginado({ page: 1, limit: 200 })
      setEspacios(r.items)
    } catch { /* */ }
  }, [])

  useEffect(() => {
    cargarUbicaciones()
    cargarEspacios()
  }, [cargarUbicaciones, cargarEspacios, grupoActivo])

  const areasFiltradas = useMemo(
    () => areas
      .filter((a) =>
        !areaBusqueda ||
        a.nombre_ubicacion.toLowerCase().includes(areaBusqueda.toLowerCase()) ||
        (a.alias_ubicacion || '').toLowerCase().includes(areaBusqueda.toLowerCase()) ||
        (a.ruta_completa || '').toLowerCase().includes(areaBusqueda.toLowerCase()),
      )
      .sort((a, b) => (a.ruta_completa || '').localeCompare(b.ruta_completa || '')),
    [areas, areaBusqueda],
  )

  const espaciosFiltrados = useMemo(
    () => espacios
      .filter((e) =>
        !espacioBusqueda ||
        e.nombre_espacio.toLowerCase().includes(espacioBusqueda.toLowerCase()),
      )
      .sort((a, b) => (b.fecha_ultimo_refresco || b.fecha_creacion || '').localeCompare(a.fecha_ultimo_refresco || a.fecha_creacion || '')),
    [espacios, espacioBusqueda],
  )

  const labelTipoEspacio = (tipo: string) => tipo === 'AREA' ? 'Temporal' : 'Permanente'
  const labelAlcance = (alcance: string) => {
    if (alcance === 'USUARIO') return 'Solo yo'
    if (alcance === 'AREA') return 'Por área'
    if (alcance === 'ENTIDAD') return 'Toda la entidad'
    return alcance
  }

  const areaSelObj = useMemo(() => areas.find((a) => a.codigo_ubicacion === areaSel), [areas, areaSel])
  const espacioSelObj = useMemo(() => espacios.find((e) => e.id_espacio === espacioSel), [espacios, espacioSel])

  // ══════════════════════════════════════════
  // CREAR ESPACIO (modal mínimo desde el chat)
  // ══════════════════════════════════════════
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
  const [crearForm, setCrearForm] = useState<{
    nombre: string
    tipo: TipoEspacio
    alcance: AlcanceEspacio
    codigo_ubicacion_area: string
    criterio_texto: string
  }>({
    nombre: '',
    tipo: 'AREA',
    alcance: 'USUARIO',
    codigo_ubicacion_area: '',
    criterio_texto: '',
  })
  const [crearGuardando, setCrearGuardando] = useState(false)
  const [crearError, setCrearError] = useState<string | null>(null)

  const abrirModalCrear = () => {
    setCrearForm({
      nombre: '',
      tipo: 'AREA',
      alcance: 'USUARIO',
      codigo_ubicacion_area: areaSel || '',
      criterio_texto: '',
    })
    setCrearError(null)
    setModalCrearAbierto(true)
  }

  const guardarEspacioNuevo = async () => {
    setCrearError(null)
    if (crearForm.alcance === 'AREA' && !crearForm.codigo_ubicacion_area) {
      setCrearError('Debes seleccionar un área cuando el alcance es "Por área".')
      return
    }
    setCrearGuardando(true)
    try {
      const nuevo = await espaciosTrabajoApi.crear({
        nombre_espacio: crearForm.nombre.trim() || undefined,
        tipo_espacio: crearForm.tipo,
        alcance: crearForm.alcance,
        codigo_ubicacion_area: crearForm.alcance === 'AREA' ? crearForm.codigo_ubicacion_area : null,
        criterio_texto: crearForm.criterio_texto.trim() || undefined,
        ids_documentos: [],
      })
      setModalCrearAbierto(false)
      await cargarEspacios()
      setEspacioSel(nuevo.id_espacio)
      setTabPagina('documentos')
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCrearError(msg || 'Error al crear el espacio.')
    } finally {
      setCrearGuardando(false)
    }
  }

  // ══════════════════════════════════════════
  // TAB 2 — Detalle del espacio activo (cola)
  // ══════════════════════════════════════════
  const [espacioActivoId, setEspacioActivoId] = useState<number | null>(null)
  const [criterioEdit, setCriterioEdit] = useState('')
  const [criterioCambios, setCriterioCambios] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const [docsEspacio, setDocsEspacio] = useState<DocumentoEspacio[]>([])
  const [selectorEspacioAbierto, setSelectorEspacioAbierto] = useState(false)
  const [selectorEspacioBusqueda, setSelectorEspacioBusqueda] = useState('')
  const [cargandoDocsEspacio, setCargandoDocsEspacio] = useState(false)
  const [confirmEliminarEspacio, setConfirmEliminarEspacio] = useState<EspacioTrabajo | null>(null)
  const [reaplicando, setReaplicando] = useState(false)

  const espacioActivoObj = useMemo(
    () => espacios.find((e) => e.id_espacio === espacioActivoId),
    [espacios, espacioActivoId],
  )
  const esCreador = (e?: EspacioTrabajo | null) => !!e && e.codigo_usuario === codigoUsuario

  // Cuando entra al tab "documentos" (Espacios de Trabajo): si no hay activo, toma el más reciente.
  useEffect(() => {
    if (tabPagina !== 'documentos') return
    if (espacioActivoId == null && espaciosFiltrados.length > 0) {
      setEspacioActivoId(espaciosFiltrados[0].id_espacio)
    }
  }, [tabPagina, espacioActivoId, espaciosFiltrados])

  // Sincroniza el textarea cuando cambia el espacio activo
  useEffect(() => {
    if (espacioActivoObj) {
      setCriterioEdit(espacioActivoObj.criterio_texto || '')
      setCriterioCambios(false)
    }
  }, [espacioActivoObj])

  // Carga documentos cacheados del espacio activo
  const cargarDocsEspacio = useCallback(async (id: number) => {
    setCargandoDocsEspacio(true)
    try {
      const r = await espaciosTrabajoApi.listarDocumentos(id, { page: 1, limit: 200 })
      setDocsEspacio(r.items)
    } catch {
      setDocsEspacio([])
    } finally {
      setCargandoDocsEspacio(false)
    }
  }, [])

  useEffect(() => {
    if (tabPagina === 'documentos' && espacioActivoId != null) {
      cargarDocsEspacio(espacioActivoId)
    }
  }, [tabPagina, espacioActivoId, cargarDocsEspacio])

  const guardarCriterio = async () => {
    if (!espacioActivoObj || !criterioCambios) return
    try {
      await espaciosTrabajoApi.actualizarCriterio(espacioActivoObj.id_espacio, criterioEdit.trim())
      setCriterioCambios(false)
      await cargarEspacios()
    } catch { /* */ }
  }

  const refrescarEspacio = async () => {
    if (!espacioActivoObj) return
    if (criterioCambios) await guardarCriterio()
    setRefrescando(true)
    try {
      await espaciosTrabajoApi.refrescar(espacioActivoObj.id_espacio)
      await cargarEspacios()
      await cargarDocsEspacio(espacioActivoObj.id_espacio)
    } catch { /* */ } finally {
      setRefrescando(false)
    }
  }

  const promoverEspacio = async () => {
    if (!espacioActivoObj) return
    try {
      await espaciosTrabajoApi.promover(espacioActivoObj.id_espacio)
      await cargarEspacios()
    } catch { /* */ }
  }

  const eliminarEspacio = async () => {
    if (!confirmEliminarEspacio) return
    try {
      await espaciosTrabajoApi.eliminar(confirmEliminarEspacio.id_espacio)
      const wasActivo = confirmEliminarEspacio.id_espacio === espacioActivoId
      setConfirmEliminarEspacio(null)
      await cargarEspacios()
      if (wasActivo) {
        setEspacioActivoId(null)
        setDocsEspacio([])
      }
    } catch { /* */ }
  }

  const reaplicarHabilidad = async () => {
    if (!espacioActivoObj) return
    setReaplicando(true)
    try {
      await espaciosTrabajoApi.reaplicar(espacioActivoObj.id_espacio)
      await cargarDocsEspacio(espacioActivoObj.id_espacio)
    } catch { /* */ } finally {
      setReaplicando(false)
    }
  }

  // Documentos del antiguo tab (preview en chat); se conserva pero ya no se usa en la UI principal del tab 2.
  const [documentosTab] = useState<Documento[]>([])
  const [cargandoDocs] = useState(false)
  const [busquedaDocs, setBusquedaDocs] = useState('')
  const ubicacionSel = areaSel
  const ubicBusqueda = areaBusqueda
  const ubicacionesFiltradas = areasFiltradas
  // documentosFiltrados deja de usarse — el tab 2 ahora consume docsEspacio.
  const documentosFiltrados = documentosTab
    .filter((d) => {
      const matchBusqueda = !busquedaDocs ||
        d.nombre_documento.toLowerCase().includes(busquedaDocs.toLowerCase()) ||
        (d.ubicacion_documento || '').toLowerCase().includes(busquedaDocs.toLowerCase())
      return matchBusqueda
    })

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Lenguetas */}
      <div className="border-b border-borde mb-4 flex-shrink-0">
        <nav className="flex gap-6">
          <button onClick={() => setTabPagina('chat')} className={tabStyle(tabPagina === 'chat')}>
            {t('conversaciones')}
          </button>
          <button onClick={() => setTabPagina('documentos')} className={tabStyle(tabPagina === 'documentos')}>
            {t('espaciosTrabajo')}
          </button>
        </nav>
      </div>

      {/* ── TAB 1: Chat ── */}
      {tabPagina === 'chat' && (
        <div className="flex flex-1 gap-4 max-w-full overflow-hidden">
          {/* Sidebar de conversaciones */}
          <aside className="w-64 flex-shrink-0 flex flex-col gap-2 border border-borde rounded-lg bg-surface overflow-hidden">
            <div className="px-3 py-2 border-b border-borde flex items-center justify-between">
              <h3 className="text-sm font-semibold text-texto">{t('conversaciones')}</h3>
              <button
                onClick={nuevaConversacion}
                className="p-1.5 rounded hover:bg-primario-muy-claro text-primario"
                title={t('nuevaConversacion')}
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {cargandoLista ? (
                <p className="text-xs text-texto-muted text-center py-4">{t('cargando') ?? 'Cargando...'}</p>
              ) : conversaciones.length === 0 ? (
                <p className="text-xs text-texto-muted text-center py-4">{t('sinConversaciones')}</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {conversaciones.map((c) => (
                    <div
                      key={c.id_conversacion}
                      onClick={() => setConvActivaId(c.id_conversacion)}
                      className={`group flex items-start gap-2 px-2 py-2 rounded text-sm cursor-pointer transition-colors ${
                        convActivaId === c.id_conversacion
                          ? 'bg-primario-muy-claro text-primario font-medium'
                          : 'hover:bg-fondo text-texto'
                      }`}
                    >
                      <MessageCircle size={14} className="mt-0.5 shrink-0" />
                      <span className="flex-1 truncate" title={c.titulo}>{c.titulo}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarConversacion(c) }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-texto-muted hover:text-error"
                        title={t('eliminarConversacionTitulo')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errorLista && (
              <div className="px-3 py-2 text-xs text-error border-t border-borde bg-red-50">{errorLista}</div>
            )}
          </aside>

          {/* Área principal de chat */}
          <main className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
            {convActivaId == null ? (
              <div className="flex-1 flex items-center justify-center text-texto-muted text-sm flex-col gap-3">
                <MessageCircle size={48} className="opacity-30" />
                <p>{t('sinConversacionMsg')}</p>
                <Boton variante="primario" tamano="sm" onClick={nuevaConversacion}>
                  <Plus size={14} /> {t('nuevaConversacionBoton')}
                </Boton>
              </div>
            ) : (
              <>
                {/* Cabecera del chat: titulo + acciones (debug super-admin) */}
                {esSuperAdmin && (
                  <div className="border-b border-borde px-4 py-2 flex items-center justify-between gap-2 bg-fondo">
                    <span className="text-xs text-texto-muted truncate">
                      {conversaciones.find((c) => c.id_conversacion === convActivaId)?.titulo || ''}
                    </span>
                    <button
                      type="button"
                      onClick={verSystemPrompt}
                      title="Ver system prompt enviado al LLM (solo super-admin)"
                      className="p-1.5 rounded hover:bg-white text-texto-muted hover:text-texto transition-colors flex items-center gap-1"
                    >
                      <Eye size={15} />
                      <span className="text-xs">prompt</span>
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
                  {cargandoConv ? (
                    <p className="text-sm text-texto-muted text-center">{t('cargando') ?? 'Cargando...'}</p>
                  ) : mensajes.length === 0 && !respuestaEnCurso ? (
                    <p className="text-sm text-texto-muted text-center py-8">{t('placeholderPrimerMensaje')}</p>
                  ) : (
                    <>
                      {mensajes.map((m) => (
                        <Mensaje key={m.id_mensaje} mensaje={m} onAbrirDoc={setModalDocCodigo} />
                      ))}
                      {respuestaEnCurso && (
                        <Mensaje
                          mensaje={{
                            id_mensaje: -1,
                            id_conversacion: convActivaId,
                            rol: 'assistant',
                            contenido: respuestaEnCurso,
                            fecha_creacion: new Date().toISOString(),
                          }}
                          streaming
                          onAbrirDoc={setModalDocCodigo}
                        />
                      )}
                      {enviando && actividad && (
                        <div className="flex items-center gap-2 text-xs text-texto-muted italic px-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-texto-muted/50 animate-pulse" />
                          <span>{actividad}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={mensajesEndRef} />
                </div>

                {errorConv && (
                  <div className="px-4 py-2 text-sm text-error bg-red-50 border-t border-red-200">{errorConv}</div>
                )}

                <div className="border-t border-borde p-3 flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={textoInput}
                    onChange={(e) => setTextoInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('placeholderMensaje')}
                    disabled={enviando}
                    rows={3}
                    className="flex-1 resize-none rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none disabled:opacity-50"
                  />
                  <Boton variante="primario" onClick={enviarMensaje} disabled={enviando || !textoInput.trim()} cargando={enviando}>
                    <Send size={16} />
                  </Boton>
                </div>
              </>
            )}

            {/* ── Barra inferior de filtros + Crear Espacio (siempre visible) ── */}
            <div className="border-t border-borde bg-fondo px-3 py-2 flex flex-wrap items-center gap-2">
              {/* Selector buscable: Área */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setAreaDropdownAbierto((v) => !v); setEspacioDropdownAbierto(false) }}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition ${
                    areaSel
                      ? 'bg-primario-muy-claro border-primario text-primario font-medium'
                      : 'bg-white border-borde text-texto-muted hover:text-texto'
                  }`}
                >
                  <FolderOpen size={13} />
                  <span className="max-w-[180px] truncate">
                    {areaSelObj ? (areaSelObj.alias_ubicacion || areaSelObj.nombre_ubicacion) : 'Área (todas)'}
                  </span>
                  {areaSel && (
                    <X
                      size={13}
                      className="hover:text-error"
                      onClick={(e) => { e.stopPropagation(); setAreaSel(''); setAreaDropdownAbierto(false) }}
                    />
                  )}
                </button>
                {areaDropdownAbierto && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-borde rounded-lg shadow-lg z-20 max-h-80 overflow-hidden flex flex-col">
                    <button
                      type="button"
                      onClick={() => setAreaDropdownAbierto(false)}
                      className="absolute top-1.5 right-1.5 z-10 p-1 rounded hover:bg-fondo text-texto-muted hover:text-error"
                      title="Cerrar"
                    >
                      <X size={14} />
                    </button>
                    <div className="p-2 pr-8 border-b border-borde">
                      <Input
                        autoFocus
                        placeholder="Buscar área…"
                        value={areaBusqueda}
                        onChange={(e) => setAreaBusqueda(e.target.value)}
                        icono={<Search size={13} />}
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 text-xs">
                      <div
                        className="px-3 py-2 hover:bg-fondo cursor-pointer text-texto-muted border-b border-borde"
                        onClick={() => { setAreaSel(''); setAreaBusqueda(''); setAreaDropdownAbierto(false) }}
                      >
                        Todas
                      </div>
                      {(() => {
                        const tieneHijosArea = (cod: string) => areas.some(a => a.codigo_ubicacion !== cod && a.codigo_ubicacion_superior === cod)
                        // Con búsqueda: lista plana filtrada
                        if (areaBusqueda) {
                          if (areasFiltradas.length === 0) {
                            return <p className="text-texto-muted text-center py-3">Sin coincidencias</p>
                          }
                          return areasFiltradas.map((a) => {
                            const selec = areaSel === a.codigo_ubicacion
                            return (
                              <div
                                key={a.codigo_ubicacion}
                                className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer ${selec ? 'bg-primario-muy-claro' : ''}`}
                                style={{ paddingLeft: `${(a.nivel || 0) * 16 + 12}px` }}
                                onClick={() => {
                                  setAreaSel(a.codigo_ubicacion)
                                  setAreaDropdownAbierto(false)
                                  setAreaBusqueda('')
                                }}
                              >
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : 'text-sky-500'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className={`truncate ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{a.alias_ubicacion || a.nombre_ubicacion}</div>
                                  {a.ruta_completa && (
                                    <div className="text-texto-muted text-[10px] truncate">{a.ruta_completa}</div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        }
                        // Sin búsqueda: árbol colapsable
                        const toggleExpandirArea = (e: React.MouseEvent, cod: string) => {
                          e.stopPropagation()
                          setAreaExpandidos(prev => {
                            const next = new Set(prev)
                            next.has(cod) ? next.delete(cod) : next.add(cod)
                            return next
                          })
                        }
                        const renderNodoArea = (a: UbicacionDoc): React.ReactNode => {
                          const tieneHijos = tieneHijosArea(a.codigo_ubicacion)
                          const expandido = areaExpandidos.has(a.codigo_ubicacion)
                          const selec = areaSel === a.codigo_ubicacion
                          const hijos = tieneHijos
                            ? areas
                                .filter(h => h.codigo_ubicacion_superior === a.codigo_ubicacion)
                                .sort((x, y) => (x.alias_ubicacion || x.nombre_ubicacion).localeCompare(y.alias_ubicacion || y.nombre_ubicacion))
                            : []
                          return (
                            <div key={a.codigo_ubicacion}>
                              <div
                                className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer select-none ${selec ? 'bg-primario-muy-claro' : ''}`}
                                style={{ paddingLeft: `${(a.nivel || 0) * 16 + 12}px` }}
                                onClick={() => {
                                  setAreaSel(a.codigo_ubicacion)
                                  setAreaDropdownAbierto(false)
                                  setAreaBusqueda('')
                                }}
                              >
                                {tieneHijos
                                  ? <button onClick={(e) => toggleExpandirArea(e, a.codigo_ubicacion)} className="shrink-0 hover:text-primario text-texto-muted p-0.5 -ml-0.5 rounded">
                                      {expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </button>
                                  : <span className="w-3 shrink-0" />
                                }
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : 'text-sky-500'}`} />
                                <span className={`truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{a.alias_ubicacion || a.nombre_ubicacion}</span>
                              </div>
                              {expandido && hijos.map(h => renderNodoArea(h))}
                            </div>
                          )
                        }
                        const raicesArea = areas
                          .filter(a => !a.codigo_ubicacion_superior || !areas.some(p => p.codigo_ubicacion === a.codigo_ubicacion_superior))
                          .sort((x, y) => (x.alias_ubicacion || x.nombre_ubicacion).localeCompare(y.alias_ubicacion || y.nombre_ubicacion))
                        if (raicesArea.length === 0) {
                          return <p className="text-texto-muted text-center py-3">Sin áreas</p>
                        }
                        return raicesArea.map(a => renderNodoArea(a))
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Selector buscable: Espacio de Trabajo */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setEspacioDropdownAbierto((v) => !v); setAreaDropdownAbierto(false) }}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition ${
                    espacioSel != null
                      ? 'bg-primario-muy-claro border-primario text-primario font-medium'
                      : 'bg-white border-borde text-texto-muted hover:text-texto'
                  }`}
                >
                  <Sparkles size={13} />
                  <span className="max-w-[180px] truncate">
                    {espacioSelObj ? espacioSelObj.nombre_espacio : 'Espacio (todos)'}
                  </span>
                  {espacioSel != null && (
                    <X
                      size={13}
                      className="hover:text-error"
                      onClick={(e) => { e.stopPropagation(); setEspacioSel(null); setEspacioDropdownAbierto(false) }}
                    />
                  )}
                </button>
                {espacioDropdownAbierto && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-borde rounded-lg shadow-lg z-20 max-h-64 overflow-hidden flex flex-col">
                    <button
                      type="button"
                      onClick={() => setEspacioDropdownAbierto(false)}
                      className="absolute top-1.5 right-1.5 z-10 p-1 rounded hover:bg-fondo text-texto-muted hover:text-error"
                      title="Cerrar"
                    >
                      <X size={14} />
                    </button>
                    <div className="p-2 pr-8 border-b border-borde">
                      <Input
                        autoFocus
                        placeholder="Buscar espacio…"
                        value={espacioBusqueda}
                        onChange={(e) => setEspacioBusqueda(e.target.value)}
                        icono={<Search size={13} />}
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 text-xs">
                      {espaciosFiltrados.length === 0 ? (
                        <p className="text-texto-muted text-center py-3">No tienes espacios todavía</p>
                      ) : espaciosFiltrados.map((e) => (
                        <button
                          key={e.id_espacio}
                          onClick={() => {
                            setEspacioSel(e.id_espacio)
                            setEspacioDropdownAbierto(false)
                            setEspacioBusqueda('')
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-primario-muy-claro flex items-center gap-2"
                        >
                          <Insignia variante={e.tipo_espacio === 'AREA' ? 'advertencia' : 'exito'}>
                            {labelTipoEspacio(e.tipo_espacio)}
                          </Insignia>
                          <span className="flex-1 font-medium text-texto truncate">{e.nombre_espacio}</span>
                          <span className="text-texto-muted text-[10px]">{e.total_documentos ?? 0}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Crear Espacio */}
              <button
                type="button"
                onClick={abrirModalCrear}
                className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primario/40 text-primario hover:bg-primario-muy-claro transition"
                title="Crear un Espacio de Trabajo a partir del filtro actual"
              >
                <FolderPlus size={13} />
                <span>Crear Espacio</span>
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ── TAB 2: Espacios de Trabajo (patrón Procesar Documentos) ── */}
      {tabPagina === 'documentos' && (
        <div className="flex flex-1 flex-col gap-4 max-w-full overflow-hidden">
          {/* Selector único arriba: dropdown buscable de espacios visibles */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-texto whitespace-nowrap">Espacio:</label>
            <div className="relative flex-1 min-w-[280px] max-w-[520px]">
              <button
                type="button"
                onClick={() => setSelectorEspacioAbierto((v) => !v)}
                className="w-full text-left flex items-center gap-2 rounded-lg border border-borde bg-surface px-3 py-2 text-sm hover:border-primario/50"
              >
                {espacioActivoObj ? (
                  <>
                    <Insignia variante={espacioActivoObj.tipo_espacio === 'AREA' ? 'advertencia' : 'exito'}>
                      {labelTipoEspacio(espacioActivoObj.tipo_espacio)}
                    </Insignia>
                    <span className="flex-1 truncate font-medium text-texto">{espacioActivoObj.nombre_espacio}</span>
                    <span className="text-[11px] text-texto-muted">{labelAlcance(espacioActivoObj.alcance)}</span>
                  </>
                ) : (
                  <span className="flex-1 text-texto-muted">— Selecciona un espacio —</span>
                )}
                <ChevronDown size={16} className="text-texto-muted" />
              </button>
              {selectorEspacioAbierto && (
                <div className="absolute z-30 mt-1 w-full rounded-lg border border-borde bg-white shadow-lg max-h-80 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-borde">
                    <Input
                      autoFocus
                      placeholder="Buscar espacio…"
                      value={selectorEspacioBusqueda}
                      onChange={(e) => setSelectorEspacioBusqueda(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {espacios.length === 0 ? (
                      <p className="text-xs text-texto-muted text-center py-6 px-3">
                        No tienes espacios todavía. Pulsa &quot;Crear&quot; para empezar.
                      </p>
                    ) : (
                      espacios
                        .filter((e) =>
                          !selectorEspacioBusqueda ||
                          e.nombre_espacio.toLowerCase().includes(selectorEspacioBusqueda.toLowerCase()),
                        )
                        .sort((a, b) =>
                          (b.fecha_ultimo_refresco || b.fecha_creacion || '').localeCompare(a.fecha_ultimo_refresco || a.fecha_creacion || ''),
                        )
                        .map((e) => (
                          <button
                            key={e.id_espacio}
                            onClick={() => {
                              setEspacioActivoId(e.id_espacio)
                              setSelectorEspacioAbierto(false)
                              setSelectorEspacioBusqueda('')
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-fondo flex items-center gap-2 ${
                              e.id_espacio === espacioActivoId ? 'bg-primario-muy-claro' : ''
                            }`}
                          >
                            <Insignia variante={e.tipo_espacio === 'AREA' ? 'advertencia' : 'exito'}>
                              {labelTipoEspacio(e.tipo_espacio)}
                            </Insignia>
                            <span className="flex-1 truncate">{e.nombre_espacio}</span>
                            <span className="text-[11px] text-texto-muted">{labelAlcance(e.alcance)}</span>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <Boton variante="primario" tamano="sm" onClick={abrirModalCrear}>
              <Plus size={14} className="mr-1" /> Crear
            </Boton>
          </div>

          {/* Card del espacio activo + tabla de cola */}
          <main className="flex-1 flex flex-col bg-white border border-borde rounded-lg overflow-hidden min-w-0">
            {!espacioActivoObj ? (
              <div className="flex-1 flex flex-col items-center justify-center text-texto-muted text-sm gap-3">
                <FolderOpen size={48} className="opacity-30" />
                <p>Selecciona un espacio del listado o crea uno nuevo.</p>
                <Boton variante="primario" tamano="sm" onClick={abrirModalCrear}>
                  <Plus size={14} /> Crear Espacio
                </Boton>
              </div>
            ) : (
              <>
                {/* Card: encabezado + datos + criterio + acciones */}
                <div className="border-b border-borde p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-texto">{espacioActivoObj.nombre_espacio}</h2>
                      <Insignia variante={espacioActivoObj.tipo_espacio === 'AREA' ? 'advertencia' : 'exito'}>
                        {labelTipoEspacio(espacioActivoObj.tipo_espacio)}
                      </Insignia>
                      <Insignia variante="neutro">{labelAlcance(espacioActivoObj.alcance)}</Insignia>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Boton variante="primario" tamano="sm" onClick={refrescarEspacio} cargando={refrescando}>
                        <RefreshCw size={14} className={refrescando ? 'animate-spin' : ''} />
                        <span className="ml-1">Refrescar</span>
                      </Boton>
                      {docsEspacio.some((d) => d.codigo_habilidad) && (
                        <Boton variante="contorno" tamano="sm" onClick={reaplicarHabilidad} cargando={reaplicando}>
                          <Zap size={14} className="mr-1" />
                          <span>Reaplicar</span>
                        </Boton>
                      )}
                      {espacioActivoObj.tipo_espacio === 'AREA' && esCreador(espacioActivoObj) && (
                        <button
                          onClick={promoverEspacio}
                          className="p-1.5 rounded hover:bg-primario-muy-claro text-primario"
                          title="Promover a Espacio permanente"
                        >
                          <ArrowUp size={16} />
                        </button>
                      )}
                      {esCreador(espacioActivoObj) && (
                        <button
                          onClick={() => setConfirmEliminarEspacio(espacioActivoObj)}
                          className="p-1.5 rounded hover:bg-error/10 text-error"
                          title="Eliminar Espacio"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-muted">
                    <span>Creador: {espacioActivoObj.codigo_usuario}</span>
                    <span>
                      Creado:{' '}
                      {espacioActivoObj.fecha_creacion
                        ? new Date(espacioActivoObj.fecha_creacion).toLocaleDateString('es-CL')
                        : '—'}
                    </span>
                    {espacioActivoObj.tipo_espacio === 'AREA' ? (
                      espacioActivoObj.fecha_termino
                        ? <span>Vence: {new Date(espacioActivoObj.fecha_termino).toLocaleDateString('es-CL')}</span>
                        : <span className="text-texto-muted italic">Sin fecha de vencimiento definida</span>
                    ) : (
                      <span className="text-exito font-medium">Permanente (sin vencimiento)</span>
                    )}
                    {espacioActivoObj.fecha_ultimo_refresco && (
                      <span>
                        Último refresco:{' '}
                        {new Date(espacioActivoObj.fecha_ultimo_refresco).toLocaleString('es-CL')}
                      </span>
                    )}
                    {espacioActivoObj.alcance === 'AREA' && espacioActivoObj.codigo_ubicacion_area && (
                      <span>
                        Visible para área:{' '}
                        {ubicaciones.find((u) => u.codigo_ubicacion === espacioActivoObj.codigo_ubicacion_area)?.alias_ubicacion
                          || ubicaciones.find((u) => u.codigo_ubicacion === espacioActivoObj.codigo_ubicacion_area)?.nombre_ubicacion
                          || espacioActivoObj.codigo_ubicacion_area}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-texto uppercase tracking-wide">
                      Criterio del espacio (en palabras)
                    </label>
                    <textarea
                      value={criterioEdit}
                      onChange={(e) => { setCriterioEdit(e.target.value); setCriterioCambios(true) }}
                      placeholder="Ej: Documentos sobre licitaciones del 2024 con estado VECTORIZADO"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                    />
                    <div className="flex items-center gap-2 justify-between">
                      <p className="text-xs text-texto-muted">
                        Cualquiera del alcance puede editar el criterio. Tras editarlo, pulsa Guardar y luego Refrescar para reaplicarlo.
                      </p>
                      {criterioCambios && (
                        <Boton variante="contorno" tamano="sm" onClick={guardarCriterio}>
                          Guardar criterio
                        </Boton>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabla de documentos en la cola */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-texto">
                      Documentos en la cola ({docsEspacio.length})
                    </h4>
                  </div>
                  <Tabla>
                    <TablaCabecera>
                      <tr>
                        <TablaTh>Documento</TablaTh>
                        <TablaTh>Ubicación</TablaTh>
                        <TablaTh>Estado área</TablaTh>
                        <TablaTh>Estado cola</TablaTh>
                        <TablaTh>Fin</TablaTh>
                        <TablaTh className="text-right">Acciones</TablaTh>
                      </tr>
                    </TablaCabecera>
                    <TablaCuerpo>
                      {cargandoDocsEspacio ? (
                        <TablaFila>
                          <TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>
                            Cargando documentos…
                          </TablaTd>
                        </TablaFila>
                      ) : docsEspacio.length === 0 ? (
                        <TablaFila>
                          <TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>
                            <div className="flex flex-col items-center gap-2">
                              <FileText size={32} className="opacity-30" />
                              <span>Sin documentos. Edita el criterio y refresca para poblarlos.</span>
                            </div>
                          </TablaTd>
                        </TablaFila>
                      ) : (
                        docsEspacio.map((d) => {
                          const ubic = d.ubicacion_documento || ''
                          const esUrl = !!ubic && /^https?:\/\//i.test(ubic)
                          return (
                          <TablaFila key={d.id_cola}>
                            <TablaTd>
                              <span className="font-medium text-sm">{d.nombre_documento}</span>
                            </TablaTd>
                            <TablaTd className="text-xs text-texto-muted max-w-[280px] truncate" title={ubic}>
                              {ubic || '—'}
                            </TablaTd>
                            <TablaTd>
                              <Insignia variante={iconoEstadoArea(d.estado_area)}>
                                {d.estado_area}
                              </Insignia>
                            </TablaTd>
                            <TablaTd>
                              <Insignia variante={iconoEstadoCola(d.estado_cola)}>
                                {d.estado_cola}
                              </Insignia>
                            </TablaTd>
                            <TablaTd className="text-xs text-texto-muted">
                              {d.fecha_fin ? new Date(d.fecha_fin).toLocaleString('es-CL') : '—'}
                            </TablaTd>
                            <TablaTd>
                              <div className="flex items-center justify-end gap-1">
                                {ubic && esUrl && (
                                  <a
                                    href={ubic}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Abrir URL"
                                    className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                                  >
                                    <ExternalLink size={15} />
                                  </a>
                                )}
                                {ubic && !esUrl && (
                                  <button
                                    type="button"
                                    title="Abrir archivo"
                                    onClick={() => abrirDocumento(ubic)}
                                    className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                                  >
                                    <FileText size={15} />
                                  </button>
                                )}
                                {ubic && !esUrl && (
                                  <button
                                    type="button"
                                    title="Descargar"
                                    onClick={() => descargarDocumento(ubic, d.nombre_documento)}
                                    className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                                  >
                                    <Download size={15} />
                                  </button>
                                )}
                              </div>
                            </TablaTd>
                          </TablaFila>
                          )
                        })
                      )}
                    </TablaCuerpo>
                  </Tabla>
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* ── Modal Crear Espacio (mínimo, desde la barra del chat) ── */}
      <Modal
        abierto={modalCrearAbierto}
        alCerrar={() => setModalCrearAbierto(false)}
        titulo="Crear Espacio de Trabajo"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-texto mb-1">Nombre</label>
            <Input
              value={crearForm.nombre}
              onChange={(e) => setCrearForm({ ...crearForm, nombre: e.target.value })}
              placeholder="(automático si lo dejas vacío)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Tipo</label>
              <select
                value={crearForm.tipo}
                onChange={(e) => setCrearForm({ ...crearForm, tipo: e.target.value as TipoEspacio })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
              >
                <option value="AREA">Temporal (se borra en 15 días)</option>
                <option value="ESPACIO">Permanente (sin vencimiento)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Alcance</label>
              <select
                value={crearForm.alcance}
                onChange={(e) => setCrearForm({
                  ...crearForm,
                  alcance: e.target.value as AlcanceEspacio,
                  codigo_ubicacion_area: e.target.value === 'AREA' ? crearForm.codigo_ubicacion_area : '',
                })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
              >
                <option value="USUARIO">Solo yo</option>
                <option value="AREA">Por área (usuarios del área)</option>
                <option value="ENTIDAD">Toda la entidad</option>
              </select>
            </div>
          </div>
          {crearForm.alcance === 'AREA' && (
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Área de visibilidad</label>
              <select
                value={crearForm.codigo_ubicacion_area}
                onChange={(e) => setCrearForm({ ...crearForm, codigo_ubicacion_area: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
              >
                <option value="">— Selecciona un área —</option>
                {areas.map((a) => (
                  <option key={a.codigo_ubicacion} value={a.codigo_ubicacion}>
                    {a.alias_ubicacion || a.nombre_ubicacion}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-texto mb-1">Criterio (en palabras)</label>
            <textarea
              value={crearForm.criterio_texto}
              onChange={(e) => setCrearForm({ ...crearForm, criterio_texto: e.target.value })}
              placeholder="Ej: Documentos sobre licitaciones del 2024 con estado VECTORIZADO"
              rows={3}
              className="w-full resize-none rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
            />
          </div>
          {crearError && (
            <div className="rounded-lg border border-error/40 bg-error/10 p-2.5 text-sm text-error">
              {crearError}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-borde pt-4">
          <Boton variante="contorno" onClick={() => setModalCrearAbierto(false)}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardarEspacioNuevo} cargando={crearGuardando}>
            Crear
          </Boton>
        </div>
      </Modal>

      {/* ── Confirmar eliminar espacio ── */}
      <ModalConfirmar
        abierto={confirmEliminarEspacio !== null}
        alCerrar={() => setConfirmEliminarEspacio(null)}
        alConfirmar={eliminarEspacio}
        titulo="Eliminar Espacio de Trabajo"
        mensaje={
          confirmEliminarEspacio
            ? `¿Eliminar el espacio "${confirmEliminarEspacio.nombre_espacio}"? Esta acción no se puede deshacer.`
            : ''
        }
        textoConfirmar="Eliminar"
        variante="peligro"
      />

      {/* ── Modal preview system_prompt (solo super-admin) ── */}
      <Modal
        abierto={modalSpAbierto}
        alCerrar={() => setModalSpAbierto(false)}
        titulo="System prompt enviado al LLM"
        descripcion="Lo que se enviaria si mandaras un mensaje ahora en esta conversacion."
        className="max-w-4xl"
      >
        {cargandoSp ? (
          <p className="text-sm text-texto-muted">Cargando…</p>
        ) : errorSp ? (
          <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{errorSp}</div>
        ) : spInfo ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-muted">
              <span>{spInfo.n_caracteres.toLocaleString()} caracteres</span>
              <span>•</span>
              <span>{spInfo.n_funciones_disponibles} funciones disponibles</span>
              <span>•</span>
              <span>{spInfo.n_funciones_con_permisos} con permisos de escritura</span>
              <button
                type="button"
                onClick={copiarSystemPrompt}
                className="ml-auto flex items-center gap-1 rounded border border-borde bg-white px-2 py-1 text-xs hover:bg-fondo"
              >
                <Copy size={12} />
                {spCopiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="text-xs bg-fondo border border-borde rounded p-3 max-h-[60vh] overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
              {spInfo.system_prompt}
            </pre>
          </div>
        ) : null}
      </Modal>
      <ModalVisorDocumento codigoDoc={modalDocCodigo} onCerrar={() => setModalDocCodigo(null)} />
    </div>
  )
}

// ── Modal visor de documento (abre desde links del chat) ──────────────────────

function ModalVisorDocumento({ codigoDoc, onCerrar }: { codigoDoc: number | null; onCerrar: () => void }) {
  const [doc, setDoc] = useState<Documento | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (codigoDoc == null) { setDoc(null); setError(''); return }
    setCargando(true)
    setError('')
    documentosApi.obtener(codigoDoc)
      .then(setDoc)
      .catch(() => setError('No se pudo cargar el documento.'))
      .finally(() => setCargando(false))
  }, [codigoDoc])

  return (
    <Modal abierto={codigoDoc != null} alCerrar={onCerrar} titulo="Documento" className="max-w-2xl">
      {cargando && <p className="text-sm text-texto-muted p-4">Cargando…</p>}
      {error && <p className="text-sm text-error p-4">{error}</p>}
      {doc && !cargando && (
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-xs text-texto-muted uppercase tracking-wide mb-1">Nombre</p>
            <p className="text-sm font-medium">{doc.nombre_documento}</p>
          </div>
          {doc.ubicacion_documento && (
            <div>
              <p className="text-xs text-texto-muted uppercase tracking-wide mb-1">Ubicación</p>
              <p className="text-sm font-mono text-texto-muted break-all">{doc.ubicacion_documento}</p>
            </div>
          )}
          {doc.resumen_documento && (
            <div>
              <p className="text-xs text-texto-muted uppercase tracking-wide mb-1">Resumen</p>
              <p className="text-sm leading-relaxed">{doc.resumen_documento}</p>
            </div>
          )}
          <div className="flex gap-4 text-xs text-texto-muted border-t border-borde pt-3">
            {doc.codigo_estado_doc && <span>Estado: {doc.codigo_estado_doc}</span>}
            {doc.tamano_kb != null && <span>Tamaño: {doc.tamano_kb} KB</span>}
            {doc.fecha_modificacion && <span>Modificado: {new Date(doc.fecha_modificacion).toLocaleDateString()}</span>}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Subcomponente Mensaje ──────────────────────────────────────────────────────

function Mensaje({ mensaje, streaming = false, onAbrirDoc }: { mensaje: ChatMensaje; streaming?: boolean; onAbrirDoc?: (codigo: number) => void }) {
  const esUser = mensaje.rol === 'user'
  const tieneTabla = !esUser && /(^|\n)\s*\|.*\|.*\n\s*\|[-:| ]+\|/.test(mensaje.contenido)
  return (
    <div className={`flex ${esUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${tieneTabla ? 'max-w-[95%] w-full' : 'max-w-[80%]'} px-4 py-2 rounded-lg text-sm ${
          esUser ? 'bg-primario text-primario-texto' : 'bg-white text-texto'
        }`}
      >
        {esUser ? (
          <div className="whitespace-pre-wrap">{mensaje.contenido}</div>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:bg-surface prose-pre:text-texto prose-code:text-texto prose-code:bg-surface prose-code:px-1 prose-code:rounded prose-code:text-xs prose-headings:my-2 prose-a:text-primario prose-a:underline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="border-collapse border border-borde text-xs w-full" {...props}>{children}</table>
                  </div>
                ),
                thead: ({ children, ...props }) => (
                  <thead className="bg-primario-muy-claro" {...props}>{children}</thead>
                ),
                th: ({ children, ...props }) => (
                  <th className="border border-borde px-2 py-1 text-left font-semibold" {...props}>{children}</th>
                ),
                td: ({ children, ...props }) => (
                  <td className="border border-borde px-2 py-1 align-top" {...props}>{children}</td>
                ),
                a: ({ href, children, ...props }) => {
                  const hrefSeguro = typeof href === 'string' && /^(https?:\/\/|\/)/i.test(href) ? href : '#'
                  // Detectar link a documento: /documentos?codigo=X
                  const matchDoc = hrefSeguro.match(/^\/documentos[?&]codigo=(\d+)/)
                  if (matchDoc && onAbrirDoc) {
                    const codigo = parseInt(matchDoc[1], 10)
                    return (
                      <button
                        type="button"
                        onClick={() => onAbrirDoc(codigo)}
                        className="text-primario underline hover:text-primario-hover cursor-pointer bg-transparent border-0 p-0 font-inherit text-inherit"
                      >
                        {children}
                      </button>
                    )
                  }
                  // Links externos: abrir en pestaña nueva
                  return (
                    <a href={hrefSeguro} target="_blank" rel="noopener noreferrer" className="text-primario underline hover:text-primario-hover" {...props}>
                      {children}
                    </a>
                  )
                },
                blockquote: ({ children, ...props }) => {
                  // Detecta avisos del sistema marcados con :information_source:
                  // (la tool entregar_mensaje_pendiente le indica al LLM que use
                  // ese marcador). Si esta presente, renderiza con icono + italica
                  // sutil; si no, blockquote normal.
                  const obtenerTexto = (n: unknown): string => {
                    if (typeof n === 'string') return n
                    if (Array.isArray(n)) return n.map(obtenerTexto).join('')
                    if (n && typeof n === 'object' && 'props' in n) {
                      const p = (n as { props?: { children?: unknown } }).props
                      return obtenerTexto(p?.children)
                    }
                    return ''
                  }
                  const texto = obtenerTexto(children).trim()
                  const esAviso = /^:information_source:/i.test(texto)
                  if (!esAviso) {
                    return (
                      <blockquote className="my-2 pl-3 border-l-2 border-borde italic text-texto-muted" {...props}>
                        {children}
                      </blockquote>
                    )
                  }
                  // Limpia recursivamente la primera ocurrencia del marcador en el texto
                  let limpiado = false
                  const limpiar = (n: unknown): unknown => {
                    if (limpiado) return n
                    if (typeof n === 'string') {
                      const reemplazo = n.replace(/:information_source:\s*/i, '')
                      if (reemplazo !== n) limpiado = true
                      return reemplazo
                    }
                    if (Array.isArray(n)) return n.map(limpiar)
                    if (n && typeof n === 'object' && 'props' in n) {
                      const elem = n as React.ReactElement
                      const innerProps = (elem.props ?? {}) as { children?: unknown }
                      const inner = innerProps.children
                      const nuevoInner = limpiar(inner)
                      if (nuevoInner !== inner) {
                        return { ...elem, props: { ...innerProps, children: nuevoInner } }
                      }
                    }
                    return n
                  }
                  const childrenLimpio = limpiar(children) as React.ReactNode
                  return (
                    <blockquote className="my-2 px-3 py-2 border-l-4 border-primario/40 bg-primario-muy-claro/30 rounded-r">
                      <div className="flex gap-2 items-start">
                        <Info size={14} className="mt-1 flex-shrink-0 text-primario" />
                        <div className="italic text-texto-muted prose-p:my-0.5 prose-p:text-sm">
                          {childrenLimpio}
                        </div>
                      </div>
                    </blockquote>
                  )
                },
              }}
            >
              {mensaje.contenido}
            </ReactMarkdown>
            {streaming && <span className="inline-block w-1 h-3 ml-0.5 bg-primario animate-pulse" />}
          </div>
        )}
      </div>
    </div>
  )
}
