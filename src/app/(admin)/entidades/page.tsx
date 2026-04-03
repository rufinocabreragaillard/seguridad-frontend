'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Building2, MapPin, Download, Search, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { entidadesApi, rolesApi, funcionesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Entidad, Area, Rol, Funcion } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

type FuncionAsignada = { codigo_funcion: string; orden: number; funciones: { nombre_funcion: string; activo: boolean } }

export default function PaginaEntidades() {
  const { grupoActivo } = useAuth()
  const [tabPrincipal, setTabPrincipal] = useState<'entidades' | 'roles'>('entidades')

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
  const [formEntidad, setFormEntidad] = useState({ codigo_entidad: '', nombre: '', descripcion: '' })
  const [formArea, setFormArea] = useState({ codigo_area: '', nombre: '', descripcion: '', codigo_area_superior: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Roles ─────────────────────────────────────────────────────────────────
  const [roles, setRoles] = useState<Rol[]>([])
  const [allFunciones, setAllFunciones] = useState<Funcion[]>([])
  const [busquedaRoles, setBusquedaRoles] = useState('')
  const [modalRol, setModalRol] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [formRol, setFormRol] = useState({ codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '', funcion_por_defecto: '' })
  const [tabModalRol, setTabModalRol] = useState<'datos' | 'funciones'>('datos')
  const [guardandoRol, setGuardandoRol] = useState(false)
  const [errorRol, setErrorRol] = useState('')

  // Funciones del rol
  const [funcionesRol, setFuncionesRol] = useState<FuncionAsignada[]>([])
  const [cargandoFuncionesRol, setCargandoFuncionesRol] = useState(false)
  const [funcionNueva, setFuncionNueva] = useState('')
  const [asignandoFuncion, setAsignandoFuncion] = useState(false)

  // Confirmación eliminación rol
  const [rolAEliminar, setRolAEliminar] = useState<Rol | null>(null)
  const [eliminandoRol, setEliminandoRol] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [e, r, f] = await Promise.all([entidadesApi.listar(), rolesApi.listar(), funcionesApi.listar()])
      setEntidades(e)
      setRoles(r)
      setAllFunciones(f)
      if (e.length > 0 && !entidadSeleccionada) setEntidadSeleccionada(e[0])
    } finally {
      setCargando(false)
    }
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
    setFormEntidad({ codigo_entidad: '', nombre: '', descripcion: '' })
    setError('')
    setModalEntidad(true)
  }

  const abrirEditarEntidad = (e: Entidad) => {
    setEntidadEditando(e)
    setFormEntidad({ codigo_entidad: e.codigo_entidad, nombre: e.nombre, descripcion: e.descripcion || '' })
    setError('')
    setModalEntidad(true)
  }

  const guardarEntidad = async () => {
    if (!formEntidad.codigo_entidad || !formEntidad.nombre) { setError('Código y nombre son obligatorios'); return }
    setGuardando(true)
    try {
      if (entidadEditando) {
        await entidadesApi.actualizar(entidadEditando.codigo_entidad, { nombre: formEntidad.nombre })
      } else {
        const { descripcion, ...datosLimpios } = formEntidad
        await entidadesApi.crear({ ...datosLimpios, codigo_grupo: grupoActivo || 'ADMIN' })
      }
      setModalEntidad(false)
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

  // ── Roles: CRUD + funciones ────────────────────────────────────────────────
  const cargarFuncionesRol = useCallback(async (codigo: string) => {
    setCargandoFuncionesRol(true)
    try { setFuncionesRol(await rolesApi.listarFunciones(codigo)) } catch { setFuncionesRol([]) }
    finally { setCargandoFuncionesRol(false) }
  }, [])

  const abrirNuevoRol = () => {
    setRolEditando(null); setFormRol({ codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '', funcion_por_defecto: '' })
    setErrorRol(''); setTabModalRol('datos'); setModalRol(true)
  }
  const abrirEditarRol = (r: Rol) => {
    setRolEditando(r); setFormRol({ codigo_rol: r.codigo_rol, nombre: r.nombre, alias_de_rol: r.alias_de_rol || '', descripcion: r.descripcion || '', url_inicio: r.url_inicio || '', funcion_por_defecto: r.funcion_por_defecto || '' })
    setErrorRol(''); setTabModalRol('datos'); setFuncionNueva(''); cargarFuncionesRol(r.codigo_rol); setModalRol(true)
  }
  const guardarRol = async () => {
    if (!formRol.codigo_rol || !formRol.nombre) { setErrorRol('Código y nombre son obligatorios'); return }
    setGuardandoRol(true)
    try {
      if (rolEditando) { await rolesApi.actualizar(rolEditando.codigo_rol, { nombre: formRol.nombre, alias_de_rol: formRol.alias_de_rol || undefined, descripcion: formRol.descripcion, url_inicio: formRol.url_inicio, funcion_por_defecto: formRol.funcion_por_defecto || undefined }) }
      else { await rolesApi.crear({ ...formRol, codigo_grupo: grupoActivo || 'ADMIN' }) }
      setModalRol(false); cargar()
    } catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoRol(false) }
  }
  const ejecutarEliminarRol = async () => {
    if (!rolAEliminar) return; setEliminandoRol(true)
    try { await rolesApi.eliminar(rolAEliminar.codigo_rol); setRolAEliminar(null); cargar() }
    catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error'); setRolAEliminar(null) }
    finally { setEliminandoRol(false) }
  }

  const asignarFuncionRol = async () => {
    if (!funcionNueva || !rolEditando) return; setAsignandoFuncion(true)
    try { await rolesApi.asignarFuncion(rolEditando.codigo_rol, funcionNueva); setFuncionNueva(''); cargarFuncionesRol(rolEditando.codigo_rol) }
    catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error') } finally { setAsignandoFuncion(false) }
  }
  const quitarFuncionRol = async (c: string) => {
    if (!rolEditando) return
    try { await rolesApi.quitarFuncion(rolEditando.codigo_rol, c); cargarFuncionesRol(rolEditando.codigo_rol) }
    catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error') }
  }
  const moverFuncionRol = async (index: number, dir: 'arriba' | 'abajo') => {
    if (!rolEditando) return
    const lista = [...funcionesRol]; const swap = dir === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const oA = lista[index].orden; const oB = lista[swap].orden
    lista[index].orden = oB; lista[swap].orden = oA
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setFuncionesRol(lista)
    try { await rolesApi.reordenarFunciones(rolEditando.codigo_rol, lista.map((f) => ({ codigo_funcion: f.codigo_funcion, orden: f.orden }))) }
    catch { cargarFuncionesRol(rolEditando.codigo_rol) }
  }

  const funcionesDisponiblesRol = allFunciones.filter((f) => f.activo && !funcionesRol.some((fa) => fa.codigo_funcion === f.codigo_funcion))
  const rolesFiltrados = roles.filter((r) => r.nombre.toLowerCase().includes(busquedaRoles.toLowerCase()) || r.codigo_rol.toLowerCase().includes(busquedaRoles.toLowerCase()) || (r.alias_de_rol || '').toLowerCase().includes(busquedaRoles.toLowerCase())).sort((a, b) => a.nombre.localeCompare(b.nombre))

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
        <h2 className="text-2xl font-bold text-texto">Entidades, Áreas y Roles</h2>
        <p className="text-sm text-texto-muted mt-1">Gestión de organizaciones, áreas y perfiles de acceso</p>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {(['entidades', 'roles'] as const).map((tab) => (
          <button key={tab} onClick={() => setTabPrincipal(tab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tabPrincipal === tab ? 'bg-surface text-primario shadow-sm border border-borde' : 'text-texto-muted hover:text-texto'}`}>
            {tab === 'entidades' ? 'Entidades y Áreas' : 'Roles'}
          </button>
        ))}
      </div>

      {/* ═══ TAB ENTIDADES Y ÁREAS ═══ */}
      {tabPrincipal === 'entidades' && (<>
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={() => exportarExcel(entidades as Record<string, unknown>[], [
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
          <Boton variante="primario" onClick={abrirNuevaEntidad}><Plus size={16} />Nueva entidad</Boton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de entidades */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-texto-muted uppercase tracking-wider px-1">Entidades</h3>
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
                  ? 'bg-primario text-white'
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
                    onClick={() => exportarExcel(areasFiltradas as Record<string, unknown>[], [
                      { titulo: 'Entidad', campo: 'codigo_entidad' },
                      { titulo: 'Código área', campo: 'codigo_area' },
                      { titulo: 'Nombre', campo: 'nombre' },
                      { titulo: 'Área superior', campo: 'codigo_area_superior' },
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
                    placeholder="Buscar por nombre, código o responsable..."
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
                      <TablaTh>Código</TablaTh>
                      <TablaTh>Nombre</TablaTh>
                      <TablaTh>Área superior</TablaTh>
                      <TablaTh>Responsable</TablaTh>
                    </tr>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {cargandoAreas ? (
                      <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>Cargando áreas...</TablaTd></TablaFila>
                    ) : areasFiltradas.length === 0 ? (
                      <TablaFila>
                        <TablaTd className="py-8 text-center" colSpan={4 as never}>
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

      {/* ═══ TAB ROLES ═══ */}
      {tabPrincipal === 'roles' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder="Buscar por nombre, código o alias..." value={busquedaRoles} onChange={(e) => setBusquedaRoles(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(rolesFiltrados as Record<string, unknown>[], [{ titulo: 'Grupo', campo: 'codigo_grupo' }, { titulo: 'Código', campo: 'codigo_rol' }, { titulo: 'Alias', campo: 'alias_de_rol' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Descripción', campo: 'descripcion' }, { titulo: 'URL inicio', campo: 'url_inicio' }, { titulo: 'Fn. defecto', campo: 'funcion_por_defecto' }, { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' }], `roles_${grupoActivo || 'todos'}`)} disabled={rolesFiltrados.length === 0}><Download size={15} />Excel</Boton>
              <Boton variante="primario" onClick={abrirNuevoRol}><Plus size={16} />Nuevo rol</Boton>
            </div>
          </div>
          <Tabla>
            <TablaCabecera><tr><TablaTh>Código</TablaTh><TablaTh>Alias</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>URL inicio</TablaTh><TablaTh>Fn. defecto</TablaTh><TablaTh>Estado</TablaTh><TablaTh className="text-right">Acciones</TablaTh></tr></TablaCabecera>
            <TablaCuerpo>
              {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Cargando...</TablaTd></TablaFila>
              ) : rolesFiltrados.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>No se encontraron roles</TablaTd></TablaFila>
              ) : rolesFiltrados.map((r) => (
                <TablaFila key={r.codigo_rol}>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{r.codigo_rol}</code></TablaTd>
                  <TablaTd className="text-sm">{r.alias_de_rol || '—'}</TablaTd>
                  <TablaTd className="font-medium">{r.nombre}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{r.url_inicio || '—'}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{r.funcion_por_defecto || '—'}</TablaTd>
                  <TablaTd><Insignia variante={r.activo ? 'exito' : 'error'}>{r.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarRol(r)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setRolAEliminar(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {/* Modal entidad */}
      <Modal abierto={modalEntidad} alCerrar={() => setModalEntidad(false)} titulo={entidadEditando ? 'Editar entidad' : 'Nueva entidad'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Codigo *" value={formEntidad.codigo_entidad} onChange={(e) => setFormEntidad({ ...formEntidad, codigo_entidad: e.target.value.toUpperCase() })} disabled={!!entidadEditando} placeholder="MUNI" />
          <Input etiqueta="Nombre *" value={formEntidad.nombre} onChange={(e) => setFormEntidad({ ...formEntidad, nombre: e.target.value })} placeholder="Municipalidad de..." />
          <Input etiqueta="Descripcion" value={formEntidad.descripcion} onChange={(e) => setFormEntidad({ ...formEntidad, descripcion: e.target.value })} />
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalEntidad(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarEntidad} cargando={guardando}>{entidadEditando ? 'Guardar' : 'Crear entidad'}</Boton>
          </div>
        </div>
      </Modal>

      {/* Modal área */}
      <Modal abierto={modalArea} alCerrar={() => setModalArea(false)} titulo="Nueva área" descripcion={`Para entidad: ${entidadSeleccionada?.nombre}`}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formArea.codigo_area} onChange={(e) => setFormArea({ ...formArea, codigo_area: e.target.value.toUpperCase() })} placeholder="ADMIN" />
          <Input etiqueta="Nombre *" value={formArea.nombre} onChange={(e) => setFormArea({ ...formArea, nombre: e.target.value })} placeholder="Administración" />
          <Input etiqueta="Descripción" value={formArea.descripcion} onChange={(e) => setFormArea({ ...formArea, descripcion: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Área superior</label>
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
            <Boton variante="contorno" onClick={() => setModalArea(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarArea} cargando={guardando}>Crear área</Boton>
          </div>
        </div>
      </Modal>
      {/* Modal Rol */}
      <Modal abierto={modalRol} alCerrar={() => setModalRol(false)} titulo={rolEditando ? `Editar rol: ${rolEditando.nombre}` : 'Nuevo rol'}>
        <div className="flex flex-col gap-4">
          {rolEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button onClick={() => setTabModalRol('datos')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalRol === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Datos</button>
              <button onClick={() => setTabModalRol('funciones')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalRol === 'funciones' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Funciones ({funcionesRol.length})</button>
            </div>
          )}
          {tabModalRol === 'datos' && (<>
            <Input etiqueta="Código *" value={formRol.codigo_rol} onChange={(e) => setFormRol({ ...formRol, codigo_rol: e.target.value.toUpperCase() })} disabled={!!rolEditando} placeholder="ADMIN" />
            <Input etiqueta="Alias" value={formRol.alias_de_rol} onChange={(e) => setFormRol({ ...formRol, alias_de_rol: e.target.value.substring(0, 40) })} placeholder="Admin" />
            <Input etiqueta="Nombre *" value={formRol.nombre} onChange={(e) => setFormRol({ ...formRol, nombre: e.target.value })} placeholder="Administrador" />
            <Input etiqueta="Descripción" value={formRol.descripcion} onChange={(e) => setFormRol({ ...formRol, descripcion: e.target.value })} />
            <Input etiqueta="URL de inicio" value={formRol.url_inicio} onChange={(e) => setFormRol({ ...formRol, url_inicio: e.target.value })} placeholder="/admin/dashboard" />
            {rolEditando && (
              <div className="flex flex-col gap-1"><label className="text-sm font-medium text-texto">Función por defecto</label>
                <select value={formRol.funcion_por_defecto} onChange={(e) => setFormRol({ ...formRol, funcion_por_defecto: e.target.value })} className={selectClass}>
                  <option value="">Sin función por defecto</option>
                  {funcionesRol.map((fa) => (<option key={fa.codigo_funcion} value={fa.codigo_funcion}>{fa.funciones?.nombre_funcion || fa.codigo_funcion}</option>))}
                </select>
              </div>
            )}
            {errorRol && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorRol}</p></div>}
            <div className="flex gap-3 justify-end pt-2"><Boton variante="contorno" onClick={() => setModalRol(false)}>Cancelar</Boton><Boton variante="primario" onClick={guardarRol} cargando={guardandoRol}>{rolEditando ? 'Guardar' : 'Crear rol'}</Boton></div>
          </>)}
          {tabModalRol === 'funciones' && rolEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2"><div className="flex-1"><select value={funcionNueva} onChange={(e) => setFuncionNueva(e.target.value)} className={selectClass}><option value="">Seleccionar función...</option>{funcionesDisponiblesRol.map((f) => (<option key={f.codigo_funcion} value={f.codigo_funcion}>{f.nombre}</option>))}</select></div><Boton variante="primario" onClick={asignarFuncionRol} cargando={asignandoFuncion} disabled={!funcionNueva}><Plus size={14} />Asignar</Boton></div>
              {cargandoFuncionesRol ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : funcionesRol.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene funciones asignadas</p>
              : <div className="flex flex-col gap-2">{funcionesRol.map((fa, idx) => (
                <div key={fa.codigo_funcion} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde bg-surface">
                  <div className="flex flex-col"><button onClick={() => moverFuncionRol(idx, 'arriba')} disabled={idx === 0} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button><button onClick={() => moverFuncionRol(idx, 'abajo')} disabled={idx === funcionesRol.length - 1} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button></div>
                  <span className="text-xs text-texto-muted w-5 text-center">{fa.orden}</span>
                  <div className="flex-1 min-w-0"><span className="text-sm font-medium text-texto">{fa.funciones?.nombre_funcion || fa.codigo_funcion}</span><span className="ml-2 text-xs text-texto-muted">{fa.codigo_funcion}</span></div>
                  <button onClick={() => quitarFuncionRol(fa.codigo_funcion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button>
                </div>
              ))}</div>}
              {errorRol && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorRol}</p></div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalRol(false)}>Cerrar</Boton></div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Confirmar eliminación rol */}
      <ModalConfirmar abierto={!!rolAEliminar} alCerrar={() => setRolAEliminar(null)} alConfirmar={ejecutarEliminarRol} titulo="Eliminar rol" mensaje={`¿Estás seguro de eliminar el rol "${rolAEliminar?.nombre}"? Esta acción no se puede deshacer.`} textoConfirmar="Eliminar" cargando={eliminandoRol} />
    </div>
  )
}
