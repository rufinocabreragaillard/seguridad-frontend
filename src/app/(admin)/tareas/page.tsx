'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud } from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { tareasApi } from '@/lib/api'
import type { Tarea } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import { TabPrompts, type CamposPrompt } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'

const selectClass =
  'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

const PRIORIDADES = [
  { valor: 'urgente', etiquetaEs: 'Urgente' },
  { valor: 'alto', etiquetaEs: 'Alto' },
  { valor: 'medio', etiquetaEs: 'Medio' },
  { valor: 'bajo', etiquetaEs: 'Bajo' },
]

const PRIORIDAD_VARIANTE: Record<string, 'error' | 'advertencia' | 'primario' | 'exito'> = {
  urgente: 'error',
  alto: 'advertencia',
  medio: 'primario',
  bajo: 'exito',
}

type FormTarea = {
  nombre_tarea: string
  descripcion_tarea: string
  prioridad: 'urgente' | 'alto' | 'medio' | 'bajo'
  fecha_esperada: string
  json: string
  prompt_insert: string | null
  prompt_update: string | null
  system_prompt: string | null
  python_insert: string | null
  python_update: string | null
  javascript: string | null
  python_editado_manual: boolean
  javascript_editado_manual: boolean
}

type TabTarea = 'datos' | 'json' | 'system_prompt' | 'programacion_insert' | 'programacion_update'

export default function PaginaTareasMantenedor() {
  const t = useTranslations('tareas')
  const tc = useTranslations('common')
  const [tabModal, setTabModal] = useState<TabTarea>('datos')

  const parsearJson = (raw: string | undefined): unknown | null => {
    const txt = (raw ?? '').trim()
    if (!txt) return null
    try {
      return JSON.parse(txt)
    } catch {
      throw new Error(t('errorJsonInvalido'))
    }
  }

  const crud = useCrudPage<Tarea, FormTarea>({
    cargarFn: () => tareasApi.listarTareas(),
    crearFn: (f) =>
      tareasApi.crearTarea({
        nombre_tarea: f.nombre_tarea.trim(),
        descripcion_tarea: f.descripcion_tarea.trim() || undefined,
        prioridad: f.prioridad,
        fecha_esperada: f.fecha_esperada || undefined,
        json: parsearJson(f.json) ?? undefined,
      }) as Promise<Tarea>,
    actualizarFn: (id, f) =>
      tareasApi.actualizarTarea(Number(id), {
        nombre_tarea: f.nombre_tarea?.trim(),
        descripcion_tarea: f.descripcion_tarea?.trim() || undefined,
        prioridad: f.prioridad,
        fecha_esperada: f.fecha_esperada || undefined,
        json: parsearJson(f.json),
        prompt_insert: f.prompt_insert,
        prompt_update: f.prompt_update,
        system_prompt: f.system_prompt,
        python_insert: f.python_insert,
        python_update: f.python_update,
        javascript: f.javascript,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      }) as Promise<Tarea>,
    eliminarFn: async (id) => { await tareasApi.eliminarTarea(Number(id)) },
    getId: (t) => String(t.id_tarea),
    camposBusqueda: (t) => [t.nombre_tarea, t.descripcion_tarea ?? '', t.codigo_categoria_tarea],
    formInicial: { nombre_tarea: '', descripcion_tarea: '', prioridad: 'medio', fecha_esperada: '', json: '', prompt_insert: null, prompt_update: null, system_prompt: null, python_insert: null, python_update: null, javascript: null, python_editado_manual: false, javascript_editado_manual: false },
    itemToForm: (t) => ({
      nombre_tarea: t.nombre_tarea,
      descripcion_tarea: t.descripcion_tarea ?? '',
      prioridad: t.prioridad,
      fecha_esperada: t.fecha_esperada ? t.fecha_esperada.substring(0, 10) : '',
      json: t.json == null ? '' : JSON.stringify(t.json, null, 2),
      prompt_insert: (t as unknown as Record<string, unknown>).prompt_insert as string ?? null,
      prompt_update: (t as unknown as Record<string, unknown>).prompt_update as string ?? null,
      system_prompt: t.system_prompt ?? null,
      python_insert: (t as unknown as Record<string, unknown>).python_insert as string ?? null,
      python_update: (t as unknown as Record<string, unknown>).python_update as string ?? null,
      javascript: t.javascript ?? null,
      python_editado_manual: t.python_editado_manual ?? false,
      javascript_editado_manual: t.javascript_editado_manual ?? false,
    }),
  })

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_tarea.localeCompare(b.nombre_tarea),
  )

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda={t('buscarPlaceholder')}
        onNuevo={crud.abrirNuevo}
        textoNuevo={t('nuevaTarea')}
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'ID', campo: 'id_tarea' },
          { titulo: t('colNombre'), campo: 'nombre_tarea' },
          { titulo: t('colPrioridad'), campo: 'prioridad' },
          { titulo: t('colCategoria'), campo: 'codigo_categoria_tarea' },
          { titulo: t('colEstado'), campo: 'codigo_estado_tarea' },
          { titulo: t('colFechaEsperada'), campo: 'fecha_esperada' },
        ]}
        excelNombreArchivo="tareas"
      />

      <TablaCrud
        columnas={[
          {
            titulo: t('colNombre'),
            render: (tarea: Tarea) => (
              <span className="font-medium text-sm">{tarea.nombre_tarea}</span>
            ),
          },
          {
            titulo: t('colPrioridad'),
            render: (tarea: Tarea) => (
              <Insignia variante={PRIORIDAD_VARIANTE[tarea.prioridad] ?? 'neutro'}>
                {PRIORIDADES.find((p) => p.valor === tarea.prioridad)?.etiquetaEs ?? tarea.prioridad}
              </Insignia>
            ),
          },
          {
            titulo: t('colCategoria'),
            render: (tarea: Tarea) => (
              <span className="text-sm text-texto-muted">{tarea.codigo_categoria_tarea}</span>
            ),
          },
          {
            titulo: t('colEstado'),
            render: (tarea: Tarea) => (
              <span className="text-sm text-texto-muted">{tarea.codigo_estado_tarea}</span>
            ),
          },
          {
            titulo: t('colFechaEsperada'),
            render: (tarea: Tarea) =>
              tarea.fecha_esperada ? (
                <span className="text-sm text-texto-muted">
                  {new Date(tarea.fecha_esperada).toLocaleDateString('es-CL')}
                </span>
              ) : (
                <span className="text-texto-light">—</span>
              ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(tarea) => String(tarea.id_tarea)}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio={t('sinTareas')}
      />

      {/* Modal crear/editar */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={
          crud.editando
            ? t('editarTitulo', { nombre: crud.editando.nombre_tarea })
            : t('nuevoTitulo')
        }
        className="max-w-lg"
      >
        <div className="flex flex-col gap-4 min-w-[400px] min-h-[500px]">
          <div className="flex gap-1 border-b border-borde -mt-2">
            {([
              { key: 'datos' as TabTarea, label: 'Datos' },
              { key: 'json' as TabTarea, label: 'JSON' },
              ...(crud.editando ? [
                { key: 'system_prompt' as TabTarea, label: 'System Prompt' },
                { key: 'programacion_insert' as TabTarea, label: 'Prog. Insert' },
                { key: 'programacion_update' as TabTarea, label: 'Prog. Update' },
              ] : []),
            ]).map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTabModal(tb.key)}
                className={`flex-1 text-center px-3 py-2 text-sm border-b-2 ${tabModal === tb.key ? 'border-primario text-primario font-medium' : 'border-transparent text-texto-muted'}`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tabModal === 'datos' && <Input
            etiqueta={t('etiquetaNombre')}
            value={crud.form.nombre_tarea}
            onChange={(e) => crud.updateForm('nombre_tarea', e.target.value)}
            placeholder={t('placeholderNombre')}
            autoFocus
          />}

          {tabModal === 'datos' && <Textarea
            etiqueta={t('etiquetaDescripcion')}
            value={crud.form.descripcion_tarea}
            onChange={(e) => crud.updateForm('descripcion_tarea', e.target.value)}
            placeholder={t('placeholderDescripcion')}
            rows={3}
          />}

          {tabModal === 'datos' && <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">{t('etiquetaPrioridad')}</label>
            <select
              className={selectClass}
              value={crud.form.prioridad}
              onChange={(e) =>
                crud.updateForm('prioridad', e.target.value as FormTarea['prioridad'])
              }
            >
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiquetaEs}
                </option>
              ))}
            </select>
          </div>}

          {tabModal === 'datos' && <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">{t('etiquetaFechaEsperada')}</label>
            <input
              type="date"
              className={selectClass}
              value={crud.form.fecha_esperada}
              onChange={(e) => crud.updateForm('fecha_esperada', e.target.value)}
            />
          </div>}

          {tabModal === 'json' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-texto">{t('etiquetaJson')}</label>
              <textarea
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm font-mono text-texto focus:outline-none focus:ring-2 focus:ring-primario min-h-[300px]"
                value={crud.form.json}
                onChange={(e) => crud.updateForm('json', e.target.value)}
                placeholder='{\n  "clave": "valor"\n}'
                spellCheck={false}
              />
              <p className="text-xs text-texto-muted">{t('descJson')}</p>
            </div>
          )}

          {tabModal === 'system_prompt' && crud.editando && (
            <TabPrompts
              tabla="tareas"
              pkColumna="id_tarea"
              pkValor={crud.editando.id_tarea}
              campos={{ prompt_insert: crud.form.prompt_insert, prompt_update: crud.form.prompt_update, system_prompt: crud.form.system_prompt, python_insert: crud.form.python_insert, python_update: crud.form.python_update, javascript: crud.form.javascript, python_editado_manual: crud.form.python_editado_manual, javascript_editado_manual: crud.form.javascript_editado_manual }}
              onCampoCambiado={(c, v) => crud.updateForm(c as keyof FormTarea, v)}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {tabModal === 'programacion_insert' && crud.editando && (
            <TabPrompts
              tabla="tareas"
              pkColumna="id_tarea"
              pkValor={crud.editando.id_tarea}
              campos={{ prompt_insert: crud.form.prompt_insert, prompt_update: crud.form.prompt_update, system_prompt: crud.form.system_prompt, python_insert: crud.form.python_insert, python_update: crud.form.python_update, javascript: crud.form.javascript, python_editado_manual: crud.form.python_editado_manual, javascript_editado_manual: crud.form.javascript_editado_manual }}
              onCampoCambiado={(c, v) => crud.updateForm(c as keyof FormTarea, v)}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptUpdate={false}
              mostrarPythonUpdate={false}
            />
          )}
          {tabModal === 'programacion_update' && crud.editando && (
            <TabPrompts
              tabla="tareas"
              pkColumna="id_tarea"
              pkValor={crud.editando.id_tarea}
              campos={{ prompt_insert: crud.form.prompt_insert, prompt_update: crud.form.prompt_update, system_prompt: crud.form.system_prompt, python_insert: crud.form.python_insert, python_update: crud.form.python_update, javascript: crud.form.javascript, python_editado_manual: crud.form.python_editado_manual, javascript_editado_manual: crud.form.javascript_editado_manual }}
              onCampoCambiado={(c, v) => crud.updateForm(c as keyof FormTarea, v)}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptInsert={false}
              mostrarPythonInsert={false}
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
              if (!crud.form.nombre_tarea.trim()) {
                crud.setError(t('errorNombreObligatorio'))
                return
              }
              crud.guardar(undefined, undefined, { cerrar: false })
            }}
            onGuardarYSalir={() => {
              if (!crud.form.nombre_tarea.trim()) {
                crud.setError(t('errorNombreObligatorio'))
                return
              }
              crud.guardar(undefined, undefined, { cerrar: true })
            }}
            onCerrar={crud.cerrarModal}
            cargando={crud.guardando}
            botonesIzquierda={(tabModal === 'system_prompt' || tabModal === 'programacion_insert' || tabModal === 'programacion_update') && crud.editando ? (
              <PieBotonesPrompts
                tabla="tareas"
                pkColumna="id_tarea"
                pkValor={crud.editando.id_tarea}
                promptInsert={crud.form.prompt_insert ?? undefined}
                promptUpdate={crud.form.prompt_update ?? undefined}
              />
            ) : undefined}
          />
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        alCerrar={() => crud.setConfirmacion(null)}
        alConfirmar={crud.ejecutarEliminacion}
        titulo={t('eliminarTitulo')}
        mensaje={
          crud.confirmacion
            ? t('eliminarConfirm', { nombre: crud.confirmacion.nombre_tarea })
            : ''
        }
        textoConfirmar={tc('eliminar')}
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
