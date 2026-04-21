'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaCodigo, columnaNombre, columnaDescripcion, columnaEstado } from '@/components/ui/tabla-crud'
import { tiposDocumentoPersonaApi } from '@/lib/api'
import type { TipoDocumentoPersona } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

export default function PaginaTiposDocumentoPersona() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('tiposDocumentoPersona')
  const tc = useTranslations('common')

  const crud = useCrudPage<TipoDocumentoPersona, { codigo_tipo_doc: string; nombre: string; descripcion: string }>({
    cargarFn: tiposDocumentoPersonaApi.listar,
    crearFn: (f) => tiposDocumentoPersonaApi.crear({
      ...(f.codigo_tipo_doc.trim() ? { codigo_tipo_doc: f.codigo_tipo_doc.toUpperCase() } : { codigo_tipo_doc: '' }),
      codigo_grupo: grupoActivo ?? undefined,
      nombre: f.nombre,
      descripcion: f.descripcion || undefined,
    }),
    actualizarFn: (id, f) => tiposDocumentoPersonaApi.actualizar(id, {
      nombre: f.nombre,
      descripcion: f.descripcion || undefined,
    }),
    eliminarFn: async (id: string) => { await tiposDocumentoPersonaApi.desactivar(id) },
    getId: (item) => item.codigo_tipo_doc,
    camposBusqueda: (item) => [item.codigo_tipo_doc, item.nombre],
    formInicial: { codigo_tipo_doc: '', nombre: '', descripcion: '' },
    itemToForm: (item) => ({ codigo_tipo_doc: item.codigo_tipo_doc, nombre: item.nombre, descripcion: item.descripcion || '' }),
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

      <Modal abierto={crud.modal} alCerrar={crud.cerrarModal} titulo={crud.editando ? t('editarTitulo', { nombre: crud.editando.nombre }) : t('nuevoTitulo')}>
        <div className="flex flex-col gap-4">
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
