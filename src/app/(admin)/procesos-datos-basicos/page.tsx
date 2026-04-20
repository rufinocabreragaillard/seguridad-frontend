'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { procesosDatosBasicosApi, tareasDatosBasicosApi, funcionesApi } from '@/lib/api'
import type { CategoriaProceso, TipoProceso, EstadoProceso, EstadoCanonicalProceso, Funcion } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { BotonChat } from '@/components/ui/boton-chat'

type TabId = 'categorias' | 'tipos' | 'estados' | 'canonicos'

type ItemEliminar =
  | { tipo: 'categoria'; item: CategoriaProceso }
  | { tipo: 'tipo'; item: TipoProceso }
  | { tipo: 'estado'; item: EstadoProceso }
  | { tipo: 'canonico'; item: EstadoCanonicalProceso }

export default function PaginaProcesosDatosBasicos() {
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaProceso[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaProceso | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_categoria_proceso: '', nombre_categoria_proceso: '', descripcion_categoria_proceso: '', alias: '',
    prompt: '', system_prompt: '',
  })
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoProceso[]>([])
  const [cargandoTipo, setCargandoTipo] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoProceso | null>(null)
  const [formTipo, setFormTipo] = useState({
    codigo_categoria_proceso: '', codigo_tipo_proceso: '', nombre_tipo_proceso: '', descripcion_tipo_proceso: '', alias: '',
    prompt: '', system_prompt: '',
  })
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [filtroCatTipo, setFiltroCatTipo] = useState('')

  // ── Estados ────────────────────────────────────────────────────────────────
  const [estados, setEstados] = useState<EstadoProceso[]>([])
  const [cargandoEst, setCargandoEst] = useState(true)
  const [modalEst, setModalEst] = useState(false)
  const [estEditando, setEstEditando] = useState<EstadoProceso | null>(null)
  const [formEst, setFormEst] = useState<{
    codigo_categoria_proceso: string
    codigo_tipo_proceso: string
    codigo_estado_proceso: string
    nombre_estado: string
    secuencia: number
    prompt: string
    system_prompt: string
    codigo_funcion: string
    n_parallel: string
    ayuda: string
    traducir: boolean
    batch_size: string
    batch_timeout_seg: string
  }>({
    codigo_categoria_proceso: '', codigo_tipo_proceso: '', codigo_estado_proceso: '',
    nombre_estado: '', secuencia: 0,
    prompt: '', system_prompt: '', codigo_funcion: '',
    n_parallel: '', ayuda: '', traducir: false, batch_size: '', batch_timeout_seg: '',
  })
  const [guardandoEst, setGuardandoEst] = useState(false)
  const [errorEst, setErrorEst] = useState('')
  const [filtroCatEst, setFiltroCatEst] = useState('')
  const [filtroTipoEst, setFiltroTipoEst] = useState('')
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
    setFormCat({ codigo_categoria_proceso: '', nombre_categoria_proceso: '', descripcion_categoria_proceso: '', alias: '', prompt: '', system_prompt: '' })
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaProceso) => {
    setCatEditando(c)
    setFormCat({
      codigo_categoria_proceso: c.codigo_categoria_proceso,
      nombre_categoria_proceso: c.nombre_categoria_proceso,
      descripcion_categoria_proceso: c.descripcion_categoria_proceso || '',
      alias: c.alias || '',
      prompt: c.prompt || '',
      system_prompt: c.system_prompt || '',
    })
    setErrorCat('')
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
          prompt: formCat.prompt || undefined,
          system_prompt: formCat.system_prompt || undefined,
        })
      } else {
        await procesosDatosBasicosApi.crearCategoria({
          codigo_categoria_proceso: formCat.codigo_categoria_proceso || undefined,
          nombre_categoria_proceso: formCat.nombre_categoria_proceso,
          descripcion_categoria_proceso: formCat.descripcion_categoria_proceso || undefined,
          alias: formCat.alias || undefined,
          prompt: formCat.prompt || undefined,
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
    setFormTipo({ codigo_categoria_proceso: '', codigo_tipo_proceso: '', nombre_tipo_proceso: '', descripcion_tipo_proceso: '', alias: '', prompt: '', system_prompt: '' })
    setErrorTipo('')
    setModalTipo(true)
  }

  const abrirEditarTipo = (t: TipoProceso) => {
    setTipoEditando(t)
    setFormTipo({
      codigo_categoria_proceso: t.codigo_categoria_proceso,
      codigo_tipo_proceso: t.codigo_tipo_proceso,
      nombre_tipo_proceso: t.nombre_tipo_proceso,
      descripcion_tipo_proceso: t.descripcion_tipo_proceso || '',
      alias: t.alias || '',
      prompt: t.prompt || '',
      system_prompt: t.system_prompt || '',
    })
    setErrorTipo('')
    setModalTipo(true)
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
            prompt: formTipo.prompt || undefined,
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
          prompt: formTipo.prompt || undefined,
          system_prompt: formTipo.system_prompt || undefined,
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
    setFormEst({
      codigo_categoria_proceso: '', codigo_tipo_proceso: '', codigo_estado_proceso: '',
      nombre_estado: '', secuencia: 0,
      prompt: '', system_prompt: '', codigo_funcion: '',
      n_parallel: '', ayuda: '', traducir: false, batch_size: '', batch_timeout_seg: '',
    })
    setErrorEst('')
    setModalEst(true)
  }

  const abrirEditarEst = (e: EstadoProceso) => {
    setEstEditando(e)
    setFormEst({
      codigo_categoria_proceso: e.codigo_categoria_proceso,
      codigo_tipo_proceso: e.codigo_tipo_proceso,
      codigo_estado_proceso: e.codigo_estado_proceso,
      nombre_estado: e.nombre_estado,
      secuencia: e.secuencia,
      prompt: e.prompt || '',
      system_prompt: e.system_prompt || '',
      codigo_funcion: e.codigo_funcion || '',
      n_parallel: e.n_parallel != null ? String(e.n_parallel) : '',
      ayuda: e.ayuda || '',
      traducir: e.traducir,
      batch_size: e.batch_size != null ? String(e.batch_size) : '',
      batch_timeout_seg: e.batch_timeout_seg != null ? String(e.batch_timeout_seg) : '',
    })
    setErrorEst('')
    setModalEst(true)
  }

  const guardarEstado = async (cerrar = true) => {
    if (!formEst.codigo_categoria_proceso || !formEst.codigo_tipo_proceso || !formEst.nombre_estado) {
      setErrorEst('Categoría, tipo y nombre son obligatorios'); return
    }
    setGuardandoEst(true); setErrorEst('')
    const toInt = (s: string) => (s.trim() === '' ? undefined : parseInt(s, 10))
    try {
      if (estEditando) {
        await procesosDatosBasicosApi.actualizarEstado(
          estEditando.codigo_categoria_proceso, estEditando.codigo_tipo_proceso, estEditando.codigo_estado_proceso,
          {
            nombre_estado: formEst.nombre_estado,
            secuencia: formEst.secuencia,
            prompt: formEst.prompt || undefined,
            system_prompt: formEst.system_prompt || undefined,
            codigo_funcion: formEst.codigo_funcion || undefined,
            n_parallel: toInt(formEst.n_parallel),
            ayuda: formEst.ayuda || undefined,
            traducir: formEst.traducir,
            batch_size: toInt(formEst.batch_size),
            batch_timeout_seg: toInt(formEst.batch_timeout_seg),
          }
        )
      } else {
        await procesosDatosBasicosApi.crearEstado({
          codigo_categoria_proceso: formEst.codigo_categoria_proceso,
          codigo_tipo_proceso: formEst.codigo_tipo_proceso,
          codigo_estado_proceso: formEst.codigo_estado_proceso || undefined,
          nombre_estado: formEst.nombre_estado,
          secuencia: formEst.secuencia,
          prompt: formEst.prompt || undefined,
          system_prompt: formEst.system_prompt || undefined,
          codigo_funcion: formEst.codigo_funcion || undefined,
          n_parallel: toInt(formEst.n_parallel),
          ayuda: formEst.ayuda || undefined,
          traducir: formEst.traducir,
          batch_size: toInt(formEst.batch_size),
          batch_timeout_seg: toInt(formEst.batch_timeout_seg),
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
  const tiposFiltrados = filtroCatTipo
    ? tipos.filter((t) => t.codigo_categoria_proceso === filtroCatTipo)
    : tipos

  const estadosFiltrados = estados.filter((e) => {
    if (filtroCatEst && e.codigo_categoria_proceso !== filtroCatEst) return false
    if (filtroTipoEst && e.codigo_tipo_proceso !== filtroTipoEst) return false
    return true
  })

  const tiposParaEstados = filtroTipoEst || !filtroCatEst
    ? tipos.filter((t) => !filtroCatEst || t.codigo_categoria_proceso === filtroCatEst)
    : tipos

  const canonicosFiltrados = busquedaCan
    ? canonicos.filter((c) =>
        c.codigo_estado_canonico.toLowerCase().includes(busquedaCan.toLowerCase()) ||
        c.nombre.toLowerCase().includes(busquedaCan.toLowerCase())
      )
    : canonicos

  const selectCls = 'rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'
  const tabCls = (id: TabId) =>
    `px-5 py-2.5 text-sm font-medium transition-colors ${tabActiva === id ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`

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
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh><TablaTh>Alias</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {categorias.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>No hay categorías registradas</TablaTd></TablaFila>
                ) : categorias.map((c) => (
                  <TablaFila key={c.codigo_categoria_proceso}>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.codigo_categoria_proceso}</code></TablaTd>
                    <TablaTd className="font-medium">{c.nombre_categoria_proceso}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm">{c.descripcion_categoria_proceso || <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm">{c.alias || <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => setItemAEliminar({ tipo: 'categoria', item: c })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </TablaTd>
                  </TablaFila>
                ))}
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
              <select value={filtroCatTipo} onChange={(e) => setFiltroCatTipo(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {categorias.map((c) => <option key={c.codigo_categoria_proceso} value={c.codigo_categoria_proceso}>{c.nombre_categoria_proceso}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(tiposFiltrados as unknown as Record<string, unknown>[], [
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

          {cargandoTipo ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh>Categoría</TablaTh><TablaTh>Código tipo</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {tiposFiltrados.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>No hay tipos registrados</TablaTd></TablaFila>
                ) : tiposFiltrados.map((t) => (
                  <TablaFila key={`${t.codigo_categoria_proceso}/${t.codigo_tipo_proceso}`}>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.codigo_categoria_proceso}</code></TablaTd>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{t.codigo_tipo_proceso}</code></TablaTd>
                    <TablaTd className="font-medium">{t.nombre_tipo_proceso}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm">{t.descripcion_tipo_proceso || <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditarTipo(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => setItemAEliminar({ tipo: 'tipo', item: t })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </TablaTd>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>
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
                {categorias.map((c) => <option key={c.codigo_categoria_proceso} value={c.codigo_categoria_proceso}>{c.nombre_categoria_proceso}</option>)}
              </select>
              <select value={filtroTipoEst} onChange={(e) => setFiltroTipoEst(e.target.value)} className={selectCls}>
                <option value="">Todos los tipos</option>
                {tiposParaEstados.map((t) => (
                  <option key={`${t.codigo_categoria_proceso}/${t.codigo_tipo_proceso}`} value={t.codigo_tipo_proceso}>
                    {t.nombre_tipo_proceso}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(estadosFiltrados as unknown as Record<string, unknown>[], [
                  { titulo: 'Categoría', campo: 'codigo_categoria_proceso' },
                  { titulo: 'Tipo', campo: 'codigo_tipo_proceso' },
                  { titulo: 'Código estado', campo: 'codigo_estado_proceso' },
                  { titulo: 'Nombre', campo: 'nombre_estado' },
                  { titulo: 'Secuencia', campo: 'secuencia' },
                  { titulo: 'Función', campo: 'codigo_funcion' },
                  { titulo: 'N paralelo', campo: 'n_parallel' },
                  { titulo: 'Batch size', campo: 'batch_size' },
                  { titulo: 'Batch timeout (s)', campo: 'batch_timeout_seg' },
                  { titulo: 'Traducir', campo: 'traducir', formato: (v) => v ? 'Sí' : 'No' },
                ], 'estados_proceso')}
                disabled={estadosFiltrados.length === 0}>
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoEst}><Plus size={16} /> Nuevo estado</Boton>
            </div>
          </div>

          {cargandoEst ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh>Categoría</TablaTh><TablaTh>Tipo</TablaTh><TablaTh>Código</TablaTh>
                <TablaTh>Nombre</TablaTh><TablaTh>Sec.</TablaTh>
                <TablaTh>Función</TablaTh><TablaTh>N paral.</TablaTh><TablaTh>Batch</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {estadosFiltrados.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={9 as never}>No hay estados registrados</TablaTd></TablaFila>
                ) : estadosFiltrados.map((e) => (
                  <TablaFila key={`${e.codigo_categoria_proceso}/${e.codigo_tipo_proceso}/${e.codigo_estado_proceso}`}>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_categoria_proceso}</code></TablaTd>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_tipo_proceso}</code></TablaTd>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_estado_proceso}</code></TablaTd>
                    <TablaTd className="font-medium">{e.nombre_estado}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm text-center">{e.secuencia}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm">{e.codigo_funcion || <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm text-center">{e.n_parallel ?? <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm text-center">{e.batch_size ?? <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditarEst(e)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => setItemAEliminar({ tipo: 'estado', item: e })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </TablaTd>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>
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
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {canonicosFiltrados.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={3 as never}>No hay estados canónicos registrados</TablaTd></TablaFila>
                ) : canonicosFiltrados.map((c) => (
                  <TablaFila key={c.codigo_estado_canonico}>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.codigo_estado_canonico}</code></TablaTd>
                    <TablaTd className="font-medium">{c.nombre}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditarCan(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => setItemAEliminar({ tipo: 'canonico', item: c })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
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
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? 'Editar categoría' : 'Nueva categoría de proceso'} className="w-[880px] max-w-[95vw]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              {!catEditando && (
                <Input etiqueta="Código (dejar vacío para autogenerar)" value={formCat.codigo_categoria_proceso}
                  onChange={(e) => setFormCat({ ...formCat, codigo_categoria_proceso: e.target.value })}
                  placeholder="GESTION_PREDIOS" />
              )}
              <Input etiqueta="Nombre *" value={formCat.nombre_categoria_proceso}
                onChange={(e) => setFormCat({ ...formCat, nombre_categoria_proceso: e.target.value })}
                placeholder="Gestión de Predios" />
              <Input etiqueta="Descripción" value={formCat.descripcion_categoria_proceso}
                onChange={(e) => setFormCat({ ...formCat, descripcion_categoria_proceso: e.target.value })}
                placeholder="Descripción opcional" />
              <Input etiqueta="Alias" value={formCat.alias}
                onChange={(e) => setFormCat({ ...formCat, alias: e.target.value })}
                placeholder="Alias breve" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Prompt</label>
                <textarea value={formCat.prompt}
                  onChange={(e) => setFormCat({ ...formCat, prompt: e.target.value })}
                  rows={catEditando ? 7 : 8}
                  placeholder="Prompt de la categoría"
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">System prompt</label>
                <textarea value={formCat.system_prompt}
                  onChange={(e) => setFormCat({ ...formCat, system_prompt: e.target.value })}
                  rows={catEditando ? 7 : 8}
                  placeholder="Instrucciones system para el LLM"
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
              </div>
            </div>
          </div>
          {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
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
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? 'Editar tipo' : 'Nuevo tipo de proceso'} className="w-[880px] max-w-[95vw]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Prompt</label>
                <textarea value={formTipo.prompt}
                  onChange={(e) => setFormTipo({ ...formTipo, prompt: e.target.value })}
                  rows={tipoEditando ? 7 : 8}
                  placeholder="Prompt del tipo de proceso"
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">System prompt</label>
                <textarea value={formTipo.system_prompt}
                  onChange={(e) => setFormTipo({ ...formTipo, system_prompt: e.target.value })}
                  rows={tipoEditando ? 7 : 8}
                  placeholder="Instrucciones system para el LLM"
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
              </div>
            </div>
          </div>
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

      {/* Modal Estado */}
      <Modal abierto={modalEst} alCerrar={() => setModalEst(false)} titulo={estEditando ? 'Editar estado' : 'Nuevo estado de proceso'} className="w-[720px] max-w-[95vw]">
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

          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Secuencia</label>
              <input type="number" min={0} value={formEst.secuencia}
                onChange={(e) => setFormEst({ ...formEst, secuencia: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">N paralelo</label>
              <input type="number" min={1} value={formEst.n_parallel}
                onChange={(e) => setFormEst({ ...formEst, n_parallel: e.target.value })}
                placeholder="10"
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Batch size</label>
              <input type="number" min={1} value={formEst.batch_size}
                onChange={(e) => setFormEst({ ...formEst, batch_size: e.target.value })}
                placeholder="50"
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Batch timeout (s)</label>
              <input type="number" min={1} value={formEst.batch_timeout_seg}
                onChange={(e) => setFormEst({ ...formEst, batch_timeout_seg: e.target.value })}
                placeholder="60"
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Función asociada</label>
            <select value={formEst.codigo_funcion}
              onChange={(e) => setFormEst({ ...formEst, codigo_funcion: e.target.value })}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario">
              <option value="">(Sin función)</option>
              {[...funciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((f) => (
                <option key={f.codigo_funcion} value={f.codigo_funcion}>{f.nombre} — {f.codigo_funcion}</option>
              ))}
            </select>
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
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Prompt</label>
            <textarea value={formEst.prompt}
              onChange={(e) => setFormEst({ ...formEst, prompt: e.target.value })}
              rows={3}
              placeholder="Prompt específico del estado"
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">System prompt</label>
            <textarea value={formEst.system_prompt}
              onChange={(e) => setFormEst({ ...formEst, system_prompt: e.target.value })}
              rows={3}
              placeholder="Instrucciones system para el LLM"
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
          </div>

          {errorEst && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEst}</p></div>}
          <PieBotonesModal
            editando={!!estEditando}
            onGuardar={() => guardarEstado(false)}
            onGuardarYSalir={() => guardarEstado(true)}
            onCerrar={() => setModalEst(false)}
            cargando={guardandoEst}
          />
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
