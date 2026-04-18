'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaCodigo, columnaNombre, columnaDescripcion } from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { tareasDatosBasicosApi } from '@/lib/api'
import type { TipoConversacion } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'

type FormTipoConversacion = {
  codigo_tipo_conversacion: string
  nombre: string
  descripcion: string
}

const FORM_INICIAL: FormTipoConversacion = {
  codigo_tipo_conversacion: '',
  nombre: '',
  descripcion: '',
}

export default function PaginaTiposConversacion() {
  const crud = useCrudPage<TipoConversacion, FormTipoConversacion>({
    cargarFn: () => tareasDatosBasicosApi.listarTiposCnv(),
    crearFn: (f) =>
      tareasDatosBasicosApi.crearTipoCnv({
        codigo_tipo_conversacion: f.codigo_tipo_conversacion.trim() || undefined,
        nombre: f.nombre.trim(),
        descripcion: f.descripcion.trim() || undefined,
      } as any) as Promise<TipoConversacion>,
    actualizarFn: (id, f) =>
      tareasDatosBasicosApi.actualizarTipoCnv(id, {
        nombre: f.nombre.trim(),
        descripcion: f.descripcion.trim() || undefined,
      } as any) as Promise<TipoConversacion>,
    eliminarFn: async (id) => {
      await tareasDatosBasicosApi.eliminarTipoCnv(id)
    },
    getId: (t) => t.codigo_tipo_conversacion,
    camposBusqueda: (t) => [t.codigo_tipo_conversacion, t.nombre, t.descripcion ?? ''],
    formInicial: FORM_INICIAL,
    itemToForm: (t) => ({
      codigo_tipo_conversacion: t.codigo_tipo_conversacion,
      nombre: t.nombre,
      descripcion: t.descripcion ?? '',
    }),
  })

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre.localeCompare(b.nombre)
  )

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Tipos de Conversación</h2>
        <p className="text-sm text-texto-muted mt-1">Tipos de conversación para el grupo activo</p>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda="Buscar tipo..."
        onNuevo={crud.abrirNuevo}
        textoNuevo="Nuevo Tipo"
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'Código', campo: 'codigo_tipo_conversacion' },
          { titulo: 'Nombre', campo: 'nombre' },
          { titulo: 'Descripción', campo: 'descripcion' },
          { titulo: 'Estado', campo: 'activo' },
        ]}
        excelNombreArchivo="tipos-conversacion"
      />

      <TablaCrud
        columnas={[
          columnaCodigo<TipoConversacion>('Código', (t) => t.codigo_tipo_conversacion),
          columnaNombre<TipoConversacion>('Nombre', (t) => t.nombre),
          columnaDescripcion<TipoConversacion>('Descripción', (t) => t.descripcion),
          {
            titulo: 'Estado',
            render: (t: TipoConversacion) =>
              t.activo ? (
                <Insignia variante="exito">Activo</Insignia>
              ) : (
                <Insignia variante="neutro">Inactivo</Insignia>
              ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(t) => t.codigo_tipo_conversacion}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="Sin tipos de conversación"
      />

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? `Editar: ${crud.editando.nombre}` : 'Nuevo Tipo de Conversación'}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4 min-w-[460px]">
          <Input
            etiqueta="Código"
            value={crud.form.codigo_tipo_conversacion}
            onChange={(e) => crud.updateForm('codigo_tipo_conversacion', e.target.value)}
            placeholder="Se genera automáticamente"
            disabled={!!crud.editando}
            autoFocus={!crud.editando}
          />
          <Input
            etiqueta="Nombre"
            value={crud.form.nombre}
            onChange={(e) => crud.updateForm('nombre', e.target.value)}
            placeholder="Nombre del tipo de conversación"
            autoFocus={!!crud.editando}
          />
          <Textarea
            etiqueta="Descripción"
            value={crud.form.descripcion}
            onChange={(e) => crud.updateForm('descripcion', e.target.value)}
            placeholder="Descripción del tipo"
            rows={3}
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
        titulo="Eliminar Tipo de Conversación"
        mensaje={crud.confirmacion ? `¿Eliminar el tipo "${crud.confirmacion.nombre}"?` : ''}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
