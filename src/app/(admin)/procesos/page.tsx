'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import {
  TablaCrud,
  columnaCodigo,
  columnaDescripcion,
} from '@/components/ui/tabla-crud'
import { Insignia } from '@/components/ui/insignia'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import {
  procesosInstanciasApi,
  procesosDatosBasicosApi,
  gruposApi,
  entidadesApi,
  usuariosApi,
} from '@/lib/api'
import type { ProcesoInstancia } from '@/lib/api'
import type { CategoriaProceso, TipoProceso, EstadoProceso, Grupo, Entidad, Usuario } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'
import { SelectorBuscable } from '@/components/ui/selector-buscable'

type FormInstancia = {
  codigo_categoria_proceso: string
  codigo_tipo_proceso: string
  codigo_estado: string
  codigo_grupo: string
  codigo_entidad: string
  codigo_usuario_asignado: string
  nombre_proceso: string
  alias_proceso: string
  descripcion_proceso: string
  comentarios_proceso: string
  fecha_comprometida: string
  fecha_fin: string
  costo: string
}

const FORM_INICIAL: FormInstancia = {
  codigo_categoria_proceso: '',
  codigo_tipo_proceso: '',
  codigo_estado: '',
  codigo_grupo: '',
  codigo_entidad: '',
  codigo_usuario_asignado: '',
  nombre_proceso: '',
  alias_proceso: '',
  descripcion_proceso: '',
  comentarios_proceso: '',
  fecha_comprometida: '',
  fecha_fin: '',
  costo: '',
}

export default function PaginaProcesoInstancias() {
  const [categorias, setCategorias] = useState<CategoriaProceso[]>([])
  const [tiposProc, setTiposProc] = useState<TipoProceso[]>([])
  const [estadosProc, setEstadosProc] = useState<EstadoProceso[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])

  useEffect(() => {
    procesosDatosBasicosApi.listarCategorias().then(setCategorias).catch(() => setCategorias([]))
    procesosDatosBasicosApi.listarTipos().then(setTiposProc).catch(() => setTiposProc([]))
    procesosDatosBasicosApi.listarEstados().then(setEstadosProc).catch(() => setEstadosProc([]))
    gruposApi.listar().then(setGrupos).catch(() => setGrupos([]))
    entidadesApi.listar().then(setEntidades).catch(() => setEntidades([]))
    usuariosApi.listar().then(setUsuarios).catch(() => setUsuarios([]))
  }, [])

  const crud = useCrudPage<ProcesoInstancia, FormInstancia>({
    cargarFn: () => procesosInstanciasApi.listar({ limit: 500 }),
    crearFn: async (f) => {
      if (!f.codigo_categoria_proceso || !f.codigo_tipo_proceso || !f.codigo_estado) {
        throw new Error('Categoría, tipo y estado son obligatorios.')
      }
      return procesosInstanciasApi.crear({
        codigo_categoria_proceso: f.codigo_categoria_proceso,
        codigo_tipo_proceso: f.codigo_tipo_proceso,
        codigo_estado: f.codigo_estado,
        codigo_grupo: f.codigo_grupo || undefined,
        codigo_entidad: f.codigo_entidad || undefined,
        codigo_usuario_asignado: f.codigo_usuario_asignado || undefined,
        nombre_proceso: f.nombre_proceso || undefined,
        alias_proceso: f.alias_proceso || undefined,
        descripcion_proceso: f.descripcion_proceso || undefined,
        comentarios_proceso: f.comentarios_proceso || undefined,
        fecha_comprometida: f.fecha_comprometida || undefined,
        costo: f.costo ? parseFloat(f.costo) : undefined,
      })
    },
    actualizarFn: async (id, f) =>
      procesosInstanciasApi.actualizar(id, {
        codigo_estado: f.codigo_estado || undefined,
        codigo_usuario_asignado: f.codigo_usuario_asignado || undefined,
        nombre_proceso: f.nombre_proceso || undefined,
        alias_proceso: f.alias_proceso || undefined,
        descripcion_proceso: f.descripcion_proceso || undefined,
        comentarios_proceso: f.comentarios_proceso || undefined,
        fecha_comprometida: f.fecha_comprometida || undefined,
        fecha_fin: f.fecha_fin || undefined,
        costo: f.costo ? parseFloat(f.costo) : undefined,
      }),
    eliminarFn: (id) => procesosInstanciasApi.eliminar(id).then(() => undefined),
    getId: (p) => p.codigo_proceso,
    camposBusqueda: (p) => [
      p.codigo_proceso,
      p.nombre_proceso ?? '',
      p.alias_proceso ?? '',
      p.codigo_tipo_proceso ?? '',
      p.codigo_estado ?? '',
      p.codigo_grupo ?? '',
    ],
    formInicial: FORM_INICIAL,
    itemToForm: (p) => ({
      codigo_categoria_proceso: p.codigo_categoria_proceso ?? '',
      codigo_tipo_proceso: p.codigo_tipo_proceso ?? '',
      codigo_estado: p.codigo_estado ?? '',
      codigo_grupo: p.codigo_grupo ?? '',
      codigo_entidad: p.codigo_entidad ?? '',
      codigo_usuario_asignado: p.codigo_usuario_asignado ?? '',
      nombre_proceso: p.nombre_proceso ?? '',
      alias_proceso: p.alias_proceso ?? '',
      descripcion_proceso: p.descripcion_proceso ?? '',
      comentarios_proceso: p.comentarios_proceso ?? '',
      fecha_comprometida: p.fecha_comprometida ? p.fecha_comprometida.slice(0, 16) : '',
      fecha_fin: p.fecha_fin ? p.fecha_fin.slice(0, 16) : '',
      costo: p.costo != null ? String(p.costo) : '',
    }),
  })

  // ── Opciones selectores ───────────────────────────────────────────────────
  const opcionesCategorias = [...categorias]
    .sort((a, b) => a.nombre_categoria_proceso.localeCompare(b.nombre_categoria_proceso))
    .map((c) => ({ valor: c.codigo_categoria_proceso, etiqueta: c.nombre_categoria_proceso, hint: c.codigo_categoria_proceso }))

  const opcionesTipos = [...tiposProc]
    .filter((tp) => !crud.form.codigo_categoria_proceso || tp.codigo_categoria_proceso === crud.form.codigo_categoria_proceso)
    .sort((a, b) => a.nombre_tipo_proceso.localeCompare(b.nombre_tipo_proceso))
    .map((tp) => ({ valor: tp.codigo_tipo_proceso, etiqueta: tp.nombre_tipo_proceso, hint: tp.codigo_tipo_proceso }))

  const opcionesEstados = [...estadosProc]
    .filter((e) =>
      (!crud.form.codigo_categoria_proceso || e.codigo_categoria_proceso === crud.form.codigo_categoria_proceso) &&
      (!crud.form.codigo_tipo_proceso || e.codigo_tipo_proceso === crud.form.codigo_tipo_proceso)
    )
    .sort((a, b) => a.nombre_estado.localeCompare(b.nombre_estado))
    .map((e) => ({ valor: e.codigo_estado_proceso, etiqueta: e.nombre_estado, hint: e.codigo_estado_proceso }))

  const opcionesGrupos = [...grupos]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((g) => ({ valor: g.codigo_grupo, etiqueta: g.nombre, hint: g.codigo_grupo }))

  const opcionesEntidades = [...entidades]
    .filter((en) => !crud.form.codigo_grupo || en.codigo_grupo === crud.form.codigo_grupo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((en) => ({ valor: en.codigo_entidad, etiqueta: en.nombre, hint: en.codigo_entidad }))

  const opcionesUsuarios = [...usuarios]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((u) => ({ valor: u.codigo_usuario, etiqueta: u.nombre, hint: u.codigo_usuario }))

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Procesos</h2>
        <p className="text-sm text-texto-muted mt-1">Instancias de proceso del sistema</p>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda="Buscar proceso..."
        onNuevo={crud.abrirNuevo}
        excelDatos={crud.filtrados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: 'Código', campo: 'codigo_proceso' },
          { titulo: 'Nombre', campo: 'nombre_proceso' },
          { titulo: 'Tipo', campo: 'codigo_tipo_proceso' },
          { titulo: 'Estado', campo: 'codigo_estado' },
          { titulo: 'Grupo', campo: 'codigo_grupo' },
          { titulo: 'Fecha inicio', campo: 'fecha_inicio' },
        ]}
        excelNombreArchivo="procesos-instancias"
      />

      <TablaCrud
        columnas={[
          columnaCodigo<ProcesoInstancia>('Código', (p) => p.codigo_proceso),
          {
            titulo: 'Nombre / Tipo',
            render: (p: ProcesoInstancia) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{p.nombre_proceso ?? p.codigo_proceso}</span>
                {p.codigo_tipo_proceso && (
                  <span className="text-xs text-texto-muted">{p.codigo_tipo_proceso}</span>
                )}
              </div>
            ),
          },
          {
            titulo: 'Estado',
            render: (p: ProcesoInstancia) =>
              p.codigo_estado ? (
                <Insignia variante="primario">{p.codigo_estado}</Insignia>
              ) : (
                <span className="text-xs text-texto-muted">—</span>
              ),
          },
          columnaDescripcion<ProcesoInstancia>('Grupo', (p) => p.codigo_grupo),
          {
            titulo: 'Inicio',
            render: (p: ProcesoInstancia) => (
              <span className="text-xs text-texto-muted">
                {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-CL') : '—'}
              </span>
            ),
          },
        ]}
        items={crud.filtrados}
        cargando={crud.cargando}
        getId={(p) => p.codigo_proceso}
        onEditar={crud.abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio="No hay instancias de proceso"
      />

      {/* Modal crear / editar */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? `Editar proceso ${crud.editando.codigo_proceso}` : 'Nueva instancia de proceso'}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 min-w-[520px]">
          <div className="grid grid-cols-2 gap-4">
            {crud.editando && (
              <Input etiqueta="Código" value={crud.editando.codigo_proceso} onChange={() => {}} disabled />
            )}
            <Input
              etiqueta="Nombre"
              value={crud.form.nombre_proceso}
              onChange={(e) => crud.updateForm('nombre_proceso', e.target.value)}
              placeholder="Nombre del proceso"
              autoFocus
            />
            <Input
              etiqueta="Alias"
              value={crud.form.alias_proceso}
              onChange={(e) => crud.updateForm('alias_proceso', e.target.value)}
              placeholder="Alias corto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectorBuscable
              etiqueta="Categoría"
              valor={crud.form.codigo_categoria_proceso}
              opciones={opcionesCategorias}
              onSeleccionar={(v) => {
                crud.updateForm('codigo_categoria_proceso', v)
                crud.updateForm('codigo_tipo_proceso', '')
                crud.updateForm('codigo_estado', '')
              }}
              placeholder="Buscar categoría..."
              disabled={!!crud.editando}
            />
            <SelectorBuscable
              etiqueta="Tipo de proceso"
              valor={crud.form.codigo_tipo_proceso}
              opciones={opcionesTipos}
              onSeleccionar={(v) => {
                crud.updateForm('codigo_tipo_proceso', v)
                crud.updateForm('codigo_estado', '')
              }}
              placeholder={crud.form.codigo_categoria_proceso ? 'Buscar tipo...' : 'Seleccione categoría primero'}
              disabled={!crud.form.codigo_categoria_proceso || !!crud.editando}
            />
            <SelectorBuscable
              etiqueta="Estado"
              valor={crud.form.codigo_estado}
              opciones={opcionesEstados}
              onSeleccionar={(v) => crud.updateForm('codigo_estado', v)}
              placeholder={crud.form.codigo_tipo_proceso ? 'Buscar estado...' : 'Seleccione tipo primero'}
              disabled={!crud.form.codigo_tipo_proceso}
            />
            <SelectorBuscable
              etiqueta="Usuario asignado"
              valor={crud.form.codigo_usuario_asignado}
              opciones={opcionesUsuarios}
              onSeleccionar={(v) => crud.updateForm('codigo_usuario_asignado', v)}
              placeholder="Buscar usuario..."
            />
            <SelectorBuscable
              etiqueta="Grupo"
              valor={crud.form.codigo_grupo}
              opciones={opcionesGrupos}
              onSeleccionar={(v) => {
                crud.updateForm('codigo_grupo', v)
                crud.updateForm('codigo_entidad', '')
              }}
              placeholder="Buscar grupo..."
              disabled={!!crud.editando}
            />
            <SelectorBuscable
              etiqueta="Entidad"
              valor={crud.form.codigo_entidad}
              opciones={opcionesEntidades}
              onSeleccionar={(v) => crud.updateForm('codigo_entidad', v)}
              placeholder={crud.form.codigo_grupo ? 'Buscar entidad...' : 'Seleccione grupo primero'}
              disabled={!crud.form.codigo_grupo || !!crud.editando}
            />
            <Input
              etiqueta="Fecha comprometida"
              type="datetime-local"
              value={crud.form.fecha_comprometida}
              onChange={(e) => crud.updateForm('fecha_comprometida', e.target.value)}
            />
            <Input
              etiqueta="Fecha fin"
              type="datetime-local"
              value={crud.form.fecha_fin}
              onChange={(e) => crud.updateForm('fecha_fin', e.target.value)}
            />
            <Input
              etiqueta="Costo"
              type="number"
              step="0.0001"
              value={crud.form.costo}
              onChange={(e) => crud.updateForm('costo', e.target.value)}
              placeholder="0.0000"
            />
          </div>

          <Textarea
            etiqueta="Descripción"
            value={crud.form.descripcion_proceso}
            onChange={(e) => crud.updateForm('descripcion_proceso', e.target.value)}
            placeholder="Descripción del proceso"
            rows={2}
          />
          <Textarea
            etiqueta="Comentarios"
            value={crud.form.comentarios_proceso}
            onChange={(e) => crud.updateForm('comentarios_proceso', e.target.value)}
            placeholder="Comentarios adicionales"
            rows={2}
          />

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!crud.editando}
            onGuardar={() => crud.guardar(undefined, undefined, { cerrar: false })}
            onGuardarYSalir={() => crud.guardar(undefined, undefined, { cerrar: true })}
            onCerrar={crud.cerrarModal}
            cargando={crud.guardando}
          />
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        titulo="Eliminar proceso"
        mensaje={`¿Eliminar la instancia "${crud.confirmacion?.nombre_proceso ?? crud.confirmacion?.codigo_proceso}"? Esta acción no se puede deshacer.`}
        alConfirmar={crud.ejecutarEliminacion}
        alCerrar={() => crud.setConfirmacion(null)}
        cargando={crud.eliminando}
      />
    </div>
  )
}
