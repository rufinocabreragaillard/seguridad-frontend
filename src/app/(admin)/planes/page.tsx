'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Plus, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { planesApi, promptsApi, type Plan } from '@/lib/api'

type TabModal = 'datos' | 'features' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'

const PLAN_VACIO: Partial<Plan> = {
  codigo_plan: '',
  codigo_plan_superior: null,
  nombre: '',
  alias: '',
  descripcion: '',
  mensaje_bienvenida: '',
  precio_mensual_usd: null,
  precio_anual_usd: null,
  tokens_mensuales: null,
  documentos_maximos: null,
  tokens_extras_disponibles: false,
  dias_duracion: null,
  dias_gracia_renovacion: 60,
  conversacion_documentos: true,
  focos_lenguaje_natural: true,
  control_por_area: false,
  control_por_cargo: false,
  servidor_cliente_local: false,
  personalizacion: false,
  eleccion_llms: false,
  multi_entidad_holdings: false,
  storage_propio: false,
  es_plan_de_prueba: false,
  orden: 0,
  prompt_insert: '',
  prompt_update: '',
  system_prompt: '',
  python_insert: '',
  python_update: '',
  javascript: '',
  python_editado_manual: false,
  javascript_editado_manual: false,
}

export default function PaginaPlanes() {
  const t = useTranslations('planes')
  const tc = useTranslations('common')
  const [planes, setPlanes] = useState<Plan[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Plan | null>(null)
  const [form, setForm] = useState<Partial<Plan>>(PLAN_VACIO)
  const [tab, setTab] = useState<TabModal>('datos')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState<Plan | null>(null)
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [md, setMd] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setPlanes(await planesApi.listar())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function abrirNuevo() {
    setEditando(null)
    setForm(PLAN_VACIO)
    setTab('datos')
    setError('')
    setModal(true)
  }

  function abrirEdicion(p: Plan) {
    setEditando(p)
    setForm({ ...p })
    setTab('datos')
    setError('')
    setMd((p as unknown as Record<string, unknown>).md as string || '')
    setMensajeMd(null)
    setModal(true)
  }

  async function guardar(cerrar: boolean) {
    if (!form.nombre) { setError(t('errorNombreObligatorio')); return }
    setGuardando(true)
    try {
      if (editando) {
        await planesApi.actualizar(editando.codigo_plan, form)
      } else {
        const nuevo = await planesApi.crear(form)
        if (!cerrar) setEditando(nuevo)
      }
      if (cerrar) setModal(false)
      await cargar()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err?.response?.data?.detail || err?.message || tc('error'))
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!confirmacion) return
    try {
      await planesApi.eliminar(confirmacion.codigo_plan)
      await cargar()
    } finally {
      setConfirmacion(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="page-heading flex items-center gap-2"><CreditCard /> {t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">
          {t('subtitulo')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="ml-auto">
          <Boton variante="primario" onClick={abrirNuevo}><Plus size={16} /> {t('nuevoPlan')}</Boton>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-texto-muted">{tc('cargando')}</p>
      ) : (
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              <TablaTh>{t('colCodigo')}</TablaTh>
              <TablaTh>{t('colNombre')}</TablaTh>
              <TablaTh>{t('colSuperior')}</TablaTh>
              <TablaTh className="text-right">{t('colTokensMes')}</TablaTh>
              <TablaTh className="text-right">{t('colDocs')}</TablaTh>
              <TablaTh className="text-right">{t('colUsdMes')}</TablaTh>
              <TablaTh className="text-right">{t('colUsdAnio')}</TablaTh>
              <TablaTh className="text-right">{t('colDiasDur')}</TablaTh>
              <TablaTh className="text-center">{t('colPrueba')}</TablaTh>
              <TablaTh className="text-right w-24">{tc('acciones')}</TablaTh>
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {planes.map((p) => (
              <TablaFila key={p.codigo_plan}>
                <TablaTd className="font-mono text-xs">{p.codigo_plan}</TablaTd>
                <TablaTd className="font-medium" onDoubleClick={() => abrirEdicion(p)}>{p.nombre}</TablaTd>
                <TablaTd className="font-mono text-xs text-texto-muted">{p.codigo_plan_superior || '—'}</TablaTd>
                <TablaTd className="text-right">{p.tokens_mensuales?.toLocaleString() ?? '—'}</TablaTd>
                <TablaTd className="text-right">{p.documentos_maximos?.toLocaleString() ?? '—'}</TablaTd>
                <TablaTd className="text-right">{p.precio_mensual_usd != null ? `$${p.precio_mensual_usd}` : '—'}</TablaTd>
                <TablaTd className="text-right">{p.precio_anual_usd != null ? `$${p.precio_anual_usd}` : '—'}</TablaTd>
                <TablaTd className="text-right">{p.dias_duracion ?? '—'}</TablaTd>
                <TablaTd className="text-center">{p.es_plan_de_prueba ? <CheckCircle2 size={14} className="mx-auto text-green-600" /> : <Circle size={14} className="mx-auto text-texto-muted" />}</TablaTd>
                <TablaTd className="text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => abrirEdicion(p)} className="p-1 hover:text-primario" title={tc('editar')}><Pencil size={14} /></button>
                    <button onClick={() => setConfirmacion(p)} className="p-1 hover:text-error" title={tc('eliminar')}><Trash2 size={14} /></button>
                  </div>
                </TablaTd>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      {/* Modal */}
      {modal && (
        <Modal abierto={modal} alCerrar={() => setModal(false)} titulo={editando ? t('editarTitulo', { nombre: editando.nombre }) : t('nuevoTitulo')} className="max-w-3xl">
          <div className="flex flex-col gap-4 min-h-[500px]">
            <div className="flex gap-2 border-b border-borde">
              {([
                { key: 'datos', label: t('tabDatos') },
                { key: 'features', label: t('tabFeatures') },
                ...(editando ? [
                  { key: 'system_prompt' as TabModal, label: t('tabSystemPrompt') },
                  { key: 'programacion_insert' as TabModal, label: t('tabProgramacionInsert') },
                  { key: 'programacion_update' as TabModal, label: t('tabProgramacionUpdate') },
                  { key: 'md' as TabModal, label: t('tabMd') },
                ] : []),
              ] as { key: TabModal; label: string }[]).map((tt) => (
                <button
                  key={tt.key}
                  onClick={() => setTab(tt.key)}
                  className={`flex-1 text-center px-3 py-2 text-sm border-b-2 ${tab === tt.key ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}
                >
                  {tt.label}
                </button>
              ))}
            </div>

            {tab === 'datos' && (
              <div className="flex flex-col gap-3">
                {!editando && (
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaCodigo')}</label>
                    <Input value={form.codigo_plan || ''} onChange={(e) => setForm({ ...form, codigo_plan: e.target.value.toUpperCase() })} placeholder={t('placeholderCodigo')} />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">{t('etiquetaNombre')}</label>
                  <Input value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('etiquetaAlias')}</label>
                  <Input value={form.alias || ''} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('etiquetaPlanSuperior')}</label>
                  <select
                    className="w-full border border-borde rounded px-3 py-2 text-sm bg-fondo"
                    value={form.codigo_plan_superior ?? ''}
                    onChange={(e) => setForm({ ...form, codigo_plan_superior: e.target.value || null })}
                  >
                    <option value="">{t('opcionSinSuperior')}</option>
                    {planes
                      .filter((p) => !editando || p.codigo_plan !== editando.codigo_plan)
                      .map((p) => (
                        <option key={p.codigo_plan} value={p.codigo_plan}>
                          {p.nombre} ({p.codigo_plan})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-texto-muted mt-1">{t('descPlanSuperior')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('etiquetaDescripcion')}</label>
                  <textarea className="w-full border border-borde rounded px-3 py-2 text-sm" rows={2} value={form.descripcion || ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaPrecioMensual')}</label>
                    <Input type="number" value={form.precio_mensual_usd ?? ''} onChange={(e) => setForm({ ...form, precio_mensual_usd: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaPrecioAnual')}</label>
                    <Input type="number" value={form.precio_anual_usd ?? ''} onChange={(e) => setForm({ ...form, precio_anual_usd: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaTokensMensuales')}</label>
                    <Input type="number" value={form.tokens_mensuales ?? ''} onChange={(e) => setForm({ ...form, tokens_mensuales: e.target.value === '' ? null : parseInt(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaDocumentosMaximos')}</label>
                    <Input type="number" value={form.documentos_maximos ?? ''} onChange={(e) => setForm({ ...form, documentos_maximos: e.target.value === '' ? null : parseInt(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaDiasDuracion')}</label>
                    <Input type="number" value={form.dias_duracion ?? ''} onChange={(e) => setForm({ ...form, dias_duracion: e.target.value === '' ? null : parseInt(e.target.value) })} placeholder={t('placeholderDiasDuracion')} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaDiasGracia')}</label>
                    <Input type="number" value={form.dias_gracia_renovacion ?? 60} onChange={(e) => setForm({ ...form, dias_gracia_renovacion: parseInt(e.target.value) || 60 })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('etiquetaOrden')}</label>
                    <Input type="number" value={form.orden ?? 0} onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-error">{error}</div>}
                <PieBotonesModal editando={!!editando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModal(false)} cargando={guardando} />
              </div>
            )}

            {tab === 'features' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['conversacion_documentos', t('featureConversacionDocumentos')],
                    ['focos_lenguaje_natural', t('featureFocosLenguajeNatural')],
                    ['control_por_area', t('featureControlPorArea')],
                    ['control_por_cargo', t('featureControlPorCargo')],
                    ['servidor_cliente_local', t('featureServidorClienteLocal')],
                    ['personalizacion', t('featurePersonalizacion')],
                    ['eleccion_llms', t('featureEleccionLlms')],
                    ['multi_entidad_holdings', t('featureMultiEntidadHoldings')],
                    ['storage_propio', t('featureStoragePropio')],
                    ['tokens_extras_disponibles', t('featureTokensExtrasDisponibles')],
                    ['es_plan_de_prueba', t('featureEsPlanDePrueba')],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm p-2 border border-borde rounded hover:bg-gris-fondo">
                      <input
                        type="checkbox"
                        checked={!!(form as Record<string, unknown>)[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-error">{error}</div>}
                <PieBotonesModal editando={!!editando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModal(false)} cargando={guardando} />
              </div>
            )}

            {tab === 'system_prompt' && editando && (
              <div className="flex flex-col gap-3">
                <TabPrompts
                  tabla="planes"
                  pkColumna="codigo_plan"
                  pkValor={editando.codigo_plan}
                  campos={{
                    prompt_insert: form.prompt_insert ?? null,
                    prompt_update: form.prompt_update ?? null,
                    system_prompt: form.system_prompt ?? null,
                    python_insert: form.python_insert ?? null,
                    python_update: form.python_update ?? null,
                    javascript: form.javascript ?? null,
                    python_editado_manual: form.python_editado_manual ?? false,
                    javascript_editado_manual: form.javascript_editado_manual ?? false,
                  }}
                  onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
                  mostrarPromptInsert={false}
                  mostrarPromptUpdate={false}
                  mostrarSystemPrompt={true}
                  mostrarPythonInsert={false}
                  mostrarPythonUpdate={false}
                  mostrarJavaScript={false}
                />
                {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-error">{error}</div>}
                <PieBotonesModal
                  editando={!!editando}
                  onGuardar={() => guardar(false)}
                  onGuardarYSalir={() => guardar(true)}
                  onCerrar={() => setModal(false)}
                  cargando={guardando}
                  botonesIzquierda={editando ? (
                    <PieBotonesPrompts
                      tabla="planes"
                      pkColumna="codigo_plan"
                      pkValor={editando.codigo_plan}
                      promptInsert={form.prompt_insert ?? undefined}
                      promptUpdate={form.prompt_update ?? undefined}
                      modo="insert"
                    />
                  ) : undefined}
                />
              </div>
            )}

            {tab === 'programacion_insert' && editando && (
              <div className="flex flex-col gap-3">
                <TabPrompts
                  tabla="planes"
                  pkColumna="codigo_plan"
                  pkValor={editando.codigo_plan}
                  campos={{
                    prompt_insert: form.prompt_insert ?? null,
                    prompt_update: form.prompt_update ?? null,
                    system_prompt: form.system_prompt ?? null,
                    python_insert: form.python_insert ?? null,
                    python_update: form.python_update ?? null,
                    javascript: form.javascript ?? null,
                    python_editado_manual: form.python_editado_manual ?? false,
                    javascript_editado_manual: form.javascript_editado_manual ?? false,
                  }}
                  onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
                  mostrarSystemPrompt={false}
                  mostrarJavaScript={false}
                  mostrarPromptUpdate={false}
                  mostrarPythonUpdate={false}
                />
                {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-error">{error}</div>}
                <PieBotonesModal
                  editando={!!editando}
                  onGuardar={() => guardar(false)}
                  onGuardarYSalir={() => guardar(true)}
                  onCerrar={() => setModal(false)}
                  cargando={guardando}
                  botonesIzquierda={editando ? (
                    <PieBotonesPrompts
                      tabla="planes"
                      pkColumna="codigo_plan"
                      pkValor={editando.codigo_plan}
                      promptInsert={form.prompt_insert ?? undefined}
                      promptUpdate={form.prompt_update ?? undefined}
                      modo="insert"
                    />
                  ) : undefined}
                />
              </div>
            )}
            {tab === 'programacion_update' && editando && (
              <div className="flex flex-col gap-3">
                <TabPrompts
                  tabla="planes"
                  pkColumna="codigo_plan"
                  pkValor={editando.codigo_plan}
                  campos={{
                    prompt_insert: form.prompt_insert ?? null,
                    prompt_update: form.prompt_update ?? null,
                    system_prompt: form.system_prompt ?? null,
                    python_insert: form.python_insert ?? null,
                    python_update: form.python_update ?? null,
                    javascript: form.javascript ?? null,
                    python_editado_manual: form.python_editado_manual ?? false,
                    javascript_editado_manual: form.javascript_editado_manual ?? false,
                  }}
                  onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
                  mostrarSystemPrompt={false}
                  mostrarJavaScript={false}
                  mostrarPromptInsert={false}
                  mostrarPythonInsert={false}
                />
                {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-error">{error}</div>}
                <PieBotonesModal
                  editando={!!editando}
                  onGuardar={() => guardar(false)}
                  onGuardarYSalir={() => guardar(true)}
                  onCerrar={() => setModal(false)}
                  cargando={guardando}
                  botonesIzquierda={editando ? (
                    <PieBotonesPrompts
                      tabla="planes"
                      pkColumna="codigo_plan"
                      pkValor={editando.codigo_plan}
                      promptInsert={form.prompt_insert ?? undefined}
                      promptUpdate={form.prompt_update ?? undefined}
                      modo="update"
                    />
                  ) : undefined}
                />
              </div>
            )}

            {tab === 'md' && editando && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">{t('mdEtiqueta')}</label>
                  <textarea
                    value={md}
                    readOnly
                    rows={13}
                    placeholder={t('mdPlaceholder')}
                    className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                  />
                </div>
                {mensajeMd && (
                  <p className={`text-xs px-1 ${mensajeMd.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                    {mensajeMd.texto}
                  </p>
                )}
                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-2">
                    <Boton
                      className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                      onClick={async () => {
                        setGenerandoMd(true); setMensajeMd(null)
                        try {
                          const r = await planesApi.generarMd(editando.codigo_plan)
                          setMd(r.md)
                          setMensajeMd({ tipo: 'ok', texto: t('mdGenerarOk') })
                        } catch (e) {
                          setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : t('mdGenerarError') })
                        } finally { setGenerandoMd(false) }
                      }}
                      cargando={generandoMd}
                      disabled={generandoMd || sincronizandoMd}
                    >
                      {t('mdGenerar')}
                    </Boton>
                    <Boton
                      className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                      onClick={async () => {
                        setSincronizandoMd(true); setMensajeMd(null)
                        try {
                          const r = await promptsApi.sincronizarFila('planes', 'codigo_plan', editando.codigo_plan)
                          setMensajeMd({ tipo: 'ok', texto: t('mdSincronizarOk', { accion: r.accion, codigo: r.codigo_documento }) })
                        } catch (e) {
                          setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : t('mdSincronizarError') })
                        } finally { setSincronizandoMd(false) }
                      }}
                      cargando={sincronizandoMd}
                      disabled={generandoMd || sincronizandoMd || !md}
                    >
                      {t('mdSincronizar')}
                    </Boton>
                  </div>
                  <Boton variante="contorno" onClick={() => setModal(false)}>{tc('salir')}</Boton>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {confirmacion && (
        <ModalConfirmar
          abierto={!!confirmacion}
          titulo={t('eliminarTitulo', { nombre: confirmacion.nombre })}
          mensaje={t('eliminarConfirm', { nombre: confirmacion.nombre })}
          alConfirmar={eliminar}
          alCerrar={() => setConfirmacion(null)}
        />
      )}
    </div>
  )
}
