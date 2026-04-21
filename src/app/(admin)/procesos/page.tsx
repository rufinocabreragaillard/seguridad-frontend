'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import {
  TablaCrud,
  columnaCodigo,
  columnaNombre,
} from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { procesosApi, funcionesApi } from '@/lib/api'
import { invalidarCatalogo } from '@/lib/catalogos'
import type { Proceso } from '@/lib/api'
import type { Funcion } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import { TIPOS_ELEMENTO, etiquetaTipo, varianteTipo } from '@/lib/tipo-elemento'

const selectClass =
  'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

type FormProceso = {
  nombre_proceso: string
  descripcion: string
  tipo: string
  n_parallel: number
  codigo_funcion: string
}

export default function PaginaProcesos() {
  const t = useTranslations('procesos')

  const [funciones, setFunciones] = useState<Funcion[]>([])

  useEffect(() => {
    funcionesApi.listar().then(setFunciones).catch(() => setFunciones([]))
  }, [])

  const crud = useCrudPage<Proceso, FormProceso>({
    cargarFn: () => procesosApi.listar(),
    actualizarFn: async (id, f) => {
      const r = await procesosApi.actualizar(id, {
        nombre_proceso: f.nombre_proceso?.trim(),
        descripcion: f.descripcion?.trim() || undefined,
        n_parallel: f.n_parallel,
        tipo: f.tipo,
        codigo_funcion: f.codigo_funcion ? f.codigo_funcion : null,
      })
      invalidarCatalogo('procesosDocs')
      return r
    },
    getId: (p) => p.codigo_proceso,
    camposBusqueda: (p) => [p.codigo_proceso, p.nombre_proceso, p.tipo, p.codigo_funcion ?? ''],
    formInicial: { nombre_proceso: '', descripcion: '', tipo: 'USUARIO', n_parallel: 1, codigo_funcion: '' },
    itemToForm: (p) => ({
      nombre_proceso: p.nombre_proceso,
      descripcion: p.descripcion ?? '',
      tipo: p.tipo ?? 'USUARIO',
      n_parallel: p.n_parallel,
      codigo_funcion: p.codigo_funcion ?? '',
    }),
  })

  const funcionesOrdenadas = [...funciones].sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  )
  const nombreFuncion = (codigo?: string | null): string => {
    if (!codigo) return ''
    return funciones.find((f) => f.codigo_funcion === codigo)?.nombre ?? codigo
  }

  const filtradosOrdenados = [...crud.filtrados].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre_proceso.localeCompare(b.nombre_proceso),
  )

  const reordenarProcesos = async (nuevos: Proceso[]) => {
    try {
      await procesosApi.reordenar(nuevos.map(p => ({ codigo_proceso: p.codigo_proceso, orden: p.orden ?? 0 })))
      crud.cargar()
    } catch { crud.cargar() }
  }

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
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: t('colCodigo'), campo: 'codigo_proceso' },
          { titulo: t('colNombre'), campo: 'nombre_proceso' },
          { titulo: t('colFuncion'), campo: 'codigo_funcion' },
          { titulo: t('colTipo'), campo: 'tipo' },
          { titulo: t('colOrden'), campo: 'orden' },
          { titulo: t('colParalelo'), campo: 'n_parallel' },
        ]}
        excelNombreArchivo="procesos"
      />

      <TablaCrud
        columnas={[
          columnaCodigo<Proceso>(t('colCodigo'), (p) => p.codigo_proceso),
          columnaNombre<Proceso>(t('colNombre'), (p) => p.nombre_proceso),
          {
            titulo: t('colFuncion'),
            render: (p: Proceso) =>
              p.codigo_funcion ? (
                <Insignia variante="primario">{nombreFuncion(p.codigo_funcion)}</Insignia>
              ) : (
                <span className="text-xs text-texto-muted">—</span>
              ),
          },
          {
            titulo: t('colTipo'),
            render: (p: Proceso) => (
              <Insignia variante={varianteTipo(p.tipo)}>{etiquetaTipo(p.tipo)}</Insignia>
            ),
          },
          {
            titulo: t('colParalelo'),
            render: (p: Proceso) => (
              <span className="text-sm">{p.n_parallel}</span>
            ),
          },
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(p) => p.codigo_proceso}
        onEditar={crud.abrirEditar}
        textoVacio={t('sinProcesos')}
        onReordenar={(nuevos) => reordenarProcesos(nuevos as unknown as Proceso[])}
        sortDisabled={!!crud.busqueda}
      />

      {/* Modal editar */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={
          crud.editando
            ? t('editarTitulo', { nombre: crud.editando.nombre_proceso })
            : t('editarTitulo', { nombre: '' })
        }
        className="max-w-lg"
      >
        <div className="flex flex-col gap-4 min-w-[400px]">
          {crud.editando && (
            <Input
              etiqueta={t('etiquetaCodigo')}
              value={crud.editando.codigo_proceso}
              onChange={() => {}}
              disabled
            />
          )}

          <Input
            etiqueta={t('etiquetaNombre')}
            value={crud.form.nombre_proceso}
            onChange={(e) => crud.updateForm('nombre_proceso', e.target.value)}
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
            <label className="text-sm font-medium text-texto">{t('etiquetaFuncion')}</label>
            <select
              className={selectClass}
              value={crud.form.codigo_funcion}
              onChange={(e) => crud.updateForm('codigo_funcion', e.target.value)}
            >
              <option value="">{t('sinFuncion')}</option>
              {funcionesOrdenadas.map((f) => (
                <option key={f.codigo_funcion} value={f.codigo_funcion}>
                  {f.nombre}
                </option>
              ))}
            </select>
            <p className="text-xs text-texto-muted">{t('descFuncion')}</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">{t('etiquetaTipo')}</label>
            <select
              className={selectClass}
              value={crud.form.tipo}
              onChange={(e) => crud.updateForm('tipo', e.target.value)}
            >
              {TIPOS_ELEMENTO.map((tp) => (
                <option key={tp} value={tp}>
                  {etiquetaTipo(tp)}
                </option>
              ))}
            </select>
          </div>

          <Input
            etiqueta={t('etiquetaParalelo')}
            type="number"
            value={String(crud.form.n_parallel)}
            onChange={(e) => crud.updateForm('n_parallel', Number(e.target.value))}
            placeholder="1"
          />

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!crud.editando}
            onGuardar={() => {
              if (!crud.form.nombre_proceso.trim()) {
                crud.setError(t('errorNombreObligatorio'))
                return
              }
              crud.guardar(undefined, undefined, { cerrar: false })
            }}
            onGuardarYSalir={() => {
              if (!crud.form.nombre_proceso.trim()) {
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
    </div>
  )
}
