'use client'

import { useState } from 'react'
import { RefreshCw, Upload } from 'lucide-react'
import { Boton } from './boton'
import { promptsApi } from '@/lib/api'

interface PieBotonesPromptsProps {
  tabla: string
  pkColumna: string
  pkValor: string | number | null
  tienePrompt?: boolean  // si no se pasa, se auto-computa desde promptInsert/promptUpdate
  promptInsert?: string | null
  promptUpdate?: string | null
  modo?: 'insert' | 'update'  // default 'insert'. Determina qué prompt se usa y qué campo se devuelve
  mostrarGenerar?: boolean
  mostrarSincronizar?: boolean
  sincronizarHabilitado?: boolean  // override del disabled de Sincronizar (undefined = lógica por defecto)
  onCodigoGenerado?: (r: { python_insert?: string | null; python_update?: string | null; javascript?: string | null }) => void
  onSincronizado?: (r: { codigo_documento: number; accion: string }) => void
  onMensaje?: (m: { tipo: 'ok' | 'error'; texto: string }) => void
}

/**
 * Botones de acción del sistema "Todo por Prompts": Generar | Sincronizar.
 * Clase separada de PieBotonesModal (Grabar/Grabar y Salir/Salir).
 * Colores distintivos: Generar = primario-oscuro, Sincronizar = primario-light.
 */
export function PieBotonesPrompts({
  tabla,
  pkColumna,
  pkValor,
  tienePrompt,
  promptInsert,
  promptUpdate,
  modo = 'insert',
  mostrarGenerar = true,
  mostrarSincronizar = true,
  sincronizarHabilitado,
  onCodigoGenerado,
  onSincronizado,
  onMensaje,
}: PieBotonesPromptsProps) {
  const [generando, setGenerando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeLocal, setMensajeLocal] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const yaGuardado = pkValor !== null && pkValor !== undefined && String(pkValor).trim() !== ''
  // tienePrompt se computa según el modo: insert mira promptInsert, update mira promptUpdate
  const _tienePrompt = tienePrompt ?? (
    modo === 'update'
      ? !!(promptUpdate || '').trim()
      : !!(promptInsert || '').trim()
  )

  function emitirMensaje(m: { tipo: 'ok' | 'error'; texto: string }) {
    setMensajeLocal(m)
    onMensaje?.(m)
    if (m.tipo === 'ok') setTimeout(() => setMensajeLocal(null), 4000)
  }

  async function ejecutarGenerar() {
    if (!yaGuardado) {
      emitirMensaje({ tipo: 'error', texto: 'Guarda el registro antes de generar código.' })
      return
    }
    if (!_tienePrompt) {
      emitirMensaje({ tipo: 'error', texto: 'Escribe un prompt primero.' })
      return
    }
    setGenerando(true)
    try {
      const lenguaje = modo === 'update' ? 'python_update' : 'python_insert'
      const res = await promptsApi.compilar({
        tabla, pk_columna: pkColumna, pk_valor: String(pkValor),
        lenguaje,
        forzar: false,
        prompt_insert_content: modo === 'insert' ? (promptInsert || undefined) : undefined,
        prompt_update_content: modo === 'update' ? (promptUpdate || undefined) : undefined,
      })
      if (modo === 'update') {
        onCodigoGenerado?.({ python_update: res.python_update })
      } else {
        onCodigoGenerado?.({ python_insert: res.python_insert })
      }
      const label = modo === 'update' ? 'Python Update' : 'Python Insert'
      emitirMensaje({ tipo: 'ok', texto: `Código ${label} generado desde el prompt.` })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      emitirMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al generar' })
    } finally {
      setGenerando(false)
    }
  }

  async function ejecutarSincronizar() {
    if (!yaGuardado) {
      emitirMensaje({ tipo: 'error', texto: 'Guarda el registro antes de sincronizar.' })
      return
    }
    setSincronizando(true)
    try {
      const res = await promptsApi.sincronizarFila(tabla, pkColumna, String(pkValor))
      onSincronizado?.({ codigo_documento: res.codigo_documento, accion: res.accion })
      emitirMensaje({
        tipo: 'ok',
        texto: `Documento ${res.accion} (código ${res.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.`,
      })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      emitirMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al sincronizar' })
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {mensajeLocal && (
        <p className={`text-xs px-1 ${mensajeLocal.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
          {mensajeLocal.texto}
        </p>
      )}
      <div className="flex gap-2">
        {mostrarGenerar && (
          <Boton
            className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
            onClick={ejecutarGenerar}
            disabled={generando || sincronizando || !_tienePrompt}
            cargando={generando}
          >
            <RefreshCw className="w-4 h-4" /> {modo === 'update' ? 'Generar Python Update' : 'Generar Python Insert'}
          </Boton>
        )}
        {mostrarSincronizar && (
          <Boton
            className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
            onClick={ejecutarSincronizar}
            disabled={generando || sincronizando || (sincronizarHabilitado !== undefined ? !sincronizarHabilitado : !yaGuardado)}
            cargando={sincronizando}
          >
            <Upload className="w-4 h-4" /> Sincronizar
          </Boton>
        )}
      </div>
    </div>
  )
}
