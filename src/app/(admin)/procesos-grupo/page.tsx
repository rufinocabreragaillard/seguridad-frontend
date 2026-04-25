'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { TablaCrud, columnaNombre } from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { procesosGrupoApi } from '@/lib/api'
import type { ProcesoGrupo } from '@/lib/api'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import {
  TIPOS_ELEMENTO_SIN_SISTEMA,
  etiquetaTipo,
  varianteTipo,
} from '@/lib/tipo-elemento'

const selectClass =
  'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

type FormProceso = {
  nombre_proceso_grupo: string
  descripcion: string
  tipo_acceso: string
  alias: string
  ayuda: string
}

export default function PaginaProcesosGrupo() {
  const t = useTranslations('procesosGrupo')
  const tc = useTranslations('common')

  const crud = useCrudPage<ProcesoGrupo, FormProceso>({
    cargarFn: () => procesosGrupoApi.listar(),
    crearFn: (f) =>
      procesosGrupoApi.crear({
        nombre_proceso_grupo: f.nombre_proceso_grupo.trim(),
        descripcion: f.descripcion?.trim() || undefined,
        tipo_acceso: f.tipo_acceso,
        alias: f.alias?.trim() || undefined,
        ayuda: f.ayuda?.trim() || undefined,
      } as Partial<ProcesoGrupo>),
    actualizarFn: (id, f) =>
      procesosGrupoApi.actualizar(Number(id), {
        nombre_proceso_grupo: f.nombre_proceso_grupo?.trim(),
        descripcion: f.descripcion?.trim() || undefined,
        tipo_acceso: f.tipo_acceso,
        alias: f.alias?.trim() || undefined,
        ayuda: f.ayuda?.trim() || undefined,
      } as Partial<ProcesoGrupo>),
    eliminarFn: (id) => procesosGrupoApi.eliminar(Number(id)).then(() => {}),
    getId: (p) => String(p.id_proceso_grupo),
    camposBusqueda: (p) => [p.codigo_proceso_grupo, p.nombre_proceso_grupo, p.descripcion ?? '', p.tipo_acceso],
    formInicial: { nombre_proceso_grupo: '', descripcion: '', tipo_acceso: 'USUARIO', alias: '', ayuda: '' },
    itemToForm: (p) => ({
      nombre_proceso_grupo: p.nombre_proceso_grupo,
      descripcion: p.descripcion ?? '',
      tipo_acceso: p.tipo_acceso ?? 'USUARIO',
      alias: p.alias ?? '',
      ayuda: p.ayuda ?? '',
    }),
  })

  const filtradosOrdenados = [...crud.filtrados].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre_proceso_grupo.localeCompare(b.nombre_proceso_grupo),
  )

  const reordenar = async (nuevos: ProcesoGrupo[]) => {
    try {
      await procesosGrupoApi.reordenar(nuevos.map(p => ({ id_proceso_grupo: p.id_proceso_grupo, orden: p.orden ?? 0 })))
      crud.cargar()
    } catch { crud.cargar() }
  }

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28 flex items-start justify-between gap-4">
        <div>
          <h2 className="page-heading">{t('titulo')}</h2>
          <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
        </div>
        <Boton variante="primario" onClick={crud.abrirNuevo}>
          <Plus size={16} /> {t('nuevo')}
        </Boton>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda={t('buscarPlaceholder')}
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: t('colCodigo'), campo: 'codigo_proceso_grupo' },
          { titulo: t('colNombre'), campo: 'nombre_proceso_grupo' },
          { titulo: t('colTipo'), campo: 'tipo_acceso' },
          { titulo: t('colOrden'), campo: 'orden' },
          { titulo: t('colDescripcion'), campo: 'descripcion' },
        ]}
        excelNombreArchivo="procesos-grupo"
      />

      <TablaCrud
        columnas={[
          columnaNombre<ProcesoGrupo>(t('colNombre'), (p) => p.nombre_proceso_grupo),
          {
            titulo: t('colTipo'),
            render: (p: ProcesoGrupo) => (
              <Insignia variante={varianteTipo(p.tipo_acceso)}>{etiquetaTipo(p.tipo_acceso)}</Insignia>
            ),
          },
          {
            titulo: t('colDescripcion'),
            render: (p: ProcesoGrupo) => (
              <span className="text-sm text-texto-muted line-clamp-2">{p.descripcion ?? ''}</span>
            ),
          },
          {
            titulo: t('colCodigo'),
            render: (p: ProcesoGrupo) => (
              <span className="text-xs text-texto-muted font-mono">{p.codigo_proceso_grupo}</span>
            ),
          },
          {
            titulo: tc('acciones'),
            render: (p: ProcesoGrupo) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  crud.setConfirmacion(p)
                }}
                className="p-1 rounded text-error hover:bg-error/10 transition-colors"
                title={tc('eliminar')}
              >
                <Trash2 size={16} />
              </button>
            ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(p) => String(p.id_proceso_grupo)}
        onEditar={crud.abrirEditar}
        textoVacio={t('sinProcesos')}
        onReordenar={(nuevos) => reordenar(nuevos as unknown as ProcesoGrupo[])}
        sortDisabled={!!crud.busqueda}
      />

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={
          crud.editando
            ? t('editarTitulo', { nombre: crud.editando.nombre_proceso_grupo })
            : t('nuevoTitulo')
        }
        className="max-w-lg"
      >
        <div className="flex flex-col gap-4 min-w-[400px]">
          <Input
            etiqueta={t('etiquetaNombre')}
            value={crud.form.nombre_proceso_grupo}
            onChange={(e) => crud.updateForm('nombre_proceso_grupo', e.target.value)}
            placeholder={t('placeholderNombre')}
            autoFocus
          />

          <Textarea
            etiqueta={t('etiquetaDescripcion')}
            value={crud.form.descripcion}
            onChange={(e) => crud.updateForm('descripcion', e.target.value)}
            placeholder={t('placeholderDescripcion')}
            rows={3}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">{t('etiquetaTipo')}</label>
            <select
              className={selectClass}
              value={crud.form.tipo_acceso}
              onChange={(e) => crud.updateForm('tipo_acceso', e.target.value)}
            >
              {TIPOS_ELEMENTO_SIN_SISTEMA.map((tp) => (
                <option key={tp} value={tp}>{etiquetaTipo(tp)}</option>
              ))}
            </select>
          </div>

          <Input
            etiqueta={t('etiquetaAlias')}
            value={crud.form.alias}
            onChange={(e) => crud.updateForm('alias', e.target.value)}
          />

          <Textarea
            etiqueta={t('etiquetaAyuda')}
            value={crud.form.ayuda}
            onChange={(e) => crud.updateForm('ayuda', e.target.value)}
            rows={2}
          />

          {crud.editando && (
            <Input
              etiqueta={t('etiquetaCodigo')}
              value={crud.editando.codigo_proceso_grupo}
              onChange={() => {}}
              disabled
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
              if (!crud.form.nombre_proceso_grupo.trim()) {
                crud.setError(t('errorNombreObligatorio'))
                return
              }
              crud.guardar(undefined, undefined, { cerrar: false })
            }}
            onGuardarYSalir={() => {
              if (!crud.form.nombre_proceso_grupo.trim()) {
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
        cargando={crud.eliminando}
        titulo={tc('eliminar')}
        mensaje={t('confirmarEliminar', { nombre: crud.confirmacion?.nombre_proceso_grupo ?? '' })}
      />
    </div>
  )
}
