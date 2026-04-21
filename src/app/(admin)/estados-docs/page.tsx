'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaCodigo, columnaNombre, columnaDescripcion, columnaEstado } from '@/components/ui/tabla-crud'
import { estadosDocsApi } from '@/lib/api'
import { invalidarCatalogo } from '@/lib/catalogos'
import type { EstadoDoc } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import { TabPrompts } from '@/components/ui/tab-prompts'

type TabModal = 'datos' | 'prompts'

export default function PaginaEstadosDocs() {
  const t = useTranslations('estadosDocs')
  const tc = useTranslations('common')
  const [tabModal, setTabModal] = useState<TabModal>('datos')

  const crud = useCrudPage<EstadoDoc, {
    codigo_estado_doc: string
    nombre_estado: string
    descripcion: string
    prompt: string
    system_prompt: string
    python: string
    javascript: string
    python_editado_manual: boolean
    javascript_editado_manual: boolean
  }>({
    cargarFn: estadosDocsApi.listar,
    crearFn: async (f) => {
      const r = await estadosDocsApi.crear({
        codigo_estado_doc: f.codigo_estado_doc.toUpperCase().replace(/\s+/g, '_'),
        nombre_estado: f.nombre_estado,
        descripcion: f.descripcion || undefined,
      })
      invalidarCatalogo('estadosDocs')
      return r
    },
    actualizarFn: async (id, f) => {
      const r = await estadosDocsApi.actualizar(id, {
        nombre_estado: f.nombre_estado,
        descripcion: f.descripcion || undefined,
        prompt: f.prompt || undefined,
        system_prompt: f.system_prompt || undefined,
        python: f.python || undefined,
        javascript: f.javascript || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as Record<string, unknown>)
      invalidarCatalogo('estadosDocs')
      return r
    },
    eliminarFn: async (id: string) => {
      await estadosDocsApi.desactivar(id)
      invalidarCatalogo('estadosDocs')
    },
    getId: (e) => e.codigo_estado_doc,
    camposBusqueda: (e) => [e.codigo_estado_doc, e.nombre_estado],
    formInicial: { codigo_estado_doc: '', nombre_estado: '', descripcion: '', prompt: '', system_prompt: '', python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false },
    itemToForm: (e) => ({
      codigo_estado_doc: e.codigo_estado_doc,
      nombre_estado: e.nombre_estado,
      descripcion: e.descripcion || '',
      prompt: e.prompt || '',
      system_prompt: e.system_prompt || '',
      python: (e as unknown as Record<string, unknown>).python as string || '',
      javascript: (e as unknown as Record<string, unknown>).javascript as string || '',
      python_editado_manual: ((e as unknown as Record<string, unknown>).python_editado_manual as boolean) ?? false,
      javascript_editado_manual: ((e as unknown as Record<string, unknown>).javascript_editado_manual as boolean) ?? false,
    }),
  })

  // Reset tab when modal opens
  useEffect(() => {
    if (crud.modal) setTabModal('datos')
  }, [crud.modal])

  const [guardandoLocal, setGuardandoLocal] = useState(false)
  const guardandoEstado = crud.guardando || guardandoLocal

  const guardarEstado = async (cerrar: boolean) => {
    if (!crud.form.codigo_estado_doc.trim() || !crud.form.nombre_estado.trim()) {
      crud.setError(t('errorCodigoNombre'))
      return
    }
    if (cerrar) {
      // Use crud.guardar which auto-closes
      crud.guardar()
    } else {
      // Manual save: don't close modal
      crud.setError('')
      setGuardandoLocal(true)
      try {
        if (crud.editando) {
          await estadosDocsApi.actualizar(crud.editando.codigo_estado_doc, {
            nombre_estado: crud.form.nombre_estado,
            descripcion: crud.form.descripcion || undefined,
            prompt: crud.form.prompt || undefined,
            system_prompt: crud.form.system_prompt || undefined,
          })
        } else {
          const nuevo = await estadosDocsApi.crear({
            codigo_estado_doc: crud.form.codigo_estado_doc.toUpperCase().replace(/\s+/g, '_'),
            nombre_estado: crud.form.nombre_estado,
            descripcion: crud.form.descripcion || undefined,
          })
          // Switch to edit mode with new record
          crud.abrirEditar(nuevo)
        }
        invalidarCatalogo('estadosDocs')
        crud.cargar()
      } catch (e) {
        crud.setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
      } finally {
        setGuardandoLocal(false)
      }
    }
  }

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) => a.orden - b.orden || a.nombre_estado.localeCompare(b.nombre_estado))

  const TABS: { key: TabModal; label: string }[] = [
    { key: 'datos', label: 'Datos' },
    { key: 'prompts', label: 'Prompts' },
  ]

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
        textoNuevo={t('nuevoEstado')}
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: t('colCodigo'), campo: 'codigo_estado_doc' },
          { titulo: t('colNombre'), campo: 'nombre_estado' },
          { titulo: t('colDescripcion'), campo: 'descripcion' },
          { titulo: t('colEstado'), campo: 'activo', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
        ]}
        excelNombreArchivo="estados-docs"
      />

      <TablaCrud
        columnas={[
          columnaCodigo<EstadoDoc>(t('colCodigo'), (e) => e.codigo_estado_doc),
          columnaNombre<EstadoDoc>(t('colNombre'), (e) => e.nombre_estado),
          columnaDescripcion<EstadoDoc>(t('colDescripcion'), (e) => e.descripcion),
          columnaEstado<EstadoDoc>((e) => e.activo),
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(e) => e.codigo_estado_doc}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio={t('sinEstados')}
      />

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? t('editarTitulo', { nombre: crud.editando.nombre_estado }) : t('nuevoTitulo')}
        className="w-[520px] max-w-[95vw]"
      >
        <div className="flex flex-col gap-4">
          {/* Tabs — solo al editar */}
          {crud.editando && (
            <div className="flex border-b border-borde overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTabModal(tab.key)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    tabModal === tab.key
                      ? 'border-b-2 border-primario text-primario'
                      : 'text-texto-muted hover:text-texto'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab Datos */}
          {(!crud.editando || tabModal === 'datos') && (
            <div className="flex flex-col gap-4">
              <Input
                etiqueta={t('etiquetaCodigo')}
                value={crud.form.codigo_estado_doc}
                onChange={(e) => crud.updateForm('codigo_estado_doc', e.target.value)}
                placeholder={t('placeholderCodigo')}
                disabled={!!crud.editando}
              />
              <Input
                etiqueta={t('etiquetaNombre')}
                value={crud.form.nombre_estado}
                onChange={(e) => crud.updateForm('nombre_estado', e.target.value)}
                placeholder={t('placeholderNombre')}
              />
              <Textarea
                etiqueta={t('etiquetaDescripcion')}
                value={crud.form.descripcion}
                onChange={(e) => crud.updateForm('descripcion', e.target.value)}
                placeholder={t('placeholderDescripcion')}
                rows={3}
              />
            </div>
          )}

          {/* Tab Prompts — sistema "Todo por Prompts" */}
          {crud.editando && tabModal === 'prompts' && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="estados_docs"
                pkColumna="codigo_estado_doc"
                pkValor={crud.editando.codigo_estado_doc}
                campos={{
                  prompt: crud.form.prompt,
                  system_prompt: crud.form.system_prompt,
                  python: crud.form.python,
                  javascript: crud.form.javascript,
                  python_editado_manual: crud.form.python_editado_manual,
                  javascript_editado_manual: crud.form.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => crud.updateForm(c as keyof typeof crud.form, v as never)}
              />
              <PieBotonesModal
                editando={!!crud.editando}
                onGuardar={() => guardarEstado(false)}
                onGuardarYSalir={() => guardarEstado(true)}
                onCerrar={crud.cerrarModal}
                cargando={guardandoEstado}
              />
            </div>
          )}

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          {/* Botones principales (solo en tab datos o al crear) */}
          {(!crud.editando || tabModal === 'datos') && (
            <PieBotonesModal
              editando={!!crud.editando}
              onGuardar={() => guardarEstado(false)}
              onGuardarYSalir={() => guardarEstado(true)}
              onCerrar={crud.cerrarModal}
              cargando={guardandoEstado}
            />
          )}
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        alCerrar={() => crud.setConfirmacion(null)}
        alConfirmar={crud.ejecutarEliminacion}
        titulo={t('desactivarTitulo')}
        mensaje={crud.confirmacion ? t('desactivarConfirm', { nombre: crud.confirmacion.nombre_estado }) : ''}
        textoConfirmar="Desactivar"
        cargando={crud.eliminando}
      />
    </div>
  )
}
