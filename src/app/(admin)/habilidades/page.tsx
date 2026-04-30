'use client'

import { useState, useEffect, useMemo } from 'react'
import { Zap, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { Tabla, TablaCabecera, TablaCuerpo, TablaTh, TablaTd, TablaFila } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { Boton } from '@/components/ui/boton'
import { habilidadesApi, registroLLMApi } from '@/lib/api'
import type { Habilidad, TipoHabilidad, SalidaDestino, FormatoSalida } from '@/lib/tipos'
import type { RegistroLLM } from '@/lib/tipos'
import { useAuth } from '@/context/AuthContext'

type TabModal = 'datos' | 'prompts'

const TIPOS_HABILIDAD: { value: TipoHabilidad; label: string }[] = [
  { value: 'DOCUMENTO', label: 'DOCUMENTO — sobre un doc' },
  { value: 'CONJUNTO_DOCUMENTOS', label: 'CONJUNTO_DOCUMENTOS — sobre varios docs' },
  { value: 'ESPACIO', label: 'ESPACIO — sobre un espacio completo' },
]

const SALIDAS_DESTINO: { value: SalidaDestino; label: string }[] = [
  { value: 'DOC_COLUMNA', label: 'DOC_COLUMNA — guarda en columna del doc' },
  { value: 'CHAT_INLINE', label: 'CHAT_INLINE — responde en el chat' },
  { value: 'CARACTERISTICA', label: 'CARACTERISTICA — guarda como característica' },
  { value: 'NUEVO_DOC', label: 'NUEVO_DOC — genera documento nuevo' },
]

const FORMATOS: { value: FormatoSalida; label: string }[] = [
  { value: 'TEXTO', label: 'TEXTO' },
  { value: 'JSON', label: 'JSON' },
]

const varianteTipo = (t: TipoHabilidad) =>
  t === 'DOCUMENTO' ? 'primario' : t === 'ESPACIO' ? 'exito' : 'advertencia'

const varianteSalida = (s: SalidaDestino) =>
  s === 'DOC_COLUMNA' ? 'exito' : s === 'CHAT_INLINE' ? 'neutro' : s === 'CARACTERISTICA' ? 'advertencia' : 'primario'

const FORM_VACIO = {
  codigo_habilidad: '',
  nombre_habilidad: '',
  alias_habilidad: '',
  descripcion: '',
  tipo_habilidad: 'DOCUMENTO' as TipoHabilidad,
  prompt: '',
  system_prompt: '',
  id_modelo: '' as string | number,
  salida_destino: 'CHAT_INLINE' as SalidaDestino,
  salida_columna: '',
  formato_salida: 'TEXTO' as FormatoSalida,
}

export default function PaginaHabilidades() {
  const { grupoActivo } = useAuth()
  const esSuperAdmin = grupoActivo === 'ADMIN'

  const [habilidades, setHabilidades] = useState<Habilidad[]>([])
  const [modelos, setModelos] = useState<RegistroLLM[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoHabilidad | ''>('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Habilidad | null>(null)
  const [form, setForm] = useState({ ...FORM_VACIO })
  const [tabModal, setTabModal] = useState<TabModal>('datos')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [confirmEliminar, setConfirmEliminar] = useState<Habilidad | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [expandida, setExpandida] = useState<string | null>(null)

  const cargar = async () => {
    setCargando(true)
    try {
      const [h, m] = await Promise.all([
        habilidadesApi.listar(),
        registroLLMApi.listar(),
      ])
      setHabilidades(h)
      setModelos(m)
    } catch { /* ignore */ } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtradas = useMemo(() =>
    habilidades.filter((h) => {
      const q = busqueda.toLowerCase()
      const matchQ = !q || h.nombre_habilidad.toLowerCase().includes(q) ||
        h.codigo_habilidad.toLowerCase().includes(q) ||
        (h.descripcion || '').toLowerCase().includes(q)
      const matchTipo = !filtroTipo || h.tipo_habilidad === filtroTipo
      return matchQ && matchTipo
    }),
    [habilidades, busqueda, filtroTipo],
  )

  const abrirCrear = () => {
    setEditando(null)
    setForm({ ...FORM_VACIO })
    setTabModal('datos')
    setError('')
    setModalAbierto(true)
  }

  const abrirEditar = (h: Habilidad) => {
    setEditando(h)
    setForm({
      codigo_habilidad: h.codigo_habilidad,
      nombre_habilidad: h.nombre_habilidad,
      alias_habilidad: h.alias_habilidad || '',
      descripcion: h.descripcion || '',
      tipo_habilidad: h.tipo_habilidad,
      prompt: h.prompt,
      system_prompt: h.system_prompt || '',
      id_modelo: h.id_modelo ?? '',
      salida_destino: h.salida_destino,
      salida_columna: h.salida_columna || '',
      formato_salida: h.formato_salida,
    })
    setTabModal('datos')
    setError('')
    setModalAbierto(true)
  }

  const guardar = async () => {
    if (!form.nombre_habilidad.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.prompt.trim()) { setError('El prompt es obligatorio.'); return }
    if (form.salida_destino === 'DOC_COLUMNA' && !form.salida_columna.trim()) {
      setError('salida_columna es obligatorio cuando salida_destino=DOC_COLUMNA.'); return
    }
    setGuardando(true)
    setError('')
    try {
      const payload: Partial<Habilidad> = {
        nombre_habilidad: form.nombre_habilidad.trim(),
        alias_habilidad: form.alias_habilidad.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined,
        tipo_habilidad: form.tipo_habilidad,
        prompt: form.prompt.trim(),
        system_prompt: form.system_prompt.trim() || undefined,
        id_modelo: form.id_modelo !== '' ? Number(form.id_modelo) : undefined,
        salida_destino: form.salida_destino,
        salida_columna: form.salida_destino === 'DOC_COLUMNA' ? form.salida_columna.trim() : undefined,
        formato_salida: form.formato_salida,
      }
      if (editando) {
        await habilidadesApi.actualizar(editando.codigo_habilidad, payload)
      } else {
        if (form.codigo_habilidad.trim()) {
          payload.codigo_habilidad = form.codigo_habilidad.trim().toUpperCase().replace(/\s+/g, '_') as unknown as string
        }
        await habilidadesApi.crear(payload)
      }
      setModalAbierto(false)
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Error al guardar la habilidad.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await habilidadesApi.eliminar(confirmEliminar.codigo_habilidad)
      setConfirmEliminar(null)
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Error al eliminar.')
    } finally {
      setEliminando(false)
    }
  }

  const modeloNombre = (id?: number | null) =>
    modelos.find((m) => m.id_modelo === id)?.nombre_modelo || '—'

  const tabStyle = (activo: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activo ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
    }`

  return (
    <div>
      <h2 className="page-heading mb-4">Catálogo de Habilidades</h2>

      <BarraHerramientas
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar habilidad…"
        acciones={
          esSuperAdmin ? (
            <Boton variante="primario" tamano="sm" onClick={abrirCrear}>
              <Plus size={14} className="mr-1" /> Nueva habilidad
            </Boton>
          ) : undefined
        }
      >
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as TipoHabilidad | '')}
          className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_HABILIDAD.map((t) => (
            <option key={t.value} value={t.value}>{t.value}</option>
          ))}
        </select>
      </BarraHerramientas>

      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh></TablaTh>
            <TablaTh>Nombre</TablaTh>
            <TablaTh>Código</TablaTh>
            <TablaTh>Tipo</TablaTh>
            <TablaTh>Salida</TablaTh>
            <TablaTh>Modelo</TablaTh>
            {esSuperAdmin && <TablaTh className="text-right">Acciones</TablaTh>}
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={esSuperAdmin ? 7 : 6 as never}>
                Cargando…
              </TablaTd>
            </TablaFila>
          ) : filtradas.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={esSuperAdmin ? 7 : 6 as never}>
                No hay habilidades.
              </TablaTd>
            </TablaFila>
          ) : (
            filtradas.map((h) => (
              <>
                <TablaFila key={h.codigo_habilidad}>
                  <TablaTd>
                    <button
                      onClick={() => setExpandida(expandida === h.codigo_habilidad ? null : h.codigo_habilidad)}
                      className="p-1 rounded hover:bg-fondo text-texto-muted"
                      title={expandida === h.codigo_habilidad ? 'Colapsar' : 'Ver prompt'}
                    >
                      {expandida === h.codigo_habilidad ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-primario shrink-0" />
                      <span className="font-medium text-sm">{h.nombre_habilidad}</span>
                    </div>
                    {h.descripcion && (
                      <p className="text-xs text-texto-muted mt-0.5 max-w-xs truncate">{h.descripcion}</p>
                    )}
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted font-mono">{h.codigo_habilidad}</TablaTd>
                  <TablaTd>
                    <Insignia variante={varianteTipo(h.tipo_habilidad)}>{h.tipo_habilidad}</Insignia>
                  </TablaTd>
                  <TablaTd>
                    <Insignia variante={varianteSalida(h.salida_destino)}>{h.salida_destino}</Insignia>
                    {h.salida_columna && (
                      <span className="ml-1 text-xs text-texto-muted">({h.salida_columna})</span>
                    )}
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted">{modeloNombre(h.id_modelo)}</TablaTd>
                  {esSuperAdmin && (
                    <TablaTd className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => abrirEditar(h)}
                          className="p-1.5 rounded hover:bg-primario-muy-claro text-primario"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmEliminar(h)}
                          className="p-1.5 rounded hover:bg-error/10 text-error"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TablaTd>
                  )}
                </TablaFila>
                {expandida === h.codigo_habilidad && (
                  <TablaFila key={`${h.codigo_habilidad}-expand`}>
                    <TablaTd colSpan={esSuperAdmin ? 7 : 6 as never} className="bg-fondo px-6 py-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-semibold text-xs uppercase tracking-wide text-texto-muted mb-1">Prompt</p>
                          <pre className="whitespace-pre-wrap text-xs text-texto bg-white border border-borde rounded p-2 max-h-40 overflow-y-auto">
                            {h.prompt}
                          </pre>
                        </div>
                        {h.system_prompt && (
                          <div>
                            <p className="font-semibold text-xs uppercase tracking-wide text-texto-muted mb-1">System Prompt</p>
                            <pre className="whitespace-pre-wrap text-xs text-texto bg-white border border-borde rounded p-2 max-h-40 overflow-y-auto">
                              {h.system_prompt}
                            </pre>
                          </div>
                        )}
                      </div>
                    </TablaTd>
                  </TablaFila>
                )}
              </>
            ))
          )}
        </TablaCuerpo>
      </Tabla>

      {/* Modal crear / editar */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={editando ? `Editar habilidad: ${editando.nombre_habilidad}` : 'Nueva habilidad'}
        ancho="lg"
      >
        {/* Tabs */}
        <div className="border-b border-borde mb-4 flex gap-4">
          <button className={tabStyle(tabModal === 'datos')} onClick={() => setTabModal('datos')}>Datos</button>
          <button className={tabStyle(tabModal === 'prompts')} onClick={() => setTabModal('prompts')}>Prompts</button>
        </div>

        {tabModal === 'datos' && (
          <div className="space-y-3">
            {!editando && (
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Código (dejar vacío para autogenerar)</label>
                <Input
                  value={form.codigo_habilidad}
                  onChange={(e) => setForm({ ...form, codigo_habilidad: e.target.value })}
                  placeholder="RESUMIR_DOCUMENTO"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Nombre <span className="text-error">*</span></label>
              <Input
                value={form.nombre_habilidad}
                onChange={(e) => setForm({ ...form, nombre_habilidad: e.target.value })}
                placeholder="Resumir documento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Alias</label>
              <Input
                value={form.alias_habilidad}
                onChange={(e) => setForm({ ...form, alias_habilidad: e.target.value })}
                placeholder="Resumir"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Descripción</label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Genera un resumen del documento"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tipo</label>
                <select
                  value={form.tipo_habilidad}
                  onChange={(e) => setForm({ ...form, tipo_habilidad: e.target.value as TipoHabilidad })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
                >
                  {TIPOS_HABILIDAD.map((t) => (
                    <option key={t.value} value={t.value}>{t.value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Formato salida</label>
                <select
                  value={form.formato_salida}
                  onChange={(e) => setForm({ ...form, formato_salida: e.target.value as FormatoSalida })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
                >
                  {FORMATOS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Salida destino</label>
                <select
                  value={form.salida_destino}
                  onChange={(e) => setForm({ ...form, salida_destino: e.target.value as SalidaDestino })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
                >
                  {SALIDAS_DESTINO.map((s) => (
                    <option key={s.value} value={s.value}>{s.value}</option>
                  ))}
                </select>
              </div>
              {form.salida_destino === 'DOC_COLUMNA' && (
                <div>
                  <label className="block text-sm font-medium text-texto mb-1">Columna destino <span className="text-error">*</span></label>
                  <Input
                    value={form.salida_columna}
                    onChange={(e) => setForm({ ...form, salida_columna: e.target.value })}
                    placeholder="resumen_documento"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Modelo LLM (opcional — hereda del chat si vacío)</label>
              <select
                value={form.id_modelo}
                onChange={(e) => setForm({ ...form, id_modelo: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto"
              >
                <option value="">— Heredar del chat —</option>
                {modelos.filter((m) => m.activo).map((m) => (
                  <option key={m.id_modelo} value={m.id_modelo}>{m.nombre_modelo} ({m.proveedor})</option>
                ))}
              </select>
            </div>
            {editando && (
              <p className="text-xs text-texto-muted font-mono">Código: {editando.codigo_habilidad}</p>
            )}
          </div>
        )}

        {tabModal === 'prompts' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Prompt <span className="text-error">*</span></label>
              <p className="text-xs text-texto-muted mb-1">
                Instrucción principal. Usa <code className="bg-fondo px-1 rounded">{'{{texto}}'}</code> para el texto del documento.
              </p>
              <Textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Resume el siguiente documento en 3 párrafos claros y concisos:&#10;&#10;{{texto}}"
                rows={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">System Prompt (opcional)</label>
              <p className="text-xs text-texto-muted mb-1">
                Contexto/identidad del asistente para esta habilidad.
              </p>
              <Textarea
                value={form.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                placeholder="Eres un asistente experto en síntesis de documentos legales."
                rows={4}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-error/40 bg-error/10 p-2.5 text-sm text-error">
            {error}
          </div>
        )}

        <PieBotonesModal
          onCancelar={() => setModalAbierto(false)}
          onGuardar={guardar}
          cargando={guardando}
        />
      </Modal>

      {/* Confirmar eliminar */}
      <ModalConfirmar
        abierto={!!confirmEliminar}
        titulo="Eliminar habilidad"
        mensaje={`¿Eliminar "${confirmEliminar?.nombre_habilidad}"? Si tiene filas activas en la cola no se podrá eliminar.`}
        onConfirmar={eliminar}
        onCancelar={() => setConfirmEliminar(null)}
        cargando={eliminando}
        variante="error"
      />
    </div>
  )
}
