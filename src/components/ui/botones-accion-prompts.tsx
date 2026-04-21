'use client'

import { useState } from 'react'
import { Boton } from './boton'
import { RefreshCw, Upload, Code2 } from 'lucide-react'
import { promptsApi } from '@/lib/api'

interface BotonesAccionPromptsProps {
  tabla: string
  pkColumna: string
  pkValor: string | number | null
  tienePrompt: boolean
  onCodigoGenerado?: (r: { python?: string | null; javascript?: string | null }) => void
  onSincronizado?: (r: { codigo_documento: number; accion: string }) => void
  onMensaje?: (m: { tipo: 'ok' | 'error'; texto: string }) => void
}

/**
 * Clase de botones para acciones del sistema "Todo por Prompts":
 * - Generar (compila prompt → python + javascript)
 * - Sincronizar (inserta documento virtual en estado ESCANEADO → pipeline CHUNKEAR+VECTORIZAR)
 *
 * Separada de `PieBotonesModal` (Grabar/Salir). Se monta arriba o abajo del
 * contenido de la pestaña "Prompts" de cualquier mantenedor.
 */
export function BotonesAccionPrompts({
  tabla,
  pkColumna,
  pkValor,
  tienePrompt,
  onCodigoGenerado,
  onSincronizado,
  onMensaje,
}: BotonesAccionPromptsProps) {
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
    <div className="flex gap-3 justify-end pt-2 border-t border-borde">
      <Boton
        variante="contorno"
        onClick={ejecutarGenerar}
        disabled={generando || !tienePrompt}
        cargando={generando}
      >
        <Code2 className="w-4 h-4" /> Generar
      </Boton>
      <Boton
        variante="primario"
        onClick={ejecutarSincronizar}
        disabled={sincronizando || !yaGuardado}
        cargando={sincronizando}
      >
        <Upload className="w-4 h-4" /> Sincronizar
      </Boton>
    </div>
  )
}
