'use client'

/**
 * Pantalla de Usuario Semilla
 *
 * Permite al super-admin crear/gestionar el usuario administrador inicial
 * (semilla) de cada grupo. A diferencia de /usuarios, esta pantalla:
 *  - Lista TODOS los usuarios del sistema sin filtro de grupo.
 *  - El selector de grupo del usuario es libre (no está atado al grupoActivo).
 *  - Al cambiar grupo en el formulario, recarga entidades de ese grupo.
 *  - Solo accesible para super-admin (grupo ADMIN).
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Search, Trash2, X, Star, ChevronUp, ChevronDown } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { usuariosApi, gruposApi, entidadesApi, rolesApi, aplicacionesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Usuario, Grupo, Entidad, Rol, Aplicacion, Area } from '@/lib/tipos'

type RolAsignado = {
  codigo_grupo: string
  id_rol: number
  codigo_rol?: string
  orden: number
  roles?: { nombre: string; codigo_rol: string; codigo_grupo: string | null; codigo_aplicacion_origen?: string | null } | null
}

export default function PaginaUsuariosSemilla() {
  const { usuario: usuarioActual, esSuperAdmin } = useAuth()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Catálogos
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])

  // Entidades y áreas dinámicas (según grupo seleccionado en el form)
  const [entidadesGrupo, setEntidadesGrupo] = useState<Entidad[]>([])
  const [areasEntidad, setAreasEntidad] = useState<Area[]>([])
  const [cargandoEntidades, setCargandoEntidades] = useState(false)
  const [cargandoAreas, setCargandoAreas] = useState(false)

  // Roles del grupo seleccionado en el form
  const [rolesGrupo, setRolesGrupo] = useState<Rol[]>([])

  // Aplicaciones disponibles para el grupo seleccionado
  const [appsGrupo, setAppsGrupo] = useState<Aplicacion[]>([])

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState({
    codigo_usuario: '',
    nombre: '',
    alias: '',
    telefono: '',
    descripcion: '',
    grupo_por_defecto: '',
    entidad_por_defecto: '',
    codigo_ubicacion_area_por_defecto: '',
    id_rol_principal: '',
    aplicacion_por_defecto: '',
    invitar: true,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Tab del modal
  const [tabActiva, setTabActiva] = useState<'datos' | 'roles'>('datos')

  // Roles del usuario (tab Roles)
  const [rolesUsuario, setRolesUsuario] = useState<RolAsignado[]>([])
  const [cargandoRolesUsuario, setCargandoRolesUsuario] = useState(false)
  const [rolNuevo, setRolNuevo] = useState('')
  const [busquedaRol, setBusquedaRol] = useState('')
  const [dropdownRolAbierto, setDropdownRolAbierto] = useState(false)
  const dropdownRolRef = useRef<HTMLDivElement>(null)
  const [asignandoRol, setAsignandoRol] = useState(false)
  // Flag para evitar que el useEffect de grupo limpie campos al abrir modal de edición
  const inicializandoFormRef = useRef(false)

  // Confirmación de eliminación
  const [confirmarEliminar, setConfirmarEliminar] = useState<Usuario | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga inicial ─────────────────────────────────────────────────────────
  const cargarUsuarios = useCallback(async () => {
    setCargando(true)
    try {
      const u = await usuariosApi.listarTodos({ activo: undefined })
      setUsuarios(u)
    } catch {
      setUsuarios([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarUsuarios()
    Promise.all([
      gruposApi.listar(),
      rolesApi.listar(),
      aplicacionesApi.listar(),
    ]).then(([g, r, a]) => {
      setGrupos(g)
      setRoles(r)
      setAplicaciones(a)
    }).catch(() => {})
  }, [cargarUsuarios])

  // ── Cascada: grupo → entidades, roles, apps ───────────────────────────────
  useEffect(() => {
    const grupo = form.grupo_por_defecto
    if (!grupo) {
      setEntidadesGrupo([])
      setAreasEntidad([])
      setRolesGrupo([])
      setAppsGrupo([])
      return
    }
    setCargandoEntidades(true)
    gruposApi.listarEntidades(grupo)
      .then(setEntidadesGrupo)
      .catch(() => setEntidadesGrupo([]))
      .finally(() => setCargandoEntidades(false))

    // Roles disponibles para el grupo (incluye globales)
    rolesApi.listar(grupo, true)
      .then(setRolesGrupo)
      .catch(() => setRolesGrupo([]))

    // Apps habilitadas para el grupo
    aplicacionesApi.listar(grupo)
      .then(setAppsGrupo)
      .catch(() => setAppsGrupo([]))

    // Limpiar entidad/área/app si cambia el grupo (pero NO al inicializar el modal de edición)
    if (!inicializandoFormRef.current) {
      setForm((f) => ({ ...f, entidad_por_defecto: '', codigo_ubicacion_area_por_defecto: '', id_rol_principal: '', aplicacion_por_defecto: '' }))
      setAreasEntidad([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.grupo_por_defecto])

  // Cascada: entidad → áreas
  useEffect(() => {
    const entidad = form.entidad_por_defecto
    if (!entidad) { setAreasEntidad([]); return }
    setCargandoAreas(true)
    entidadesApi.listarAreas(entidad)
      .then(setAreasEntidad)
      .catch(() => setAreasEntidad([]))
      .finally(() => setCargandoAreas(false))
    // No limpiar área al inicializar el modal de edición
    if (!inicializandoFormRef.current) {
      setForm((f) => ({ ...f, codigo_ubicacion_area_por_defecto: '' }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.entidad_por_defecto])

  // ── Abrir modal ────────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setUsuarioEditando(null)
    setForm({ codigo_usuario: '', nombre: '', alias: '', telefono: '', descripcion: '',
      grupo_por_defecto: '', entidad_por_defecto: '', codigo_ubicacion_area_por_defecto: '',
      id_rol_principal: '', aplicacion_por_defecto: '', invitar: true })
    setError('')
    setEntidadesGrupo([])
    setAreasEntidad([])
    setRolesUsuario([])
    setTabActiva('datos')
    setModalAbierto(true)
  }

  const abrirEditar = (u: Usuario) => {
    // Evitar que el useEffect de grupo limpie los campos al inicializar
    inicializandoFormRef.current = true
    setUsuarioEditando(u)
    setForm({
      codigo_usuario: u.codigo_usuario,
      nombre: u.nombre,
      alias: u.alias || '',
      telefono: u.telefono || '',
      descripcion: u.descripcion || '',
      grupo_por_defecto: u.grupo_por_defecto || '',
      entidad_por_defecto: u.entidad_por_defecto || '',
      codigo_ubicacion_area_por_defecto: u.codigo_ubicacion_area_por_defecto || '',
      id_rol_principal: u.id_rol_principal != null ? String(u.id_rol_principal) : '',
      aplicacion_por_defecto: u.aplicacion_por_defecto || '',
      invitar: false,
    })
    // El flag se baja en el siguiente tick (después de que el useEffect haya corrido)
    setTimeout(() => { inicializandoFormRef.current = false }, 0)
    setError('')
    setTabActiva('datos')
    cargarRolesUsuario(u.codigo_usuario)
    setModalAbierto(true)
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  const guardar = async () => {
    setError('')
    if (!form.codigo_usuario || !form.nombre) {
      setError('El correo y el nombre son obligatorios')
      return
    }
    if (!form.grupo_por_defecto) {
      setError('El grupo por defecto es obligatorio para el usuario semilla')
      return
    }
    setGuardando(true)
    try {
      const datos = {
        nombre: form.nombre,
        alias: form.alias || undefined,
        telefono: form.telefono || undefined,
        descripcion: form.descripcion || undefined,
        grupo_por_defecto: form.grupo_por_defecto || undefined,
        entidad_por_defecto: form.entidad_por_defecto || undefined,
        codigo_ubicacion_area_por_defecto: form.codigo_ubicacion_area_por_defecto || undefined,
        id_rol_principal: form.id_rol_principal ? Number(form.id_rol_principal) : null,
        aplicacion_por_defecto: form.aplicacion_por_defecto || undefined,
      }
      if (usuarioEditando) {
        await usuariosApi.actualizar(usuarioEditando.codigo_usuario, datos)
      } else {
        await usuariosApi.crear({
          codigo_usuario: form.codigo_usuario,
          ...datos,
          invitar: form.invitar,
        })
      }
      setModalAbierto(false)
      cargarUsuarios()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEliminar = async () => {
    if (!confirmarEliminar) return
    setEliminando(true)
    try {
      await usuariosApi.eliminar(confirmarEliminar.codigo_usuario)
      setConfirmarEliminar(null)
      cargarUsuarios()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
      setConfirmarEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  // ── Roles del usuario ──────────────────────────────────────────────────────
  const cargarRolesUsuario = useCallback(async (codigo: string) => {
    setCargandoRolesUsuario(true)
    try {
      setRolesUsuario(await usuariosApi.listarRoles(codigo))
    } catch { setRolesUsuario([]) }
    finally { setCargandoRolesUsuario(false) }
  }, [])

  const asignarRol = async () => {
    if (!rolNuevo || !usuarioEditando || !form.grupo_por_defecto) return
    setAsignandoRol(true)
    try {
      await usuariosApi.asignarRol(usuarioEditando.codigo_usuario, Number(rolNuevo), form.grupo_por_defecto)
      setRolNuevo('')
      setBusquedaRol('')
      await cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al asignar rol') }
    finally { setAsignandoRol(false) }
  }

  const quitarRol = async (idRol: number) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.quitarRol(usuarioEditando.codigo_usuario, idRol)
      await cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al quitar rol') }
  }

  const moverRol = async (filteredIndex: number, direccion: 'arriba' | 'abajo') => {
    if (!usuarioEditando) return
    const grupo = form.grupo_por_defecto
    const rolesFiltrados = rolesUsuario.filter((r) => r.codigo_grupo === grupo)
    const swapIdx = direccion === 'arriba' ? filteredIndex - 1 : filteredIndex + 1
    if (swapIdx < 0 || swapIdx >= rolesFiltrados.length) return
    const rolA = rolesFiltrados[filteredIndex]
    const rolB = rolesFiltrados[swapIdx]
    const realA = rolesUsuario.findIndex((r) => r.codigo_grupo === rolA.codigo_grupo && r.id_rol === rolA.id_rol)
    const realB = rolesUsuario.findIndex((r) => r.codigo_grupo === rolB.codigo_grupo && r.id_rol === rolB.id_rol)
    if (realA === -1 || realB === -1) return
    const lista = [...rolesUsuario]
    const ordenA = lista[realA].orden; const ordenB = lista[realB].orden
    lista[realA].orden = ordenB; lista[realB].orden = ordenA
    ;[lista[realA], lista[realB]] = [lista[realB], lista[realA]]
    setRolesUsuario(lista)
    try {
      await usuariosApi.reordenarRoles(usuarioEditando.codigo_usuario, lista.map((r) => ({
        codigo_grupo: r.codigo_grupo, id_rol: r.id_rol, orden: r.orden,
      })))
    } catch {
      cargarRolesUsuario(usuarioEditando.codigo_usuario)
    }
  }

  const marcarComoPrincipal = async (idRol: number) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.actualizar(usuarioEditando.codigo_usuario, { id_rol_principal: idRol })
      setForm({ ...form, id_rol_principal: String(idRol) })
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al cambiar rol principal') }
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRolRef.current && !dropdownRolRef.current.contains(e.target as Node)) setDropdownRolAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Roles disponibles para asignar (en el grupo del formulario)
  // Grupo RESTRINGIDO → solo roles RESTRINGIDO; Grupo NORMAL → solo roles NORMAL
  const grupoForm = form.grupo_por_defecto
  const mapaAppNombre = Object.fromEntries(aplicaciones.map((a) => [a.codigo_aplicacion, a.nombre]))
  const tipoGrupoForm = grupos.find((g) => g.codigo_grupo === grupoForm)?.tipo || 'NORMAL'
  const rolesDisponibles = rolesGrupo
    .filter((r) =>
      (r.codigo_grupo === grupoForm || r.codigo_grupo == null) &&
      !rolesUsuario.some((ra) => ra.codigo_grupo === grupoForm && ra.id_rol === r.id_rol) &&
      (r.tipo || 'NORMAL') === tipoGrupoForm
    )
    .sort((a, b) => {
      const na = a.codigo_aplicacion_origen ? (mapaAppNombre[a.codigo_aplicacion_origen] || a.codigo_aplicacion_origen) : ''
      const nb = b.codigo_aplicacion_origen ? (mapaAppNombre[b.codigo_aplicacion_origen] || b.codigo_aplicacion_origen) : ''
      const sa = na ? 0 : 1; const sb = nb ? 0 : 1
      if (sa !== sb) return sa - sb
      if (na !== nb) return na.localeCompare(nb, 'es')
      return a.nombre.localeCompare(b.nombre, 'es')
    })
  const rolesDisponiblesFiltrados = rolesDisponibles.filter((r) =>
    busquedaRol.length === 0 ||
    r.nombre.toLowerCase().includes(busquedaRol.toLowerCase()) ||
    r.codigo_rol.toLowerCase().includes(busquedaRol.toLowerCase())
  )

  // ── Filtros ────────────────────────────────────────────────────────────────
  const usuariosFiltrados = usuarios.filter((u) =>
    busqueda.length === 0 ||
    u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.codigo_usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
    (u.grupo_por_defecto || '').toLowerCase().includes(busqueda.toLowerCase())
  ).sort((a, b) => {
    // Ordenar por grupo luego nombre
    const ga = a.grupo_por_defecto || ''
    const gb = b.grupo_por_defecto || ''
    return ga !== gb ? ga.localeCompare(gb) : a.nombre.localeCompare(b.nombre)
  })

  // Nombre del grupo para mostrar en la tabla
  const nombreGrupo = (codigo?: string) => grupos.find((g) => g.codigo_grupo === codigo)?.nombre || codigo || '—'

  if (!esSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
        Solo el super-administrador puede acceder a esta seccion.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">Usuarios Semilla</h2>
          <p className="text-sm text-texto-muted mt-1">
            Gestión global de usuarios administradores iniciales por grupo. Sin filtro de grupo activo.
          </p>
        </div>
        <Boton variante="primario" onClick={abrirNuevo}><Plus size={16} />Nuevo usuario semilla</Boton>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
        <input
          type="text"
          placeholder="Buscar por nombre, correo o grupo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
        />
      </div>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>Nombre</TablaTh>
            <TablaTh>Correo</TablaTh>
            <TablaTh>Grupo por defecto</TablaTh>
            <TablaTh>Tipo grupo</TablaTh>
            <TablaTh>Estado</TablaTh>
            <TablaTh className="text-right">Acciones</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>Cargando...</TablaTd>
            </TablaFila>
          ) : usuariosFiltrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>No se encontraron usuarios</TablaTd>
            </TablaFila>
          ) : usuariosFiltrados.map((u) => {
            const grupoInfo = grupos.find((g) => g.codigo_grupo === u.grupo_por_defecto)
            return (
              <TablaFila key={u.codigo_usuario}>
                <TablaTd className="font-medium">{u.nombre}</TablaTd>
                <TablaTd className="text-sm text-texto-muted">{u.codigo_usuario}</TablaTd>
                <TablaTd>{u.grupo_por_defecto ? <span className="text-sm">{nombreGrupo(u.grupo_por_defecto)}</span> : <span className="text-texto-muted">—</span>}</TablaTd>
                <TablaTd>
                  {grupoInfo?.tipo === 'RESTRINGIDO'
                    ? <Insignia variante="advertencia">Restringido</Insignia>
                    : grupoInfo
                      ? <Insignia variante="primario">Normal</Insignia>
                      : <span className="text-texto-muted text-sm">—</span>
                  }
                </TablaTd>
                <TablaTd><Insignia variante={u.activo ? 'exito' : 'error'}>{u.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
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
                      onClick={() => setConfirmarEliminar(u)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                      title="Eliminar"
                      disabled={u.codigo_usuario === usuarioActual?.codigo_usuario}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </TablaTd>
              </TablaFila>
            )
          })}
        </TablaCuerpo>
      </Tabla>

      {/* Modal usuario semilla */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={usuarioEditando ? `Editar: ${usuarioEditando.nombre}` : 'Nuevo usuario semilla'}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
          {/* Tabs (solo si editando) */}
          {usuarioEditando && (
            <div className="flex gap-1 border-b border-borde -mt-2">
              {(['datos', 'roles'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTabActiva(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tabActiva === t
                      ? 'border-primario text-primario'
                      : 'border-transparent text-texto-muted hover:text-texto'
                  }`}
                >
                  {t === 'datos' ? 'Datos' : `Roles (${rolesUsuario.filter((ra) => ra.codigo_grupo === form.grupo_por_defecto).length})`}
                </button>
              ))}
            </div>
          )}

          {tabActiva === 'datos' && (
            <>
          <p className="text-sm text-texto-muted bg-fondo border border-borde rounded-lg px-4 py-3">
            Este formulario no filtra por grupo activo. El usuario semilla puede pertenecer a cualquier grupo del sistema.
          </p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Email — solo al crear */}
            {!usuarioEditando ? (
              <Input
                etiqueta="Correo (login) *"
                type="email"
                value={form.codigo_usuario}
                onChange={(e) => setForm({ ...form, codigo_usuario: e.target.value.toLowerCase() })}
                placeholder="admin@grupo.cl"
              />
            ) : (
              <Input etiqueta="Correo" value={form.codigo_usuario} disabled readOnly />
            )}

            <Input
              etiqueta="Nombre completo *"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Juan Pérez"
            />
            <Input
              etiqueta="Alias"
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              placeholder="Juan"
            />
            <Input
              etiqueta="Teléfono"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="+56 9 1234 5678"
            />
          </div>

          {/* Grupo — selector libre de todos los grupos */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">Grupo por defecto *</label>
            <select
              value={form.grupo_por_defecto}
              onChange={(e) => setForm({ ...form, grupo_por_defecto: e.target.value })}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
            >
              <option value="">— Seleccionar grupo —</option>
              {grupos.sort((a, b) => {
                const to = (t?: string) => t === 'RESTRINGIDO' ? 1 : 0
                return to(a.tipo) - to(b.tipo) || a.nombre.localeCompare(b.nombre)
              }).map((g) => (
                <option key={g.codigo_grupo} value={g.codigo_grupo}>
                  {g.nombre} {g.tipo === 'RESTRINGIDO' ? '(Restringido)' : ''} — {g.codigo_grupo}
                </option>
              ))}
            </select>
          </div>

          {/* Entidad por defecto — filtrada al grupo */}
          {form.grupo_por_defecto && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Entidad por defecto</label>
                <select
                  value={form.entidad_por_defecto}
                  onChange={(e) => setForm({ ...form, entidad_por_defecto: e.target.value })}
                  disabled={cargandoEntidades}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
                >
                  <option value="">— Seleccionar entidad —</option>
                  {entidadesGrupo.map((e) => (
                    <option key={e.codigo_entidad} value={e.codigo_entidad}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Área por defecto</label>
                <select
                  value={form.codigo_ubicacion_area_por_defecto}
                  onChange={(e) => setForm({ ...form, codigo_ubicacion_area_por_defecto: e.target.value })}
                  disabled={!form.entidad_por_defecto || cargandoAreas}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
                >
                  <option value="">— Sin área —</option>
                  {areasEntidad.map((a) => (
                    <option key={a.codigo_area} value={a.codigo_area}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Rol principal — filtrado al grupo */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Rol principal</label>
                <select
                  value={form.id_rol_principal}
                  onChange={(e) => setForm({ ...form, id_rol_principal: e.target.value })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                >
                  <option value="">— Sin rol —</option>
                  {rolesGrupo.map((r) => (
                    <option key={r.id_rol} value={r.id_rol}>
                      {r.nombre} {r.codigo_grupo == null ? '[Global]' : ''} {r.tipo === 'RESTRINGIDO' ? '★' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aplicación por defecto */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Aplicación por defecto</label>
                <select
                  value={form.aplicacion_por_defecto}
                  onChange={(e) => setForm({ ...form, aplicacion_por_defecto: e.target.value })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                >
                  <option value="">— Sin aplicación —</option>
                  {(appsGrupo.length > 0 ? appsGrupo : aplicaciones).map((a) => (
                    <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Invitar — solo al crear */}
          {!usuarioEditando && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.invitar}
                onChange={(e) => setForm({ ...form, invitar: e.target.checked })}
                className="w-4 h-4 rounded border-borde text-primario focus:ring-primario"
              />
              <span className="text-sm text-texto">Enviar invitación por correo al crear</span>
            </label>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>
              {usuarioEditando ? 'Guardar' : 'Crear usuario semilla'}
            </Boton>
          </div>
            </>
          )}

          {/* ── Tab Roles ─────────────────────────────────────────────── */}
          {tabActiva === 'roles' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {!form.grupo_por_defecto ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-yellow-700">
                    Debe seleccionar un grupo por defecto en la pestaña &quot;Datos&quot; antes de asignar roles.
                  </p>
                </div>
              ) : (
                <>
                  {/* Asignar nuevo rol */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative" ref={dropdownRolRef}>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                        <input
                          type="text"
                          placeholder="Buscar rol por nombre o código..."
                          value={busquedaRol}
                          onChange={(e) => { setBusquedaRol(e.target.value); setDropdownRolAbierto(true); setRolNuevo('') }}
                          onFocus={() => setDropdownRolAbierto(true)}
                          className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                        />
                      </div>
                      {dropdownRolAbierto && (
                        <div className="absolute z-50 w-full bottom-full mb-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {rolesDisponiblesFiltrados.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-texto-muted">No se encontraron roles</div>
                          ) : rolesDisponiblesFiltrados.slice(0, 20).map((r) => (
                            <button
                              key={r.id_rol}
                              onClick={() => {
                                setRolNuevo(String(r.id_rol))
                                setBusquedaRol(`${r.nombre} (${r.codigo_rol})${r.codigo_grupo == null ? ' [Global]' : ''}`)
                                setDropdownRolAbierto(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors"
                            >
                              <span className="font-medium">{r.nombre}</span>
                              <span className="ml-2 text-texto-muted text-xs">{r.codigo_rol}</span>
                              {r.codigo_grupo == null && <span className="ml-2 text-xs bg-primario/10 text-primario px-1.5 py-0.5 rounded">Global</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Boton variante="primario" onClick={asignarRol} cargando={asignandoRol} disabled={!rolNuevo}>
                      <Plus size={14} /> Asignar
                    </Boton>
                  </div>

                  {/* Lista de roles asignados */}
                  {cargandoRolesUsuario ? (
                    <div className="flex flex-col gap-2">
                      {[1, 2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}
                    </div>
                  ) : rolesUsuario.filter((ra) => ra.codigo_grupo === form.grupo_por_defecto).length === 0 ? (
                    <p className="text-sm text-texto-muted text-center py-4">No tiene roles asignados en este grupo</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {rolesUsuario.filter((ra) => ra.codigo_grupo === form.grupo_por_defecto).map((ra, idx, arr) => {
                        const esPrincipal = form.id_rol_principal === String(ra.id_rol)
                        const codigoRolDisplay = ra.codigo_rol || ra.roles?.codigo_rol || `id ${ra.id_rol}`
                        return (
                          <div
                            key={`${ra.codigo_grupo}_${ra.id_rol}`}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-surface ${
                              esPrincipal ? 'border-primario bg-primario-muy-claro' : 'border-borde'
                            }`}
                          >
                            <div className="flex flex-col">
                              <button
                                onClick={() => moverRol(idx, 'arriba')}
                                disabled={idx === 0}
                                className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Subir"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => moverRol(idx, 'abajo')}
                                disabled={idx === arr.length - 1}
                                className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Bajar"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="text-sm font-medium text-texto">{ra.roles?.nombre || codigoRolDisplay}</span>
                              <span className="text-xs text-texto-muted">{codigoRolDisplay}</span>
                              {esPrincipal && (
                                <span className="text-xs bg-primario text-primario-texto px-1.5 py-0.5 rounded">Principal</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {!esPrincipal && (
                                <button
                                  onClick={() => marcarComoPrincipal(ra.id_rol)}
                                  className="p-1 rounded hover:bg-yellow-50 text-texto-muted hover:text-yellow-600 transition-colors"
                                  title="Marcar como rol principal"
                                >
                                  <Star size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => quitarRol(ra.id_rol)}
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
                </>
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

      {/* Modal confirmar eliminación */}
      <ModalConfirmar
        abierto={!!confirmarEliminar}
        titulo="Eliminar usuario"
        mensaje={`¿Eliminar el usuario "${confirmarEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirmar={ejecutarEliminar}
        onCancelar={() => setConfirmarEliminar(null)}
        cargando={eliminando}
      />
    </div>
  )
}
