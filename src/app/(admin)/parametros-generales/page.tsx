'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { TabPrompts, type CamposPrompt } from '@/components/ui/tab-prompts'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { datosBasicosApi } from '@/lib/api'
import type { CategoriaParametro, TipoParametro } from '@/lib/tipos'
import { BotonChat } from '@/components/ui/boton-chat'

type TabId = 'categorias' | 'tipos'
type TabModalCat = 'datos' | 'system_prompt' | 'programacion'
type TabModalTipo = 'datos' | 'system_prompt' | 'programacion'

type ItemEliminar =
  | { tipo: 'categoria'; item: CategoriaParametro }
  | { tipo: 'tipoparam'; item: TipoParametro }

const selectCls = 'rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'
const inputCls = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'

export default function PaginaParametrosGenerales() {
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaParametro[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaParametro | null>(null)
  const [formCat, setFormCat] = useState({ categoria_parametro: '', nombre: '', descripcion: '', activo: true })
  const [promptsCat, setPromptsCat] = useState<CamposPrompt>({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalCat, setTabModalCat] = useState<TabModalCat>('datos')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoParametro[]>([])
  const [cargandoTipo, setCargandoTipo] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoParametro | null>(null)
  const [formTipo, setFormTipo] = useState({ categoria_parametro: '', tipo_parametro: '', nombre: '', descripcion: '', activo: true })
  const [promptsTipo, setPromptsTipo] = useState<CamposPrompt>({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalTipo, setTabModalTipo] = useState<TabModalTipo>('datos')
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  // ── Eliminación ────────────────────────────────────────────────────────────
  const [itemAEliminar, setItemAEliminar] = useState<ItemEliminar | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarCategorias = useCallback(async () => {
    setCargandoCat(true)
    try { setCategorias(await datosBasicosApi.listarCategorias()) }
    finally { setCargandoCat(false) }
  }, [])

  const cargarTipos = useCallback(async () => {
    setCargandoTipo(true)
    try { setTipos(await datosBasicosApi.listarTipos()) }
    finally { setCargandoTipo(false) }
  }, [])

  // ── Reordenar ─────────────────────────────────────────────────────────────
  const reordenarCategorias = async (nuevas: CategoriaParametro[]) => {
    const conOrden = nuevas.map((c, idx) => ({ ...c, orden: idx + 1 }))
    setCategorias(conOrden)
    try {
      await datosBasicosApi.reordenarCategorias(
        conOrden.map((c) => ({ categoria_parametro: c.categoria_parametro, orden: c.orden ?? 0 }))
      )
    } catch { cargarCategorias() }
  }

  const reordenarTipos = async (nuevos: TipoParametro[]) => {
    const conOrden = nuevos.map((t, idx) => ({ ...t, orden: idx + 1 }))
    if (filtroCategoria) {
      const resto = tipos.filter((t) => t.categoria_parametro !== filtroCategoria)
      setTipos([...resto, ...conOrden])
    } else {
      setTipos(conOrden)
    }
    try {
      await datosBasicosApi.reordenarTipos(
        conOrden.map((t) => ({ categoria_parametro: t.categoria_parametro, tipo_parametro: t.tipo_parametro, orden: t.orden ?? 0 }))
      )
    } catch { cargarTipos() }
  }

  useEffect(() => { cargarCategorias(); cargarTipos() }, [cargarCategorias, cargarTipos])

  // ── Categorías: guardar ────────────────────────────────────────────────────
  const abrirNuevaCat = () => { setCatEditando(null); setFormCat({ categoria_parametro: '', nombre: '', descripcion: '', activo: true }); setPromptsCat({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false }); setTabModalCat('datos'); setErrorCat(''); setModalCat(true) }
  const abrirEditarCat = (c: CategoriaParametro) => { const c2 = c as unknown as Record<string, unknown>; setCatEditando(c); setFormCat({ categoria_parametro: c.categoria_parametro, nombre: c.nombre, descripcion: c.descripcion || '', activo: c.activo }); setPromptsCat({ prompt_insert: c2.prompt_insert as string ?? null, prompt_update: c2.prompt_update as string ?? null, system_prompt: c2.system_prompt as string ?? null, python_insert: c2.python_insert as string ?? null, python_update: c2.python_update as string ?? null, javascript: c2.javascript as string ?? null, python_editado_manual: c2.python_editado_manual as boolean ?? false, javascript_editado_manual: c2.javascript_editado_manual as boolean ?? false }); setTabModalCat('datos'); setErrorCat(''); setModalCat(true) }

  const guardarCat = async () => {
    if (!formCat.categoria_parametro.trim() || !formCat.nombre.trim()) { setErrorCat('Código y nombre son obligatorios'); return }
    setGuardandoCat(true); setErrorCat('')
    try {
      if (catEditando) {
        await datosBasicosApi.actualizarCategoria(catEditando.categoria_parametro, { nombre: formCat.nombre, descripcion: formCat.descripcion, activo: formCat.activo, prompt_insert: promptsCat.prompt_insert, prompt_update: promptsCat.prompt_update, system_prompt: promptsCat.system_prompt, python_insert: promptsCat.python_insert, python_update: promptsCat.python_update, javascript: promptsCat.javascript, python_editado_manual: promptsCat.python_editado_manual, javascript_editado_manual: promptsCat.javascript_editado_manual })
      } else {
        await datosBasicosApi.crearCategoria({ categoria_parametro: formCat.categoria_parametro.toUpperCase(), nombre: formCat.nombre, descripcion: formCat.descripcion, activo: formCat.activo })
      }
      setModalCat(false); cargarCategorias()
    } catch (e) { setErrorCat(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setGuardandoCat(false) }
  }

  // ── Tipos: guardar ─────────────────────────────────────────────────────────
  const abrirNuevoTipo = () => { setTipoEditando(null); setFormTipo({ categoria_parametro: filtroCategoria, tipo_parametro: '', nombre: '', descripcion: '', activo: true }); setPromptsTipo({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false }); setTabModalTipo('datos'); setErrorTipo(''); setModalTipo(true) }
  const abrirEditarTipo = (t: TipoParametro) => { const t2 = t as unknown as Record<string, unknown>; setTipoEditando(t); setFormTipo({ categoria_parametro: t.categoria_parametro, tipo_parametro: t.tipo_parametro, nombre: t.nombre, descripcion: t.descripcion || '', activo: t.activo }); setPromptsTipo({ prompt_insert: t2.prompt_insert as string ?? null, prompt_update: t2.prompt_update as string ?? null, system_prompt: t2.system_prompt as string ?? null, python_insert: t2.python_insert as string ?? null, python_update: t2.python_update as string ?? null, javascript: t2.javascript as string ?? null, python_editado_manual: t2.python_editado_manual as boolean ?? false, javascript_editado_manual: t2.javascript_editado_manual as boolean ?? false }); setTabModalTipo('datos'); setErrorTipo(''); setModalTipo(true) }

  const guardarTipo = async () => {
    if (!formTipo.categoria_parametro || !formTipo.tipo_parametro.trim() || !formTipo.nombre.trim()) { setErrorTipo('Categoría, código y nombre son obligatorios'); return }
    setGuardandoTipo(true); setErrorTipo('')
    try {
      if (tipoEditando) {
        await datosBasicosApi.actualizarTipo(tipoEditando.categoria_parametro, tipoEditando.tipo_parametro, { nombre: formTipo.nombre, descripcion: formTipo.descripcion, activo: formTipo.activo, prompt_insert: promptsTipo.prompt_insert, prompt_update: promptsTipo.prompt_update, system_prompt: promptsTipo.system_prompt, python_insert: promptsTipo.python_insert, python_update: promptsTipo.python_update, javascript: promptsTipo.javascript, python_editado_manual: promptsTipo.python_editado_manual, javascript_editado_manual: promptsTipo.javascript_editado_manual })
      } else {
        await datosBasicosApi.crearTipo({ categoria_parametro: formTipo.categoria_parametro, tipo_parametro: formTipo.tipo_parametro.toUpperCase(), nombre: formTipo.nombre, descripcion: formTipo.descripcion, activo: formTipo.activo })
      }
      setModalTipo(false); cargarTipos()
    } catch (e) { setErrorTipo(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setGuardandoTipo(false) }
  }

  // ── Eliminación ────────────────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    if (!itemAEliminar) return
    setEliminando(true)
    try {
      if (itemAEliminar.tipo === 'categoria') {
        await datosBasicosApi.eliminarCategoria(itemAEliminar.item.categoria_parametro)
        cargarCategorias(); cargarTipos()
      } else {
        const t = itemAEliminar.item as TipoParametro
        await datosBasicosApi.eliminarTipo(t.categoria_parametro, t.tipo_parametro)
        cargarTipos()
      }
      setItemAEliminar(null)
    } catch (e) { console.error(e) }
    finally { setEliminando(false) }
  }

  const tiposFiltrados = filtroCategoria ? tipos.filter((t) => t.categoria_parametro === filtroCategoria) : tipos

  const tabs: { id: TabId; label: string }[] = [
    { id: 'categorias', label: 'Categorías de Parámetro' },
    { id: 'tipos', label: 'Tipos de Parámetro' },
  ]

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat />
      <div>
        <h2 className="page-heading">Parámetros — Datos Básicos</h2>
        <p className="text-sm text-texto-muted mt-1">Administra las categorías y tipos de parámetros del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setTabActiva(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tabActiva === tab.id ? 'bg-surface text-primario-oscuro shadow-sm border border-borde' : 'text-texto-muted hover:text-texto'}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* ── Tab: Categorías ── */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-texto-muted">{categorias.length} categorías registradas</p>
            <Boton variante="primario" onClick={abrirNuevaCat}><Plus size={16} /> Nueva categoría</Boton>
          </div>

          {cargandoCat ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh className="w-8"></TablaTh>
                <TablaTh className="w-10">#</TablaTh>
                <TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh><TablaTh>Estado</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {categorias.length === 0 ? (
                  <tr><TablaTd className="text-center text-texto-muted py-8" colSpan={7 as never}>No hay categorías registradas</TablaTd></tr>
                ) : (
                  <SortableDndContext
                    items={categorias as unknown as Record<string, unknown>[]}
                    getId={(item) => (item as unknown as CategoriaParametro).categoria_parametro}
                    onReorder={(items) => reordenarCategorias(items as unknown as CategoriaParametro[])}
                  >
                    {categorias.map((c, idx) => (
                      <SortableRow key={c.categoria_parametro} id={c.categoria_parametro}
                        onDoubleClick={() => { setFiltroCategoria(c.categoria_parametro); setTabActiva('tipos') }}
                      >
                        <TablaTd className="text-xs text-texto-muted w-10 text-center">{c.orden ?? idx + 1}</TablaTd>
                        <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.categoria_parametro}</code></TablaTd>
                        <TablaTd className="font-medium">{c.nombre}</TablaTd>
                        <TablaTd className="text-texto-muted text-sm">{c.descripcion || <span className="text-texto-light">—</span>}</TablaTd>
                        <TablaTd>
                          <Insignia variante={c.activo ? 'exito' : 'error'}>{c.activo ? 'Activo' : 'Inactivo'}</Insignia>
                        </TablaTd>
                        <TablaTd>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setFiltroCategoria(c.categoria_parametro); setTabActiva('tipos') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver tipos"><Eye size={14} /></button>
                            <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                            <button onClick={() => setItemAEliminar({ tipo: 'categoria', item: c })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                          </div>
                        </TablaTd>
                      </SortableRow>
                    ))}
                  </SortableDndContext>
                )}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* ── Tab: Tipos ── */}
      {tabActiva === 'tipos' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-texto-muted">Filtrar por categoría:</p>
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {categorias.map((c) => <option key={c.categoria_parametro} value={c.categoria_parametro}>{c.nombre}</option>)}
              </select>
            </div>
            <Boton variante="primario" onClick={abrirNuevoTipo}><Plus size={16} /> Nuevo tipo</Boton>
          </div>

          {filtroCategoria === '' && (
            <div className="bg-primario-muy-claro/50 border border-primario/20 rounded-lg px-4 py-3">
              <p className="text-sm text-primario-oscuro">Selecciona una categoría para ver sus tipos, o muestra todos.</p>
            </div>
          )}

          {cargandoTipo ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh className="w-8"></TablaTh>
                <TablaTh className="w-10">#</TablaTh>
                <TablaTh>Categoría</TablaTh><TablaTh>Código tipo</TablaTh><TablaTh>Nombre</TablaTh>
                <TablaTh>Descripción</TablaTh><TablaTh>Estado</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {tiposFiltrados.length === 0 ? (
                  <tr><TablaTd className="text-center text-texto-muted py-8" colSpan={8 as never}>No hay tipos registrados</TablaTd></tr>
                ) : (
                  <SortableDndContext
                    items={tiposFiltrados as unknown as Record<string, unknown>[]}
                    getId={(item) => { const t = item as unknown as TipoParametro; return `${t.categoria_parametro}/${t.tipo_parametro}` }}
                    onReorder={(items) => reordenarTipos(items as unknown as TipoParametro[])}
                  >
                    {tiposFiltrados.map((t, idx) => (
                      <SortableRow key={`${t.categoria_parametro}/${t.tipo_parametro}`} id={`${t.categoria_parametro}/${t.tipo_parametro}`}>
                        <TablaTd className="text-xs text-texto-muted w-10 text-center">{t.orden ?? idx + 1}</TablaTd>
                        <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.categoria_parametro}</code></TablaTd>
                        <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.tipo_parametro}</code></TablaTd>
                        <TablaTd className="font-medium">{t.nombre}</TablaTd>
                        <TablaTd className="text-texto-muted text-sm">{t.descripcion || <span className="text-texto-light">—</span>}</TablaTd>
                        <TablaTd>
                          <Insignia variante={t.activo ? 'exito' : 'error'}>{t.activo ? 'Activo' : 'Inactivo'}</Insignia>
                        </TablaTd>
                        <TablaTd>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => abrirEditarTipo(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                            <button onClick={() => setItemAEliminar({ tipo: 'tipoparam', item: t })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                          </div>
                        </TablaTd>
                      </SortableRow>
                    ))}
                  </SortableDndContext>
                )}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* ── Modal Categoría ── */}
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? 'Editar categoría' : 'Nueva categoría de parámetro'}>
        <div className="flex flex-col gap-4 p-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-borde -mt-2">
            {(['datos', 'system_prompt', 'programacion'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalCat(tab)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 ${tabModalCat === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : 'Programación'}
              </button>
            ))}
          </div>

          {tabModalCat === 'datos' && <>
            {!catEditando && (
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Código *</label>
                <input className={inputCls} placeholder="ej: SISTEMA" value={formCat.categoria_parametro}
                  onChange={(e) => setFormCat({ ...formCat, categoria_parametro: e.target.value.toUpperCase() })} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Nombre *</label>
              <input className={inputCls} placeholder="Nombre de la categoría" value={formCat.nombre}
                onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Descripción</label>
              <textarea className={inputCls} rows={2} placeholder="Descripción opcional" value={formCat.descripcion}
                onChange={(e) => setFormCat({ ...formCat, descripcion: e.target.value })} />
            </div>
            {catEditando && (
              <label className="flex items-center gap-2 text-sm text-texto cursor-pointer">
                <input type="checkbox" checked={formCat.activo} onChange={(e) => setFormCat({ ...formCat, activo: e.target.checked })}
                  className="rounded border-borde text-primario h-4 w-4" />
                Activo
              </label>
            )}
          </>}

          {tabModalCat === 'system_prompt' && catEditando && (
            <TabPrompts tabla="categorias_parametro" pkColumna="categoria_parametro" pkValor={catEditando.categoria_parametro}
              campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
              mostrarPromptInsert={false} mostrarPromptUpdate={false} mostrarSystemPrompt={true} mostrarPythonInsert={false} mostrarPythonUpdate={false} mostrarJavaScript={false} />
          )}

          {tabModalCat === 'programacion' && catEditando && (
            <TabPrompts tabla="categorias_parametro" pkColumna="categoria_parametro" pkValor={catEditando.categoria_parametro}
              campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} />
          )}

          {errorCat && <p className="text-sm text-error">{errorCat}</p>}
        </div>
        <div className="flex gap-3 justify-end px-4 pb-4">
          <Boton variante="contorno" onClick={() => setModalCat(false)}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardarCat} cargando={guardandoCat}>{catEditando ? 'Guardar' : 'Crear'}</Boton>
        </div>
      </Modal>

      {/* ── Modal Tipo ── */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? 'Editar tipo' : 'Nuevo tipo de parámetro'}>
        <div className="flex flex-col gap-4 p-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-borde -mt-2">
            {(['datos', 'system_prompt', 'programacion'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalTipo(tab)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 ${tabModalTipo === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : 'Programación'}
              </button>
            ))}
          </div>

          {tabModalTipo === 'datos' && <>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Categoría *</label>
              <select className={selectCls} value={formTipo.categoria_parametro}
                onChange={(e) => setFormTipo({ ...formTipo, categoria_parametro: e.target.value })}
                disabled={!!tipoEditando}>
                <option value="">Selecciona categoría</option>
                {categorias.map((c) => <option key={c.categoria_parametro} value={c.categoria_parametro}>{c.nombre}</option>)}
              </select>
            </div>
            {!tipoEditando && (
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Código *</label>
                <input className={inputCls} placeholder="ej: TIMEOUT" value={formTipo.tipo_parametro}
                  onChange={(e) => setFormTipo({ ...formTipo, tipo_parametro: e.target.value.toUpperCase() })} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Nombre *</label>
              <input className={inputCls} placeholder="Nombre del tipo" value={formTipo.nombre}
                onChange={(e) => setFormTipo({ ...formTipo, nombre: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Descripción</label>
              <textarea className={inputCls} rows={2} placeholder="Descripción opcional" value={formTipo.descripcion}
                onChange={(e) => setFormTipo({ ...formTipo, descripcion: e.target.value })} />
            </div>
            {tipoEditando && (
              <label className="flex items-center gap-2 text-sm text-texto cursor-pointer">
                <input type="checkbox" checked={formTipo.activo} onChange={(e) => setFormTipo({ ...formTipo, activo: e.target.checked })}
                  className="rounded border-borde text-primario h-4 w-4" />
                Activo
              </label>
            )}
          </>}

          {tabModalTipo === 'system_prompt' && tipoEditando && (
            <TabPrompts tabla="tipos_parametro" pkColumna="tipo_parametro" pkValor={tipoEditando.tipo_parametro}
              campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
              mostrarPromptInsert={false} mostrarPromptUpdate={false} mostrarSystemPrompt={true} mostrarPythonInsert={false} mostrarPythonUpdate={false} mostrarJavaScript={false} />
          )}

          {tabModalTipo === 'programacion' && tipoEditando && (
            <TabPrompts tabla="tipos_parametro" pkColumna="tipo_parametro" pkValor={tipoEditando.tipo_parametro}
              campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} />
          )}

          {errorTipo && <p className="text-sm text-error">{errorTipo}</p>}
        </div>
        <div className="flex gap-3 justify-end px-4 pb-4">
          <Boton variante="contorno" onClick={() => setModalTipo(false)}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardarTipo} cargando={guardandoTipo}>{tipoEditando ? 'Guardar' : 'Crear'}</Boton>
        </div>
      </Modal>

      {/* ── Confirmar eliminación ── */}
      <ModalConfirmar
        abierto={!!itemAEliminar}
        alCerrar={() => setItemAEliminar(null)}
        alConfirmar={confirmarEliminar}
        titulo="Eliminar"
        mensaje={itemAEliminar
          ? itemAEliminar.tipo === 'categoria'
            ? `¿Eliminar la categoría "${(itemAEliminar.item as CategoriaParametro).nombre}"? Se eliminarán también sus tipos.`
            : `¿Eliminar el tipo "${(itemAEliminar.item as TipoParametro).nombre}"?`
          : ''}
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </div>
  )
}
