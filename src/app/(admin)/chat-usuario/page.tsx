'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef, useCallback, KeyboardEvent } from 'react'
import { Plus, Trash2, Send, MessageCircle, FolderOpen, Search, FileText, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { chatApi, documentosApi, ubicacionesDocsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { ChatConversacion, ChatMensaje, Documento, UbicacionDoc } from '@/lib/tipos'

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
  const { grupoActivo } = useAuth()
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
    await chatApi.enviarMensajeStream(convActivaId, texto, {
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
    })
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
  // TAB 2 — Documentos
  // ══════════════════════════════════════════
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicBusqueda, setUbicBusqueda] = useState('')
  const [documentosTab, setDocumentosTab] = useState<Documento[]>([])
  const [cargandoDocs, setCargandoDocs] = useState(false)
  const [busquedaDocs, setBusquedaDocs] = useState('')

  const cargarUbicaciones = useCallback(async () => {
    try {
      const data = await ubicacionesDocsApi.listar()
      setUbicaciones(data)
    } catch { /* */ }
  }, [])

  const cargarDocumentosTab = useCallback(async () => {
    setCargandoDocs(true)
    try {
      const todos = await documentosApi.listar({ limit: 500 })
      setDocumentosTab(todos)
    } finally {
      setCargandoDocs(false)
    }
  }, [])

  useEffect(() => {
    if (tabPagina === 'documentos') {
      cargarUbicaciones()
      cargarDocumentosTab()
    }
  }, [tabPagina, cargarUbicaciones, cargarDocumentosTab, grupoActivo])

  const ubicacionesFiltradas = ubicaciones.filter((u) =>
    !ubicBusqueda ||
    u.nombre_ubicacion.toLowerCase().includes(ubicBusqueda.toLowerCase()) ||
    (u.ruta_completa || '').toLowerCase().includes(ubicBusqueda.toLowerCase())
  ).sort((a, b) => (a.ruta_completa || '').localeCompare(b.ruta_completa || ''))

  const documentosFiltrados = documentosTab
    .filter((d) => {
      const matchUbic = !ubicacionSel ||
        (() => {
          const ubic = ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)
          if (!ubic?.ruta_completa) return true
          return (d.ubicacion_documento || '').startsWith(ubic.ruta_completa)
        })()
      const matchBusqueda = !busquedaDocs ||
        d.nombre_documento.toLowerCase().includes(busquedaDocs.toLowerCase()) ||
        (d.ubicacion_documento || '').toLowerCase().includes(busquedaDocs.toLowerCase())
      return matchUbic && matchBusqueda
    })
    .sort((a, b) => (a.ubicacion_documento || '').localeCompare(b.ubicacion_documento || '') || a.nombre_documento.localeCompare(b.nombre_documento))

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
          <aside className="w-64 flex-shrink-0 flex flex-col gap-2 border border-borde rounded-lg bg-fondo-tarjeta overflow-hidden">
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
              </>
            )}
          </main>
        </div>
      )}

      {/* ── TAB 2: Documentos ── */}
      {tabPagina === 'documentos' && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4">
          {/* Selector de espacio de trabajo */}
          <div className="bg-fondo-tarjeta border border-borde rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-primario shrink-0" />
              <span className="text-sm font-semibold text-texto">Espacio de trabajo</span>
            </div>

            <div className="flex gap-3 items-start flex-wrap">
              {/* Filtro de búsqueda de ubicación */}
              <div className="w-64">
                <Input
                  placeholder="Buscar espacio de trabajo..."
                  value={ubicBusqueda}
                  onChange={(e) => setUbicBusqueda(e.target.value)}
                  icono={<Search size={14} />}
                />
              </div>

              {/* Selector de ubicación */}
              <div className="flex-1 min-w-[280px] flex items-center gap-2">
                <select
                  value={ubicacionSel}
                  onChange={(e) => { setUbicacionSel(e.target.value); setBusquedaDocs('') }}
                  className="flex-1 border border-borde rounded-lg px-3 py-2 text-sm bg-white text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                >
                  <option value="">— Todos los documentos —</option>
                  {ubicacionesFiltradas.map((u) => (
                    <option key={u.codigo_ubicacion} value={u.codigo_ubicacion}>
                      {'  '.repeat(Math.max(0, u.nivel - 1))}{u.nombre_ubicacion}
                      {u.ruta_completa ? ` (${u.ruta_completa})` : ''}
                    </option>
                  ))}
                </select>
                {ubicacionSel && (
                  <button
                    onClick={() => setUbicacionSel('')}
                    className="p-1.5 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                    title="Limpiar selección"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {ubicacionSel && (
              <div className="flex items-center gap-2 text-xs text-primario bg-primario-muy-claro rounded px-3 py-1.5">
                <FolderOpen size={13} />
                <span className="font-medium">
                  {ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)?.ruta_completa || ubicacionSel}
                </span>
              </div>
            )}
          </div>

          {/* Búsqueda dentro de documentos */}
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input
                placeholder="Buscar documentos..."
                value={busquedaDocs}
                onChange={(e) => setBusquedaDocs(e.target.value)}
                icono={<Search size={15} />}
              />
            </div>
            <span className="text-sm text-texto-muted ml-auto">
              {documentosFiltrados.length} documento{documentosFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tabla de documentos */}
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>Documento</TablaTh>
                <TablaTh>Ubicación</TablaTh>
                <TablaTh>Estado</TablaTh>
                <TablaTh>Tamaño</TablaTh>
                <TablaTh>Modificado</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargandoDocs ? (
                <TablaFila>
                  <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                    Cargando documentos...
                  </TablaTd>
                </TablaFila>
              ) : documentosFiltrados.length === 0 ? (
                <TablaFila>
                  <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} className="opacity-30" />
                      <span>{ubicacionSel ? 'Sin documentos en este espacio de trabajo' : 'Sin documentos'}</span>
                    </div>
                  </TablaTd>
                </TablaFila>
              ) : (
                documentosFiltrados.map((d) => (
                  <TablaFila key={d.codigo_documento}>
                    <TablaTd>
                      <span className="font-medium text-sm">{d.nombre_documento}</span>
                    </TablaTd>
                    <TablaTd className="text-xs text-texto-muted max-w-[250px] truncate" title={d.ubicacion_documento || ''}>
                      {d.ubicacion_documento || '—'}
                    </TablaTd>
                    <TablaTd>
                      <Insignia variante={iconoEstado(d.codigo_estado_doc)}>
                        {d.codigo_estado_doc || '—'}
                      </Insignia>
                    </TablaTd>
                    <TablaTd className="text-xs text-texto-muted">
                      {d.tamano_kb != null ? `${d.tamano_kb.toLocaleString('es-CL')} KB` : '—'}
                    </TablaTd>
                    <TablaTd className="text-xs text-texto-muted">
                      {d.fecha_modificacion
                        ? new Date(d.fecha_modificacion).toLocaleDateString('es-CL')
                        : '—'}
                    </TablaTd>
                  </TablaFila>
                ))
              )}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}
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
