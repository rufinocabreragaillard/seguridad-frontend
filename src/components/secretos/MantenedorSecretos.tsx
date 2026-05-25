'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import {
  TablaCrud,
  columnaNombre,
  columnaDescripcion,
} from '@/components/ui/tabla-crud'
import type { SecretoGrupo } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'

type FormSecreto = {
  tipo_secreto: string
  valor: string
  descripcion: string
}

interface SecretosApi {
  listar: () => Promise<SecretoGrupo[]>
  crear: (data: { tipo_secreto: string; valor: string; descripcion?: string }) => Promise<SecretoGrupo>
  actualizar: (tipo_secreto: string, data: { valor?: string; descripcion?: string }) => Promise<SecretoGrupo>
  eliminar: (tipo_secreto: string) => Promise<unknown>
}

interface Props {
  /** Namespace i18n: 'secrets' (grupo) o 'secretsSystem' (producto). */
  namespace: string
  /** Wrapper API: secretosApi o secretosSistemaApi. */
  apiClient: SecretosApi
  /** Nombre del archivo Excel exportado. */
  excelNombre: string
}

export function MantenedorSecretos({ namespace, apiClient, excelNombre }: Props) {
  const t = useTranslations(namespace)
  const tc = useTranslations('common')

  const crud = useCrudPage<SecretoGrupo, FormSecreto>({
    cargarFn: () => apiClient.listar(),
    crearFn: (f) =>
      apiClient.crear({
        tipo_secreto: f.tipo_secreto.trim(),
        valor: f.valor,
        descripcion: f.descripcion.trim() || undefined,
      }),
    actualizarFn: (id, f) =>
      apiClient.actualizar(id, {
        valor: f.valor ? f.valor : undefined,
        descripcion: (f.descripcion ?? '').trim(),
      }),
    eliminarFn: async (id) => { await apiClient.eliminar(id) },
    getId: (s) => s.tipo_secreto,
    camposBusqueda: (s) => [s.tipo_secreto, s.descripcion ?? ''],
    formInicial: { tipo_secreto: '', valor: '', descripcion: '' },
    // El valor nunca llega del backend: al editar siempre se parte vacío.
    itemToForm: (s) => ({
      tipo_secreto: s.tipo_secreto,
      valor: '',
      descripcion: s.descripcion ?? '',
    }),
  })

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.tipo_secreto.localeCompare(b.tipo_secreto),
  )

  const guardarValido = (cerrar: boolean) => {
    if (!crud.editando && !crud.form.tipo_secreto.trim()) {
      crud.setError(t('errorTipoObligatorio'))
      return
    }
    if (!crud.editando && !crud.form.valor) {
      crud.setError(t('errorValorObligatorio'))
      return
    }
    crud.guardar(undefined, undefined, { cerrar })
  }

  return (
    <div className="relative flex flex-col gap-6 max-w-3xl">
      <div>
        <PageHeader i18nNamespace={namespace} conSubtitulo={false} />
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda={t('buscarPlaceholder')}
        onNuevo={() => crud.abrirNuevo()}
        textoNuevo={t('nuevoSecreto')}
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: t('colTipo'), campo: 'tipo_secreto' },
          { titulo: t('colDescripcion'), campo: 'descripcion' },
          { titulo: t('colActualizado'), campo: 'actualizado_en' },
        ]}
        excelNombreArchivo={excelNombre}
      />

      <TablaCrud
        columnas={[
          columnaNombre<SecretoGrupo>(t('colTipo'), (s) => s.tipo_secreto),
          columnaDescripcion<SecretoGrupo>(t('colDescripcion'), (s) => s.descripcion),
          {
            titulo: t('colActualizado'),
            render: (s: SecretoGrupo) =>
              s.actualizado_en ? new Date(s.actualizado_en).toLocaleString() : '—',
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(s) => s.tipo_secreto}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio={t('sinSecretos')}
      />

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={
          crud.editando
            ? `${t('editarTitulo')}: ${crud.editando.tipo_secreto}`
            : t('nuevoTitulo')
        }
        className="max-w-md"
      >
        <div className="flex flex-col gap-4 min-w-[360px]">
          <Input
            etiqueta={t('etiquetaTipo')}
            value={crud.form.tipo_secreto}
            onChange={(e) => crud.updateForm('tipo_secreto', e.target.value)}
            placeholder={t('placeholderTipo')}
            disabled={!!crud.editando}
            autoFocus={!crud.editando}
          />

          <div className="flex flex-col gap-1">
            <Input
              etiqueta={t('etiquetaValor')}
              type="password"
              value={crud.form.valor}
              onChange={(e) => crud.updateForm('valor', e.target.value)}
              placeholder={crud.editando ? t('placeholderValorEditar') : t('placeholderValor')}
              autoComplete="new-password"
              autoFocus={!!crud.editando}
            />
            <p className="text-xs text-texto-muted">
              {crud.editando ? t('ayudaValorEditar') : t('ayudaValor')}
            </p>
          </div>

          <Textarea
            etiqueta={t('etiquetaDescripcion')}
            value={crud.form.descripcion}
            onChange={(e) => crud.updateForm('descripcion', e.target.value)}
            placeholder={t('placeholderDescripcion')}
            rows={3}
          />

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!crud.editando}
            onGuardar={() => guardarValido(false)}
            onGuardarYSalir={() => guardarValido(true)}
            onCerrar={crud.cerrarModal}
            cargando={crud.guardando}
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
            ? t('eliminarConfirm', { tipo: crud.confirmacion.tipo_secreto })
            : ''
        }
        textoConfirmar={tc('eliminar')}
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
