'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('tabPrompts')
  const [updateEditadoManual, setUpdateEditadoManual] = useState(false)
  return (
    <div className="space-y-5">

      {/* ── Bloque INSERT ─────────────────────────────────────────────────── */}
      {(mostrarPromptInsert || mostrarPythonInsert) && (
        <div className="space-y-3">
          {mostrarPromptInsert && (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Brain className="w-4 h-4" /> {t('promptInsert')}
              </label>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[100px] font-mono"
                value={campos.prompt_insert || ''}
                onChange={(e) => onCampoCambiado('prompt_insert', e.target.value)}
                placeholder={t('placeholderPromptInsert')}
                disabled={deshabilitado}
              />
            </div>
          )}

          {mostrarPythonInsert && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Code2 className="w-4 h-4" /> {t('pythonInsertCompilado')}
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
                  {t('edicionManual')}
                </label>
              </div>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[100px] font-mono bg-gris-fondo"
                value={campos.python_insert || ''}
                onChange={(e) => {
                  onCampoCambiado('python_insert', e.target.value)
                  onCampoCambiado('python_editado_manual', true)
                }}
                placeholder={t('placeholderPythonAuto')}
                disabled={deshabilitado}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Bloque UPDATE ─────────────────────────────────────────────────── */}
      {(mostrarPromptUpdate || mostrarPythonUpdate) && (
        <div className="space-y-3">
          {mostrarPromptUpdate && (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Brain className="w-4 h-4" /> {t('promptUpdate')}
              </label>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[100px] font-mono"
                value={campos.prompt_update || ''}
                onChange={(e) => onCampoCambiado('prompt_update', e.target.value)}
                placeholder={t('placeholderPromptUpdate')}
                disabled={deshabilitado}
              />
            </div>
          )}

          {mostrarPythonUpdate && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Code2 className="w-4 h-4" /> {t('pythonUpdateCompilado')}
                </label>
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateEditadoManual}
                    onChange={(e) => setUpdateEditadoManual(e.target.checked)}
                  />
                  {updateEditadoManual
                    ? <Lock className="w-3 h-3 text-amber-600" />
                    : <Unlock className="w-3 h-3" />}
                  {t('edicionManual')}
                </label>
              </div>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[100px] font-mono bg-gris-fondo"
                value={campos.python_update || ''}
                onChange={(e) => onCampoCambiado('python_update', e.target.value)}
                placeholder={t('placeholderPythonAuto')}
                disabled={deshabilitado}
              />
            </div>
          )}
        </div>
      )}

      {/* System Prompt */}
      {mostrarSystemPrompt && (
        <div>
          <label className="block text-sm font-medium mb-1">{t('systemPromptLabel')}</label>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[150px] font-mono"
            value={campos.system_prompt || ''}
            onChange={(e) => onCampoCambiado('system_prompt', e.target.value)}
            placeholder={t('placeholderSystemPrompt')}
            disabled={deshabilitado}
          />
        </div>
      )}

      {/* JavaScript */}
      {mostrarJavaScript && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <Code2 className="w-4 h-4" /> {t('javascriptCompilado')}
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
              {t('edicionManual')}
            </label>
          </div>
          <textarea
            className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[100px] font-mono bg-gris-fondo"
            value={campos.javascript || ''}
            onChange={(e) => {
              onCampoCambiado('javascript', e.target.value)
              onCampoCambiado('javascript_editado_manual', true)
            }}
            placeholder={t('placeholderJsAuto')}
            disabled={deshabilitado}
          />
        </div>
      )}

    </div>
  )
}
