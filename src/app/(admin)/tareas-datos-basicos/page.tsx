'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Eye } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { TabPrompts, type CamposPrompt } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { tareasDatosBasicosApi } from '@/lib/api'
import type { CategoriaTarea, TipoTarea, EstadoTarea, EstadoCanonicoTarea, TipoCanonicoTarea } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { BotonChat } from '@/components/ui/boton-chat'

type TabId = 'categorias' | 'tipos' | 'estados' | 'tipos-canonicos'
type TabModalCat = 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update'
type TabModalTipo = 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update'
type TabModalEst = 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update'

type ItemEliminar =
  | { tipo: 'categoria'; item: CategoriaTarea }
  | { tipo: 'tipotarea'; item: TipoTarea }
  | { tipo: 'estado'; item: EstadoTarea }
  | { tipo: 'tipocanonico'; item: TipoCanonicoTarea }

export default function PaginaTareasDatosBasicos() {
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaTarea[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaTarea | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_categoria_tarea: '', nombre_categoria_tarea: '', descripcion_categoria_tarea: '',
  })
  const [promptsCat, setPromptsCat] = useState<CamposPrompt>({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalCat, setTabModalCat] = useState<TabModalCat>('datos')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoTarea[]>([])
  const [cargandoTipo, setCargandoTipo] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoTarea | null>(null)
  const [formTipo, setFormTipo] = useState({
    codigo_categoria_tarea: '', codigo_tipo_tarea: '', codigo_tipo_canonico: '',
    nombre_tipo_tarea: '', descripcion_tipo_tarea: '',
  })
  const [promptsTipo, setPromptsTipo] = useState<CamposPrompt>({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalTipo, setTabModalTipo] = useState<TabModalTipo>('datos')
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [filtroCatTipo, setFiltroCatTipo] = useState('')
  const [tiposCanonicos, setTiposCanonicos] = useState<TipoCanonicoTarea[]>([])

  // ── Estados ────────────────────────────────────────────────────────────────
  const [estados, setEstados] = useState<EstadoTarea[]>([])
  const [cargandoEst, setCargandoEst] = useState(true)
  const [modalEst, setModalEst] = useState(false)
  const [estEditando, setEstEditando] = useState<EstadoTarea | null>(null)
  const [formEst, setFormEst] = useState({
    codigo_categoria_tarea: '', codigo_tipo_tarea: '', codigo_estado_tarea: '',
    nombre_estado_tarea: '', descripcion_estado_tarea: '', codigo_estado_canonico: '', orden: 0,
  })
  const [promptsEst, setPromptsEst] = useState<CamposPrompt>({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalEst, setTabModalEst] = useState<TabModalEst>('datos')
  const [guardandoEst, setGuardandoEst] = useState(false)
  const [errorEst, setErrorEst] = useState('')
  const [filtroCatEst, setFiltroCatEst] = useState('')
  const [filtroTipoEst, setFiltroTipoEst] = useState('')
  const [canonicosEst, setCanonicoEst] = useState<EstadoCanonicoTarea[]>([])

  // ── Tipos Canónicos ────────────────────────────────────────────────────────
  const [cargandoTC, setCargandoTC] = useState(true)
  const [modalTC, setModalTC] = useState(false)
  const [tcEditando, setTcEditando] = useState<TipoCanonicoTarea | null>(null)
  const [formTC, setFormTC] = useState({ codigo_tipo_canonico: '', nombre_tipo_canonico: '', descripcion_tipo_canonico: '' })
  const [guardandoTC, setGuardandoTC] = useState(false)
  const [errorTC, setErrorTC] = useState('')

  // ── Eliminación ────────────────────────────────────────────────────────────
  const [itemAEliminar, setItemAEliminar] = useState<ItemEliminar | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarCategorias = useCallback(async () => {
    setCargandoCat(true)
    try { setCategorias(await tareasDatosBasicosApi.listarCategorias()) }
    finally { setCargandoCat(false) }
  }, [])

  const cargarTipos = useCallback(async () => {
    setCargandoTipo(true)
    try { setTipos(await tareasDatosBasicosApi.listarTiposTar()) }
    finally { setCargandoTipo(false) }
  }, [])

  const cargarEstados = useCallback(async () => {
    setCargandoEst(true)
    try { setEstados(await tareasDatosBasicosApi.listarEstadosTar()) }
    finally { setCargandoEst(false) }
  }, [])

  const cargarTiposCanonicos = useCallback(async () => {
    setCargandoTC(true)
    try { setTiposCanonicos(await tareasDatosBasicosApi.listarTiposCanonicos()) }
    finally { setCargandoTC(false) }
  }, [])

  useEffect(() => { cargarCategorias() }, [cargarCategorias])
  useEffect(() => { cargarTipos() }, [cargarTipos])
  useEffect(() => { cargarEstados() }, [cargarEstados])
  useEffect(() => { cargarTiposCanonicos() }, [cargarTiposCanonicos])
  useEffect(() => {
    tareasDatosBasicosApi.listarCanonicosTar().then(setCanonicoEst).catch(() => {})
  }, [])

  // ── CRUD Categorías ────────────────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({ codigo_categoria_tarea: '', nombre_categoria_tarea: '', descripcion_categoria_tarea: '' })
    setPromptsCat({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaTarea) => {
    setCatEditando(c)
    setFormCat({
      codigo_categoria_tarea: c.codigo_categoria_tarea,
      nombre_categoria_tarea: c.nombre_categoria_tarea,
      descripcion_categoria_tarea: c.descripcion_categoria_tarea || '',
    })
    const c2 = c as unknown as Record<string, unknown>
    setPromptsCat({ prompt_insert: c2.prompt_insert as string ?? null, prompt_update: c2.prompt_update as string ?? null, system_prompt: c.system_prompt ?? null, python_insert: c2.python_insert as string ?? null, python_update: c2.python_update as string ?? null, javascript: c2.javascript as string ?? null, python_editado_manual: c.python_editado_manual ?? false, javascript_editado_manual: c.javascript_editado_manual ?? false })
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const guardarCategoria = async (cerrar = true) => {
    if (!formCat.nombre_categoria_tarea) { setErrorCat('El nombre es obligatorio'); return }
    setGuardandoCat(true); setErrorCat('')
    try {
      if (catEditando) {
        await tareasDatosBasicosApi.actualizarCategoria(catEditando.codigo_categoria_tarea, {
          nombre_categoria_tarea: formCat.nombre_categoria_tarea,
          descripcion_categoria_tarea: formCat.descripcion_categoria_tarea || undefined,
          prompt_insert: promptsCat.prompt_insert,
          prompt_update: promptsCat.prompt_update,
          system_prompt: promptsCat.system_prompt,
          python_insert: promptsCat.python_insert,
          python_update: promptsCat.python_update,
          javascript: promptsCat.javascript,
          python_editado_manual: promptsCat.python_editado_manual,
          javascript_editado_manual: promptsCat.javascript_editado_manual,
        })
      } else {
        await tareasDatosBasicosApi.crearCategoria({
          codigo_categoria_tarea: formCat.codigo_categoria_tarea || undefined,
          nombre_categoria_tarea: formCat.nombre_categoria_tarea,
          descripcion_categoria_tarea: formCat.descripcion_categoria_tarea || undefined,
        })
      }
      if (cerrar) setModalCat(false)
      cargarCategorias()
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setGuardandoCat(false) }
  }

  // ── CRUD Tipos ─────────────────────────────────────────────────────────────
  const abrirNuevoTipo = () => {
    setTipoEditando(null)
    setFormTipo({ codigo_categoria_tarea: '', codigo_tipo_tarea: '', codigo_tipo_canonico: '', nombre_tipo_tarea: '', descripcion_tipo_tarea: '' })
    setPromptsTipo({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
    setTabModalTipo('datos')
    setErrorTipo('')
    setModalTipo(true)
  }

  const abrirEditarTipo = (t: TipoTarea) => {
    setTipoEditando(t)
    setFormTipo({
      codigo_categoria_tarea: t.codigo_categoria_tarea,
      codigo_tipo_tarea: t.codigo_tipo_tarea,
      codigo_tipo_canonico: t.codigo_tipo_canonico || '',
      nombre_tipo_tarea: t.nombre_tipo_tarea,
      descripcion_tipo_tarea: t.descripcion_tipo_tarea || '',
    })
    const t2 = t as unknown as Record<string, unknown>
    setPromptsTipo({ prompt_insert: t2.prompt_insert as string ?? null, prompt_update: t2.prompt_update as string ?? null, system_prompt: t.system_prompt ?? null, python_insert: t2.python_insert as string ?? null, python_update: t2.python_update as string ?? null, javascript: t2.javascript as string ?? null, python_editado_manual: t.python_editado_manual ?? false, javascript_editado_manual: t.javascript_editado_manual ?? false })
    setTabModalTipo('datos')
    setErrorTipo('')
    setModalTipo(true)
  }

  const guardarTipo = async (cerrar = true) => {
    if (!formTipo.codigo_categoria_tarea || !formTipo.nombre_tipo_tarea) {
      setErrorTipo('La categoría y el nombre son obligatorios'); return
    }
    if (!tipoEditando && !formTipo.codigo_tipo_tarea) {
      setErrorTipo('El código del tipo es obligatorio'); return
    }
    setGuardandoTipo(true); setErrorTipo('')
    try {
      if (tipoEditando) {
        await tareasDatosBasicosApi.actualizarTipoTar(
          tipoEditando.codigo_categoria_tarea, tipoEditando.codigo_tipo_tarea,
          {
            nombre_tipo_tarea: formTipo.nombre_tipo_tarea,
            descripcion_tipo_tarea: formTipo.descripcion_tipo_tarea || undefined,
            codigo_tipo_canonico: formTipo.codigo_tipo_canonico || undefined,
            prompt_insert: promptsTipo.prompt_insert,
            prompt_update: promptsTipo.prompt_update,
            system_prompt: promptsTipo.system_prompt,
            python_insert: promptsTipo.python_insert,
            python_update: promptsTipo.python_update,
            javascript: promptsTipo.javascript,
            python_editado_manual: promptsTipo.python_editado_manual,
            javascript_editado_manual: promptsTipo.javascript_editado_manual,
          }
        )
      } else {
        await tareasDatosBasicosApi.crearTipoTar({
          codigo_categoria_tarea: formTipo.codigo_categoria_tarea,
          codigo_tipo_tarea: formTipo.codigo_tipo_tarea,
          codigo_tipo_canonico: formTipo.codigo_tipo_canonico || undefined,
          nombre_tipo_tarea: formTipo.nombre_tipo_tarea,
          descripcion_tipo_tarea: formTipo.descripcion_tipo_tarea || undefined,
        })
      }
      if (cerrar) setModalTipo(false)
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setGuardandoTipo(false) }
  }

  // ── CRUD Estados ───────────────────────────────────────────────────────────
  const abrirNuevoEst = () => {
    setEstEditando(null)
    setFormEst({ codigo_categoria_tarea: '', codigo_tipo_tarea: '', codigo_estado_tarea: '', nombre_estado_tarea: '', descripcion_estado_tarea: '', codigo_estado_canonico: '', orden: 0 })
    setPromptsEst({ prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false })
    setTabModalEst('datos')
    setErrorEst('')
    setModalEst(true)
  }

  const abrirEditarEst = (e: EstadoTarea) => {
    setEstEditando(e)
    setFormEst({
      codigo_categoria_tarea: e.codigo_categoria_tarea,
      codigo_tipo_tarea: e.codigo_tipo_tarea,
      codigo_estado_tarea: e.codigo_estado_tarea,
      nombre_estado_tarea: e.nombre_estado_tarea,
      descripcion_estado_tarea: e.descripcion_estado_tarea || '',
      codigo_estado_canonico: e.codigo_estado_canonico,
      orden: e.orden,
    })
    const e2 = e as unknown as Record<string, unknown>
    setPromptsEst({ prompt_insert: e2.prompt_insert as string ?? null, prompt_update: e2.prompt_update as string ?? null, system_prompt: e.system_prompt ?? null, python_insert: e2.python_insert as string ?? null, python_update: e2.python_update as string ?? null, javascript: e2.javascript as string ?? null, python_editado_manual: e.python_editado_manual ?? false, javascript_editado_manual: e.javascript_editado_manual ?? false })
    setTabModalEst('datos')
    setErrorEst('')
    setModalEst(true)
  }

  const guardarEstado = async (cerrar = true) => {
    if (!formEst.codigo_categoria_tarea || !formEst.codigo_tipo_tarea || !formEst.nombre_estado_tarea || !formEst.codigo_estado_canonico) {
      setErrorEst('Categoría, tipo, nombre y estado canónico son obligatorios'); return
    }
    if (!estEditando && !formEst.codigo_estado_tarea) {
      setErrorEst('El código del estado es obligatorio'); return
    }
    setGuardandoEst(true); setErrorEst('')
    try {
      if (estEditando) {
        await tareasDatosBasicosApi.actualizarEstadoTar(
          estEditando.codigo_categoria_tarea, estEditando.codigo_tipo_tarea, estEditando.codigo_estado_tarea,
          {
            nombre_estado_tarea: formEst.nombre_estado_tarea,
            descripcion_estado_tarea: formEst.descripcion_estado_tarea || undefined,
            codigo_estado_canonico: formEst.codigo_estado_canonico,
            orden: formEst.orden,
            prompt_insert: promptsEst.prompt_insert,
            prompt_update: promptsEst.prompt_update,
            system_prompt: promptsEst.system_prompt,
            python_insert: promptsEst.python_insert,
            python_update: promptsEst.python_update,
            javascript: promptsEst.javascript,
            python_editado_manual: promptsEst.python_editado_manual,
            javascript_editado_manual: promptsEst.javascript_editado_manual,
          }
        )
      } else {
        await tareasDatosBasicosApi.crearEstadoTar({
          codigo_categoria_tarea: formEst.codigo_categoria_tarea,
          codigo_tipo_tarea: formEst.codigo_tipo_tarea,
          codigo_estado_tarea: formEst.codigo_estado_tarea,
          nombre_estado_tarea: formEst.nombre_estado_tarea,
          descripcion_estado_tarea: formEst.descripcion_estado_tarea || undefined,
          codigo_estado_canonico: formEst.codigo_estado_canonico,
          // orden se auto-asigna en el backend
        })
      }
      if (cerrar) setModalEst(false)
      cargarEstados()
    } catch (e) {
      setErrorEst(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setGuardandoEst(false) }
  }

  // ── Reordenar ──────────────────────────────────────────────────────────────
  const reordenarCategorias = async (nuevos: CategoriaTarea[]) => {
    const nuevosConOrden = nuevos.map((c, idx) => ({ ...c, orden: idx + 1 }))
    setCategorias(nuevosConOrden)
    try {
      await tareasDatosBasicosApi.reordenarCategorias(
        nuevosConOrden.map((c) => ({ codigo_categoria_tarea: c.codigo_categoria_tarea, orden: c.orden ?? 0 }))
      )
    } catch { cargarCategorias() }
  }

  const reordenarTipos = async (nuevos: TipoTarea[]) => {
    const nuevosConOrden = nuevos.map((t, idx) => ({ ...t, orden: idx + 1 }))
    if (filtroCatTipo) {
      const resto = tipos.filter((t) => t.codigo_categoria_tarea !== filtroCatTipo)
      setTipos([...resto, ...nuevosConOrden])
    } else {
      setTipos(nuevosConOrden)
    }
    try {
      await tareasDatosBasicosApi.reordenarTiposTar(
        nuevosConOrden.map((t) => ({
          codigo_categoria_tarea: t.codigo_categoria_tarea,
          codigo_tipo_tarea: t.codigo_tipo_tarea,
          orden: t.orden ?? 0,
        }))
      )
    } catch { cargarTipos() }
  }

  const reordenarEstados = async (nuevos: EstadoTarea[]) => {
    const nuevosConOrden = nuevos.map((e, idx) => ({ ...e, orden: idx + 1 }))
    if (filtroCatEst || filtroTipoEst) {
      const resto = estados.filter(
        (e) => e.codigo_categoria_tarea !== filtroCatEst || e.codigo_tipo_tarea !== filtroTipoEst
      )
      setEstados([...resto, ...nuevosConOrden])
    } else {
      setEstados(nuevosConOrden)
    }
    try {
      await tareasDatosBasicosApi.reordenarEstadosTar(
        nuevosConOrden.map((e) => ({
          codigo_categoria_tarea: e.codigo_categoria_tarea,
          codigo_tipo_tarea: e.codigo_tipo_tarea,
          codigo_estado_tarea: e.codigo_estado_tarea,
          orden: e.orden ?? 0,
        }))
      )
    } catch { cargarEstados() }
  }

  const toggleActivoTipo = async (t: TipoTarea) => {
    try {
      await tareasDatosBasicosApi.actualizarTipoTar(
        t.codigo_categoria_tarea, t.codigo_tipo_tarea, { activo: !t.activo }
      )
      cargarTipos()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Tipos Canónicos ───────────────────────────────────────────────────
  const abrirNuevoTC = () => {
    setTcEditando(null)
    setFormTC({ codigo_tipo_canonico: '', nombre_tipo_canonico: '', descripcion_tipo_canonico: '' })
    setErrorTC('')
    setModalTC(true)
  }

  const abrirEditarTC = (tc: TipoCanonicoTarea) => {
    setTcEditando(tc)
    setFormTC({
      codigo_tipo_canonico: tc.codigo_tipo_canonico,
      nombre_tipo_canonico: tc.nombre_tipo_canonico,
      descripcion_tipo_canonico: tc.descripcion_tipo_canonico || '',
    })
    setErrorTC('')
    setModalTC(true)
  }

  const guardarTC = async (cerrar = true) => {
    if (!formTC.nombre_tipo_canonico) { setErrorTC('El nombre es obligatorio'); return }
    setGuardandoTC(true); setErrorTC('')
    try {
      if (tcEditando) {
        await tareasDatosBasicosApi.actualizarTipoCanonico(tcEditando.codigo_tipo_canonico, {
          nombre_tipo_canonico: formTC.nombre_tipo_canonico,
          descripcion_tipo_canonico: formTC.descripcion_tipo_canonico || undefined,
        })
      } else {
        await tareasDatosBasicosApi.crearTipoCanonico({
          codigo_tipo_canonico: formTC.codigo_tipo_canonico || undefined,
          nombre_tipo_canonico: formTC.nombre_tipo_canonico,
          descripcion_tipo_canonico: formTC.descripcion_tipo_canonico || undefined,
        })
      }
      if (cerrar) setModalTC(false)
      cargarTiposCanonicos()
    } catch (e) {
      setErrorTC(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setGuardandoTC(false) }
  }

  const toggleActivoEst = async (e: EstadoTarea) => {
    try {
      await tareasDatosBasicosApi.actualizarEstadoTar(
        e.codigo_categoria_tarea, e.codigo_tipo_tarea, e.codigo_estado_tarea, { activo: !e.activo }
      )
      cargarEstados()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado')
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  const ejecutarEliminacion = async () => {
    if (!itemAEliminar) return
    setEliminando(true)
    try {
      if (itemAEliminar.tipo === 'categoria') {
        await tareasDatosBasicosApi.eliminarCategoria((itemAEliminar.item as CategoriaTarea).codigo_categoria_tarea)
        cargarCategorias()
      } else if (itemAEliminar.tipo === 'tipotarea') {
        const t = itemAEliminar.item as TipoTarea
        await tareasDatosBasicosApi.eliminarTipoTar(t.codigo_categoria_tarea, t.codigo_tipo_tarea)
        cargarTipos()
      } else if (itemAEliminar.tipo === 'tipocanonico') {
        await tareasDatosBasicosApi.eliminarTipoCanonico((itemAEliminar.item as TipoCanonicoTarea).codigo_tipo_canonico)
        cargarTiposCanonicos()
      } else {
        const e = itemAEliminar.item as EstadoTarea
        await tareasDatosBasicosApi.eliminarEstadoTar(e.codigo_categoria_tarea, e.codigo_tipo_tarea, e.codigo_estado_tarea)
        cargarEstados()
      }
      setItemAEliminar(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
      setItemAEliminar(null)
    } finally { setEliminando(false) }
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const tiposFiltrados = filtroCatTipo
    ? tipos.filter((t) => t.codigo_categoria_tarea === filtroCatTipo)
    : tipos

  const estadosFiltrados = estados.filter((e) => {
    if (filtroCatEst && e.codigo_categoria_tarea !== filtroCatEst) return false
    if (filtroTipoEst && e.codigo_tipo_tarea !== filtroTipoEst) return false
    return true
  })

  const tiposParaEstados = tipos.filter((t) => !filtroCatEst || t.codigo_categoria_tarea === filtroCatEst)

  const selectCls = 'rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'
  const tabCls = (id: TabId) =>
    `px-5 py-2.5 text-sm font-medium transition-colors ${tabActiva === id ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />

      <div className="pr-28">
        <h2 className="page-heading">Datos Básicos de Tareas</h2>
        <p className="text-sm text-texto-muted mt-1">Configuración de categorías, tipos y estados de tarea</p>
      </div>

      {/* Pestañas */}
      <div className="flex border-b border-borde gap-1">
        <button onClick={() => setTabActiva('categorias')} className={tabCls('categorias')}>Categorías de Tarea</button>
        <button onClick={() => setTabActiva('tipos')} className={tabCls('tipos')}>Tipos de Tarea</button>
        <button onClick={() => setTabActiva('estados')} className={tabCls('estados')}>Estados de Tarea</button>
        <button onClick={() => setTabActiva('tipos-canonicos')} className={tabCls('tipos-canonicos')}>Tipos Canónicos</button>
      </div>

      {/* ── Tab: Categorías ── */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">Categorías globales de tarea</p>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(categorias as unknown as Record<string, unknown>[], [
                  { titulo: 'Código', campo: 'codigo_categoria_tarea' },
                  { titulo: 'Nombre', campo: 'nombre_categoria_tarea' },
                  { titulo: 'Descripción', campo: 'descripcion_categoria_tarea' },
                  { titulo: 'Activo', campo: 'activo', formato: (v) => v ? 'Sí' : 'No' },
                ], 'categorias_tarea')}
                disabled={categorias.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaCat}><Plus size={16} /> Nueva categoría</Boton>
            </div>
          </div>

          {cargandoCat ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : categorias.length === 0 ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">No hay categorías registradas</div>
          ) : (
            <SortableDndContext
              items={categorias as unknown as Record<string, unknown>[]}
              getId={(c) => (c as unknown as CategoriaTarea).codigo_categoria_tarea}
              onReorder={(n) => reordenarCategorias(n as unknown as CategoriaTarea[])}
            >
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-8" />
                  <TablaTh className="w-16 text-center">Orden</TablaTh>
                  <TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh><TablaTh>Estado</TablaTh>
                  <TablaTh className="w-48">Código</TablaTh>
                  <TablaTh className="text-right w-28">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {categorias.map((c) => (
                    <SortableRow key={c.codigo_categoria_tarea} id={c.codigo_categoria_tarea}
                      onDoubleClick={() => { setFiltroCatTipo(c.codigo_categoria_tarea); setTabActiva('tipos') }}
                    >
                      <TablaTd className="text-center text-texto-muted text-sm">{c.orden ?? '—'}</TablaTd>
                      <TablaTd className="font-medium">{c.nombre_categoria_tarea}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">{c.descripcion_categoria_tarea || <span className="text-texto-light">—</span>}</TablaTd>
                      <TablaTd>
                        <Insignia variante={c.activo ? 'exito' : 'error'}>{c.activo ? 'Activo' : 'Inactivo'}</Insignia>
                      </TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.codigo_categoria_tarea}</code></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setFiltroCatTipo(c.codigo_categoria_tarea); setTabActiva('tipos') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver tipos"><Eye size={14} /></button>
                          <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => setItemAEliminar({ tipo: 'categoria', item: c })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </SortableRow>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </SortableDndContext>
          )}
        </>
      )}

      {/* ── Tab: Tipos ── */}
      {tabActiva === 'tipos' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-texto-muted">Filtrar por categoría:</p>
              <select value={filtroCatTipo} onChange={(e) => setFiltroCatTipo(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {categorias.map((c) => <option key={c.codigo_categoria_tarea} value={c.codigo_categoria_tarea}>{c.nombre_categoria_tarea}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(tiposFiltrados as unknown as Record<string, unknown>[], [
                  { titulo: 'Categoría', campo: 'codigo_categoria_tarea' },
                  { titulo: 'Código tipo', campo: 'codigo_tipo_tarea' },
                  { titulo: 'Nombre', campo: 'nombre_tipo_tarea' },
                  { titulo: 'Tipo canónico', campo: 'codigo_tipo_canonico' },
                  { titulo: 'Activo', campo: 'activo', formato: (v) => v ? 'Sí' : 'No' },
                ], 'tipos_tarea')}
                disabled={tiposFiltrados.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoTipo}><Plus size={16} /> Nuevo tipo</Boton>
            </div>
          </div>

          {cargandoTipo ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : tiposFiltrados.length === 0 ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">No hay tipos registrados</div>
          ) : (
            <SortableDndContext
              items={tiposFiltrados as unknown as Record<string, unknown>[]}
              getId={(t) => `${(t as unknown as TipoTarea).codigo_categoria_tarea}/${(t as unknown as TipoTarea).codigo_tipo_tarea}`}
              onReorder={(n) => reordenarTipos(n as unknown as TipoTarea[])}
            >
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-8" />
                  <TablaTh className="w-16 text-center">Orden</TablaTh>
                  <TablaTh>Categoría</TablaTh><TablaTh>Código tipo</TablaTh><TablaTh>Nombre</TablaTh>
                  <TablaTh>Tipo canónico</TablaTh><TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right w-28">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {tiposFiltrados.map((t) => (
                    <SortableRow key={`${t.codigo_categoria_tarea}/${t.codigo_tipo_tarea}`} id={`${t.codigo_categoria_tarea}/${t.codigo_tipo_tarea}`}
                      onDoubleClick={() => { setFiltroCatEst(t.codigo_categoria_tarea); setFiltroTipoEst(t.codigo_tipo_tarea); setTabActiva('estados') }}
                    >
                      <TablaTd className="text-center text-texto-muted text-sm">{t.orden ?? '—'}</TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.codigo_categoria_tarea}</code></TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.codigo_tipo_tarea}</code></TablaTd>
                      <TablaTd className="font-medium">{t.nombre_tipo_tarea}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">{t.codigo_tipo_canonico || <span className="text-texto-light">—</span>}</TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoTipo(t)} title="Cambiar estado">
                          <Insignia variante={t.activo ? 'exito' : 'error'}>{t.activo ? 'Activo' : 'Inactivo'}</Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setFiltroCatEst(t.codigo_categoria_tarea); setFiltroTipoEst(t.codigo_tipo_tarea); setTabActiva('estados') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver estados"><Eye size={14} /></button>
                          <button onClick={() => abrirEditarTipo(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => setItemAEliminar({ tipo: 'tipotarea', item: t })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </SortableRow>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </SortableDndContext>
          )}
        </>
      )}

      {/* ── Tab: Estados ── */}
      {tabActiva === 'estados' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-texto-muted">Filtrar:</p>
              <select value={filtroCatEst} onChange={(e) => { setFiltroCatEst(e.target.value); setFiltroTipoEst('') }} className={selectCls}>
                <option value="">Todas las categorías</option>
                {categorias.map((c) => <option key={c.codigo_categoria_tarea} value={c.codigo_categoria_tarea}>{c.nombre_categoria_tarea}</option>)}
              </select>
              <select value={filtroTipoEst} onChange={(e) => setFiltroTipoEst(e.target.value)} className={selectCls}>
                <option value="">Todos los tipos</option>
                {tiposParaEstados.map((t) => (
                  <option key={`${t.codigo_categoria_tarea}/${t.codigo_tipo_tarea}`} value={t.codigo_tipo_tarea}>
                    {t.nombre_tipo_tarea}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(estadosFiltrados as unknown as Record<string, unknown>[], [
                  { titulo: 'Categoría', campo: 'codigo_categoria_tarea' },
                  { titulo: 'Tipo', campo: 'codigo_tipo_tarea' },
                  { titulo: 'Código estado', campo: 'codigo_estado_tarea' },
                  { titulo: 'Nombre', campo: 'nombre_estado_tarea' },
                  { titulo: 'Canónico', campo: 'codigo_estado_canonico' },
                  { titulo: 'Orden', campo: 'orden' },
                  { titulo: 'Activo', campo: 'activo', formato: (v) => v ? 'Sí' : 'No' },
                ], 'estados_tarea')}
                disabled={estadosFiltrados.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoEst}><Plus size={16} /> Nuevo estado</Boton>
            </div>
          </div>

          {cargandoEst ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : estadosFiltrados.length === 0 ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">No hay estados registrados</div>
          ) : (
            <SortableDndContext
              items={estadosFiltrados as unknown as Record<string, unknown>[]}
              getId={(e) => `${(e as unknown as EstadoTarea).codigo_categoria_tarea}/${(e as unknown as EstadoTarea).codigo_tipo_tarea}/${(e as unknown as EstadoTarea).codigo_estado_tarea}`}
              onReorder={(n) => reordenarEstados(n as unknown as EstadoTarea[])}
            >
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-8" />
                  <TablaTh className="w-16 text-center">Orden</TablaTh>
                  <TablaTh>Categoría</TablaTh><TablaTh>Tipo</TablaTh><TablaTh>Código</TablaTh>
                  <TablaTh>Nombre</TablaTh><TablaTh>Canónico</TablaTh><TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right w-24">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {estadosFiltrados.map((e) => (
                    <SortableRow key={`${e.codigo_categoria_tarea}/${e.codigo_tipo_tarea}/${e.codigo_estado_tarea}`} id={`${e.codigo_categoria_tarea}/${e.codigo_tipo_tarea}/${e.codigo_estado_tarea}`}>
                      <TablaTd className="text-center text-texto-muted text-sm">{e.orden}</TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_categoria_tarea}</code></TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_tipo_tarea}</code></TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_estado_tarea}</code></TablaTd>
                      <TablaTd className="font-medium">{e.nombre_estado_tarea}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">{e.codigo_estado_canonico}</TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoEst(e)} title="Cambiar estado">
                          <Insignia variante={e.activo ? 'exito' : 'error'}>{e.activo ? 'Activo' : 'Inactivo'}</Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarEst(e)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => setItemAEliminar({ tipo: 'estado', item: e })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </SortableRow>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </SortableDndContext>
          )}
        </>
      )}

      {/* ── Tab: Tipos Canónicos ── */}
      {tabActiva === 'tipos-canonicos' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">Tipos canónicos globales de tarea</p>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(tiposCanonicos as unknown as Record<string, unknown>[], [
                  { titulo: 'Código', campo: 'codigo_tipo_canonico' },
                  { titulo: 'Nombre', campo: 'nombre_tipo_canonico' },
                  { titulo: 'Descripción', campo: 'descripcion_tipo_canonico' },
                  { titulo: 'Activo', campo: 'activo', formato: (v) => v ? 'Sí' : 'No' },
                ], 'tipos_canonicos_tarea')}
                disabled={tiposCanonicos.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoTC}><Plus size={16} /> Nuevo tipo canónico</Boton>
            </div>
          </div>

          {cargandoTC ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh><TablaTh>Estado</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {tiposCanonicos.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>No hay tipos canónicos registrados</TablaTd></TablaFila>
                ) : tiposCanonicos.map((tc) => (
                  <TablaFila key={tc.codigo_tipo_canonico}>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{tc.codigo_tipo_canonico}</code></TablaTd>
                    <TablaTd className="font-medium">{tc.nombre_tipo_canonico}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm">{tc.descripcion_tipo_canonico || <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd>
                      <Insignia variante={tc.activo ? 'exito' : 'error'}>{tc.activo ? 'Activo' : 'Inactivo'}</Insignia>
                    </TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditarTC(tc)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => setItemAEliminar({ tipo: 'tipocanonico', item: tc })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </TablaTd>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* Modal Categoría */}
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? 'Editar categoría' : 'Nueva categoría de tarea'}>
        <div className="flex flex-col gap-4 min-h-[500px]">
          <div className="flex gap-1 border-b border-borde -mt-2">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalCat(tab)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 ${tabModalCat === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : 'Prog. Update'}
              </button>
            ))}
          </div>
          {tabModalCat === 'datos' && <>
            {!catEditando && (
              <Input etiqueta="Código (dejar vacío para autogenerar)" value={formCat.codigo_categoria_tarea}
                onChange={(e) => setFormCat({ ...formCat, codigo_categoria_tarea: e.target.value })}
                placeholder="SOPORTE_TI" />
            )}
            <Input etiqueta="Nombre *" value={formCat.nombre_categoria_tarea}
              onChange={(e) => setFormCat({ ...formCat, nombre_categoria_tarea: e.target.value })}
              placeholder="Soporte TI" />
            <Input etiqueta="Descripción" value={formCat.descripcion_categoria_tarea}
              onChange={(e) => setFormCat({ ...formCat, descripcion_categoria_tarea: e.target.value })}
              placeholder="Descripción opcional" />
          </>}
          {tabModalCat === 'system_prompt' && catEditando && (
            <TabPrompts tabla="categorias_tarea" pkColumna="codigo_categoria_tarea" pkValor={catEditando.codigo_categoria_tarea}
              campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
              mostrarPromptInsert={false} mostrarPromptUpdate={false} mostrarSystemPrompt={true} mostrarPythonInsert={false} mostrarPythonUpdate={false} mostrarJavaScript={false} />
          )}
          {tabModalCat === 'programacion_insert' && catEditando && (
            <TabPrompts tabla="categorias_tarea" pkColumna="codigo_categoria_tarea" pkValor={catEditando.codigo_categoria_tarea}
              campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptUpdate={false} mostrarPythonUpdate={false} />
          )}
          {tabModalCat === 'programacion_update' && catEditando && (
            <TabPrompts tabla="categorias_tarea" pkColumna="codigo_categoria_tarea" pkValor={catEditando.codigo_categoria_tarea}
              campos={promptsCat} onCampoCambiado={(c, v) => setPromptsCat({ ...promptsCat, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptInsert={false} mostrarPythonInsert={false} />
          )}
          {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
          <PieBotonesModal
            editando={!!catEditando}
            onGuardar={() => guardarCategoria(false)}
            onGuardarYSalir={() => guardarCategoria(true)}
            onCerrar={() => setModalCat(false)}
            cargando={guardandoCat}
            botonesIzquierda={(tabModalCat === 'system_prompt' || tabModalCat === 'programacion_insert' || tabModalCat === 'programacion_update') && catEditando ? (
              <PieBotonesPrompts
                tabla="categorias_tarea"
                pkColumna="codigo_categoria_tarea"
                pkValor={catEditando.codigo_categoria_tarea}
                promptInsert={promptsCat.prompt_insert ?? undefined}
                promptUpdate={promptsCat.prompt_update ?? undefined}
              />
            ) : undefined}
          />
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? 'Editar tipo de tarea' : 'Nuevo tipo de tarea'}>
        <div className="flex flex-col gap-4 min-h-[500px]">
          <div className="flex gap-1 border-b border-borde -mt-2">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalTipo(tab)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 ${tabModalTipo === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : 'Prog. Update'}
              </button>
            ))}
          </div>
          {tabModalTipo === 'datos' && <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Categoría *</label>
              <select value={formTipo.codigo_categoria_tarea}
                onChange={(e) => setFormTipo({ ...formTipo, codigo_categoria_tarea: e.target.value })}
                disabled={!!tipoEditando}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60">
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => <option key={c.codigo_categoria_tarea} value={c.codigo_categoria_tarea}>{c.nombre_categoria_tarea}</option>)}
              </select>
            </div>
            <Input etiqueta="Código tipo *" value={formTipo.codigo_tipo_tarea}
              onChange={(e) => setFormTipo({ ...formTipo, codigo_tipo_tarea: e.target.value })}
              placeholder="INCIDENCIA_RED"
              disabled={!!tipoEditando} />
            <Input etiqueta="Nombre *" value={formTipo.nombre_tipo_tarea}
              onChange={(e) => setFormTipo({ ...formTipo, nombre_tipo_tarea: e.target.value })}
              placeholder="Incidencia de Red" />
            <Input etiqueta="Descripción" value={formTipo.descripcion_tipo_tarea}
              onChange={(e) => setFormTipo({ ...formTipo, descripcion_tipo_tarea: e.target.value })}
              placeholder="Descripción opcional" />
            {tiposCanonicos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Tipo canónico (opcional)</label>
                <select value={formTipo.codigo_tipo_canonico}
                  onChange={(e) => setFormTipo({ ...formTipo, codigo_tipo_canonico: e.target.value })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario">
                  <option value="">Sin tipo canónico</option>
                  {tiposCanonicos.map((tc) => <option key={tc.codigo_tipo_canonico} value={tc.codigo_tipo_canonico}>{tc.nombre_tipo_canonico}</option>)}
                </select>
              </div>
            )}
          </>}
          {tabModalTipo === 'system_prompt' && tipoEditando && (
            <TabPrompts tabla="tipos_tarea" pkColumna="codigo_tipo_tarea" pkValor={tipoEditando.codigo_tipo_tarea}
              campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
              mostrarPromptInsert={false} mostrarPromptUpdate={false} mostrarSystemPrompt={true} mostrarPythonInsert={false} mostrarPythonUpdate={false} mostrarJavaScript={false} />
          )}
          {tabModalTipo === 'programacion_insert' && tipoEditando && (
            <TabPrompts tabla="tipos_tarea" pkColumna="codigo_tipo_tarea" pkValor={tipoEditando.codigo_tipo_tarea}
              campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptUpdate={false} mostrarPythonUpdate={false} />
          )}
          {tabModalTipo === 'programacion_update' && tipoEditando && (
            <TabPrompts tabla="tipos_tarea" pkColumna="codigo_tipo_tarea" pkValor={tipoEditando.codigo_tipo_tarea}
              campos={promptsTipo} onCampoCambiado={(c, v) => setPromptsTipo({ ...promptsTipo, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptInsert={false} mostrarPythonInsert={false} />
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
                tabla="tipos_tarea"
                pkColumna="codigo_tipo_tarea"
                pkValor={tipoEditando.codigo_tipo_tarea}
                promptInsert={promptsTipo.prompt_insert ?? undefined}
                promptUpdate={promptsTipo.prompt_update ?? undefined}
              />
            ) : undefined}
          />
        </div>
      </Modal>

      {/* Modal Estado */}
      <Modal abierto={modalEst} alCerrar={() => setModalEst(false)} titulo={estEditando ? 'Editar estado de tarea' : 'Nuevo estado de tarea'}>
        <div className="flex flex-col gap-4 min-h-[500px]">
          <div className="flex gap-1 border-b border-borde -mt-2">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as const).map((tab) => (
              <button key={tab} onClick={() => setTabModalEst(tab)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 ${tabModalEst === tab ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}>
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : 'Prog. Update'}
              </button>
            ))}
          </div>
          {tabModalEst === 'datos' && <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Categoría *</label>
              <select value={formEst.codigo_categoria_tarea}
                onChange={(e) => setFormEst({ ...formEst, codigo_categoria_tarea: e.target.value, codigo_tipo_tarea: '' })}
                disabled={!!estEditando}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60">
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => <option key={c.codigo_categoria_tarea} value={c.codigo_categoria_tarea}>{c.nombre_categoria_tarea}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Tipo *</label>
              <select value={formEst.codigo_tipo_tarea}
                onChange={(e) => setFormEst({ ...formEst, codigo_tipo_tarea: e.target.value })}
                disabled={!!estEditando}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60">
                <option value="">Seleccionar tipo...</option>
                {tipos.filter((t) => t.codigo_categoria_tarea === formEst.codigo_categoria_tarea)
                  .map((t) => <option key={t.codigo_tipo_tarea} value={t.codigo_tipo_tarea}>{t.nombre_tipo_tarea}</option>)}
              </select>
            </div>
            <Input etiqueta="Código estado *" value={formEst.codigo_estado_tarea}
              onChange={(e) => setFormEst({ ...formEst, codigo_estado_tarea: e.target.value })}
              placeholder="PENDIENTE"
              disabled={!!estEditando} />
            <Input etiqueta="Nombre *" value={formEst.nombre_estado_tarea}
              onChange={(e) => setFormEst({ ...formEst, nombre_estado_tarea: e.target.value })}
              placeholder="Pendiente" />
            <Input etiqueta="Descripción" value={formEst.descripcion_estado_tarea}
              onChange={(e) => setFormEst({ ...formEst, descripcion_estado_tarea: e.target.value })}
              placeholder="Descripción opcional" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Estado canónico *</label>
              <select value={formEst.codigo_estado_canonico}
                onChange={(e) => setFormEst({ ...formEst, codigo_estado_canonico: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario">
                <option value="">Seleccionar estado canónico...</option>
                {canonicosEst.map((c) => <option key={c.codigo_estado_canonico} value={c.codigo_estado_canonico}>{c.nombre_estado_canonico}</option>)}
              </select>
            </div>
          </>}
          {tabModalEst === 'system_prompt' && estEditando && (
            <TabPrompts tabla="estados_tarea" pkColumna="codigo_estado_tarea" pkValor={estEditando.codigo_estado_tarea}
              campos={promptsEst} onCampoCambiado={(c, v) => setPromptsEst({ ...promptsEst, [c]: v })}
              mostrarPromptInsert={false} mostrarPromptUpdate={false} mostrarSystemPrompt={true} mostrarPythonInsert={false} mostrarPythonUpdate={false} mostrarJavaScript={false} />
          )}
          {tabModalEst === 'programacion_insert' && estEditando && (
            <TabPrompts tabla="estados_tarea" pkColumna="codigo_estado_tarea" pkValor={estEditando.codigo_estado_tarea}
              campos={promptsEst} onCampoCambiado={(c, v) => setPromptsEst({ ...promptsEst, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptUpdate={false} mostrarPythonUpdate={false} />
          )}
          {tabModalEst === 'programacion_update' && estEditando && (
            <TabPrompts tabla="estados_tarea" pkColumna="codigo_estado_tarea" pkValor={estEditando.codigo_estado_tarea}
              campos={promptsEst} onCampoCambiado={(c, v) => setPromptsEst({ ...promptsEst, [c]: v })}
              mostrarSystemPrompt={false} mostrarJavaScript={false} mostrarPromptInsert={false} mostrarPythonInsert={false} />
          )}
          {errorEst && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEst}</p></div>}
          <PieBotonesModal
            editando={!!estEditando}
            onGuardar={() => guardarEstado(false)}
            onGuardarYSalir={() => guardarEstado(true)}
            onCerrar={() => setModalEst(false)}
            cargando={guardandoEst}
            botonesIzquierda={(tabModalEst === 'system_prompt' || tabModalEst === 'programacion_insert' || tabModalEst === 'programacion_update') && estEditando ? (
              <PieBotonesPrompts
                tabla="estados_tarea"
                pkColumna="codigo_estado_tarea"
                pkValor={estEditando.codigo_estado_tarea}
                promptInsert={promptsEst.prompt_insert ?? undefined}
                promptUpdate={promptsEst.prompt_update ?? undefined}
              />
            ) : undefined}
          />
        </div>
      </Modal>

      {/* Modal Tipo Canónico */}
      <Modal abierto={modalTC} alCerrar={() => setModalTC(false)} titulo={tcEditando ? 'Editar tipo canónico' : 'Nuevo tipo canónico de tarea'}>
        <div className="flex flex-col gap-4 min-w-[400px]">
          {!tcEditando && (
            <Input etiqueta="Código (dejar vacío para autogenerar)" value={formTC.codigo_tipo_canonico}
              onChange={(e) => setFormTC({ ...formTC, codigo_tipo_canonico: e.target.value })}
              placeholder="INCIDENCIA" />
          )}
          <Input etiqueta="Nombre *" value={formTC.nombre_tipo_canonico}
            onChange={(e) => setFormTC({ ...formTC, nombre_tipo_canonico: e.target.value })}
            placeholder="Incidencia" />
          <Textarea etiqueta="Descripción" value={formTC.descripcion_tipo_canonico}
            onChange={(e) => setFormTC({ ...formTC, descripcion_tipo_canonico: e.target.value })}
            placeholder="Descripción opcional"
            rows={3} />
          {errorTC && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorTC}</p></div>}
          <PieBotonesModal
            editando={!!tcEditando}
            onGuardar={() => guardarTC(false)}
            onGuardarYSalir={() => guardarTC(true)}
            onCerrar={() => setModalTC(false)}
            cargando={guardandoTC}
          />
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <ModalConfirmar
        abierto={!!itemAEliminar}
        alCerrar={() => setItemAEliminar(null)}
        alConfirmar={ejecutarEliminacion}
        titulo={
          itemAEliminar?.tipo === 'categoria' ? 'Eliminar categoría' :
          itemAEliminar?.tipo === 'tipotarea' ? 'Eliminar tipo de tarea' :
          itemAEliminar?.tipo === 'tipocanonico' ? 'Eliminar tipo canónico' : 'Eliminar estado de tarea'
        }
        mensaje={
          itemAEliminar?.tipo === 'categoria'
            ? `¿Eliminar la categoría "${(itemAEliminar.item as CategoriaTarea).nombre_categoria_tarea}"? Solo posible si no tiene tipos asociados.`
            : itemAEliminar?.tipo === 'tipotarea'
            ? `¿Eliminar el tipo "${(itemAEliminar.item as TipoTarea).nombre_tipo_tarea}"? Solo posible si no tiene estados asociados.`
            : itemAEliminar?.tipo === 'tipocanonico'
            ? `¿Eliminar el tipo canónico "${(itemAEliminar.item as TipoCanonicoTarea).nombre_tipo_canonico}"?`
            : `¿Eliminar el estado "${(itemAEliminar?.item as EstadoTarea)?.nombre_estado_tarea}"?`
        }
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </div>
  )
}
