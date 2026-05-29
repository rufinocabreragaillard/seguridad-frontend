/**
 * useColaRealtime — suscripción Supabase Realtime para cola_estados_docs.
 *
 * Reemplaza el polling cada 3 segundos de procesar-documentos y
 * tab-pipeline-todo por notificaciones push de Supabase.
 *
 * Uso:
 *   const { suscribir, desuscribir } = useColaRealtime(grupoActivo, onCambio)
 *
 *   // Al iniciar el proceso:
 *   suscribir()
 *
 *   // Al terminar o desmontar:
 *   desuscribir()
 *
 * onCambio recibe el payload completo del cambio (eventType + new + old).
 * El componente decide qué hacer con esos datos.
 *
 * NOTA: Requiere migración 105 (RLS + supabase_realtime publication).
 * El cliente Supabase usa el JWT del usuario autenticado para respetar RLS.
 */
'use client'

import { useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Tipo de payload que Supabase Realtime envía para cambios en postgres
export type ColaRealtimePayload = RealtimePostgresChangesPayload<{
  id_cola: number
  codigo_grupo: string
  codigo_documento: string
  codigo_estado_doc_destino: string
  estado_cola: string
  resultado?: string
  fecha_inicio?: string
  fecha_fin?: string
  [key: string]: unknown
}>

export type OnCambioCola = (payload: ColaRealtimePayload) => void

export function useColaRealtime(grupoActivo: string | null, onCambio: OnCambioCola) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reintentoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suscribirRef = useRef<() => void>(() => {})
  const grupoRef = useRef(grupoActivo)
  grupoRef.current = grupoActivo

  const suscribir = useCallback(() => {
    if (!grupoRef.current) return  // sin grupo activo no hay nada que suscribir

    // Limpiar suscripción anterior si existe
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const canal = supabase
      .channel(`cola-${grupoRef.current ?? 'sin_grupo'}-${Date.now()}`)
      .on<{
        id_cola: number
        codigo_grupo: string
        codigo_documento: string
        codigo_estado_doc_destino: string
        estado_cola: string
        resultado?: string
        fecha_inicio?: string
        fecha_fin?: string
        [key: string]: unknown
      }>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cola_estados_docs',
          filter: `codigo_grupo=eq.${grupoRef.current}`,
        },
        (payload) => {
          onCambio(payload as ColaRealtimePayload)
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[useColaRealtime] Canal Realtime caído:', status, '— reintentando en 5s')
          // Reintento programado: el canal se pierde típicamente por token
          // expirado durante procesos largos. Tras refresh JWT (interceptor 401)
          // la re-suscripción debe levantar.
          if (reintentoRef.current) clearTimeout(reintentoRef.current)
          reintentoRef.current = setTimeout(() => {
            reintentoRef.current = null
            // Sólo re-suscribir si seguimos en el mismo grupo y no se hizo desuscribir
            if (grupoRef.current && channelRef.current === canal) {
              suscribirRef.current()
            }
          }, 5000)
        }
      })

    channelRef.current = canal
  }, [onCambio])

  // Mantener ref al último `suscribir` para que el callback de reintento
  // pueda invocarlo sin crear un ciclo de dependencias en el useCallback.
  suscribirRef.current = suscribir

  const desuscribir = useCallback(() => {
    if (reintentoRef.current) {
      clearTimeout(reintentoRef.current)
      reintentoRef.current = null
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  return { suscribir, desuscribir }
}
