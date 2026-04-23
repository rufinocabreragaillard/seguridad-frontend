'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { TablaCrud, columnaCodigo, columnaNombre, columnaDescripcion } from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { Boton } from '@/components/ui/boton'
import { tareasDatosBasicosApi, promptsApi } from '@/lib/api'
import type { CategoriaTarea } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import { cn } from '@/lib/utils'

type TipoTareaLocal = {
  codigo_grupo: string
  codigo_categoria_tarea: string
  codigo_tipo_tarea: string
  nombre_tipo_tarea: string
  descripcion_tipo_tarea?: string
  ayuda?: string
  generacion?: string
  programa?: string
  prompt?: string
  system_prompt?: string
  activo: boolean
  codigo_tipo_canonico?: string
}

type FormTipoTarea = {
  codigo_categoria_tarea: string
  codigo_tipo_tarea: string
  nombre_tipo_tarea: string
  descripcion_tipo_tarea: string
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

const FORM_INICIAL: FormTipoTarea = {
  codigo_categoria_tarea: '',
  codigo_tipo_tarea: '',
  nombre_tipo_tarea: '',
  descripcion_tipo_tarea: '',
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

export default function PaginaTiposTarea() {
  const [tabModal, setTabModal] = useState<TabModal>('datos')
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<string | null>(null)
  const [md, setMd] = useState('')
  const [categorias, setCategorias] = useState<CategoriaTarea[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState('')

  useEffect(() => {
    tareasDatosBasicosApi.listarCategorias().then(setCategorias).catch(() => {})
  }, [])

  const crud = useCrudPage<TipoTareaLocal, FormTipoTarea>({
    cargarFn: () =>
      tareasDatosBasicosApi.listarTiposTar(filtroCategoria || undefined) as Promise<TipoTareaLocal[]>,
    crearFn: (f) =>
      tareasDatosBasicosApi.crearTipoTar({
        codigo_categoria_tarea: f.codigo_categoria_tarea,
        codigo_tipo_tarea: f.codigo_tipo_tarea.trim() || undefined,
        nombre_tipo_tarea: f.nombre_tipo_tarea.trim(),
        descripcion_tipo_tarea: f.descripcion_tipo_tarea.trim() || undefined,
        ayuda: f.ayuda.trim() || undefined,
        generacion: f.generacion.trim() || undefined,
        programa: f.programa.trim() || undefined,
        prompt_insert: f.prompt_insert.trim() || undefined,
        prompt_update: f.prompt_update.trim() || undefined,
        system_prompt: f.system_prompt.trim() || undefined,
        python_insert: f.python_insert.trim() || undefined,
        python_update: f.python_update.trim() || undefined,
        javascript: f.javascript.trim() || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as any) as Promise<TipoTareaLocal>,
    actualizarFn: (id, f) => {
      const [, categoria, tipo] = id.split('/')
      return tareasDatosBasicosApi.actualizarTipoTar(categoria, tipo, {
        nombre_tipo_tarea: f.nombre_tipo_tarea.trim(),
        descripcion_tipo_tarea: f.descripcion_tipo_tarea.trim() || undefined,
        ayuda: f.ayuda.trim() || undefined,
        generacion: f.generacion.trim() || undefined,
        programa: f.programa.trim() || undefined,
        prompt_insert: f.prompt_insert.trim() || undefined,
        prompt_update: f.prompt_update.trim() || undefined,
        system_prompt: f.system_prompt.trim() || undefined,
        python_insert: f.python_insert.trim() || undefined,
        python_update: f.python_update.trim() || undefined,
        javascript: f.javascript.trim() || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as any) as Promise<TipoTareaLocal>
    },
    eliminarFn: async (id) => {
      const [, categoria, tipo] = id.split('/')
      await tareasDatosBasicosApi.eliminarTipoTar(categoria, tipo)
    },
    getId: (t) => `${t.codigo_grupo}/${t.codigo_categoria_tarea}/${t.codigo_tipo_tarea}`,
    camposBusqueda: (t) => [t.codigo_tipo_tarea, t.nombre_tipo_tarea, t.descripcion_tipo_tarea ?? ''],
    formInicial: FORM_INICIAL,
    itemToForm: (t) => {
      const t2 = t as unknown as Record<string, unknown>
      return {
        codigo_categoria_tarea: t.codigo_categoria_tarea,
        codigo_tipo_tarea: t.codigo_tipo_tarea,
        nombre_tipo_tarea: t.nombre_tipo_tarea,
        descripcion_tipo_tarea: t.descripcion_tipo_tarea ?? '',
        ayuda: t.ayuda ?? '',
        generacion: t.generacion ?? '',
        programa: t.programa ?? '',
        prompt_insert: t2.prompt_insert as string ?? '',
        prompt_update: t2.prompt_update as string ?? '',
        system_prompt: t.system_prompt ?? '',
        python_insert: t2.python_insert as string || '',
        python_update: t2.python_update as string || '',
        javascript: t2.javascript as string || '',
        python_editado_manual: t2.python_editado_manual as boolean || false,
        javascript_editado_manual: t2.javascript_editado_manual as boolean || false,
      }
    },
  })

  useEffect(() => {
    if (crud.modal) {
      setTabModal('datos')
      if (crud.editando) {
        const e2 = crud.editando as unknown as Record<string, unknown>
        setMd(e2.md as string || '')
        setMensajeMd(null)
      }
    }
  }, [crud.modal, crud.editando])

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) => {
    const catCmp = a.codigo_categoria_tarea.localeCompare(b.codigo_categoria_tarea)
    return catCmp !== 0 ? catCmp : a.nombre_tipo_tarea.localeCompare(b.nombre_tipo_tarea)
  })

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
        <h2 className="page-heading">Tipos de Tarea</h2>
        <p className="text-sm text-texto-muted mt-1">Tipos de tarea por categoría para el grupo activo</p>
      </div>

      <div className="flex items-center gap-3">
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
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda="Buscar tipo..."
        onNuevo={crud.abrirNuevo}
        textoNuevo="Nuevo Tipo"
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'Categoría', campo: 'codigo_categoria_tarea' },
          { titulo: 'Código', campo: 'codigo_tipo_tarea' },
          { titulo: 'Nombre', campo: 'nombre_tipo_tarea' },
          { titulo: 'Descripción', campo: 'descripcion_tipo_tarea' },
          { titulo: 'Estado', campo: 'activo' },
        ]}
        excelNombreArchivo="tipos-tarea"
      />

      <TablaCrud
        columnas={[
          {
            titulo: 'Categoría',
            render: (t: TipoTareaLocal) => {
              const cat = categorias.find((c) => c.codigo_categoria_tarea === t.codigo_categoria_tarea)
              return <span className="text-xs text-texto-muted">{cat?.nombre_categoria_tarea ?? t.codigo_categoria_tarea}</span>
            },
          },
          columnaCodigo<TipoTareaLocal>('Código', (t) => t.codigo_tipo_tarea),
          columnaNombre<TipoTareaLocal>('Nombre', (t) => t.nombre_tipo_tarea),
          columnaDescripcion<TipoTareaLocal>('Descripción', (t) => t.descripcion_tipo_tarea),
          {
            titulo: 'Estado',
            render: (t: TipoTareaLocal) =>
              t.activo ? (
                <Insignia variante="exito">Activo</Insignia>
              ) : (
                <Insignia variante="neutro">Inactivo</Insignia>
              ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(t) => `${t.codigo_grupo}/${t.codigo_categoria_tarea}/${t.codigo_tipo_tarea}`}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="Sin tipos de tarea"
      />

      {/* Modal crear/editar */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? `Editar tipo de tarea: ${crud.editando.nombre_tipo_tarea}` : 'Nuevo Tipo de Tarea'}
        className="max-w-2xl"
      >
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
                  : 'border-transparent text-texto-muted hover:text-texto',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 min-w-[500px] min-h-[500px]">
          {tabModal === 'datos' && (
            <>
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
              <Input
                etiqueta="Código"
                value={crud.form.codigo_tipo_tarea}
                onChange={(e) => crud.updateForm('codigo_tipo_tarea', e.target.value)}
                placeholder="Se genera automáticamente"
                disabled={!!crud.editando}
              />
              <Input
                etiqueta="Nombre"
                value={crud.form.nombre_tipo_tarea}
                onChange={(e) => crud.updateForm('nombre_tipo_tarea', e.target.value)}
                placeholder="Nombre del tipo de tarea"
                autoFocus
              />
              <Textarea
                etiqueta="Descripción"
                value={crud.form.descripcion_tipo_tarea}
                onChange={(e) => crud.updateForm('descripcion_tipo_tarea', e.target.value)}
                placeholder="Descripción del tipo de tarea"
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

          {tabModal === 'system_prompt' && (
            <TabPrompts
              tabla="tipos_tarea"
              pkColumna="codigo_tipo_tarea"
              pkValor={crud.editando?.codigo_tipo_tarea ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormTipoTarea, valor as string | boolean)}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {tabModal === 'programacion_insert' && (
            <TabPrompts
              tabla="tipos_tarea"
              pkColumna="codigo_tipo_tarea"
              pkValor={crud.editando?.codigo_tipo_tarea ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormTipoTarea, valor as string | boolean)}
              mostrarSystemPrompt={false}
              mostrarPromptInsert={true}
              mostrarPromptUpdate={false}
              mostrarPythonInsert={true}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {tabModal === 'programacion_update' && (
            <TabPrompts
              tabla="tipos_tarea"
              pkColumna="codigo_tipo_tarea"
              pkValor={crud.editando?.codigo_tipo_tarea ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormTipoTarea, valor as string | boolean)}
              mostrarSystemPrompt={false}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={true}
              mostrarJavaScript={true}
            />
          )}

          {tabModal === 'md' && crud.editando && (
            <div className="flex flex-col gap-3">
              <textarea
                readOnly
                rows={13}
                value={md}
                className="w-full text-sm font-mono rounded-lg border border-borde px-3 py-2 bg-fondo text-texto resize-none focus:outline-none"
                placeholder="Sin contenido .md generado"
              />
              {mensajeMd && (
                <p className="text-xs text-texto-muted">{mensajeMd}</p>
              )}
              <div className="flex gap-2">
                <Boton
                  variante="secundario"
                  cargando={generandoMd}
                  onClick={async () => {
                    setGenerandoMd(true)
                    setMensajeMd(null)
                    try {
                      const res = await tareasDatosBasicosApi.generarMdTipo(
                        crud.editando!.codigo_categoria_tarea,
                        crud.editando!.codigo_tipo_tarea,
                      )
                      setMd((res as unknown as Record<string, unknown>).md as string || '')
                      setMensajeMd('Markdown generado correctamente')
                    } catch {
                      setMensajeMd('Error al generar markdown')
                    } finally {
                      setGenerandoMd(false)
                    }
                  }}
                >
                  Generar
                </Boton>
                <Boton
                  variante="secundario"
                  cargando={sincronizandoMd}
                  onClick={async () => {
                    setSincronizandoMd(true)
                    setMensajeMd(null)
                    try {
                      await promptsApi.sincronizarFila('tipos_tarea', 'codigo_tipo_tarea', crud.editando!.codigo_tipo_tarea)
                      setMensajeMd('Sincronizado correctamente')
                    } catch {
                      setMensajeMd('Error al sincronizar')
                    } finally {
                      setSincronizandoMd(false)
                    }
                  }}
                >
                  Sincronizar
                </Boton>
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
                if (!crud.form.nombre_tipo_tarea.trim()) { crud.setError('El nombre es obligatorio'); setTabModal('datos'); return }
                if (!crud.editando && !crud.form.codigo_categoria_tarea) { crud.setError('La categoría es obligatoria'); setTabModal('datos'); return }
                crud.guardar(undefined, undefined, { cerrar: false })
              }}
              onGuardarYSalir={() => {
                if (!crud.form.nombre_tipo_tarea.trim()) { crud.setError('El nombre es obligatorio'); setTabModal('datos'); return }
                if (!crud.editando && !crud.form.codigo_categoria_tarea) { crud.setError('La categoría es obligatoria'); setTabModal('datos'); return }
                crud.guardar(undefined, undefined, { cerrar: true })
              }}
              onCerrar={crud.cerrarModal}
              cargando={crud.guardando}
              botonesIzquierda={(tabModal === 'system_prompt' || tabModal === 'programacion_insert' || tabModal === 'programacion_update') && crud.editando ? (
                <PieBotonesPrompts
                  tabla="tipos_tarea"
                  pkColumna="codigo_tipo_tarea"
                  pkValor={crud.editando.codigo_tipo_tarea}
                  promptInsert={crud.form.prompt_insert ?? undefined}
                  promptUpdate={crud.form.prompt_update ?? undefined}
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
        titulo="Eliminar Tipo de Tarea"
        mensaje={crud.confirmacion ? `¿Eliminar el tipo "${crud.confirmacion.nombre_tipo_tarea}"?` : ''}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
