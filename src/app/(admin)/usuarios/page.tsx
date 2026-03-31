'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, UserCheck, UserX, X, Star, Phone, PhoneOff } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { usuariosApi, rolesApi, entidadesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Usuario, Rol, Entidad, Area } from '@/lib/tipos'

type RolAsignado = { codigo_grupo: string; codigo_rol: string; roles: { nombre: string; activo: boolean } }
type GrupoAsignado = { codigo_grupo: string; grupos_entidades: { nombre: string; activo: boolean } }
type EntidadAsignada = {
  codigo_entidad: string
  codigo_grupo: string
  codigo_area?: string
  entidades: { nombre: string; activo: boolean }
}

const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

export default function PaginaUsuarios() {
  const { usuario: usuarioActual } = useAuth()
  const grupoActivo = usuarioActual?.grupo_activo ?? ''
  const grupoAnteriorRef = useRef(grupoActivo)

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorCarga, setErrorCarga] = useState('')
  const [tabActiva, setTabActiva] = useState<'datos' | 'roles' | 'entidades'>('datos')

  // ── Roles ──────────────────────────────────────────────────────────────────
  const [rolesUsuario, setRolesUsuario] = useState<RolAsignado[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [rolNuevo, setRolNuevo] = useState('')
  const [asignandoRol, setAsignandoRol] = useState(false)

  // ── Grupos del usuario (para dropdown de grupo_por_defecto) ────────────────
  const [gruposUsuario, setGruposUsuario] = useState<GrupoAsignado[]>([])

  // ── Entidades del usuario (pestaña Entidades) ─────────────────────────────
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [entidadesUsuario, setEntidadesUsuario] = useState<EntidadAsignada[]>([])
  const [cargandoEntidades, setCargandoEntidades] = useState(false)
  const [entidadNueva, setEntidadNueva] = useState('')
  const [asignandoEntidad, setAsignandoEntidad] = useState(false)

  // Áreas de la entidad seleccionada para ASIGNAR (pestaña Entidades)
  const [areasParaEntidad, setAreasParaEntidad] = useState<Area[]>([])
  const [areaNueva, setAreaNueva] = useState('')
  const [cargandoAreas, setCargandoAreas] = useState(false)

  // Áreas para los DEFAULTS (pestaña Datos)
  const [areasParaDefault, setAreasParaDefault] = useState<Area[]>([])
  const [cargandoAreasDefault, setCargandoAreasDefault] = useState(false)

  // ── Formulario ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    codigo_usuario: '',
    nombre: '',
    telefono: '',
    rol_principal: '',
    grupo_por_defecto: '',
    entidad_por_defecto: '',
    codigo_area_por_defecto: '',
    invitar: true,
  })

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      const [u, r, e] = await Promise.all([usuariosApi.listar(), rolesApi.listar(), entidadesApi.listar()])
      setUsuarios(u)
      setRoles(r)
      setEntidades(e)
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error al cargar usuarios')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const usuariosFiltrados = usuarios.filter((u) =>
    (u.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (u.codigo_usuario || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  // ── Efectos de cascada ─────────────────────────────────────────────────────

  // Áreas para asignar (pestaña Entidades): carga cuando cambia entidadNueva
  useEffect(() => {
    if (!entidadNueva) { setAreasParaEntidad([]); setAreaNueva(''); return }
    setCargandoAreas(true)
    entidadesApi.listarAreas(entidadNueva)
      .then(setAreasParaEntidad)
      .catch(() => setAreasParaEntidad([]))
      .finally(() => setCargandoAreas(false))
    setAreaNueva('')
  }, [entidadNueva])

  // Áreas para default (pestaña Datos): carga cuando cambia entidad_por_defecto en form
  const cargarAreasDefault = useCallback((codigoEntidad: string) => {
    if (!codigoEntidad) { setAreasParaDefault([]); return }
    setCargandoAreasDefault(true)
    entidadesApi.listarAreas(codigoEntidad)
      .then(setAreasParaDefault)
      .catch(() => setAreasParaDefault([]))
      .finally(() => setCargandoAreasDefault(false))
  }, [])

  useEffect(() => {
    cargarAreasDefault(form.entidad_por_defecto)
  }, [form.entidad_por_defecto, cargarAreasDefault])

  // Re-cargar entidades cuando cambie el grupo activo del admin
  useEffect(() => {
    if (grupoActivo && grupoActivo !== grupoAnteriorRef.current) {
      grupoAnteriorRef.current = grupoActivo
      entidadesApi.listar().then(setEntidades).catch(() => setEntidades([]))
      if (usuarioEditando) {
        cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo, usuarioEditando])

  // ── Funciones de carga ─────────────────────────────────────────────────────
  const cargarRolesUsuario = useCallback(async (codigo: string) => {
    setCargandoRoles(true)
    try {
      setRolesUsuario(await usuariosApi.listarRoles(codigo))
    } catch { setRolesUsuario([]) }
    finally { setCargandoRoles(false) }
  }, [])

  const cargarGruposUsuario = useCallback(async (codigo: string) => {
    try {
      setGruposUsuario(await usuariosApi.listarGrupos(codigo))
    } catch { setGruposUsuario([]) }
  }, [])

  const cargarEntidadesUsuario = useCallback(async (codigo: string) => {
    setCargandoEntidades(true)
    try {
      setEntidadesUsuario(await usuariosApi.listarEntidades(codigo))
    } catch { setEntidadesUsuario([]) }
    finally { setCargandoEntidades(false) }
  }, [])

  // ── Abrir modal ────────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setUsuarioEditando(null)
    setForm({ codigo_usuario: '', nombre: '', telefono: '', rol_principal: '',
      grupo_por_defecto: '', entidad_por_defecto: '', codigo_area_por_defecto: '', invitar: true })
    setError('')
    setGuardando(false)
    setTabActiva('datos')
    setRolesUsuario([])
    setGruposUsuario([])
    setEntidadesUsuario([])
    setAreasParaDefault([])
    setModalAbierto(true)
  }

  const abrirEditar = (u: Usuario) => {
    setUsuarioEditando(u)
    setForm({
      codigo_usuario: u.codigo_usuario,
      nombre: u.nombre,
      telefono: u.telefono || '',
      rol_principal: u.rol_principal || '',
      grupo_por_defecto: u.grupo_por_defecto || '',
      entidad_por_defecto: u.entidad_por_defecto || '',
      codigo_area_por_defecto: u.codigo_area_por_defecto || '',
      invitar: false,
    })
    setError('')
    setGuardando(false)
    setTabActiva('datos')
    setRolNuevo('')
    setEntidadNueva('')
    setAreaNueva('')
    setAreasParaEntidad([])
    setAreasParaDefault([])
    cargarRolesUsuario(u.codigo_usuario)
    cargarGruposUsuario(u.codigo_usuario)
    cargarEntidadesUsuario(u.codigo_usuario)
    if (u.entidad_por_defecto) cargarAreasDefault(u.entidad_por_defecto)
    setModalAbierto(true)
  }

  // ── Guardar datos ──────────────────────────────────────────────────────────
  const guardar = async () => {
    setError('')
    if (!form.codigo_usuario || !form.nombre) {
      setError('El correo y el nombre son obligatorios')
      return
    }
    setGuardando(true)
    try {
      if (usuarioEditando) {
        await usuariosApi.actualizar(usuarioEditando.codigo_usuario, {
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          rol_principal: form.rol_principal || undefined,
          grupo_por_defecto: form.grupo_por_defecto || undefined,
          entidad_por_defecto: form.entidad_por_defecto || undefined,
          codigo_area_por_defecto: form.codigo_area_por_defecto || undefined,
        })
      } else {
        await usuariosApi.crear({
          codigo_usuario: form.codigo_usuario,
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          rol_principal: form.rol_principal || undefined,
          invitar: form.invitar,
        })
      }
      setModalAbierto(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  const asignarRol = async () => {
    if (!rolNuevo || !usuarioEditando) return
    setAsignandoRol(true)
    try {
      await usuariosApi.asignarRol(usuarioEditando.codigo_usuario, rolNuevo, grupoActivo || 'ADMIN')
      setRolNuevo('')
      await cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al asignar rol') }
    finally { setAsignandoRol(false) }
  }

  const quitarRol = async (codigoRol: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.quitarRol(usuarioEditando.codigo_usuario, codigoRol)
      await cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al quitar rol') }
  }

  const marcarComoPrincipal = async (codigoRol: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.actualizar(usuarioEditando.codigo_usuario, { rol_principal: codigoRol })
      setForm({ ...form, rol_principal: codigoRol })
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al cambiar rol principal') }
  }

  // ── Entidades ──────────────────────────────────────────────────────────────
  const asignarEntidad = async () => {
    if (!entidadNueva || !usuarioEditando) return
    setAsignandoEntidad(true)
    try {
      await usuariosApi.asignarEntidad(
        usuarioEditando.codigo_usuario,
        entidadNueva,
        grupoActivo,
        areaNueva || undefined,
      )
      setEntidadNueva('')
      setAreaNueva('')
      setAreasParaEntidad([])
      await cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al asignar entidad') }
    finally { setAsignandoEntidad(false) }
  }

  const quitarEntidad = async (codigoEntidad: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.quitarEntidad(usuarioEditando.codigo_usuario, codigoEntidad)
      await cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al quitar entidad') }
  }

  const desactivar = async (u: Usuario) => {
    if (!confirm(`¿Desactivar al usuario ${u.nombre}?`)) return
    try {
      await usuariosApi.desactivar(u.codigo_usuario)
      cargar()
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al desactivar') }
  }

  // ── Listas derivadas ───────────────────────────────────────────────────────
  const rolesDisponibles = roles.filter((r) =>
    r.activo && !rolesUsuario.some((ra) => ra.codigo_rol === r.codigo_rol)
  )

  const entidadesDisponibles = entidades.filter((e) =>
    e.activo !== false &&
    !entidadesUsuario.some((ea) => ea.codigo_entidad === e.codigo_entidad)
  )

  // Grupos únicos del usuario, derivados de sus entidades asignadas
  // (complementa / reemplaza rel_usuario_grupo para el dropdown de defaults)
  const gruposDeEntidades: GrupoAsignado[] = (() => {
    const map = new Map<string, GrupoAsignado>()
    entidadesUsuario.forEach((ea) => {
      if (!map.has(ea.codigo_grupo)) {
        // intentar encontrar el nombre en gruposUsuario; si no, usar el código
        const found = gruposUsuario.find((g) => g.codigo_grupo === ea.codigo_grupo)
        map.set(ea.codigo_grupo, found ?? {
          codigo_grupo: ea.codigo_grupo,
          grupos_entidades: { nombre: ea.codigo_grupo, activo: true },
        })
      }
    })
    // también incluir grupos directos que no tengan entidades aún
    gruposUsuario.forEach((g) => {
      if (!map.has(g.codigo_grupo)) map.set(g.codigo_grupo, g)
    })
    return Array.from(map.values())
  })()

  // Entidades del usuario disponibles para seleccionar como default, filtradas por grupo elegido
  const entidadesParaDefault = form.grupo_por_defecto
    ? entidadesUsuario.filter((ea) => ea.codigo_grupo === form.grupo_por_defecto)
    : entidadesUsuario

  // ── Handlers de cascada en Datos ──────────────────────────────────────────
  const handleGrupoDefaultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm({ ...form, grupo_por_defecto: e.target.value, entidad_por_defecto: '', codigo_area_por_defecto: '' })
    setAreasParaDefault([])
  }

  const handleEntidadDefaultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm({ ...form, entidad_por_defecto: e.target.value, codigo_area_por_defecto: '' })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">Usuarios</h2>
          <p className="text-sm text-texto-muted mt-1">Gestión de usuarios del sistema</p>
        </div>
        <Boton variante="primario" onClick={abrirNuevo}>
          <Plus size={16} />
          Nuevo usuario
        </Boton>
      </div>

      {/* Búsqueda */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          icono={<Search size={15} />}
        />
      </div>

      {errorCarga && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-error">{errorCarga}</p>
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
          ))}
        </div>
      ) : (
        <Tabla>
          <TablaCabecera>
            <tr>
              <TablaTh>Nombre</TablaTh>
              <TablaTh>Correo</TablaTh>
              <TablaTh>Rol principal</TablaTh>
              <TablaTh>Estado</TablaTh>
              <TablaTh>Último acceso</TablaTh>
              <TablaTh className="text-right">Acciones</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {usuariosFiltrados.length === 0 ? (
              <TablaFila>
                <TablaTd className="text-center text-texto-muted py-8" colSpan={6 as never}>
                  No se encontraron usuarios
                </TablaTd>
              </TablaFila>
            ) : (
              usuariosFiltrados.map((u) => (
                <TablaFila key={u.codigo_usuario}>
                  <TablaTd>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-secundario flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.nombre}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-texto-muted">{u.codigo_usuario}</TablaTd>
                  <TablaTd>{u.rol_principal || <span className="text-texto-light">—</span>}</TablaTd>
                  <TablaTd>
                    <Insignia variante={u.activo ? 'exito' : 'error'}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </Insignia>
                  </TablaTd>
                  <TablaTd className="text-texto-muted text-xs">
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-CL') : '—'}
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => desactivar(u)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.activo
                            ? 'hover:bg-red-50 text-texto-muted hover:text-error'
                            : 'hover:bg-green-50 text-texto-muted hover:text-exito'
                        }`}
                        title={u.activo ? 'Desactivar' : 'Activar'}
                      >
                        {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))
            )}
          </TablaCuerpo>
        </Tabla>
      )}

      {/* Modal crear/editar */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={usuarioEditando ? `Editar usuario : ${usuarioEditando.codigo_usuario}` : 'Nuevo usuario'}
        descripcion={usuarioEditando ? undefined : 'El usuario recibirá una invitación por correo'}
      >
        <div className="flex flex-col gap-4">
          {/* Pestañas (solo en edición) */}
          {usuarioEditando && (
            <div className="flex border-b border-borde -mx-1">
              {(['datos', 'roles', 'entidades'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabActiva(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                    tabActiva === tab
                      ? 'border-b-2 border-primario text-primario'
                      : 'text-texto-muted hover:text-texto'
                  }`}
                >
                  {tab === 'datos' ? 'Datos' : tab === 'roles' ? 'Roles del usuario' : 'Entidades'}
                </button>
              ))}
            </div>
          )}

          {/* ── Tab Datos ─────────────────────────────────────────────────── */}
          {tabActiva === 'datos' && (
            <>
              <Input
                etiqueta="Correo electrónico *"
                type="email"
                value={form.codigo_usuario}
                onChange={(e) => setForm({ ...form, codigo_usuario: e.target.value })}
                disabled={!!usuarioEditando}
                placeholder="usuario@correo.com"
              />
              <Input
                etiqueta="Nombre completo *"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre Apellido"
              />

              {/* Teléfono + indicador de verificación */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Teléfono</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Input
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="+56 9 1234 5678"
                    />
                  </div>
                  {usuarioEditando && form.telefono && (
                    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full shrink-0 ${
                      usuarioEditando.fono_verificado
                        ? 'bg-green-50 text-green-700'
                        : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {usuarioEditando.fono_verificado
                        ? <><Phone size={12} /> Verificado</>
                        : <><PhoneOff size={12} /> Sin verificar</>
                      }
                    </div>
                  )}
                </div>
                {usuarioEditando && form.telefono !== (usuarioEditando.telefono || '') && (
                  <p className="text-xs text-yellow-600">Al guardar, se requerirá verificar el nuevo teléfono</p>
                )}
              </div>

              {/* Rol principal — solo roles ya asignados al usuario */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Rol principal</label>
                <select
                  value={form.rol_principal}
                  onChange={(e) => setForm({ ...form, rol_principal: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Sin rol asignado</option>
                  {usuarioEditando
                    ? rolesUsuario.map((ra) => (
                        <option key={ra.codigo_rol} value={ra.codigo_rol}>
                          {ra.roles?.nombre || ra.codigo_rol}
                        </option>
                      ))
                    : roles.filter((r) => r.activo).map((r) => (
                        <option key={r.codigo_rol} value={r.codigo_rol}>{r.nombre}</option>
                      ))
                  }
                </select>
                {usuarioEditando && rolesUsuario.length === 0 && (
                  <p className="text-xs text-texto-muted">Asigne roles en la pestaña &quot;Roles del usuario&quot; primero</p>
                )}
              </div>

              {/* ── Defaults de preferencia (solo edición) ─────────────────── */}
              {usuarioEditando && (
                <>
                  <div className="border-t border-borde pt-3 mt-1">
                    <p className="text-xs font-semibold text-texto-muted uppercase tracking-wide mb-3">
                      Preferencias de inicio de sesión
                    </p>

                    {/* Grupo por defecto — grupos donde el usuario tiene entidades o acceso directo */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-texto">Grupo por defecto</label>
                      <select
                        value={form.grupo_por_defecto}
                        onChange={handleGrupoDefaultChange}
                        className={selectClass}
                      >
                        <option value="">Sin grupo seleccionado</option>
                        {gruposDeEntidades.map((g) => (
                          <option key={g.codigo_grupo} value={g.codigo_grupo}>
                            {g.grupos_entidades?.nombre || g.codigo_grupo}
                          </option>
                        ))}
                      </select>
                      {gruposDeEntidades.length === 0 && (
                        <p className="text-xs text-texto-muted">Asigne entidades en la pestaña &quot;Entidades&quot; primero</p>
                      )}
                    </div>

                    {/* Entidad por defecto — solo entidades del usuario en su grupo */}
                    <div className="flex flex-col gap-1.5 mt-3">
                      <label className="text-sm font-medium text-texto">Entidad por defecto</label>
                      <select
                        value={form.entidad_por_defecto}
                        onChange={handleEntidadDefaultChange}
                        disabled={!form.grupo_por_defecto}
                        className={selectClass}
                      >
                        <option value="">Sin entidad seleccionada</option>
                        {entidadesParaDefault.map((ea) => (
                          <option key={ea.codigo_entidad} value={ea.codigo_entidad}>
                            {ea.entidades?.nombre || ea.codigo_entidad}
                          </option>
                        ))}
                      </select>
                      {form.grupo_por_defecto && entidadesParaDefault.length === 0 && (
                        <p className="text-xs text-texto-muted">Asigne entidades en la pestaña &quot;Entidades&quot; primero</p>
                      )}
                    </div>

                    {/* Área por defecto — solo áreas de la entidad seleccionada */}
                    {form.entidad_por_defecto && (
                      <div className="flex flex-col gap-1.5 mt-3">
                        <label className="text-sm font-medium text-texto">Área por defecto <span className="text-texto-muted font-normal">(opcional)</span></label>
                        <select
                          value={form.codigo_area_por_defecto}
                          onChange={(e) => setForm({ ...form, codigo_area_por_defecto: e.target.value })}
                          disabled={cargandoAreasDefault}
                          className={selectClass}
                        >
                          <option value="">Sin área</option>
                          {areasParaDefault.map((a) => (
                            <option key={a.codigo_area} value={a.codigo_area}>{a.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
                <Boton variante="primario" onClick={guardar} cargando={guardando}>
                  {usuarioEditando ? 'Guardar cambios' : 'Crear usuario'}
                </Boton>
              </div>
            </>
          )}

          {/* ── Tab Roles del usuario ─────────────────────────────────────── */}
          {tabActiva === 'roles' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {/* Asignar nuevo rol */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    value={rolNuevo}
                    onChange={(e) => setRolNuevo(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Seleccionar rol...</option>
                    {rolesDisponibles.map((r) => (
                      <option key={r.codigo_rol} value={r.codigo_rol}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
                <Boton variante="primario" onClick={asignarRol} cargando={asignandoRol} disabled={!rolNuevo}>
                  <Plus size={14} /> Asignar
                </Boton>
              </div>

              {/* Lista de roles asignados */}
              {cargandoRoles ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}
                </div>
              ) : rolesUsuario.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tiene roles adicionales asignados</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {rolesUsuario.map((ra) => {
                    const esPrincipal = form.rol_principal === ra.codigo_rol
                    return (
                      <div
                        key={ra.codigo_rol}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border bg-surface ${
                          esPrincipal ? 'border-primario bg-primario-muy-claro' : 'border-borde'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-texto">{ra.roles?.nombre || ra.codigo_rol}</span>
                          <span className="text-xs text-texto-muted">{ra.codigo_rol}</span>
                          {esPrincipal && (
                            <span className="text-xs bg-primario text-white px-1.5 py-0.5 rounded">Principal</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!esPrincipal && (
                            <button
                              onClick={() => marcarComoPrincipal(ra.codigo_rol)}
                              className="p-1 rounded hover:bg-yellow-50 text-texto-muted hover:text-yellow-600 transition-colors"
                              title="Marcar como rol principal"
                            >
                              <Star size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => quitarRol(ra.codigo_rol)}
                            className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                            title="Quitar rol"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>Cerrar</Boton>
              </div>
            </div>
          )}

          {/* ── Tab Entidades ─────────────────────────────────────────────── */}
          {tabActiva === 'entidades' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {/* Asignar nueva entidad */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <select
                      value={entidadNueva}
                      onChange={(e) => setEntidadNueva(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Seleccionar entidad...</option>
                      {entidadesDisponibles.map((e) => (
                        <option key={e.codigo_entidad} value={e.codigo_entidad}>{e.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <Boton
                    variante="primario"
                    onClick={asignarEntidad}
                    cargando={asignandoEntidad}
                    disabled={!entidadNueva}
                  >
                    <Plus size={14} /> Asignar
                  </Boton>
                </div>
                {/* Selector de área (opcional) */}
                {entidadNueva && (
                  <select
                    value={areaNueva}
                    onChange={(e) => setAreaNueva(e.target.value)}
                    disabled={cargandoAreas}
                    className={selectClass}
                  >
                    <option value="">Área (opcional)...</option>
                    {areasParaEntidad.map((a) => (
                      <option key={a.codigo_area} value={a.codigo_area}>{a.nombre}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Lista de entidades asignadas */}
              {cargandoEntidades ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}
                </div>
              ) : entidadesUsuario.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tiene entidades asignadas</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {entidadesUsuario.map((ea) => (
                    <div
                      key={ea.codigo_entidad}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-texto">
                          {ea.entidades?.nombre || ea.codigo_entidad}
                        </span>
                        <span className="ml-2 text-xs text-texto-muted">{ea.codigo_entidad}</span>
                        {ea.codigo_area && (
                          <span className="ml-2 text-xs bg-secundario/10 text-secundario px-1.5 py-0.5 rounded">
                            {ea.codigo_area}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => quitarEntidad(ea.codigo_entidad)}
                        className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors shrink-0"
                        title="Quitar entidad"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>Cerrar</Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
