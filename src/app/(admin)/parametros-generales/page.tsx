'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Eye, Search, Download } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { exportarExcel } from '@/lib/exportar-excel'
import { TabPrompts, type CamposPrompt } from '@/components/ui/tab-prompts'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { datosBasicosApi, promptsApi } from '@/lib/api'
import type { CategoriaParametro, TipoParametro } from '@/lib/tipos'
import { BotonChat } from '@/components/ui/boton-chat'

type TabId = 'categorias' | 'tipos'
type TabModalCat = 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'
type TabModalTipo = 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'

type ItemEliminar =
  | { tipo: 'categoria'; item: CategoriaParametro }
  | { tipo: 'tipoparam'; item: TipoParametro }

const selectCls = 'rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'
const inputCls = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'

export default function PaginaParametrosGenerales() {
  const t = useTranslations('parametrosGenerales')
  const tc = useTranslations('common')
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaParametro[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaParametro | null>(null)
  const [formCat, setFormCat] = useState({
    categoria_parametro: '', nombre: '', descripcion: '',
    replica_grupo: false, visible_grupo: true, editable_grupo: true,
    replica_usuario: false, visible_usuario: true, editable_usuario: true,
  })
  const [promptsCat, setPromptsCat] = useState<CamposPrompt>({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [mdCat, setMdCat] = useState<string>('')
  const [generandoMdCat, setGenerandoMdCat] = useState(false)
  const [sincronizandoMdCat, setSincronizandoMdCat] = useState(false)
  const [mensajeMdCat, setMensajeMdCat] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [tabModalCat, setTabModalCat] = useState<TabModalCat>('datos')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoParametro[]>([])
  const [cargandoTipo, setCargandoTipo] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoParametro | null>(null)
  const [formTipo, setFormTipo] = useState({ categoria_parametro: '', tipo_parametro: '', nombre: '', descripcion: '' })
  const [promptsTipo, setPromptsTipo] = useState<CamposPrompt>({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [mdTipo, setMdTipo] = useState<string>('')
  const [generandoMdTipo, setGenerandoMdTipo] = useState(false)
  const [sincronizandoMdTipo, setSincronizandoMdTipo] = useState(false)
  const [mensajeMdTipo, setMensajeMdTipo] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [tabModalTipo, setTabModalTipo] = useState<TabModalTipo>('datos')
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busquedaCat, setBusquedaCat] = useState('')

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
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({
      categoria_parametro: '', nombre: '', descripcion: '',
      replica_grupo: false, visible_grupo: true, editable_grupo: true,
      replica_usuario: false, visible_usuario: true, editable_usuario: true,
    })
    setPromptsCat({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
    setMdCat(''); setMensajeMdCat(null); setTabModalCat('datos'); setErrorCat(''); setModalCat(true)
  }
  const abrirEditarCat = (c: CategoriaParametro) => {
    const c2 = c as unknown as Record<string, unknown>
    setCatEditando(c)
    setFormCat({
      categoria_parametro: c.categoria_parametro,
      nombre: c.nombre,
      descripcion: c.descripcion || '',
      replica_grupo: c.replica_grupo ?? false,
      visible_grupo: c.visible_grupo ?? true,
      editable_grupo: c.editable_grupo ?? true,
      replica_usuario: c.replica_usuario ?? false,
      visible_usuario: c.visible_usuario ?? true,
      editable_usuario: c.editable_usuario ?? true,
    })
    setPromptsCat({ prompt_insert: c2.prompt_insert as string ?? null, prompt_update: c2.prompt_update as string ?? null, system_prompt: c2.system_prompt as string ?? null, python_insert: c2.python_insert as string ?? null, python_update: c2.python_update as string ?? null, javascript: c2.javascript as string ?? null, python_editado_manual: c2.python_editado_manual as boolean ?? false, javascript_editado_manual: c2.javascript_editado_manual as boolean ?? false })
    setMdCat((c2.md as string) || ''); setMensajeMdCat(null); setTabModalCat('datos'); setErrorCat(''); setModalCat(true)
  }

  const guardarCat = async (cerrar: boolean) => {
    if (!formCat.categoria_parametro.trim() || !formCat.nombre.trim()) { setErrorCat(t('errorCodigoNombreObligatorios')); return }
    setGuardandoCat(true); setErrorCat('')
    try {
      if (catEditando) {
        const actualizado = await datosBasicosApi.actualizarCategoria(catEditando.categoria_parametro, {
          nombre: formCat.nombre, descripcion: formCat.descripcion,
          replica_grupo: formCat.replica_grupo, visible_grupo: formCat.visible_grupo, editable_grupo: formCat.editable_grupo,
          replica_usuario: formCat.replica_usuario, visible_usuario: formCat.visible_usuario, editable_usuario: formCat.editable_usuario,
          prompt_insert: promptsCat.prompt_insert, prompt_update: promptsCat.prompt_update, system_prompt: promptsCat.system_prompt,
          python_insert: promptsCat.python_insert, python_update: promptsCat.python_update, javascript: promptsCat.javascript,
          python_editado_manual: promptsCat.python_editado_manual, javascript_editado_manual: promptsCat.javascript_editado_manual,
        })
        setCatEditando(actualizado)
      } else {
        const creada = await datosBasicosApi.crearCategoria({
          categoria_parametro: formCat.categoria_parametro.toUpperCase(),
          nombre: formCat.nombre, descripcion: formCat.descripcion,
          replica_grupo: formCat.replica_grupo, visible_grupo: formCat.visible_grupo, editable_grupo: formCat.editable_grupo,
          replica_usuario: formCat.replica_usuario, visible_usuario: formCat.visible_usuario, editable_usuario: formCat.editable_usuario,
        })
        if (!cerrar) setCatEditando(creada)
      }
      if (cerrar) setModalCat(false)
      cargarCategorias()
    } catch (e) { setErrorCat(e instanceof Error ? e.message : tc('errorAlGuardar')) }
    finally { setGuardandoCat(false) }
  }

  // ── Tipos: guardar ─────────────────────────────────────────────────────────
  const abrirNuevoTipo = () => { setTipoEditando(null); setFormTipo({ categoria_parametro: filtroCategoria, tipo_parametro: '', nombre: '', descripcion: '' }); setPromptsTipo({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false }); setMdTipo(''); setMensajeMdTipo(null); setTabModalTipo('datos'); setErrorTipo(''); setModalTipo(true) }
  const abrirEditarTipo = (t: TipoParametro) => { const t2 = t as unknown as Record<string, unknown>; setTipoEditando(t); setFormTipo({ categoria_parametro: t.categoria_parametro, tipo_parametro: t.tipo_parametro, nombre: t.nombre, descripcion: t.descripcion || '' }); setPromptsTipo({ prompt_insert: t2.prompt_insert as string ?? null, prompt_update: t2.prompt_update as string ?? null, system_prompt: t2.system_prompt as string ?? null, python_insert: t2.python_insert as string ?? null, python_update: t2.python_update as string ?? null, javascript: t2.javascript as string ?? null, python_editado_manual: t2.python_editado_manual as boolean ?? false, javascript_editado_manual: t2.javascript_editado_manual as boolean ?? false }); setMdTipo((t2.md as string) || ''); setMensajeMdTipo(null); setTabModalTipo('datos'); setErrorTipo(''); setModalTipo(true) }

  const guardarTipo = async (cerrar: boolean) => {
    if (!formTipo.categoria_parametro || !formTipo.tipo_parametro.trim() || !formTipo.nombre.trim()) { setErrorTipo(t('errorCategoriaCodigoNombreObligatorios')); return }
    setGuardandoTipo(true); setErrorTipo('')
    try {
      if (tipoEditando) {
        const actualizado = await datosBasicosApi.actualizarTipo(tipoEditando.categoria_parametro, tipoEditando.tipo_parametro, { nombre: formTipo.nombre, descripcion: formTipo.descripcion, prompt_insert: promptsTipo.prompt_insert, prompt_update: promptsTipo.prompt_update, system_prompt: promptsTipo.system_prompt, python_insert: promptsTipo.python_insert, python_update: promptsTipo.python_update, javascript: promptsTipo.javascript, python_editado_manual: promptsTipo.python_editado_manual, javascript_editado_manual: promptsTipo.javascript_editado_manual })
        setTipoEditando(actualizado)
      } else {
        const creado = await datosBasicosApi.crearTipo({ categoria_parametro: formTipo.categoria_parametro, tipo_parametro: formTipo.tipo_parametro.toUpperCase(), nombre: formTipo.nombre, descripcion: formTipo.descripcion })
        if (!cerrar) setTipoEditando(creado)
      }
      if (cerrar) setModalTipo(false)
      cargarTipos()
    } catch (e) { setErrorTipo(e instanceof Error ? e.message : tc('errorAlGuardar')) }
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

  const catsFiltradas = categorias.filter((c) =>
    busquedaCat.length === 0 ||
    c.categoria_parametro.toLowerCase().includes(busquedaCat.toLowerCase()) ||
    c.nombre.toLowerCase().includes(busquedaCat.toLowerCase())
  )

  const tiposFiltrados = filtroCategoria ? tipos.filter((t) => t.categoria_parametro === filtroCategoria) : tipos

  const tabs: { id: TabId; label: string }[] = [
    { id: 'categorias', label: t('tabCategorias') },
    { id: 'tipos', label: t('tabTipos') },
  ]

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat />
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtituloAdmin')}</p>
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
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder={t('buscarCategoriaPlaceholder')} value={busquedaCat} onChange={(e) => setBusquedaCat(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" disabled={catsFiltradas.length === 0}
                onClick={() => exportarExcel(catsFiltradas as unknown as Record<string, unknown>[], [
                  { titulo: t('colCodigo'), campo: 'categoria_parametro' },
                  { titulo: t('colNombre'), campo: 'nombre' },
                  { titulo: t('colRepGrupo'), campo: 'replica_grupo', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colVisGrupo'), campo: 'visible_grupo', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colEditGrupo'), campo: 'editable_grupo', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colRepUsuario'), campo: 'replica_usuario', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colVisUsuario'), campo: 'visible_usuario', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colEditUsuario'), campo: 'editable_usuario', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colNombre'), campo: 'nombre', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
                ], 'categorias-parametro')}>
                <Download size={15} />{tc('exportarExcel')}
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaCat}><Plus size={16} /> {t('nuevaCategoria')}</Boton>
            </div>
          </div>

          {cargandoCat ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh className="w-8"></TablaTh>
                <TablaTh className="w-10">#</TablaTh>
                <TablaTh>{t('colCodigo')}</TablaTh>
                <TablaTh>{t('colNombre')}</TablaTh>
                <TablaTh>{t('colDescripcion')}</TablaTh>
                <TablaTh className="text-center">{t('colRepGrupo')}</TablaTh>
                <TablaTh className="text-center">{t('colVisGrupo')}</TablaTh>
                <TablaTh className="text-center">{t('colEditGrupo')}</TablaTh>
                <TablaTh className="text-center">{t('colRepUsuario')}</TablaTh>
                <TablaTh className="text-center">{t('colVisUsuario')}</TablaTh>
                <TablaTh className="text-center">{t('colEditUsuario')}</TablaTh>
                <TablaTh className="text-right">{tc('acciones')}</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {catsFiltradas.length === 0 ? (
                  <tr><TablaTd className="text-center text-texto-muted py-8" colSpan={12 as never}>{busquedaCat ? t('sinCategoriasEncontradas') : t('sinCategoriasRegistradas')}</TablaTd></tr>
                ) : (
                  <SortableDndContext
                    items={catsFiltradas as unknown as Record<string, unknown>[]}
                    getId={(item) => (item as unknown as CategoriaParametro).categoria_parametro}
                    onReorder={(items) => reordenarCategorias(items as unknown as CategoriaParametro[])}
                    disabled={!!busquedaCat}
                  >
                    {catsFiltradas.map((c, idx) => (
                      <SortableRow key={c.categoria_parametro} id={c.categoria_parametro}>
                        <TablaTd className="text-xs text-texto-muted w-10 text-center">{c.orden ?? idx + 1}</TablaTd>
                        <TablaTd onDoubleClick={() => abrirEditarCat(c)}><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.categoria_parametro}</code></TablaTd>
                        <TablaTd className="font-medium" onDoubleClick={() => abrirEditarCat(c)}>{c.nombre}</TablaTd>
                        <TablaTd className="text-texto-muted text-sm" onDoubleClick={() => { setFiltroCategoria(c.categoria_parametro); setTabActiva('tipos') }}>{c.descripcion || <span className="text-texto-light">—</span>}</TablaTd>
                        <TablaTd className="text-center"><Insignia variante={c.replica_grupo ? 'exito' : 'error'}>{c.replica_grupo ? tc('si') : tc('no')}</Insignia></TablaTd>
                        <TablaTd className="text-center"><Insignia variante={c.visible_grupo ? 'exito' : 'error'}>{c.visible_grupo ? tc('si') : tc('no')}</Insignia></TablaTd>
                        <TablaTd className="text-center"><Insignia variante={c.editable_grupo ? 'exito' : 'error'}>{c.editable_grupo ? tc('si') : tc('no')}</Insignia></TablaTd>
                        <TablaTd className="text-center"><Insignia variante={c.replica_usuario ? 'exito' : 'error'}>{c.replica_usuario ? tc('si') : tc('no')}</Insignia></TablaTd>
                        <TablaTd className="text-center"><Insignia variante={c.visible_usuario ? 'exito' : 'error'}>{c.visible_usuario ? tc('si') : tc('no')}</Insignia></TablaTd>
                        <TablaTd className="text-center"><Insignia variante={c.editable_usuario ? 'exito' : 'error'}>{c.editable_usuario ? tc('si') : tc('no')}</Insignia></TablaTd>
                        <TablaTd>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setFiltroCategoria(c.categoria_parametro); setTabActiva('tipos') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={t('verTipos')}><Eye size={14} /></button>
                            <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={tc('editar')}><Pencil size={14} /></button>
                            <button onClick={() => setItemAEliminar({ tipo: 'categoria', item: c })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title={tc('eliminar')}><Trash2 size={14} /></button>
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
              <p className="text-sm text-texto-muted">{t('filtrarPorCategoria')}</p>
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={selectCls}>
                <option value="">{t('todas')}</option>
                {categorias.map((c) => <option key={c.categoria_parametro} value={c.categoria_parametro}>{c.nombre}</option>)}
              </select>
            </div>
            <Boton variante="primario" onClick={abrirNuevoTipo}><Plus size={16} /> {t('nuevoTipo')}</Boton>
          </div>

          {filtroCategoria === '' && (
            <div className="bg-primario-muy-claro/50 border border-primario/20 rounded-lg px-4 py-3">
              <p className="text-sm text-primario-oscuro">{t('seleccionaCategoriaTipos')}</p>
            </div>
          )}

          {cargandoTipo ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh className="w-8"></TablaTh>
                <TablaTh className="w-10">#</TablaTh>
                <TablaTh>{t('colCategoria')}</TablaTh><TablaTh>{t('colCodigoTipo')}</TablaTh><TablaTh>{t('colNombre')}</TablaTh>
                <TablaTh>{t('colDescripcion')}</TablaTh><TablaTh>{t('colEstado')}</TablaTh>
                <TablaTh className="text-right">{tc('acciones')}</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {tiposFiltrados.length === 0 ? (
                  <tr><TablaTd className="text-center text-texto-muted py-8" colSpan={8 as never}>{t('sinTiposRegistrados')}</TablaTd></tr>
                ) : (
                  <SortableDndContext
                    items={tiposFiltrados as unknown as Record<string, unknown>[]}
                    getId={(item) => { const t = item as unknown as TipoParametro; return `${t.categoria_parametro}/${t.tipo_parametro}` }}
                    onReorder={(items) => reordenarTipos(items as unknown as TipoParametro[])}
                  >
                    {tiposFiltrados.map((t, idx) => (
                      <SortableRow key={`${t.categoria_parametro}/${t.tipo_parametro}`} id={`${t.categoria_parametro}/${t.tipo_parametro}`}>
                        <TablaTd className="text-xs text-texto-muted w-10 text-center">{t.orden ?? idx + 1}</TablaTd>
                        <TablaTd onDoubleClick={() => abrirEditarTipo(t)}><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.categoria_parametro}</code></TablaTd>
                        <TablaTd onDoubleClick={() => abrirEditarTipo(t)}><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.tipo_parametro}</code></TablaTd>
                        <TablaTd className="font-medium" onDoubleClick={() => abrirEditarTipo(t)}>{t.nombre}</TablaTd>
                        <TablaTd className="text-texto-muted text-sm">{t.descripcion || <span className="text-texto-light">—</span>}</TablaTd>
                        <TablaTd>
                          
                        </TablaTd>
                        <TablaTd>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => abrirEditarTipo(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={tc('editar')}><Pencil size={14} /></button>
                            <button onClick={() => setItemAEliminar({ tipo: 'tipoparam', item: t })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title={tc('eliminar')}><Trash2 size={14} /></button>
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
      <Modal
        abierto={modalCat}
        alCerrar={() => setModalCat(false)}
        titulo={catEditando ? t('editarCategoriaTitulo', { nombre: catEditando.nombre }) : t('nuevaCategoriaTitulo')}
        className="w-[853px] max-w-[95vw]"
      >
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-borde -mt-2 overflow-x-auto">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalCat(tab)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 whitespace-nowrap ${tabModalCat === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? t('tabDatos') : tab === 'system_prompt' ? t('tabSystemPrompt') : tab === 'programacion_insert' ? t('tabPromptInsert') : tab === 'programacion_update' ? t('tabPromptUpdate') : t('tabMd')}
              </button>
            ))}
          </div>

          {tabModalCat === 'datos' && (
            <div className="flex flex-col gap-4">
              {!catEditando && (
                <div>
                  <label className="block text-sm font-medium text-texto mb-1">{t('etiquetaCodigo')}</label>
                  <input className={inputCls} placeholder={t('placeholderCodigoCat')} value={formCat.categoria_parametro}
                    onChange={(e) => setFormCat({ ...formCat, categoria_parametro: e.target.value.toUpperCase() })} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-texto mb-1">{t('etiquetaNombre')}</label>
                <input className={inputCls} placeholder={t('placeholderNombreCat')} value={formCat.nombre}
                  onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">{t('etiquetaDescripcion')}</label>
                <textarea className={inputCls} rows={2} placeholder={t('placeholderDescripcionOpcional')} value={formCat.descripcion}
                  onChange={(e) => setFormCat({ ...formCat, descripcion: e.target.value })} />
              </div>
              <div className="border border-borde rounded-lg p-3">
                <p className="text-sm font-medium text-texto mb-2">{t('politicasTitulo')}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-texto-muted font-medium uppercase">{t('grupo')}</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formCat.replica_grupo} onChange={(e) => setFormCat({ ...formCat, replica_grupo: e.target.checked })} className="rounded border-borde text-primario h-4 w-4" />
                      {t('replicaAGrupo')}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formCat.visible_grupo} onChange={(e) => setFormCat({ ...formCat, visible_grupo: e.target.checked })} className="rounded border-borde text-primario h-4 w-4" />
                      {t('visibleParaGrupo')}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formCat.editable_grupo} onChange={(e) => setFormCat({ ...formCat, editable_grupo: e.target.checked })} className="rounded border-borde text-primario h-4 w-4" />
                      {t('editablePorGrupo')}
                    </label>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-texto-muted font-medium uppercase">{t('usuario')}</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formCat.replica_usuario} onChange={(e) => setFormCat({ ...formCat, replica_usuario: e.target.checked })} className="rounded border-borde text-primario h-4 w-4" />
                      {t('replicaAUsuario')}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formCat.visible_usuario} onChange={(e) => setFormCat({ ...formCat, visible_usuario: e.target.checked })} className="rounded border-borde text-primario h-4 w-4" />
                      {t('visibleParaUsuario')}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formCat.editable_usuario} onChange={(e) => setFormCat({ ...formCat, editable_usuario: e.target.checked })} className="rounded border-borde text-primario h-4 w-4" />
                      {t('editablePorUsuario')}
                    </label>
                  </div>
                </div>
              </div>
              {errorCat && <p className="text-sm text-error">{errorCat}</p>}
              <PieBotonesModal
                editando={!!catEditando}
                onGuardar={() => guardarCat(false)}
                onGuardarYSalir={() => guardarCat(true)}
                onCerrar={() => setModalCat(false)}
                cargando={guardandoCat}
              />
            </div>
          )}

          {tabModalCat === 'system_prompt' && catEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts tabla="categorias_parametro" pkColumna="categoria_parametro" pkValor={catEditando.categoria_parametro}
                campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
                mostrarPromptInsert={false} mostrarPromptUpdate={false} mostrarSystemPrompt={true} mostrarPythonInsert={false} mostrarPythonUpdate={false} mostrarJavaScript={false} />
              {errorCat && <p className="text-sm text-error">{errorCat}</p>}
              <PieBotonesModal
                editando={!!catEditando}
                onGuardar={() => guardarCat(false)}
                onGuardarYSalir={() => guardarCat(true)}
                onCerrar={() => setModalCat(false)}
                cargando={guardandoCat}
              />
            </div>
          )}

          {tabModalCat === 'programacion_insert' && catEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts tabla="categorias_parametro" pkColumna="categoria_parametro" pkValor={catEditando.categoria_parametro}
                campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
                mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptUpdate={false} mostrarPythonUpdate={false} />
              {errorCat && <p className="text-sm text-error">{errorCat}</p>}
              <PieBotonesModal
                editando={!!catEditando}
                onGuardar={() => guardarCat(false)}
                onGuardarYSalir={() => guardarCat(true)}
                onCerrar={() => setModalCat(false)}
                cargando={guardandoCat}
                botonesIzquierda={
                  <PieBotonesPrompts
                    tabla="categorias_parametro"
                    pkColumna="categoria_parametro"
                    pkValor={catEditando.categoria_parametro}
                    promptInsert={promptsCat.prompt_insert ?? undefined}
                    promptUpdate={promptsCat.prompt_update ?? undefined}
                    mostrarSincronizar={false}
                  />
                }
              />
            </div>
          )}
          {tabModalCat === 'programacion_update' && catEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts tabla="categorias_parametro" pkColumna="categoria_parametro" pkValor={catEditando.categoria_parametro}
                campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
                mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptInsert={false} mostrarPythonInsert={false} />
              {errorCat && <p className="text-sm text-error">{errorCat}</p>}
              <PieBotonesModal
                editando={!!catEditando}
                onGuardar={() => guardarCat(false)}
                onGuardarYSalir={() => guardarCat(true)}
                onCerrar={() => setModalCat(false)}
                cargando={guardandoCat}
                botonesIzquierda={
                  <PieBotonesPrompts
                    tabla="categorias_parametro"
                    pkColumna="categoria_parametro"
                    pkValor={catEditando.categoria_parametro}
                    promptInsert={promptsCat.prompt_insert ?? undefined}
                    promptUpdate={promptsCat.prompt_update ?? undefined}
                    mostrarSincronizar={false}
                  />
                }
              />
            </div>
          )}

          {tabModalCat === 'md' && catEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">{t('mdEtiqueta')}</label>
                <textarea
                  value={mdCat || ''}
                  readOnly
                  rows={13}
                  placeholder={t('mdPlaceholder')}
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMdCat && (
                <p className={`text-xs px-1 ${mensajeMdCat.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMdCat.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await datosBasicosApi.generarMdCategoria(catEditando.categoria_parametro)
                        setMdCat(r.md)
                        setMensajeMdCat({ tipo: 'ok', texto: t('mdGeneradoOk') })
                      } catch (e) {
                        setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : t('mdErrorGenerar') })
                      } finally { setGenerandoMdCat(false) }
                    }}
                    cargando={generandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat}
                  >
                    {t('mdGenerar')}
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await promptsApi.sincronizarFila('categorias_parametro', 'categoria_parametro', catEditando.categoria_parametro)
                        setMensajeMdCat({ tipo: 'ok', texto: t('mdSincronizadoOk', { accion: r.accion, codigo: r.codigo_documento }) })
                      } catch (e) {
                        setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : t('mdErrorSincronizar') })
                      } finally { setSincronizandoMdCat(false) }
                    }}
                    cargando={sincronizandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat || !mdCat}
                  >
                    {t('mdSincronizar')}
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalCat(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal Tipo ── */}
      <Modal
        abierto={modalTipo}
        alCerrar={() => setModalTipo(false)}
        titulo={tipoEditando ? t('editarTipoTitulo', { nombre: tipoEditando.nombre }) : t('nuevoTipoTitulo')}
        className="w-[683px] max-w-[95vw]"
      >
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-borde -mt-2 overflow-x-auto">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalTipo(tab)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 whitespace-nowrap ${tabModalTipo === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? t('tabDatos') : tab === 'system_prompt' ? t('tabSystemPrompt') : tab === 'programacion_insert' ? t('tabPromptInsert') : tab === 'programacion_update' ? t('tabPromptUpdate') : t('tabMd')}
              </button>
            ))}
          </div>

          {tabModalTipo === 'datos' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">{t('etiquetaCategoria')}</label>
                <select className={selectCls} value={formTipo.categoria_parametro}
                  onChange={(e) => setFormTipo({ ...formTipo, categoria_parametro: e.target.value })}
                  disabled={!!tipoEditando}>
                  <option value="">{t('seleccionaCategoria')}</option>
                  {categorias.map((c) => <option key={c.categoria_parametro} value={c.categoria_parametro}>{c.nombre}</option>)}
                </select>
              </div>
              {!tipoEditando && (
                <div>
                  <label className="block text-sm font-medium text-texto mb-1">{t('etiquetaCodigo')}</label>
                  <input className={inputCls} placeholder={t('placeholderCodigoTipo')} value={formTipo.tipo_parametro}
                    onChange={(e) => setFormTipo({ ...formTipo, tipo_parametro: e.target.value.toUpperCase() })} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-texto mb-1">{t('etiquetaNombre')}</label>
                <input className={inputCls} placeholder={t('placeholderNombreTipo')} value={formTipo.nombre}
                  onChange={(e) => setFormTipo({ ...formTipo, nombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">{t('etiquetaDescripcion')}</label>
                <textarea className={inputCls} rows={2} placeholder={t('placeholderDescripcionOpcional')} value={formTipo.descripcion}
                  onChange={(e) => setFormTipo({ ...formTipo, descripcion: e.target.value })} />
              </div>
              {errorTipo && <p className="text-sm text-error">{errorTipo}</p>}
              <PieBotonesModal
                editando={!!tipoEditando}
                onGuardar={() => guardarTipo(false)}
                onGuardarYSalir={() => guardarTipo(true)}
                onCerrar={() => setModalTipo(false)}
                cargando={guardandoTipo}
              />
            </div>
          )}

          {tabModalTipo === 'system_prompt' && tipoEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts tabla="tipos_parametro" pkColumna="tipo_parametro" pkValor={tipoEditando.tipo_parametro}
                campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
                mostrarPromptInsert={false} mostrarPromptUpdate={false} mostrarSystemPrompt={true} mostrarPythonInsert={false} mostrarPythonUpdate={false} mostrarJavaScript={false} />
              {errorTipo && <p className="text-sm text-error">{errorTipo}</p>}
              <PieBotonesModal
                editando={!!tipoEditando}
                onGuardar={() => guardarTipo(false)}
                onGuardarYSalir={() => guardarTipo(true)}
                onCerrar={() => setModalTipo(false)}
                cargando={guardandoTipo}
              />
            </div>
          )}

          {tabModalTipo === 'programacion_insert' && tipoEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts tabla="tipos_parametro" pkColumna="tipo_parametro" pkValor={tipoEditando.tipo_parametro}
                campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
                mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptUpdate={false} mostrarPythonUpdate={false} />
              {errorTipo && <p className="text-sm text-error">{errorTipo}</p>}
              <PieBotonesModal
                editando={!!tipoEditando}
                onGuardar={() => guardarTipo(false)}
                onGuardarYSalir={() => guardarTipo(true)}
                onCerrar={() => setModalTipo(false)}
                cargando={guardandoTipo}
                botonesIzquierda={
                  <PieBotonesPrompts
                    tabla="tipos_parametro"
                    pkColumna="tipo_parametro"
                    pkValor={tipoEditando.tipo_parametro}
                    promptInsert={promptsTipo.prompt_insert ?? undefined}
                    promptUpdate={promptsTipo.prompt_update ?? undefined}
                    mostrarSincronizar={false}
                  />
                }
              />
            </div>
          )}
          {tabModalTipo === 'programacion_update' && tipoEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts tabla="tipos_parametro" pkColumna="tipo_parametro" pkValor={tipoEditando.tipo_parametro}
                campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
                mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptInsert={false} mostrarPythonInsert={false} />
              {errorTipo && <p className="text-sm text-error">{errorTipo}</p>}
              <PieBotonesModal
                editando={!!tipoEditando}
                onGuardar={() => guardarTipo(false)}
                onGuardarYSalir={() => guardarTipo(true)}
                onCerrar={() => setModalTipo(false)}
                cargando={guardandoTipo}
                botonesIzquierda={
                  <PieBotonesPrompts
                    tabla="tipos_parametro"
                    pkColumna="tipo_parametro"
                    pkValor={tipoEditando.tipo_parametro}
                    promptInsert={promptsTipo.prompt_insert ?? undefined}
                    promptUpdate={promptsTipo.prompt_update ?? undefined}
                    mostrarSincronizar={false}
                  />
                }
              />
            </div>
          )}

          {tabModalTipo === 'md' && tipoEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">{t('mdEtiqueta')}</label>
                <textarea
                  value={mdTipo || ''}
                  readOnly
                  rows={13}
                  placeholder={t('mdPlaceholder')}
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMdTipo && (
                <p className={`text-xs px-1 ${mensajeMdTipo.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMdTipo.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMdTipo(true); setMensajeMdTipo(null)
                      try {
                        const r = await datosBasicosApi.generarMdTipo(tipoEditando.categoria_parametro, tipoEditando.tipo_parametro)
                        setMdTipo(r.md)
                        setMensajeMdTipo({ tipo: 'ok', texto: t('mdGeneradoOk') })
                      } catch (e) {
                        setMensajeMdTipo({ tipo: 'error', texto: e instanceof Error ? e.message : t('mdErrorGenerar') })
                      } finally { setGenerandoMdTipo(false) }
                    }}
                    cargando={generandoMdTipo}
                    disabled={generandoMdTipo || sincronizandoMdTipo}
                  >
                    {t('mdGenerar')}
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMdTipo(true); setMensajeMdTipo(null)
                      try {
                        const r = await promptsApi.sincronizarFila('tipos_parametro', 'tipo_parametro', tipoEditando.tipo_parametro)
                        setMensajeMdTipo({ tipo: 'ok', texto: t('mdSincronizadoOk', { accion: r.accion, codigo: r.codigo_documento }) })
                      } catch (e) {
                        setMensajeMdTipo({ tipo: 'error', texto: e instanceof Error ? e.message : t('mdErrorSincronizar') })
                      } finally { setSincronizandoMdTipo(false) }
                    }}
                    cargando={sincronizandoMdTipo}
                    disabled={generandoMdTipo || sincronizandoMdTipo || !mdTipo}
                  >
                    {t('mdSincronizar')}
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalTipo(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Confirmar eliminación ── */}
      <ModalConfirmar
        abierto={!!itemAEliminar}
        alCerrar={() => setItemAEliminar(null)}
        alConfirmar={confirmarEliminar}
        titulo={tc('eliminar')}
        mensaje={itemAEliminar
          ? itemAEliminar.tipo === 'categoria'
            ? t('eliminarCategoriaConfirm', { nombre: (itemAEliminar.item as CategoriaParametro).nombre })
            : t('eliminarTipoConfirm', { nombre: (itemAEliminar.item as TipoParametro).nombre })
          : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
