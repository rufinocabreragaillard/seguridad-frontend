'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef, useCallback, KeyboardEvent } from 'react'
import { Plus, Trash2, Send, ShieldHalf, Pencil, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Boton } from '@/components/ui/boton'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { chatApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { ChatConversacion, ChatMensaje } from '@/lib/tipos'

const CODIGO_FUNCION = 'CHAT_SEG_ADMIN_GRUPO'

export default function PaginaChatSegGrupo() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('chat')
  const tc = useTranslations('common')

  const [conversaciones, setConversaciones] = useState<ChatConversacion[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState('')

  const [convActivaId, setConvActivaId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [tituloActivo, setTituloActivo] = useState('')
  const [nombreModelo, setNombreModelo] = useState<string | null>(null)
  const [cargandoConv, setCargandoConv] = useState(false)
  const [errorConv, setErrorConv] = useState('')

  const [textoInput, setTextoInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [respuestaEnCurso, setRespuestaEnCurso] = useState('')

  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [tituloEdit, setTituloEdit] = useState('')

  const [convAEliminar, setConvAEliminar] = useState<ChatConversacion | null>(null)
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
    setTituloActivo('')
    setNombreModelo(null)
  }, [grupoActivo])

  const cargarConversacion = useCallback(async (id: number) => {
    setCargandoConv(true)
    setErrorConv('')
    try {
      const data = await chatApi.obtenerConversacion(id)
      setMensajes(data.mensajes || [])
      setTituloActivo(data.titulo)
      setNombreModelo(data.nombre_modelo || null)
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

  const iniciarEditarTitulo = () => {
    setTituloEdit(tituloActivo)
    setEditandoTitulo(true)
  }

  const guardarTitulo = async () => {
    if (!convActivaId || !tituloEdit.trim()) {
      setEditandoTitulo(false)
      return
    }
    try {
      await chatApi.renombrarConversacion(convActivaId, tituloEdit.trim())
      setTituloActivo(tituloEdit.trim())
      cargarLista()
    } catch { /* error silencioso */ }
    setEditandoTitulo(false)
  }

  const confirmarEliminar = async () => {
    if (!convAEliminar) return
    setEliminando(true)
    try {
      await chatApi.eliminarConversacion(convAEliminar.id_conversacion)
      const idEliminado = convAEliminar.id_conversacion
      setConvAEliminar(null)
      if (convActivaId === idEliminado) {
        setConvActivaId(null)
        setMensajes([])
        setTituloActivo('')
      }
      await cargarLista()
    } catch { /* */ }
    setEliminando(false)
  }

  return (
    <div className="flex h-[calc(100vh-160px)] gap-4 max-w-full">
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
            <p className="text-xs text-texto-muted text-center py-4">{t('cargando')}</p>
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
                  <ShieldHalf size={14} className="mt-0.5 shrink-0" />
                  <span className="flex-1 truncate" title={c.titulo}>{c.titulo}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConvAEliminar(c) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-texto-muted hover:text-error"
                    title={tc('eliminar')}
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
      <main className="flex-1 flex flex-col border border-borde rounded-lg bg-fondo-tarjeta overflow-hidden min-w-0">
        {convActivaId == null ? (
          <div className="flex-1 flex items-center justify-center text-texto-muted text-sm flex-col gap-3">
            <ShieldHalf size={48} className="opacity-30" />
            <p className="text-center max-w-sm">
              {t('msgSegGrupo')}
            </p>
            <Boton variante="primario" tamano="sm" onClick={nuevaConversacion}>
              <Plus size={14} /> {t('nuevaConversacionBoton')}
            </Boton>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-borde flex items-center gap-2">
              {editandoTitulo ? (
                <>
                  <input
                    type="text"
                    value={tituloEdit}
                    onChange={(e) => setTituloEdit(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardarTitulo() }}
                    autoFocus
                    className="flex-1 px-2 py-1 text-sm border border-borde rounded bg-surface text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                  />
                  <button onClick={guardarTitulo} className="p-1 text-exito hover:bg-green-50 rounded"><Check size={16} /></button>
                  <button onClick={() => setEditandoTitulo(false)} className="p-1 text-texto-muted hover:bg-fondo rounded"><X size={16} /></button>
                </>
              ) : (
                <>
                  <h2 className="flex-1 section-heading truncate" title={tituloActivo}>
                    {tituloActivo || t('titulo')}
                  </h2>
                  <button
                    onClick={iniciarEditarTitulo}
                    className="p-1 rounded hover:bg-fondo text-texto-muted"
                    title={t('tituloSegGrupo')}
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
              {nombreModelo && (
                <span className="text-xs bg-primario/10 text-primario px-2 py-0.5 rounded ml-2 shrink-0">
                  {nombreModelo}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {cargandoConv ? (
                <p className="text-sm text-texto-muted text-center">{t('cargando')}</p>
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

            <div className="border-t border-borde p-3 flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={textoInput}
                onChange={(e) => setTextoInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('placeholderSegGrupo')}
                disabled={enviando}
                rows={2}
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
  )
}

function Mensaje({ mensaje, streaming = false }: { mensaje: ChatMensaje; streaming?: boolean }) {
  const esUser = mensaje.rol === 'user'
  const tieneTabla = !esUser && /(^|\n)\s*\|.*\|.*\n\s*\|[-:| ]+\|/.test(mensaje.contenido)
  return (
    <div className={`flex ${esUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${tieneTabla ? 'max-w-[95%] w-full' : 'max-w-[80%]'} px-4 py-2 rounded-lg text-sm ${
          esUser
            ? 'bg-primario text-primario-texto'
            : 'bg-white border border-borde text-texto'
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
