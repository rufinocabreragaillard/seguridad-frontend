'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Loader2, Bot, User } from 'lucide-react'
import { api } from '@/lib/api'
import type { EstadoDoc } from '@/lib/tipos'

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  ruta_completa: string
  nivel: number
}

// Tipo local para los procesos del catálogo (tal como llegan de GET /procesos)
interface ProcesoCatalogo {
  codigo_proceso: string
  nombre_proceso: string
  pasos?: Array<{
    estado_origen?: string | null
    estado_destino: string
  }>
}

interface Accion {
  tipo: 'ejecutar_proceso' | 'cambiar_estado' | 'info'
  proceso?: string
  estado_origen?: string
  estado_destino?: string
  ubicacion?: string
  tope?: number
}

interface RespuestaChat {
  explicacion: string
  acciones: Accion[]
  ejecutado: boolean
}

interface Mensaje {
  rol: 'user' | 'assistant'
  texto: string
  acciones?: Accion[]
  ejecutado?: boolean
}

interface Props {
  procesos: ProcesoCatalogo[]
  ubicaciones: UbicacionOption[]
  estadosDocs: EstadoDoc[]
  onEjecutar: (proceso: string, tope?: number, ubicacion?: string) => void
  onCambiarEstado: (estadoOrigen: string, estadoDestino: string, ubicacion?: string, tope?: number) => void
}

export function ChatProcesar({ procesos, ubicaciones, estadosDocs, onEjecutar, onCambiarEstado }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([{
    rol: 'assistant',
    texto: '¡Hola! Puedo ayudarte a procesar documentos. Escribe comandos como:\n• "Ejecuta ANALIZAR en los primeros 10"\n• "Cambia a ESCANEADO los de la ubicación X"\n• "¿Cuántos hay en METADATA?"'
  }])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (abierto) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, abierto])

  const enviar = async () => {
    const texto = input.trim()
    if (!texto || enviando) return

    setInput('')
    setMensajes((prev) => [...prev, { rol: 'user', texto }])
    setEnviando(true)

    try {
      const res = await api.post<RespuestaChat>('/documentos/chat-comando', {
        mensaje: texto,
        contexto: {
          procesos: procesos.map((p) => ({
            codigo: p.codigo_proceso,
            nombre: p.nombre_proceso,
            estado_origen: p.pasos?.[0]?.estado_origen ?? null,
            estado_destino: p.pasos?.[0]?.estado_destino ?? null,
          })),
          ubicaciones: ubicaciones.slice(0, 30).map((u) => ({
            codigo: u.codigo_ubicacion,
            nombre: u.nombre_ubicacion,
            ruta: u.ruta_completa,
          })),
          estados: estadosDocs.map((e) => e.codigo_estado_doc),
        },
      })

      const data = res.data
      setMensajes((prev) => [...prev, {
        rol: 'assistant',
        texto: data.explicacion,
        acciones: data.acciones,
        ejecutado: data.ejecutado,
      }])

      // Ejecutar acciones si las hay
      if (data.acciones && data.acciones.length > 0) {
        for (const accion of data.acciones) {
          if (accion.tipo === 'ejecutar_proceso' && accion.proceso) {
            onEjecutar(accion.proceso, accion.tope, accion.ubicacion)
          } else if (accion.tipo === 'cambiar_estado' && accion.estado_origen && accion.estado_destino) {
            onCambiarEstado(accion.estado_origen, accion.estado_destino, accion.ubicacion, accion.tope)
          }
        }
      }
    } catch {
      setMensajes((prev) => [...prev, {
        rol: 'assistant',
        texto: 'Lo siento, ocurrió un error al procesar tu comando. Intenta de nuevo.',
      }])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primario text-primario-texto shadow-lg hover:bg-primario-oscuro transition-colors flex items-center justify-center"
        title="Chat de procesamiento"
      >
        {abierto ? <X size={20} /> : <MessageSquare size={20} />}
      </button>

      {/* Panel de chat */}
      {abierto && (
        <div className="fixed bottom-20 right-6 z-50 w-80 h-96 bg-surface border border-borde rounded-xl shadow-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-primario text-primario-texto">
            <Bot size={16} />
            <span className="text-sm font-medium">Asistente de Procesamiento</span>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.rol === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primario-muy-claro flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-primario" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs whitespace-pre-wrap ${
                  m.rol === 'user'
                    ? 'bg-primario text-primario-texto rounded-br-none'
                    : 'bg-fondo text-texto border border-borde rounded-bl-none'
                }`}>
                  {m.texto}
                  {m.acciones && m.acciones.length > 0 && !m.ejecutado && (
                    <p className="text-[10px] mt-1 opacity-70">⚡ Acción preparada en el formulario</p>
                  )}
                  {m.ejecutado && (
                    <p className="text-[10px] mt-1 opacity-70">✓ Acción aplicada</p>
                  )}
                </div>
                {m.rol === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-primario-muy-claro flex items-center justify-center shrink-0 mt-0.5">
                    <User size={12} className="text-primario" />
                  </div>
                )}
              </div>
            ))}
            {enviando && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primario-muy-claro flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-primario" />
                </div>
                <div className="bg-fondo border border-borde rounded-lg rounded-bl-none px-3 py-1.5">
                  <Loader2 size={14} className="animate-spin text-primario" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-borde flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
              placeholder="Escribe un comando..."
              disabled={enviando}
              className="flex-1 text-xs border border-borde rounded-lg px-2.5 py-1.5 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario placeholder:text-texto-muted disabled:opacity-50"
            />
            <button
              onClick={enviar}
              disabled={enviando || !input.trim()}
              className="w-8 h-8 rounded-lg bg-primario text-primario-texto flex items-center justify-center hover:bg-primario-oscuro transition-colors disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
