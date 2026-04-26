'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, MapPin, Download, Search, Eye, Trash2 } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Insignia } from '@/components/ui/insignia'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { entidadesApi, promptsApi, ubicacionesDocsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Entidad, Area } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useTranslations } from 'next-intl'
import { BotonChat } from '@/components/ui/boton-chat'

export default function PaginaEntidades() {
  const t = useTranslations('entidades')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()

  const [tabActiva, setTabActiva] = useState<'entidades' | 'areas'>('entidades')

  // ── Entidades y Áreas ─────────────────────────────────────────────────────
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [entidadSeleccionada, setEntidadSeleccionada] = useState<Entidad | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoAreas, setCargandoAreas] = useState(false)
  const [busquedaAreas, setBusquedaAreas] = useState('')
  const [busquedaEntidades, setBusquedaEntidades] = useState('')

  const [modalEntidad, setModalEntidad] = useState(false)
  const [modalArea, setModalArea] = useState(false)
  const [modalEliminarArea, setModalEliminarArea] = useState(false)
  const [areaEliminando, setAreaEliminando] = useState<Area | null>(null)
  const [areaEditando, setAreaEditando] = useState<Area | null>(null)
  const [entidadEditando, setEntidadEditando] = useState<Entidad | null>(null)
  const [formEntidad, setFormEntidad] = useState({ codigo_entidad: '', nombre: '', alias: '', descripcion: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalEntidad, setTabModalEntidad] = useState<'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMdEnt, setGenerandoMdEnt] = useState(false)
  const [sincronizandoMdEnt, setSincronizandoMdEnt] = useState(false)
  const [mensajeMdEnt, setMensajeMdEnt] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [mdEnt, setMdEnt] = useState('')
  const [formArea, setFormArea] = useState({ codigo_area: '', nombre: '', alias: '', descripcion: '', codigo_area_superior: '', tipo_ubicacion: 'VIRTUAL' as 'AREA' | 'CONTENIDO' | 'VIRTUAL' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const e = await entidadesApi.listar()
      setEntidades(e)
      if (e.length > 0 && !entidadSeleccionada) setEntidadSeleccionada(e[0])
    } finally {
      setCargando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadSeleccionada])

  const reordenarEntidades = async (nuevas: Entidad[]) => {
    const conOrden = nuevas.map((e, idx) => ({ ...e, orden: idx + 1 }))
    setEntidades(conOrden)
    try {
      await entidadesApi.reordenar(
        conOrden.map((e) => ({ codigo_grupo: e.codigo_grupo || grupoActivo || '', codigo_entidad: e.codigo_entidad, orden: e.orden ?? 0 }))
      )
    } catch { cargar() }
  }

  const cargarAreas = useCallback(async (codigoEntidad: string) => {
    setCargandoAreas(true)
    try {
      const a = await entidadesApi.listarAreas(codigoEntidad)
      setAreas(a)
    } finally {
      setCargandoAreas(false)
    }
  }, [])

  useEffect(() => { cargar() }, []) // eslint-disable-line

  useEffect(() => {
    if (entidadSeleccionada) {
      cargarAreas(entidadSeleccionada.codigo_entidad)
      setBusquedaAreas('')
    }
  }, [entidadSeleccionada, cargarAreas])

  const abrirNuevaEntidad = () => {
    setEntidadEditando(null)
    setFormEntidad({ codigo_entidad: '', nombre: '', alias: '', descripcion: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setTabModalEntidad('datos')
    setError('')
    setModalEntidad(true)
  }

  const abrirEditarEntidad = (e: Entidad) => {
    setEntidadEditando(e)
    const e2 = e as unknown as Record<string, unknown>
    setFormEntidad({ codigo_entidad: e.codigo_entidad, nombre: e.nombre, alias: e.alias || '', descripcion: e.descripcion || '', prompt_insert: e2.prompt_insert as string || '', prompt_update: e2.prompt_update as string || '', system_prompt: e2.system_prompt as string || '', python_insert: e2.python_insert as string || '', python_update: e2.python_update as string || '', javascript: e2.javascript as string || '', python_editado_manual: e2.python_editado_manual as boolean || false, javascript_editado_manual: e2.javascript_editado_manual as boolean || false })
    setMdEnt(e2.md as string || '')
    setMensajeMdEnt(null)
    setTabModalEntidad('datos')
    setError('')
    setModalEntidad(true)
  }

  const guardarEntidad = async (cerrar: boolean) => {
    if (!formEntidad.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      if (entidadEditando) {
        await entidadesApi.actualizar(entidadEditando.codigo_entidad, { nombre: formEntidad.nombre, alias: formEntidad.alias || undefined, descripcion: formEntidad.descripcion || undefined, prompt_insert: formEntidad.prompt_insert || undefined, prompt_update: formEntidad.prompt_update || undefined, system_prompt: formEntidad.system_prompt || undefined, python_insert: formEntidad.python_insert || undefined, python_update: formEntidad.python_update || undefined, javascript: formEntidad.javascript || undefined, python_editado_manual: formEntidad.python_editado_manual, javascript_editado_manual: formEntidad.javascript_editado_manual } as Record<string, unknown>)
        if (cerrar) setModalEntidad(false)
      } else {
        const nueva = await entidadesApi.crear({ nombre: formEntidad.nombre, alias: formEntidad.alias || undefined, descripcion: formEntidad.descripcion || undefined, codigo_grupo: grupoActivo || 'ADMIN' })
        if (!cerrar) {
          setEntidadEditando(nueva)
          const n2 = nueva as unknown as Record<string, unknown>
          setFormEntidad({ codigo_entidad: nueva.codigo_entidad, nombre: nueva.nombre, alias: nueva.alias || '', descripcion: nueva.descripcion || '', prompt_insert: n2.prompt_insert as string || '', prompt_update: n2.prompt_update as string || '', system_prompt: n2.system_prompt as string || '', python_insert: n2.python_insert as string || '', python_update: n2.python_update as string || '', javascript: n2.javascript as string || '', python_editado_manual: n2.python_editado_manual as boolean || false, javascript_editado_manual: n2.javascript_editado_manual as boolean || false })
        } else {
          setModalEntidad(false)
        }
      }
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  const abrirNuevaArea = () => {
    setAreaEditando(null)
    setFormArea({ codigo_area: '', nombre: '', alias: '', descripcion: '', codigo_area_superior: '', tipo_ubicacion: 'VIRTUAL' })
    setError('')
    setModalArea(true)
  }

  const abrirEditarArea = (a: Area) => {
    setAreaEditando(a)
    setFormArea({
      codigo_area: a.codigo_area,
      nombre: a.nombre,
      alias: a.alias || '',
      descripcion: a.descripcion || '',
      codigo_area_superior: a.codigo_area_superior || '',
      tipo_ubicacion: a.tipo_ubicacion || 'CONTENIDO',
    })
    setError('')
    setModalArea(true)
  }

  const guardarArea = async () => {
    if (!entidadSeleccionada || !formArea.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      if (areaEditando) {
        // Editar via ubicacionesDocsApi (código_area = código_ubicacion)
        await ubicacionesDocsApi.actualizar(areaEditando.codigo_area, {
          nombre_ubicacion: formArea.nombre,
          alias_ubicacion: formArea.alias || formArea.nombre,
          descripcion: formArea.descripcion || undefined,
          codigo_ubicacion_superior: formArea.codigo_area_superior || null,
          tipo_ubicacion: formArea.tipo_ubicacion,
        } as Record<string, unknown>)
      } else {
        if (!formArea.codigo_area) { setError('El código es obligatorio'); setGuardando(false); return }
        const datos: Record<string, string> = {
          codigo_area: formArea.codigo_area,
          nombre: formArea.nombre,
          alias_ubicacion: formArea.alias || formArea.nombre,
          tipo_ubicacion: 'VIRTUAL',  // siempre VIRTUAL al crear manualmente
        }
        if (formArea.descripcion) datos.descripcion = formArea.descripcion
        if (formArea.codigo_area_superior) datos.codigo_area_superior = formArea.codigo_area_superior
        await entidadesApi.crearArea(entidadSeleccionada.codigo_entidad, datos)
      }
      setModalArea(false)
      cargarAreas(entidadSeleccionada.codigo_entidad)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarArea = async () => {
    if (!areaEliminando || !entidadSeleccionada) return
    try {
      await ubicacionesDocsApi.eliminar(areaEliminando.codigo_area)
      setModalEliminarArea(false)
      setAreaEliminando(null)
      cargarAreas(entidadSeleccionada.codigo_entidad)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  // Entidades filtradas
  const entidadesFiltradas = entidades.filter((e) =>
    e.nombre.toLowerCase().includes(busquedaEntidades.toLowerCase()) ||
    e.codigo_entidad.toLowerCase().includes(busquedaEntidades.toLowerCase()) ||
    (e.descripcion || '').toLowerCase().includes(busquedaEntidades.toLowerCase())
  )

  // Áreas filtradas (mantiene orden jerárquico de la función SQL)
  const areasFiltradas = areas
    .filter((a) =>
      a.nombre.toLowerCase().includes(busquedaAreas.toLowerCase()) ||
      a.codigo_area.toLowerCase().includes(busquedaAreas.toLowerCase()) ||
      (a.usuario_responsable || '').toLowerCase().includes(busquedaAreas.toLowerCase())
    )

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">Gestión de organizaciones y áreas jerárquicas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {([{ id: 'entidades', label: 'Entidades' }, { id: 'areas', label: 'Áreas' }] as const).map((tab) => (
          <button key={tab.id} onClick={() => setTabActiva(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tabActiva === tab.id ? 'bg-surface text-primario-oscuro shadow-sm border border-borde' : 'text-texto-muted hover:text-texto'}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* ── Tab: Entidades ── */}
      {tabActiva === 'entidades' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-texto-muted">{entidades.length} entidades registradas</p>
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm"
                onClick={() => exportarExcel(entidadesFiltradas as unknown as Record<string, unknown>[], [
                  { titulo: 'Grupo', campo: 'codigo_grupo' },
                  { titulo: 'Código', campo: 'codigo_entidad' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Descripción', campo: 'descripcion' },
                  { titulo: 'Nombre', campo: 'nombre', formato: (v) => v ? 'Activo' : 'Inactivo' },
                  { titulo: 'Fecha creación', campo: 'fecha_creacion', formato: (v) => v ? new Date(v as string).toLocaleString('es-CL') : '' },
                ], `entidades_${grupoActivo || 'todos'}`)}
                disabled={entidadesFiltradas.length === 0}
              >
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaEntidad}><Plus size={16} />{t('nuevaEntidad')}</Boton>
            </div>
          </div>

          <div className="max-w-sm">
            <Input placeholder="Buscar por nombre, código o descripción..." value={busquedaEntidades} onChange={(e) => setBusquedaEntidades(e.target.value)} icono={<Search size={15} />} />
          </div>

          {cargando ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh className="w-8"></TablaTh>
                <TablaTh className="w-10">#</TablaTh>
                <TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {entidadesFiltradas.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={6 as never}>{busquedaEntidades ? 'No se encontraron entidades' : 'No hay entidades registradas'}</TablaTd></TablaFila>
                ) : (
                  <SortableDndContext
                    items={entidadesFiltradas as unknown as Record<string, unknown>[]}
                    getId={(item) => (item as unknown as Entidad).codigo_entidad}
                    onReorder={(items) => reordenarEntidades(items as unknown as Entidad[])}
                  >
                    {entidadesFiltradas.map((e, idx) => (
                      <SortableRow key={e.codigo_entidad} id={e.codigo_entidad}
                        onDoubleClick={() => { setEntidadSeleccionada(e); setTabActiva('areas') }}
                      >
                        <TablaTd className="text-xs text-texto-muted w-10 text-center">{e.orden ?? idx + 1}</TablaTd>
                        <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_entidad}</code></TablaTd>
                        <TablaTd className="font-medium">{e.nombre}</TablaTd>
                        <TablaTd className="text-texto-muted text-sm">{e.descripcion || <span className="text-texto-light">—</span>}</TablaTd>
                        <TablaTd>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEntidadSeleccionada(e); setTabActiva('areas') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver áreas"><Eye size={14} /></button>
                            <button onClick={() => abrirEditarEntidad(e)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          </div>
                        </TablaTd>
                      </SortableRow>
                    ))}
                  </SortableDndContext>
                )}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* ── Tab: Áreas ── */}
      {tabActiva === 'areas' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-texto-muted">Entidad:</p>
              <select
                value={entidadSeleccionada?.codigo_entidad || ''}
                onChange={(e) => { const ent = entidades.find((x) => x.codigo_entidad === e.target.value) || null; setEntidadSeleccionada(ent) }}
                className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario"
              >
                <option value="">Selecciona entidad</option>
                {entidades.map((e) => <option key={e.codigo_entidad} value={e.codigo_entidad}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              {entidadSeleccionada && (
                <>
                  <Boton variante="contorno" tamano="sm"
                    onClick={() => exportarExcel(areasFiltradas as unknown as Record<string, unknown>[], [
                      { titulo: 'Entidad', campo: 'codigo_entidad' },
                      { titulo: 'Código área', campo: 'codigo_area' },
                      { titulo: 'Nombre', campo: 'nombre' },
                      { titulo: 'Área superior', campo: 'codigo_area_superior' },
                      { titulo: 'Tipo', campo: 'tipo_ubicacion' },
                      { titulo: 'Nivel', campo: 'nivel' },
                      { titulo: 'Descripción', campo: 'descripcion' },
                      { titulo: 'Responsable', campo: 'usuario_responsable' },
                    ], `areas_${entidadSeleccionada.codigo_entidad}`)}
                    disabled={areasFiltradas.length === 0}
                  >
                    <Download size={15} /> Excel
                  </Boton>
                  <Boton variante="primario" tamano="sm" onClick={abrirNuevaArea}>
                    <Plus size={14} /> Nueva ubicación
                  </Boton>
                </>
              )}
            </div>
          </div>

          {!entidadSeleccionada ? (
            <div className="bg-primario-muy-claro/50 border border-primario/20 rounded-lg px-4 py-3">
              <p className="text-sm text-primario-oscuro">Selecciona una entidad para ver sus áreas, o haz doble clic en una entidad de la lengüeta anterior.</p>
            </div>
          ) : (
            <>
              <div className="max-w-sm">
                <Input placeholder={t('buscarPlaceholder')} value={busquedaAreas} onChange={(e) => setBusquedaAreas(e.target.value)} icono={<Search size={15} />} />
              </div>
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh className="w-14">Código</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh className="w-36">Alias</TablaTh>
                  <TablaTh className="w-16">Ubic. Superior</TablaTh>
                  <TablaTh className="w-24">Tipo</TablaTh>
                  <TablaTh className="w-20 text-right">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {cargandoAreas ? (
                    <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>Cargando áreas...</TablaTd></TablaFila>
                  ) : areasFiltradas.length === 0 ? (
                    <TablaFila>
                      <TablaTd className="py-8 text-center" colSpan={6 as never}>
                        <div className="flex flex-col items-center gap-2 text-texto-muted">
                          <MapPin size={24} />
                          <p className="text-sm">{busquedaAreas ? 'No se encontraron ubicaciones' : 'No hay ubicaciones configuradas'}</p>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ) : areasFiltradas.map((a) => (
                    <TablaFila key={a.codigo_area}>
                      <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{a.codigo_area}</code></TablaTd>
                      <TablaTd>
                        <span className="font-medium" style={{ paddingLeft: `${(a.nivel || 0) * 1.25}rem` }}>
                          {(a.nivel || 0) > 0 && <span className="text-texto-muted mr-1">└</span>}
                          {a.nombre}
                        </span>
                      </TablaTd>
                      <TablaTd className="text-texto-muted text-sm">{a.alias || <span className="text-texto-light italic text-xs">—</span>}</TablaTd>
                      <TablaTd className="text-texto-muted text-xs">{a.codigo_area_superior || '—'}</TablaTd>
                      <TablaTd>
                        <Insignia variante={a.tipo_ubicacion === 'AREA' ? 'primario' : a.tipo_ubicacion === 'VIRTUAL' ? 'exito' : 'neutro'}>
                          {a.tipo_ubicacion || 'CONTENIDO'}
                        </Insignia>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarArea(a)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar ubicación">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { setAreaEliminando(a); setModalEliminarArea(true) }} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar ubicación">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </>
          )}
        </>
      )}

      {/* Modal entidad */}
      <Modal abierto={modalEntidad} alCerrar={() => setModalEntidad(false)} titulo={entidadEditando ? `Editar entidad: ${entidadEditando.nombre}` : 'Nueva entidad'} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px] min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update', ...(entidadEditando ? ['md'] : [])] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalEntidad(tab as typeof tabModalEntidad)}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalEntidad === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? t('tabDatos') : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : tab === 'programacion_update' ? 'Prog. Update' : '.md'}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalEntidad === 'datos' && (
            <>
              <div className="grid grid-cols-[1fr_220px] gap-3">
                <Input etiqueta={t('etiquetaNombreEntidad')} value={formEntidad.nombre} onChange={(e) => setFormEntidad({ ...formEntidad, nombre: e.target.value })} placeholder={t('placeholderNombreEntidad')} />
                <Input etiqueta="Alias" value={formEntidad.alias} onChange={(e) => setFormEntidad({ ...formEntidad, alias: e.target.value })} placeholder="(igual al nombre si vacío)" />
              </div>
              <Textarea etiqueta={t('etiquetaDescripcion')} value={formEntidad.descripcion} onChange={(e) => setFormEntidad({ ...formEntidad, descripcion: e.target.value })} rows={3} />
              {entidadEditando && (
                <Input etiqueta="Código" value={formEntidad.codigo_entidad} disabled readOnly />
              )}
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!entidadEditando}
                onGuardar={() => guardarEntidad(false)}
                onGuardarYSalir={() => guardarEntidad(true)}
                onCerrar={() => setModalEntidad(false)}
                cargando={guardando}
              />
            </>
          )}

          {/* Tab System Prompt */}
          {tabModalEntidad === 'system_prompt' && (
            <div className="flex flex-col gap-4">
              <TabPrompts
                tabla="entidades"
                pkColumna="codigo_entidad"
                pkValor={entidadEditando?.codigo_entidad ?? null}
                campos={formEntidad}
                onCampoCambiado={(campo, valor) => setFormEntidad({ ...formEntidad, [campo]: valor })}
                mostrarPromptInsert={false}
                mostrarPromptUpdate={false}
                mostrarSystemPrompt={true}
                mostrarPythonInsert={false}
                mostrarPythonUpdate={false}
                mostrarJavaScript={false}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!entidadEditando}
                onGuardar={() => guardarEntidad(false)}
                onGuardarYSalir={() => guardarEntidad(true)}
                onCerrar={() => setModalEntidad(false)}
                cargando={guardando}
                botonesIzquierda={entidadEditando ? (
                  <PieBotonesPrompts
                    tabla="entidades"
                    pkColumna="codigo_entidad"
                    pkValor={entidadEditando.codigo_entidad}
                    promptInsert={formEntidad.prompt_insert || undefined}
                    promptUpdate={formEntidad.prompt_update || undefined}
                  />
                ) : undefined}
              />
            </div>
          )}

          {/* Tab Programación Insert */}
          {tabModalEntidad === 'programacion_insert' && (
            <div className="flex flex-col gap-4">
              <TabPrompts
                tabla="entidades"
                pkColumna="codigo_entidad"
                pkValor={entidadEditando?.codigo_entidad ?? null}
                campos={formEntidad}
                onCampoCambiado={(campo, valor) => setFormEntidad({ ...formEntidad, [campo]: valor })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!entidadEditando}
                onGuardar={() => guardarEntidad(false)}
                onGuardarYSalir={() => guardarEntidad(true)}
                onCerrar={() => setModalEntidad(false)}
                cargando={guardando}
                botonesIzquierda={entidadEditando ? (
                  <PieBotonesPrompts
                    tabla="entidades"
                    pkColumna="codigo_entidad"
                    pkValor={entidadEditando.codigo_entidad}
                    promptInsert={formEntidad.prompt_insert || undefined}
                    promptUpdate={formEntidad.prompt_update || undefined}
                  />
                ) : undefined}
              />
            </div>
          )}
          {/* Tab Programación Update */}
          {tabModalEntidad === 'programacion_update' && (
            <div className="flex flex-col gap-4">
              <TabPrompts
                tabla="entidades"
                pkColumna="codigo_entidad"
                pkValor={entidadEditando?.codigo_entidad ?? null}
                campos={formEntidad}
                onCampoCambiado={(campo, valor) => setFormEntidad({ ...formEntidad, [campo]: valor })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!entidadEditando}
                onGuardar={() => guardarEntidad(false)}
                onGuardarYSalir={() => guardarEntidad(true)}
                onCerrar={() => setModalEntidad(false)}
                cargando={guardando}
                botonesIzquierda={entidadEditando ? (
                  <PieBotonesPrompts
                    tabla="entidades"
                    pkColumna="codigo_entidad"
                    pkValor={entidadEditando.codigo_entidad}
                    promptInsert={formEntidad.prompt_insert || undefined}
                    promptUpdate={formEntidad.prompt_update || undefined}
                  />
                ) : undefined}
              />
            </div>
          )}

          {/* Tab .md */}
          {tabModalEntidad === 'md' && entidadEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={mdEnt}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMdEnt && (
                <p className={`text-xs px-1 ${mensajeMdEnt.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMdEnt.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMdEnt(true); setMensajeMdEnt(null)
                      try {
                        const r = await entidadesApi.generarMd(entidadEditando.codigo_entidad)
                        setMdEnt(r.md)
                        setMensajeMdEnt({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMdEnt({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMdEnt(false) }
                    }}
                    cargando={generandoMdEnt}
                    disabled={generandoMdEnt || sincronizandoMdEnt}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMdEnt(true); setMensajeMdEnt(null)
                      try {
                        const r = await promptsApi.sincronizarFila('entidades', 'codigo_entidad', entidadEditando.codigo_entidad)
                        setMensajeMdEnt({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMdEnt({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMdEnt(false) }
                    }}
                    cargando={sincronizandoMdEnt}
                    disabled={generandoMdEnt || sincronizandoMdEnt || !mdEnt}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalEntidad(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal área / ubicación */}
      <Modal abierto={modalArea} alCerrar={() => setModalArea(false)}
        titulo={areaEditando ? `Editar Ubicación: ${areaEditando.nombre}` : 'Nueva ubicación'}
        descripcion={`Entidad: ${entidadSeleccionada?.nombre}`}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 min-w-[560px]">
          {/* Fila 1: Código + Nombre */}
          <div className="grid grid-cols-2 gap-4">
            {!areaEditando ? (
              <Input etiqueta="Código" value={formArea.codigo_area} onChange={(e) => setFormArea({ ...formArea, codigo_area: e.target.value.toUpperCase() })} placeholder="Ej: SEC-01" />
            ) : (
              <Input etiqueta="Código" value={formArea.codigo_area} disabled readOnly />
            )}
            <Input etiqueta="Nombre" value={formArea.nombre} onChange={(e) => setFormArea({ ...formArea, nombre: e.target.value })} placeholder="Nombre de la ubicación" />
          </div>
          {/* Fila 2: Alias + Descripción */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Input etiqueta="Alias" value={formArea.alias} onChange={(e) => setFormArea({ ...formArea, alias: e.target.value })} placeholder={formArea.nombre || 'Igual al nombre por defecto'} />
              <p className="text-xs text-texto-muted">Nombre corto de visualización (por defecto = nombre)</p>
            </div>
            <Input etiqueta="Descripción" value={formArea.descripcion} onChange={(e) => setFormArea({ ...formArea, descripcion: e.target.value })} placeholder="Descripción opcional" />
          </div>
          {/* Fila 3: Tipo (solo edición) + Ubicación superior */}
          <div className="grid grid-cols-2 gap-4">
            {areaEditando && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Tipo</label>
                <select
                  value={formArea.tipo_ubicacion}
                  onChange={(e) => setFormArea({ ...formArea, tipo_ubicacion: e.target.value as 'AREA' | 'CONTENIDO' | 'VIRTUAL' })}
                  className={selectClass}
                  disabled={formArea.tipo_ubicacion === 'VIRTUAL'}
                >
                  <option value="AREA">ÁREA</option>
                  <option value="CONTENIDO">CONTENIDO</option>
                  {formArea.tipo_ubicacion === 'VIRTUAL' && <option value="VIRTUAL">VIRTUAL</option>}
                </select>
                {formArea.tipo_ubicacion === 'VIRTUAL' && (
                  <p className="text-xs text-texto-muted">Tipo VIRTUAL — no editable (ubicación manual)</p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Ubicación superior</label>
              <select
                value={formArea.codigo_area_superior}
                onChange={(e) => setFormArea({ ...formArea, codigo_area_superior: e.target.value })}
                className={selectClass}
              >
                <option value="">Sin ubicación superior (raíz)</option>
                {areas.filter((a) => a.codigo_area !== formArea.codigo_area).map((a) => (
                  <option key={a.codigo_area} value={a.codigo_area}>
                    {'  '.repeat(a.nivel || 0)}{(a.nivel || 0) > 0 ? '└ ' : ''}{a.alias || a.nombre} ({a.codigo_area})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalArea(false)}>{tc('cancelar')}</Boton>
            <Boton variante="primario" onClick={guardarArea} cargando={guardando}>
              {areaEditando ? 'Guardar cambios' : 'Crear ubicación'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar eliminar área */}
      <ModalConfirmar
        abierto={modalEliminarArea}
        titulo="Eliminar ubicación"
        mensaje={`¿Confirmas eliminar la ubicación "${areaEliminando?.nombre}"? Esta acción eliminará también todas las sububicaciones dependientes.`}
        textoConfirmar="Eliminar"
        variante="peligro"
        alConfirmar={eliminarArea}
        alCerrar={() => { setModalEliminarArea(false); setAreaEliminando(null) }}
      />
    </div>
  )
}
