'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import {
  TablaCrud,
  columnaCodigo,
  columnaNombre,
  columnaDescripcion,
} from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { tareasDatosBasicosApi } from '@/lib/api'
import type { CategoriaTarea } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import { cn } from '@/lib/utils'

type FormCategoriaTarea = {
  codigo_categoria_tarea: string
  nombre_categoria_tarea: string
  descripcion_categoria_tarea: string
  ayuda: string
  generacion: string
  programa: string
  prompt_insert: string
  prompt_update: string
  system_prompt: string
}

type TabModal = 'datos' | 'prompt' | 'system_prompt'

const FORM_INICIAL: FormCategoriaTarea = {
  codigo_categoria_tarea: '',
  nombre_categoria_tarea: '',
  descripcion_categoria_tarea: '',
  ayuda: '',
  generacion: '',
  programa: '',
  prompt_insert: '',
  prompt_update: '',
  system_prompt: '',
}

export default function PaginaCategoriasTarea() {
  const [tabModal, setTabModal] = useState<TabModal>('datos')

  const crud = useCrudPage<CategoriaTarea, FormCategoriaTarea>({
    cargarFn: () => tareasDatosBasicosApi.listarCategorias(),
    crearFn: (f) =>
      tareasDatosBasicosApi.crearCategoria({
        codigo_categoria_tarea: f.codigo_categoria_tarea.trim() || undefined,
        nombre_categoria_tarea: f.nombre_categoria_tarea.trim(),
        descripcion_categoria_tarea: f.descripcion_categoria_tarea.trim() || undefined,
        ayuda: f.ayuda.trim() || undefined,
        generacion: f.generacion.trim() || undefined,
        programa: f.programa.trim() || undefined,
        prompt_insert: f.prompt_insert.trim() || undefined,
        prompt_update: f.prompt_update.trim() || undefined,
        system_prompt: f.system_prompt.trim() || undefined,
      }) as Promise<CategoriaTarea>,
    actualizarFn: (id, f) =>
      tareasDatosBasicosApi.actualizarCategoria(id, {
        nombre_categoria_tarea: f.nombre_categoria_tarea?.trim(),
        descripcion_categoria_tarea: f.descripcion_categoria_tarea?.trim() || undefined,
        ayuda: f.ayuda?.trim() || undefined,
        generacion: f.generacion?.trim() || undefined,
        programa: f.programa?.trim() || undefined,
        prompt_insert: f.prompt_insert?.trim() || undefined,
        prompt_update: f.prompt_update?.trim() || undefined,
        system_prompt: f.system_prompt?.trim() || undefined,
      }) as Promise<CategoriaTarea>,
    eliminarFn: async (id) => { await tareasDatosBasicosApi.eliminarCategoria(id) },
    getId: (c) => c.codigo_categoria_tarea,
    camposBusqueda: (c) => [c.codigo_categoria_tarea, c.nombre_categoria_tarea, c.descripcion_categoria_tarea ?? ''],
    formInicial: FORM_INICIAL,
    itemToForm: (c) => ({
      codigo_categoria_tarea: c.codigo_categoria_tarea,
      nombre_categoria_tarea: c.nombre_categoria_tarea,
      descripcion_categoria_tarea: c.descripcion_categoria_tarea ?? '',
      ayuda: (c as any).ayuda ?? '',
      generacion: (c as any).generacion ?? '',
      programa: (c as any).programa ?? '',
      prompt_insert: (c as any).prompt_insert ?? '',
      prompt_update: (c as any).prompt_update ?? '',
      system_prompt: (c as any).system_prompt ?? '',
    }),
  })

  useEffect(() => {
    if (crud.modal) setTabModal('datos')
  }, [crud.modal])

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_categoria_tarea.localeCompare(b.nombre_categoria_tarea),
  )

  const tabs: { key: TabModal; label: string }[] = [
    { key: 'datos', label: 'Datos' },
    { key: 'prompt', label: 'Prompt' },
    { key: 'system_prompt', label: 'System Prompt' },
  ]

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Categorías de Tarea</h2>
        <p className="text-sm text-texto-muted mt-1">Categorías globales para clasificar los tipos de tarea</p>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda="Buscar categoría..."
        onNuevo={crud.abrirNuevo}
        textoNuevo="Nueva Categoría"
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'Código', campo: 'codigo_categoria_tarea' },
          { titulo: 'Nombre', campo: 'nombre_categoria_tarea' },
          { titulo: 'Descripción', campo: 'descripcion_categoria_tarea' },
          { titulo: 'Estado', campo: 'activo' },
        ]}
        excelNombreArchivo="categorias-tarea"
      />

      <TablaCrud
        columnas={[
          columnaCodigo<CategoriaTarea>('Código', (c) => c.codigo_categoria_tarea),
          columnaNombre<CategoriaTarea>('Nombre', (c) => c.nombre_categoria_tarea),
          columnaDescripcion<CategoriaTarea>('Descripción', (c) => c.descripcion_categoria_tarea),
          {
            titulo: 'Estado',
            render: (c: CategoriaTarea) =>
              c.activo ? (
                <Insignia variante="exito">Activo</Insignia>
              ) : (
                <Insignia variante="neutro">Inactivo</Insignia>
              ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(c) => c.codigo_categoria_tarea}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="Sin categorías"
      />

      {/* Modal crear/editar */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={
          crud.editando
            ? `Editar: ${crud.editando.nombre_categoria_tarea}`
            : 'Nueva Categoría de Tarea'
        }
        className="max-w-2xl"
      >
        {/* Tabs */}
        <div className="flex border-b border-borde mb-4">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTabModal(key)}
              className={cn(
                'flex-1 text-center px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                tabModal === key
                  ? 'border-primario text-primario'
                  : 'border-transparent text-texto-muted hover:text-texto'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 min-w-[500px]">
          {/* Tab Datos */}
          {tabModal === 'datos' && (
            <>
              <Input
                etiqueta="Código"
                value={crud.form.codigo_categoria_tarea}
                onChange={(e) => crud.updateForm('codigo_categoria_tarea', e.target.value)}
                placeholder="Se genera automáticamente"
                disabled={!!crud.editando}
                autoFocus={!crud.editando}
              />
              <Input
                etiqueta="Nombre"
                value={crud.form.nombre_categoria_tarea}
                onChange={(e) => crud.updateForm('nombre_categoria_tarea', e.target.value)}
                placeholder="Nombre de la categoría"
                autoFocus={!!crud.editando}
              />
              <Textarea
                etiqueta="Descripción"
                value={crud.form.descripcion_categoria_tarea}
                onChange={(e) => crud.updateForm('descripcion_categoria_tarea', e.target.value)}
                placeholder="Descripción de la categoría"
                rows={3}
              />
              <Textarea
                etiqueta="Ayuda"
                value={crud.form.ayuda}
                onChange={(e) => crud.updateForm('ayuda', e.target.value)}
                placeholder="Texto de ayuda para el usuario"
                rows={2}
              />
              <Input
                etiqueta="Generación"
                value={crud.form.generacion}
                onChange={(e) => crud.updateForm('generacion', e.target.value)}
                placeholder="Tipo de generación (ej. LLM, automatica, manual)"
              />
              <Input
                etiqueta="Programa"
                value={crud.form.programa}
                onChange={(e) => crud.updateForm('programa', e.target.value)}
                placeholder="Programa o script asociado"
              />
            </>
          )}

          {/* Tab Prompt */}
          {tabModal === 'prompt' && (
            <Textarea
              etiqueta="Prompt"
              value={crud.form.prompt_insert}
              onChange={(e) => crud.updateForm('prompt_insert', e.target.value)}
              placeholder="Prompt principal para el LLM..."
              rows={14}
            />
          )}

          {/* Tab System Prompt */}
          {tabModal === 'system_prompt' && (
            <Textarea
              etiqueta="System Prompt"
              value={crud.form.system_prompt}
              onChange={(e) => crud.updateForm('system_prompt', e.target.value)}
              placeholder="Instrucciones de sistema para el LLM..."
              rows={14}
            />
          )}

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!crud.editando}
            onGuardar={() => {
              if (!crud.form.nombre_categoria_tarea.trim()) { crud.setError('El nombre es obligatorio'); setTabModal('datos'); return }
              crud.guardar(undefined, undefined, { cerrar: false })
            }}
            onGuardarYSalir={() => {
              if (!crud.form.nombre_categoria_tarea.trim()) { crud.setError('El nombre es obligatorio'); setTabModal('datos'); return }
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
        titulo="Eliminar Categoría"
        mensaje={
          crud.confirmacion
            ? `¿Eliminar la categoría "${crud.confirmacion.nombre_categoria_tarea}"?`
            : ''
        }
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
