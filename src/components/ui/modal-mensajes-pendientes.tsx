'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Modal } from '@/components/ui/modal'
import { Boton } from '@/components/ui/boton'
import { useAuth } from '@/context/AuthContext'
import { mensajeriaApi, type MensajePendiente } from '@/lib/api'

/**
 * Modal de mensajes pendientes (in-app, canal CHAT).
 *
 * Al cargar el contexto de usuario, consulta GET /mensajes/pendientes con
 * disparar=true para evaluar plantillas PRIMER_LOGIN aplicables. Si hay
 * mensajes los muestra de a uno (mayor prioridad primero) y permite al usuario
 * cerrarlos (VISTO) o aceptarlos (ACEPTADO si requiere_accion).
 */
export function ModalMensajesPendientes() {
  const { usuario, cargando } = useAuth()
  const [mensajes, setMensajes] = useState<MensajePendiente[]>([])
  const [enviando, setEnviando] = useState(false)
  const [yaCargado, setYaCargado] = useState(false)

  // Carga al iniciar sesión (una sola vez por monte)
  useEffect(() => {
    if (cargando || !usuario || yaCargado) return
    setYaCargado(true)
    mensajeriaApi
      .pendientes(true)
      .then((data) => setMensajes(data))
      .catch((err) => {
        // Silencioso: si el endpoint falla, no mostramos modal
        console.warn('[ModalMensajesPendientes] error:', err)
      })
  }, [usuario, cargando, yaCargado])

  if (mensajes.length === 0) return null

  const actual = mensajes[0]
  const titulo = actual.asunto || 'Notificación'

  const cerrarConEstado = async (estado: 'VISTO' | 'ACEPTADO' | 'RECHAZADO') => {
    setEnviando(true)
    try {
      await mensajeriaApi.cambiarEstado(actual.id_mensaje, estado)
      setMensajes((prev) => prev.slice(1))
    } catch (err) {
      console.warn('[ModalMensajesPendientes] cambiar estado:', err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto={true}
      alCerrar={() => cerrarConEstado('VISTO')}
      titulo={titulo}
      className="max-w-xl"
    >
      <div className="prose prose-sm max-w-none text-texto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{actual.cuerpo}</ReactMarkdown>
      </div>

      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-borde">
        {actual.requiere_accion ? (
          <>
            <Boton variante="secundario" onClick={() => cerrarConEstado('RECHAZADO')} disabled={enviando}>
              Más tarde
            </Boton>
            <Boton variante="primario" onClick={() => cerrarConEstado('ACEPTADO')} disabled={enviando}>
              Continuar
            </Boton>
          </>
        ) : (
          <Boton variante="primario" onClick={() => cerrarConEstado('VISTO')} disabled={enviando}>
            Entendido
          </Boton>
        )}
      </div>
    </Modal>
  )
}
