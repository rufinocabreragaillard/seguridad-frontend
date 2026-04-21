'use client'

import { useState } from 'react'
import { Brain, Code2, Lock, Unlock } from 'lucide-react'
import { PieBotonesPrompts } from './pie-botones-prompts'

export interface CamposPrompt {
  prompt: string | null
  system_prompt: string | null
  python: string | null
  javascript: string | null
  python_editado_manual: boolean
  javascript_editado_manual: boolean
}

interface TabPromptsProps {
  tabla: string
  pkColumna: string
  pkValor: string | number | null
  campos: CamposPrompt
  onCampoCambiado: (campo: keyof CamposPrompt, valor: unknown) => void
  deshabilitado?: boolean
  mostrarPrompt?: boolean
  mostrarSystemPrompt?: boolean
  mostrarPython?: boolean
  mostrarJavaScript?: boolean
  mostrarBotones?: boolean
}

/**
 * Pestaña reutilizable "Prompts" para cualquier mantenedor CRUD.
 *
 * Renderiza 4 campos editables (prompt, system_prompt, python, javascript) +
 * 2 flags de edición manual + los botones Generar / Sincronizar del sistema
 * "Todo por Prompts".
 *
 * Uso típico dentro de un modal con tabs:
 *
 *     {tabActiva === 'prompts' && registroEditando && (
 *       <TabPrompts
 *         tabla="NOMBRE_TABLA"
 *         pkColumna="codigo_X"
 *         pkValor={registroEditando.codigo_X}
 *         campos={form}
 *         onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
 *       />
 *     )}
 *
 * Ver diseño completo en /serverlm-todoPorPrompts.md
 */
export function TabPrompts({
  tabla,
  pkColumna,
  pkValor,
  campos,
  onCampoCambiado,
  deshabilitado = false,
  mostrarPrompt = true,
  mostrarSystemPrompt = true,
  mostrarPython = true,
  mostrarJavaScript = true,
  mostrarBotones = true,
}: TabPromptsProps) {
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  return (
    <div className="space-y-4">
      {mensaje && (
        <div
          className={
            mensaje.tipo === 'ok'
              ? 'text-sm p-2 rounded bg-green-50 text-green-800 border border-green-200'
              : 'text-sm p-2 rounded bg-red-50 text-red-800 border border-red-200'
          }
        >
          {mensaje.texto}
        </div>
      )}

      {/* Prompt */}
      {mostrarPrompt && (
        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-1">
            <Brain className="w-4 h-4" /> Prompt (regla en lenguaje natural)
          </label>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[140px] font-mono"
            value={campos.prompt || ''}
            onChange={(e) => onCampoCambiado('prompt', e.target.value)}
            placeholder="Describe la regla, política o instrucción en español..."
            disabled={deshabilitado}
          />
          <p className="text-xs text-texto-muted mt-1">
            Fuente de verdad. Se vectoriza para el RAG y se usa para compilar Python/JavaScript.
          </p>
        </div>
      )}

      {/* System Prompt */}
      {mostrarSystemPrompt && (
        <div>
          <label className="block text-sm font-medium mb-1">System Prompt (variante para LLM)</label>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[100px] font-mono"
            value={campos.system_prompt || ''}
            onChange={(e) => onCampoCambiado('system_prompt', e.target.value)}
            placeholder="Versión dirigida al LLM como system prompt (opcional)."
            disabled={deshabilitado}
          />
        </div>
      )}

      {/* Python */}
      {mostrarPython && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <Code2 className="w-4 h-4" /> Python compilado
            </label>
            <label className="text-xs flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={campos.python_editado_manual}
                onChange={(e) => onCampoCambiado('python_editado_manual', e.target.checked)}
              />
              {campos.python_editado_manual ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3" />}
              edición manual
            </label>
          </div>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[120px] font-mono bg-gris-fondo"
            value={campos.python || ''}
            onChange={(e) => {
              onCampoCambiado('python', e.target.value)
              onCampoCambiado('python_editado_manual', true)
            }}
            placeholder="# Se genera automáticamente al apretar Generar"
            disabled={deshabilitado}
          />
        </div>
      )}

      {/* JavaScript */}
      {mostrarJavaScript && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <Code2 className="w-4 h-4" /> JavaScript compilado
            </label>
            <label className="text-xs flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={campos.javascript_editado_manual}
                onChange={(e) => onCampoCambiado('javascript_editado_manual', e.target.checked)}
              />
              {campos.javascript_editado_manual ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3" />}
              edición manual
            </label>
          </div>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[120px] font-mono bg-gris-fondo"
            value={campos.javascript || ''}
            onChange={(e) => {
              onCampoCambiado('javascript', e.target.value)
              onCampoCambiado('javascript_editado_manual', true)
            }}
            placeholder="// Se genera automáticamente al apretar Generar"
            disabled={deshabilitado}
          />
        </div>
      )}

      {/* Botones de acción (clase separada de PieBotonesModal) */}
      {mostrarBotones && (
        <PieBotonesPrompts
          tabla={tabla}
          pkColumna={pkColumna}
          pkValor={pkValor}
          tienePrompt={!!(campos.prompt || '').trim()}
          onCodigoGenerado={(r) => {
            if (r.python !== undefined && r.python !== null) {
              onCampoCambiado('python', r.python)
              onCampoCambiado('python_editado_manual', false)
            }
            if (r.javascript !== undefined && r.javascript !== null) {
              onCampoCambiado('javascript', r.javascript)
              onCampoCambiado('javascript_editado_manual', false)
            }
          }}
          onMensaje={setMensaje}
        />
      )}
    </div>
  )
}
