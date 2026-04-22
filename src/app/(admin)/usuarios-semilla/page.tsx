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
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Search, Trash2, X, Star } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { usuariosApi, gruposApi, entidadesApi, rolesApi, aplicacionesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Usuario, Grupo, Entidad, Rol, Aplicacion, Area } from '@/lib/tipos'
import { normalizarTipo, etiquetaTipo, varianteTipo } from '@/lib/tipo-elemento'
import { SortableDndContext, SortableListItem } from '@/components/ui/sortable'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'

type RolAsignado = {
  codigo_grupo: string
  id_rol: number
  codigo_rol?: string
  orden: number
  roles?: { nombre: string; codigo_rol: string; codigo_grupo: string | null; codigo_aplicacion_origen?: string | null } | null
}

export default function PaginaUsuariosSemilla() {
  const t = useTranslations('usuariosSemilla')
  const tc = useTranslations('common')
  const { usuario: usuarioActual, esSuperAdmin, aplicacionActiva } = useAuth()

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
    codigo_area: '',
    id_rol_principal: '',
    aplicacion_por_defecto: '',
    invitar: true,
    sidebar_colapsado: false,
    fecha_inicial: '',
    fecha_final: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Tab del modal
  const [tabActiva, setTabActiva] = useState<'datos' | 'inicializacion' | 'roles'>('datos')

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

  // ── Selectores buscables del formulario ───────────────────────────────────
  const [busquedaGrupoForm, setBusquedaGrupoForm] = useState('')
  const [dropdownGrupoFormAbierto, setDropdownGrupoFormAbierto] = useState(false)
  const dropdownGrupoFormRef = useRef<HTMLDivElement>(null)

  const [busquedaEntidadForm, setBusquedaEntidadForm] = useState('')
  const [dropdownEntidadFormAbierto, setDropdownEntidadFormAbierto] = useState(false)
  const dropdownEntidadFormRef = useRef<HTMLDivElement>(null)

  const [busquedaAreaForm, setBusquedaAreaForm] = useState('')
  const [dropdownAreaFormAbierto, setDropdownAreaFormAbierto] = useState(false)
  const dropdownAreaFormRef = useRef<HTMLDivElement>(null)

  const [busquedaRolPpal, setBusquedaRolPpal] = useState('')
  const [dropdownRolPpalAbierto, setDropdownRolPpalAbierto] = useState(false)
  const dropdownRolPpalRef = useRef<HTMLDivElement>(null)

  const [busquedaAppForm, setBusquedaAppForm] = useState('')
  const [dropdownAppFormAbierto, setDropdownAppFormAbierto] = useState(false)
  const dropdownAppFormRef = useRef<HTMLDivElement>(null)

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
      setForm((f) => ({ ...f, entidad_por_defecto: '', codigo_area: '', id_rol_principal: '', aplicacion_por_defecto: '' }))
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
      setForm((f) => ({ ...f, codigo_area: '' }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.entidad_por_defecto])

  // ── Abrir modal ────────────────────────────────────────────────────────────
  // ── Form simplificado para creación (Nuevo Usuario Semilla) ────────────
  const [formNuevo, setFormNuevo] = useState({ correo: '', nombre: '', empresa: '' })
  const [creandoSemilla, setCreandoSemilla] = useState(false)

  const abrirNuevo = () => {
    setUsuarioEditando(null)
    setFormNuevo({ correo: '', nombre: '', empresa: '' })
    setForm({ codigo_usuario: '', nombre: '', alias: '', telefono: '', descripcion: '',
      grupo_por_defecto: '', entidad_por_defecto: '', codigo_area: '',
      id_rol_principal: '', aplicacion_por_defecto: '', invitar: true, sidebar_colapsado: false,
      fecha_inicial: '', fecha_final: '' })
    setBusquedaGrupoForm(''); setBusquedaEntidadForm(''); setBusquedaAreaForm('')
    setBusquedaRolPpal(''); setBusquedaAppForm('')
    setError('')
    setEntidadesGrupo([])
    setAreasEntidad([])
    setRolesUsuario([])
    setTabActiva('datos')
    setModalAbierto(true)
  }

  const crearUsuarioSemilla = async () => {
    setError('')
    if (!formNuevo.correo || !formNuevo.nombre || !formNuevo.empresa) {
      setError('Todos los campos son obligatorios')
      return
    }
    setCreandoSemilla(true)
    try {
      // 1. Crear grupo con el nombre de empresa
      const grupo = await gruposApi.crear({ nombre: formNuevo.empresa })

      // 2. Asignar solo la aplicación activa al nuevo grupo
      const appActiva = aplicacionActiva || undefined
      if (appActiva) {
        try {
          await aplicacionesApi.asignarGrupo(appActiva, grupo.codigo_grupo)
        } catch {
          // Continuar aunque falle la asignación de app
        }
      }

      // 3. Crear entidad asociada al grupo con el mismo nombre
      const entidad = await entidadesApi.crear({
        nombre: formNuevo.empresa,
        codigo_grupo: grupo.codigo_grupo,
      })

      // 4. Crear usuario con tipo ADMINISTRADOR y fecha_inicial = hoy
      const hoy = new Date().toISOString().split('T')[0]
      const nuevoUsuario = await usuariosApi.crear({
        codigo_usuario: formNuevo.correo.toLowerCase(),
        nombre: formNuevo.nombre,
        alias: formNuevo.nombre,
        tipo: 'ADMINISTRADOR',
        grupo_por_defecto: grupo.codigo_grupo,
        entidad_por_defecto: entidad.codigo_entidad,
        aplicacion_por_defecto: appActiva,
        fecha_inicial: hoy,
        invitar: true,
      })

      // 5. Asignar roles con inicial=true + todos los de tipo ADMINISTRADOR
      const rolesDelGrupo = await rolesApi.listar(grupo.codigo_grupo, true)
      const rolesAAsignar = rolesDelGrupo.filter(
        (r: Rol) => r.inicial === true || normalizarTipo(r.tipo) === 'ADMINISTRADOR'
      )
      for (const rol of rolesAAsignar) {
        try {
          await usuariosApi.asignarRol(nuevoUsuario.codigo_usuario, rol.id_rol, grupo.codigo_grupo)
        } catch {
          // Si falla un rol individual, continuar con los demás
        }
      }

      setModalAbierto(false)
      cargarUsuarios()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear usuario semilla')
    } finally {
      setCreandoSemilla(false)
    }
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
      codigo_area: u.codigo_area || '',
      id_rol_principal: u.id_rol_principal != null ? String(u.id_rol_principal) : '',
      aplicacion_por_defecto: u.aplicacion_por_defecto || '',
      invitar: false,
      sidebar_colapsado: u.sidebar_colapsado ?? false,
      fecha_inicial: u.fecha_inicial || '',
      fecha_final: u.fecha_final || '',
    })
    // El flag se baja en el siguiente tick (después de que el useEffect haya corrido)
    setTimeout(() => { inicializandoFormRef.current = false }, 0)
    setError('')
    setTabActiva('datos')
    cargarRolesUsuario(u.codigo_usuario)
    setModalAbierto(true)
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  const guardar = async (cerrar = false): Promise<boolean> => {
    setError('')
    if (!form.codigo_usuario || !form.nombre) {
      setError('El correo y el nombre son obligatorios')
      return false
    }
    if (!form.grupo_por_defecto) {
      setError('El grupo por defecto es obligatorio para el usuario semilla')
      return false
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
        codigo_area: form.codigo_area || undefined,
        id_rol_principal: form.id_rol_principal ? Number(form.id_rol_principal) : null,
        aplicacion_por_defecto: form.aplicacion_por_defecto || undefined,
        sidebar_colapsado: form.sidebar_colapsado,
        fecha_inicial: form.fecha_inicial || undefined,
        fecha_final: form.fecha_final || undefined,
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
      cargarUsuarios()
      if (cerrar) setModalAbierto(false)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      return false
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

  const reordenarRoles = async (nuevosFiltered: typeof rolesUsuario) => {
    const grupoFiltro = form.grupo_por_defecto
    const otrosGrupos = rolesUsuario.filter(ra => ra.codigo_grupo !== grupoFiltro)
    const merged = [...otrosGrupos, ...nuevosFiltered]
    setRolesUsuario(merged)
    try {
      await usuariosApi.reordenarRoles(
        usuarioEditando!.codigo_usuario,
        merged.map(r => ({ id_rol: r.id_rol, codigo_grupo: r.codigo_grupo, orden: r.orden ?? 0 }))
      )
    } catch { if (usuarioEditando) cargarRolesUsuario(usuarioEditando.codigo_usuario) }
  }

  const marcarComoPrincipal = async (idRol: number) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.actualizar(usuarioEditando.codigo_usuario, { id_rol_principal: idRol })
      setForm({ ...form, id_rol_principal: String(idRol) })
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al cambiar rol principal') }
  }

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRolRef.current && !dropdownRolRef.current.contains(e.target as Node)) setDropdownRolAbierto(false)
      if (dropdownGrupoFormRef.current && !dropdownGrupoFormRef.current.contains(e.target as Node)) setDropdownGrupoFormAbierto(false)
      if (dropdownEntidadFormRef.current && !dropdownEntidadFormRef.current.contains(e.target as Node)) setDropdownEntidadFormAbierto(false)
      if (dropdownAreaFormRef.current && !dropdownAreaFormRef.current.contains(e.target as Node)) setDropdownAreaFormAbierto(false)
      if (dropdownRolPpalRef.current && !dropdownRolPpalRef.current.contains(e.target as Node)) setDropdownRolPpalAbierto(false)
      if (dropdownAppFormRef.current && !dropdownAppFormRef.current.contains(e.target as Node)) setDropdownAppFormAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sincronizar textos de display cuando el dropdown está cerrado y el valor cambia
  useEffect(() => {
    if (dropdownGrupoFormAbierto) return
    if (!form.grupo_por_defecto) { setBusquedaGrupoForm(''); return }
    const g = grupos.find((g) => g.codigo_grupo === form.grupo_por_defecto)
    if (g) setBusquedaGrupoForm(`${g.nombre} — ${g.codigo_grupo}`)
  }, [form.grupo_por_defecto, grupos, dropdownGrupoFormAbierto])

  useEffect(() => {
    if (dropdownEntidadFormAbierto) return
    if (!form.entidad_por_defecto) { setBusquedaEntidadForm(''); return }
    const e = entidadesGrupo.find((e) => e.codigo_entidad === form.entidad_por_defecto)
    if (e) setBusquedaEntidadForm(e.nombre)
  }, [form.entidad_por_defecto, entidadesGrupo, dropdownEntidadFormAbierto])

  useEffect(() => {
    if (dropdownAreaFormAbierto) return
    if (!form.codigo_area) { setBusquedaAreaForm(''); return }
    const a = areasEntidad.find((a) => a.codigo_area === form.codigo_area)
    if (a) setBusquedaAreaForm(a.nombre)
  }, [form.codigo_area, areasEntidad, dropdownAreaFormAbierto])

  useEffect(() => {
    if (dropdownRolPpalAbierto) return
    if (!form.id_rol_principal) { setBusquedaRolPpal(''); return }
    const r = rolesGrupo.find((r) => r.id_rol === Number(form.id_rol_principal))
    if (r) setBusquedaRolPpal(r.nombre)
  }, [form.id_rol_principal, rolesGrupo, dropdownRolPpalAbierto])

  useEffect(() => {
    if (dropdownAppFormAbierto) return
    if (!form.aplicacion_por_defecto) { setBusquedaAppForm(''); return }
    const listaApps = appsGrupo.length > 0 ? appsGrupo : aplicaciones
    const a = listaApps.find((a) => a.codigo_aplicacion === form.aplicacion_por_defecto)
    if (a) setBusquedaAppForm(a.nombre)
  }, [form.aplicacion_por_defecto, appsGrupo, aplicaciones, dropdownAppFormAbierto])

  // Roles disponibles para asignar (en el grupo del formulario)
  // Grupo SISTEMA → solo roles SISTEMA; Grupo NORMAL → solo roles NORMAL
  const grupoForm = form.grupo_por_defecto
  const mapaAppNombre = Object.fromEntries(aplicaciones.map((a) => [a.codigo_aplicacion, a.nombre]))
  const tipoGrupoForm = normalizarTipo(grupos.find((g) => g.codigo_grupo === grupoForm)?.tipo)
  const tipoUsuarioSemilla = normalizarTipo(usuarioEditando?.tipo)
  const rolesDisponibles = rolesGrupo
    .filter((r) => {
      if (!(r.codigo_grupo === grupoForm || r.codigo_grupo == null)) return false
      if (rolesUsuario.some((ra) => ra.codigo_grupo === grupoForm && ra.id_rol === r.id_rol)) return false
      const tipoRol = normalizarTipo(r.tipo)
      if (tipoUsuarioSemilla === 'SISTEMA') return tipoRol === 'SISTEMA'
      if (tipoUsuarioSemilla === 'ADMINISTRADOR') return tipoRol !== 'SISTEMA'
      if (tipoUsuarioSemilla === 'USUARIO') return tipoRol === 'USUARIO'
      return true
    })
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
    const fa = a.fecha_inicial || ''
    const fb = b.fecha_inicial || ''
    return fb.localeCompare(fa)
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
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat />
      <div className="flex items-center justify-between pr-28">
        <div>
          <h2 className="page-heading">Usuarios Semilla</h2>
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
            <TablaTh>Tipo usuario</TablaTh>
            <TablaTh>Fecha inicial</TablaTh>
            <TablaTh>Fecha final</TablaTh>
            <TablaTh className="text-right">Acciones</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>Cargando...</TablaTd>
            </TablaFila>
          ) : usuariosFiltrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>No se encontraron usuarios</TablaTd>
            </TablaFila>
          ) : usuariosFiltrados.map((u) => {
            const grupoInfo = grupos.find((g) => g.codigo_grupo === u.grupo_por_defecto)
            return (
              <TablaFila key={u.codigo_usuario}>
                <TablaTd className="font-medium">{u.nombre}</TablaTd>
                <TablaTd className="text-sm text-texto-muted">{u.codigo_usuario}</TablaTd>
                <TablaTd>{u.grupo_por_defecto ? <span className="text-sm">{nombreGrupo(u.grupo_por_defecto)}</span> : <span className="text-texto-muted">—</span>}</TablaTd>
                <TablaTd>
                  {grupoInfo
                    ? <Insignia variante={varianteTipo(grupoInfo.tipo)}>{etiquetaTipo(grupoInfo.tipo)}</Insignia>
                    : <span className="text-texto-muted text-sm">—</span>
                  }
                </TablaTd>
                <TablaTd>
                  <Insignia variante={varianteTipo(u.tipo)}>{etiquetaTipo(u.tipo)}</Insignia>
                </TablaTd>
                <TablaTd className="text-texto-muted text-xs">{u.fecha_inicial ? new Date(u.fecha_inicial).toLocaleDateString('es-CL') : '—'}</TablaTd>
                <TablaTd className="text-texto-muted text-xs">{u.fecha_final ? new Date(u.fecha_final).toLocaleDateString('es-CL') : '—'}</TablaTd>
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
        titulo={usuarioEditando ? `Editar: ${usuarioEditando.nombre}${usuarioEditando.grupo_por_defecto ? ` - ${usuarioEditando.grupo_por_defecto}` : ''}` : 'Nuevo usuario semilla'}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
          {/* Tabs (solo si editando) */}
          {usuarioEditando && (
            <div className="flex gap-1 border-b border-borde -mt-2">
              {(['datos', 'inicializacion', 'roles'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTabActiva(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tabActiva === tab
                      ? 'border-primario text-primario'
                      : 'border-transparent text-texto-muted hover:text-texto'
                  }`}
                >
                  {tab === 'datos' ? t('tabDatos') : tab === 'inicializacion' ? 'Inicialización' : `${t('tabRoles')} (${rolesUsuario.filter((ra) => ra.codigo_grupo === form.grupo_por_defecto).length})`}
                </button>
              ))}
            </div>
          )}

          {tabActiva === 'datos' && !usuarioEditando && (
            <>
              <p className="text-sm text-texto-muted bg-fondo border border-borde rounded-lg px-4 py-3">
                El usuario recibirá una invitación por correo. Se creará automáticamente el grupo, la empresa y se asignarán los roles de administración.
              </p>

              <div className="flex flex-col gap-3">
                <Input
                  etiqueta="Correo electrónico *"
                  type="email"
                  value={formNuevo.correo}
                  onChange={(e) => setFormNuevo({ ...formNuevo, correo: e.target.value.toLowerCase() })}
                  placeholder="usuario@correo.com"
                />
                <div className="grid grid-cols-2 gap-x-4">
                  <Input
                    etiqueta="Nombre completo *"
                    value={formNuevo.nombre}
                    onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })}
                    placeholder="Nombre Apellido"
                  />
                  <Input
                    etiqueta="Nombre de empresa *"
                    value={formNuevo.empresa}
                    onChange={(e) => setFormNuevo({ ...formNuevo, empresa: e.target.value })}
                    placeholder="Mi Empresa S.A."
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <PieBotonesModal editando={!!usuarioEditando} onGuardar={crearUsuarioSemilla} onGuardarYSalir={crearUsuarioSemilla} onCerrar={() => setModalAbierto(false)} cargando={creandoSemilla} />
            </>
          )}

          {tabActiva === 'datos' && usuarioEditando && (
            <>
          <p className="text-sm text-texto-muted bg-fondo border border-borde rounded-lg px-4 py-3">
            {t('aviso')}
          </p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Input etiqueta="Correo" value={form.codigo_usuario} disabled readOnly />

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

          {/* Sidebar colapsado por defecto */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.sidebar_colapsado}
              onChange={(e) => setForm({ ...form, sidebar_colapsado: e.target.checked })}
              className="w-4 h-4 rounded border-borde text-primario focus:ring-primario"
            />
            <span className="text-sm text-texto">Menú lateral colapsado por defecto</span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <PieBotonesModal editando={!!usuarioEditando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModalAbierto(false)} cargando={guardando} />
            </>
          )}

          {/* ── Tab Inicialización ─────────────────────────────────────── */}
          {tabActiva === 'inicializacion' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {form.grupo_por_defecto ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">

                  {/* Entidad buscable */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-texto">Entidad por defecto</label>
                    <div className="relative" ref={dropdownEntidadFormRef}>
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted pointer-events-none" />
                      <input type="text" placeholder={cargandoEntidades ? 'Cargando...' : 'Buscar entidad...'}
                        value={busquedaEntidadForm}
                        onChange={(e) => { setBusquedaEntidadForm(e.target.value); setDropdownEntidadFormAbierto(true); if (!e.target.value) setForm({ ...form, entidad_por_defecto: '' }) }}
                        onFocus={() => setDropdownEntidadFormAbierto(true)}
                        disabled={cargandoEntidades}
                        className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60" />
                      {dropdownEntidadFormAbierto && !cargandoEntidades && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {entidadesGrupo.filter((e) => !busquedaEntidadForm || e.nombre.toLowerCase().includes(busquedaEntidadForm.toLowerCase()) || e.codigo_entidad.toLowerCase().includes(busquedaEntidadForm.toLowerCase())).slice(0, 20).map((e) => (
                            <button key={e.codigo_entidad} type="button"
                              onClick={() => { setForm({ ...form, entidad_por_defecto: e.codigo_entidad }); setBusquedaEntidadForm(e.nombre); setDropdownEntidadFormAbierto(false) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors flex items-center gap-2">
                              <span className="font-medium">{e.nombre}</span>
                              <span className="text-texto-muted text-xs">{e.codigo_entidad}</span>
                            </button>
                          ))}
                          {entidadesGrupo.length === 0 && <div className="px-3 py-2 text-sm text-texto-muted">Sin entidades en este grupo</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Área buscable */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-texto">Área por defecto</label>
                    <div className="relative" ref={dropdownAreaFormRef}>
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted pointer-events-none" />
                      <input type="text" placeholder={!form.entidad_por_defecto ? 'Seleccione entidad primero' : cargandoAreas ? 'Cargando...' : 'Buscar área...'}
                        value={busquedaAreaForm}
                        onChange={(e) => { setBusquedaAreaForm(e.target.value); setDropdownAreaFormAbierto(true); if (!e.target.value) setForm({ ...form, codigo_area: '' }) }}
                        onFocus={() => { if (form.entidad_por_defecto) setDropdownAreaFormAbierto(true) }}
                        disabled={!form.entidad_por_defecto || cargandoAreas}
                        className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60" />
                      {dropdownAreaFormAbierto && form.entidad_por_defecto && !cargandoAreas && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {areasEntidad.filter((a) => !busquedaAreaForm || a.nombre.toLowerCase().includes(busquedaAreaForm.toLowerCase())).slice(0, 20).map((a) => (
                            <button key={a.codigo_area} type="button"
                              onClick={() => { setForm({ ...form, codigo_area: a.codigo_area }); setBusquedaAreaForm(a.nombre); setDropdownAreaFormAbierto(false) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors">
                              <span className="font-medium">{a.nombre}</span>
                            </button>
                          ))}
                          {areasEntidad.length === 0 && <div className="px-3 py-2 text-sm text-texto-muted">Sin áreas en esta entidad</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rol principal buscable */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-texto">Rol principal</label>
                    <div className="relative" ref={dropdownRolPpalRef}>
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted pointer-events-none" />
                      <input type="text" placeholder="Buscar rol..."
                        value={busquedaRolPpal}
                        onChange={(e) => { setBusquedaRolPpal(e.target.value); setDropdownRolPpalAbierto(true); if (!e.target.value) setForm({ ...form, id_rol_principal: '' }) }}
                        onFocus={() => setDropdownRolPpalAbierto(true)}
                        className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
                      {dropdownRolPpalAbierto && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {[{ id_rol: 0, nombre: '— Sin rol —', codigo_rol: '', codigo_grupo: null, tipo: tipoGrupoForm } as Rol,
                            ...rolesGrupo.filter((r) => {
                              if (!(r.codigo_grupo === grupoForm || r.codigo_grupo == null)) return false
                              const tipoRol = normalizarTipo(r.tipo)
                              if (tipoUsuarioSemilla === 'SISTEMA') return tipoRol === 'SISTEMA'
                              if (tipoUsuarioSemilla === 'ADMINISTRADOR') return tipoRol !== 'SISTEMA'
                              if (tipoUsuarioSemilla === 'USUARIO') return tipoRol === 'USUARIO'
                              return true
                            })]
                            .filter((r) => r.id_rol === 0 || !busquedaRolPpal || r.nombre.toLowerCase().includes(busquedaRolPpal.toLowerCase()) || r.codigo_rol.toLowerCase().includes(busquedaRolPpal.toLowerCase()))
                            .slice(0, 21).map((r) => (
                              <button key={r.id_rol} type="button"
                                onClick={() => { setForm({ ...form, id_rol_principal: r.id_rol ? String(r.id_rol) : '' }); setBusquedaRolPpal(r.id_rol ? r.nombre : ''); setDropdownRolPpalAbierto(false) }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors flex items-center gap-2">
                                {r.id_rol === 0 ? <span className="text-texto-muted italic">{t('sinRol')}</span> : <>
                                  <span className="font-medium">{r.nombre}</span>
                                  <span className="text-texto-muted text-xs">{r.codigo_rol}</span>
                                  {r.codigo_grupo == null && <span className="text-xs bg-primario/10 text-primario px-1.5 py-0.5 rounded">{tc('global')}</span>}
                                </>}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aplicación buscable */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-texto">Aplicación por defecto</label>
                    <div className="relative" ref={dropdownAppFormRef}>
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted pointer-events-none" />
                      <input type="text" placeholder="Buscar aplicación..."
                        value={busquedaAppForm}
                        onChange={(e) => { setBusquedaAppForm(e.target.value); setDropdownAppFormAbierto(true); if (!e.target.value) setForm({ ...form, aplicacion_por_defecto: '' }) }}
                        onFocus={() => setDropdownAppFormAbierto(true)}
                        className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario" />
                      {dropdownAppFormAbierto && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {[{ codigo_aplicacion: '', nombre: '— Sin aplicación —', tipo: tipoGrupoForm } as Aplicacion,
                            ...(appsGrupo.length > 0 ? appsGrupo : aplicaciones).filter((a) => {
                              const at = normalizarTipo(a.tipo)
                              if (at === tipoGrupoForm) return true
                              if ((tipoGrupoForm === 'SISTEMA' || tipoGrupoForm === 'ADMINISTRADOR') && at === 'USUARIO') return true
                              return false
                            })]
                            .filter((a) => !a.codigo_aplicacion || !busquedaAppForm || a.nombre.toLowerCase().includes(busquedaAppForm.toLowerCase()))
                            .slice(0, 21).map((a) => (
                              <button key={a.codigo_aplicacion || '__sin'} type="button"
                                onClick={() => { setForm({ ...form, aplicacion_por_defecto: a.codigo_aplicacion }); setBusquedaAppForm(a.codigo_aplicacion ? a.nombre : ''); setDropdownAppFormAbierto(false) }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors flex items-center gap-2">
                                {!a.codigo_aplicacion ? <span className="text-texto-muted italic">Sin aplicación</span> : <>
                                  <span className="font-medium">{a.nombre}</span>
                                  <span className="text-texto-muted text-xs">{a.codigo_aplicacion}</span>
                                </>}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fecha inicial */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-texto">Fecha inicial</label>
                    <input
                      type="date"
                      value={form.fecha_inicial}
                      onChange={(e) => setForm({ ...form, fecha_inicial: e.target.value })}
                      className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                    />
                  </div>

                  {/* Fecha final */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-texto">Fecha final</label>
                    <input
                      type="date"
                      value={form.fecha_final}
                      onChange={(e) => setForm({ ...form, fecha_final: e.target.value })}
                      className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-yellow-700">Debe seleccionar un grupo por defecto en la pestaña &quot;Datos&quot; primero.</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}
              <PieBotonesModal editando={!!usuarioEditando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModalAbierto(false)} cargando={guardando} />
            </div>
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
                  {(() => {
                    if (tipoUsuarioSemilla === 'SISTEMA') return <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">Solo roles de tipo <strong>Sistema</strong> pueden asignarse a este usuario.</div>
                    if (tipoUsuarioSemilla === 'ADMINISTRADOR') return <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">Roles de tipo <strong>Sistema</strong> no pueden asignarse a usuarios de Administración.</div>
                    if (tipoUsuarioSemilla === 'USUARIO') return <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">Solo roles de tipo <strong>Usuario</strong> pueden asignarse a este usuario.</div>
                    return null
                  })()}
                  {/* Asignar nuevo rol */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative" ref={dropdownRolRef}>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                        <input
                          type="text"
                          placeholder={t('buscarRol')}
                          value={busquedaRol}
                          onChange={(e) => { setBusquedaRol(e.target.value); setDropdownRolAbierto(true); setRolNuevo('') }}
                          onFocus={() => setDropdownRolAbierto(true)}
                          className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                        />
                      </div>
                      {dropdownRolAbierto && (
                        <div className="absolute z-50 w-full bottom-full mb-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {rolesDisponiblesFiltrados.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-texto-muted">{tc('sinResultados')}</div>
                          ) : rolesDisponiblesFiltrados.slice(0, 20).map((r) => (
                            <button
                              key={r.id_rol}
                              onClick={() => {
                                setRolNuevo(String(r.id_rol))
                                setBusquedaRol(`${r.nombre} (${r.codigo_rol})${r.codigo_grupo == null ? ` [${tc('global')}]` : ''}`)
                                setDropdownRolAbierto(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors"
                            >
                              <span className="font-medium">{r.nombre}</span>
                              <span className="ml-2 text-texto-muted text-xs">{r.codigo_rol}</span>
                              {r.codigo_grupo == null && <span className="ml-2 text-xs bg-primario/10 text-primario px-1.5 py-0.5 rounded">{tc('global')}</span>}
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
                    <p className="text-sm text-texto-muted text-center py-4">No hay roles asignados en este grupo</p>
                  ) : (
                    <SortableDndContext
                      items={rolesUsuario.filter((ra) => ra.codigo_grupo === form.grupo_por_defecto) as unknown as Record<string, unknown>[]}
                      getId={(ra) => `${(ra as { codigo_grupo: string }).codigo_grupo}_${(ra as { id_rol: number }).id_rol}`}
                      onReorder={(n) => reordenarRoles(n as typeof rolesUsuario)}
                    >
                      <div className="flex flex-col gap-2">
                        {rolesUsuario.filter((ra) => ra.codigo_grupo === form.grupo_por_defecto).map((ra) => {
                          const esPrincipal = form.id_rol_principal === String(ra.id_rol)
                          const codigoRolDisplay = ra.codigo_rol || ra.roles?.codigo_rol || `id ${ra.id_rol}`
                          return (
                            <SortableListItem
                              key={`${ra.codigo_grupo}_${ra.id_rol}`}
                              id={`${ra.codigo_grupo}_${ra.id_rol}`}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-surface ${
                                esPrincipal ? 'border-primario bg-primario-muy-claro' : 'border-borde'
                              }`}
                            >
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
                            </SortableListItem>
                          )
                        })}
                      </div>
                    </SortableDndContext>
                  )}
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}
              <PieBotonesModal editando={!!usuarioEditando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModalAbierto(false)} cargando={guardando} />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal confirmar eliminación */}
      <ModalConfirmar
        abierto={!!confirmarEliminar}
        titulo={tc('eliminar')}
        mensaje={tc('confirmarEliminar', { nombre: confirmarEliminar?.nombre ?? '' })}
        onConfirmar={ejecutarEliminar}
        onCancelar={() => setConfirmarEliminar(null)}
        cargando={eliminando}
      />
    </div>
  )
}
