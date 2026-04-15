'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaCodigo, columnaNombre, columnaDescripcion, columnaEstado } from '@/components/ui/tabla-crud'
import { estadosDocsApi } from '@/lib/api'
import type { EstadoDoc } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'

type TabModal = 'datos' | 'prompt' | 'system_prompt'

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
  }>({
    cargarFn: estadosDocsApi.listar,
    crearFn: (f) => estadosDocsApi.crear({
      codigo_estado_doc: f.codigo_estado_doc.toUpperCase().replace(/\s+/g, '_'),
      nombre_estado: f.nombre_estado,
      descripcion: f.descripcion || undefined,
    }),
    actualizarFn: (id, f) => estadosDocsApi.actualizar(id, {
      nombre_estado: f.nombre_estado,
      descripcion: f.descripcion || undefined,
      prompt: f.prompt || undefined,
      system_prompt: f.system_prompt || undefined,
    }),
    eliminarFn: async (id: string) => { await estadosDocsApi.desactivar(id) },
    getId: (e) => e.codigo_estado_doc,
    camposBusqueda: (e) => [e.codigo_estado_doc, e.nombre_estado],
    formInicial: { codigo_estado_doc: '', nombre_estado: '', descripcion: '', prompt: '', system_prompt: '' },
    itemToForm: (e) => ({
      codigo_estado_doc: e.codigo_estado_doc,
      nombre_estado: e.nombre_estado,
      descripcion: e.descripcion || '',
      prompt: e.prompt || '',
      system_prompt: e.system_prompt || '',
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
    { key: 'prompt', label: 'Prompt' },
    { key: 'system_prompt', label: 'System Prompt' },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
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

          {/* Tab Prompt */}
          {crud.editando && tabModal === 'prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Texto inyectado al prompt del LLM cuando procesa documentos en este estado. Da contexto para mejorar la precisión.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Este estado corresponde a documentos que ya han sido cargados y están pendientes de procesamiento..."
                value={crud.form.prompt}
                onChange={(e) => crud.updateForm('prompt', e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <Boton variante="contorno" tamano="sm" onClick={() => guardarEstado(true)} cargando={guardandoEstado}>
                  Guardar y salir
                </Boton>
                <Boton variante="primario" tamano="sm" onClick={() => guardarEstado(false)} cargando={guardandoEstado}>
                  {tc('guardar')}
                </Boton>
              </div>
            </div>
          )}

          {/* Tab System Prompt */}
          {crud.editando && tabModal === 'system_prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Instrucciones de sistema para el LLM al procesar documentos en este estado. Define el rol y restricciones del asistente.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Eres un asistente experto en análisis documental..."
                value={crud.form.system_prompt}
                onChange={(e) => crud.updateForm('system_prompt', e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <Boton variante="contorno" tamano="sm" onClick={() => guardarEstado(true)} cargando={guardandoEstado}>
                  Guardar y salir
                </Boton>
                <Boton variante="primario" tamano="sm" onClick={() => guardarEstado(false)} cargando={guardandoEstado}>
                  {tc('guardar')}
                </Boton>
              </div>
            </div>
          )}

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          {/* Botones principales (solo en tab datos o al crear) */}
          {(!crud.editando || tabModal === 'datos') && (
            <div className="flex gap-3 justify-end pt-2">
              <Boton variante="contorno" onClick={crud.cerrarModal}>{tc('cancelar')}</Boton>
              <Boton variante="contorno" onClick={() => guardarEstado(true)} cargando={guardandoEstado}>
                Guardar y salir
              </Boton>
              <Boton variante="primario" onClick={() => guardarEstado(false)} cargando={guardandoEstado}>
                {tc('guardar')}
              </Boton>
            </div>
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
