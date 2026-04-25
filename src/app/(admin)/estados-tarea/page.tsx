'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { TablaCrud, columnaCodigo, columnaNombre, columnaDescripcion } from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { tareasDatosBasicosApi } from '@/lib/api'
import type { CategoriaTarea, EstadoTarea, EstadoCanonicoTarea } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'

type TipoTareaSimple = { codigo_tipo_tarea: string; nombre_tipo_tarea: string }

type FormEstadoTarea = {
  codigo_categoria_tarea: string
  codigo_tipo_tarea: string
  codigo_estado_tarea: string
  nombre_estado_tarea: string
  descripcion_estado_tarea: string
  codigo_estado_canonico: string
  orden: number
}

const FORM_INICIAL: FormEstadoTarea = {
  codigo_categoria_tarea: '',
  codigo_tipo_tarea: '',
  codigo_estado_tarea: '',
  nombre_estado_tarea: '',
  descripcion_estado_tarea: '',
  codigo_estado_canonico: '',
  orden: 0,
}

export default function PaginaEstadosTarea() {
  const [categorias, setCategorias] = useState<CategoriaTarea[]>([])
  const [tipos, setTipos] = useState<TipoTareaSimple[]>([])
  const [canonicos, setCanonicos] = useState<EstadoCanonicoTarea[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [tiposFiltrados, setTiposFiltrados] = useState<TipoTareaSimple[]>([])

  useEffect(() => {
    tareasDatosBasicosApi.listarCategorias().then(setCategorias).catch(() => {})
    tareasDatosBasicosApi.listarCanonicosTar().then(setCanonicos).catch(() => {})
  }, [])

  useEffect(() => {
    if (filtroCategoria) {
      tareasDatosBasicosApi.listarTiposTar(filtroCategoria).then((t) =>
        setTiposFiltrados(t.map((x) => ({ codigo_tipo_tarea: x.codigo_tipo_tarea, nombre_tipo_tarea: x.nombre_tipo_tarea })))
      ).catch(() => {})
    } else {
      setTiposFiltrados([])
    }
    setFiltroTipo('')
  }, [filtroCategoria])

  useEffect(() => {
    if (filtroCategoria) {
      tareasDatosBasicosApi.listarTiposTar(filtroCategoria).then((t) =>
        setTipos(t.map((x) => ({ codigo_tipo_tarea: x.codigo_tipo_tarea, nombre_tipo_tarea: x.nombre_tipo_tarea })))
      ).catch(() => {})
    } else {
      tareasDatosBasicosApi.listarTiposTar().then((t) =>
        setTipos(t.map((x) => ({ codigo_tipo_tarea: x.codigo_tipo_tarea, nombre_tipo_tarea: x.nombre_tipo_tarea })))
      ).catch(() => {})
    }
  }, [filtroCategoria])

  const crud = useCrudPage<EstadoTarea, FormEstadoTarea>({
    cargarFn: () =>
      tareasDatosBasicosApi.listarEstadosTar(
        filtroCategoria || filtroTipo
          ? { categoria: filtroCategoria || undefined, tipo: filtroTipo || undefined }
          : undefined
      ) as Promise<EstadoTarea[]>,
    crearFn: (f) =>
      tareasDatosBasicosApi.crearEstadoTar({
        codigo_categoria_tarea: f.codigo_categoria_tarea,
        codigo_tipo_tarea: f.codigo_tipo_tarea,
        codigo_estado_tarea: f.codigo_estado_tarea.trim() || undefined,
        nombre_estado_tarea: f.nombre_estado_tarea.trim(),
        descripcion_estado_tarea: f.descripcion_estado_tarea.trim() || undefined,
        codigo_estado_canonico: f.codigo_estado_canonico,
        orden: f.orden,
      } as any) as Promise<EstadoTarea>,
    actualizarFn: (id, f) => {
      const [, categoria, tipo, codigo] = id.split('/')
      return tareasDatosBasicosApi.actualizarEstadoTar(categoria, tipo, codigo, {
        nombre_estado_tarea: f.nombre_estado_tarea.trim(),
        descripcion_estado_tarea: f.descripcion_estado_tarea.trim() || undefined,
        codigo_estado_canonico: f.codigo_estado_canonico,
        orden: f.orden,
      } as any) as Promise<EstadoTarea>
    },
    eliminarFn: async (id) => {
      const [, categoria, tipo, codigo] = id.split('/')
      await tareasDatosBasicosApi.eliminarEstadoTar(categoria, tipo, codigo)
    },
    getId: (e) => `${e.codigo_grupo}/${e.codigo_categoria_tarea}/${e.codigo_tipo_tarea}/${e.codigo_estado_tarea}`,
    camposBusqueda: (e) => [e.codigo_estado_tarea, e.nombre_estado_tarea, e.descripcion_estado_tarea ?? ''],
    formInicial: FORM_INICIAL,
    itemToForm: (e) => ({
      codigo_categoria_tarea: e.codigo_categoria_tarea,
      codigo_tipo_tarea: e.codigo_tipo_tarea,
      codigo_estado_tarea: e.codigo_estado_tarea,
      nombre_estado_tarea: e.nombre_estado_tarea,
      descripcion_estado_tarea: e.descripcion_estado_tarea ?? '',
      codigo_estado_canonico: e.codigo_estado_canonico,
      orden: e.orden,
    }),
  })

  // Tipos disponibles en el modal (filtra por categoria seleccionada en form)
  const tiposModal = crud.form.codigo_categoria_tarea
    ? tipos.filter((t) => {
        // need full tipo to check category; load all on mount
        return true
      })
    : tipos

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) => {
    const catCmp = a.codigo_categoria_tarea.localeCompare(b.codigo_categoria_tarea)
    if (catCmp !== 0) return catCmp
    const tipCmp = a.codigo_tipo_tarea.localeCompare(b.codigo_tipo_tarea)
    return tipCmp !== 0 ? tipCmp : a.orden - b.orden
  })

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Estados de Tarea</h2>
        <p className="text-sm text-texto-muted mt-1">Estados por tipo de tarea para el grupo activo</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filtroCategoria}
          onChange={(e) => { setFiltroCategoria(e.target.value); crud.cargar() }}
          className="text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.codigo_categoria_tarea} value={c.codigo_categoria_tarea}>
              {c.nombre_categoria_tarea}
            </option>
          ))}
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); crud.cargar() }}
          className="text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario"
          disabled={!filtroCategoria}
        >
          <option value="">Todos los tipos</option>
          {tiposFiltrados.map((t) => (
            <option key={t.codigo_tipo_tarea} value={t.codigo_tipo_tarea}>
              {t.nombre_tipo_tarea}
            </option>
          ))}
        </select>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda="Buscar estado..."
        onNuevo={crud.abrirNuevo}
        textoNuevo="Nuevo Estado"
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'Categoría', campo: 'codigo_categoria_tarea' },
          { titulo: 'Tipo', campo: 'codigo_tipo_tarea' },
          { titulo: 'Código', campo: 'codigo_estado_tarea' },
          { titulo: 'Nombre', campo: 'nombre_estado_tarea' },
          { titulo: 'Canónico', campo: 'codigo_estado_canonico' },
          { titulo: 'Orden', campo: 'orden' },
          { titulo: 'Nombre', campo: 'nombre_estado_tarea' },
        ]}
        excelNombreArchivo="estados-tarea"
      />

      <TablaCrud
        columnas={[
          {
            titulo: 'Categoría',
            render: (e: EstadoTarea) => {
              const cat = categorias.find((c) => c.codigo_categoria_tarea === e.codigo_categoria_tarea)
              return <span className="text-xs text-texto-muted">{cat?.nombre_categoria_tarea ?? e.codigo_categoria_tarea}</span>
            },
          },
          {
            titulo: 'Tipo',
            render: (e: EstadoTarea) => (
              <span className="text-xs text-texto-muted">{e.codigo_tipo_tarea}</span>
            ),
          },
          columnaCodigo<EstadoTarea>('Código', (e) => e.codigo_estado_tarea),
          columnaNombre<EstadoTarea>('Nombre', (e) => e.nombre_estado_tarea),
          {
            titulo: 'Canónico',
            render: (e: EstadoTarea) => {
              const can = canonicos.find((c) => c.codigo_estado_canonico === e.codigo_estado_canonico)
              return <span className="text-xs">{can?.nombre_estado_canonico ?? e.codigo_estado_canonico}</span>
            },
          },
          {
            titulo: 'Orden',
            render: (e: EstadoTarea) => <span className="text-xs">{e.orden}</span>,
          },
          {
            titulo: 'Estado',
            render: (e: EstadoTarea) =>
              ,
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(e) => `${e.codigo_grupo}/${e.codigo_categoria_tarea}/${e.codigo_tipo_tarea}/${e.codigo_estado_tarea}`}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="Sin estados de tarea"
      />

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? `Editar: ${crud.editando.nombre_estado_tarea}` : 'Nuevo Estado de Tarea'}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4 min-w-[480px]">
          <div>
            <label className="text-sm font-medium text-texto block mb-1">
              Categoría <span className="text-error">*</span>
            </label>
            <select
              value={crud.form.codigo_categoria_tarea}
              onChange={(e) => crud.updateForm('codigo_categoria_tarea', e.target.value)}
              disabled={!!crud.editando}
              className="w-full text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-60"
            >
              <option value="">Seleccionar categoría...</option>
              {categorias.map((c) => (
                <option key={c.codigo_categoria_tarea} value={c.codigo_categoria_tarea}>
                  {c.nombre_categoria_tarea}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-texto block mb-1">
              Tipo de Tarea <span className="text-error">*</span>
            </label>
            <select
              value={crud.form.codigo_tipo_tarea}
              onChange={(e) => crud.updateForm('codigo_tipo_tarea', e.target.value)}
              disabled={!!crud.editando}
              className="w-full text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-60"
            >
              <option value="">Seleccionar tipo...</option>
              {tiposModal.map((t) => (
                <option key={t.codigo_tipo_tarea} value={t.codigo_tipo_tarea}>
                  {t.nombre_tipo_tarea}
                </option>
              ))}
            </select>
          </div>

          <Input
            etiqueta="Código"
            value={crud.form.codigo_estado_tarea}
            onChange={(e) => crud.updateForm('codigo_estado_tarea', e.target.value)}
            placeholder="Se genera automáticamente"
            disabled={!!crud.editando}
          />
          <Input
            etiqueta="Nombre"
            value={crud.form.nombre_estado_tarea}
            onChange={(e) => crud.updateForm('nombre_estado_tarea', e.target.value)}
            placeholder="Nombre del estado"
            autoFocus
          />
          <Textarea
            etiqueta="Descripción"
            value={crud.form.descripcion_estado_tarea}
            onChange={(e) => crud.updateForm('descripcion_estado_tarea', e.target.value)}
            placeholder="Descripción del estado"
            rows={2}
          />

          <div>
            <label className="text-sm font-medium text-texto block mb-1">
              Estado Canónico <span className="text-error">*</span>
            </label>
            <select
              value={crud.form.codigo_estado_canonico}
              onChange={(e) => crud.updateForm('codigo_estado_canonico', e.target.value)}
              className="w-full text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario"
            >
              <option value="">Seleccionar estado canónico...</option>
              {canonicos.map((c) => (
                <option key={c.codigo_estado_canonico} value={c.codigo_estado_canonico}>
                  {c.nombre_estado_canonico}
                </option>
              ))}
            </select>
          </div>

          <Input
            etiqueta="Orden"
            type="number"
            value={String(crud.form.orden)}
            onChange={(e) => crud.updateForm('orden', parseInt(e.target.value) || 0)}
            placeholder="0"
          />

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!crud.editando}
            onGuardar={() => {
              if (!crud.form.nombre_estado_tarea.trim()) { crud.setError('El nombre es obligatorio'); return }
              if (!crud.editando && !crud.form.codigo_categoria_tarea) { crud.setError('La categoría es obligatoria'); return }
              if (!crud.editando && !crud.form.codigo_tipo_tarea) { crud.setError('El tipo de tarea es obligatorio'); return }
              if (!crud.form.codigo_estado_canonico) { crud.setError('El estado canónico es obligatorio'); return }
              crud.guardar(undefined, undefined, { cerrar: false })
            }}
            onGuardarYSalir={() => {
              if (!crud.form.nombre_estado_tarea.trim()) { crud.setError('El nombre es obligatorio'); return }
              if (!crud.editando && !crud.form.codigo_categoria_tarea) { crud.setError('La categoría es obligatoria'); return }
              if (!crud.editando && !crud.form.codigo_tipo_tarea) { crud.setError('El tipo de tarea es obligatorio'); return }
              if (!crud.form.codigo_estado_canonico) { crud.setError('El estado canónico es obligatorio'); return }
              crud.guardar(undefined, undefined, { cerrar: true })
            }}
            onCerrar={crud.cerrarModal}
            cargando={crud.guardando}
          />
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        alCerrar={() => crud.setConfirmacion(null)}
        alConfirmar={crud.ejecutarEliminacion}
        titulo="Eliminar Estado de Tarea"
        mensaje={crud.confirmacion ? `¿Eliminar el estado "${crud.confirmacion.nombre_estado_tarea}"?` : ''}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
