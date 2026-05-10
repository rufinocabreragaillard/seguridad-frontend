'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import {
  TablaCrud,
  columnaCodigo,
} from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import {
  procesosInstanciasApi,
  procesosDatosBasicosApi,
  usuariosApi,
} from '@/lib/api'
import type { ProcesoInstancia } from '@/lib/api'
import type { CategoriaProceso, TipoProceso, EstadoProceso, Usuario } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'
import { SelectorBuscable } from '@/components/ui/selector-buscable'
import { Trash2, CheckSquare, Square, Calendar } from 'lucide-react'

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

export default function PaginaProcesoInstancias() {
  const { usuario } = useAuth()
  const [categorias, setCategorias] = useState<CategoriaProceso[]>([])
  const [tiposProc, setTiposProc] = useState<TipoProceso[]>([])
  const [estadosProc, setEstadosProc] = useState<EstadoProceso[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [tab, setTab] = useState<Tab>('datos')

  // ── Selección masiva ───────────────────────────────────────────────────────
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [modalBulk, setModalBulk] = useState(false)
  const [bulkFechaDesde, setBulkFechaDesde] = useState('')
  const [bulkFechaHasta, setBulkFechaHasta] = useState('')
  const [bulkEliminando, setBulkEliminando] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkModo, setBulkModo] = useState<'seleccion' | 'fecha'>('seleccion')

  useEffect(() => {
    procesosDatosBasicosApi.listarCategorias().then(setCategorias).catch(() => setCategorias([]))
    procesosDatosBasicosApi.listarTipos().then(setTiposProc).catch(() => setTiposProc([]))
    procesosDatosBasicosApi.listarEstados().then(setEstadosProc).catch(() => setEstadosProc([]))
    usuariosApi.listar().then(setUsuarios).catch(() => setUsuarios([]))
  }, [])

  const crud = useCrudPage<ProcesoInstancia, FormInstancia>({
    cargarFn: () => procesosInstanciasApi.listar({ limit: 500 }),
    crearFn: async (f) => {
      if (!f.codigo_categoria_proceso || !f.codigo_tipo_proceso || !f.codigo_estado) {
        throw new Error('Categoría, tipo y estado son obligatorios.')
      }
      return procesosInstanciasApi.crear({
        codigo_categoria_proceso: f.codigo_categoria_proceso,
        codigo_tipo_proceso: f.codigo_tipo_proceso,
        codigo_estado: f.codigo_estado,
        codigo_usuario_asignado: f.codigo_usuario_asignado || undefined,
        nombre_proceso: f.nombre_proceso || undefined,
        descripcion_proceso: f.descripcion_proceso || undefined,
        comentarios_proceso: f.comentarios_proceso || undefined,
        fecha_comprometida: f.fecha_comprometida || undefined,
        costo: f.costo ? parseFloat(f.costo) : undefined,
      })
    },
    actualizarFn: async (id, f) =>
      procesosInstanciasApi.actualizar(id, {
        codigo_estado: f.codigo_estado || undefined,
        codigo_usuario_asignado: f.codigo_usuario_asignado || undefined,
        nombre_proceso: f.nombre_proceso || undefined,
        descripcion_proceso: f.descripcion_proceso || undefined,
        comentarios_proceso: f.comentarios_proceso || undefined,
        fecha_comprometida: f.fecha_comprometida || undefined,
        fecha_fin: f.fecha_fin || undefined,
        costo_en_tiempo: f.costo_en_tiempo || undefined,
        costo: f.costo ? parseFloat(f.costo) : undefined,
      }),
    eliminarFn: (id) => procesosInstanciasApi.eliminar(id).then(() => undefined),
    getId: (p) => p.codigo_proceso,
    camposBusqueda: (p) => [
      p.codigo_proceso,
      p.nombre_proceso ?? '',
      p.codigo_tipo_proceso ?? '',
      p.codigo_categoria_proceso ?? '',
      p.codigo_estado ?? '',
      p.codigo_grupo ?? '',
      p.codigo_usuario_asignado ?? '',
    ],
    formInicial: FORM_INICIAL,
    itemToForm: (p) => ({
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
    }),
  })

  const abrirNuevo = () => { setTab('datos'); crud.abrirNuevo() }
  const abrirEditar = (p: ProcesoInstancia) => { setTab('datos'); crud.abrirEditar(p) }

  // ── Selección masiva helpers ───────────────────────────────────────────────
  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionados(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }, [])

  const todosSeleccionados = crud.filtrados.length > 0 && seleccionados.size === crud.filtrados.length
  const algunoSeleccionado = seleccionados.size > 0

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(crud.filtrados.map(p => p.codigo_proceso)))
    }
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
      const res = await procesosInstanciasApi.eliminarBulk(params)
      setModalBulk(false)
      setSeleccionados(new Set())
      crud.cargar()
      // eslint-disable-next-line no-console
      console.info(`Eliminados: ${res.eliminados} procesos`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al eliminar'
      setBulkError(msg)
    } finally {
      setBulkEliminando(false)
    }
  }

  // ── Opciones selectores ───────────────────────────────────────────────────
  const opcionesCategorias = [...categorias]
    .sort((a, b) => a.nombre_categoria_proceso.localeCompare(b.nombre_categoria_proceso))
    .map((c) => ({ valor: c.codigo_categoria_proceso, etiqueta: c.nombre_categoria_proceso, hint: c.codigo_categoria_proceso }))

  const opcionesTipos = [...tiposProc]
    .filter((tp) => !crud.form.codigo_categoria_proceso || tp.codigo_categoria_proceso === crud.form.codigo_categoria_proceso)
    .sort((a, b) => a.nombre_tipo_proceso.localeCompare(b.nombre_tipo_proceso))
    .map((tp) => ({ valor: tp.codigo_tipo_proceso, etiqueta: tp.nombre_tipo_proceso, hint: tp.codigo_tipo_proceso }))

  const opcionesEstados = [...estadosProc]
    .filter((e) =>
      (!crud.form.codigo_categoria_proceso || e.codigo_categoria_proceso === crud.form.codigo_categoria_proceso) &&
      (!crud.form.codigo_tipo_proceso || e.codigo_tipo_proceso === crud.form.codigo_tipo_proceso)
    )
    .sort((a, b) => a.nombre_estado.localeCompare(b.nombre_estado))
    .map((e) => ({ valor: e.codigo_estado_proceso, etiqueta: e.nombre_estado, hint: e.codigo_estado_proceso }))

  const opcionesUsuarios = [...usuarios]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((u) => ({ valor: u.codigo_usuario, etiqueta: u.nombre, hint: u.codigo_usuario }))

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

  const tituloModal = crud.editando
    ? `Editar Proceso: ${crud.editando.nombre_proceso ?? crud.editando.codigo_proceso} - ${crud.editando.codigo_proceso}`
    : 'Nuevo proceso'

  const TABS: { key: Tab; label: string }[] = [
    { key: 'datos', label: 'Datos' },
    { key: 'detalle', label: 'Detalle' },
  ]

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <PageHeader className="pr-28" />

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda="Buscar proceso..."
        onNuevo={abrirNuevo}
        excelDatos={crud.filtrados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'Código', campo: 'codigo_proceso' },
          { titulo: 'Categoría', campo: 'codigo_categoria_proceso' },
          { titulo: 'Tipo', campo: 'codigo_tipo_proceso' },
          { titulo: 'Nombre', campo: 'nombre_proceso' },
          { titulo: 'Estado', campo: 'codigo_estado' },
          { titulo: 'Grupo', campo: 'codigo_grupo' },
          { titulo: 'Usuario asignado', campo: 'codigo_usuario_asignado' },
          { titulo: 'Fecha inicio', campo: 'fecha_inicio' },
        ]}
        excelNombreArchivo="procesos-instancias"
      />

      {/* Barra de acciones masivas */}
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

      <TablaCrud
        columnas={[
          {
            titulo: '',
            render: (p: ProcesoInstancia) => (
              <input
                type="checkbox"
                checked={seleccionados.has(p.codigo_proceso)}
                onChange={() => toggleSeleccion(p.codigo_proceso)}
                className="accent-primario cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
            ),
          },
          columnaCodigo<ProcesoInstancia>('Código', (p) => p.codigo_proceso),
          {
            titulo: 'Categoría / Tipo',
            render: (p: ProcesoInstancia) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-texto-muted">{nombreCategoria(p)}</span>
                <span className="text-sm font-medium">{nombreTipo(p)}</span>
              </div>
            ),
          },
          {
            titulo: 'Nombre',
            render: (p: ProcesoInstancia) => (
              <span className="text-sm">{p.nombre_proceso ?? '—'}</span>
            ),
          },
          {
            titulo: 'Estado',
            render: (p: ProcesoInstancia) =>
              p.codigo_estado ? (
                <Insignia variante="primario">{p.codigo_estado}</Insignia>
              ) : (
                <span className="text-xs text-texto-muted">—</span>
              ),
          },
          {
            titulo: 'Grupo',
            render: (p: ProcesoInstancia) => (
              <span className="text-sm text-texto-muted">{p.codigo_grupo ?? '—'}</span>
            ),
          },
          {
            titulo: 'Usuario',
            render: (p: ProcesoInstancia) => (
              <span className="text-sm text-texto-muted">{nombreUsuario(p.codigo_usuario_asignado) || '—'}</span>
            ),
          },
          {
            titulo: 'Inicio',
            render: (p: ProcesoInstancia) => (
              <span className="text-xs text-texto-muted">
                {p.fecha_inicio ? new Date(String(p.fecha_inicio)).toLocaleDateString('es-CL') : '—'}
              </span>
            ),
          },
        ]}
        items={crud.filtrados}
        cargando={crud.cargando}
        getId={(p) => p.codigo_proceso}
        onEditar={abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="No hay instancias de proceso"
      />

      {/* Modal crear / editar */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={tituloModal}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 min-w-[520px]">
          {/* Tabs */}
          <div className="flex gap-0 border-b border-borde -mt-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 text-center px-4 py-2 text-sm border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-primario text-primario font-medium'
                    : 'border-transparent text-texto-muted hover:text-texto'
                }`}
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
                  valor={crud.form.codigo_categoria_proceso}
                  opciones={opcionesCategorias}
                  onSeleccionar={(v) => {
                    crud.updateForm('codigo_categoria_proceso', v)
                    crud.updateForm('codigo_tipo_proceso', '')
                    crud.updateForm('codigo_estado', '')
                  }}
                  placeholder="Buscar categoría..."
                  disabled={!!crud.editando}
                />
                <SelectorBuscable
                  etiqueta="Tipo de proceso"
                  valor={crud.form.codigo_tipo_proceso}
                  opciones={opcionesTipos}
                  onSeleccionar={(v) => {
                    crud.updateForm('codigo_tipo_proceso', v)
                    crud.updateForm('codigo_estado', '')
                  }}
                  placeholder={crud.form.codigo_categoria_proceso ? 'Buscar tipo...' : 'Seleccione categoría primero'}
                  disabled={!crud.form.codigo_categoria_proceso || !!crud.editando}
                />
                <Input
                  etiqueta="Grupo"
                  value={crud.editando?.codigo_grupo ?? usuario?.grupo_activo ?? ''}
                  onChange={() => {}}
                  disabled
                />
                <Input
                  etiqueta="Entidad"
                  value={crud.editando?.codigo_entidad ?? usuario?.entidad_activa ?? ''}
                  onChange={() => {}}
                  disabled
                />
                {crud.editando && (
                  <Input etiqueta="Código" value={crud.editando.codigo_proceso} onChange={() => {}} disabled />
                )}
                <Input
                  etiqueta="Nombre"
                  value={crud.form.nombre_proceso}
                  onChange={(e) => crud.updateForm('nombre_proceso', e.target.value)}
                  placeholder="Nombre del proceso"
                  autoFocus={!crud.editando}
                />
                <SelectorBuscable
                  etiqueta="Estado"
                  valor={crud.form.codigo_estado}
                  opciones={opcionesEstados}
                  onSeleccionar={(v) => crud.updateForm('codigo_estado', v)}
                  placeholder={crud.form.codigo_tipo_proceso ? 'Buscar estado...' : 'Seleccione tipo primero'}
                  disabled={!crud.form.codigo_tipo_proceso}
                />
                <SelectorBuscable
                  etiqueta="Usuario asignado"
                  valor={crud.form.codigo_usuario_asignado}
                  opciones={opcionesUsuarios}
                  onSeleccionar={(v) => crud.updateForm('codigo_usuario_asignado', v)}
                  placeholder="Buscar usuario..."
                />
              </div>
              <Textarea
                etiqueta="Descripción"
                value={crud.form.descripcion_proceso}
                onChange={(e) => crud.updateForm('descripcion_proceso', e.target.value)}
                placeholder="Descripción del proceso"
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
                  value={crud.form.fecha_comprometida}
                  onChange={(e) => crud.updateForm('fecha_comprometida', e.target.value)}
                />
                <Input
                  etiqueta="Fecha fin"
                  type="datetime-local"
                  value={crud.form.fecha_fin}
                  onChange={(e) => crud.updateForm('fecha_fin', e.target.value)}
                />
                <Input
                  etiqueta="Costo en tiempo (hh:mm)"
                  value={crud.form.costo_en_tiempo}
                  onChange={(e) => crud.updateForm('costo_en_tiempo', e.target.value)}
                  placeholder="ej: 02:30"
                />
                <Input
                  etiqueta="Costo"
                  type="number"
                  step="0.0001"
                  value={crud.form.costo}
                  onChange={(e) => crud.updateForm('costo', e.target.value)}
                  placeholder="0.0000"
                />
              </div>
              <Textarea
                etiqueta="Comentarios"
                value={crud.form.comentarios_proceso}
                onChange={(e) => crud.updateForm('comentarios_proceso', e.target.value)}
                placeholder="Comentarios adicionales"
                rows={3}
              />
            </div>
          )}

          </div>

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!crud.editando}
            onGuardar={() => crud.guardar(undefined, undefined, { cerrar: false })}
            onGuardarYSalir={() => crud.guardar(undefined, undefined, { cerrar: true })}
            onCerrar={crud.cerrarModal}
            cargando={crud.guardando}
          />
        </div>
      </Modal>

      {/* Modal eliminación individual */}
      <ModalConfirmar
        abierto={!!crud.confirmacion}
        titulo="Eliminar proceso"
        mensaje={`¿Eliminar la instancia "${crud.confirmacion?.nombre_proceso ?? crud.confirmacion?.codigo_proceso}"? Esta acción no se puede deshacer.`}
        alConfirmar={crud.ejecutarEliminacion}
        alCerrar={() => crud.setConfirmacion(null)}
        cargando={crud.eliminando}
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
