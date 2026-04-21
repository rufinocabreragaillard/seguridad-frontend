'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search } from 'lucide-react'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { categoriasCaractDocsApi, registroLLMApi } from '@/lib/api'
import type { CategoriaCaractDocs, TipoCaractDocs, RegistroLLM } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

type TabActiva = 'categorias' | 'tipos'

export default function PaginaCategoriasCaracteristicaDocs() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('categoriasCaracteristicaDocs')
  const tc = useTranslations('common')

  const [tabActiva, setTabActiva] = useState<TabActiva>('categorias')

  // ── Categorias ────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaCaractDocs[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [busquedaCat, setBusquedaCat] = useState('')
  const [modalCat, setModalCat] = useState(false)
  const [tabModalCat, setTabModalCat] = useState<'datos' | 'prompts' | 'llm'>('datos')
  const [catEditando, setCatEditando] = useState<CategoriaCaractDocs | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_cat_docs: '', nombre_cat_docs: '', descripcion_cat_docs: '',
    es_unica_docs: false, editable_en_detalle_docs: true,
    prompt: '', system_prompt: '', id_modelo: null as number | null,
    python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
  })
  const [modelosLLM, setModelosLLM] = useState<RegistroLLM[]>([])
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')
  const [confirmCat, setConfirmCat] = useState<CategoriaCaractDocs | null>(null)
  const [eliminandoCat, setEliminandoCat] = useState(false)

  // ── Categoria seleccionada (para Tipos) ─────────────────────────────────
  const [catSeleccionada, setCatSeleccionada] = useState<CategoriaCaractDocs | null>(null)

  // ── Tipos ─────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoCaractDocs[]>([])
  const [cargandoTipos, setCargandoTipos] = useState(false)
  const [modalTipo, setModalTipo] = useState(false)
  const [tabModalTipo, setTabModalTipo] = useState<'datos' | 'prompts'>('datos')
  const [tipoEditando, setTipoEditando] = useState<TipoCaractDocs | null>(null)
  const [formTipo, setFormTipo] = useState({
    codigo_tipo_docs: '', nombre_tipo_docs: '',
    prompt: '', system_prompt: '',
    python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
  })
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [confirmTipo, setConfirmTipo] = useState<TipoCaractDocs | null>(null)
  const [eliminandoTipo, setEliminandoTipo] = useState(false)

  // ── Carga categorias ──────────────────────────────────────────────────────
  const cargarCategorias = useCallback(async () => {
    setCargandoCat(true)
    try {
      setCategorias(await categoriasCaractDocsApi.listar())
    } finally {
      setCargandoCat(false)
    }
  }, [])

  useEffect(() => { cargarCategorias() }, [cargarCategorias])

  useEffect(() => {
    registroLLMApi.listar().then((m) => setModelosLLM(m.filter((x) => x.activo))).catch(() => {})
  }, [])

  // ── Carga tipos ───────────────────────────────────────────────────────────
  const cargarTipos = useCallback(async () => {
    if (!catSeleccionada) { setTipos([]); return }
    setCargandoTipos(true)
    try {
      setTipos(await categoriasCaractDocsApi.listarTipos(catSeleccionada.codigo_cat_docs))
    } finally {
      setCargandoTipos(false)
    }
  }, [catSeleccionada])

  useEffect(() => { if (tabActiva === 'tipos') cargarTipos() }, [tabActiva, cargarTipos])

  // ── CRUD Categorias ───────────────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({ codigo_cat_docs: '', nombre_cat_docs: '', descripcion_cat_docs: '', es_unica_docs: false, editable_en_detalle_docs: true, prompt: '', system_prompt: '', id_modelo: null, python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaCaractDocs) => {
    setCatEditando(c)
    const c2 = c as unknown as Record<string, unknown>
    setFormCat({
      codigo_cat_docs: c.codigo_cat_docs,
      nombre_cat_docs: c.nombre_cat_docs,
      descripcion_cat_docs: c.descripcion_cat_docs || '',
      es_unica_docs: c.es_unica_docs,
      editable_en_detalle_docs: c.editable_en_detalle_docs,
      prompt: c.prompt || '',
      system_prompt: c.system_prompt || '',
      id_modelo: c.id_modelo ?? null,
      python: c2.python as string || '',
      javascript: c2.javascript as string || '',
      python_editado_manual: c2.python_editado_manual as boolean || false,
      javascript_editado_manual: c2.javascript_editado_manual as boolean || false,
    })
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const guardarCat = async (cerrar: boolean) => {
    const esGlobalCreate = !catEditando && grupoActivo === 'ADMIN'
    if (!formCat.nombre_cat_docs.trim() || (esGlobalCreate && !formCat.codigo_cat_docs.trim())) {
      setErrorCat(esGlobalCreate ? t('errorObligatorioGlobal') : t('errorNombreObligatorio'))
      return
    }
    setGuardandoCat(true)
    try {
      if (catEditando) {
        await categoriasCaractDocsApi.actualizar(catEditando.codigo_cat_docs, {
          nombre_cat_docs: formCat.nombre_cat_docs,
          descripcion_cat_docs: formCat.descripcion_cat_docs || undefined,
          es_unica_docs: formCat.es_unica_docs,
          editable_en_detalle_docs: formCat.editable_en_detalle_docs,
          prompt: formCat.prompt || undefined,
          system_prompt: formCat.system_prompt || undefined,
          id_modelo: formCat.id_modelo ?? undefined,
          python: formCat.python || undefined,
          javascript: formCat.javascript || undefined,
          python_editado_manual: formCat.python_editado_manual,
          javascript_editado_manual: formCat.javascript_editado_manual,
        } as Record<string, unknown>)
        if (cerrar) setModalCat(false)
      } else {
        const nueva = await categoriasCaractDocsApi.crear({
          ...(formCat.codigo_cat_docs.trim() ? { codigo_cat_docs: formCat.codigo_cat_docs.toUpperCase() } : {}),
          nombre_cat_docs: formCat.nombre_cat_docs,
          descripcion_cat_docs: formCat.descripcion_cat_docs || undefined,
          es_unica_docs: formCat.es_unica_docs,
          editable_en_detalle_docs: formCat.editable_en_detalle_docs,
        })
        if (cerrar) {
          setModalCat(false)
        } else {
          setCatEditando(nueva)
          const n2 = nueva as unknown as Record<string, unknown>
          setFormCat({
            codigo_cat_docs: nueva.codigo_cat_docs,
            nombre_cat_docs: nueva.nombre_cat_docs,
            descripcion_cat_docs: nueva.descripcion_cat_docs || '',
            es_unica_docs: nueva.es_unica_docs,
            editable_en_detalle_docs: nueva.editable_en_detalle_docs,
            prompt: nueva.prompt || '',
            system_prompt: nueva.system_prompt || '',
            id_modelo: nueva.id_modelo ?? null,
            python: n2.python as string || '',
            javascript: n2.javascript as string || '',
            python_editado_manual: n2.python_editado_manual as boolean || false,
            javascript_editado_manual: n2.javascript_editado_manual as boolean || false,
          })
        }
      }
      cargarCategorias()
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardandoCat(false)
    }
  }

  const eliminarCat = async () => {
    if (!confirmCat) return
    setEliminandoCat(true)
    try {
      await categoriasCaractDocsApi.desactivar(confirmCat.codigo_cat_docs)
      setConfirmCat(null)
      cargarCategorias()
    } finally {
      setEliminandoCat(false)
    }
  }

  // ── CRUD Tipos ────────────────────────────────────────────────────────────
  const abrirNuevoTipo = () => {
    setTipoEditando(null)
    setFormTipo({ codigo_tipo_docs: '', nombre_tipo_docs: '', prompt: '', system_prompt: '', python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setTabModalTipo('datos')
    setErrorTipo('')
    setModalTipo(true)
  }

  const abrirEditarTipo = (tipo: TipoCaractDocs) => {
    setTipoEditando(tipo)
    const t2 = tipo as unknown as Record<string, unknown>
    setFormTipo({
      codigo_tipo_docs: tipo.codigo_tipo_docs,
      nombre_tipo_docs: tipo.nombre_tipo_docs,
      prompt: tipo.prompt || '',
      system_prompt: tipo.system_prompt || '',
      python: t2.python as string || '',
      javascript: t2.javascript as string || '',
      python_editado_manual: t2.python_editado_manual as boolean || false,
      javascript_editado_manual: t2.javascript_editado_manual as boolean || false,
    })
    setTabModalTipo('datos')
    setErrorTipo('')
    setModalTipo(true)
  }

  const guardarTipo = async (cerrar = true) => {
    if (!catSeleccionada) return
    if (!formTipo.nombre_tipo_docs.trim()) {
      setErrorTipo(t('errorNombreObligatorio'))
      return
    }
    setGuardandoTipo(true)
    try {
      if (tipoEditando) {
        await categoriasCaractDocsApi.actualizarTipo(catSeleccionada.codigo_cat_docs, tipoEditando.codigo_tipo_docs, {
          nombre_tipo_docs: formTipo.nombre_tipo_docs,
          prompt: formTipo.prompt || null,
          system_prompt: formTipo.system_prompt || null,
          python: formTipo.python || null,
          javascript: formTipo.javascript || null,
          python_editado_manual: formTipo.python_editado_manual,
          javascript_editado_manual: formTipo.javascript_editado_manual,
        } as Record<string, unknown>)
      } else {
        await categoriasCaractDocsApi.crearTipo(catSeleccionada.codigo_cat_docs, {
          codigo_cat_docs: catSeleccionada.codigo_cat_docs,
          ...(formTipo.codigo_tipo_docs.trim() ? { codigo_tipo_docs: formTipo.codigo_tipo_docs.toUpperCase() } : { codigo_tipo_docs: '' }),
          nombre_tipo_docs: formTipo.nombre_tipo_docs,
          ...(formTipo.prompt ? { prompt: formTipo.prompt } : {}),
          ...(formTipo.system_prompt ? { system_prompt: formTipo.system_prompt } : {}),
        })
      }
      if (cerrar) setModalTipo(false)
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardandoTipo(false)
    }
  }

  const eliminarTipo = async () => {
    if (!confirmTipo || !catSeleccionada) return
    setEliminandoTipo(true)
    try {
      await categoriasCaractDocsApi.desactivarTipo(catSeleccionada.codigo_cat_docs, confirmTipo.codigo_tipo_docs)
      setConfirmTipo(null)
      cargarTipos()
    } finally {
      setEliminandoTipo(false)
    }
  }

  // ── Reordenar categorías (drag-and-drop) ─────────────────────────────────
  const reordenarCategorias = async (nuevaLista: CategoriaCaractDocs[]) => {
    setCategorias(nuevaLista)
    try {
      await categoriasCaractDocsApi.reordenar(nuevaLista.map((c, i) => ({ codigo: c.codigo_cat_docs, orden: c.orden ?? i })))
    } catch {
      cargarCategorias()
    }
  }

  // ── Filtro categorias ─────────────────────────────────────────────────────
  const catsFiltradas = categorias
    .filter((c) =>
      c.codigo_cat_docs.toLowerCase().includes(busquedaCat.toLowerCase()) ||
      c.nombre_cat_docs.toLowerCase().includes(busquedaCat.toLowerCase())
    )

  // ── Selector de categoria (para Tipos) ────────────────────────────────────
  const selectorCategoria = (
    <div className="mb-4">
      <label className="block text-sm font-medium text-texto mb-1.5">{t('selectorCategoria')}</label>
      <select
        className="w-full max-w-sm rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm"
        value={catSeleccionada?.codigo_cat_docs || ''}
        onChange={(e) => {
          const cat = categorias.find((c) => c.codigo_cat_docs === e.target.value) || null
          setCatSeleccionada(cat)
        }}
      >
        <option value="">{t('selectorPlaceholder')}</option>
        {categorias.filter((c) => c.activo).map((c) => (
          <option key={c.codigo_cat_docs} value={c.codigo_cat_docs}>{c.nombre_cat_docs}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-borde">
        {([
          { key: 'categorias' as const, label: t('tabCategorias') },
          { key: 'tipos' as const, label: t('tabTipos') },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabActiva(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tabActiva === tab.key
                ? 'border-primario text-primario'
                : 'border-transparent text-texto-muted hover:text-texto'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CATEGORIAS */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder={t('buscarPlaceholder')} value={busquedaCat} onChange={(e) => setBusquedaCat(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" disabled={catsFiltradas.length === 0}
                onClick={() => exportarExcel(catsFiltradas as unknown as Record<string, unknown>[], [
                  { titulo: t('colCodigo'), campo: 'codigo_cat_docs' },
                  { titulo: t('colNombre'), campo: 'nombre_cat_docs' },
                  { titulo: t('colUnica'), campo: 'es_unica_docs', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colEditable'), campo: 'editable_en_detalle_docs', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colEstado'), campo: 'activo', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
                ], 'categorias-docs')}>
                <Download size={15} />Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaCat}><Plus size={16} />{t('nuevaCategoria')}</Boton>
            </div>
          </div>

          <SortableDndContext
            items={catsFiltradas as unknown as Record<string, unknown>[]}
            getId={(item) => item.codigo_cat_docs as string}
            onReorder={(items) => reordenarCategorias(items as unknown as CategoriaCaractDocs[])}
            disabled={!!busquedaCat}
          >
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh className="w-8" />
                  <TablaTh>{t('colNombre')}</TablaTh>
                  <TablaTh>{t('colUnica')}</TablaTh>
                  <TablaTh>{t('colEditable')}</TablaTh>
                  <TablaTh>{tc('activo')}</TablaTh>
                  <TablaTh>{t('colCodigo')}</TablaTh>
                  <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {cargandoCat ? (
                  <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{tc('cargando')}</TablaTd></TablaFila>
                ) : catsFiltradas.length === 0 ? (
                  <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{t('sinCategorias')}</TablaTd></TablaFila>
                ) : catsFiltradas.map((c) => (
                  <SortableRow key={c.codigo_cat_docs} id={c.codigo_cat_docs}>
                    <TablaTd className="font-medium">{c.nombre_cat_docs}</TablaTd>
                    <TablaTd><Insignia variante={c.es_unica_docs ? 'advertencia' : 'neutro'}>{c.es_unica_docs ? tc('si') : tc('no')}</Insignia></TablaTd>
                    <TablaTd><Insignia variante={c.editable_en_detalle_docs ? 'exito' : 'neutro'}>{c.editable_en_detalle_docs ? tc('si') : tc('no')}</Insignia></TablaTd>
                    <TablaTd><Insignia variante={c.activo ? 'exito' : 'error'}>{c.activo ? tc('activo') : tc('inactivo')}</Insignia></TablaTd>
                    <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{c.codigo_cat_docs}</code></TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={tc('editar')}><Pencil size={14} /></button>
                        <button onClick={() => setConfirmCat(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title={t('desactivar')}><Trash2 size={14} /></button>
                      </div>
                    </TablaTd>
                  </SortableRow>
                ))}
              </TablaCuerpo>
            </Tabla>
          </SortableDndContext>
        </>
      )}

      {/* TAB TIPOS */}
      {tabActiva === 'tipos' && (
        <>
          {selectorCategoria}
          {catSeleccionada ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-texto-muted">{t('tiposDe', { nombre: catSeleccionada.nombre_cat_docs })}</span>
                <Boton variante="primario" tamano="sm" onClick={abrirNuevoTipo} className="ml-auto"><Plus size={14} />{t('nuevoTipo')}</Boton>
              </div>
              <Tabla>
                <TablaCabecera>
                  <tr>
                    <TablaTh>{t('colNombre')}</TablaTh>
                    <TablaTh>{tc('activo')}</TablaTh>
                    <TablaTh>{t('colCodigo')}</TablaTh>
                    <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                  </tr>
                </TablaCabecera>
                <TablaCuerpo>
                  {cargandoTipos ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>{tc('cargando')}</TablaTd></TablaFila>
                  ) : tipos.length === 0 ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>{t('sinTipos')}</TablaTd></TablaFila>
                  ) : tipos.map((tipo) => (
                    <TablaFila key={tipo.codigo_tipo_docs}>
                      <TablaTd className="font-medium">{tipo.nombre_tipo_docs}</TablaTd>
                      <TablaTd><Insignia variante={tipo.activo ? 'exito' : 'error'}>{tipo.activo ? tc('activo') : tc('inactivo')}</Insignia></TablaTd>
                      <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{tipo.codigo_tipo_docs}</code></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarTipo(tipo)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmTipo(tipo)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </>
          ) : (
            <p className="text-sm text-texto-muted">{t('seleccioneCategoria')}</p>
          )}
        </>
      )}

      {/* MODALES */}

      {/* Modal Categoria */}
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? t('editarCategoriaTitulo', { nombre: catEditando.nombre_cat_docs }) : t('nuevaCategoriaTitulo')} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'prompts', 'llm'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalCat(tab)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  tabModalCat === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : tab === 'prompts' ? 'Prompts' : 'LLM'}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalCat === 'datos' && (
            <>
              <Input etiqueta={t('etiquetaNombre')} value={formCat.nombre_cat_docs}
                onChange={(e) => setFormCat({ ...formCat, nombre_cat_docs: e.target.value })}
                placeholder={t('placeholderNombre')} />
              {/* Código solo visible si super-admin crea global, o al editar (readonly) */}
              {!catEditando && grupoActivo === 'ADMIN' && (
                <Input etiqueta={t('etiquetaCodigo')} value={formCat.codigo_cat_docs}
                  onChange={(e) => setFormCat({ ...formCat, codigo_cat_docs: e.target.value.toUpperCase() })}
                  placeholder={t('placeholderCodigo')} />
              )}
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaDescripcion')}</label>
                <textarea className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[60px]"
                  value={formCat.descripcion_cat_docs}
                  onChange={(e) => setFormCat({ ...formCat, descripcion_cat_docs: e.target.value })} />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formCat.es_unica_docs}
                    onChange={(e) => setFormCat({ ...formCat, es_unica_docs: e.target.checked })}
                    className="rounded border-borde" />
                  {t('unicaPorDocumento')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formCat.editable_en_detalle_docs}
                    onChange={(e) => setFormCat({ ...formCat, editable_en_detalle_docs: e.target.checked })}
                    className="rounded border-borde" />
                  {t('editableEnDetalle')}
                </label>
              </div>
              {catEditando && (
                <Input etiqueta={t('colCodigo')} value={formCat.codigo_cat_docs} disabled readOnly />
              )}
            </>
          )}

          {/* Tab Prompts */}
          {tabModalCat === 'prompts' && (
            <TabPrompts
              tabla="categorias_caract_docs"
              pkColumna="codigo_cat_docs"
              pkValor={catEditando?.codigo_cat_docs ?? null}
              campos={formCat}
              onCampoCambiado={(campo, valor) => setFormCat({ ...formCat, [campo]: valor })}
            />
          )}

          {/* Tab LLM */}
          {tabModalCat === 'llm' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Modelo LLM que se usará al procesar documentos con esta categoría. Si no se asigna, se usará el modelo configurado en el proceso.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Modelo LLM <span className="text-texto-muted font-normal">(opcional)</span></label>
                <select
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  value={formCat.id_modelo ?? ''}
                  onChange={(e) => setFormCat({ ...formCat, id_modelo: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Sin modelo asignado</option>
                  {modelosLLM.map((m) => (
                    <option key={m.id_modelo} value={m.id_modelo}>
                      {m.nombre_visible} — {m.proveedor}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
          <PieBotonesModal
            editando={!!catEditando}
            onGuardar={() => guardarCat(false)}
            onGuardarYSalir={() => guardarCat(true)}
            onCerrar={() => setModalCat(false)}
            cargando={guardandoCat}
          />
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? t('editarTipoTitulo', { nombre: tipoEditando.nombre_tipo_docs }) : t('nuevoTipoTitulo')} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'prompts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalTipo(tab)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  tabModalTipo === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : 'Prompts'}
              </button>
            ))}
          </div>

          {tabModalTipo === 'datos' && (
            <>
              <Input etiqueta={t('etiquetaNombreTipo')} value={formTipo.nombre_tipo_docs}
                onChange={(e) => setFormTipo({ ...formTipo, nombre_tipo_docs: e.target.value })}
                placeholder={t('placeholderNombreTipo')} />
              {tipoEditando && (
                <Input etiqueta={t('colCodigo')} value={formTipo.codigo_tipo_docs} disabled readOnly />
              )}
            </>
          )}

          {tabModalTipo === 'prompts' && (
            <TabPrompts
              tabla="tipos_caract_docs"
              pkColumna="codigo_tipo_docs"
              pkValor={tipoEditando?.codigo_tipo_docs ?? null}
              campos={formTipo}
              onCampoCambiado={(campo, valor) => setFormTipo({ ...formTipo, [campo]: valor })}
            />
          )}

          {errorTipo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorTipo}</p></div>}
          <PieBotonesModal
            editando={!!tipoEditando}
            onGuardar={() => guardarTipo(false)}
            onGuardarYSalir={() => guardarTipo(true)}
            onCerrar={() => setModalTipo(false)}
            cargando={guardandoTipo}
          />
        </div>
      </Modal>

      {/* Confirmaciones */}
      <ModalConfirmar abierto={!!confirmCat} alCerrar={() => setConfirmCat(null)} alConfirmar={eliminarCat}
        titulo={t('desactivarCategoriaTitulo')} mensaje={confirmCat ? t('desactivarCategoriaConfirm', { nombre: confirmCat.nombre_cat_docs }) : ''} textoConfirmar={t('desactivar')} cargando={eliminandoCat} />
      <ModalConfirmar abierto={!!confirmTipo} alCerrar={() => setConfirmTipo(null)} alConfirmar={eliminarTipo}
        titulo={t('desactivarTipoTitulo')} mensaje={confirmTipo ? t('desactivarTipoConfirm', { nombre: confirmTipo.nombre_tipo_docs }) : ''} textoConfirmar={t('desactivar')} cargando={eliminandoTipo} />
    </div>
  )
}
