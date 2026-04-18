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
import type { EstadoCanonicoTarea } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'

type FormCanonicoTarea = {
  codigo_estado_canonico: string
  nombre_estado_canonico: string
  descripcion_estado_canonico: string
}

const FORM_INICIAL: FormCanonicoTarea = {
  codigo_estado_canonico: '',
  nombre_estado_canonico: '',
  descripcion_estado_canonico: '',
}

export default function PaginaCanonicosTarea() {
  const crud = useCrudPage<EstadoCanonicoTarea, FormCanonicoTarea>({
    cargarFn: () => tareasDatosBasicosApi.listarCanonicosTar(),
    crearFn: (f) =>
      tareasDatosBasicosApi.crearCanonicosTar({
        codigo_estado_canonico: f.codigo_estado_canonico.trim(),
        nombre_estado_canonico: f.nombre_estado_canonico.trim(),
        descripcion_estado_canonico: f.descripcion_estado_canonico.trim() || undefined,
      } as any) as Promise<EstadoCanonicoTarea>,
    actualizarFn: (id, f) =>
      tareasDatosBasicosApi.actualizarCanonicosTar(id, {
        nombre_estado_canonico: f.nombre_estado_canonico.trim(),
        descripcion_estado_canonico: f.descripcion_estado_canonico.trim() || undefined,
      } as any) as Promise<EstadoCanonicoTarea>,
    eliminarFn: async (id) => {
      await tareasDatosBasicosApi.eliminarCanonicosTar(id)
    },
    getId: (c) => c.codigo_estado_canonico,
    camposBusqueda: (c) => [c.codigo_estado_canonico, c.nombre_estado_canonico, c.descripcion_estado_canonico ?? ''],
    formInicial: FORM_INICIAL,
    itemToForm: (c) => ({
      codigo_estado_canonico: c.codigo_estado_canonico,
      nombre_estado_canonico: c.nombre_estado_canonico,
      descripcion_estado_canonico: c.descripcion_estado_canonico ?? '',
    }),
  })

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_estado_canonico.localeCompare(b.nombre_estado_canonico)
  )

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Estados Canónicos de Tarea</h2>
        <p className="text-sm text-texto-muted mt-1">Catálogo global de estados canónicos para clasificar estados de tarea</p>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda="Buscar estado canónico..."
        onNuevo={crud.abrirNuevo}
        textoNuevo="Nuevo Estado Canónico"
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'Código', campo: 'codigo_estado_canonico' },
          { titulo: 'Nombre', campo: 'nombre_estado_canonico' },
          { titulo: 'Descripción', campo: 'descripcion_estado_canonico' },
          { titulo: 'Estado', campo: 'activo' },
        ]}
        excelNombreArchivo="canonicos-tarea"
      />

      <TablaCrud
        columnas={[
          columnaCodigo<EstadoCanonicoTarea>('Código', (c) => c.codigo_estado_canonico),
          columnaNombre<EstadoCanonicoTarea>('Nombre', (c) => c.nombre_estado_canonico),
          columnaDescripcion<EstadoCanonicoTarea>('Descripción', (c) => c.descripcion_estado_canonico),
          {
            titulo: 'Estado',
            render: (c: EstadoCanonicoTarea) =>
              c.activo ? (
                <Insignia variante="exito">Activo</Insignia>
              ) : (
                <Insignia variante="neutro">Inactivo</Insignia>
              ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(c) => c.codigo_estado_canonico}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="Sin estados canónicos"
      />

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? `Editar: ${crud.editando.nombre_estado_canonico}` : 'Nuevo Estado Canónico de Tarea'}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4 min-w-[460px]">
          <Input
            etiqueta="Código"
            value={crud.form.codigo_estado_canonico}
            onChange={(e) => crud.updateForm('codigo_estado_canonico', e.target.value)}
            placeholder="Ej: PENDIENTE, EN_PROCESO"
            disabled={!!crud.editando}
            autoFocus={!crud.editando}
          />
          <Input
            etiqueta="Nombre"
            value={crud.form.nombre_estado_canonico}
            onChange={(e) => crud.updateForm('nombre_estado_canonico', e.target.value)}
            placeholder="Nombre del estado canónico"
            autoFocus={!!crud.editando}
          />
          <Textarea
            etiqueta="Descripción"
            value={crud.form.descripcion_estado_canonico}
            onChange={(e) => crud.updateForm('descripcion_estado_canonico', e.target.value)}
            placeholder="Descripción del estado canónico"
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
                if (!crud.form.nombre_estado_canonico.trim()) { crud.setError('El nombre es obligatorio'); return }
                if (!crud.editando && !crud.form.codigo_estado_canonico.trim()) { crud.setError('El código es obligatorio'); return }
                crud.guardar(undefined, undefined, { cerrar: true })
              }}
              cargando={crud.guardando}
            >
              Grabar y Salir
            </Boton>
            <Boton
              variante="primario"
              onClick={() => {
                if (!crud.form.nombre_estado_canonico.trim()) { crud.setError('El nombre es obligatorio'); return }
                if (!crud.editando && !crud.form.codigo_estado_canonico.trim()) { crud.setError('El código es obligatorio'); return }
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
        titulo="Eliminar Estado Canónico"
        mensaje={crud.confirmacion ? `¿Eliminar el estado canónico "${crud.confirmacion.nombre_estado_canonico}"?` : ''}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
