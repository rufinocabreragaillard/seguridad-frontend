'use client'

import { useState } from 'react'
import { RefreshCw, Upload } from 'lucide-react'
import { Boton } from './boton'
import { promptsApi } from '@/lib/api'

interface PieBotonesPromptsProps {
  tabla: string
  pkColumna: string
  pkValor: string | number | null
  tienePrompt: boolean
  onCodigoGenerado?: (r: { python?: string | null; javascript?: string | null }) => void
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
  onCodigoGenerado,
  onSincronizado,
  onMensaje,
}: PieBotonesPromptsProps) {
  const [generando, setGenerando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  const yaGuardado = pkValor !== null && pkValor !== undefined && String(pkValor).trim() !== ''

  async function ejecutarGenerar() {
    if (!yaGuardado) {
      onMensaje?.({ tipo: 'error', texto: 'Guarda el registro antes de generar código.' })
      return
    }
    if (!tienePrompt) {
      onMensaje?.({ tipo: 'error', texto: 'Escribe un prompt primero.' })
      return
    }
    setGenerando(true)
    try {
      const res = await promptsApi.compilar({
        tabla, pk_columna: pkColumna, pk_valor: String(pkValor),
        lenguaje: 'ambos', forzar: false,
      })
      onCodigoGenerado?.({ python: res.python, javascript: res.javascript })
      onMensaje?.({ tipo: 'ok', texto: 'Código Python y JavaScript generado desde el prompt.' })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      onMensaje?.({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al generar' })
    } finally {
      setGenerando(false)
    }
  }

  async function ejecutarSincronizar() {
    if (!yaGuardado) {
      onMensaje?.({ tipo: 'error', texto: 'Guarda el registro antes de sincronizar.' })
      return
    }
    setSincronizando(true)
    try {
      const res = await promptsApi.sincronizarFila(tabla, pkColumna, String(pkValor))
      onSincronizado?.({ codigo_documento: res.codigo_documento, accion: res.accion })
      onMensaje?.({
        tipo: 'ok',
        texto: `Documento ${res.accion} en estado ESCANEADO (código ${res.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.`,
      })
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      onMensaje?.({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al sincronizar' })
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Boton
        className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
        onClick={ejecutarGenerar}
        disabled={generando || sincronizando || !tienePrompt}
        cargando={generando}
      >
        <RefreshCw className="w-4 h-4" /> Generar
      </Boton>
      <Boton
        className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
        onClick={ejecutarSincronizar}
        disabled={generando || sincronizando || !yaGuardado}
        cargando={sincronizando}
      >
        <Upload className="w-4 h-4" /> Sincronizar
      </Boton>
    </div>
  )
}
