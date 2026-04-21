'use client'

import { useEffect, useState } from 'react'
import { FileText, Brain, Code2, Lock, Unlock, Save, RefreshCw, Upload } from 'lucide-react'
import { Modal } from './modal'
import { Boton } from './boton'
import { promptsApi } from '@/lib/api'

type Tab = 'descripcion' | 'prompt' | 'codigo'

interface Props {
  abierto: boolean
  onCerrar: () => void
  tabla: string
  pkColumna: string
  pkValor: string | number
  titulo: string
}

interface FormState {
  descripcion: string
  prompt: string
  system_prompt: string
  python: string
  javascript: string
  python_editado_manual: boolean
  javascript_editado_manual: boolean
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'descripcion', label: 'Descripción' },
  { key: 'prompt',      label: 'Prompt' },
  { key: 'codigo',      label: 'Código' },
]

const FORM_INICIAL: FormState = {
  descripcion: '',
  prompt: '',
  system_prompt: '',
  python: '',
  javascript: '',
  python_editado_manual: false,
  javascript_editado_manual: false,
}

export function ModalEditorPrompts({ abierto, onCerrar, tabla, pkColumna, pkValor, titulo }: Props) {
  const [tab, setTab] = useState<Tab>('descripcion')
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    if (!abierto || !pkValor) return
    setCargando(true)
    setMensaje(null)
    setTab('descripcion')
    promptsApi
      .getFila(tabla, pkColumna, String(pkValor))
      .then((data) =>
        setForm({
          descripcion:              String(data.descripcion ?? ''),
          prompt:                   String(data.prompt ?? ''),
          system_prompt:            String(data.system_prompt ?? ''),
          python:                   String(data.python ?? ''),
          javascript:               String(data.javascript ?? ''),
          python_editado_manual:    Boolean(data.python_editado_manual),
          javascript_editado_manual: Boolean(data.javascript_editado_manual),
        }),
      )
      .catch(() => setMensaje({ tipo: 'error', texto: 'Error al cargar los datos del registro.' }))
      .finally(() => setCargando(false))
  }, [abierto, tabla, pkColumna, pkValor])

  async function guardar() {
    setGuardando(true)
    setMensaje(null)
    try {
      await promptsApi.patchFila(tabla, pkColumna, String(pkValor), form as unknown as Record<string, unknown>)
      setMensaje({ tipo: 'ok', texto: 'Guardado correctamente.' })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  async function generar() {
    if (!form.prompt.trim()) {
      setMensaje({ tipo: 'error', texto: 'Escribe un prompt primero.' })
      return
    }
    setGenerando(true)
    setMensaje(null)
    try {
      const res = await promptsApi.compilar({ tabla, pk_columna: pkColumna, pk_valor: String(pkValor), lenguaje: 'ambos', forzar: false })
      setForm((prev) => ({
        ...prev,
        ...(res.python != null ? { python: res.python!, python_editado_manual: false } : {}),
        ...(res.javascript != null ? { javascript: res.javascript!, javascript_editado_manual: false } : {}),
      }))
      setMensaje({ tipo: 'ok', texto: 'Código Python y JavaScript generado desde el prompt.' })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al generar.' })
    } finally {
      setGenerando(false)
    }
  }

  async function sincronizar() {
    setSincronizando(true)
    setMensaje(null)
    try {
      const res = await promptsApi.sincronizarFila(tabla, pkColumna, String(pkValor))
      setMensaje({ tipo: 'ok', texto: `Documento ${res.accion} (código ${res.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setMensaje({ tipo: 'error', texto: err?.response?.data?.detail || err?.message || 'Error al sincronizar.' })
    } finally {
      setSincronizando(false)
    }
  }

  const ocupado = guardando || generando || sincronizando

  return (
    <Modal abierto={abierto} alCerrar={onCerrar} titulo={`Editor de Contexto — ${titulo}`} className="w-[700px] max-w-[95vw]">
      {/* Tabs */}
      <div className="flex border-b border-borde mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'border-b-2 border-primario text-primario'
                : 'text-texto-muted hover:text-texto'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {cargando && <p className="text-sm text-texto-muted py-6 text-center">Cargando…</p>}

      {!cargando && (
        <>
          {/* Tab Descripción */}
          {tab === 'descripcion' && (
            <div>
              <p className="text-xs text-texto-muted mb-2">
                Descripción del registro. Se vectoriza y recupera como contexto en el chat (system prompt del LLM).
              </p>
              <textarea
                className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[220px] resize-y"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Describe el propósito y contexto de este elemento para el sistema RAG..."
              />
            </div>
          )}

          {/* Tab Prompt */}
          {tab === 'prompt' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Brain className="w-4 h-4" /> Prompt (regla en lenguaje natural)
                </label>
                <textarea
                  className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[140px] font-mono resize-y"
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  placeholder="Describe la regla, política o instrucción en español…"
                />
                <p className="text-xs text-texto-muted mt-1">
                  Fuente de verdad. Se usa para compilar Python/JavaScript con el botón Generar.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <FileText className="w-4 h-4" /> System Prompt
                </label>
                <textarea
                  className="w-full border border-borde rounded px-3 py-2 text-sm min-h-[100px] font-mono resize-y"
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  placeholder="Versión para el LLM como system prompt (opcional)…"
                />
              </div>
            </div>
          )}

          {/* Tab Código */}
          {tab === 'codigo' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Code2 className="w-4 h-4" /> Python compilado
                  </label>
                  <label className="text-xs flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.python_editado_manual}
                      onChange={(e) => setForm({ ...form, python_editado_manual: e.target.checked })}
                    />
                    {form.python_editado_manual
                      ? <Lock className="w-3 h-3 text-amber-600" />
                      : <Unlock className="w-3 h-3" />}
                    edición manual
                  </label>
                </div>
                <textarea
                  className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[110px] font-mono bg-gris-fondo resize-y"
                  value={form.python}
                  onChange={(e) => setForm({ ...form, python: e.target.value, python_editado_manual: true })}
                  placeholder="# Se genera con el botón Generar"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Code2 className="w-4 h-4" /> JavaScript compilado
                  </label>
                  <label className="text-xs flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.javascript_editado_manual}
                      onChange={(e) => setForm({ ...form, javascript_editado_manual: e.target.checked })}
                    />
                    {form.javascript_editado_manual
                      ? <Lock className="w-3 h-3 text-amber-600" />
                      : <Unlock className="w-3 h-3" />}
                    edición manual
                  </label>
                </div>
                <textarea
                  className="w-full border border-borde rounded px-3 py-2 text-xs min-h-[110px] font-mono bg-gris-fondo resize-y"
                  value={form.javascript}
                  onChange={(e) => setForm({ ...form, javascript: e.target.value, javascript_editado_manual: true })}
                  placeholder="// Se genera con el botón Generar"
                />
              </div>
            </div>
          )}

          {/* Mensaje */}
          {mensaje && (
            <div
              className={`mt-3 text-sm p-2 rounded ${
                mensaje.tipo === 'ok'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {mensaje.texto}
            </div>
          )}

          {/* Footer: Generar | Sincronizar ··· Cerrar | Guardar */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-borde">
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={generar}
                disabled={ocupado || !form.prompt.trim()}
                cargando={generando}
              >
                <RefreshCw className="w-4 h-4" /> Generar
              </Boton>
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={sincronizar}
                disabled={ocupado}
                cargando={sincronizando}
              >
                <Upload className="w-4 h-4" /> Sincronizar
              </Boton>
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm" onClick={onCerrar} disabled={ocupado}>
                Cerrar
              </Boton>
              <Boton variante="primario" tamano="sm" onClick={guardar} cargando={guardando} disabled={ocupado}>
                <Save className="w-4 h-4" /> Guardar
              </Boton>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
