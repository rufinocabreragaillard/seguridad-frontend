'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaCodigo, columnaNombre, columnaDescripcion, columnaEstado } from '@/components/ui/tabla-crud'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { tiposDocumentoPersonaApi } from '@/lib/api'
import type { TipoDocumentoPersona } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

type FormTipoDocPers = {
  codigo_tipo_doc: string
  nombre: string
  descripcion: string
  prompt_insert: string
  prompt_update: string
  system_prompt: string
  python_insert: string
  python_update: string
  javascript: string
  python_editado_manual: boolean
  javascript_editado_manual: boolean
}

export default function PaginaTiposDocumentoPersona() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('tiposDocumentoPersona')
  const tc = useTranslations('common')
  const [tabModal, setTabModal] = useState<'datos' | 'system_prompt' | 'programacion'>('datos')

  const crud = useCrudPage<TipoDocumentoPersona, FormTipoDocPers>({
    cargarFn: tiposDocumentoPersonaApi.listar,
    crearFn: (f) => tiposDocumentoPersonaApi.crear({
      ...(f.codigo_tipo_doc.trim() ? { codigo_tipo_doc: f.codigo_tipo_doc.toUpperCase() } : { codigo_tipo_doc: '' }),
      codigo_grupo: grupoActivo ?? undefined,
      nombre: f.nombre,
      descripcion: f.descripcion || undefined,
      prompt_insert: f.prompt_insert || undefined,
      prompt_update: f.prompt_update || undefined,
      system_prompt: f.system_prompt || undefined,
      python_insert: f.python_insert || undefined,
      python_update: f.python_update || undefined,
      javascript: f.javascript || undefined,
      python_editado_manual: f.python_editado_manual,
      javascript_editado_manual: f.javascript_editado_manual,
    } as Record<string, unknown>),
    actualizarFn: (id, f) => tiposDocumentoPersonaApi.actualizar(id, {
      nombre: f.nombre,
      descripcion: f.descripcion || undefined,
      prompt_insert: f.prompt_insert || undefined,
      prompt_update: f.prompt_update || undefined,
      system_prompt: f.system_prompt || undefined,
      python_insert: f.python_insert || undefined,
      python_update: f.python_update || undefined,
      javascript: f.javascript || undefined,
      python_editado_manual: f.python_editado_manual,
      javascript_editado_manual: f.javascript_editado_manual,
    } as Record<string, unknown>),
    eliminarFn: async (id: string) => { await tiposDocumentoPersonaApi.desactivar(id) },
    getId: (item) => item.codigo_tipo_doc,
    camposBusqueda: (item) => [item.codigo_tipo_doc, item.nombre],
    formInicial: { codigo_tipo_doc: '', nombre: '', descripcion: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false },
    itemToForm: (item) => {
      const i2 = item as unknown as Record<string, unknown>
      return {
        codigo_tipo_doc: item.codigo_tipo_doc,
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        prompt_insert: i2.prompt_insert as string || '',
        prompt_update: i2.prompt_update as string || '',
        system_prompt: i2.system_prompt as string || '',
        python_insert: i2.python_insert as string || '',
        python_update: i2.python_update as string || '',
        javascript: i2.javascript as string || '',
        python_editado_manual: i2.python_editado_manual as boolean || false,
        javascript_editado_manual: i2.javascript_editado_manual as boolean || false,
      }
    },
  })

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre))

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
        textoNuevo={t('nuevoTipo')}
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: t('colCodigo'), campo: 'codigo_tipo_doc' },
          { titulo: t('colNombre'), campo: 'nombre' },
          { titulo: t('colDescripcion'), campo: 'descripcion' },
          { titulo: t('colEstado'), campo: 'activo', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
        ]}
        excelNombreArchivo="tipos-documento-persona"
      />

      <TablaCrud
        columnas={[
          columnaNombre<TipoDocumentoPersona>(t('colNombre'), (item) => item.nombre),
          columnaDescripcion<TipoDocumentoPersona>(t('colDescripcion'), (item) => item.descripcion),
          columnaEstado<TipoDocumentoPersona>((item) => item.activo),
          columnaCodigo<TipoDocumentoPersona>(t('colCodigo'), (item) => item.codigo_tipo_doc),
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(item) => item.codigo_tipo_doc}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio={t('sinTipos')}
      />

      <Modal abierto={crud.modal} alCerrar={crud.cerrarModal} titulo={crud.editando ? t('editarTitulo', { nombre: crud.editando.nombre }) : t('nuevoTitulo')} className="max-w-2xl">
        <div className="flex flex-col gap-4 min-w-[480px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'system_prompt', 'programacion'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModal(tab)}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${
                  tabModal === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : 'Programación'}
              </button>
            ))}
          </div>

          {tabModal === 'datos' && (<>
            <Input
              etiqueta={t('etiquetaNombre')}
              value={crud.form.nombre}
              onChange={(e) => crud.updateForm('nombre', e.target.value)}
              placeholder={t('placeholderNombre')}
            />
            <div>
              <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaDescripcion')}</label>
              <textarea
                className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[60px]"
                value={crud.form.descripcion}
                onChange={(e) => crud.updateForm('descripcion', e.target.value)}
                placeholder={t('placeholderDescripcion')}
              />
            </div>
            {crud.editando && (
              <Input etiqueta={t('etiquetaCodigo')} value={crud.form.codigo_tipo_doc} disabled readOnly />
            )}
          </>)}

          {tabModal === 'system_prompt' && (
            <TabPrompts
              tabla="tipos_documento_persona"
              pkColumna="codigo_tipo_doc"
              pkValor={crud.editando?.codigo_tipo_doc ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormTipoDocPers, valor as string | boolean)}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {tabModal === 'programacion' && (
            <TabPrompts
              tabla="tipos_documento_persona"
              pkColumna="codigo_tipo_doc"
              pkValor={crud.editando?.codigo_tipo_doc ?? null}
              campos={crud.form}
              onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormTipoDocPers, valor as string | boolean)}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
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
              if (!crud.form.nombre.trim()) {
                crud.setError(t('errorNombreObligatorio'))
                return
              }
              crud.guardar(undefined, undefined, { cerrar: false })
            }}
            onGuardarYSalir={() => {
              if (!crud.form.nombre.trim()) {
                crud.setError(t('errorNombreObligatorio'))
                return
              }
              crud.guardar(undefined, undefined, { cerrar: true })
            }}
            onCerrar={crud.cerrarModal}
            cargando={crud.guardando}
            botonesIzquierda={(tabModal === 'system_prompt' || tabModal === 'programacion') && crud.editando ? (
              <PieBotonesPrompts
                tabla="tipos_documento_persona"
                pkColumna="codigo_tipo_doc"
                pkValor={crud.editando.codigo_tipo_doc}
                promptInsert={crud.form.prompt_insert || undefined}
                promptUpdate={crud.form.prompt_update || undefined}
              />
            ) : undefined}
          />
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        alCerrar={() => crud.setConfirmacion(null)}
        alConfirmar={crud.ejecutarEliminacion}
        titulo={t('desactivarTitulo')}
        mensaje={crud.confirmacion ? t('desactivarConfirm', { nombre: crud.confirmacion.nombre }) : ''}
        textoConfirmar="Desactivar"
        cargando={crud.eliminando}
      />
    </div>
  )
}
