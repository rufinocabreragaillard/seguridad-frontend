'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search, Pencil, Trash2, X, Star, Phone, PhoneOff, Download } from 'lucide-react'
import { SortableDndContext, SortableListItem } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Paginador } from '@/components/ui/paginador'
import { usePaginacion } from '@/hooks/usePaginacion'
import { usuariosApi, rolesApi, entidadesApi, aplicacionesApi, gruposApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Usuario, Rol, Entidad, Area, Aplicacion, Grupo } from '@/lib/tipos'
import { normalizarTipo } from '@/lib/tipo-elemento'
import { InsigniaTipo } from '@/components/ui/insignia-tipo'
import { useTipoAccesoGrafo } from '@/hooks/useTipoAccesoGrafo'
import { exportarExcel } from '@/lib/exportar-excel'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'

type RolAsignado = {
  codigo_grupo: string
  id_rol: number
  codigo_rol?: string
  orden: number
  roles?: { codigo_rol: string; nombre: string; codigo_grupo: string | null }
}
type GrupoAsignado = { codigo_grupo: string; grupos_entidades: { nombre: string } }
type EntidadAsignada = {
  codigo_entidad: string
  codigo_grupo: string
  codigo_area?: string
  entidades: { nombre: string }
}

const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

export default function PaginaUsuarios() {
  const t = useTranslations('usuarios')
  const tc = useTranslations('common')
  const { usuario: usuarioActual } = useAuth()
  const grupoActivo = usuarioActual?.grupo_activo ?? ''
  const { esDescendiente, tiposVisibles } = useTipoAccesoGrafo()
  const grupoAnteriorRef = useRef(grupoActivo)

  const [roles, setRoles] = useState<Rol[]>([])
  const [busqueda, setBusqueda] = useState('')

  // Paginación server-side del listado de usuarios del grupo activo.
  const filtrosUsuarios = useMemo(() => ({ q: busqueda.trim() || undefined }), [busqueda])
  const fetcherUsuarios = useCallback(
    (params: { page: number; limit: number; q?: string }) => usuariosApi.listarPaginado(params),
    [],
  )
  const {
    items: usuarios,
    total,
    page,
    limit,
    cargando,
    setPage,
    setLimit,
    refetch: refetchUsuarios,
  } = usePaginacion<Usuario, { q?: string }>({
    fetcher: fetcherUsuarios,
    filtros: filtrosUsuarios,
    limitInicial: 10,
  })
  const [modalAbierto, setModalAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorCarga, setErrorCarga] = useState('')
  const [tabActiva, setTabActiva] = useState<'datos' | 'inicializacion' | 'roles' | 'entidades'>('datos')

  // ── Roles ──────────────────────────────────────────────────────────────────
  const [rolesUsuario, setRolesUsuario] = useState<RolAsignado[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [rolNuevo, setRolNuevo] = useState('')
  const [busquedaRol, setBusquedaRol] = useState('')
  const [dropdownRolAbierto, setDropdownRolAbierto] = useState(false)
  const dropdownRolRef = useRef<HTMLDivElement>(null)
  const [asignandoRol, setAsignandoRol] = useState(false)

  // ── Grupos del usuario (para dropdown de grupo_por_defecto) ────────────────
  const [gruposUsuario, setGruposUsuario] = useState<GrupoAsignado[]>([])

  // ── Entidades del usuario (pestaña Entidades) ─────────────────────────────
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [entidadesUsuario, setEntidadesUsuario] = useState<EntidadAsignada[]>([])
  const [cargandoEntidades, setCargandoEntidades] = useState(false)
  const [entidadNueva, setEntidadNueva] = useState('')
  const [busquedaEntidad, setBusquedaEntidad] = useState('')
  const [dropdownEntidadAbierto, setDropdownEntidadAbierto] = useState(false)
  const dropdownEntidadRef = useRef<HTMLDivElement>(null)
  const [asignandoEntidad, setAsignandoEntidad] = useState(false)

  // Áreas de la entidad seleccionada para ASIGNAR (pestaña Entidades)
  const [areasParaEntidad, setAreasParaEntidad] = useState<Area[]>([])
  const [areaNueva, setAreaNueva] = useState('')
  const [cargandoAreas, setCargandoAreas] = useState(false)

  // Áreas para los DEFAULTS (pestaña Datos)
  const [areasParaDefault, setAreasParaDefault] = useState<Area[]>([])
  const [cargandoAreasDefault, setCargandoAreasDefault] = useState(false)

  // ── Formulario ─────────────────────────────────────────────────────────────
  // id_rol_principal se mantiene como string en el form (value de <select>)
  // y se convierte a number al persistir en BD.
  const [form, setForm] = useState({
    codigo_usuario: '',
    nombre: '',
    alias: '',
    telefono: '',
    descripcion: '',
    tipo_acceso: 'USUARIO',
    id_rol_principal: '',
    grupo_por_defecto: '',
    entidad_por_defecto: '',
    codigo_area: '',
    aplicacion_por_defecto: '',
    invitar: true,
    prompt_insert: '',
    prompt_update: '',
    fecha_inicial: '',
    fecha_final: '',
  })

  // Apps disponibles para el grupo del usuario editado
  const [appsGrupoUsuario, setAppsGrupoUsuario] = useState<Aplicacion[]>([])
  // Catálogo de apps del grupo activo del admin (para detectar tipo SISTEMA al asignar roles)
  const [catalogoApps, setCatalogoApps] = useState<Aplicacion[]>([])
  // Catálogo de grupos (para detectar tipo del grupo activo al filtrar roles)
  const [catalogoGrupos, setCatalogoGrupos] = useState<Grupo[]>([])

  // ── Carga inicial de catálogos auxiliares (roles, entidades, apps, grupos) ───────
  // Los usuarios ya se cargan paginados arriba.
  useEffect(() => {
    setErrorCarga('')
    Promise.all([rolesApi.listar(), entidadesApi.listar(), aplicacionesApi.listar(), gruposApi.listar()])
      .then(([r, e, a, g]) => {
        setRoles(r); setEntidades(e); setCatalogoApps(a); setCatalogoGrupos(g)
      })
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : 'Error al cargar catálogos'))
  }, [])

  // Alias para mantener compat con llamadas post-CRUD que usaban cargar().
  const cargar = refetchUsuarios

  // Ordenar por fecha_inicial más nueva primero
  const usuariosFiltrados = [...usuarios].sort((a, b) => {
    const fa = a.fecha_inicial || ''
    const fb = b.fecha_inicial || ''
    return fb.localeCompare(fa)
  })

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

  // Cargar apps del grupo_por_defecto del usuario editado
  useEffect(() => {
    if (form.grupo_por_defecto) {
      aplicacionesApi.listar(form.grupo_por_defecto)
        .then(setAppsGrupoUsuario)
        .catch(() => setAppsGrupoUsuario([]))
    } else {
      setAppsGrupoUsuario([])
    }
  }, [form.grupo_por_defecto])

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
    setForm({ codigo_usuario: '', nombre: '', alias: '', telefono: '', descripcion: '', tipo_acceso: 'USUARIO', id_rol_principal: '',
      grupo_por_defecto: '', entidad_por_defecto: '', codigo_area: '', aplicacion_por_defecto: '', invitar: true, prompt_insert: '', prompt_update: '', fecha_inicial: '', fecha_final: '' })
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
      alias: u.alias || '',
      telefono: u.telefono || '',
      descripcion: u.descripcion || '',
      tipo_acceso: u.tipo_acceso || 'USUARIO',
      id_rol_principal: u.id_rol_principal != null ? String(u.id_rol_principal) : '',
      grupo_por_defecto: u.grupo_por_defecto || '',
      entidad_por_defecto: u.entidad_por_defecto || '',
      codigo_area: u.codigo_area || '',
      aplicacion_por_defecto: u.aplicacion_por_defecto || '',
      invitar: false,
      prompt_insert: u.prompt_insert || '',
      prompt_update: u.prompt_update || '',
      fecha_inicial: u.fecha_inicial || '',
      fecha_final: u.fecha_final || '',
    })
    setError('')
    setGuardando(false)
    setTabActiva('datos')
    setRolNuevo('')
    setBusquedaRol('')
    setEntidadNueva('')
    setBusquedaEntidad('')
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
  const guardar = async (cerrar = false): Promise<boolean> => {
    setError('')
    if (!form.codigo_usuario || !form.nombre) {
      setError('El correo y el nombre son obligatorios')
      return false
    }
    setGuardando(true)
    try {
      if (usuarioEditando) {
        await usuariosApi.actualizar(usuarioEditando.codigo_usuario, {
          nombre: form.nombre,
          alias: form.alias || undefined,
          telefono: form.telefono || undefined,
          descripcion: form.descripcion || undefined,
          id_rol_principal: form.id_rol_principal ? Number(form.id_rol_principal) : null,
          grupo_por_defecto: form.grupo_por_defecto || undefined,
          entidad_por_defecto: form.entidad_por_defecto || undefined,
          codigo_area: form.codigo_area || undefined,
          aplicacion_por_defecto: form.aplicacion_por_defecto || undefined,
          prompt_insert: form.prompt_insert || undefined,
          prompt_update: form.prompt_update || undefined,
          fecha_inicial: form.fecha_inicial || undefined,
          fecha_final: form.fecha_final || undefined,
        })
      } else {
        const creado = await usuariosApi.crear({
          codigo_usuario: form.codigo_usuario,
          nombre: form.nombre,
          tipo_acceso: form.tipo_acceso || 'USUARIO',
          invitar: form.invitar,
        })
        const nuevoUsuario: Usuario = {
          codigo_usuario: form.codigo_usuario,
          nombre: form.nombre,
          grupo_por_defecto: grupoActivo,
          ...creado,
        }
        setUsuarioEditando(nuevoUsuario)
        setForm((f) => ({ ...f, grupo_por_defecto: grupoActivo }))
        cargarEntidadesUsuario(form.codigo_usuario)
        cargarGruposUsuario(form.codigo_usuario)
      }
      cargar()
      if (cerrar) setModalAbierto(false)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      return false
    } finally {
      setGuardando(false)
    }
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  // rolNuevo guarda el id_rol como string (value de <select>/dropdown).
  const asignarRol = async () => {
    if (!rolNuevo || !usuarioEditando) return
    setAsignandoRol(true)
    try {
      await usuariosApi.asignarRol(usuarioEditando.codigo_usuario, Number(rolNuevo), grupoActivo || 'ADMIN')
      setRolNuevo('')
      setBusquedaRol('')
      await cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al asignar rol') }
    finally { setAsignandoRol(false) }
  }

  const quitarRol = async (idRol: number, codigoGrupo: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.quitarRol(usuarioEditando.codigo_usuario, idRol, codigoGrupo)
      await cargarRolesUsuario(usuarioEditando.codigo_usuario)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al quitar rol') }
  }

  const reordenarRoles = async (nuevosFiltered: typeof rolesUsuario) => {
    const otrosGrupos = rolesUsuario.filter(ra => ra.codigo_grupo !== grupoActivo)
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
      setBusquedaEntidad('')
      setAreaNueva('')
      setAreasParaEntidad([])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al asignar entidad'
      setError(msg.includes('timeout') ? 'El servidor tardó demasiado. Intente nuevamente.' : msg)
      return
    } finally {
      setAsignandoEntidad(false)
    }
    // Recargar lista de entidades de forma independiente (sin bloquear el spinner)
    cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
  }

  const quitarEntidad = async (codigoEntidad: string) => {
    if (!usuarioEditando) return
    try {
      await usuariosApi.quitarEntidad(usuarioEditando.codigo_usuario, codigoEntidad)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al quitar entidad'); return }
    cargarEntidadesUsuario(usuarioEditando.codigo_usuario)
  }

  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const ejecutarEliminar = async () => {
    if (!usuarioAEliminar) return
    setEliminando(true)
    try {
      await usuariosApi.eliminar(usuarioAEliminar.codigo_usuario)
      setUsuarioAEliminar(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
      setUsuarioAEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  // ── Click-outside para dropdowns buscables ─────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRolRef.current && !dropdownRolRef.current.contains(e.target as Node)) setDropdownRolAbierto(false)
      if (dropdownEntidadRef.current && !dropdownEntidadRef.current.contains(e.target as Node)) setDropdownEntidadAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Listas derivadas ───────────────────────────────────────────────────────
  // Roles disponibles para asignar al usuario en el grupo activo:
  // - Roles del grupo activo + roles globales (codigo_grupo NULL)
  // - Excluyendo los que ya tiene asignados en el grupo activo
  // - Grupo SISTEMA → solo roles SISTEMA; Grupo NORMAL → solo roles NORMAL
  const ROLES_PROTEGIDOS = new Set(['SEG_ADMIN_GRUPO', 'SISTEMA'])
  const esSuperAdmin = (usuarioActual?.grupos || []).some((g) => g.codigo_grupo === 'ADMIN')
  const mapaAppNombre = Object.fromEntries(catalogoApps.map((a) => [a.codigo_aplicacion, a.nombre]))
  const tipoUsuarioEditando = normalizarTipo(form.tipo_acceso)
  const rolesDisponibles = roles
    .filter((r) => {
      if (ROLES_PROTEGIDOS.has(r.codigo_rol)) return false
      if (!(r.codigo_grupo === grupoActivo || r.codigo_grupo == null)) return false
      if (rolesUsuario.some((ra) => ra.codigo_grupo === grupoActivo && ra.id_rol === r.id_rol)) return false
      const tipoRol = normalizarTipo(r.tipo_acceso)
      return esDescendiente(tipoUsuarioEditando, tipoRol)
    })
    // Orden: nombre app origen → nombre rol. Sin app origen al final.
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

  // Entidades del usuario en el grupo activo (para tab Entidades)
  const entidadesUsuarioGrupoActivo = entidadesUsuario.filter((ea) => ea.codigo_grupo === grupoActivo)

  const entidadesDisponibles = entidades.filter((e) =>
    !entidadesUsuarioGrupoActivo.some((ea) => ea.codigo_entidad === e.codigo_entidad)
  )
  const entidadesDisponiblesFiltradas = entidadesDisponibles.filter((e) =>
    busquedaEntidad.length === 0 ||
    e.nombre.toLowerCase().includes(busquedaEntidad.toLowerCase()) ||
    e.codigo_entidad.toLowerCase().includes(busquedaEntidad.toLowerCase())
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
          grupos_entidades: { nombre: ea.codigo_grupo },
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
    setForm({ ...form, grupo_por_defecto: e.target.value, id_rol_principal: '', entidad_por_defecto: '', codigo_area: '', aplicacion_por_defecto: '' })
    setAreasParaDefault([])
  }

  const handleEntidadDefaultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm({ ...form, entidad_por_defecto: e.target.value, codigo_area: '' })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat />
      {/* Encabezado */}
      <div className="flex items-center justify-between pr-28">
        <div>
          <h2 className="page-heading">{t('titulo')}</h2>
          <p className="text-sm text-texto-muted mt-1">Gestión de usuarios del sistema</p>
        </div>
        <Boton variante="primario" onClick={abrirNuevo}>
          <Plus size={16} />
          {t('nuevoUsuario')}
        </Boton>
      </div>

      {/* Búsqueda + Exportar */}
      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input
            placeholder={t('buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <Boton
          variante="contorno"
          tamano="sm"
          onClick={() => exportarExcel(usuariosFiltrados as unknown as Record<string, unknown>[], [
            { titulo: 'Correo', campo: 'codigo_usuario' },
            { titulo: 'Nombre', campo: 'nombre' },
            { titulo: 'Teléfono', campo: 'telefono' },
            { titulo: 'Rol principal', campo: 'codigo_rol_principal' },
            { titulo: 'Grupo por defecto', campo: 'grupo_por_defecto' },
            { titulo: 'Entidad por defecto', campo: 'entidad_por_defecto' },
            { titulo: 'Área por defecto', campo: 'codigo_area' },
            { titulo: 'Último acceso', campo: 'ultimo_acceso', formato: (v) => v ? new Date(v as string).toLocaleString('es-CL') : '' },
          ], `usuarios_${grupoActivo || 'todos'}`)}
          disabled={usuariosFiltrados.length === 0}
        >
          <Download size={15} />
          Excel
        </Boton>
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
              <TablaTh>{t('colNombre')}</TablaTh>
              <TablaTh>{t('colCorreo')}</TablaTh>
              <TablaTh>{t('colRolPrincipal')}</TablaTh>
              <TablaTh>{t('colTipo')}</TablaTh>
              <TablaTh>Fecha inicial</TablaTh>
              <TablaTh>Fecha final</TablaTh>
              <TablaTh className="text-right">{tc('acciones')}</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {usuariosFiltrados.length === 0 ? (
              <TablaFila>
                <TablaTd className="text-center text-texto-muted py-8" colSpan={7 as never}>
                  No se encontraron usuarios
                </TablaTd>
              </TablaFila>
            ) : (
              usuariosFiltrados.map((u) => (
                <TablaFila key={u.codigo_usuario}>
                  <TablaTd onDoubleClick={() => abrirEditar(u)}>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primario flex items-center justify-center text-primario-texto text-xs font-semibold shrink-0">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.nombre}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-texto-muted" onDoubleClick={() => abrirEditar(u)}>{u.codigo_usuario}</TablaTd>
                  <TablaTd>{u.codigo_rol_principal || <span className="text-texto-light">—</span>}</TablaTd>
                  <TablaTd onDoubleClick={() => abrirEditar(u)}>
                    <InsigniaTipo tipo={u.tipo_acceso} />
                  </TablaTd>
                  <TablaTd className="text-texto-muted text-xs">
                    {u.fecha_inicial ? new Date(u.fecha_inicial).toLocaleDateString('es-CL') : '—'}
                  </TablaTd>
                  <TablaTd className="text-texto-muted text-xs">
                    {u.fecha_final ? new Date(u.fecha_final).toLocaleDateString('es-CL') : '—'}
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
                        onClick={() => setUsuarioAEliminar(u)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))
            )}
          </TablaCuerpo>
        </Tabla>
      )}

      <Paginador
        page={page}
        limit={limit}
        total={total}
        onChangePage={setPage}
        onChangeLimit={setLimit}
        cargando={cargando}
        opcionesLimit={[10, 25, 50, 100]}
      />

      {/* Modal crear/editar */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={usuarioEditando ? `Editar: ${usuarioEditando.nombre}${usuarioEditando.grupo_por_defecto ? ` - ${usuarioEditando.grupo_por_defecto}` : ''}` : 'Nuevo usuario'}
        descripcion={usuarioEditando ? undefined : 'El usuario recibirá una invitación por correo'}
        className="w-[min(95vw,42rem)] max-w-none min-h-[32rem]"
      >
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Pestañas (solo en edición) */}
          {usuarioEditando && (
            <div className="flex border-b border-borde -mx-1 overflow-x-auto">
              {(['datos', 'inicializacion', 'entidades', 'roles'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabActiva(tab)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors capitalize ${
                    tabActiva === tab
                      ? 'border-b-2 border-primario text-primario'
                      : 'text-texto-muted hover:text-texto'
                  }`}
                >
                  {tab === 'datos' ? t('tabDatos') : tab === 'inicializacion' ? 'Inicialización' : tab === 'entidades' ? t('tabEntidades') : t('tabRoles')}
                </button>
              ))}
            </div>
          )}

          {/* ── Tab Datos ─────────────────────────────────────────────────── */}
          {tabActiva === 'datos' && (
            <>
              {!usuarioEditando ? (
                /* ── Modo creación: correo + nombre + tipo ── */
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="col-span-2">
                      <Input
                        etiqueta={t('etiquetaCorreo')}
                        type="email"
                        value={form.codigo_usuario}
                        onChange={(e) => setForm({ ...form, codigo_usuario: e.target.value })}
                        placeholder="usuario@correo.com"
                      />
                    </div>
                    <Input
                      etiqueta={t('etiquetaNombre')}
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Nombre Apellido"
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-texto">Tipo</label>
                      <select
                        value={form.tipo_acceso}
                        onChange={(e) => setForm({ ...form, tipo_acceso: e.target.value })}
                        className={selectClass}
                      >
                        <option value="USUARIO">Usuario</option>
                        <option value="ADMINISTRADOR">Administrador</option>
                        <option value="SISTEMA">Sistema</option>
                      </select>
                    </div>
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-error">{error}</p>
                    </div>
                  )}
                  <PieBotonesModal editando={!!usuarioEditando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModalAbierto(false)} cargando={guardando} />
                </div>
              ) : (
                /* ── Modo edición: todos los campos ── */
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="col-span-2">
                      <Input
                        etiqueta={t('etiquetaCorreo')}
                        type="email"
                        value={form.codigo_usuario}
                        disabled
                        placeholder="usuario@correo.com"
                      />
                    </div>
                    <Input
                      etiqueta={t('etiquetaNombre')}
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Nombre Apellido"
                    />
                    <Input
                      etiqueta={t('etiquetaAlias')}
                      value={form.alias}
                      onChange={(e) => setForm({ ...form, alias: e.target.value })}
                      placeholder="Alias del usuario"
                    />
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
                    </div>
                    <div />
                    <div className="col-span-2">
                      <Textarea
                        etiqueta={t('etiquetaDescripcion')}
                        value={form.descripcion}
                        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-error">{error}</p>
                    </div>
                  )}
                  <PieBotonesModal editando={!!usuarioEditando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModalAbierto(false)} cargando={guardando} />
                </div>
              )}
            </>
          )}

          {/* ── Tab Inicialización ─────────────────────────────────────────── */}
          {tabActiva === 'inicializacion' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {/* Entidad por defecto */}
                <div className="flex flex-col gap-1.5">
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

                {/* Área por defecto */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Área por defecto <span className="text-texto-muted font-normal">(opcional)</span></label>
                  <select
                    value={form.codigo_area}
                    onChange={(e) => setForm({ ...form, codigo_area: e.target.value })}
                    disabled={!form.entidad_por_defecto || cargandoAreasDefault}
                    className={selectClass}
                  >
                    <option value="">Sin área</option>
                    {areasParaDefault.map((a) => (
                      <option key={a.codigo_area} value={a.codigo_area}>{a.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Rol principal */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Rol principal</label>
                  <select
                    value={form.id_rol_principal}
                    onChange={(e) => setForm({ ...form, id_rol_principal: e.target.value })}
                    disabled={!form.grupo_por_defecto}
                    className={selectClass}
                  >
                    <option value="">Sin rol asignado</option>
                    {rolesUsuario
                      .filter((ra) => ra.codigo_grupo === form.grupo_por_defecto)
                      .map((ra) => (
                        <option key={ra.id_rol} value={String(ra.id_rol)}>
                          {ra.roles?.nombre || ra.codigo_rol || ra.roles?.codigo_rol || `id ${ra.id_rol}`}
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Aplicación por defecto */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Aplicación por defecto</label>
                  <select
                    value={form.aplicacion_por_defecto}
                    onChange={(e) => setForm({ ...form, aplicacion_por_defecto: e.target.value })}
                    disabled={!form.grupo_por_defecto}
                    className={selectClass}
                  >
                    <option value="">Sin aplicación seleccionada</option>
                    {appsGrupoUsuario.map((a) => (
                      <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>
                        {a.nombre} ({a.codigo_aplicacion})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha inicial */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Fecha inicial</label>
                  <input
                    type="date"
                    value={form.fecha_inicial}
                    onChange={(e) => setForm({ ...form, fecha_inicial: e.target.value })}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  />
                </div>

                {/* Fecha final */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-texto">Fecha final</label>
                  <input
                    type="date"
                    value={form.fecha_final}
                    onChange={(e) => setForm({ ...form, fecha_final: e.target.value })}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}
              <PieBotonesModal editando={!!usuarioEditando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModalAbierto(false)} cargando={guardando} />
            </div>
          )}

          {/* ── Tab Entidades ─────────────────────────────────────────────── */}
          {tabActiva === 'entidades' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {/* Asignar nueva entidad */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative" ref={dropdownEntidadRef}>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                      <input
                        type="text"
                        placeholder={t('buscarEntidad')}
                        value={busquedaEntidad}
                        onChange={(e) => { setBusquedaEntidad(e.target.value); setDropdownEntidadAbierto(true); setEntidadNueva('') }}
                        onFocus={() => setDropdownEntidadAbierto(true)}
                        className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                      />
                    </div>
                    {dropdownEntidadAbierto && (
                      <div className="absolute z-50 w-full bottom-full mb-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {entidadesDisponiblesFiltradas.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-texto-muted">No se encontraron entidades</div>
                        ) : entidadesDisponiblesFiltradas.slice(0, 20).map((e) => (
                          <button
                            key={e.codigo_entidad}
                            onClick={() => {
                              setEntidadNueva(e.codigo_entidad)
                              setBusquedaEntidad(`${e.nombre} (${e.codigo_entidad})`)
                              setDropdownEntidadAbierto(false)
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors"
                          >
                            <span className="font-medium">{e.nombre}</span>
                            <span className="ml-2 text-texto-muted text-xs">{e.codigo_entidad}</span>
                          </button>
                        ))}
                      </div>
                    )}
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
              ) : entidadesUsuarioGrupoActivo.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tiene entidades asignadas en este grupo</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {entidadesUsuarioGrupoActivo.map((ea) => (
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
                          <span className="ml-2 text-xs bg-primario/10 text-primario px-1.5 py-0.5 rounded">
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
              <PieBotonesModal editando={!!usuarioEditando} onGuardar={() => guardar(false)} onGuardarYSalir={() => guardar(true)} onCerrar={() => setModalAbierto(false)} cargando={guardando} />
            </div>
          )}

          {/* ── Tab Roles del usuario ─────────────────────────────────────── */}
          {tabActiva === 'roles' && usuarioEditando && (
            <div className="flex flex-col gap-4">
              {entidadesUsuarioGrupoActivo.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-yellow-700">
                    Debe asignar al menos una entidad de este grupo antes de asignar roles. Vaya a la pestaña &quot;Entidades&quot;.
                  </p>
                </div>
              ) : (
                <>
                {(() => {
                  const visibles = tiposVisibles(tipoUsuarioEditando)
                  if (!visibles.length) return null
                  const todos = visibles.length > 2
                  if (todos) return <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-700">Este usuario puede recibir roles de cualquier tipo: <strong>{visibles.join(', ')}</strong>.</div>
                  return <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">Solo se pueden asignar roles de tipo: <strong>{visibles.join(', ')}</strong>.</div>
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
              {cargandoRoles ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}
                </div>
              ) : rolesUsuario.filter((ra) => ra.codigo_grupo === grupoActivo).length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tiene roles asignados en este grupo</p>
              ) : (
                (() => {
                  const rolesDelGrupo = rolesUsuario.filter((ra) => ra.codigo_grupo === grupoActivo)
                  return (
                    <SortableDndContext
                      items={rolesDelGrupo as unknown as Record<string, unknown>[]}
                      getId={(r) => `${(r as { codigo_grupo: string }).codigo_grupo}_${(r as { id_rol: number }).id_rol}`}
                      onReorder={(n) => reordenarRoles(n as typeof rolesUsuario)}
                    >
                      <div className="flex flex-col gap-2">
                        {rolesDelGrupo.map((ra) => {
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
                                  onClick={() => quitarRol(ra.id_rol, ra.codigo_grupo)}
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
                  )
                })()
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

      {/* Modal Confirmar Eliminación */}
      <ModalConfirmar
        abierto={!!usuarioAEliminar}
        alCerrar={() => setUsuarioAEliminar(null)}
        alConfirmar={ejecutarEliminar}
        titulo={tc('eliminar')}
        mensaje={tc('confirmarEliminar', { nombre: usuarioAEliminar?.nombre ?? '' })}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
