'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Boton } from '@/components/ui/boton'
import { Paginador } from '@/components/ui/paginador'
import {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaFila,
  TablaTh,
  TablaTd,
} from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import {
  procesosInstanciasApi,
  procesosDatosBasicosApi,
  usuariosApi,
  gruposApi,
} from '@/lib/api'
import type { ProcesoInstancia } from '@/lib/api'
import type { CategoriaProceso, TipoProceso, EstadoProceso, Usuario, Grupo } from '@/lib/tipos'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'
import { SelectorBuscable } from '@/components/ui/selector-buscable'
import { exportarExcel } from '@/lib/exportar-excel'
import {
  Trash2,
  CheckSquare,
  Square,
  Calendar,
  Plus,
  Download,
  Search,
  Filter,
  Pencil,
  X,
} from 'lucide-react'

type Tab = 'datos' | 'detalle'

type FormInstancia = {
  codigo_categoria_proceso: string
  codigo_tipo_proceso: string
  codigo_estado: string
  codigo_usuario_asignado: string
  nombre_proceso: string
  descripcion_proceso: string
  comentarios_proceso: string
  fecha_comprometida: string
  fecha_fin: string
  costo_en_tiempo: string
  costo: string
}

const FORM_INICIAL: FormInstancia = {
  codigo_categoria_proceso: '',
  codigo_tipo_proceso: '',
  codigo_estado: '',
  codigo_usuario_asignado: '',
  nombre_proceso: '',
  descripcion_proceso: '',
  comentarios_proceso: '',
  fecha_comprometida: '',
  fecha_fin: '',
  costo_en_tiempo: '',
  costo: '',
}

type Filtros = {
  q: string
  codigo_categoria_proceso: string
  codigo_tipo_proceso: string
  codigo_estado: string
  codigo_grupo: string
  codigo_usuario: string
}

const FILTROS_INICIALES: Filtros = {
  q: '',
  codigo_categoria_proceso: '',
  codigo_tipo_proceso: '',
  codigo_estado: '',
  codigo_grupo: '',
  codigo_usuario: '',
}

function fmtFechaHora(v: string | null | undefined): string {
  if (!v) return '—'
  try {
    const d = new Date(v)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function PaginaProcesoInstancias() {
  const tc = useTranslations('common')
  const tpx = useTranslations('processesExtra')
  const { usuario } = useAuth()

  const [categorias, setCategorias] = useState<CategoriaProceso[]>([])
  const [tiposProc, setTiposProc] = useState<TipoProceso[]>([])
  const [estadosProc, setEstadosProc] = useState<EstadoProceso[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])

  // Datos paginados
  const [items, setItems] = useState<ProcesoInstancia[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [cargando, setCargando] = useState(true)

  // Filtros (aplicados al backend)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [filtrosVisibles, setFiltrosVisibles] = useState(false)

  // Modal CRUD
  const [tab, setTab] = useState<Tab>('datos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<ProcesoInstancia | null>(null)
  const [form, setForm] = useState<FormInstancia>(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  // Confirmación eliminar
  const [confirmacion, setConfirmacion] = useState<ProcesoInstancia | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Selección masiva
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [modalBulk, setModalBulk] = useState(false)
  const [bulkFechaDesde, setBulkFechaDesde] = useState('')
  const [bulkFechaHasta, setBulkFechaHasta] = useState('')
  const [bulkEliminando, setBulkEliminando] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkModo, setBulkModo] = useState<'seleccion' | 'fecha'>('seleccion')

  // ── Carga inicial de catálogos ─────────────────────────────────────────────
  useEffect(() => {
    procesosDatosBasicosApi.listarCategorias().then(setCategorias).catch(() => setCategorias([]))
    procesosDatosBasicosApi.listarTipos().then(setTiposProc).catch(() => setTiposProc([]))
    procesosDatosBasicosApi.listarEstados().then(setEstadosProc).catch(() => setEstadosProc([]))
    usuariosApi.listar().then(setUsuarios).catch(() => setUsuarios([]))
    gruposApi.listar().then(setGrupos).catch(() => setGrupos([]))
  }, [])

  // ── Carga paginada ─────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await procesosInstanciasApi.listar({
        q: filtros.q || undefined,
        codigo_categoria_proceso: filtros.codigo_categoria_proceso || undefined,
        codigo_tipo_proceso: filtros.codigo_tipo_proceso || undefined,
        codigo_estado: filtros.codigo_estado || undefined,
        codigo_grupo: filtros.codigo_grupo || undefined,
        codigo_usuario: filtros.codigo_usuario || undefined,
        page,
        page_size: pageSize,
        order_by: 'fecha_inicio',
        order_dir: 'desc',
      })
      setItems(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (e) {
      console.error('[processes] cargar:', e)
      setItems([])
      setTotal(0)
    } finally {
      setCargando(false)
    }
  }, [filtros, page, pageSize])

  useEffect(() => { cargar() }, [cargar])

  // Reset page cuando cambian filtros
  const onCambiarFiltro = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }))
    setPage(1)
  }

  const limpiarFiltros = () => {
    setFiltros(FILTROS_INICIALES)
    setPage(1)
  }

  const filtrosActivos = useMemo(
    () => Object.values(filtros).filter((v) => v && v.length > 0).length,
    [filtros],
  )

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setTab('datos')
    setEditando(null)
    setForm(FORM_INICIAL)
    setErrorForm('')
    setModal(true)
  }

  const abrirEditar = (p: ProcesoInstancia) => {
    setTab('datos')
    setEditando(p)
    setForm({
      codigo_categoria_proceso: p.codigo_categoria_proceso ?? '',
      codigo_tipo_proceso: p.codigo_tipo_proceso ?? '',
      codigo_estado: p.codigo_estado ?? '',
      codigo_usuario_asignado: p.codigo_usuario_asignado ?? '',
      nombre_proceso: p.nombre_proceso ?? '',
      descripcion_proceso: p.descripcion_proceso ?? '',
      comentarios_proceso: p.comentarios_proceso ?? '',
      fecha_comprometida: p.fecha_comprometida ? String(p.fecha_comprometida).slice(0, 16) : '',
      fecha_fin: p.fecha_fin ? String(p.fecha_fin).slice(0, 16) : '',
      costo_en_tiempo: p.costo_en_tiempo ?? '',
      costo: p.costo != null ? String(p.costo) : '',
    })
    setErrorForm('')
    setModal(true)
  }

  const cerrarModal = () => {
    setModal(false)
    setEditando(null)
  }

  const updateForm = <K extends keyof FormInstancia>(campo: K, valor: FormInstancia[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  const guardar = async (opts?: { cerrar?: boolean }) => {
    const cerrar = opts?.cerrar !== false
    setGuardando(true)
    setErrorForm('')
    try {
      if (editando) {
        await procesosInstanciasApi.actualizar(editando.codigo_proceso, {
          codigo_estado: form.codigo_estado || undefined,
          codigo_usuario_asignado: form.codigo_usuario_asignado || undefined,
          nombre_proceso: form.nombre_proceso || undefined,
          descripcion_proceso: form.descripcion_proceso || undefined,
          comentarios_proceso: form.comentarios_proceso || undefined,
          fecha_comprometida: form.fecha_comprometida || undefined,
          fecha_fin: form.fecha_fin || undefined,
          costo_en_tiempo: form.costo_en_tiempo || undefined,
          costo: form.costo ? parseFloat(form.costo) : undefined,
        })
      } else {
        if (!form.codigo_categoria_proceso || !form.codigo_tipo_proceso || !form.codigo_estado) {
          throw new Error(tpx('categoriaTipoEstado'))
        }
        await procesosInstanciasApi.crear({
          codigo_categoria_proceso: form.codigo_categoria_proceso,
          codigo_tipo_proceso: form.codigo_tipo_proceso,
          codigo_estado: form.codigo_estado,
          codigo_usuario_asignado: form.codigo_usuario_asignado || undefined,
          nombre_proceso: form.nombre_proceso || undefined,
          descripcion_proceso: form.descripcion_proceso || undefined,
          comentarios_proceso: form.comentarios_proceso || undefined,
          fecha_comprometida: form.fecha_comprometida || undefined,
          costo: form.costo ? parseFloat(form.costo) : undefined,
        })
      }
      if (cerrar) cerrarModal()
      cargar()
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEliminacion = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await procesosInstanciasApi.eliminar(confirmacion.codigo_proceso)
      setConfirmacion(null)
      cargar()
    } catch (e) {
      console.error(e)
      setConfirmacion(null)
    } finally {
      setEliminando(false)
    }
  }

  // ── Selección masiva ───────────────────────────────────────────────────────
  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionados((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }, [])

  const todosSeleccionados = items.length > 0 && items.every((p) => seleccionados.has(p.codigo_proceso))
  const algunoSeleccionado = seleccionados.size > 0

  const toggleTodos = () => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (todosSeleccionados) {
        items.forEach((p) => next.delete(p.codigo_proceso))
      } else {
        items.forEach((p) => next.add(p.codigo_proceso))
      }
      return next
    })
  }

  const abrirModalBulk = (modo: 'seleccion' | 'fecha') => {
    setBulkModo(modo)
    setBulkFechaDesde('')
    setBulkFechaHasta('')
    setBulkError('')
    setModalBulk(true)
  }

  const ejecutarBulk = async () => {
    setBulkError('')
    if (bulkModo === 'seleccion' && seleccionados.size === 0) {
      setBulkError('No hay registros seleccionados.')
      return
    }
    if (bulkModo === 'fecha' && !bulkFechaDesde && !bulkFechaHasta) {
      setBulkError('Debe indicar al menos una fecha.')
      return
    }
    setBulkEliminando(true)
    try {
      const params: { codigos_proceso?: string[]; fecha_inicio_desde?: string; fecha_inicio_hasta?: string } = {}
      if (bulkModo === 'seleccion') {
        params.codigos_proceso = Array.from(seleccionados)
      } else {
        if (bulkFechaDesde) params.fecha_inicio_desde = bulkFechaDesde
        if (bulkFechaHasta) params.fecha_inicio_hasta = bulkFechaHasta + 'T23:59:59'
      }
      await procesosInstanciasApi.eliminarBulk(params)
      setModalBulk(false)
      setSeleccionados(new Set())
      cargar()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al eliminar'
      setBulkError(msg)
    } finally {
      setBulkEliminando(false)
    }
  }

  // ── Opciones para selectores ───────────────────────────────────────────────
  const opcionesCategorias = useMemo(
    () => [...categorias]
      .sort((a, b) => a.nombre_categoria_proceso.localeCompare(b.nombre_categoria_proceso))
      .map((c) => ({ valor: c.codigo_categoria_proceso, etiqueta: c.nombre_categoria_proceso, hint: c.codigo_categoria_proceso })),
    [categorias],
  )

  const opcionesTiposForm = useMemo(
    () => [...tiposProc]
      .filter((tp) => !form.codigo_categoria_proceso || tp.codigo_categoria_proceso === form.codigo_categoria_proceso)
      .sort((a, b) => a.nombre_tipo_proceso.localeCompare(b.nombre_tipo_proceso))
      .map((tp) => ({ valor: tp.codigo_tipo_proceso, etiqueta: tp.nombre_tipo_proceso, hint: tp.codigo_tipo_proceso })),
    [tiposProc, form.codigo_categoria_proceso],
  )

  const opcionesTiposFiltro = useMemo(
    () => [...tiposProc]
      .filter((tp) => !filtros.codigo_categoria_proceso || tp.codigo_categoria_proceso === filtros.codigo_categoria_proceso)
      .sort((a, b) => a.nombre_tipo_proceso.localeCompare(b.nombre_tipo_proceso))
      .map((tp) => ({ valor: tp.codigo_tipo_proceso, etiqueta: tp.nombre_tipo_proceso, hint: tp.codigo_tipo_proceso })),
    [tiposProc, filtros.codigo_categoria_proceso],
  )

  const opcionesEstadosForm = useMemo(
    () => [...estadosProc]
      .filter((e) =>
        (!form.codigo_categoria_proceso || e.codigo_categoria_proceso === form.codigo_categoria_proceso) &&
        (!form.codigo_tipo_proceso || e.codigo_tipo_proceso === form.codigo_tipo_proceso),
      )
      .sort((a, b) => a.nombre_estado.localeCompare(b.nombre_estado))
      .map((e) => ({ valor: e.codigo_estado_proceso, etiqueta: e.nombre_estado, hint: e.codigo_estado_proceso })),
    [estadosProc, form.codigo_categoria_proceso, form.codigo_tipo_proceso],
  )

  // Estados únicos para filtro (sin filtrar por categoría/tipo del form)
  const opcionesEstadosFiltro = useMemo(() => {
    const unicos = new Map<string, string>()
    estadosProc
      .filter((e) =>
        (!filtros.codigo_categoria_proceso || e.codigo_categoria_proceso === filtros.codigo_categoria_proceso) &&
        (!filtros.codigo_tipo_proceso || e.codigo_tipo_proceso === filtros.codigo_tipo_proceso),
      )
      .forEach((e) => {
        if (!unicos.has(e.codigo_estado_proceso)) unicos.set(e.codigo_estado_proceso, e.nombre_estado)
      })
    return Array.from(unicos.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([codigo, nombre]) => ({ valor: codigo, etiqueta: nombre, hint: codigo }))
  }, [estadosProc, filtros.codigo_categoria_proceso, filtros.codigo_tipo_proceso])

  const opcionesUsuarios = useMemo(
    () => [...usuarios]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((u) => ({ valor: u.codigo_usuario, etiqueta: u.nombre, hint: u.codigo_usuario })),
    [usuarios],
  )

  const opcionesGrupos = useMemo(
    () => [...grupos]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((g) => ({ valor: g.codigo_grupo, etiqueta: g.nombre, hint: g.codigo_grupo })),
    [grupos],
  )

  // ── Helpers de display ─────────────────────────────────────────────────────
  const nombreCategoria = (p: ProcesoInstancia) => {
    if (!p.codigo_categoria_proceso) return ''
    const cat = categorias.find((c) => c.codigo_categoria_proceso === p.codigo_categoria_proceso)
    return cat ? cat.nombre_categoria_proceso : p.codigo_categoria_proceso
  }

  const nombreTipo = (p: ProcesoInstancia) => {
    if (!p.codigo_tipo_proceso) return ''
    const tp = tiposProc.find((t) => t.codigo_tipo_proceso === p.codigo_tipo_proceso)
    return tp ? tp.nombre_tipo_proceso : p.codigo_tipo_proceso
  }

  const nombreUsuario = (codigo: string | null | undefined) => {
    if (!codigo) return ''
    const u = usuarios.find((u) => u.codigo_usuario === codigo)
    return u ? u.nombre : codigo
  }

  const nombreGrupo = (codigo: string | null | undefined) => {
    if (!codigo) return ''
    const g = grupos.find((g) => g.codigo_grupo === codigo)
    return g ? g.nombre : codigo
  }

  const exportarExcelData = () => {
    exportarExcel(
      items as unknown as Record<string, unknown>[],
      [
        { titulo: 'Código', campo: 'codigo_proceso' },
        { titulo: 'Categoría', campo: 'codigo_categoria_proceso' },
        { titulo: 'Tipo', campo: 'codigo_tipo_proceso' },
        { titulo: 'Nombre', campo: 'nombre_proceso' },
        { titulo: 'Estado', campo: 'codigo_estado' },
        { titulo: 'Grupo', campo: 'codigo_grupo' },
        { titulo: 'Usuario asignado', campo: 'codigo_usuario_asignado' },
        { titulo: 'Fecha inicio', campo: 'fecha_inicio' },
      ],
      'procesos-instancias',
    )
  }

  const tituloModal = editando
    ? `Editar Proceso: ${editando.nombre_proceso ?? editando.codigo_proceso} - ${editando.codigo_proceso}`
    : 'Nuevo proceso'

  const TABS: { key: Tab; label: string }[] = [
    { key: 'datos', label: tc('datos') },
    { key: 'detalle', label: tc('detalle') },
  ]

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat className="top-0 right-0" />
      <PageHeader className="pr-28" />

      {/* Barra superior: búsqueda + acciones */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="max-w-sm flex-1 min-w-[240px]">
          <Input
            placeholder="Buscar proceso..."
            value={filtros.q}
            onChange={(e) => onCambiarFiltro('q', e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <Boton
          variante="contorno"
          tamano="sm"
          onClick={() => setFiltrosVisibles((v) => !v)}
        >
          <Filter size={15} />
          Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''}
        </Boton>
        {filtrosActivos > 0 && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="flex items-center gap-1 text-sm text-texto-muted hover:text-texto"
            title="Limpiar filtros"
          >
            <X size={14} />
            Limpiar
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={exportarExcelData}
            disabled={items.length === 0}
          >
            <Download size={15} />
            Excel
          </Boton>
          <Boton variante="primario" onClick={abrirNuevo}>
            <Plus size={16} />
            Nuevo
          </Boton>
        </div>
      </div>

      {/* Panel de filtros */}
      {filtrosVisibles && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 border border-borde rounded-lg bg-fondo">
          <SelectorBuscable
            etiqueta="Categoría"
            valor={filtros.codigo_categoria_proceso}
            opciones={opcionesCategorias}
            onSeleccionar={(v) => {
              setFiltros((prev) => ({ ...prev, codigo_categoria_proceso: v, codigo_tipo_proceso: '', codigo_estado: '' }))
              setPage(1)
            }}
            placeholder="Todas las categorías"
          />
          <SelectorBuscable
            etiqueta="Tipo"
            valor={filtros.codigo_tipo_proceso}
            opciones={opcionesTiposFiltro}
            onSeleccionar={(v) => {
              setFiltros((prev) => ({ ...prev, codigo_tipo_proceso: v, codigo_estado: '' }))
              setPage(1)
            }}
            placeholder="Todos los tipos"
          />
          <SelectorBuscable
            etiqueta="Estado"
            valor={filtros.codigo_estado}
            opciones={opcionesEstadosFiltro}
            onSeleccionar={(v) => onCambiarFiltro('codigo_estado', v)}
            placeholder="Todos los estados"
          />
          <SelectorBuscable
            etiqueta="Grupo"
            valor={filtros.codigo_grupo}
            opciones={opcionesGrupos}
            onSeleccionar={(v) => onCambiarFiltro('codigo_grupo', v)}
            placeholder="Todos los grupos"
          />
          <SelectorBuscable
            etiqueta="Usuario"
            valor={filtros.codigo_usuario}
            opciones={opcionesUsuarios}
            onSeleccionar={(v) => onCambiarFiltro('codigo_usuario', v)}
            placeholder="Todos los usuarios"
          />
        </div>
      )}

      {/* Acciones masivas */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={toggleTodos}
          className="flex items-center gap-1.5 text-sm text-texto-muted hover:text-texto transition-colors"
          title={todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
        >
          {todosSeleccionados
            ? <CheckSquare size={16} className="text-primario" />
            : <Square size={16} />}
          {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>

        {algunoSeleccionado && (
          <button
            type="button"
            onClick={() => abrirModalBulk('seleccion')}
            className="flex items-center gap-1.5 text-sm text-white bg-error hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
            Eliminar seleccionados ({seleccionados.size})
          </button>
        )}

        <button
          type="button"
          onClick={() => abrirModalBulk('fecha')}
          className="flex items-center gap-1.5 text-sm text-error border border-error hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
        >
          <Calendar size={14} />
          Eliminar por fecha
        </button>
      </div>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh className="w-10" />
            <TablaTh className="w-24">Código</TablaTh>
            <TablaTh className="w-56">Categoría / Tipo</TablaTh>
            <TablaTh>Nombre</TablaTh>
            <TablaTh className="w-28">Estado</TablaTh>
            <TablaTh className="w-44">Grupo</TablaTh>
            <TablaTh className="w-44">Usuario</TablaTh>
            <TablaTh className="w-36">Fecha / Hora</TablaTh>
            <TablaTh className="text-right w-24">Acciones</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={9 as never}>
                Cargando...
              </TablaTd>
            </TablaFila>
          ) : items.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={9 as never}>
                No hay instancias de proceso
              </TablaTd>
            </TablaFila>
          ) : (
            items.map((p) => (
              <TablaFila key={p.codigo_proceso}>
                <TablaTd>
                  <input
                    type="checkbox"
                    checked={seleccionados.has(p.codigo_proceso)}
                    onChange={() => toggleSeleccion(p.codigo_proceso)}
                    className="accent-primario cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </TablaTd>
                <TablaTd onDoubleClick={() => abrirEditar(p)}>
                  <code className="text-xs bg-fondo px-2 py-1 rounded font-mono">
                    {p.codigo_proceso}
                  </code>
                </TablaTd>
                <TablaTd className="w-56" onDoubleClick={() => abrirEditar(p)}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-texto-muted whitespace-normal break-words">
                      {nombreCategoria(p)}
                    </span>
                    <span className="text-sm font-medium whitespace-normal break-words">
                      {nombreTipo(p)}
                    </span>
                  </div>
                </TablaTd>
                <TablaTd onDoubleClick={() => abrirEditar(p)}>
                  <span className="text-sm">{p.nombre_proceso ?? '—'}</span>
                </TablaTd>
                <TablaTd onDoubleClick={() => abrirEditar(p)}>
                  {p.codigo_estado ? (
                    <Insignia variante="primario">{p.codigo_estado}</Insignia>
                  ) : (
                    <span className="text-xs text-texto-muted">—</span>
                  )}
                </TablaTd>
                <TablaTd onDoubleClick={() => abrirEditar(p)}>
                  <span className="text-sm text-texto-muted">
                    {nombreGrupo(p.codigo_grupo) || '—'}
                  </span>
                </TablaTd>
                <TablaTd onDoubleClick={() => abrirEditar(p)}>
                  <span className="text-sm text-texto-muted">
                    {nombreUsuario(p.codigo_usuario_asignado) || nombreUsuario(p.codigo_usuario) || '—'}
                  </span>
                </TablaTd>
                <TablaTd onDoubleClick={() => abrirEditar(p)}>
                  <span className="text-xs text-texto-muted whitespace-nowrap">
                    {fmtFechaHora(p.fecha_inicio)}
                  </span>
                </TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => abrirEditar(p)}
                      className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmacion(p)}
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

      <Paginador
        page={page}
        limit={pageSize}
        total={total}
        onChangePage={setPage}
        onChangeLimit={(n) => { setPageSize(n); setPage(1) }}
        cargando={cargando}
        opcionesLimit={[20, 50, 100, 200]}
      />

      {/* Modal crear / editar */}
      <Modal
        abierto={modal}
        alCerrar={cerrarModal}
        titulo={tituloModal}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-0 border-b border-borde -mt-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 text-center px-4 py-2 tab-nav${tab === t.key ? ' tab-nav-activo' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-[420px] flex flex-col">
            {tab === 'datos' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <SelectorBuscable
                    etiqueta="Categoría"
                    valor={form.codigo_categoria_proceso}
                    opciones={opcionesCategorias}
                    onSeleccionar={(v) => {
                      updateForm('codigo_categoria_proceso', v)
                      updateForm('codigo_tipo_proceso', '')
                      updateForm('codigo_estado', '')
                    }}
                    placeholder={tpx('buscarCategoria')}
                    disabled={!!editando}
                  />
                  <SelectorBuscable
                    etiqueta="Tipo de proceso"
                    valor={form.codigo_tipo_proceso}
                    opciones={opcionesTiposForm}
                    onSeleccionar={(v) => {
                      updateForm('codigo_tipo_proceso', v)
                      updateForm('codigo_estado', '')
                    }}
                    placeholder={form.codigo_categoria_proceso ? 'Buscar tipo...' : tpx('seleccioneCategoria')}
                    disabled={!form.codigo_categoria_proceso || !!editando}
                  />
                  <Input
                    etiqueta="Grupo"
                    value={
                      editando
                        ? nombreGrupo(editando.codigo_grupo) || editando.codigo_grupo || ''
                        : nombreGrupo(usuario?.grupo_activo) || usuario?.grupo_activo || ''
                    }
                    onChange={() => {}}
                    disabled
                  />
                  <Input
                    etiqueta="Entidad"
                    value={editando?.codigo_entidad ?? usuario?.entidad_activa ?? ''}
                    onChange={() => {}}
                    disabled
                  />
                  {editando && (
                    <Input etiqueta={tc('codigo')} value={editando.codigo_proceso} onChange={() => {}} disabled />
                  )}
                  <Input
                    etiqueta="Nombre"
                    value={form.nombre_proceso}
                    onChange={(e) => updateForm('nombre_proceso', e.target.value)}
                    placeholder="Nombre del proceso"
                    autoFocus={!editando}
                  />
                  <SelectorBuscable
                    etiqueta="Estado"
                    valor={form.codigo_estado}
                    opciones={opcionesEstadosForm}
                    onSeleccionar={(v) => updateForm('codigo_estado', v)}
                    placeholder={form.codigo_tipo_proceso ? 'Buscar estado...' : 'Seleccione tipo primero'}
                    disabled={!form.codigo_tipo_proceso}
                  />
                  <SelectorBuscable
                    etiqueta="Usuario asignado"
                    valor={form.codigo_usuario_asignado}
                    opciones={opcionesUsuarios}
                    onSeleccionar={(v) => updateForm('codigo_usuario_asignado', v)}
                    placeholder="Buscar usuario..."
                  />
                </div>
                <Textarea
                  etiqueta="Descripción"
                  value={form.descripcion_proceso}
                  onChange={(e) => updateForm('descripcion_proceso', e.target.value)}
                  placeholder={tpx('descripcionProceso')}
                  rows={3}
                />
              </div>
            )}

            {tab === 'detalle' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    etiqueta="Fecha comprometida"
                    type="datetime-local"
                    value={form.fecha_comprometida}
                    onChange={(e) => updateForm('fecha_comprometida', e.target.value)}
                  />
                  <Input
                    etiqueta="Fecha fin"
                    type="datetime-local"
                    value={form.fecha_fin}
                    onChange={(e) => updateForm('fecha_fin', e.target.value)}
                  />
                  <Input
                    etiqueta="Costo en tiempo (hh:mm)"
                    value={form.costo_en_tiempo}
                    onChange={(e) => updateForm('costo_en_tiempo', e.target.value)}
                    placeholder="ej: 02:30"
                  />
                  <Input
                    etiqueta="Costo"
                    type="number"
                    step="0.0001"
                    value={form.costo}
                    onChange={(e) => updateForm('costo', e.target.value)}
                    placeholder="0.0000"
                  />
                </div>
                <Textarea
                  etiqueta="Comentarios"
                  value={form.comentarios_proceso}
                  onChange={(e) => updateForm('comentarios_proceso', e.target.value)}
                  placeholder="Comentarios adicionales"
                  rows={3}
                />
              </div>
            )}
          </div>

          {errorForm && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorForm}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!editando}
            onGuardar={() => guardar({ cerrar: false })}
            onGuardarYSalir={() => guardar({ cerrar: true })}
            onCerrar={cerrarModal}
            cargando={guardando}
          />
        </div>
      </Modal>

      {/* Modal eliminación individual */}
      <ModalConfirmar
        abierto={!!confirmacion}
        titulo="Eliminar proceso"
        mensaje={tpx('eliminarInstancia', { nombre: confirmacion?.nombre_proceso ?? confirmacion?.codigo_proceso ?? '' })}
        alConfirmar={ejecutarEliminacion}
        alCerrar={() => setConfirmacion(null)}
        cargando={eliminando}
      />

      {/* Modal eliminación masiva */}
      <Modal
        abierto={modalBulk}
        alCerrar={() => setModalBulk(false)}
        titulo={bulkModo === 'seleccion' ? `Eliminar ${seleccionados.size} procesos` : 'Eliminar procesos por fecha'}
        className="max-w-md"
      >
        <div className="flex flex-col gap-4">
          {bulkModo === 'seleccion' ? (
            <p className="text-sm text-texto-muted">
              Se eliminarán permanentemente <strong>{seleccionados.size}</strong> registro{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}.
              Esta acción no se puede deshacer.
            </p>
          ) : (
            <>
              <p className="text-sm text-texto-muted">
                Elimina todos los procesos cuya fecha de inicio esté dentro del rango indicado.
                Deja vacío un campo para no limitar ese extremo.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  etiqueta="Fecha desde"
                  type="date"
                  value={bulkFechaDesde}
                  onChange={(e) => setBulkFechaDesde(e.target.value)}
                />
                <Input
                  etiqueta="Fecha hasta"
                  type="date"
                  value={bulkFechaHasta}
                  onChange={(e) => setBulkFechaHasta(e.target.value)}
                />
              </div>
              <p className="text-xs text-error font-medium">
                Esta acción no se puede deshacer. Se eliminarán todos los procesos del rango.
              </p>
            </>
          )}

          {bulkError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{bulkError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalBulk(false)}
              disabled={bulkEliminando}
              className="px-4 py-2 text-sm text-texto-muted hover:text-texto border border-borde rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={ejecutarBulk}
              disabled={bulkEliminando}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-error hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
            >
              {bulkEliminando ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Trash2 size={14} />
              )}
              {bulkEliminando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
