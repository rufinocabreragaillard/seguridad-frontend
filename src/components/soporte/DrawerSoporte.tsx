'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Send, HelpCircle } from 'lucide-react'
import { useSoporte } from '@/context/SoporteContext'
import { chatApi } from '@/lib/api'
import type { ChatMensaje } from '@/lib/tipos'

const CODIGO_FUNCION = 'CHAT-SOPORTE'

interface MensajeUI {
  rol: 'user' | 'assistant'
  contenido: string
}

export function DrawerSoporte() {
  const tr = useTranslations('drawerSoporte')
  const tc = useTranslations('common')
  const { abierto, cerrar } = useSoporte()
  const [idConversacion, setIdConversacion] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<MensajeUI[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargandoConv, setCargandoConv] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inicializadoRef = useRef(false)

  useEffect(() => {
    if (!abierto || inicializadoRef.current) return
    inicializadoRef.current = true
    setCargandoConv(true)
    ;(async () => {
      try {
        const lista = await chatApi.listarConversaciones({ codigo_funcion: CODIGO_FUNCION })
        if (lista.length > 0) {
          const conv = lista[0]
          const detalle = await chatApi.obtenerConversacion(conv.id_conversacion)
          setIdConversacion(detalle.id_conversacion)
          setMensajes(
            (detalle.mensajes || [])
              .filter((m: ChatMensaje) => m.rol === 'user' || m.rol === 'assistant')
              .map((m: ChatMensaje) => ({ rol: m.rol as 'user' | 'assistant', contenido: m.contenido })),
          )
        } else {
          const nueva = await chatApi.crearConversacion(CODIGO_FUNCION, 'Soporte')
          setIdConversacion(nueva.id_conversacion)
          setMensajes([
            {
              rol: 'assistant',
              contenido: tr('mensajeBienvenida'),
            },
          ])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : tr('errorInicioChat'))
      } finally {
        setCargandoConv(false)
      }
    })()
  }, [abierto])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  if (!abierto) return null

  const enviar = async () => {
    const t = texto.trim()
    if (!t || enviando || !idConversacion) return
    setError(null)
    setTexto('')
    setMensajes((prev) => [...prev, { rol: 'user', contenido: t }, { rol: 'assistant', contenido: '' }])
    setEnviando(true)
    try {
      await chatApi.enviarMensajeStream(idConversacion, t, {
        onChunk: (chunk) => {
          setMensajes((prev) => {
            const arr = [...prev]
            const last = arr[arr.length - 1]
            if (last && last.rol === 'assistant') {
              arr[arr.length - 1] = { ...last, contenido: last.contenido + chunk }
            }
            return arr
          })
        },
        onDone: () => setEnviando(false),
        onError: (msg) => {
          setError(msg)
          setEnviando(false)
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('errorEnvioMensaje'))
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar()
      }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <aside className="relative h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <header className="flex items-center justify-between px-4 py-3 border-b bg-sidebar border-sidebar-texto/20">
          <div className="flex items-center gap-2 text-sidebar-texto">
            <HelpCircle size={20} />
            <h2 className="font-semibold">{tr('titulo')}</h2>
          </div>
          <button onClick={cerrar} className="text-sidebar-texto hover:opacity-80" aria-label={tr('cerrarSoporte')}>
            <X size={20} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {cargandoConv && (
            <p className="text-sm text-gray-500 text-center">{tc('cargando2')}</p>
          )}
          {mensajes.map((m, i) => (
            <div key={i} className={m.rol === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.rol === 'user'
                    ? 'max-w-[85%] rounded-lg px-3 py-2 text-sm bg-sidebar text-sidebar-texto'
                    : 'max-w-[85%] rounded-lg px-3 py-2 text-sm bg-white border text-gray-800'
                }
              >
                {m.contenido || (enviando && i === mensajes.length - 1 ? '…' : '')}
              </div>
            </div>
          ))}
          {error && (
            <p className="text-xs text-red-600 text-center">{error}</p>
          )}
        </div>

        <footer className="border-t p-3 bg-white">
          <div className="flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder={tr('placeholderConsulta')}
              className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ minHeight: '40px', maxHeight: '120px' }}
              rows={1}
              disabled={enviando || !idConversacion}
            />
            <button
              onClick={enviar}
              disabled={enviando || !texto.trim() || !idConversacion}
              className="px-3 rounded-lg bg-sidebar text-sidebar-texto disabled:opacity-50"
              aria-label={tr('enviar')}
            >
              <Send size={18} />
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
