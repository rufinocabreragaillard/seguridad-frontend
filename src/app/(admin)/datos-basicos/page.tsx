'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check, Download } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { TabPrompts, type CamposPrompt } from '@/components/ui/tab-prompts'
import { datosBasicosApi } from '@/lib/api'
import type { CategoriaParametro, TipoParametro } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { BotonChat } from '@/components/ui/boton-chat'

type TabId = 'categorias' | 'tipos'
type TabModalCat = 'datos' | 'system_prompt' | 'programacion'
type TabModalTipo = 'datos' | 'system_prompt' | 'programacion'

export default function PaginaDatosBasicos() {
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaParametro[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaParametro | null>(null)
  const [formCat, setFormCat] = useState({ categoria_parametro: '', nombre: '', descripcion: '' })
  const [promptsCat, setPromptsCat] = useState<CamposPrompt>({ prompt: null, system_prompt: null, python: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalCat, setTabModalCat] = useState<TabModalCat>('datos')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoParametro[]>([])
  const [cargandoTipo, setCargandoTipo] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoParametro | null>(null)
  const [formTipo, setFormTipo] = useState({ categoria_parametro: '', tipo_parametro: '', nombre: '', descripcion: '' })
  const [promptsTipo, setPromptsTipo] = useState<CamposPrompt>({ prompt: null, system_prompt: null, python: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalTipo, setTabModalTipo] = useState<TabModalTipo>('datos')
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [filtroCat, setFiltroCat] = useState('')

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarCategorias = useCallback(async () => {
    setCargandoCat(true)
    try {
      setCategorias(await datosBasicosApi.listarCategorias())
    } finally {
      setCargandoCat(false)
    }
  }, [])

  const cargarTipos = useCallback(async () => {
    setCargandoTipo(true)
    try {
      setTipos(await datosBasicosApi.listarTipos())
    } finally {
      setCargandoTipo(false)
    }
  }, [])

  useEffect(() => { cargarCategorias() }, [cargarCategorias])
  useEffect(() => { cargarTipos() }, [cargarTipos])

  // ── CRUD Categorías ────────────────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({ categoria_parametro: '', nombre: '', descripcion: '' })
    setPromptsCat({ prompt: null, system_prompt: null, python: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaParametro) => {
    setCatEditando(c)
    setFormCat({ categoria_parametro: c.categoria_parametro, nombre: c.nombre, descripcion: c.descripcion || '' })
    setPromptsCat({ prompt: c.prompt ?? null, system_prompt: c.system_prompt ?? null, python: c.python ?? null, javascript: c.javascript ?? null, python_editado_manual: c.python_editado_manual ?? false, javascript_editado_manual: c.javascript_editado_manual ?? false })
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const guardarCategoria = async (cerrar = true) => {
    if (!formCat.categoria_parametro || !formCat.nombre) {
      setErrorCat('El código y el nombre son obligatorios')
      return
    }
    setGuardandoCat(true)
    setErrorCat('')
    try {
      if (catEditando) {
        await datosBasicosApi.actualizarCategoria(catEditando.categoria_parametro, {
          nombre: formCat.nombre,
          descripcion: formCat.descripcion || undefined,
          prompt: promptsCat.prompt,
          system_prompt: promptsCat.system_prompt,
          python: promptsCat.python,
          javascript: promptsCat.javascript,
          python_editado_manual: promptsCat.python_editado_manual,
          javascript_editado_manual: promptsCat.javascript_editado_manual,
        })
      } else {
        await datosBasicosApi.crearCategoria({
          categoria_parametro: formCat.categoria_parametro.toUpperCase(),
          nombre: formCat.nombre,
          descripcion: formCat.descripcion || undefined,
        })
      }
      if (cerrar) setModalCat(false)
      cargarCategorias()
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoCat(false)
    }
  }

  const [itemAEliminar, setItemAEliminar] = useState<{ tipo: 'categoria' | 'tipo'; item: CategoriaParametro | TipoParametro } | null>(null)
  const [eliminandoItem, setEliminandoItem] = useState(false)

  const ejecutarEliminacionDB = async () => {
    if (!itemAEliminar) return
    setEliminandoItem(true)
    try {
      if (itemAEliminar.tipo === 'categoria') {
        await datosBasicosApi.eliminarCategoria((itemAEliminar.item as CategoriaParametro).categoria_parametro)
        cargarCategorias()
      } else {
        const t = itemAEliminar.item as TipoParametro
        await datosBasicosApi.eliminarTipo(t.categoria_parametro, t.tipo_parametro)
        cargarTipos()
      }
      setItemAEliminar(null)
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : 'Error al eliminar')
      setItemAEliminar(null)
    } finally {
      setEliminandoItem(false)
    }
  }

  const toggleActivoCat = async (c: CategoriaParametro) => {
    try {
      await datosBasicosApi.actualizarCategoria(c.categoria_parametro, { activo: !c.activo })
      cargarCategorias()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Tipos ─────────────────────────────────────────────────────────────
  const abrirNuevoTipo = () => {
    setTipoEditando(null)
    setFormTipo({ categoria_parametro: '', tipo_parametro: '', nombre: '', descripcion: '' })
    setPromptsTipo({ prompt: null, system_prompt: null, python: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
    setTabModalTipo('datos')
    setErrorTipo('')
    setModalTipo(true)
  }

  const abrirEditarTipo = (t: TipoParametro) => {
    setTipoEditando(t)
    setFormTipo({ categoria_parametro: t.categoria_parametro, tipo_parametro: t.tipo_parametro, nombre: t.nombre, descripcion: t.descripcion || '' })
    setPromptsTipo({ prompt: t.prompt ?? null, system_prompt: t.system_prompt ?? null, python: t.python ?? null, javascript: t.javascript ?? null, python_editado_manual: t.python_editado_manual ?? false, javascript_editado_manual: t.javascript_editado_manual ?? false })
    setTabModalTipo('datos')
    setErrorTipo('')
    setModalTipo(true)
  }

  const guardarTipo = async (cerrar = true) => {
    if (!formTipo.categoria_parametro || !formTipo.tipo_parametro || !formTipo.nombre) {
      setErrorTipo('La categoría, el código y el nombre son obligatorios')
      return
    }
    setGuardandoTipo(true)
    setErrorTipo('')
    try {
      if (tipoEditando) {
        await datosBasicosApi.actualizarTipo(
          tipoEditando.categoria_parametro,
          tipoEditando.tipo_parametro,
          {
            nombre: formTipo.nombre,
            descripcion: formTipo.descripcion || undefined,
            prompt: promptsTipo.prompt,
            system_prompt: promptsTipo.system_prompt,
            python: promptsTipo.python,
            javascript: promptsTipo.javascript,
            python_editado_manual: promptsTipo.python_editado_manual,
            javascript_editado_manual: promptsTipo.javascript_editado_manual,
          }
        )
      } else {
        await datosBasicosApi.crearTipo({
          categoria_parametro: formTipo.categoria_parametro,
          tipo_parametro: formTipo.tipo_parametro.toUpperCase(),
          nombre: formTipo.nombre,
          descripcion: formTipo.descripcion || undefined,
        })
      }
      if (cerrar) setModalTipo(false)
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoTipo(false)
    }
  }

  // eliminarTipo y eliminarCategoria ahora usan el modal de confirmación

  const toggleActivoTipo = async (t: TipoParametro) => {
    try {
      await datosBasicosApi.actualizarTipo(t.categoria_parametro, t.tipo_parametro, { activo: !t.activo })
      cargarTipos()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── Filtro tipos ───────────────────────────────────────────────────────────
  const tiposFiltrados = filtroCat
    ? tipos.filter((t) => t.categoria_parametro === filtroCat)
    : tipos

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      {/* Encabezado */}
      <div className="pr-28">
        <h2 className="page-heading">Datos Básicos</h2>
        <p className="text-sm text-texto-muted mt-1">Configuración de categorías y tipos de parámetros del sistema</p>
      </div>

      {/* Pestañas principales */}
      <div className="flex border-b border-borde gap-1">
        <button
          onClick={() => setTabActiva('categorias')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'categorias'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          Categorías de Parámetros
        </button>
        <button
          onClick={() => setTabActiva('tipos')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'tipos'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          Tipos de Parámetros
        </button>
      </div>

      {/* ── Tab: Categorías ── */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">
              Define las categorías que agrupan los parámetros (ej: MENSAJERIA_EMAIL, SEGURIDAD, etc.)
            </p>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(categorias as unknown as Record<string, unknown>[], [
                  { titulo: 'Código', campo: 'categoria_parametro' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Descripción', campo: 'descripcion' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], 'categorias_parametros')}
                disabled={categorias.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaCat}>
                <Plus size={16} />
                Nueva categoría
              </Boton>
            </div>
          </div>

          {cargandoCat ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
              ))}
            </div>
          ) : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Código</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Descripción</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {categorias.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>
                      No hay categorías registradas
                    </TablaTd>
                  </TablaFila>
                ) : (
                  categorias.map((c) => (
                    <TablaFila key={c.categoria_parametro}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {c.categoria_parametro}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{c.nombre}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">
                        {c.descripcion || <span className="text-texto-light">—</span>}
                      </TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoCat(c)} title="Cambiar estado">
                          <Insignia variante={c.activo ? 'exito' : 'error'}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirEditarCat(c)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setItemAEliminar({ tipo: 'categoria', item: c })}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))
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
              <select
                value={filtroCat}
                onChange={(e) => setFiltroCat(e.target.value)}
                className="rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.categoria_parametro} value={c.categoria_parametro}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(tiposFiltrados as unknown as Record<string, unknown>[], [
                  { titulo: 'Categoría', campo: 'categoria_parametro' },
                  { titulo: 'Código tipo', campo: 'tipo_parametro' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Descripción', campo: 'descripcion' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], `tipos_parametros${filtroCat ? '_' + filtroCat : ''}`)}
                disabled={tiposFiltrados.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoTipo}>
                <Plus size={16} />
                Nuevo tipo
              </Boton>
            </div>
          </div>

          {cargandoTipo ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
              ))}
            </div>
          ) : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Categoría</TablaTh>
                  <TablaTh>Código tipo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Descripción</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {tiposFiltrados.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={6 as never}>
                      No hay tipos registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  tiposFiltrados.map((t) => (
                    <TablaFila key={`${t.categoria_parametro}/${t.tipo_parametro}`}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {t.categoria_parametro}
                        </code>
                      </TablaTd>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {t.tipo_parametro}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{t.nombre}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">
                        {t.descripcion || <span className="text-texto-light">—</span>}
                      </TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoTipo(t)} title="Cambiar estado">
                          <Insignia variante={t.activo ? 'exito' : 'error'}>
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirEditarTipo(t)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setItemAEliminar({ tipo: 'tipo', item: t })}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))
                )}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* Modal Categoría */}
      <Modal
        abierto={modalCat}
        alCerrar={() => setModalCat(false)}
        titulo={catEditando ? 'Editar categoría' : 'Nueva categoría'}
      >
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-borde -mt-2">
            {(['datos', 'system_prompt', 'programacion'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalCat(tab)}
                className={`px-3 py-2 text-sm border-b-2 ${tabModalCat === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : 'Programación'}
              </button>
            ))}
          </div>

          {tabModalCat === 'datos' && <>
            <Input
              etiqueta="Código *"
              value={formCat.categoria_parametro}
              onChange={(e) => setFormCat({ ...formCat, categoria_parametro: e.target.value })}
              disabled={!!catEditando}
              placeholder="MENSAJERIA_EMAIL"
            />
            <Input
              etiqueta="Nombre *"
              value={formCat.nombre}
              onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })}
              placeholder="Mensajería por Email"
            />
            <Input
              etiqueta="Descripción"
              value={formCat.descripcion}
              onChange={(e) => setFormCat({ ...formCat, descripcion: e.target.value })}
              placeholder="Descripción opcional"
            />
          </>}

          {tabModalCat === 'system_prompt' && catEditando && (
            <TabPrompts tabla="categorias_parametro" pkColumna="categoria_parametro" pkValor={catEditando.categoria_parametro}
              campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
              mostrarPrompt={false} mostrarSystemPrompt={true} mostrarPython={false} mostrarJavaScript={false} mostrarBotones={false} />
          )}

          {tabModalCat === 'programacion' && catEditando && (
            <TabPrompts tabla="categorias_parametro" pkColumna="categoria_parametro" pkValor={catEditando.categoria_parametro}
              campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
              mostrarPrompt={true} mostrarSystemPrompt={false} mostrarPython={true} mostrarJavaScript={false} />
          )}

          {errorCat && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorCat}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!catEditando}
            onGuardar={() => guardarCategoria(false)}
            onGuardarYSalir={() => guardarCategoria(true)}
            onCerrar={() => setModalCat(false)}
            cargando={guardandoCat}
          />
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal
        abierto={modalTipo}
        alCerrar={() => setModalTipo(false)}
        titulo={tipoEditando ? 'Editar tipo' : 'Nuevo tipo de parámetro'}
      >
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-borde -mt-2">
            {(['datos', 'system_prompt', 'programacion'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalTipo(tab)}
                className={`px-3 py-2 text-sm border-b-2 ${tabModalTipo === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : 'Programación'}
              </button>
            ))}
          </div>

          {tabModalTipo === 'datos' && <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Categoría *</label>
              <select
                value={formTipo.categoria_parametro}
                onChange={(e) => setFormTipo({ ...formTipo, categoria_parametro: e.target.value })}
                disabled={!!tipoEditando}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
              >
                <option value="">Seleccionar categoría...</option>
                {categorias.filter((c) => c.activo).map((c) => (
                  <option key={c.categoria_parametro} value={c.categoria_parametro}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Input
              etiqueta="Código tipo *"
              value={formTipo.tipo_parametro}
              onChange={(e) => setFormTipo({ ...formTipo, tipo_parametro: e.target.value })}
              disabled={!!tipoEditando}
              placeholder="SMTP_HOST"
            />
            <Input
              etiqueta="Nombre *"
              value={formTipo.nombre}
              onChange={(e) => setFormTipo({ ...formTipo, nombre: e.target.value })}
              placeholder="Servidor SMTP"
            />
            <Input
              etiqueta="Descripción"
              value={formTipo.descripcion}
              onChange={(e) => setFormTipo({ ...formTipo, descripcion: e.target.value })}
              placeholder="Descripción opcional"
            />
          </>}

          {tabModalTipo === 'system_prompt' && tipoEditando && (
            <TabPrompts tabla="tipos_parametro" pkColumna="tipo_parametro" pkValor={tipoEditando.tipo_parametro}
              campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
              mostrarPrompt={false} mostrarSystemPrompt={true} mostrarPython={false} mostrarJavaScript={false} mostrarBotones={false} />
          )}

          {tabModalTipo === 'programacion' && tipoEditando && (
            <TabPrompts tabla="tipos_parametro" pkColumna="tipo_parametro" pkValor={tipoEditando.tipo_parametro}
              campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
              mostrarPrompt={true} mostrarSystemPrompt={false} mostrarPython={true} mostrarJavaScript={false} />
          )}

          {errorTipo && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorTipo}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!tipoEditando}
            onGuardar={() => guardarTipo(false)}
            onGuardarYSalir={() => guardarTipo(true)}
            onCerrar={() => setModalTipo(false)}
            cargando={guardandoTipo}
          />
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <ModalConfirmar
        abierto={!!itemAEliminar}
        alCerrar={() => setItemAEliminar(null)}
        alConfirmar={ejecutarEliminacionDB}
        titulo={itemAEliminar?.tipo === 'categoria' ? 'Eliminar categoría' : 'Eliminar tipo'}
        mensaje={
          itemAEliminar?.tipo === 'categoria'
            ? `¿Estás seguro de eliminar la categoría "${(itemAEliminar.item as CategoriaParametro).nombre}"? Solo es posible si no tiene tipos asociados.`
            : `¿Estás seguro de eliminar el tipo "${(itemAEliminar?.item as TipoParametro)?.nombre}"?`
        }
        textoConfirmar="Eliminar"
        cargando={eliminandoItem}
      />
    </div>
  )
}
