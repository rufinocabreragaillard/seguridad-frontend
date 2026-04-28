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
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { categoriasCaractDocsApi, promptsApi, registroLLMApi } from '@/lib/api'
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
  const [tabModalCat, setTabModalCat] = useState<'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md' | 'llm'>('datos')
  const [catEditando, setCatEditando] = useState<CategoriaCaractDocs | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_cat_docs: '', nombre_cat_docs: '', descripcion_cat_docs: '',
    es_unica_docs: false, editable_en_detalle_docs: true,
    prompt_insert: '', prompt_update: '', system_prompt: '', id_modelo: null as number | null,
    python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
    md: '',
  })
  const [modelosLLM, setModelosLLM] = useState<RegistroLLM[]>([])
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')
  const [confirmCat, setConfirmCat] = useState<CategoriaCaractDocs | null>(null)
  const [eliminandoCat, setEliminandoCat] = useState(false)
  const [generandoMdCat, setGenerandoMdCat] = useState(false)
  const [sincronizandoMdCat, setSincronizandoMdCat] = useState(false)
  const [mensajeMdCat, setMensajeMdCat] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // ── Categoria seleccionada (para Tipos) ─────────────────────────────────
  const [catSeleccionada, setCatSeleccionada] = useState<CategoriaCaractDocs | null>(null)

  // ── Tipos ─────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoCaractDocs[]>([])
  const [cargandoTipos, setCargandoTipos] = useState(false)
  const [modalTipo, setModalTipo] = useState(false)
  const [tabModalTipo, setTabModalTipo] = useState<'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update'>('datos')
  const [tipoEditando, setTipoEditando] = useState<TipoCaractDocs | null>(null)
  const [formTipo, setFormTipo] = useState({
    codigo_tipo_docs: '', nombre_tipo_docs: '',
    prompt_insert: '', prompt_update: '', system_prompt: '',
    python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
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
    registroLLMApi.listar().then((m) => setModelosLLM(m)).catch(() => {})
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
    setFormCat({ codigo_cat_docs: '', nombre_cat_docs: '', descripcion_cat_docs: '', es_unica_docs: false, editable_en_detalle_docs: true, prompt_insert: '', prompt_update: '', system_prompt: '', id_modelo: null, python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false, md: '' })
    setTabModalCat('datos')
    setErrorCat('')
    setMensajeMdCat(null)
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
      prompt_insert: c2.prompt_insert as string || '',
      prompt_update: c2.prompt_update as string || '',
      system_prompt: c.system_prompt || '',
      id_modelo: c.id_modelo ?? null,
      python_insert: c2.python_insert as string || '',
      python_update: c2.python_update as string || '',
      javascript: c2.javascript as string || '',
      python_editado_manual: c2.python_editado_manual as boolean || false,
      javascript_editado_manual: c2.javascript_editado_manual as boolean || false,
      md: c2.md as string || '',
    })
    setTabModalCat('datos')
    setErrorCat('')
    setMensajeMdCat(null)
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
          prompt_insert: formCat.prompt_insert || undefined,
          prompt_update: formCat.prompt_update || undefined,
          system_prompt: formCat.system_prompt || undefined,
          id_modelo: formCat.id_modelo ?? undefined,
          python_insert: formCat.python_insert || undefined,
          python_update: formCat.python_update || undefined,
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
            prompt_insert: n2.prompt_insert as string || '',
            prompt_update: n2.prompt_update as string || '',
            system_prompt: nueva.system_prompt || '',
            id_modelo: nueva.id_modelo ?? null,
            python_insert: n2.python_insert as string || '',
            python_update: n2.python_update as string || '',
            javascript: n2.javascript as string || '',
            python_editado_manual: n2.python_editado_manual as boolean || false,
            javascript_editado_manual: n2.javascript_editado_manual as boolean || false,
            md: n2.md as string || '',
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
    setFormTipo({ codigo_tipo_docs: '', nombre_tipo_docs: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
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
      prompt_insert: t2.prompt_insert as string || '',
      prompt_update: t2.prompt_update as string || '',
      system_prompt: tipo.system_prompt || '',
      python_insert: t2.python_insert as string || '',
      python_update: t2.python_update as string || '',
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
          prompt_insert: formTipo.prompt_insert || null,
          prompt_update: formTipo.prompt_update || null,
          system_prompt: formTipo.system_prompt || null,
          python_insert: formTipo.python_insert || null,
          python_update: formTipo.python_update || null,
          javascript: formTipo.javascript || null,
          python_editado_manual: formTipo.python_editado_manual,
          javascript_editado_manual: formTipo.javascript_editado_manual,
        } as Record<string, unknown>)
      } else {
        await categoriasCaractDocsApi.crearTipo(catSeleccionada.codigo_cat_docs, {
          codigo_cat_docs: catSeleccionada.codigo_cat_docs,
          ...(formTipo.codigo_tipo_docs.trim() ? { codigo_tipo_docs: formTipo.codigo_tipo_docs.toUpperCase() } : { codigo_tipo_docs: '' }),
          nombre_tipo_docs: formTipo.nombre_tipo_docs,
          ...(formTipo.prompt_insert ? { prompt_insert: formTipo.prompt_insert } : {}),
          ...(formTipo.prompt_update ? { prompt_update: formTipo.prompt_update } : {}),
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
        {categorias.map((c) => (
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
                  { titulo: 'Nombre', campo: 'nombre_cat_docs', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
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
                    <TablaTd className="font-medium" onDoubleClick={() => abrirEditarCat(c)}>{c.nombre_cat_docs}</TablaTd>
                    <TablaTd><Insignia variante={c.es_unica_docs ? 'advertencia' : 'neutro'}>{c.es_unica_docs ? tc('si') : tc('no')}</Insignia></TablaTd>
                    <TablaTd><Insignia variante={c.editable_en_detalle_docs ? 'exito' : 'neutro'}>{c.editable_en_detalle_docs ? tc('si') : tc('no')}</Insignia></TablaTd>
                    <TablaTd></TablaTd>
                    <TablaTd onDoubleClick={() => { setCatSeleccionada(c); setTabActiva('tipos') }}><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{c.codigo_cat_docs}</code></TablaTd>
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
                      <TablaTd className="font-medium" onDoubleClick={() => abrirEditarTipo(tipo)}>{tipo.nombre_tipo_docs}</TablaTd>
                      <TablaTd></TablaTd>
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
        <div className="flex flex-col gap-4 min-w-[520px] min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {([
              'datos',
              'system_prompt',
              'programacion_insert',
              'programacion_update',
              ...(catEditando ? (['md'] as const) : ([] as const)),
              'llm',
            ] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalCat(tab)}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  tabModalCat === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : tab === 'programacion_update' ? 'Prog. Update' : tab === 'md' ? '.md' : 'LLM'}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalCat === 'datos' && (
            <div className="flex-1 flex flex-col gap-4">
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
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalCat === 'system_prompt' && (
            <div className="flex-1 flex flex-col">
              <TabPrompts
                tabla="categorias_caract_docs"
                pkColumna="codigo_cat_docs"
                pkValor={catEditando?.codigo_cat_docs ?? null}
                campos={formCat}
                onCampoCambiado={(campo, valor) => setFormCat({ ...formCat, [campo]: valor })}
                mostrarPromptInsert={false}
                mostrarPromptUpdate={false}
                mostrarSystemPrompt={true}
                mostrarPythonInsert={false}
                mostrarPythonUpdate={false}
                mostrarJavaScript={false}
              />
            </div>
          )}

          {/* Tab Programación Insert */}
          {tabModalCat === 'programacion_insert' && (
            <div className="flex-1 flex flex-col">
              <TabPrompts
                tabla="categorias_caract_docs"
                pkColumna="codigo_cat_docs"
                pkValor={catEditando?.codigo_cat_docs ?? null}
                campos={formCat}
                onCampoCambiado={(campo, valor) => setFormCat({ ...formCat, [campo]: valor })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
            </div>
          )}
          {/* Tab Programación Update */}
          {tabModalCat === 'programacion_update' && (
            <div className="flex-1 flex flex-col">
              <TabPrompts
                tabla="categorias_caract_docs"
                pkColumna="codigo_cat_docs"
                pkValor={catEditando?.codigo_cat_docs ?? null}
                campos={formCat}
                onCampoCambiado={(campo, valor) => setFormCat({ ...formCat, [campo]: valor })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
            </div>
          )}

          {/* Tab .md */}
          {tabModalCat === 'md' && catEditando && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={formCat.md || ''}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMdCat && (
                <p className={`text-xs px-1 ${mensajeMdCat.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMdCat.texto}
                </p>
              )}
            </div>
          )}

          {/* Tab LLM */}
          {tabModalCat === 'llm' && (
            <div className="flex-1 flex flex-col gap-3">
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

          {/* Footer — siempre al fondo del modal */}
          <div className="mt-auto flex flex-col gap-3">
            {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
            {tabModalCat === 'md' && catEditando ? (
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await categoriasCaractDocsApi.generarMd(catEditando.codigo_cat_docs)
                        setFormCat((prev) => ({ ...prev, md: r.md }))
                        setMensajeMdCat({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMdCat(false) }
                    }}
                    cargando={generandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await promptsApi.sincronizarFila('categorias_caract_docs', 'codigo_cat_docs', catEditando.codigo_cat_docs)
                        setMensajeMdCat({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMdCat(false) }
                    }}
                    cargando={sincronizandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat || !formCat.md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalCat(false)}>{tc('salir')}</Boton>
              </div>
            ) : (
              <PieBotonesModal
                editando={!!catEditando}
                onGuardar={() => guardarCat(false)}
                onGuardarYSalir={() => guardarCat(true)}
                onCerrar={() => setModalCat(false)}
                cargando={guardandoCat}
                botonesIzquierda={(tabModalCat === 'programacion_insert' || tabModalCat === 'programacion_update') && catEditando ? (
                  <PieBotonesPrompts
                    tabla="categorias_caract_docs"
                    pkColumna="codigo_cat_docs"
                    pkValor={catEditando.codigo_cat_docs}
                    promptInsert={formCat.prompt_insert || undefined}
                    promptUpdate={formCat.prompt_update || undefined}
                    mostrarSincronizar={false}
                  />
                ) : undefined}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? t('editarTipoTitulo', { nombre: tipoEditando.nombre_tipo_docs }) : t('nuevoTipoTitulo')} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px] min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalTipo(tab)}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  tabModalTipo === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : 'Prog. Update'}
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

          {tabModalTipo === 'system_prompt' && (
            <TabPrompts
              tabla="tipos_caract_docs"
              pkColumna="codigo_tipo_docs"
              pkValor={tipoEditando?.codigo_tipo_docs ?? null}
              campos={formTipo}
              onCampoCambiado={(campo, valor) => setFormTipo({ ...formTipo, [campo]: valor })}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {tabModalTipo === 'programacion_insert' && (
            <TabPrompts
              tabla="tipos_caract_docs"
              pkColumna="codigo_tipo_docs"
              pkValor={tipoEditando?.codigo_tipo_docs ?? null}
              campos={formTipo}
              onCampoCambiado={(campo, valor) => setFormTipo({ ...formTipo, [campo]: valor })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptUpdate={false}
              mostrarPythonUpdate={false}
            />
          )}
          {tabModalTipo === 'programacion_update' && (
            <TabPrompts
              tabla="tipos_caract_docs"
              pkColumna="codigo_tipo_docs"
              pkValor={tipoEditando?.codigo_tipo_docs ?? null}
              campos={formTipo}
              onCampoCambiado={(campo, valor) => setFormTipo({ ...formTipo, [campo]: valor })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptInsert={false}
              mostrarPythonInsert={false}
            />
          )}

          {errorTipo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorTipo}</p></div>}
          <PieBotonesModal
            editando={!!tipoEditando}
            onGuardar={() => guardarTipo(false)}
            onGuardarYSalir={() => guardarTipo(true)}
            onCerrar={() => setModalTipo(false)}
            cargando={guardandoTipo}
            botonesIzquierda={(tabModalTipo === 'system_prompt' || tabModalTipo === 'programacion_insert' || tabModalTipo === 'programacion_update') && tipoEditando ? (
              <PieBotonesPrompts
                tabla="tipos_caract_docs"
                pkColumna="codigo_tipo_docs"
                pkValor={tipoEditando.codigo_tipo_docs}
                promptInsert={formTipo.prompt_insert || undefined}
                promptUpdate={formTipo.prompt_update || undefined}
              />
            ) : undefined}
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
