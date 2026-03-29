'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, UserCheck, UserX, X, Star } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { usuariosApi, rolesApi, entidadesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Usuario, Rol, Entidad } from '@/lib/tipos'

type RolAsignado = { codigo_rol: string; roles: { nombre: string; activo: boolean } }
type EntidadAsignada = { codigo_entidad: string; entidades: { nombre: string; activo: boolean } }

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

  // Roles del usuario en edición
  const [rolesUsuario, setRolesUsuario] = useState<RolAsignado[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [rolNuevo, setRolNuevo] = useState('')
  const [asignandoRol, setAsignandoRol] = useState(false)

  // Entidades del usuario en edición
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [entidadesUsuario, setEntidadesUsuario] = useState<EntidadAsignada[]>([])
  const [cargandoEntidades, setCargandoEntidades] = useState(false)
  const [entidadNueva, setEntidadNueva] = useState('')
  const [asignandoEntidad, setAsignandoEntidad] = useState(false)

  // Formulario
  const [form, setForm] = useState({
    codigo_usuario: '',
    nombre: '',
    telefono: '',
    rol_principal: '',
    invitar: true,
  })

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

  const abrirNuevo = () => {
    setUsuarioEditando(null)
    setForm({ codigo_usuario: '', nombre: '', telefono: '', rol_principal: '', invitar: true })
    setError('')
    setTabActiva('datos')
    setModalAbierto(true)
  }

  const cargarRolesUsuario = useCallback(async (codigo: string) => {
    setCargandoRoles(true)
    try {
      const r = await usuariosApi.listarRoles(codigo)
      setRolesUsuario(r)
    } catch {
      setRolesUsuario([])
    } finally {
      setCargandoRoles(false)
    }
  }, [])

  const cargarEntidadesUsuario = useCallback(async (codigo: string) => {
    setCargandoEntidades(true)
    try {
      const e = await usuariosApi.listarEntidades(codigo)
      setEntidadesUsuario(e)
    } catch {
      setEntidadesUsuario([])
    } finally {
      setCargandoEntidades(false)
    }
  }, [])

  // Re-cargar entidades cuando cambie el grupo activo
  useEffect(() => {
    if (grupoActivo && grupoActivo !== grupoAnteriorRef.current) {
      grupoAnteriorRef.current = grupoActivo
      entidadesApi.listar().then(setEntidades).catch(() => setEntidades([]))
      if (usuarioEditando) {
        cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
      }
    }
  }, [grupoActivo, usuarioEditando, cargarEntidadesUsuario])

  const abrirEditar = (u: Usuario) => {
    setUsuarioEditando(u)
    setForm({
      codigo_usuario: u.codigo_usuario,
      nombre: u.nombre,
      telefono: u.telefono || '',
      rol_principal: u.rol_principal || '',
      invitar: false,
    })
    setError('')
    setTabActiva('datos')
    setRolNuevo('')
    setEntidadNueva('')
    cargarRolesUsuario(u.codigo_usuario)
    cargarEntidadesUsuario(u.codigo_usuario)
    setModalAbierto(true)
  }

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

  const asignarRol = async () => {
    if (!rolNuevo || !usuarioEditando) return
    setAsignandoRol(true)
    try {
      await usuariosApi.asignarRol(usuarioEditando.codigo_usuario, rolNuevo)
      setRolNuevo('')
      cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar rol')
    } finally {
      setAsignandoRol(false)
    }
  }

  const quitarRol = async (codigoRol: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.quitarRol(usuarioEditando.codigo_usuario, codigoRol)
      cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar rol')
    }
  }

  const asignarEntidad = async () => {
    if (!entidadNueva || !usuarioEditando) return
    setAsignandoEntidad(true)
    try {
      await usuariosApi.asignarEntidad(usuarioEditando.codigo_usuario, entidadNueva, grupoActivo)
      setEntidadNueva('')
      cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar entidad')
    } finally {
      setAsignandoEntidad(false)
    }
  }

  const quitarEntidad = async (codigoEntidad: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.quitarEntidad(usuarioEditando.codigo_usuario, codigoEntidad)
      cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar entidad')
    }
  }

  const desactivar = async (u: Usuario) => {
    if (!confirm(`¿Desactivar al usuario ${u.nombre}?`)) return
    try {
      await usuariosApi.desactivar(u.codigo_usuario)
      cargar()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al desactivar')
    }
  }

  // Roles disponibles para asignar (excluir solo los ya asignados en rel_usuario_rol)
  const rolesDisponibles = roles.filter((r) =>
    r.activo &&
    !rolesUsuario.some((ra) => ra.codigo_rol === r.codigo_rol)
  )

  // Marcar un rol asignado como principal
  const marcarComoPrincipal = async (codigoRol: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.actualizar(usuarioEditando.codigo_usuario, { rol_principal: codigoRol })
      setForm({ ...form, rol_principal: codigoRol })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar rol principal')
    }
  }

  // Entidades disponibles para asignar (excluir las ya asignadas)
  const entidadesDisponibles = entidades.filter((e) =>
    e.activo !== false &&
    !entidadesUsuario.some((ea) => ea.codigo_entidad === e.codigo_entidad)
  )

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

      {/* Error de carga */}
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
                    {u.ultimo_acceso
                      ? new Date(u.ultimo_acceso).toLocaleDateString('es-CL')
                      : '—'}
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
              <button
                onClick={() => setTabActiva('datos')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabActiva === 'datos'
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                Datos
              </button>
              <button
                onClick={() => setTabActiva('roles')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabActiva === 'roles'
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                Roles del usuario
              </button>
              <button
                onClick={() => setTabActiva('entidades')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabActiva === 'entidades'
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                Entidades
              </button>
            </div>
          )}

          {/* Tab Datos */}
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
              <Input
                etiqueta="Teléfono"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+56 9 1234 5678"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Rol principal</label>
                <select
                  value={form.rol_principal}
                  onChange={(e) => setForm({ ...form, rol_principal: e.target.value })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
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

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </Boton>
                <Boton variante="primario" onClick={guardar} cargando={guardando}>
                  {usuarioEditando ? 'Guardar cambios' : 'Crear usuario'}
                </Boton>
              </div>
            </>
          )}

          {/* Tab Roles del usuario */}
          {tabActiva === 'roles' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {/* Asignar nuevo rol */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    value={rolNuevo}
                    onChange={(e) => setRolNuevo(e.target.value)}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  >
                    <option value="">Seleccionar rol...</option>
                    {rolesDisponibles.map((r) => (
                      <option key={r.codigo_rol} value={r.codigo_rol}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
                <Boton
                  variante="primario"
                  onClick={asignarRol}
                  cargando={asignandoRol}
                  disabled={!rolNuevo}
                >
                  <Plus size={14} />
                  Asignar
                </Boton>
              </div>

              {/* Lista de roles asignados */}
              {cargandoRoles ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />
                  ))}
                </div>
              ) : rolesUsuario.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">
                  No tiene roles adicionales asignados
                </p>
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
                          <span className="text-sm font-medium text-texto">
                            {ra.roles?.nombre || ra.codigo_rol}
                          </span>
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
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>
                  Cerrar
                </Boton>
              </div>
            </div>
          )}

          {/* Tab Entidades */}
          {tabActiva === 'entidades' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {/* Asignar nueva entidad */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    value={entidadNueva}
                    onChange={(e) => setEntidadNueva(e.target.value)}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
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
                  <Plus size={14} />
                  Asignar
                </Boton>
              </div>

              {/* Lista de entidades asignadas */}
              {cargandoEntidades ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />
                  ))}
                </div>
              ) : entidadesUsuario.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">
                  No tiene entidades asignadas
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {entidadesUsuario.map((ea) => (
                    <div
                      key={ea.codigo_entidad}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"
                    >
                      <div>
                        <span className="text-sm font-medium text-texto">
                          {ea.entidades?.nombre || ea.codigo_entidad}
                        </span>
                        <span className="ml-2 text-xs text-texto-muted">{ea.codigo_entidad}</span>
                      </div>
                      <button
                        onClick={() => quitarEntidad(ea.codigo_entidad)}
                        className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
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
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>
                  Cerrar
                </Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
