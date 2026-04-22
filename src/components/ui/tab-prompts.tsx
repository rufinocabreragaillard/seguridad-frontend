'use client'

import { Brain, Code2, Lock, Unlock } from 'lucide-react'

export interface CamposPrompt {
  prompt_insert: string | null
  prompt_update: string | null
  python_insert: string | null
  python_update: string | null
  system_prompt: string | null
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
  mostrarPromptInsert?: boolean
  mostrarPromptUpdate?: boolean
  mostrarSystemPrompt?: boolean
  mostrarPythonInsert?: boolean
  mostrarPythonUpdate?: boolean
  mostrarJavaScript?: boolean
  /** @deprecated Los botones Generar/Sincronizar ahora se pasan como botonesIzquierda en PieBotonesModal */
  mostrarBotones?: boolean
}

/**
 * Pestaña reutilizable "Prompts" para cualquier mantenedor CRUD.
 *
 * Campos:
 *   - prompt_insert  → python_insert  (trigger post-INSERT)
 *   - prompt_update  → python_update  (trigger post-UPDATE)
 *   - system_prompt                   (instrucción base para el LLM)
 *   - javascript                      (código JS compilado, si aplica)
 */
export function TabPrompts({
  tabla: _tabla,
  pkColumna: _pkColumna,
  pkValor: _pkValor,
  campos,
  onCampoCambiado,
  deshabilitado = false,
  mostrarPromptInsert = true,
  mostrarPromptUpdate = true,
  mostrarSystemPrompt = true,
  mostrarPythonInsert = true,
  mostrarPythonUpdate = true,
  mostrarJavaScript = false,
  mostrarBotones: _mostrarBotones,
}: TabPromptsProps) {
  return (
    <div className="space-y-5">

      {/* ── Bloque INSERT ─────────────────────────────────────────────────── */}
      {(mostrarPromptInsert || mostrarPythonInsert) && (
        <div className="rounded border border-borde p-3 space-y-3">
          <p className="text-xs font-semibold text-texto-muted uppercase tracking-wide">Trigger INSERT (post-creación)</p>

          {mostrarPromptInsert && (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Brain className="w-4 h-4" /> Prompt INSERT
              </label>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[120px] font-mono"
                value={campos.prompt_insert || ''}
                onChange={(e) => onCampoCambiado('prompt_insert', e.target.value)}
                placeholder="Instrucción que ejecutará el LLM al crear este registro..."
                disabled={deshabilitado}
              />
            </div>
          )}

          {mostrarPythonInsert && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Code2 className="w-4 h-4" /> Python INSERT compilado
                </label>
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campos.python_editado_manual}
                    onChange={(e) => onCampoCambiado('python_editado_manual', e.target.checked)}
                  />
                  {campos.python_editado_manual
                    ? <Lock className="w-3 h-3 text-amber-600" />
                    : <Unlock className="w-3 h-3" />}
                  edición manual
                </label>
              </div>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[100px] font-mono bg-gris-fondo"
                value={campos.python_insert || ''}
                onChange={(e) => {
                  onCampoCambiado('python_insert', e.target.value)
                  onCampoCambiado('python_editado_manual', true)
                }}
                placeholder="# Se genera automáticamente al apretar Generar"
                disabled={deshabilitado}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Bloque UPDATE ─────────────────────────────────────────────────── */}
      {(mostrarPromptUpdate || mostrarPythonUpdate) && (
        <div className="rounded border border-borde p-3 space-y-3">
          <p className="text-xs font-semibold text-texto-muted uppercase tracking-wide">Trigger UPDATE (post-modificación)</p>

          {mostrarPromptUpdate && (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Brain className="w-4 h-4" /> Prompt UPDATE
              </label>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[120px] font-mono"
                value={campos.prompt_update || ''}
                onChange={(e) => onCampoCambiado('prompt_update', e.target.value)}
                placeholder="Instrucción que ejecutará el LLM al modificar este registro..."
                disabled={deshabilitado}
              />
            </div>
          )}

          {mostrarPythonUpdate && (
            <div>
              <label className="text-sm font-medium flex items-center gap-1 mb-1">
                <Code2 className="w-4 h-4" /> Python UPDATE compilado
              </label>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[100px] font-mono bg-gris-fondo"
                value={campos.python_update || ''}
                onChange={(e) => onCampoCambiado('python_update', e.target.value)}
                placeholder="# Se genera automáticamente al apretar Generar"
                disabled={deshabilitado}
              />
            </div>
          )}
        </div>
      )}

      {/* System Prompt */}
      {mostrarSystemPrompt && (
        <div>
          <label className="block text-sm font-medium mb-1">System Prompt (instrucción base LLM)</label>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[100px] font-mono"
            value={campos.system_prompt || ''}
            onChange={(e) => onCampoCambiado('system_prompt', e.target.value)}
            placeholder="Instrucción base al LLM (se inyecta en system_prompt del chat)."
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
              {campos.javascript_editado_manual
                ? <Lock className="w-3 h-3 text-amber-600" />
                : <Unlock className="w-3 h-3" />}
              edición manual
            </label>
          </div>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[100px] font-mono bg-gris-fondo"
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

    </div>
  )
}
