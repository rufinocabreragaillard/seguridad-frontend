'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search, Eye } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { procesosDatosBasicosApi, tareasDatosBasicosApi, funcionesApi, promptsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { CategoriaProceso, TipoProceso, EstadoProceso, EstadoCanonicalProceso, Funcion } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { BotonChat } from '@/components/ui/boton-chat'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'

type TabId = 'categorias' | 'tipos' | 'estados' | 'canonicos'
type TabModal = 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'

const TABS_MODAL_LABELS: Record<TabModal, string> = {
  datos: 'Datos',
  system_prompt: 'System Prompt',
  programacion_insert: 'Prog. Insert',
  programacion_update: 'Prog. Update',
  md: '.md',
}

type ItemEliminar =
  | { tipo: 'categoria'; item: CategoriaProceso }
  | { tipo: 'tipo'; item: TipoProceso }
  | { tipo: 'estado'; item: EstadoProceso }
  | { tipo: 'canonico'; item: EstadoCanonicalProceso }

export default function PaginaProcesosDatosBasicos() {
  const { aplicacionActiva } = useAuth()
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaProceso[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [modalCat, setModalCat] = useState(false)
  const [tabModalCat, setTabModalCat] = useState<TabModal>('datos')
  const [catEditando, setCatEditando] = useState<CategoriaProceso | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_categoria_proceso: '', nombre_categoria_proceso: '', descripcion_categoria_proceso: '', alias: '',
    prompt_insert: '', prompt_update: '', system_prompt: '',
    python_insert: '', python_update: '', javascript: '',
    python_editado_manual: false, javascript_editado_manual: false,
    md: '',
  })
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')
  const [generandoMdCat, setGenerandoMdCat] = useState(false)
  const [sincronizandoMdCat, setSincronizandoMdCat] = useState(false)
  const [mensajeMdCat, setMensajeMdCat] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoProceso[]>([])
  const [cargandoTipo, setCargandoTipo] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tabModalTipo, setTabModalTipo] = useState<TabModal>('datos')
  const [tipoEditando, setTipoEditando] = useState<TipoProceso | null>(null)
  const [formTipo, setFormTipo] = useState({
    codigo_categoria_proceso: '', codigo_tipo_proceso: '', nombre_tipo_proceso: '', descripcion_tipo_proceso: '', alias: '',
    prompt_insert: '', prompt_update: '', system_prompt: '',
    python_insert: '', python_update: '', javascript: '',
    python_editado_manual: false, javascript_editado_manual: false,
    orden: '', ayuda: '', traducir: true, tipo: 'USUARIO',
    md: '',
    created_at: '', updated_at: '',
  })
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [generandoMdTipo, setGenerandoMdTipo] = useState(false)
  const [sincronizandoMdTipo, setSincronizandoMdTipo] = useState(false)
  const [mensajeMdTipo, setMensajeMdTipo] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busquedaCat, setBusquedaCat] = useState('')
  const [mostrarListaCat, setMostrarListaCat] = useState(false)
  const [busquedaTipo, setBusquedaTipo] = useState('')
  const [mostrarListaTipo, setMostrarListaTipo] = useState(false)

  // ── Estados ────────────────────────────────────────────────────────────────
  const [estados, setEstados] = useState<EstadoProceso[]>([])
  const [cargandoEst, setCargandoEst] = useState(true)
  const [modalEst, setModalEst] = useState(false)
  const [tabModalEst, setTabModalEst] = useState<TabModal>('datos')
  const [estEditando, setEstEditando] = useState<EstadoProceso | null>(null)
  const [formEst, setFormEst] = useState<{
    codigo_categoria_proceso: string
    codigo_tipo_proceso: string
    codigo_estado_proceso: string
    nombre_estado: string
    secuencia: number
    prompt_insert: string
    prompt_update: string
    system_prompt: string
    python_insert: string
    python_update: string
    javascript: string
    python_editado_manual: boolean
    javascript_editado_manual: boolean
    ayuda: string
    traducir: boolean
    md: string
  }>({
    codigo_categoria_proceso: '', codigo_tipo_proceso: '', codigo_estado_proceso: '',
    nombre_estado: '', secuencia: 0,
    prompt_insert: '', prompt_update: '', system_prompt: '',
    python_insert: '', python_update: '', javascript: '',
    python_editado_manual: false, javascript_editado_manual: false,
    ayuda: '', traducir: false,
    md: '',
  })
  const [guardandoEst, setGuardandoEst] = useState(false)
  const [errorEst, setErrorEst] = useState('')
  const [generandoMdEst, setGenerandoMdEst] = useState(false)
  const [sincronizandoMdEst, setSincronizandoMdEst] = useState(false)
  const [mensajeMdEst, setMensajeMdEst] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [funciones, setFunciones] = useState<Funcion[]>([])

  // ── Canónicos ──────────────────────────────────────────────────────────────
  const [canonicos, setCanonicos] = useState<EstadoCanonicalProceso[]>([])
  const [cargandoCan, setCargandoCan] = useState(true)
  const [modalCan, setModalCan] = useState(false)
  const [canEditando, setCanEditando] = useState<EstadoCanonicalProceso | null>(null)
  const [formCan, setFormCan] = useState({ codigo_estado_canonico: '', nombre: '' })
  const [guardandoCan, setGuardandoCan] = useState(false)
  const [errorCan, setErrorCan] = useState('')
  const [busquedaCan, setBusquedaCan] = useState('')

  // ── Eliminación ────────────────────────────────────────────────────────────
  const [itemAEliminar, setItemAEliminar] = useState<ItemEliminar | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarCategorias = useCallback(async () => {
    setCargandoCat(true)
    try { setCategorias(await procesosDatosBasicosApi.listarCategorias()) }
    finally { setCargandoCat(false) }
  }, [])

  const cargarTipos = useCallback(async () => {
    setCargandoTipo(true)
    try { setTipos(await procesosDatosBasicosApi.listarTipos()) }
    finally { setCargandoTipo(false) }
  }, [])

  const cargarEstados = useCallback(async () => {
    setCargandoEst(true)
    try { setEstados(await procesosDatosBasicosApi.listarEstados()) }
    finally { setCargandoEst(false) }
  }, [])

  const cargarCanonicos = useCallback(async () => {
    setCargandoCan(true)
    try { setCanonicos(await tareasDatosBasicosApi.listarCanonicosPro()) }
    finally { setCargandoCan(false) }
  }, [])

  useEffect(() => { cargarCategorias() }, [cargarCategorias])
  useEffect(() => { cargarTipos() }, [cargarTipos])
  useEffect(() => { cargarEstados() }, [cargarEstados])
  useEffect(() => { cargarCanonicos() }, [cargarCanonicos])
  useEffect(() => { funcionesApi.listar().then(setFunciones).catch(() => setFunciones([])) }, [])

  // ── CRUD Categorías ────────────────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({
      codigo_categoria_proceso: '', nombre_categoria_proceso: '', descripcion_categoria_proceso: '', alias: '',
      prompt_insert: '', prompt_update: '', system_prompt: '',
      python_insert: '', python_update: '', javascript: '',
      python_editado_manual: false, javascript_editado_manual: false,
      md: '',
    })
    setTabModalCat('datos')
    setErrorCat('')
    setMensajeMdCat(null)
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaProceso) => {
    const c2 = c as unknown as Record<string, unknown>
    setCatEditando(c)
    setFormCat({
      codigo_categoria_proceso: c.codigo_categoria_proceso,
      nombre_categoria_proceso: c.nombre_categoria_proceso,
      descripcion_categoria_proceso: c.descripcion_categoria_proceso || '',
      alias: c.alias || '',
      prompt_insert: c.prompt_insert || '',
      prompt_update: c.prompt_update || '',
      system_prompt: c.system_prompt || '',
      python_insert: (c2.python_insert as string) || '',
      python_update: (c2.python_update as string) || '',
      javascript: (c2.javascript as string) || '',
      python_editado_manual: (c2.python_editado_manual as boolean) || false,
      javascript_editado_manual: (c2.javascript_editado_manual as boolean) || false,
      md: (c2.md as string) || '',
    })
    setTabModalCat('datos')
    setErrorCat('')
    setMensajeMdCat(null)
    setModalCat(true)
  }

  const guardarCategoria = async (cerrar = true) => {
    if (!formCat.nombre_categoria_proceso) { setErrorCat('El nombre es obligatorio'); return }
    setGuardandoCat(true); setErrorCat('')
    try {
      if (catEditando) {
        await procesosDatosBasicosApi.actualizarCategoria(catEditando.codigo_categoria_proceso, {
          nombre_categoria_proceso: formCat.nombre_categoria_proceso,
          descripcion_categoria_proceso: formCat.descripcion_categoria_proceso || undefined,
          alias: formCat.alias || undefined,
          prompt_insert: formCat.prompt_insert || undefined,
          prompt_update: formCat.prompt_update || undefined,
          system_prompt: formCat.system_prompt || undefined,
        })
      } else {
        await procesosDatosBasicosApi.crearCategoria({
          codigo_categoria_proceso: formCat.codigo_categoria_proceso || undefined,
          nombre_categoria_proceso: formCat.nombre_categoria_proceso,
          descripcion_categoria_proceso: formCat.descripcion_categoria_proceso || undefined,
          alias: formCat.alias || undefined,
          prompt_insert: formCat.prompt_insert || undefined,
          prompt_update: formCat.prompt_update || undefined,
          system_prompt: formCat.system_prompt || undefined,
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
    setFormTipo({
      codigo_categoria_proceso: filtroCategoria || '',
      codigo_tipo_proceso: '', nombre_tipo_proceso: '', descripcion_tipo_proceso: '', alias: '',
      prompt_insert: '', prompt_update: '', system_prompt: '',
      python_insert: '', python_update: '', javascript: '',
      python_editado_manual: false, javascript_editado_manual: false,
      orden: '', ayuda: '', traducir: true, tipo: 'USUARIO',
      md: '',
      created_at: '', updated_at: '',
    })
    setTabModalTipo('datos')
    setErrorTipo('')
    setMensajeMdTipo(null)
    setModalTipo(true)
  }

  const abrirEditarTipo = (t: TipoProceso) => {
    const t2 = t as unknown as Record<string, unknown>
    setTipoEditando(t)
    setFormTipo({
      codigo_categoria_proceso: t.codigo_categoria_proceso,
      codigo_tipo_proceso: t.codigo_tipo_proceso,
      nombre_tipo_proceso: t.nombre_tipo_proceso,
      descripcion_tipo_proceso: t.descripcion_tipo_proceso || '',
      alias: t.alias || '',
      prompt_insert: t.prompt_insert || '',
      prompt_update: t.prompt_update || '',
      system_prompt: t.system_prompt || '',
      python_insert: (t2.python_insert as string) || '',
      python_update: (t2.python_update as string) || '',
      javascript: (t2.javascript as string) || '',
      python_editado_manual: (t2.python_editado_manual as boolean) || false,
      javascript_editado_manual: (t2.javascript_editado_manual as boolean) || false,
      orden: t.orden != null ? String(t.orden) : '',
      ayuda: t.ayuda || '',
      traducir: t.traducir ?? true,
      tipo: t.tipo || 'USUARIO',
      md: (t2.md as string) || '',
      created_at: t.created_at || '',
      updated_at: t.updated_at || '',
    })
    setTabModalTipo('datos')
    setErrorTipo('')
    setMensajeMdTipo(null)
    setModalTipo(true)
  }

  const reordenarCategorias = async (nuevos: CategoriaProceso[]) => {
    const nuevosConOrden = nuevos.map((c, idx) => ({ ...c, orden: idx + 1 }))
    setCategorias(nuevosConOrden)
    try {
      await procesosDatosBasicosApi.reordenarCategorias(
        nuevosConOrden.map((c) => ({
          codigo_categoria_proceso: c.codigo_categoria_proceso,
          orden: c.orden ?? 0,
        }))
      )
    } catch { cargarCategorias() }
  }

  const reordenarTipos = async (nuevos: TipoProceso[]) => {
    const resto = tipos.filter((t) => t.codigo_categoria_proceso !== filtroCategoria)
    const nuevosConOrden = nuevos.map((t, idx) => ({ ...t, orden: idx + 1 }))
    setTipos([...resto, ...nuevosConOrden])
    try {
      await procesosDatosBasicosApi.reordenarTipos(
        nuevosConOrden.map((t) => ({
          codigo_categoria_proceso: t.codigo_categoria_proceso,
          codigo_tipo_proceso: t.codigo_tipo_proceso,
          orden: t.orden ?? 0,
        }))
      )
    } catch { cargarTipos() }
  }

  const reordenarEstados = async (nuevos: EstadoProceso[]) => {
    const resto = estados.filter(
      (e) => e.codigo_categoria_proceso !== filtroCategoria || e.codigo_tipo_proceso !== filtroTipo
    )
    const nuevosConOrden = nuevos.map((e, idx) => ({ ...e, orden: idx + 1 }))
    setEstados([...resto, ...nuevosConOrden])
    try {
      await procesosDatosBasicosApi.reordenarEstados(
        nuevosConOrden.map((e) => ({
          codigo_categoria_proceso: e.codigo_categoria_proceso,
          codigo_tipo_proceso: e.codigo_tipo_proceso,
          codigo_estado_proceso: e.codigo_estado_proceso,
          orden: e.orden ?? 0,
        }))
      )
    } catch { cargarEstados() }
  }

  const reordenarCanonicos = async (nuevos: EstadoCanonicalProceso[]) => {
    const nuevosConOrden = nuevos.map((c, idx) => ({ ...c, orden: idx + 1 }))
    setCanonicos(nuevosConOrden)
    try {
      await tareasDatosBasicosApi.reordenarCanonicosPro(
        nuevosConOrden.map((c) => ({ codigo_estado_canonico: c.codigo_estado_canonico, orden: c.orden ?? 0 }))
      )
    } catch { cargarCanonicos() }
  }

  const guardarTipo = async (cerrar = true) => {
    if (!formTipo.codigo_categoria_proceso || !formTipo.nombre_tipo_proceso) {
      setErrorTipo('La categoría y el nombre son obligatorios'); return
    }
    setGuardandoTipo(true); setErrorTipo('')
    try {
      if (tipoEditando) {
        await procesosDatosBasicosApi.actualizarTipo(
          tipoEditando.codigo_categoria_proceso, tipoEditando.codigo_tipo_proceso,
          {
            nombre_tipo_proceso: formTipo.nombre_tipo_proceso,
            descripcion_tipo_proceso: formTipo.descripcion_tipo_proceso || undefined,
            alias: formTipo.alias || undefined,
            prompt_insert: formTipo.prompt_insert || undefined,
            prompt_update: formTipo.prompt_update || undefined,
            system_prompt: formTipo.system_prompt || undefined,
          }
        )
      } else {
        await procesosDatosBasicosApi.crearTipo({
          codigo_categoria_proceso: formTipo.codigo_categoria_proceso,
          codigo_tipo_proceso: formTipo.codigo_tipo_proceso || undefined,
          nombre_tipo_proceso: formTipo.nombre_tipo_proceso,
          descripcion_tipo_proceso: formTipo.descripcion_tipo_proceso || undefined,
          alias: formTipo.alias || undefined,
          prompt_insert: formTipo.prompt_insert || undefined,
          prompt_update: formTipo.prompt_update || undefined,
          system_prompt: formTipo.system_prompt || undefined,
        })
      }
      if (cerrar) {
        setModalTipo(false)
      } else if (!tipoEditando) {
        setFormTipo({
          codigo_categoria_proceso: formTipo.codigo_categoria_proceso,
          codigo_tipo_proceso: '', nombre_tipo_proceso: '', descripcion_tipo_proceso: '',
          alias: '', prompt_insert: '', prompt_update: '', system_prompt: '',
          python_insert: '', python_update: '', javascript: '',
          python_editado_manual: false, javascript_editado_manual: false,
          orden: '', ayuda: '', traducir: true, tipo: 'USUARIO',
          md: '', created_at: '', updated_at: '',
        })
      }
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setGuardandoTipo(false) }
  }

  // ── CRUD Estados ───────────────────────────────────────────────────────────
  const abrirNuevoEst = () => {
    setEstEditando(null)
    setFormEst({
      codigo_categoria_proceso: filtroCategoria || '',
      codigo_tipo_proceso: filtroTipo || '',
      codigo_estado_proceso: '',
      nombre_estado: '', secuencia: 0,
      prompt_insert: '', prompt_update: '', system_prompt: '',
      python_insert: '', python_update: '', javascript: '',
      python_editado_manual: false, javascript_editado_manual: false,
      ayuda: '', traducir: false,
      md: '',
    })
    setTabModalEst('datos')
    setErrorEst('')
    setMensajeMdEst(null)
    setModalEst(true)
  }

  const abrirEditarEst = (e: EstadoProceso) => {
    const e2 = e as unknown as Record<string, unknown>
    setEstEditando(e)
    setFormEst({
      codigo_categoria_proceso: e.codigo_categoria_proceso,
      codigo_tipo_proceso: e.codigo_tipo_proceso,
      codigo_estado_proceso: e.codigo_estado_proceso,
      nombre_estado: e.nombre_estado,
      secuencia: e.secuencia,
      prompt_insert: e.prompt_insert || '',
      prompt_update: e.prompt_update || '',
      system_prompt: e.system_prompt || '',
      python_insert: (e2.python_insert as string) || '',
      python_update: (e2.python_update as string) || '',
      javascript: (e2.javascript as string) || '',
      python_editado_manual: (e2.python_editado_manual as boolean) || false,
      javascript_editado_manual: (e2.javascript_editado_manual as boolean) || false,
      md: (e2.md as string) || '',
      ayuda: e.ayuda || '',
      traducir: e.traducir,
    })
    setTabModalEst('datos')
    setErrorEst('')
    setMensajeMdEst(null)
    setModalEst(true)
  }

  const guardarEstado = async (cerrar = true) => {
    if (!formEst.codigo_categoria_proceso || !formEst.codigo_tipo_proceso || !formEst.nombre_estado) {
      setErrorEst('Categoría, tipo y nombre son obligatorios'); return
    }
    setGuardandoEst(true); setErrorEst('')
    try {
      if (estEditando) {
        await procesosDatosBasicosApi.actualizarEstado(
          estEditando.codigo_categoria_proceso, estEditando.codigo_tipo_proceso, estEditando.codigo_estado_proceso,
          {
            nombre_estado: formEst.nombre_estado,
            secuencia: formEst.secuencia,
            prompt_insert: formEst.prompt_insert || undefined,
            prompt_update: formEst.prompt_update || undefined,
            system_prompt: formEst.system_prompt || undefined,
            ayuda: formEst.ayuda || undefined,
            traducir: formEst.traducir,
          }
        )
      } else {
        await procesosDatosBasicosApi.crearEstado({
          codigo_categoria_proceso: formEst.codigo_categoria_proceso,
          codigo_tipo_proceso: formEst.codigo_tipo_proceso,
          codigo_estado_proceso: formEst.codigo_estado_proceso || undefined,
          nombre_estado: formEst.nombre_estado,
          secuencia: formEst.secuencia,
          prompt_insert: formEst.prompt_insert || undefined,
          prompt_update: formEst.prompt_update || undefined,
          system_prompt: formEst.system_prompt || undefined,
          ayuda: formEst.ayuda || undefined,
          traducir: formEst.traducir,
        })
      }
      if (cerrar) setModalEst(false)
      cargarEstados()
    } catch (e) {
      setErrorEst(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setGuardandoEst(false) }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  const ejecutarEliminacion = async () => {
    if (!itemAEliminar) return
    setEliminando(true)
    try {
      if (itemAEliminar.tipo === 'categoria') {
        await procesosDatosBasicosApi.eliminarCategoria((itemAEliminar.item as CategoriaProceso).codigo_categoria_proceso)
        cargarCategorias()
      } else if (itemAEliminar.tipo === 'tipo') {
        const t = itemAEliminar.item as TipoProceso
        await procesosDatosBasicosApi.eliminarTipo(t.codigo_categoria_proceso, t.codigo_tipo_proceso)
        cargarTipos()
      } else if (itemAEliminar.tipo === 'estado') {
        const e = itemAEliminar.item as EstadoProceso
        await procesosDatosBasicosApi.eliminarEstado(e.codigo_categoria_proceso, e.codigo_tipo_proceso, e.codigo_estado_proceso)
        cargarEstados()
      } else {
        await tareasDatosBasicosApi.eliminarCanonicosPro((itemAEliminar.item as EstadoCanonicalProceso).codigo_estado_canonico)
        cargarCanonicos()
      }
      setItemAEliminar(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
      setItemAEliminar(null)
    } finally { setEliminando(false) }
  }

  // ── CRUD Canónicos ─────────────────────────────────────────────────────────
  const abrirNuevoCan = () => {
    setCanEditando(null)
    setFormCan({ codigo_estado_canonico: '', nombre: '' })
    setErrorCan('')
    setModalCan(true)
  }

  const abrirEditarCan = (c: EstadoCanonicalProceso) => {
    setCanEditando(c)
    setFormCan({ codigo_estado_canonico: c.codigo_estado_canonico, nombre: c.nombre })
    setErrorCan('')
    setModalCan(true)
  }

  const guardarCanonico = async (cerrar = true) => {
    if (!formCan.nombre.trim()) { setErrorCan('El nombre es obligatorio'); return }
    if (!canEditando && !formCan.codigo_estado_canonico.trim()) { setErrorCan('El código es obligatorio'); return }
    setGuardandoCan(true); setErrorCan('')
    try {
      if (canEditando) {
        await tareasDatosBasicosApi.actualizarCanonicosPro(canEditando.codigo_estado_canonico, { nombre: formCan.nombre.trim() })
      } else {
        await tareasDatosBasicosApi.crearCanonicosPro({
          codigo_estado_canonico: formCan.codigo_estado_canonico.trim(),
          nombre: formCan.nombre.trim(),
        })
      }
      if (cerrar) setModalCan(false)
      cargarCanonicos()
    } catch (e) {
      setErrorCan(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setGuardandoCan(false) }
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const tiposFiltrados = filtroCategoria
    ? tipos
        .filter((t) => t.codigo_categoria_proceso === filtroCategoria)
        .slice()
        .sort((a, b) => {
          const oa = a.orden ?? 99, ob = b.orden ?? 99
          if (oa !== ob) return oa - ob
          return a.nombre_tipo_proceso.localeCompare(b.nombre_tipo_proceso, 'es')
        })
    : []

  const categoriaSel = categorias.find((c) => c.codigo_categoria_proceso === filtroCategoria) || null
  const categoriasSug = !busquedaCat.trim()
    ? categorias
    : categorias.filter((c) =>
        c.nombre_categoria_proceso.toLowerCase().includes(busquedaCat.toLowerCase()) ||
        (c.alias || '').toLowerCase().includes(busquedaCat.toLowerCase())
      )

  const estadosFiltrados = (filtroCategoria && filtroTipo)
    ? estados
        .filter((e) => e.codigo_categoria_proceso === filtroCategoria && e.codigo_tipo_proceso === filtroTipo)
        .slice()
        .sort((a, b) => {
          const oa = a.orden ?? 99, ob = b.orden ?? 99
          if (oa !== ob) return oa - ob
          return a.secuencia - b.secuencia
        })
    : []

  const tiposDeCateg = tipos.filter((t) => t.codigo_categoria_proceso === filtroCategoria)
  const tipoSel = tiposDeCateg.find((t) => t.codigo_tipo_proceso === filtroTipo) || null
  const tiposSug = !busquedaTipo.trim()
    ? tiposDeCateg
    : tiposDeCateg.filter((t) =>
        t.nombre_tipo_proceso.toLowerCase().includes(busquedaTipo.toLowerCase()) ||
        (t.alias || '').toLowerCase().includes(busquedaTipo.toLowerCase())
      )

  const funcionesFiltradas = aplicacionActiva
    ? [...funciones].filter((f) => f.codigo_aplicacion_origen === aplicacionActiva).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    : [...funciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const canonicosFiltrados = busquedaCan
    ? canonicos.filter((c) =>
        c.codigo_estado_canonico.toLowerCase().includes(busquedaCan.toLowerCase()) ||
        c.nombre.toLowerCase().includes(busquedaCan.toLowerCase())
      )
    : canonicos

  const selectCls = 'rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'
  const tabCls = (id: TabId) =>
    `px-5 py-2.5 text-sm font-medium transition-colors ${tabActiva === id ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`
  const tabModalCls = (activa: string, id: string) =>
    `flex-1 text-center px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${activa === id ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`
  const textareaCls = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />

      <div className="pr-28">
        <h2 className="page-heading">Datos Básicos de Procesos</h2>
        <p className="text-sm text-texto-muted mt-1">Configuración de categorías, tipos y estados de proceso</p>
      </div>

      {/* Pestañas */}
      <div className="flex border-b border-borde gap-1">
        <button onClick={() => setTabActiva('categorias')} className={tabCls('categorias')}>Categorías de Proceso</button>
        <button onClick={() => setTabActiva('tipos')} className={tabCls('tipos')}>Tipos de Proceso</button>
        <button onClick={() => setTabActiva('estados')} className={tabCls('estados')}>Estados de Proceso</button>
        <button onClick={() => setTabActiva('canonicos')} className={tabCls('canonicos')}>Estados Canónicos</button>
      </div>

      {/* ── Tab: Categorías ── */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">Categorías globales de proceso</p>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(categorias as unknown as Record<string, unknown>[], [
                  { titulo: 'Código', campo: 'codigo_categoria_proceso' },
                  { titulo: 'Nombre', campo: 'nombre_categoria_proceso' },
                  { titulo: 'Descripción', campo: 'descripcion_categoria_proceso' },
                  { titulo: 'Alias', campo: 'alias' },
                ], 'categorias_proceso')}
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
              getId={(c) => (c as unknown as CategoriaProceso).codigo_categoria_proceso}
              onReorder={(n) => reordenarCategorias(n as unknown as CategoriaProceso[])}
            >
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-8" />
                  <TablaTh className="w-16 text-center">Orden</TablaTh>
                  <TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh><TablaTh>Alias</TablaTh>
                  <TablaTh className="w-48">Código</TablaTh>
                  <TablaTh className="text-right w-28">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {categorias.map((c) => (
                    <SortableRow key={c.codigo_categoria_proceso} id={c.codigo_categoria_proceso}
                      onDoubleClick={() => { setFiltroCategoria(c.codigo_categoria_proceso); setTabActiva('tipos') }}
                    >
                      <TablaTd className="text-center text-texto-muted text-sm">{c.orden ?? '—'}</TablaTd>
                      <TablaTd className="font-medium">{c.nombre_categoria_proceso}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">{c.descripcion_categoria_proceso || <span className="text-texto-light">—</span>}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">{c.alias || <span className="text-texto-light">—</span>}</TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.codigo_categoria_proceso}</code></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setFiltroCategoria(c.codigo_categoria_proceso); setTabActiva('tipos') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver tipos"><Eye size={14} /></button>
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
            <div className="flex items-center gap-3 flex-1">
              <p className="text-sm text-texto-muted whitespace-nowrap">Categoría:</p>
              <div className="relative max-w-md flex-1">
                <Input
                  placeholder="Buscar y seleccionar categoría..."
                  value={mostrarListaCat ? busquedaCat : (categoriaSel?.nombre_categoria_proceso || '')}
                  onChange={(e) => { setBusquedaCat(e.target.value); setMostrarListaCat(true) }}
                  onFocus={() => { setMostrarListaCat(true); setBusquedaCat('') }}
                  onBlur={() => setTimeout(() => setMostrarListaCat(false), 150)}
                  icono={<Search size={15} />}
                />
                {mostrarListaCat && categoriasSug.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-surface border border-borde rounded-lg shadow-lg">
                    {filtroCategoria && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setFiltroCategoria(''); setFiltroTipo(''); setMostrarListaCat(false); setBusquedaCat('') }}
                        className="block w-full text-left px-3 py-2 hover:bg-primario-muy-claro text-sm text-texto-muted border-b border-borde"
                      >
                        (limpiar selección)
                      </button>
                    )}
                    {categoriasSug.map((c) => (
                      <button
                        key={c.codigo_categoria_proceso}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setFiltroCategoria(c.codigo_categoria_proceso); setFiltroTipo(''); setMostrarListaCat(false); setBusquedaCat('') }}
                        className={`block w-full text-left px-3 py-2 hover:bg-primario-muy-claro text-sm ${c.codigo_categoria_proceso === filtroCategoria ? 'bg-primario-muy-claro text-primario font-medium' : ''}`}
                      >
                        {c.nombre_categoria_proceso}
                        {c.alias && <span className="text-texto-muted text-xs ml-2">({c.alias})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(tiposFiltrados as unknown as Record<string, unknown>[], [
                  { titulo: 'Orden', campo: 'orden' },
                  { titulo: 'Categoría', campo: 'codigo_categoria_proceso' },
                  { titulo: 'Código tipo', campo: 'codigo_tipo_proceso' },
                  { titulo: 'Nombre', campo: 'nombre_tipo_proceso' },
                  { titulo: 'Descripción', campo: 'descripcion_tipo_proceso' },
                ], 'tipos_proceso')}
                disabled={tiposFiltrados.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoTipo}><Plus size={16} /> Nuevo tipo</Boton>
            </div>
          </div>

          {!filtroCategoria ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">
              Selecciona una categoría para ver sus tipos de proceso
            </div>
          ) : cargandoTipo ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : tiposFiltrados.length === 0 ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">
              No hay tipos registrados en esta categoría
            </div>
          ) : (
            <SortableDndContext
              items={tiposFiltrados as unknown as Record<string, unknown>[]}
              getId={(t) => `${(t as unknown as TipoProceso).codigo_categoria_proceso}/${(t as unknown as TipoProceso).codigo_tipo_proceso}`}
              onReorder={(n) => reordenarTipos(n as unknown as TipoProceso[])}
            >
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-8" />
                  <TablaTh className="w-16 text-center">Orden</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Descripción</TablaTh>
                  <TablaTh className="w-40">Código</TablaTh>
                  <TablaTh className="text-right w-28">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {tiposFiltrados.map((t) => (
                    <SortableRow key={`${t.codigo_categoria_proceso}/${t.codigo_tipo_proceso}`} id={`${t.codigo_categoria_proceso}/${t.codigo_tipo_proceso}`} onDoubleClick={() => { setFiltroTipo(t.codigo_tipo_proceso); setTabActiva('estados') }}>
                      <TablaTd className="text-center text-texto-muted text-sm">{t.orden ?? '—'}</TablaTd>
                      <TablaTd className="font-medium">{t.nombre_tipo_proceso}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">{t.descripcion_tipo_proceso || <span className="text-texto-light">—</span>}</TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.codigo_tipo_proceso}</code></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setFiltroTipo(t.codigo_tipo_proceso); setTabActiva('estados') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver estados"><Eye size={14} /></button>
                          <button onClick={() => abrirEditarTipo(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => setItemAEliminar({ tipo: 'tipo', item: t })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
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
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <p className="text-sm text-texto-muted whitespace-nowrap">Categoría:</p>
              <div className="relative max-w-xs flex-1">
                <Input
                  placeholder="Buscar categoría..."
                  value={mostrarListaCat ? busquedaCat : (categoriaSel?.nombre_categoria_proceso || '')}
                  onChange={(e) => { setBusquedaCat(e.target.value); setMostrarListaCat(true) }}
                  onFocus={() => { setMostrarListaCat(true); setBusquedaCat('') }}
                  onBlur={() => setTimeout(() => setMostrarListaCat(false), 150)}
                  icono={<Search size={15} />}
                />
                {mostrarListaCat && categoriasSug.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-borde rounded-lg shadow-lg">
                    {filtroCategoria && (
                      <button type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setFiltroCategoria(''); setFiltroTipo(''); setMostrarListaCat(false); setBusquedaCat('') }}
                        className="block w-full text-left px-3 py-2 hover:bg-primario-muy-claro text-sm text-texto-muted border-b border-borde">
                        (limpiar selección)
                      </button>
                    )}
                    {categoriasSug.map((c) => (
                      <button key={c.codigo_categoria_proceso} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setFiltroCategoria(c.codigo_categoria_proceso); setFiltroTipo(''); setMostrarListaCat(false); setBusquedaCat('') }}
                        className={`block w-full text-left px-3 py-2 hover:bg-primario-muy-claro text-sm ${c.codigo_categoria_proceso === filtroCategoria ? 'bg-primario-muy-claro text-primario font-medium' : ''}`}>
                        {c.nombre_categoria_proceso}
                        {c.alias && <span className="text-texto-muted text-xs ml-2">({c.alias})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {filtroCategoria && (
                <>
                  <p className="text-sm text-texto-muted whitespace-nowrap">Tipo:</p>
                  <div className="relative max-w-xs flex-1">
                    <Input
                      placeholder="Buscar tipo..."
                      value={mostrarListaTipo ? busquedaTipo : (tipoSel?.nombre_tipo_proceso || '')}
                      onChange={(e) => { setBusquedaTipo(e.target.value); setMostrarListaTipo(true) }}
                      onFocus={() => { setMostrarListaTipo(true); setBusquedaTipo('') }}
                      onBlur={() => setTimeout(() => setMostrarListaTipo(false), 150)}
                      icono={<Search size={15} />}
                    />
                    {mostrarListaTipo && tiposSug.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-borde rounded-lg shadow-lg">
                        {filtroTipo && (
                          <button type="button" onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setFiltroTipo(''); setMostrarListaTipo(false); setBusquedaTipo('') }}
                            className="block w-full text-left px-3 py-2 hover:bg-primario-muy-claro text-sm text-texto-muted border-b border-borde">
                            (limpiar selección)
                          </button>
                        )}
                        {tiposSug.map((t) => (
                          <button key={t.codigo_tipo_proceso} type="button" onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setFiltroTipo(t.codigo_tipo_proceso); setMostrarListaTipo(false); setBusquedaTipo('') }}
                            className={`block w-full text-left px-3 py-2 hover:bg-primario-muy-claro text-sm ${t.codigo_tipo_proceso === filtroTipo ? 'bg-primario-muy-claro text-primario font-medium' : ''}`}>
                            {t.nombre_tipo_proceso}
                            {t.alias && <span className="text-texto-muted text-xs ml-2">({t.alias})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(estadosFiltrados as unknown as Record<string, unknown>[], [
                  { titulo: 'Orden', campo: 'orden' },
                  { titulo: 'Categoría', campo: 'codigo_categoria_proceso' },
                  { titulo: 'Tipo', campo: 'codigo_tipo_proceso' },
                  { titulo: 'Código estado', campo: 'codigo_estado_proceso' },
                  { titulo: 'Nombre', campo: 'nombre_estado' },
                  { titulo: 'Secuencia', campo: 'secuencia' },
                  { titulo: 'Traducir', campo: 'traducir', formato: (v) => v ? 'Sí' : 'No' },
                ], 'estados_proceso')}
                disabled={estadosFiltrados.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoEst}><Plus size={16} /> Nuevo estado</Boton>
            </div>
          </div>

          {!filtroCategoria || !filtroTipo ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">
              {!filtroCategoria ? 'Selecciona una categoría y un tipo para ver sus estados' : 'Selecciona un tipo de proceso para ver sus estados'}
            </div>
          ) : cargandoEst ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : estadosFiltrados.length === 0 ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">
              No hay estados registrados para este tipo de proceso
            </div>
          ) : (
            <SortableDndContext
              items={estadosFiltrados as unknown as Record<string, unknown>[]}
              getId={(e) => `${(e as unknown as EstadoProceso).codigo_categoria_proceso}/${(e as unknown as EstadoProceso).codigo_tipo_proceso}/${(e as unknown as EstadoProceso).codigo_estado_proceso}`}
              onReorder={(n) => reordenarEstados(n as unknown as EstadoProceso[])}
            >
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-8" />
                  <TablaTh className="w-16 text-center">Orden</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh className="w-36">Código</TablaTh>
                  <TablaTh className="text-right w-24">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {estadosFiltrados.map((e) => (
                    <SortableRow key={`${e.codigo_categoria_proceso}/${e.codigo_tipo_proceso}/${e.codigo_estado_proceso}`} id={`${e.codigo_categoria_proceso}/${e.codigo_tipo_proceso}/${e.codigo_estado_proceso}`}>
                      <TablaTd className="text-center text-texto-muted text-sm">{e.orden ?? '—'}</TablaTd>
                      <TablaTd className="font-medium">{e.nombre_estado}</TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_estado_proceso}</code></TablaTd>
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

      {/* ── Tab: Canónicos ── */}
      {tabActiva === 'canonicos' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={busquedaCan}
                onChange={(e) => setBusquedaCan(e.target.value)}
                placeholder="Buscar estado canónico..."
                className={selectCls + ' w-64'}
              />
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(canonicosFiltrados as unknown as Record<string, unknown>[], [
                  { titulo: 'Orden', campo: 'orden' },
                  { titulo: 'Código', campo: 'codigo_estado_canonico' },
                  { titulo: 'Nombre', campo: 'nombre' },
                ], 'canonicos_proceso')}
                disabled={canonicosFiltrados.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoCan}><Plus size={16} /> Nuevo estado canónico</Boton>
            </div>
          </div>

          {cargandoCan ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : canonicos.length === 0 ? (
            <div className="text-center text-texto-muted py-12 border border-dashed border-borde rounded-lg">No hay estados canónicos registrados</div>
          ) : (
            <SortableDndContext
              items={canonicosFiltrados as unknown as Record<string, unknown>[]}
              getId={(c) => (c as unknown as EstadoCanonicalProceso).codigo_estado_canonico}
              onReorder={(n) => reordenarCanonicos(n as unknown as EstadoCanonicalProceso[])}
            >
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-8" />
                  <TablaTh className="w-16 text-center">Orden</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh className="w-48">Código</TablaTh>
                  <TablaTh className="text-right w-24">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {canonicosFiltrados.length === 0 ? (
                    <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>Sin resultados para la búsqueda</TablaTd></TablaFila>
                  ) : canonicosFiltrados.map((c) => (
                    <SortableRow key={c.codigo_estado_canonico} id={c.codigo_estado_canonico}>
                      <TablaTd className="text-center text-texto-muted text-sm">{c.orden ?? '—'}</TablaTd>
                      <TablaTd className="font-medium">{c.nombre}</TablaTd>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.codigo_estado_canonico}</code></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarCan(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => setItemAEliminar({ tipo: 'canonico', item: c })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
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

      {/* Modal Categoría */}
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? `Editar categoría de proceso: ${catEditando.nombre_categoria_proceso}` : 'Nueva categoría de proceso'} className="w-[880px] max-w-[95vw]">
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde -mx-1 overflow-x-auto">
            {(catEditando
              ? (['datos', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as TabModal[])
              : (['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as TabModal[])
            ).map((tab) => (
              <button key={tab} onClick={() => setTabModalCat(tab)} className={tabModalCls(tabModalCat, tab)}>
                {TABS_MODAL_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalCat === 'datos' && (
            <div className="flex flex-col gap-4">
              {!catEditando && (
                <Input etiqueta="Código (dejar vacío para autogenerar)" value={formCat.codigo_categoria_proceso}
                  onChange={(e) => setFormCat({ ...formCat, codigo_categoria_proceso: e.target.value })}
                  placeholder="GESTION_PREDIOS" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input etiqueta="Nombre *" value={formCat.nombre_categoria_proceso}
                  onChange={(e) => setFormCat({ ...formCat, nombre_categoria_proceso: e.target.value })}
                  placeholder="Gestión de Predios" />
                <Input etiqueta="Alias" value={formCat.alias}
                  onChange={(e) => setFormCat({ ...formCat, alias: e.target.value })}
                  placeholder="Alias breve" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Descripción</label>
                <textarea value={formCat.descripcion_categoria_proceso}
                  onChange={(e) => setFormCat({ ...formCat, descripcion_categoria_proceso: e.target.value })}
                  rows={6}
                  placeholder="Descripción opcional"
                  className={textareaCls} />
              </div>
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalCat === 'system_prompt' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">System prompt</label>
              <textarea value={formCat.system_prompt}
                onChange={(e) => setFormCat({ ...formCat, system_prompt: e.target.value })}
                rows={11}
                placeholder="Instrucciones system para el LLM"
                className={textareaCls + ' font-mono'} />
            </div>
          )}

          {/* Tab Programación Insert */}
          {tabModalCat === 'programacion_insert' && catEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="categorias_proceso"
                pkColumna="codigo_categoria_proceso"
                pkValor={catEditando.codigo_categoria_proceso}
                campos={{
                  prompt_insert: formCat.prompt_insert,
                  prompt_update: formCat.prompt_update,
                  system_prompt: formCat.system_prompt,
                  python_insert: formCat.python_insert,
                  python_update: formCat.python_update,
                  javascript: formCat.javascript,
                  python_editado_manual: formCat.python_editado_manual,
                  javascript_editado_manual: formCat.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormCat((p) => ({ ...p, [c]: v }))}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
            </div>
          )}
          {tabModalCat === 'programacion_insert' && !catEditando && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Prompt insert</label>
              <textarea value={formCat.prompt_insert}
                onChange={(e) => setFormCat({ ...formCat, prompt_insert: e.target.value })}
                rows={12}
                placeholder="Prompt para INSERT"
                className={textareaCls} />
            </div>
          )}
          {/* Tab Programación Update */}
          {tabModalCat === 'programacion_update' && catEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="categorias_proceso"
                pkColumna="codigo_categoria_proceso"
                pkValor={catEditando.codigo_categoria_proceso}
                campos={{
                  prompt_insert: formCat.prompt_insert,
                  prompt_update: formCat.prompt_update,
                  system_prompt: formCat.system_prompt,
                  python_insert: formCat.python_insert,
                  python_update: formCat.python_update,
                  javascript: formCat.javascript,
                  python_editado_manual: formCat.python_editado_manual,
                  javascript_editado_manual: formCat.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormCat((p) => ({ ...p, [c]: v }))}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
            </div>
          )}
          {tabModalCat === 'programacion_update' && !catEditando && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Prompt update</label>
              <textarea value={formCat.prompt_update}
                onChange={(e) => setFormCat({ ...formCat, prompt_update: e.target.value })}
                rows={12}
                placeholder="Prompt para UPDATE"
                className={textareaCls} />
            </div>
          )}

          {/* Tab .md */}
          {tabModalCat === 'md' && catEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea value={formCat.md || ''} readOnly rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default" />
              </div>
              {mensajeMdCat && (
                <p className={`text-xs px-1 ${mensajeMdCat.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{mensajeMdCat.texto}</p>
              )}
              <div className="flex items-center justify-between pt-2 gap-2">
                <div className="flex gap-2">
                  <Boton
                    onClick={async () => {
                      setGenerandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await procesosDatosBasicosApi.generarMdCategoria(catEditando.codigo_categoria_proceso)
                        setFormCat((p) => ({ ...p, md: r.md }))
                        setMensajeMdCat({ tipo: 'ok', texto: 'Markdown generado.' })
                      } catch (e) { setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' }) }
                      finally { setGenerandoMdCat(false) }
                    }}
                    cargando={generandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat}
                  >Generar</Boton>
                  <Boton
                    variante="secundario"
                    onClick={async () => {
                      setSincronizandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await promptsApi.sincronizarFila('categorias_proceso', 'codigo_categoria_proceso', catEditando.codigo_categoria_proceso)
                        setMensajeMdCat({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}).` })
                      } catch (e) { setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' }) }
                      finally { setSincronizandoMdCat(false) }
                    }}
                    cargando={sincronizandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat || !formCat.md}
                  >Sincronizar</Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalCat(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
          {tabModalCat !== 'md' && (
            <PieBotonesModal
              editando={!!catEditando}
              onGuardar={() => guardarCategoria(false)}
              onGuardarYSalir={() => guardarCategoria(true)}
              onCerrar={() => setModalCat(false)}
              cargando={guardandoCat}
              botonesIzquierda={catEditando && (tabModalCat === 'programacion_insert' || tabModalCat === 'programacion_update') ? (
                <PieBotonesPrompts
                  tabla="categorias_proceso"
                  pkColumna="codigo_categoria_proceso"
                  pkValor={catEditando.codigo_categoria_proceso}
                  promptInsert={formCat.prompt_insert || undefined}
                  promptUpdate={formCat.prompt_update || undefined}
                  mostrarSincronizar={false}
                />
              ) : undefined}
            />
          )}
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? `Editar tipo de proceso: ${tipoEditando.nombre_tipo_proceso}` : 'Nuevo tipo de proceso'} className="w-[880px] max-w-[95vw]">
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde -mx-1 overflow-x-auto">
            {(tipoEditando
              ? (['datos', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as TabModal[])
              : (['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as TabModal[])
            ).map((tab) => (
              <button key={tab} onClick={() => setTabModalTipo(tab)} className={tabModalCls(tabModalTipo, tab)}>
                {TABS_MODAL_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalTipo === 'datos' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Categoría *</label>
                <select value={formTipo.codigo_categoria_proceso}
                  onChange={(e) => setFormTipo({ ...formTipo, codigo_categoria_proceso: e.target.value })}
                  disabled={!!tipoEditando}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60">
                  <option value="">Seleccionar categoría...</option>
                  {categorias.map((c) => <option key={c.codigo_categoria_proceso} value={c.codigo_categoria_proceso}>{c.nombre_categoria_proceso}</option>)}
                </select>
              </div>
              {!tipoEditando && (
                <Input etiqueta="Código tipo (dejar vacío para autogenerar)" value={formTipo.codigo_tipo_proceso}
                  onChange={(e) => setFormTipo({ ...formTipo, codigo_tipo_proceso: e.target.value })}
                  placeholder="LICENCIA_OBRAS" />
              )}
              <Input etiqueta="Nombre *" value={formTipo.nombre_tipo_proceso}
                onChange={(e) => setFormTipo({ ...formTipo, nombre_tipo_proceso: e.target.value })}
                placeholder="Licencia de Obras" />
              <Input etiqueta="Descripción" value={formTipo.descripcion_tipo_proceso}
                onChange={(e) => setFormTipo({ ...formTipo, descripcion_tipo_proceso: e.target.value })}
                placeholder="Descripción opcional" />
              <Input etiqueta="Alias" value={formTipo.alias}
                onChange={(e) => setFormTipo({ ...formTipo, alias: e.target.value })}
                placeholder="Alias breve" />
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalTipo === 'system_prompt' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">System prompt</label>
              <textarea value={formTipo.system_prompt}
                onChange={(e) => setFormTipo({ ...formTipo, system_prompt: e.target.value })}
                rows={11}
                placeholder="Instrucciones system para el LLM"
                className={textareaCls + ' font-mono'} />
            </div>
          )}

          {/* Tab Programación Insert */}
          {tabModalTipo === 'programacion_insert' && tipoEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="tipos_proceso"
                pkColumna="codigo_tipo_proceso"
                pkValor={tipoEditando.codigo_tipo_proceso}
                campos={{
                  prompt_insert: formTipo.prompt_insert,
                  prompt_update: formTipo.prompt_update,
                  system_prompt: formTipo.system_prompt,
                  python_insert: formTipo.python_insert,
                  python_update: formTipo.python_update,
                  javascript: formTipo.javascript,
                  python_editado_manual: formTipo.python_editado_manual,
                  javascript_editado_manual: formTipo.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormTipo((p) => ({ ...p, [c]: v }))}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
            </div>
          )}
          {tabModalTipo === 'programacion_insert' && !tipoEditando && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Prompt insert</label>
              <textarea value={formTipo.prompt_insert}
                onChange={(e) => setFormTipo({ ...formTipo, prompt_insert: e.target.value })}
                rows={12}
                placeholder="Prompt para INSERT"
                className={textareaCls} />
            </div>
          )}
          {/* Tab Programación Update */}
          {tabModalTipo === 'programacion_update' && tipoEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="tipos_proceso"
                pkColumna="codigo_tipo_proceso"
                pkValor={tipoEditando.codigo_tipo_proceso}
                campos={{
                  prompt_insert: formTipo.prompt_insert,
                  prompt_update: formTipo.prompt_update,
                  system_prompt: formTipo.system_prompt,
                  python_insert: formTipo.python_insert,
                  python_update: formTipo.python_update,
                  javascript: formTipo.javascript,
                  python_editado_manual: formTipo.python_editado_manual,
                  javascript_editado_manual: formTipo.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormTipo((p) => ({ ...p, [c]: v }))}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
            </div>
          )}
          {tabModalTipo === 'programacion_update' && !tipoEditando && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Prompt update</label>
              <textarea value={formTipo.prompt_update}
                onChange={(e) => setFormTipo({ ...formTipo, prompt_update: e.target.value })}
                rows={12}
                placeholder="Prompt para UPDATE"
                className={textareaCls} />
            </div>
          )}

          {/* Tab .md */}
          {tabModalTipo === 'md' && tipoEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea value={formTipo.md || ''} readOnly rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default" />
              </div>
              {mensajeMdTipo && (
                <p className={`text-xs px-1 ${mensajeMdTipo.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{mensajeMdTipo.texto}</p>
              )}
              <div className="flex items-center justify-between pt-2 gap-2">
                <div className="flex gap-2">
                  <Boton
                    onClick={async () => {
                      setGenerandoMdTipo(true); setMensajeMdTipo(null)
                      try {
                        const r = await procesosDatosBasicosApi.generarMdTipo(tipoEditando.codigo_categoria_proceso, tipoEditando.codigo_tipo_proceso)
                        setFormTipo((p) => ({ ...p, md: r.md }))
                        setMensajeMdTipo({ tipo: 'ok', texto: 'Markdown generado.' })
                      } catch (e) { setMensajeMdTipo({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' }) }
                      finally { setGenerandoMdTipo(false) }
                    }}
                    cargando={generandoMdTipo}
                    disabled={generandoMdTipo || sincronizandoMdTipo}
                  >Generar</Boton>
                  <Boton
                    variante="secundario"
                    onClick={async () => {
                      setSincronizandoMdTipo(true); setMensajeMdTipo(null)
                      try {
                        const r = await promptsApi.sincronizarFila('tipos_proceso', 'codigo_tipo_proceso', tipoEditando.codigo_tipo_proceso)
                        setMensajeMdTipo({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}).` })
                      } catch (e) { setMensajeMdTipo({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' }) }
                      finally { setSincronizandoMdTipo(false) }
                    }}
                    cargando={sincronizandoMdTipo}
                    disabled={generandoMdTipo || sincronizandoMdTipo || !formTipo.md}
                  >Sincronizar</Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalTipo(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {errorTipo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorTipo}</p></div>}
          {tabModalTipo !== 'md' && (
            <PieBotonesModal
              editando={!!tipoEditando}
              onGuardar={() => guardarTipo(false)}
              onGuardarYSalir={() => guardarTipo(true)}
              onCerrar={() => setModalTipo(false)}
              cargando={guardandoTipo}
              botonesIzquierda={tipoEditando && (tabModalTipo === 'programacion_insert' || tabModalTipo === 'programacion_update') ? (
                <PieBotonesPrompts
                  tabla="tipos_proceso"
                  pkColumna="codigo_tipo_proceso"
                  pkValor={tipoEditando.codigo_tipo_proceso}
                  promptInsert={formTipo.prompt_insert || undefined}
                  promptUpdate={formTipo.prompt_update || undefined}
                  mostrarSincronizar={false}
                />
              ) : undefined}
            />
          )}
        </div>
      </Modal>

      {/* Modal Estado */}
      <Modal abierto={modalEst} alCerrar={() => setModalEst(false)} titulo={estEditando ? `Editar estado de proceso: ${estEditando.nombre_estado}` : 'Nuevo estado de proceso'} className="w-[880px] max-w-[95vw]">
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde -mx-1 overflow-x-auto">
            {(estEditando
              ? (['datos', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as TabModal[])
              : (['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as TabModal[])
            ).map((tab) => (
              <button key={tab} onClick={() => setTabModalEst(tab)} className={tabModalCls(tabModalEst, tab)}>
                {TABS_MODAL_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalEst === 'datos' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Categoría *</label>
                  <select value={formEst.codigo_categoria_proceso}
                    onChange={(e) => setFormEst({ ...formEst, codigo_categoria_proceso: e.target.value, codigo_tipo_proceso: '' })}
                    disabled={!!estEditando}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60">
                    <option value="">Seleccionar categoría...</option>
                    {categorias.map((c) => <option key={c.codigo_categoria_proceso} value={c.codigo_categoria_proceso}>{c.nombre_categoria_proceso}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Tipo *</label>
                  <select value={formEst.codigo_tipo_proceso}
                    onChange={(e) => setFormEst({ ...formEst, codigo_tipo_proceso: e.target.value })}
                    disabled={!!estEditando}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60">
                    <option value="">Seleccionar tipo...</option>
                    {tipos.filter((t) => t.codigo_categoria_proceso === formEst.codigo_categoria_proceso)
                      .map((t) => <option key={t.codigo_tipo_proceso} value={t.codigo_tipo_proceso}>{t.nombre_tipo_proceso}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!estEditando ? (
                  <Input etiqueta="Código estado (vacío = autogenerar)" value={formEst.codigo_estado_proceso}
                    onChange={(e) => setFormEst({ ...formEst, codigo_estado_proceso: e.target.value })}
                    placeholder="INGRESADO" />
                ) : (
                  <Input etiqueta="Código estado" value={formEst.codigo_estado_proceso} disabled />
                )}
                <Input etiqueta="Nombre *" value={formEst.nombre_estado}
                  onChange={(e) => setFormEst({ ...formEst, nombre_estado: e.target.value })}
                  placeholder="Ingresado" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Secuencia</label>
                  <input type="number" min={0} value={formEst.secuencia}
                    onChange={(e) => setFormEst({ ...formEst, secuencia: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-texto">
                <input type="checkbox" checked={formEst.traducir}
                  onChange={(e) => setFormEst({ ...formEst, traducir: e.target.checked })}
                  className="h-4 w-4 rounded border-borde text-primario focus:ring-primario" />
                Traducir este estado a los idiomas configurados
              </label>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Ayuda</label>
                <textarea value={formEst.ayuda}
                  onChange={(e) => setFormEst({ ...formEst, ayuda: e.target.value })}
                  rows={2}
                  placeholder="Texto de ayuda contextual para este estado"
                  className={textareaCls} />
              </div>
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalEst === 'system_prompt' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">System prompt</label>
              <textarea value={formEst.system_prompt}
                onChange={(e) => setFormEst({ ...formEst, system_prompt: e.target.value })}
                rows={11}
                placeholder="Instrucciones system para el LLM"
                className={textareaCls + ' font-mono'} />
            </div>
          )}

          {/* Tab Programación Insert */}
          {tabModalEst === 'programacion_insert' && estEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="estados_procesos"
                pkColumna="codigo_estado_proceso"
                pkValor={estEditando.codigo_estado_proceso}
                campos={{
                  prompt_insert: formEst.prompt_insert,
                  prompt_update: formEst.prompt_update,
                  system_prompt: formEst.system_prompt,
                  python_insert: formEst.python_insert,
                  python_update: formEst.python_update,
                  javascript: formEst.javascript,
                  python_editado_manual: formEst.python_editado_manual,
                  javascript_editado_manual: formEst.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormEst((p) => ({ ...p, [c]: v }))}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
            </div>
          )}
          {tabModalEst === 'programacion_insert' && !estEditando && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Prompt insert</label>
              <textarea value={formEst.prompt_insert}
                onChange={(e) => setFormEst({ ...formEst, prompt_insert: e.target.value })}
                rows={12}
                placeholder="Prompt específico del estado (INSERT)"
                className={textareaCls} />
            </div>
          )}
          {/* Tab Programación Update */}
          {tabModalEst === 'programacion_update' && estEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="estados_procesos"
                pkColumna="codigo_estado_proceso"
                pkValor={estEditando.codigo_estado_proceso}
                campos={{
                  prompt_insert: formEst.prompt_insert,
                  prompt_update: formEst.prompt_update,
                  system_prompt: formEst.system_prompt,
                  python_insert: formEst.python_insert,
                  python_update: formEst.python_update,
                  javascript: formEst.javascript,
                  python_editado_manual: formEst.python_editado_manual,
                  javascript_editado_manual: formEst.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormEst((p) => ({ ...p, [c]: v }))}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
            </div>
          )}
          {tabModalEst === 'programacion_update' && !estEditando && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Prompt update</label>
              <textarea value={formEst.prompt_update}
                onChange={(e) => setFormEst({ ...formEst, prompt_update: e.target.value })}
                rows={12}
                placeholder="Prompt específico del estado (UPDATE)"
                className={textareaCls} />
            </div>
          )}

          {/* Tab .md */}
          {tabModalEst === 'md' && estEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea value={formEst.md || ''} readOnly rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default" />
              </div>
              {mensajeMdEst && (
                <p className={`text-xs px-1 ${mensajeMdEst.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{mensajeMdEst.texto}</p>
              )}
              <div className="flex items-center justify-between pt-2 gap-2">
                <div className="flex gap-2">
                  <Boton
                    onClick={async () => {
                      setGenerandoMdEst(true); setMensajeMdEst(null)
                      try {
                        const r = await procesosDatosBasicosApi.generarMdEstado(estEditando.codigo_categoria_proceso, estEditando.codigo_tipo_proceso, estEditando.codigo_estado_proceso)
                        setFormEst((p) => ({ ...p, md: r.md }))
                        setMensajeMdEst({ tipo: 'ok', texto: 'Markdown generado.' })
                      } catch (e) { setMensajeMdEst({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' }) }
                      finally { setGenerandoMdEst(false) }
                    }}
                    cargando={generandoMdEst}
                    disabled={generandoMdEst || sincronizandoMdEst}
                  >Generar</Boton>
                  <Boton
                    variante="secundario"
                    onClick={async () => {
                      setSincronizandoMdEst(true); setMensajeMdEst(null)
                      try {
                        const r = await promptsApi.sincronizarFila('estados_procesos', 'codigo_estado_proceso', estEditando.codigo_estado_proceso)
                        setMensajeMdEst({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}).` })
                      } catch (e) { setMensajeMdEst({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' }) }
                      finally { setSincronizandoMdEst(false) }
                    }}
                    cargando={sincronizandoMdEst}
                    disabled={generandoMdEst || sincronizandoMdEst || !formEst.md}
                  >Sincronizar</Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalEst(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {errorEst && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEst}</p></div>}
          {tabModalEst !== 'md' && (
            <PieBotonesModal
              editando={!!estEditando}
              onGuardar={() => guardarEstado(false)}
              onGuardarYSalir={() => guardarEstado(true)}
              onCerrar={() => setModalEst(false)}
              cargando={guardandoEst}
              botonesIzquierda={estEditando && (tabModalEst === 'programacion_insert' || tabModalEst === 'programacion_update') ? (
                <PieBotonesPrompts
                  tabla="estados_procesos"
                  pkColumna="codigo_estado_proceso"
                  pkValor={estEditando.codigo_estado_proceso}
                  promptInsert={formEst.prompt_insert || undefined}
                  promptUpdate={formEst.prompt_update || undefined}
                  mostrarSincronizar={false}
                />
              ) : undefined}
            />
          )}
        </div>
      </Modal>

      {/* Modal Canónico */}
      <Modal abierto={modalCan} alCerrar={() => setModalCan(false)} titulo={canEditando ? `Editar: ${canEditando.nombre}` : 'Nuevo Estado Canónico de Proceso'}>
        <div className="flex flex-col gap-4 min-w-[440px]">
          <Input etiqueta="Código" value={formCan.codigo_estado_canonico}
            onChange={(e) => setFormCan({ ...formCan, codigo_estado_canonico: e.target.value })}
            placeholder="Ej: ABIERTO, EN_PROCESO, CERRADO"
            disabled={!!canEditando}
            autoFocus={!canEditando}
          />
          <Input etiqueta="Nombre *" value={formCan.nombre}
            onChange={(e) => setFormCan({ ...formCan, nombre: e.target.value })}
            placeholder="Nombre del estado canónico"
            autoFocus={!!canEditando}
          />
          {errorCan && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCan}</p></div>}
          <PieBotonesModal
            editando={!!canEditando}
            onGuardar={() => guardarCanonico(false)}
            onGuardarYSalir={() => guardarCanonico(true)}
            onCerrar={() => setModalCan(false)}
            cargando={guardandoCan}
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
          itemAEliminar?.tipo === 'tipo' ? 'Eliminar tipo' :
          itemAEliminar?.tipo === 'canonico' ? 'Eliminar estado canónico' : 'Eliminar estado'
        }
        mensaje={
          itemAEliminar?.tipo === 'categoria'
            ? `¿Eliminar la categoría "${(itemAEliminar.item as CategoriaProceso).nombre_categoria_proceso}"? Solo posible si no tiene tipos asociados.`
            : itemAEliminar?.tipo === 'tipo'
            ? `¿Eliminar el tipo "${(itemAEliminar.item as TipoProceso).nombre_tipo_proceso}"? Solo posible si no tiene estados asociados.`
            : itemAEliminar?.tipo === 'canonico'
            ? `¿Eliminar el estado canónico "${(itemAEliminar.item as EstadoCanonicalProceso).nombre}"?`
            : `¿Eliminar el estado "${(itemAEliminar?.item as EstadoProceso)?.nombre_estado}"?`
        }
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </div>
  )
}
