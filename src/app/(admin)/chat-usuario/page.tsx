'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef, useCallback, KeyboardEvent } from 'react'
import { Plus, Trash2, Send, MessageCircle, FolderOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Boton } from '@/components/ui/boton'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { chatApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { ChatConversacion, ChatMensaje } from '@/lib/tipos'
import EspaciosTrabajoPage from '../espacios-trabajo/page'

const CODIGO_FUNCION = 'CHAT-USUARIO'

type TabPrincipal = 'chat' | 'espacios'

export default function PaginaChatUsuario() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('chat')
  const tc = useTranslations('common')

  const [tabActiva, setTabActiva] = useState<TabPrincipal>('chat')

  // Lista de conversaciones (sidebar)
  const [conversaciones, setConversaciones] = useState<ChatConversacion[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState('')

  // Conversación activa
  const [convActivaId, setConvActivaId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [cargandoConv, setCargandoConv] = useState(false)
  const [errorConv, setErrorConv] = useState('')

  // Input del usuario
  const [textoInput, setTextoInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [respuestaEnCurso, setRespuestaEnCurso] = useState('')

  // Confirmación de eliminación
  const [convAEliminar, setConvAEliminar] = useState<ChatConversacion | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Refs para auto-scroll
  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Carga de la lista de conversaciones ─────────────────────────────────
  const cargarLista = useCallback(async () => {
    setCargandoLista(true)
    setErrorLista('')
    try {
      const data = await chatApi.listarConversaciones()
      setConversaciones(data)
      // Si no hay activa y existen, seleccionar la primera
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

  // Reset al cambiar de grupo
  useEffect(() => {
    setConvActivaId(null)
    setMensajes([])
  }, [grupoActivo])

  // ── Carga de la conversación activa ─────────────────────────────────────
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
    if (convActivaId != null) {
      cargarConversacion(convActivaId)
    }
  }, [convActivaId, cargarConversacion])

  // Auto-scroll al fondo cuando llegan mensajes o chunks
  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, respuestaEnCurso])

  // ── Acciones ────────────────────────────────────────────────────────────

  const nuevaConversacion = async () => {
    setErrorLista('')
    try {
      const nueva = await chatApi.crearConversacion(CODIGO_FUNCION)
      // Recargar lista (puede haber FIFO eliminando una vieja)
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

    // Agregar mensaje del usuario localmente (optimistic UI)
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
        // Reemplazar el mensaje temp con los reales y agregar la respuesta
        // Recargar la conversación es lo más simple y confiable
        setRespuestaEnCurso('')
        await cargarConversacion(convActivaId)
        // Refrescar lista (puede haber cambiado el título)
        cargarLista()
      },
      onError: (mensaje) => {
        setErrorConv(mensaje)
        setRespuestaEnCurso('')
        // Quitar el mensaje temp del usuario para que pueda reintentar
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

  const confirmarEliminar = async () => {
    if (!convAEliminar) return
    setEliminando(true)
    try {
      await chatApi.eliminarConversacion(convAEliminar.id_conversacion)
      const idEliminado = convAEliminar.id_conversacion
      setConvAEliminar(null)
      // Si era la activa, limpiar
      if (convActivaId === idEliminado) {
        setConvActivaId(null)
        setMensajes([])
      }
      await cargarLista()
    } catch { /* */ }
    setEliminando(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Lenguetas principales */}
      <div className="flex border-b border-borde mb-4 flex-shrink-0">
        <button
          onClick={() => setTabActiva('chat')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'chat'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          <MessageCircle size={15} />
          Chat
        </button>
        <button
          onClick={() => setTabActiva('espacios')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'espacios'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          <FolderOpen size={15} />
          Espacios de trabajo
        </button>
      </div>

      {/* Contenido de lengueta Espacios */}
      {tabActiva === 'espacios' && (
        <div className="flex-1 overflow-y-auto">
          <EspaciosTrabajoPage />
        </div>
      )}

      {/* Contenido de lengueta Chat */}
      {tabActiva === 'chat' && (
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
            <p className="text-xs text-texto-muted text-center py-4">
              {t('sinConversaciones')}
            </p>
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
                    onClick={(e) => { e.stopPropagation(); setConvAEliminar(c) }}
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
          <div className="px-3 py-2 text-xs text-error border-t border-borde bg-red-50">
            {errorLista}
          </div>
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
            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {cargandoConv ? (
                <p className="text-sm text-texto-muted text-center">{t('cargando') ?? 'Cargando...'}</p>
              ) : mensajes.length === 0 && !respuestaEnCurso ? (
                <p className="text-sm text-texto-muted text-center py-8">
                  {t('placeholderPrimerMensaje')}
                </p>
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
              <div className="px-4 py-2 text-sm text-error bg-red-50 border-t border-red-200">
                {errorConv}
              </div>
            )}

            {/* Input */}
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
              <Boton
                variante="primario"
                onClick={enviarMensaje}
                disabled={enviando || !textoInput.trim()}
                cargando={enviando}
              >
                <Send size={16} />
              </Boton>
            </div>
          </>
        )}
      </main>

      <ModalConfirmar
        abierto={!!convAEliminar}
        alCerrar={() => setConvAEliminar(null)}
        alConfirmar={confirmarEliminar}
        titulo={t('eliminarConversacionTitulo')}
        mensaje={convAEliminar ? t('eliminarConversacionConfirm', { titulo: convAEliminar.titulo }) : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
      )}
    </div>
  )
}

// ── Subcomponente Mensaje ─────────────────────────────────────────────────

function Mensaje({ mensaje, streaming = false }: { mensaje: ChatMensaje; streaming?: boolean }) {
  const esUser = mensaje.rol === 'user'
  // Si el mensaje del assistant contiene una tabla markdown, le damos
  // ancho casi total para que no se rompan las celdas verticalmente.
  const tieneTabla = !esUser && /(^|\n)\s*\|.*\|.*\n\s*\|[-:| ]+\|/.test(mensaje.contenido)
  return (
    <div className={`flex ${esUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${tieneTabla ? 'max-w-[95%] w-full' : 'max-w-[80%]'} px-4 py-2 rounded-lg text-sm ${
          esUser
            ? 'bg-primario text-primario-texto'
            : 'bg-white text-texto'
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
                // Tablas: wrapper con scroll horizontal y estilos explicitos.
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="border-collapse border border-borde text-xs w-full" {...props}>
                      {children}
                    </table>
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
                    <a
                      href={hrefSeguro}
                      target={esInterno ? undefined : '_blank'}
                      rel={esInterno ? undefined : 'noopener noreferrer'}
                      className="text-primario underline hover:text-primario-hover"
                      {...props}
                    >
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
