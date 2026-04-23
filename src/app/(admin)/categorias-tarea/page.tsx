'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import {
  TablaCrud,
  columnaCodigo,
  columnaNombre,
  columnaDescripcion,
} from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { tareasDatosBasicosApi, promptsApi } from '@/lib/api'
import type { CategoriaTarea } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import { Boton } from '@/components/ui/boton'
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
  python_insert: string
  python_update: string
  javascript: string
  python_editado_manual: boolean
  javascript_editado_manual: boolean
}

type TabModal = 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'

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
  python_insert: '',
  python_update: '',
  javascript: '',
  python_editado_manual: false,
  javascript_editado_manual: false,
}

export default function PaginaCategoriasTarea() {
  const [tabModal, setTabModal] = useState<TabModal>('datos')
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [md, setMd] = useState('')

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
    itemToForm: (c) => {
      const c2 = c as unknown as Record<string, unknown>
      return {
        codigo_categoria_tarea: c.codigo_categoria_tarea,
        nombre_categoria_tarea: c.nombre_categoria_tarea,
        descripcion_categoria_tarea: c.descripcion_categoria_tarea ?? '',
        ayuda: c2.ayuda as string ?? '',
        generacion: c2.generacion as string ?? '',
        programa: c2.programa as string ?? '',
        prompt_insert: c2.prompt_insert as string ?? '',
        prompt_update: c2.prompt_update as string ?? '',
        system_prompt: c2.system_prompt as string ?? '',
        python_insert: c2.python_insert as string ?? '',
        python_update: c2.python_update as string ?? '',
        javascript: c2.javascript as string ?? '',
        python_editado_manual: c2.python_editado_manual as boolean ?? false,
        javascript_editado_manual: c2.javascript_editado_manual as boolean ?? false,
      }
    },
  })

  useEffect(() => {
    if (crud.modal) {
      setTabModal('datos')
      setMensajeMd(null)
      const item = crud.editando as unknown as Record<string, unknown>
      setMd(item?.md as string || '')
    }
  }, [crud.modal, crud.editando])

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_categoria_tarea.localeCompare(b.nombre_categoria_tarea),
  )

  const tabs: { key: TabModal; label: string }[] = [
    { key: 'datos', label: 'Datos' },
    { key: 'system_prompt', label: 'System Prompt' },
    { key: 'programacion_insert', label: 'Prog. Insert' },
    { key: 'programacion_update', label: 'Prog. Update' },
    ...(crud.editando ? [{ key: 'md' as TabModal, label: '.md' }] : []),
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
            ? `Editar categoría tarea: ${crud.editando.nombre_categoria_tarea}`
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

          {/* Tab System Prompt */}
          {tabModal === 'system_prompt' && (
            <TabPrompts
              tabla="categorias_tarea"
              pkColumna="codigo_categoria_tarea"
              pkValor={crud.editando?.codigo_categoria_tarea ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormCategoriaTarea, valor as string | boolean)}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {/* Tab Prog. Insert */}
          {tabModal === 'programacion_insert' && (
            <TabPrompts
              tabla="categorias_tarea"
              pkColumna="codigo_categoria_tarea"
              pkValor={crud.editando?.codigo_categoria_tarea ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormCategoriaTarea, valor as string | boolean)}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptUpdate={false}
              mostrarPythonUpdate={false}
            />
          )}

          {/* Tab Prog. Update */}
          {tabModal === 'programacion_update' && (
            <TabPrompts
              tabla="categorias_tarea"
              pkColumna="codigo_categoria_tarea"
              pkValor={crud.editando?.codigo_categoria_tarea ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormCategoriaTarea, valor as string | boolean)}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptInsert={false}
              mostrarPythonInsert={false}
            />
          )}

          {/* Tab .md */}
          {crud.editando && tabModal === 'md' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={md}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMd && (
                <p className={`text-xs px-1 ${mensajeMd.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMd.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMd(true); setMensajeMd(null)
                      try {
                        const r = await tareasDatosBasicosApi.generarMdCategoria(crud.editando!.codigo_categoria_tarea)
                        setMd(r.md)
                        setMensajeMd({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMd(false) }
                    }}
                    cargando={generandoMd}
                    disabled={generandoMd || sincronizandoMd}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMd(true); setMensajeMd(null)
                      try {
                        const r = await promptsApi.sincronizarFila('categorias_tarea', 'codigo_categoria_tarea', crud.editando!.codigo_categoria_tarea)
                        setMensajeMd({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMd(false) }
                    }}
                    cargando={sincronizandoMd}
                    disabled={generandoMd || sincronizandoMd || !md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={crud.cerrarModal}>Salir</Boton>
              </div>
            </div>
          )}

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          {tabModal !== 'md' && (
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
            botonesIzquierda={(tabModal === 'system_prompt' || tabModal === 'programacion_insert' || tabModal === 'programacion_update') && crud.editando ? (
              <PieBotonesPrompts
                tabla="categorias_tarea"
                pkColumna="codigo_categoria_tarea"
                pkValor={crud.editando.codigo_categoria_tarea}
                promptInsert={crud.form.prompt_insert || undefined}
                promptUpdate={crud.form.prompt_update || undefined}
              />
            ) : undefined}
          />
          )}
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
