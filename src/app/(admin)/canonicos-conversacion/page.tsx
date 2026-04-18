'use client'

import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaCodigo, columnaNombre } from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { tareasDatosBasicosApi } from '@/lib/api'
import type { EstadoCanonicoConversacion } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'

type FormCanonico = {
  codigo_estado_canonico: string
  nombre: string
}

const FORM_INICIAL: FormCanonico = {
  codigo_estado_canonico: '',
  nombre: '',
}

export default function PaginaCanonicoConversacion() {
  const crud = useCrudPage<EstadoCanonicoConversacion, FormCanonico>({
    cargarFn: () => tareasDatosBasicosApi.listarCanonicosCnv(),
    crearFn: (f) =>
      tareasDatosBasicosApi.crearCanonicosCnv({
        codigo_estado_canonico: f.codigo_estado_canonico.trim(),
        nombre: f.nombre.trim(),
      } as any) as Promise<EstadoCanonicoConversacion>,
    actualizarFn: (id, f) =>
      tareasDatosBasicosApi.actualizarCanonicosCnv(id, {
        nombre: f.nombre.trim(),
      } as any) as Promise<EstadoCanonicoConversacion>,
    eliminarFn: async (id) => {
      await tareasDatosBasicosApi.eliminarCanonicosCnv(id)
    },
    getId: (c) => c.codigo_estado_canonico,
    camposBusqueda: (c) => [c.codigo_estado_canonico, c.nombre],
    formInicial: FORM_INICIAL,
    itemToForm: (c) => ({
      codigo_estado_canonico: c.codigo_estado_canonico,
      nombre: c.nombre,
    }),
  })

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre.localeCompare(b.nombre)
  )

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Estados Canónicos de Conversación</h2>
        <p className="text-sm text-texto-muted mt-1">Catálogo global de estados canónicos para clasificar estados de conversación</p>
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
          { titulo: 'Nombre', campo: 'nombre' },
          { titulo: 'Estado', campo: 'activo' },
        ]}
        excelNombreArchivo="canonicos-conversacion"
      />

      <TablaCrud
        columnas={[
          columnaCodigo<EstadoCanonicoConversacion>('Código', (c) => c.codigo_estado_canonico),
          columnaNombre<EstadoCanonicoConversacion>('Nombre', (c) => c.nombre),
          {
            titulo: 'Estado',
            render: (c: EstadoCanonicoConversacion) =>
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
        titulo={crud.editando ? `Editar: ${crud.editando.nombre}` : 'Nuevo Estado Canónico de Conversación'}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4 min-w-[440px]">
          <Input
            etiqueta="Código"
            value={crud.form.codigo_estado_canonico}
            onChange={(e) => crud.updateForm('codigo_estado_canonico', e.target.value)}
            placeholder="Ej: ABIERTO, EN_PROCESO, CERRADO"
            disabled={!!crud.editando}
            autoFocus={!crud.editando}
          />
          <Input
            etiqueta="Nombre"
            value={crud.form.nombre}
            onChange={(e) => crud.updateForm('nombre', e.target.value)}
            placeholder="Nombre del estado canónico"
            autoFocus={!!crud.editando}
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
                if (!crud.form.nombre.trim()) { crud.setError('El nombre es obligatorio'); return }
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
        mensaje={crud.confirmacion ? `¿Eliminar el estado canónico "${crud.confirmacion.nombre}"?` : ''}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
