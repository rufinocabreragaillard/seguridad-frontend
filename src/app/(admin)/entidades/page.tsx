'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Building2, MapPin, Download, Search } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { entidadesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Entidad, Area } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useTranslations } from 'next-intl'

export default function PaginaEntidades() {
  const t = useTranslations('entidades')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()

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
  const [formEntidad, setFormEntidad] = useState({ codigo_entidad: '', nombre: '', descripcion: '', prompt: '', system_prompt: '' })
  const [tabModalEntidad, setTabModalEntidad] = useState<'datos' | 'prompt' | 'system_prompt'>('datos')
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
    setFormEntidad({ codigo_entidad: '', nombre: '', descripcion: '', prompt: '', system_prompt: '' })
    setTabModalEntidad('datos')
    setError('')
    setModalEntidad(true)
  }

  const abrirEditarEntidad = (e: Entidad) => {
    setEntidadEditando(e)
    setFormEntidad({ codigo_entidad: e.codigo_entidad, nombre: e.nombre, descripcion: e.descripcion || '', prompt: e.prompt || '', system_prompt: e.system_prompt || '' })
    setTabModalEntidad('datos')
    setError('')
    setModalEntidad(true)
  }

  const guardarEntidad = async (cerrar: boolean) => {
    if (!formEntidad.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      if (entidadEditando) {
        await entidadesApi.actualizar(entidadEditando.codigo_entidad, { nombre: formEntidad.nombre, descripcion: formEntidad.descripcion || undefined, prompt: formEntidad.prompt || undefined, system_prompt: formEntidad.system_prompt || undefined })
        if (cerrar) setModalEntidad(false)
      } else {
        const nueva = await entidadesApi.crear({ nombre: formEntidad.nombre, descripcion: formEntidad.descripcion || undefined, codigo_grupo: grupoActivo || 'ADMIN' })
        if (!cerrar) {
          setEntidadEditando(nueva)
          setFormEntidad({ codigo_entidad: nueva.codigo_entidad, nombre: nueva.nombre, descripcion: nueva.descripcion || '', prompt: nueva.prompt || '', system_prompt: nueva.system_prompt || '' })
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
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">Gestión de organizaciones y áreas jerárquicas</p>
      </div>

      {/* ═══ ENTIDADES Y ÁREAS ═══ */}
      {(<>
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <Boton
            variante="contorno"
            tamano="sm"
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
            <Download size={15} />
            Excel
          </Boton>
          <Boton variante="primario" onClick={abrirNuevaEntidad}><Plus size={16} />{t('nuevaEntidad')}</Boton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de entidades */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-texto-muted uppercase tracking-wider px-1">{t('seccionEntidades')}</h3>
          {cargando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-surface border border-borde rounded-xl animate-pulse" />
              ))}
            </div>
          ) : entidades.map((e) => (
            <button
              key={e.codigo_entidad}
              onClick={() => setEntidadSeleccionada(e)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                entidadSeleccionada?.codigo_entidad === e.codigo_entidad
                  ? 'border-primario bg-primario-muy-claro'
                  : 'border-borde bg-surface hover:bg-fondo'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                entidadSeleccionada?.codigo_entidad === e.codigo_entidad
                  ? 'bg-primario text-primario-texto'
                  : 'bg-fondo text-texto-muted'
              }`}>
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-texto truncate">{e.nombre}</p>
                <p className="text-xs text-texto-muted">{e.codigo_entidad}</p>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); abrirEditarEntidad(e) }}
                className="ml-auto p-1 rounded hover:bg-white text-texto-muted hover:text-primario transition-colors"
              >
                <Pencil size={13} />
              </button>
            </button>
          ))}
        </div>

        {/* Áreas de la entidad seleccionada */}
        <div className="lg:col-span-2">
          {entidadSeleccionada ? (
            <Tarjeta>
              <div className="px-6 py-4 border-b border-borde flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-texto">
                    Áreas de {entidadSeleccionada.nombre}
                  </h3>
                  <p className="text-xs text-texto-muted mt-0.5">
                    {areas.length} área{areas.length !== 1 ? 's' : ''} configurada{areas.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => exportarExcel(areasFiltradas as unknown as Record<string, unknown>[], [
                      { titulo: 'Entidad', campo: 'codigo_entidad' },
                      { titulo: 'Código área', campo: 'codigo_area' },
                      { titulo: 'Nombre', campo: 'nombre' },
                      { titulo: 'Área superior', campo: 'codigo_area_superior' },
                      { titulo: 'Tipo', campo: 'tipo_ubicacion' },
                      { titulo: 'Nivel', campo: 'nivel' },
                      { titulo: 'Descripción', campo: 'descripcion' },
                      { titulo: 'Responsable', campo: 'usuario_responsable' },
                      { titulo: 'Estado', campo: 'activo', formato: (v) => v === false ? 'Inactivo' : 'Activo' },
                    ], `areas_${entidadSeleccionada?.codigo_entidad || 'sin_entidad'}`)}
                    disabled={areasFiltradas.length === 0}
                  >
                    <Download size={14} />
                    Excel
                  </Boton>
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => { setFormArea({ codigo_area: '', nombre: '', descripcion: '', codigo_area_superior: '' }); setError(''); setModalArea(true) }}
                  >
                    <Plus size={14} />
                    Nueva área
                  </Boton>
                </div>
              </div>
              {/* Buscador de áreas */}
              <div className="px-6 py-3 border-b border-borde">
                <div className="max-w-sm">
                  <Input
                    placeholder={t('buscarPlaceholder')}
                    value={busquedaAreas}
                    onChange={(e) => setBusquedaAreas(e.target.value)}
                    icono={<Search size={15} />}
                  />
                </div>
              </div>
              <TarjetaContenido className="p-0">
                <Tabla>
                  <TablaCabecera>
                    <tr>
                      <TablaTh>{t('colCodigo')}</TablaTh>
                      <TablaTh>{t('colNombre')}</TablaTh>
                      <TablaTh>{t('colAreaSuperior')}</TablaTh>
                      <TablaTh>Tipo</TablaTh>
                      <TablaTh>{t('colResponsable')}</TablaTh>
                    </tr>
                  </TablaCabecera>
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
              </TarjetaContenido>
            </Tarjeta>
          ) : (
            <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
              Selecciona una entidad para ver sus áreas
            </div>
          )}
        </div>
      </div>

      </>)}

      {/* Modal entidad */}
      <Modal abierto={modalEntidad} alCerrar={() => setModalEntidad(false)} titulo={entidadEditando ? 'Editar entidad' : 'Nueva entidad'} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'prompt', 'system_prompt'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalEntidad(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalEntidad === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? t('tabDatos') : tab === 'prompt' ? t('tabPrompt') : t('tabSystemPrompt')}
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
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="primario" onClick={() => guardarEntidad(false)} cargando={guardando}>{tc('grabar')}</Boton>
                <Boton variante="secundario" onClick={() => guardarEntidad(true)} cargando={guardando}>{tc('grabarYSalir')}</Boton>
                <Boton variante="contorno" onClick={() => setModalEntidad(false)}>{tc('salir')}</Boton>
              </div>
            </>
          )}

          {/* Tab Prompt */}
          {tabModalEntidad === 'prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Texto que se inyecta en el prompt del LLM para dar contexto específico a esta entidad. Se usa en clasificación de documentos y análisis.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Esta entidad gestiona documentos de contratación pública..."
                value={formEntidad.prompt}
                onChange={(e) => setFormEntidad({ ...formEntidad, prompt: e.target.value })}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="primario" onClick={() => guardarEntidad(false)} cargando={guardando}>{tc('grabar')}</Boton>
                <Boton variante="secundario" onClick={() => guardarEntidad(true)} cargando={guardando}>{tc('grabarYSalir')}</Boton>
                <Boton variante="contorno" onClick={() => setModalEntidad(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalEntidad === 'system_prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Instrucciones de sistema que se prependen a todas las conversaciones y análisis LLM en esta entidad. Define el tono, restricciones y rol del asistente.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Eres un asistente especializado en la gestión documental de esta entidad..."
                value={formEntidad.system_prompt}
                onChange={(e) => setFormEntidad({ ...formEntidad, system_prompt: e.target.value })}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="primario" onClick={() => guardarEntidad(false)} cargando={guardando}>{tc('grabar')}</Boton>
                <Boton variante="secundario" onClick={() => guardarEntidad(true)} cargando={guardando}>{tc('grabarYSalir')}</Boton>
                <Boton variante="contorno" onClick={() => setModalEntidad(false)}>{tc('salir')}</Boton>
              </div>
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
