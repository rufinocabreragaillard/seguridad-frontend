'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaCodigo, columnaNombre } from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { tareasDatosBasicosApi } from '@/lib/api'
import type { TipoConversacion, EstadoConversacion, EstadoCanonicoTarea } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'

type FormEstadoConversacion = {
  codigo_tipo_conversacion: string
  codigo_estado_conversacion: string
  nombre: string
  codigo_estado_canonico: string
  orden: number
}

const FORM_INICIAL: FormEstadoConversacion = {
  codigo_tipo_conversacion: '',
  codigo_estado_conversacion: '',
  nombre: '',
  codigo_estado_canonico: '',
  orden: 0,
}

export default function PaginaEstadosConversacion() {
  const [tipos, setTipos] = useState<TipoConversacion[]>([])
  const [canonicos, setCanonicos] = useState<EstadoCanonicoTarea[]>([])
  const [filtroTipo, setFiltroTipo] = useState('')

  useEffect(() => {
    tareasDatosBasicosApi.listarTiposCnv().then(setTipos).catch(() => {})
    tareasDatosBasicosApi.listarCanonicosTar().then(setCanonicos).catch(() => {})
  }, [])

  const crud = useCrudPage<EstadoConversacion, FormEstadoConversacion>({
    cargarFn: () =>
      tareasDatosBasicosApi.listarEstadosCnv(filtroTipo || undefined) as Promise<EstadoConversacion[]>,
    crearFn: (f) =>
      tareasDatosBasicosApi.crearEstadoCnv({
        codigo_tipo_conversacion: f.codigo_tipo_conversacion,
        codigo_estado_conversacion: f.codigo_estado_conversacion.trim() || undefined,
        nombre: f.nombre.trim(),
        codigo_estado_canonico: f.codigo_estado_canonico,
        orden: f.orden,
      } as any) as Promise<EstadoConversacion>,
    actualizarFn: (id, f) => {
      const [tipo, codigo] = id.split('/')
      return tareasDatosBasicosApi.actualizarEstadoCnv(tipo, codigo, {
        nombre: f.nombre.trim(),
        codigo_estado_canonico: f.codigo_estado_canonico,
        orden: f.orden,
      } as any) as Promise<EstadoConversacion>
    },
    eliminarFn: async (id) => {
      const [tipo, codigo] = id.split('/')
      await tareasDatosBasicosApi.eliminarEstadoCnv(tipo, codigo)
    },
    getId: (e) => `${e.codigo_tipo_conversacion}/${e.codigo_estado_conversacion}`,
    camposBusqueda: (e) => [e.codigo_estado_conversacion, e.nombre],
    formInicial: FORM_INICIAL,
    itemToForm: (e) => ({
      codigo_tipo_conversacion: e.codigo_tipo_conversacion,
      codigo_estado_conversacion: e.codigo_estado_conversacion,
      nombre: e.nombre,
      codigo_estado_canonico: e.codigo_estado_canonico,
      orden: e.orden,
    }),
  })

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) => {
    const tipCmp = a.codigo_tipo_conversacion.localeCompare(b.codigo_tipo_conversacion)
    return tipCmp !== 0 ? tipCmp : a.orden - b.orden
  })

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Estados de Conversación</h2>
        <p className="text-sm text-texto-muted mt-1">Estados por tipo de conversación para el grupo activo</p>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); crud.cargar() }}
          className="text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario"
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.codigo_tipo_conversacion} value={t.codigo_tipo_conversacion}>
              {t.nombre}
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
          { titulo: 'Tipo', campo: 'codigo_tipo_conversacion' },
          { titulo: 'Código', campo: 'codigo_estado_conversacion' },
          { titulo: 'Nombre', campo: 'nombre' },
          { titulo: 'Canónico', campo: 'codigo_estado_canonico' },
          { titulo: 'Orden', campo: 'orden' },
          { titulo: 'Estado', campo: 'activo' },
        ]}
        excelNombreArchivo="estados-conversacion"
      />

      <TablaCrud
        columnas={[
          {
            titulo: 'Tipo',
            render: (e: EstadoConversacion) => {
              const tip = tipos.find((t) => t.codigo_tipo_conversacion === e.codigo_tipo_conversacion)
              return <span className="text-xs text-texto-muted">{tip?.nombre ?? e.codigo_tipo_conversacion}</span>
            },
          },
          columnaCodigo<EstadoConversacion>('Código', (e) => e.codigo_estado_conversacion),
          columnaNombre<EstadoConversacion>('Nombre', (e) => e.nombre),
          {
            titulo: 'Canónico',
            render: (e: EstadoConversacion) => {
              const can = canonicos.find((c) => c.codigo_estado_canonico === e.codigo_estado_canonico)
              return <span className="text-xs">{can?.nombre_estado_canonico ?? e.codigo_estado_canonico}</span>
            },
          },
          {
            titulo: 'Orden',
            render: (e: EstadoConversacion) => <span className="text-xs">{e.orden}</span>,
          },
          {
            titulo: 'Estado',
            render: (e: EstadoConversacion) =>
              e.activo ? (
                <Insignia variante="exito">Activo</Insignia>
              ) : (
                <Insignia variante="neutro">Inactivo</Insignia>
              ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(e) => `${e.codigo_tipo_conversacion}/${e.codigo_estado_conversacion}`}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="Sin estados de conversación"
      />

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? `Editar: ${crud.editando.nombre}` : 'Nuevo Estado de Conversación'}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4 min-w-[460px]">
          <div>
            <label className="text-sm font-medium text-texto block mb-1">
              Tipo de Conversación <span className="text-error">*</span>
            </label>
            <select
              value={crud.form.codigo_tipo_conversacion}
              onChange={(e) => crud.updateForm('codigo_tipo_conversacion', e.target.value)}
              disabled={!!crud.editando}
              className="w-full text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-60"
            >
              <option value="">Seleccionar tipo...</option>
              {tipos.map((t) => (
                <option key={t.codigo_tipo_conversacion} value={t.codigo_tipo_conversacion}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          <Input
            etiqueta="Código"
            value={crud.form.codigo_estado_conversacion}
            onChange={(e) => crud.updateForm('codigo_estado_conversacion', e.target.value)}
            placeholder="Se genera automáticamente"
            disabled={!!crud.editando}
          />
          <Input
            etiqueta="Nombre"
            value={crud.form.nombre}
            onChange={(e) => crud.updateForm('nombre', e.target.value)}
            placeholder="Nombre del estado"
            autoFocus
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

          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={crud.cerrarModal}>Salir</Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                if (!crud.form.nombre.trim()) { crud.setError('El nombre es obligatorio'); return }
                if (!crud.editando && !crud.form.codigo_tipo_conversacion) { crud.setError('El tipo es obligatorio'); return }
                if (!crud.form.codigo_estado_canonico) { crud.setError('El estado canónico es obligatorio'); return }
                crud.guardar(undefined, undefined, { cerrar: true })
              }}
              cargando={crud.guardando}
            >
              Grabar y Salir
            </Boton>
            <Boton
              variante="primario"
              onClick={() => {
                if (!crud.form.nombre.trim()) { crud.setError('El nombre es obligatorio'); return }
                if (!crud.editando && !crud.form.codigo_tipo_conversacion) { crud.setError('El tipo es obligatorio'); return }
                if (!crud.form.codigo_estado_canonico) { crud.setError('El estado canónico es obligatorio'); return }
                crud.guardar(undefined, undefined, { cerrar: false })
              }}
              cargando={crud.guardando}
            >
              {crud.editando ? 'Grabar' : 'Crear'}
            </Boton>
          </div>
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        alCerrar={() => crud.setConfirmacion(null)}
        alConfirmar={crud.ejecutarEliminacion}
        titulo="Eliminar Estado de Conversación"
        mensaje={crud.confirmacion ? `¿Eliminar el estado "${crud.confirmacion.nombre}"?` : ''}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
