'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { categoriasCaractDocsApi } from '@/lib/api'
import type { CategoriaCaractDocs, TipoCaractDocs } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

type TabActiva = 'categorias' | 'tipos'

export default function PaginaCategoriasCaracteristicaDocs() {
  const [tabActiva, setTabActiva] = useState<TabActiva>('categorias')

  // ── Categorias ────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaCaractDocs[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [busquedaCat, setBusquedaCat] = useState('')
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaCaractDocs | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_cat_docs: '', nombre_cat_docs: '', descripcion_cat_docs: '',
    es_unica_docs: false, editable_en_detalle_docs: true,
  })
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
  const [tipoEditando, setTipoEditando] = useState<TipoCaractDocs | null>(null)
  const [formTipo, setFormTipo] = useState({ codigo_tipo_docs: '', nombre_tipo_docs: '' })
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
    setFormCat({ codigo_cat_docs: '', nombre_cat_docs: '', descripcion_cat_docs: '', es_unica_docs: false, editable_en_detalle_docs: true })
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaCaractDocs) => {
    setCatEditando(c)
    setFormCat({
      codigo_cat_docs: c.codigo_cat_docs,
      nombre_cat_docs: c.nombre_cat_docs,
      descripcion_cat_docs: c.descripcion_cat_docs || '',
      es_unica_docs: c.es_unica_docs,
      editable_en_detalle_docs: c.editable_en_detalle_docs,
    })
    setErrorCat('')
    setModalCat(true)
  }

  const guardarCat = async () => {
    if (!formCat.codigo_cat_docs.trim() || !formCat.nombre_cat_docs.trim()) {
      setErrorCat('Código y nombre son obligatorios')
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
        })
      } else {
        await categoriasCaractDocsApi.crear({
          codigo_cat_docs: formCat.codigo_cat_docs.toUpperCase(),
          nombre_cat_docs: formCat.nombre_cat_docs,
          descripcion_cat_docs: formCat.descripcion_cat_docs || undefined,
          es_unica_docs: formCat.es_unica_docs,
          editable_en_detalle_docs: formCat.editable_en_detalle_docs,
        })
      }
      setModalCat(false)
      cargarCategorias()
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : 'Error al guardar')
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
    setFormTipo({ codigo_tipo_docs: '', nombre_tipo_docs: '' })
    setErrorTipo('')
    setModalTipo(true)
  }

  const abrirEditarTipo = (t: TipoCaractDocs) => {
    setTipoEditando(t)
    setFormTipo({ codigo_tipo_docs: t.codigo_tipo_docs, nombre_tipo_docs: t.nombre_tipo_docs })
    setErrorTipo('')
    setModalTipo(true)
  }

  const guardarTipo = async () => {
    if (!catSeleccionada) return
    if (!formTipo.codigo_tipo_docs.trim() || !formTipo.nombre_tipo_docs.trim()) {
      setErrorTipo('Código y nombre son obligatorios')
      return
    }
    setGuardandoTipo(true)
    try {
      if (tipoEditando) {
        await categoriasCaractDocsApi.actualizarTipo(catSeleccionada.codigo_cat_docs, tipoEditando.codigo_tipo_docs, {
          nombre_tipo_docs: formTipo.nombre_tipo_docs,
        })
      } else {
        await categoriasCaractDocsApi.crearTipo(catSeleccionada.codigo_cat_docs, {
          codigo_cat_docs: catSeleccionada.codigo_cat_docs,
          codigo_tipo_docs: formTipo.codigo_tipo_docs.toUpperCase(),
          nombre_tipo_docs: formTipo.nombre_tipo_docs,
        })
      }
      setModalTipo(false)
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : 'Error al guardar')
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

  // ── Mover categoría (orden) ────────────────────────────────────────────────
  const moverCategoria = async (index: number, dir: 'arriba' | 'abajo') => {
    const lista = [...categorias]
    const swap = dir === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const oA = lista[index].orden ?? index
    const oB = lista[swap].orden ?? swap
    lista[index] = { ...lista[index], orden: oB }
    lista[swap] = { ...lista[swap], orden: oA }
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setCategorias(lista)
    try {
      await categoriasCaractDocsApi.reordenar(lista.map((c, i) => ({ codigo: c.codigo_cat_docs, orden: c.orden ?? i })))
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
      <label className="block text-sm font-medium text-texto mb-1.5">Categoría</label>
      <select
        className="w-full max-w-sm rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm"
        value={catSeleccionada?.codigo_cat_docs || ''}
        onChange={(e) => {
          const cat = categorias.find((c) => c.codigo_cat_docs === e.target.value) || null
          setCatSeleccionada(cat)
        }}
      >
        <option value="">Seleccione una categoría...</option>
        {categorias.filter((c) => c.activo).map((c) => (
          <option key={c.codigo_cat_docs} value={c.codigo_cat_docs}>{c.nombre_cat_docs}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Categorías de Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">Categorías y tipos Categorías y tipos del grupo activo y globales (visibles en todos los grupos)</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-borde">
        {([
          { key: 'categorias' as const, label: 'Categorías' },
          { key: 'tipos' as const, label: 'Tipos' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTabActiva(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tabActiva === t.key
                ? 'border-primario text-primario'
                : 'border-transparent text-texto-muted hover:text-texto'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CATEGORIAS */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder="Buscar..." value={busquedaCat} onChange={(e) => setBusquedaCat(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" disabled={catsFiltradas.length === 0}
                onClick={() => exportarExcel(catsFiltradas as unknown as Record<string, unknown>[], [
                  { titulo: 'Código', campo: 'codigo_cat_docs' },
                  { titulo: 'Nombre', campo: 'nombre_cat_docs' },
                  { titulo: 'Única', campo: 'es_unica_docs', formato: (v: unknown) => (v ? 'Sí' : 'No') },
                  { titulo: 'Editable', campo: 'editable_en_detalle_docs', formato: (v: unknown) => (v ? 'Sí' : 'No') },
                  { titulo: 'Estado', campo: 'activo', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
                ], 'categorias-docs')}>
                <Download size={15} />Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaCat}><Plus size={16} />Nueva categoría</Boton>
            </div>
          </div>

          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>Orden</TablaTh>
                <TablaTh>Código</TablaTh>
                <TablaTh>Nombre</TablaTh>
                <TablaTh>Única</TablaTh>
                <TablaTh>Editable</TablaTh>
                <TablaTh>Estado</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargandoCat ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Cargando...</TablaTd></TablaFila>
              ) : catsFiltradas.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Sin categorías</TablaTd></TablaFila>
              ) : catsFiltradas.map((c, idx) => (
                <TablaFila key={c.codigo_cat_docs}>
                  <TablaTd>
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col">
                        <button onClick={() => moverCategoria(idx, 'arriba')} disabled={idx === 0 || !!busquedaCat} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                        <button onClick={() => moverCategoria(idx, 'abajo')} disabled={idx === catsFiltradas.length - 1 || !!busquedaCat} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                      </div>
                      <span className="text-xs text-texto-muted w-5 text-center">{c.orden ?? idx}</span>
                    </div>
                  </TablaTd>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{c.codigo_cat_docs}</code></TablaTd>
                  <TablaTd className="font-medium">{c.nombre_cat_docs}</TablaTd>
                  <TablaTd><Insignia variante={c.es_unica_docs ? 'advertencia' : 'neutro'}>{c.es_unica_docs ? 'Sí' : 'No'}</Insignia></TablaTd>
                  <TablaTd><Insignia variante={c.editable_en_detalle_docs ? 'exito' : 'neutro'}>{c.editable_en_detalle_docs ? 'Sí' : 'No'}</Insignia></TablaTd>
                  <TablaTd><Insignia variante={c.activo ? 'exito' : 'error'}>{c.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmCat(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Desactivar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </>
      )}

      {/* TAB TIPOS */}
      {tabActiva === 'tipos' && (
        <>
          {selectorCategoria}
          {catSeleccionada ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-texto-muted">Tipos de: <strong>{catSeleccionada.nombre_cat_docs}</strong></span>
                <Boton variante="primario" tamano="sm" onClick={abrirNuevoTipo} className="ml-auto"><Plus size={14} />Nuevo tipo</Boton>
              </div>
              <Tabla>
                <TablaCabecera>
                  <tr>
                    <TablaTh>Código</TablaTh>
                    <TablaTh>Nombre</TablaTh>
                    <TablaTh>Estado</TablaTh>
                    <TablaTh className="text-right">Acciones</TablaTh>
                  </tr>
                </TablaCabecera>
                <TablaCuerpo>
                  {cargandoTipos ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>Cargando...</TablaTd></TablaFila>
                  ) : tipos.length === 0 ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>Sin tipos</TablaTd></TablaFila>
                  ) : tipos.map((t) => (
                    <TablaFila key={t.codigo_tipo_docs}>
                      <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{t.codigo_tipo_docs}</code></TablaTd>
                      <TablaTd className="font-medium">{t.nombre_tipo_docs}</TablaTd>
                      <TablaTd><Insignia variante={t.activo ? 'exito' : 'error'}>{t.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarTipo(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmTipo(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </>
          ) : (
            <p className="text-sm text-texto-muted">Seleccione una categoría para ver sus tipos.</p>
          )}
        </>
      )}

      {/* MODALES */}

      {/* Modal Categoria */}
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? `Editar: ${catEditando.nombre_cat_docs}` : 'Nueva categoría '}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formCat.codigo_cat_docs}
            onChange={(e) => setFormCat({ ...formCat, codigo_cat_docs: e.target.value.toUpperCase() })}
            placeholder="Ej: METADATOS" disabled={!!catEditando} />
          <Input etiqueta="Nombre *" value={formCat.nombre_cat_docs}
            onChange={(e) => setFormCat({ ...formCat, nombre_cat_docs: e.target.value })}
            placeholder="Nombre de la categoría" />
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Descripción</label>
            <textarea className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[60px]"
              value={formCat.descripcion_cat_docs}
              onChange={(e) => setFormCat({ ...formCat, descripcion_cat_docs: e.target.value })} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formCat.es_unica_docs}
                onChange={(e) => setFormCat({ ...formCat, es_unica_docs: e.target.checked })}
                className="rounded border-borde" />
              Única por documento
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formCat.editable_en_detalle_docs}
                onChange={(e) => setFormCat({ ...formCat, editable_en_detalle_docs: e.target.checked })}
                className="rounded border-borde" />
              Editable en detalle
            </label>
          </div>
          {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalCat(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarCat} cargando={guardandoCat}>{catEditando ? 'Guardar' : 'Crear'}</Boton>
          </div>
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? `Editar: ${tipoEditando.nombre_tipo_docs}` : 'Nuevo tipo'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formTipo.codigo_tipo_docs}
            onChange={(e) => setFormTipo({ ...formTipo, codigo_tipo_docs: e.target.value.toUpperCase() })}
            placeholder="Ej: AUTOR, FECHA_PUB" disabled={!!tipoEditando} />
          <Input etiqueta="Nombre *" value={formTipo.nombre_tipo_docs}
            onChange={(e) => setFormTipo({ ...formTipo, nombre_tipo_docs: e.target.value })}
            placeholder="Nombre del tipo" />
          {errorTipo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorTipo}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalTipo(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarTipo} cargando={guardandoTipo}>{tipoEditando ? 'Guardar' : 'Crear'}</Boton>
          </div>
        </div>
      </Modal>

      {/* Confirmaciones */}
      <ModalConfirmar abierto={!!confirmCat} alCerrar={() => setConfirmCat(null)} alConfirmar={eliminarCat}
        titulo="Desactivar categoría" mensaje={confirmCat ? `¿Desactivar "${confirmCat.nombre_cat_docs}"?` : ''} textoConfirmar="Desactivar" cargando={eliminandoCat} />
      <ModalConfirmar abierto={!!confirmTipo} alCerrar={() => setConfirmTipo(null)} alConfirmar={eliminarTipo}
        titulo="Desactivar tipo" mensaje={confirmTipo ? `¿Desactivar "${confirmTipo.nombre_tipo_docs}"?` : ''} textoConfirmar="Desactivar" cargando={eliminandoTipo} />
    </div>
  )
}
