'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
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
import {
  procesosApi,
  funcionesApi,
  procesosDatosBasicosApi,
  gruposApi,
  entidadesApi,
  usuariosApi,
} from '@/lib/api'
import { invalidarCatalogo } from '@/lib/catalogos'
import type { Proceso } from '@/lib/api'
import type {
  Funcion,
  CategoriaProceso,
  TipoProceso,
  EstadoProceso,
  Grupo,
  Entidad,
  Usuario,
} from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'

type FormProceso = {
  nombre_proceso: string
  descripcion: string
  n_parallel: number
  codigo_funcion: string
  // Clasificación
  codigo_categoria_proceso: string
  codigo_tipo_proceso: string
  codigo_estado: string
  // Actores
  codigo_grupo: string
  codigo_entidad: string
  codigo_usuario: string
  codigo_usuario_asignado: string
  fecha_inicio: string
  fecha_fin: string
  fecha_comprometida: string
  costo: string
  costo_en_tiempo: string
}

type TabProceso = 'datos' | 'clasificacion' | 'actores'

type OpcionBuscable = { valor: string; etiqueta: string; hint?: string }

function SelectorBuscable({
  etiqueta,
  valor,
  opciones,
  onSeleccionar,
  placeholder = 'Buscar...',
  disabled = false,
}: {
  etiqueta: string
  valor: string
  opciones: OpcionBuscable[]
  onSeleccionar: (valor: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => {
    if (abierto) return
    const sel = opciones.find((o) => o.valor === valor)
    setBusqueda(sel ? sel.etiqueta : '')
  }, [valor, opciones, abierto])

  const filtradas = opciones.filter((o) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return o.etiqueta.toLowerCase().includes(q) || o.valor.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-texto">{etiqueta}</label>
      <div className="relative" ref={ref}>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={busqueda}
          disabled={disabled}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setAbierto(true)
            if (!e.target.value) onSeleccionar('')
          }}
          onFocus={() => !disabled && setAbierto(true)}
          className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
        />
        {abierto && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onSeleccionar(''); setBusqueda(''); setAbierto(false) }}
              className="w-full text-left px-3 py-2 text-sm text-texto-muted italic hover:bg-primario-muy-claro hover:text-primario transition-colors"
            >
              — Sin selección —
            </button>
            {filtradas.slice(0, 30).map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => { onSeleccionar(o.valor); setBusqueda(o.etiqueta); setAbierto(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors flex items-center gap-2"
              >
                <span className="font-medium">{o.etiqueta}</span>
                {o.hint && <span className="text-texto-muted text-xs">{o.hint}</span>}
              </button>
            ))}
            {filtradas.length === 0 && <div className="px-3 py-2 text-sm text-texto-muted">Sin resultados</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PaginaProcesos() {
  const t = useTranslations('procesos')

  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [categorias, setCategorias] = useState<CategoriaProceso[]>([])
  const [tiposProc, setTiposProc] = useState<TipoProceso[]>([])
  const [estadosProc, setEstadosProc] = useState<EstadoProceso[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [tabModal, setTabModal] = useState<TabProceso>('datos')

  useEffect(() => {
    funcionesApi.listar().then(setFunciones).catch(() => setFunciones([]))
    procesosDatosBasicosApi.listarCategorias().then(setCategorias).catch(() => setCategorias([]))
    procesosDatosBasicosApi.listarTipos().then(setTiposProc).catch(() => setTiposProc([]))
    procesosDatosBasicosApi.listarEstados().then(setEstadosProc).catch(() => setEstadosProc([]))
    gruposApi.listar().then(setGrupos).catch(() => setGrupos([]))
    entidadesApi.listar().then(setEntidades).catch(() => setEntidades([]))
    usuariosApi.listar().then(setUsuarios).catch(() => setUsuarios([]))
  }, [])

  const crud = useCrudPage<Proceso, FormProceso>({
    cargarFn: () => procesosApi.listar(),
    actualizarFn: async (id, f) => {
      const r = await procesosApi.actualizar(id, {
        nombre_proceso: f.nombre_proceso?.trim(),
        descripcion: f.descripcion?.trim() || undefined,
        n_parallel: f.n_parallel,
        codigo_funcion: f.codigo_funcion ? f.codigo_funcion : null,
      } as Record<string, unknown>)
      invalidarCatalogo('procesosDocs')
      return r
    },
    getId: (p) => p.codigo_proceso,
    camposBusqueda: (p) => [p.codigo_proceso, p.nombre_proceso, p.codigo_funcion ?? ''],
    formInicial: {
      nombre_proceso: '', descripcion: '', n_parallel: 1, codigo_funcion: '',
      codigo_categoria_proceso: '', codigo_tipo_proceso: '', codigo_estado: '',
      codigo_grupo: '', codigo_entidad: '', codigo_usuario: '', codigo_usuario_asignado: '',
      fecha_inicio: '', fecha_fin: '', fecha_comprometida: '', costo: '', costo_en_tiempo: '',
    },
    itemToForm: (p) => {
      const raw = p as unknown as Record<string, unknown>
      const str = (v: unknown) => (v == null ? '' : String(v))
      return {
        nombre_proceso: p.nombre_proceso,
        descripcion: p.descripcion ?? '',
        n_parallel: p.n_parallel,
        codigo_funcion: p.codigo_funcion ?? '',
        codigo_categoria_proceso: str(raw.codigo_categoria_proceso),
        codigo_tipo_proceso: str(raw.codigo_tipo_proceso),
        codigo_estado: str(raw.codigo_estado),
        codigo_grupo: str(raw.codigo_grupo),
        codigo_entidad: str(raw.codigo_entidad),
        codigo_usuario: str(raw.codigo_usuario),
        codigo_usuario_asignado: str(raw.codigo_usuario_asignado),
        fecha_inicio: str(raw.fecha_inicio),
        fecha_fin: str(raw.fecha_fin),
        fecha_comprometida: str(raw.fecha_comprometida),
        costo: str(raw.costo),
        costo_en_tiempo: str(raw.costo_en_tiempo),
      }
    },
  })

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

  // ── Opciones para selectores buscables ─────────────────────────────────
  const opcionesFunciones: OpcionBuscable[] = [...funciones]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((f) => ({ valor: f.codigo_funcion, etiqueta: f.nombre, hint: f.codigo_funcion }))

  const opcionesCategorias: OpcionBuscable[] = [...categorias]
    .sort((a, b) => a.nombre_categoria_proceso.localeCompare(b.nombre_categoria_proceso))
    .map((c) => ({ valor: c.codigo_categoria_proceso, etiqueta: c.nombre_categoria_proceso, hint: c.codigo_categoria_proceso }))

  const opcionesTipos: OpcionBuscable[] = [...tiposProc]
    .filter((tp) => !crud.form.codigo_categoria_proceso || tp.codigo_categoria_proceso === crud.form.codigo_categoria_proceso)
    .sort((a, b) => a.nombre_tipo_proceso.localeCompare(b.nombre_tipo_proceso))
    .map((tp) => ({ valor: tp.codigo_tipo_proceso, etiqueta: tp.nombre_tipo_proceso, hint: tp.codigo_tipo_proceso }))

  const opcionesEstados: OpcionBuscable[] = [...estadosProc]
    .filter((e) =>
      (!crud.form.codigo_categoria_proceso || e.codigo_categoria_proceso === crud.form.codigo_categoria_proceso) &&
      (!crud.form.codigo_tipo_proceso || e.codigo_tipo_proceso === crud.form.codigo_tipo_proceso)
    )
    .sort((a, b) => a.nombre_estado.localeCompare(b.nombre_estado))
    .map((e) => ({ valor: e.codigo_estado_proceso, etiqueta: e.nombre_estado, hint: e.codigo_estado_proceso }))

  const opcionesGrupos: OpcionBuscable[] = [...grupos]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((g) => ({ valor: g.codigo_grupo, etiqueta: g.nombre, hint: g.codigo_grupo }))

  const opcionesEntidades: OpcionBuscable[] = [...entidades]
    .filter((en) => !crud.form.codigo_grupo || en.codigo_grupo === crud.form.codigo_grupo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((en) => ({ valor: en.codigo_entidad, etiqueta: en.nombre, hint: en.codigo_entidad }))

  const opcionesUsuarios: OpcionBuscable[] = [...usuarios]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((u) => ({ valor: u.codigo_usuario, etiqueta: u.nombre, hint: u.codigo_usuario }))

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
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 min-w-[520px] min-h-[500px]">
          {crud.editando && (
            <div className="flex gap-2 border-b border-borde -mt-2">
              {([
                { key: 'datos' as TabProceso, label: 'Datos' },
                { key: 'clasificacion' as TabProceso, label: 'Clasificación' },
                { key: 'actores' as TabProceso, label: 'Actores' },
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
          )}
          {tabModal === 'datos' && crud.editando && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                etiqueta={t('etiquetaCodigo')}
                value={crud.editando.codigo_proceso}
                onChange={() => {}}
                disabled
              />

              <Input
                etiqueta={t('etiquetaNombre')}
                value={crud.form.nombre_proceso}
                onChange={(e) => crud.updateForm('nombre_proceso', e.target.value)}
                placeholder={t('placeholderNombre')}
                autoFocus
              />

              <div />

              <div className="col-span-2">
                <Textarea
                  etiqueta={t('etiquetaDescripcion')}
                  value={crud.form.descripcion}
                  onChange={(e) => crud.updateForm('descripcion', e.target.value)}
                  placeholder={t('placeholderDescripcion')}
                  rows={3}
                />
              </div>
            </div>
          )}

          {tabModal === 'clasificacion' && crud.editando && (
            <div className="grid grid-cols-2 gap-4">
              <SelectorBuscable
                etiqueta={t('etiquetaFuncion')}
                valor={crud.form.codigo_funcion}
                opciones={opcionesFunciones}
                onSeleccionar={(v) => crud.updateForm('codigo_funcion', v)}
                placeholder={t('sinFuncion')}
              />
              <div />
              <SelectorBuscable
                etiqueta="Categoría del proceso"
                valor={crud.form.codigo_categoria_proceso}
                opciones={opcionesCategorias}
                onSeleccionar={(v) => {
                  crud.updateForm('codigo_categoria_proceso', v)
                  crud.updateForm('codigo_tipo_proceso', '')
                  crud.updateForm('codigo_estado', '')
                }}
                placeholder="Buscar categoría..."
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
                disabled={!crud.form.codigo_categoria_proceso}
              />
              <SelectorBuscable
                etiqueta="Estado"
                valor={crud.form.codigo_estado}
                opciones={opcionesEstados}
                onSeleccionar={(v) => crud.updateForm('codigo_estado', v)}
                placeholder={crud.form.codigo_tipo_proceso ? 'Buscar estado...' : 'Seleccione tipo primero'}
                disabled={!crud.form.codigo_tipo_proceso}
              />
            </div>
          )}

          {tabModal === 'actores' && crud.editando && (
            <div className="grid grid-cols-2 gap-4">
              <SelectorBuscable
                etiqueta="Grupo"
                valor={crud.form.codigo_grupo}
                opciones={opcionesGrupos}
                onSeleccionar={(v) => {
                  crud.updateForm('codigo_grupo', v)
                  crud.updateForm('codigo_entidad', '')
                }}
                placeholder="Buscar grupo..."
              />
              <SelectorBuscable
                etiqueta="Entidad"
                valor={crud.form.codigo_entidad}
                opciones={opcionesEntidades}
                onSeleccionar={(v) => crud.updateForm('codigo_entidad', v)}
                placeholder={crud.form.codigo_grupo ? 'Buscar entidad...' : 'Seleccione grupo primero'}
                disabled={!crud.form.codigo_grupo}
              />
              <SelectorBuscable
                etiqueta="Usuario"
                valor={crud.form.codigo_usuario}
                opciones={opcionesUsuarios}
                onSeleccionar={(v) => crud.updateForm('codigo_usuario', v)}
                placeholder="Buscar usuario..."
              />
              <SelectorBuscable
                etiqueta="Usuario asignado"
                valor={crud.form.codigo_usuario_asignado}
                opciones={opcionesUsuarios}
                onSeleccionar={(v) => crud.updateForm('codigo_usuario_asignado', v)}
                placeholder="Buscar usuario..."
              />
              <Input
                etiqueta="Fecha inicio"
                type="datetime-local"
                value={crud.form.fecha_inicio ? crud.form.fecha_inicio.slice(0, 16) : ''}
                onChange={(e) => crud.updateForm('fecha_inicio', e.target.value)}
              />
              <Input
                etiqueta="Fecha fin"
                type="datetime-local"
                value={crud.form.fecha_fin ? crud.form.fecha_fin.slice(0, 16) : ''}
                onChange={(e) => crud.updateForm('fecha_fin', e.target.value)}
              />
              <Input
                etiqueta="Fecha comprometida"
                type="datetime-local"
                value={crud.form.fecha_comprometida ? crud.form.fecha_comprometida.slice(0, 16) : ''}
                onChange={(e) => crud.updateForm('fecha_comprometida', e.target.value)}
              />
              <Input
                etiqueta="Costo"
                type="number"
                step="0.0001"
                value={crud.form.costo}
                onChange={(e) => crud.updateForm('costo', e.target.value)}
                placeholder="0.0000"
              />
              <Input
                etiqueta="Costo en tiempo"
                value={crud.form.costo_en_tiempo}
                onChange={(e) => crud.updateForm('costo_en_tiempo', e.target.value)}
                placeholder="ej: 2 hours 30 minutes"
              />
            </div>
          )}

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
