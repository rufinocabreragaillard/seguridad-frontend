'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Building2, MapPin, Download, Search, Eye } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { Modal } from '@/components/ui/modal'
import { Insignia } from '@/components/ui/insignia'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { entidadesApi } from '@/lib/api'
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

  const [modalEntidad, setModalEntidad] = useState(false)
  const [modalArea, setModalArea] = useState(false)
  const [entidadEditando, setEntidadEditando] = useState<Entidad | null>(null)
  const [formEntidad, setFormEntidad] = useState({ codigo_entidad: '', nombre: '', descripcion: '', prompt: '', system_prompt: '', python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalEntidad, setTabModalEntidad] = useState<'datos' | 'prompts'>('datos')
  const [formArea, setFormArea] = useState({ codigo_area: '', nombre: '', descripcion: '', codigo_area_superior: '' })
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
    setFormEntidad({ codigo_entidad: '', nombre: '', descripcion: '', prompt: '', system_prompt: '', python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setTabModalEntidad('datos')
    setError('')
    setModalEntidad(true)
  }

  const abrirEditarEntidad = (e: Entidad) => {
    setEntidadEditando(e)
    const e2 = e as unknown as Record<string, unknown>
    setFormEntidad({ codigo_entidad: e.codigo_entidad, nombre: e.nombre, descripcion: e.descripcion || '', prompt: e.prompt || '', system_prompt: e.system_prompt || '', python: e2.python as string || '', javascript: e2.javascript as string || '', python_editado_manual: e2.python_editado_manual as boolean || false, javascript_editado_manual: e2.javascript_editado_manual as boolean || false })
    setTabModalEntidad('datos')
    setError('')
    setModalEntidad(true)
  }

  const guardarEntidad = async (cerrar: boolean) => {
    if (!formEntidad.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      if (entidadEditando) {
        await entidadesApi.actualizar(entidadEditando.codigo_entidad, { nombre: formEntidad.nombre, descripcion: formEntidad.descripcion || undefined, prompt: formEntidad.prompt || undefined, system_prompt: formEntidad.system_prompt || undefined, python: formEntidad.python || undefined, javascript: formEntidad.javascript || undefined, python_editado_manual: formEntidad.python_editado_manual, javascript_editado_manual: formEntidad.javascript_editado_manual } as Record<string, unknown>)
        if (cerrar) setModalEntidad(false)
      } else {
        const nueva = await entidadesApi.crear({ nombre: formEntidad.nombre, descripcion: formEntidad.descripcion || undefined, codigo_grupo: grupoActivo || 'ADMIN' })
        if (!cerrar) {
          setEntidadEditando(nueva)
          const n2 = nueva as unknown as Record<string, unknown>
          setFormEntidad({ codigo_entidad: nueva.codigo_entidad, nombre: nueva.nombre, descripcion: nueva.descripcion || '', prompt: nueva.prompt || '', system_prompt: nueva.system_prompt || '', python: n2.python as string || '', javascript: n2.javascript as string || '', python_editado_manual: n2.python_editado_manual as boolean || false, javascript_editado_manual: n2.javascript_editado_manual as boolean || false })
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

  const guardarArea = async () => {
    if (!entidadSeleccionada || !formArea.codigo_area || !formArea.nombre) { setError('Código y nombre son obligatorios'); return }
    setGuardando(true)
    try {
      const datos: Record<string, string> = {
        codigo_area: formArea.codigo_area,
        nombre: formArea.nombre,
      }
      if (formArea.descripcion) datos.descripcion = formArea.descripcion
      if (formArea.codigo_area_superior) datos.codigo_area_superior = formArea.codigo_area_superior
      await entidadesApi.crearArea(entidadSeleccionada.codigo_entidad, datos)
      setModalArea(false)
      cargarAreas(entidadSeleccionada.codigo_entidad)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

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
                onClick={() => exportarExcel(entidades as unknown as Record<string, unknown>[], [
                  { titulo: 'Grupo', campo: 'codigo_grupo' },
                  { titulo: 'Código', campo: 'codigo_entidad' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Descripción', campo: 'descripcion' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                  { titulo: 'Fecha creación', campo: 'fecha_creacion', formato: (v) => v ? new Date(v as string).toLocaleString('es-CL') : '' },
                ], `entidades_${grupoActivo || 'todos'}`)}
                disabled={entidades.length === 0}
              >
                <Download size={15} /> Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaEntidad}><Plus size={16} />{t('nuevaEntidad')}</Boton>
            </div>
          </div>

          {cargando ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {entidades.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={4 as never}>No hay entidades registradas</TablaTd></TablaFila>
                ) : entidades.map((e) => (
                  <TablaFila key={e.codigo_entidad}
                    onDoubleClick={() => { setEntidadSeleccionada(e); setTabActiva('areas') }}
                  >
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_entidad}</code></TablaTd>
                    <TablaTd className="font-medium">{e.nombre}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm">{e.descripcion || <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEntidadSeleccionada(e); setTabActiva('areas') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver áreas"><Eye size={14} /></button>
                        <button onClick={() => abrirEditarEntidad(e)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      </div>
                    </TablaTd>
                  </TablaFila>
                ))}
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
                  <Boton variante="contorno" tamano="sm"
                    onClick={() => { setFormArea({ codigo_area: '', nombre: '', descripcion: '', codigo_area_superior: '' }); setError(''); setModalArea(true) }}
                  >
                    <Plus size={14} /> Nueva área
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
                  <TablaTh>{t('colCodigo')}</TablaTh><TablaTh>{t('colNombre')}</TablaTh>
                  <TablaTh>{t('colAreaSuperior')}</TablaTh><TablaTh>Tipo</TablaTh><TablaTh>{t('colResponsable')}</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {cargandoAreas ? (
                    <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>Cargando áreas...</TablaTd></TablaFila>
                  ) : areasFiltradas.length === 0 ? (
                    <TablaFila>
                      <TablaTd className="py-8 text-center" colSpan={5 as never}>
                        <div className="flex flex-col items-center gap-2 text-texto-muted">
                          <MapPin size={24} />
                          <p className="text-sm">{busquedaAreas ? 'No se encontraron áreas' : 'No hay áreas configuradas'}</p>
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
                      <TablaTd className="text-texto-muted text-xs">{a.codigo_area_superior || '—'}</TablaTd>
                      <TablaTd>
                        <Insignia variante={a.tipo_ubicacion === 'AREA' ? 'primario' : 'neutro'}>
                          {a.tipo_ubicacion || 'CONTENIDO'}
                        </Insignia>
                      </TablaTd>
                      <TablaTd className="text-texto-muted text-xs">{a.usuario_responsable || '—'}</TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </>
          )}
        </>
      )}

      {/* Modal entidad */}
      <Modal abierto={modalEntidad} alCerrar={() => setModalEntidad(false)} titulo={entidadEditando ? 'Editar entidad' : 'Nueva entidad'} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'prompts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalEntidad(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalEntidad === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? t('tabDatos') : 'Prompts'}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalEntidad === 'datos' && (
            <>
              <Input etiqueta={t('etiquetaNombreEntidad')} value={formEntidad.nombre} onChange={(e) => setFormEntidad({ ...formEntidad, nombre: e.target.value })} placeholder={t('placeholderNombreEntidad')} />
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

          {/* Tab Prompts */}
          {tabModalEntidad === 'prompts' && (
            <div className="flex flex-col gap-4">
              <TabPrompts
                tabla="entidades"
                pkColumna="codigo_entidad"
                pkValor={entidadEditando?.codigo_entidad ?? null}
                campos={formEntidad}
                onCampoCambiado={(campo, valor) => setFormEntidad({ ...formEntidad, [campo]: valor })}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!entidadEditando}
                onGuardar={() => guardarEntidad(false)}
                onGuardarYSalir={() => guardarEntidad(true)}
                onCerrar={() => setModalEntidad(false)}
                cargando={guardando}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal área */}
      <Modal abierto={modalArea} alCerrar={() => setModalArea(false)} titulo={t('crearArea')} descripcion={`Para entidad: ${entidadSeleccionada?.nombre}`}>
        <div className="flex flex-col gap-4">
          <Input etiqueta={t('etiquetaCodigoArea')} value={formArea.codigo_area} onChange={(e) => setFormArea({ ...formArea, codigo_area: e.target.value.toUpperCase() })} placeholder={t('placeholderCodigoArea')} />
          <Input etiqueta={t('etiquetaNombreArea')} value={formArea.nombre} onChange={(e) => setFormArea({ ...formArea, nombre: e.target.value })} placeholder={t('placeholderNombreArea')} />
          <Input etiqueta={t('etiquetaDescripcion')} value={formArea.descripcion} onChange={(e) => setFormArea({ ...formArea, descripcion: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">{t('etiquetaAreaSuperior')}</label>
            <select
              value={formArea.codigo_area_superior}
              onChange={(e) => setFormArea({ ...formArea, codigo_area_superior: e.target.value })}
              className={selectClass}
            >
              <option value="">Sin área superior</option>
              {areas.filter((a) => a.codigo_area !== formArea.codigo_area).map((a) => (
                <option key={a.codigo_area} value={a.codigo_area}>
                  {'—'.repeat(a.nivel || 0)} {a.nombre} ({a.codigo_area})
                </option>
              ))}
            </select>
            <p className="text-xs text-texto-muted">Selecciona el área jerárquicamente superior</p>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalArea(false)}>{tc('cancelar')}</Boton>
            <Boton variante="primario" onClick={guardarArea} cargando={guardando}>{t('crearArea')}</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
