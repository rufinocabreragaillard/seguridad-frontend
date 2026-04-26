'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef, useCallback, useMemo, KeyboardEvent } from 'react'
import { Plus, Trash2, Send, MessageCircle, FolderOpen, Search, FileText, X, RefreshCw, ArrowUp, FolderPlus, Sparkles } from 'lucide-react'
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
import { useAuth } from '@/context/AuthContext'
import type { ChatConversacion, ChatMensaje, Documento, UbicacionDoc, EspacioTrabajo, TipoEspacio, AlcanceEspacio } from '@/lib/tipos'

const CODIGO_FUNCION = 'CHAT-USUARIO'

function iconoEstado(estado: string | null | undefined) {
  if (!estado) return 'neutro' as const
  if (estado === 'VECTORIZADO') return 'exito' as const
  if (estado === 'CHUNKEADO') return 'exito' as const
  if (estado === 'ESCANEADO') return 'advertencia' as const
  if (estado === 'METADATA') return 'neutro' as const
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
  const [eliminando, setEliminando] = useState(false)
  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const cargarLista = useCallback(async () => {
    setCargandoLista(true)
    setErrorLista('')
    try {
      const data = await chatApi.listarConversaciones()
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
          setRespuestaEnCurso(acumulado)
        },
        onDone: async () => {
          setRespuestaEnCurso('')
          await cargarConversacion(convActivaId)
          cargarLista()
        },
        onError: (mensaje) => {
          setErrorConv(mensaje)
          setRespuestaEnCurso('')
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

  const [espacios, setEspacios] = useState<EspacioTrabajo[]>([])
  const [espacioSel, setEspacioSel] = useState<number | null>(null)
  const [espacioBusqueda, setEspacioBusqueda] = useState('')
  const [espacioDropdownAbierto, setEspacioDropdownAbierto] = useState(false)

  const cargarUbicaciones = useCallback(async () => {
    try {
      const data = await ubicacionesDocsApi.listar()
      setUbicaciones(data)
      setAreas(data.filter((u) => u.tipo_ubicacion === 'AREA'))
    } catch { /* */ }
  }, [])

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
      setCrearError('Debes seleccionar un área cuando el alcance es AREA.')
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
  const [docsEspacio, setDocsEspacio] = useState<Documento[]>([])
  const [cargandoDocsEspacio, setCargandoDocsEspacio] = useState(false)
  const [confirmEliminarEspacio, setConfirmEliminarEspacio] = useState<EspacioTrabajo | null>(null)

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
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
                  {cargandoConv ? (
                    <p className="text-sm text-texto-muted text-center">{t('cargando') ?? 'Cargando...'}</p>
                  ) : mensajes.length === 0 && !respuestaEnCurso ? (
                    <p className="text-sm text-texto-muted text-center py-8">{t('placeholderPrimerMensaje')}</p>
                  ) : (
                    <>
                      {mensajes.map((m) => (
                        <Mensaje key={m.id_mensaje} mensaje={m} />
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
                        />
                      )}
                      {enviando && !respuestaEnCurso && (
                        <div className="text-xs text-texto-muted italic px-2">{t('pensando')}</div>
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

                {/* ── Barra inferior de filtros + Crear Espacio ── */}
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
                      <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-borde rounded-lg shadow-lg z-20 max-h-64 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-borde">
                          <Input
                            autoFocus
                            placeholder="Buscar área…"
                            value={areaBusqueda}
                            onChange={(e) => setAreaBusqueda(e.target.value)}
                            icono={<Search size={13} />}
                          />
                        </div>
                        <div className="overflow-y-auto flex-1 text-xs">
                          {areasFiltradas.length === 0 ? (
                            <p className="text-texto-muted text-center py-3">Sin coincidencias</p>
                          ) : areasFiltradas.map((a) => (
                            <button
                              key={a.codigo_ubicacion}
                              onClick={() => {
                                setAreaSel(a.codigo_ubicacion)
                                setAreaDropdownAbierto(false)
                                setAreaBusqueda('')
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-primario-muy-claro flex flex-col"
                            >
                              <span className="font-medium text-texto">{a.alias_ubicacion || a.nombre_ubicacion}</span>
                              {a.ruta_completa && (
                                <span className="text-texto-muted text-[10px] truncate">{a.ruta_completa}</span>
                              )}
                            </button>
                          ))}
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
                        <div className="p-2 border-b border-borde">
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
                                {e.tipo_espacio}
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
              </>
            )}
          </main>
        </div>
      )}

      {/* ── TAB 2: Espacios de Trabajo ── */}
      {tabPagina === 'documentos' && (
        <div className="flex flex-1 gap-4 max-w-full overflow-hidden">
          {/* Cola lateral: lista de espacios visibles, ordenados por última actividad */}
          <aside className="w-72 flex-shrink-0 flex flex-col border border-borde rounded-lg bg-surface overflow-hidden">
            <div className="px-3 py-2 border-b border-borde flex items-center justify-between">
              <h3 className="text-sm font-semibold text-texto">Mis Espacios</h3>
              <button
                onClick={abrirModalCrear}
                className="p-1.5 rounded hover:bg-primario-muy-claro text-primario"
                title="Crear Espacio de Trabajo"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {espacios.length === 0 ? (
                <p className="text-xs text-texto-muted text-center py-6">
                  No tienes espacios todavía. Crea uno con el botón +.
                </p>
              ) : (
                espaciosFiltrados.map((e) => {
                  const activo = e.id_espacio === espacioActivoId
                  const esArea = e.tipo_espacio === 'AREA'
                  const dias = e.fecha_termino
                    ? Math.max(0, Math.ceil((new Date(e.fecha_termino).getTime() - Date.now()) / 86_400_000))
                    : null
                  return (
                    <button
                      key={e.id_espacio}
                      onClick={() => setEspacioActivoId(e.id_espacio)}
                      className={`text-left px-3 py-2 rounded text-sm transition ${
                        activo
                          ? 'bg-primario-muy-claro text-primario font-medium ring-1 ring-primario/30'
                          : 'hover:bg-fondo text-texto'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <Insignia variante={esArea ? 'advertencia' : 'exito'}>
                          {e.tipo_espacio}
                        </Insignia>
                        <span className="flex-1 truncate font-medium">{e.nombre_espacio}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-texto-muted">
                        <span>{e.alcance}</span>
                        <span>
                          {esArea && dias !== null ? `${dias}d` : '·'} {e.total_documentos ?? 0} docs
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          {/* Detalle del espacio activo */}
          <main className="flex-1 flex flex-col bg-white border border-borde rounded-lg overflow-hidden min-w-0">
            {!espacioActivoObj ? (
              <div className="flex-1 flex flex-col items-center justify-center text-texto-muted text-sm gap-3">
                <FolderOpen size={48} className="opacity-30" />
                <p>Selecciona un espacio de la lista o crea uno nuevo.</p>
                <Boton variante="primario" tamano="sm" onClick={abrirModalCrear}>
                  <Plus size={14} /> Crear Espacio
                </Boton>
              </div>
            ) : (
              <>
                {/* Encabezado del espacio */}
                <div className="border-b border-borde p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-texto">{espacioActivoObj.nombre_espacio}</h2>
                      <Insignia variante={espacioActivoObj.tipo_espacio === 'AREA' ? 'advertencia' : 'exito'}>
                        {espacioActivoObj.tipo_espacio}
                      </Insignia>
                      <Insignia variante="neutro">{espacioActivoObj.alcance}</Insignia>
                    </div>
                    <div className="flex gap-1 shrink-0">
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
                    {espacioActivoObj.tipo_espacio === 'AREA' && espacioActivoObj.fecha_termino && (
                      <span>
                        Vence: {new Date(espacioActivoObj.fecha_termino).toLocaleDateString('es-CL')}
                      </span>
                    )}
                    {espacioActivoObj.fecha_ultimo_refresco && (
                      <span>
                        Último refresco:{' '}
                        {new Date(espacioActivoObj.fecha_ultimo_refresco).toLocaleString('es-CL')}
                      </span>
                    )}
                    {espacioActivoObj.alcance === 'AREA' && espacioActivoObj.codigo_ubicacion_area && (
                      <span>
                        Área: {ubicaciones.find((u) => u.codigo_ubicacion === espacioActivoObj.codigo_ubicacion_area)?.alias_ubicacion
                          || ubicaciones.find((u) => u.codigo_ubicacion === espacioActivoObj.codigo_ubicacion_area)?.nombre_ubicacion
                          || espacioActivoObj.codigo_ubicacion_area}
                      </span>
                    )}
                  </div>
                </div>

                {/* Criterio (prompt) editable + botón refrescar */}
                <div className="border-b border-borde p-4 flex flex-col gap-2">
                  <label className="text-xs font-semibold text-texto uppercase tracking-wide">
                    Criterio del espacio (en palabras)
                  </label>
                  <textarea
                    value={criterioEdit}
                    onChange={(e) => { setCriterioEdit(e.target.value); setCriterioCambios(true) }}
                    placeholder="Ej: Documentos sobre licitaciones del 2024 con estado VECTORIZADO"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                  />
                  <div className="flex items-center gap-2 justify-between">
                    <p className="text-xs text-texto-muted">
                      Cualquiera del alcance puede editar el criterio. Pulsa Refrescar para volver a aplicarlo.
                    </p>
                    <div className="flex gap-2">
                      {criterioCambios && (
                        <Boton variante="contorno" tamano="sm" onClick={guardarCriterio}>
                          Guardar criterio
                        </Boton>
                      )}
                      <Boton variante="primario" tamano="sm" onClick={refrescarEspacio} cargando={refrescando}>
                        <RefreshCw size={14} className={refrescando ? 'animate-spin' : ''} />
                        <span className="ml-1">Refrescar</span>
                      </Boton>
                    </div>
                  </div>
                </div>

                {/* Documentos del espacio */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-texto">
                      Documentos ({docsEspacio.length})
                    </h4>
                  </div>
                  <Tabla>
                    <TablaCabecera>
                      <tr>
                        <TablaTh>Documento</TablaTh>
                        <TablaTh>Ubicación</TablaTh>
                        <TablaTh>Estado</TablaTh>
                      </tr>
                    </TablaCabecera>
                    <TablaCuerpo>
                      {cargandoDocsEspacio ? (
                        <TablaFila>
                          <TablaTd className="py-8 text-center text-texto-muted" colSpan={3 as never}>
                            Cargando documentos…
                          </TablaTd>
                        </TablaFila>
                      ) : docsEspacio.length === 0 ? (
                        <TablaFila>
                          <TablaTd className="py-8 text-center text-texto-muted" colSpan={3 as never}>
                            <div className="flex flex-col items-center gap-2">
                              <FileText size={32} className="opacity-30" />
                              <span>Sin documentos. Edita el criterio y refresca para poblarlos.</span>
                            </div>
                          </TablaTd>
                        </TablaFila>
                      ) : (
                        docsEspacio.map((d) => (
                          <TablaFila key={d.codigo_documento}>
                            <TablaTd>
                              <span className="font-medium text-sm">{d.nombre_documento}</span>
                            </TablaTd>
                            <TablaTd className="text-xs text-texto-muted max-w-[280px] truncate" title={d.ubicacion_documento || ''}>
                              {d.ubicacion_documento || '—'}
                            </TablaTd>
                            <TablaTd>
                              <Insignia variante={iconoEstado(d.codigo_estado_doc)}>
                                {d.codigo_estado_doc || '—'}
                              </Insignia>
                            </TablaTd>
                          </TablaFila>
                        ))
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
                <option value="AREA">AREA — temporal</option>
                <option value="ESPACIO">ESPACIO — permanente</option>
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
                <option value="USUARIO">USUARIO — solo yo</option>
                <option value="AREA">AREA — un área</option>
                <option value="ENTIDAD">ENTIDAD — toda la entidad</option>
              </select>
            </div>
          </div>
          {crearForm.alcance === 'AREA' && (
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Área destino</label>
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
    </div>
  )
}

// ── Subcomponente Mensaje ──────────────────────────────────────────────────────

function Mensaje({ mensaje, streaming = false }: { mensaje: ChatMensaje; streaming?: boolean }) {
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
                  const esInterno = hrefSeguro.startsWith('/')
                  return (
                    <a href={hrefSeguro} target={esInterno ? undefined : '_blank'} rel={esInterno ? undefined : 'noopener noreferrer'} className="text-primario underline hover:text-primario-hover" {...props}>
                      {children}
                    </a>
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
