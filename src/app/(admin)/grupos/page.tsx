'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Layers, Users, Building2, X, Search, Download, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { gruposApi, usuariosApi, entidadesApi, promptsApi } from '@/lib/api'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { useAuth } from '@/context/AuthContext'
import type { Grupo, Entidad, Usuario } from '@/lib/tipos'
import { etiquetaTipo, varianteTipo, normalizarTipo, type TipoElemento } from '@/lib/tipo-elemento'
import { exportarExcel } from '@/lib/exportar-excel'
import { useTranslations } from 'next-intl'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'

type UsuarioGrupo = { codigo_usuario: string; fecha_alta?: string; usuarios?: { nombre: string } }

const PAGE_SIZE = 10

export default function PaginaGrupos() {
  const t = useTranslations('grupos')
  const tc = useTranslations('common')
  const { esSuperAdmin, usuario } = useAuth()
  const router = useRouter()

  // ── Tab principal ──
  const [tabPrincipal, setTabPrincipal] = useState<'grupos' | 'entidades' | 'cambiar' | 'borrar'>('grupos')

  // ── Estado compartido ──
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [cargando, setCargando] = useState(true)

  // ── Tab Grupos ──
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null)
  const [entidadesGrupo, setEntidadesGrupo] = useState<Entidad[]>([])
  const [usuariosGrupo, setUsuariosGrupo] = useState<UsuarioGrupo[]>([])
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [tabActivo, setTabActivo] = useState<'entidades' | 'usuarios'>('entidades')
  const [busquedaGrupos, setBusquedaGrupos] = useState('')
  const [busquedaEntidades, setBusquedaEntidades] = useState('')
  const [busquedaUsuariosLista, setBusquedaUsuariosLista] = useState('')

  const [modalGrupo, setModalGrupo] = useState(false)
  const [grupoEditando, setGrupoEditando] = useState<Grupo | null>(null)
  const [formGrupo, setFormGrupo] = useState({ codigo_grupo: '', nombre: '', alias: '', descripcion: '', tipo_acceso: 'USUARIO' as TipoElemento, prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false, md: '' })
  const [tabModalGrupo, setTabModalGrupo] = useState<'datos' | 'usuarios' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [usuariosModalGrupo, setUsuariosModalGrupo] = useState<UsuarioGrupo[]>([])
  const [cargandoUsuariosModal, setCargandoUsuariosModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [generandoMdGrupo, setGenerandoMdGrupo] = useState(false)
  const [sincronizandoMdGrupo, setSincronizandoMdGrupo] = useState(false)
  const [mensajeMdGrupo, setMensajeMdGrupo] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [usuarioNuevo, setUsuarioNuevo] = useState('')
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [dropdownAbierto, setDropdownAbierto] = useState(false)
  const [asignandoUsuario, setAsignandoUsuario] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [modalEntidad, setModalEntidad] = useState(false)
  const [entidadEditando, setEntidadEditando] = useState<Entidad | null>(null)
  const [formEntidad, setFormEntidad] = useState({ codigo_entidad: '', nombre: '', descripcion: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false, md: '' })
  const [guardandoEntidad, setGuardandoEntidad] = useState(false)
  const [errorEntidad, setErrorEntidad] = useState('')
  const [confirmarDesactivar, setConfirmarDesactivar] = useState<Entidad | null>(null)
  const [tabModalEntidad, setTabModalEntidad] = useState<'datos' | 'usuarios' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMdEntidad, setGenerandoMdEntidad] = useState(false)
  const [sincronizandoMdEntidad, setSincronizandoMdEntidad] = useState(false)
  const [mensajeMdEntidad, setMensajeMdEntidad] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [confirmarBorrarGrupo, setConfirmarBorrarGrupo] = useState<Grupo | null>(null)
  const [textoBorrar, setTextoBorrar] = useState('')
  const [borrandoGrupo, setBorrandoGrupo] = useState(false)

  type UsuarioEntidad = { codigo_usuario: string; usuarios: { nombre_usuario: string} }
  const [usuariosEntidad, setUsuariosEntidad] = useState<UsuarioEntidad[]>([])
  const [cargandoUsuariosEntidad, setCargandoUsuariosEntidad] = useState(false)
  const [usuarioNuevoEnt, setUsuarioNuevoEnt] = useState('')
  const [busquedaUsuarioEnt, setBusquedaUsuarioEnt] = useState('')
  const [dropdownEntAbierto, setDropdownEntAbierto] = useState(false)
  const [asignandoUsuarioEnt, setAsignandoUsuarioEnt] = useState(false)
  const dropdownEntRef = useRef<HTMLDivElement>(null)

  // ── Tab Cambiar Grupo ──
  const [busquedaCambio, setBusquedaCambio] = useState('')
  const [grupoCambioSeleccionado, setGrupoCambioSeleccionado] = useState<string | null>(null)
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const [errorCambio, setErrorCambio] = useState<string | null>(null)
  const [dropdownCambioAbierto, setDropdownCambioAbierto] = useState(false)

  // ── Tab Borrar Grupo ──
  const [busquedaBorrar, setBusquedaBorrar] = useState('')
  const [paginaBorrar, setPaginaBorrar] = useState(1)
  const [grupoSeleccionadoBorrar, setGrupoSeleccionadoBorrar] = useState<Grupo | null>(null)
  const [textoBorrarTab, setTextoBorrarTab] = useState('')
  const [borrandoGrupoTab, setBorrandoGrupoTab] = useState(false)
  const [errorBorrarTab, setErrorBorrarTab] = useState('')
  const [exitoBorrarTab, setExitoBorrarTab] = useState('')

  // ── Carga principal ──
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [g, u] = await Promise.all([gruposApi.listar(), usuariosApi.listar()])
      setGrupos(g)
      setTodosUsuarios(u)
      if (g.length > 0 && !grupoSeleccionado) setGrupoSeleccionado(g[0])
    } finally {
      setCargando(false)
    }
  }, [grupoSeleccionado])

  const reordenarGrupos = async (nuevos: Grupo[]) => {
    const conOrden = nuevos.map((g, idx) => ({ ...g, orden: idx + 1 }))
    const filtrados = grupos.filter((g) =>
      busquedaGrupos.length === 0 ||
      g.nombre.toLowerCase().includes(busquedaGrupos.toLowerCase()) ||
      g.codigo_grupo.toLowerCase().includes(busquedaGrupos.toLowerCase())
    )
    if (busquedaGrupos) {
      const resto = grupos.filter((g) => !filtrados.find((f) => f.codigo_grupo === g.codigo_grupo))
      setGrupos([...resto, ...conOrden])
    } else {
      setGrupos(conOrden)
    }
    try {
      await gruposApi.reordenar(conOrden.map((g) => ({ codigo_grupo: g.codigo_grupo, orden: g.orden ?? 0 })))
    } catch { cargar() }
  }

  const cargarDetalle = useCallback(async (codigoGrupo: string) => {
    setCargandoDetalle(true)
    try {
      const [ents, usrs] = await Promise.all([
        gruposApi.listarEntidades(codigoGrupo),
        gruposApi.listarUsuarios(codigoGrupo),
      ])
      setEntidadesGrupo(ents)
      setUsuariosGrupo(usrs)
    } finally {
      setCargandoDetalle(false)
    }
  }, [])

  useEffect(() => { cargar() }, []) // eslint-disable-line
  useEffect(() => { if (grupoSeleccionado) cargarDetalle(grupoSeleccionado.codigo_grupo) }, [grupoSeleccionado, cargarDetalle])
  useEffect(() => { setPaginaBorrar(1) }, [busquedaBorrar])

  // ── Funciones Tab Grupos ──
  const abrirNuevoGrupo = () => {
    setGrupoEditando(null)
    setFormGrupo({ codigo_grupo: '', nombre: '', alias: '', descripcion: '', tipo_acceso: 'USUARIO', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false, md: '' })
    setTabModalGrupo('datos')
    setError('')
    setMensajeMdGrupo(null)
    setModalGrupo(true)
  }

  const abrirEditarGrupo = async (g: Grupo) => {
    setGrupoEditando(g)
    const g2 = g as unknown as Record<string, unknown>
    setFormGrupo({ codigo_grupo: g.codigo_grupo, nombre: g.nombre, alias: g.alias || '', descripcion: g.descripcion || '', tipo_acceso: normalizarTipo(g.tipo_acceso), prompt_insert: g2.prompt_insert as string || '', prompt_update: g2.prompt_update as string || '', system_prompt: g.system_prompt || '', python_insert: g2.python_insert as string || '', python_update: g2.python_update as string || '', javascript: g2.javascript as string || '', python_editado_manual: (g2.python_editado_manual as boolean) ?? false, javascript_editado_manual: (g2.javascript_editado_manual as boolean) ?? false, md: g2.md as string || '' })
    setTabModalGrupo('datos')
    setError('')
    setMensajeMdGrupo(null)
    setUsuariosModalGrupo([])
    setModalGrupo(true)
    setCargandoUsuariosModal(true)
    try {
      const usrs = await gruposApi.listarUsuarios(g.codigo_grupo)
      setUsuariosModalGrupo(usrs)
    } finally {
      setCargandoUsuariosModal(false)
    }
  }

  const guardarGrupo = async (cerrar: boolean) => {
    if (!formGrupo.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      if (grupoEditando) {
        await gruposApi.actualizar(grupoEditando.codigo_grupo, { nombre: formGrupo.nombre, alias: formGrupo.alias || undefined, descripcion: formGrupo.descripcion || undefined, prompt_insert: formGrupo.prompt_insert || undefined, prompt_update: formGrupo.prompt_update || undefined, system_prompt: formGrupo.system_prompt || undefined, python_insert: formGrupo.python_insert || undefined, python_update: formGrupo.python_update || undefined, javascript: formGrupo.javascript || undefined, python_editado_manual: formGrupo.python_editado_manual, javascript_editado_manual: formGrupo.javascript_editado_manual, md: formGrupo.md || undefined } as Record<string, unknown>)
        if (cerrar) setModalGrupo(false)
      } else {
        const nuevo = await gruposApi.crear({ nombre: formGrupo.nombre, alias: formGrupo.alias || undefined, descripcion: formGrupo.descripcion || undefined })
        if (cerrar) {
          setModalGrupo(false)
        } else {
          setGrupoEditando(nuevo)
          const n2 = nuevo as unknown as Record<string, unknown>
          setFormGrupo({ codigo_grupo: nuevo.codigo_grupo, nombre: nuevo.nombre, alias: nuevo.alias || '', descripcion: nuevo.descripcion || '', tipo_acceso: normalizarTipo(nuevo.tipo_acceso), prompt_insert: n2.prompt_insert as string || '', prompt_update: n2.prompt_update as string || '', system_prompt: nuevo.system_prompt || '', python_insert: n2.python_insert as string || '', python_update: n2.python_update as string || '', javascript: n2.javascript as string || '', python_editado_manual: (n2.python_editado_manual as boolean) ?? false, javascript_editado_manual: (n2.javascript_editado_manual as boolean) ?? false, md: n2.md as string || '' })
        }
      }
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  const asignarUsuarioAlGrupo = async () => {
    if (!usuarioNuevo || !grupoSeleccionado) return
    setAsignandoUsuario(true)
    setError('')
    try {
      await usuariosApi.asignarGrupo(usuarioNuevo, grupoSeleccionado.codigo_grupo)
      setUsuarioNuevo('')
      cargarDetalle(grupoSeleccionado.codigo_grupo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar usuario')
    } finally {
      setAsignandoUsuario(false)
    }
  }

  const quitarUsuarioDelGrupo = async (codigoUsuario: string) => {
    if (!grupoSeleccionado) return
    setError('')
    try {
      await gruposApi.quitarUsuario(grupoSeleccionado.codigo_grupo, codigoUsuario)
      cargarDetalle(grupoSeleccionado.codigo_grupo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar usuario')
    }
  }

  const abrirNuevaEntidad = () => {
    setEntidadEditando(null)
    setFormEntidad({ codigo_entidad: '', nombre: '', descripcion: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false, md: '' })
    setErrorEntidad('')
    setTabModalEntidad('datos')
    setMensajeMdEntidad(null)
    setModalEntidad(true)
  }

  const abrirEditarEntidad = async (e: Entidad) => {
    setEntidadEditando(e)
    const e2 = e as unknown as Record<string, unknown>
    setFormEntidad({
      codigo_entidad: e.codigo_entidad,
      nombre: e.nombre,
      descripcion: e.descripcion || '',
      prompt_insert: (e2.prompt_insert as string) || '',
      prompt_update: (e2.prompt_update as string) || '',
      system_prompt: (e2.system_prompt as string) || '',
      python_insert: (e2.python_insert as string) || '',
      python_update: (e2.python_update as string) || '',
      javascript: (e2.javascript as string) || '',
      python_editado_manual: (e2.python_editado_manual as boolean) ?? false,
      javascript_editado_manual: (e2.javascript_editado_manual as boolean) ?? false,
      md: (e2.md as string) || '',
    })
    setErrorEntidad('')
    setTabModalEntidad('datos')
    setMensajeMdEntidad(null)
    setBusquedaUsuarioEnt('')
    setUsuarioNuevoEnt('')
    setModalEntidad(true)
    setCargandoUsuariosEntidad(true)
    try {
      setUsuariosEntidad(await entidadesApi.listarUsuarios(e.codigo_entidad, grupoSeleccionado?.codigo_grupo))
    } finally {
      setCargandoUsuariosEntidad(false)
    }
  }

  const guardarEntidad = async (cerrar: boolean) => {
    if (!formEntidad.nombre) { setErrorEntidad('El nombre es obligatorio'); return }
    setGuardandoEntidad(true)
    try {
      if (entidadEditando) {
        await entidadesApi.actualizar(entidadEditando.codigo_entidad, {
          nombre: formEntidad.nombre,
          descripcion: formEntidad.descripcion || undefined,
          prompt_insert: formEntidad.prompt_insert || undefined,
          prompt_update: formEntidad.prompt_update || undefined,
          system_prompt: formEntidad.system_prompt || undefined,
          python_insert: formEntidad.python_insert || undefined,
          python_update: formEntidad.python_update || undefined,
          javascript: formEntidad.javascript || undefined,
          python_editado_manual: formEntidad.python_editado_manual,
          javascript_editado_manual: formEntidad.javascript_editado_manual,
          md: formEntidad.md || undefined,
        } as Record<string, unknown>)
        if (cerrar) setModalEntidad(false)
      } else {
        const nueva = await entidadesApi.crear({ nombre: formEntidad.nombre, descripcion: formEntidad.descripcion || undefined, codigo_grupo: grupoSeleccionado?.codigo_grupo })
        if (cerrar) {
          setModalEntidad(false)
        } else {
          setEntidadEditando(nueva)
          const n2 = nueva as unknown as Record<string, unknown>
          setFormEntidad({
            codigo_entidad: nueva.codigo_entidad,
            nombre: nueva.nombre,
            descripcion: nueva.descripcion || '',
            prompt_insert: (n2.prompt_insert as string) || '',
            prompt_update: (n2.prompt_update as string) || '',
            system_prompt: (n2.system_prompt as string) || '',
            python_insert: (n2.python_insert as string) || '',
            python_update: (n2.python_update as string) || '',
            javascript: (n2.javascript as string) || '',
            python_editado_manual: (n2.python_editado_manual as boolean) ?? false,
            javascript_editado_manual: (n2.javascript_editado_manual as boolean) ?? false,
            md: (n2.md as string) || '',
          })
          setCargandoUsuariosEntidad(true)
          try {
            setUsuariosEntidad(await entidadesApi.listarUsuarios(nueva.codigo_entidad, grupoSeleccionado?.codigo_grupo))
          } finally {
            setCargandoUsuariosEntidad(false)
          }
        }
      }
      if (grupoSeleccionado) cargarDetalle(grupoSeleccionado.codigo_grupo)
    } catch (e) {
      setErrorEntidad(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardandoEntidad(false)
    }
  }

  const borrarGrupoCompleto = async () => {
    if (!confirmarBorrarGrupo) return
    setBorrandoGrupo(true)
    try {
      await gruposApi.borrarCompleto(confirmarBorrarGrupo.codigo_grupo)
      setConfirmarBorrarGrupo(null)
      setTextoBorrar('')
      setGrupoSeleccionado(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al borrar grupo')
    } finally {
      setBorrandoGrupo(false)
    }
  }

  const desactivarEntidad = async (entidad: Entidad) => {
    try {
      await entidadesApi.desactivar(entidad.codigo_entidad)
      if (grupoSeleccionado) cargarDetalle(grupoSeleccionado.codigo_grupo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al desactivar')
    }
    setConfirmarDesactivar(null)
  }

  const asignarUsuarioAEntidad = async () => {
    if (!usuarioNuevoEnt || !entidadEditando || !grupoSeleccionado) return
    setAsignandoUsuarioEnt(true)
    try {
      await usuariosApi.asignarEntidad(usuarioNuevoEnt, entidadEditando.codigo_entidad, grupoSeleccionado.codigo_grupo)
      setUsuarioNuevoEnt('')
      setBusquedaUsuarioEnt('')
      setUsuariosEntidad(await entidadesApi.listarUsuarios(entidadEditando.codigo_entidad, grupoSeleccionado?.codigo_grupo))
    } catch (e) {
      setErrorEntidad(e instanceof Error ? e.message : 'Error al asignar')
    } finally {
      setAsignandoUsuarioEnt(false)
    }
  }

  const quitarUsuarioDeEntidad = async (codigoUsuario: string) => {
    if (!entidadEditando) return
    try {
      await usuariosApi.quitarEntidad(codigoUsuario, entidadEditando.codigo_entidad)
      setUsuariosEntidad(await entidadesApi.listarUsuarios(entidadEditando.codigo_entidad, grupoSeleccionado?.codigo_grupo))
    } catch (e) {
      setErrorEntidad(e instanceof Error ? e.message : 'Error al quitar')
    }
  }

  const usuariosDisponiblesEnt = todosUsuarios.filter((u) =>
    !usuariosEntidad.some((ue) => ue.codigo_usuario === u.codigo_usuario) &&
    usuariosGrupo.some((ug) => ug.codigo_usuario === u.codigo_usuario)
  )
  const usuariosFiltradosEnt = usuariosDisponiblesEnt.filter((u) =>
    busquedaUsuarioEnt.length === 0 ||
    u.nombre.toLowerCase().includes(busquedaUsuarioEnt.toLowerCase()) ||
    u.codigo_usuario.toLowerCase().includes(busquedaUsuarioEnt.toLowerCase())
  )
  const usuariosDisponibles = todosUsuarios.filter((u) =>
    !usuariosGrupo.some((ug) => ug.codigo_usuario === u.codigo_usuario)
  )
  const usuariosFiltrados = usuariosDisponibles.filter((u) =>
    busquedaUsuario.length === 0 ||
    u.nombre.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
    u.codigo_usuario.toLowerCase().includes(busquedaUsuario.toLowerCase())
  )
  const gruposFiltrados = grupos.filter((g) =>
    busquedaGrupos.length === 0 ||
    g.nombre.toLowerCase().includes(busquedaGrupos.toLowerCase()) ||
    g.codigo_grupo.toLowerCase().includes(busquedaGrupos.toLowerCase())
  )

  const entidadesFiltradas = entidadesGrupo
    .filter((e) => e.nombre.toLowerCase().includes(busquedaEntidades.toLowerCase()) || e.codigo_entidad.toLowerCase().includes(busquedaEntidades.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const usuariosListaFiltrados = usuariosGrupo.filter((u) => {
    const nombre = u.usuarios?.nombre ?? u.codigo_usuario
    return nombre.toLowerCase().includes(busquedaUsuariosLista.toLowerCase()) || u.codigo_usuario.toLowerCase().includes(busquedaUsuariosLista.toLowerCase())
  })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownEntRef.current && !dropdownEntRef.current.contains(e.target as Node)) setDropdownEntAbierto(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownAbierto(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Funciones Tab Cambiar Grupo ──
  const gruposCambioFiltrados = grupos.filter((g) =>
    busquedaCambio.length === 0 ||
    g.nombre.toLowerCase().includes(busquedaCambio.toLowerCase()) ||
    g.codigo_grupo.toLowerCase().includes(busquedaCambio.toLowerCase())
  )
  const grupoActualNombre = grupos.find((g) => g.codigo_grupo === usuario?.grupo_activo)?.nombre || usuario?.grupo_activo
  const grupoCambioNombre = grupos.find((g) => g.codigo_grupo === grupoCambioSeleccionado)?.nombre || grupoCambioSeleccionado

  async function confirmarCambioGrupo() {
    if (!grupoCambioSeleccionado) return
    setGuardandoCambio(true)
    setErrorCambio(null)
    try {
      await usuariosApi.cambiarGrupoPropio(grupoCambioSeleccionado)
      router.push('/dashboard')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setErrorCambio(err?.response?.data?.detail || 'Error al cambiar el grupo.')
      setGuardandoCambio(false)
    }
  }

  // ── Funciones Tab Borrar Grupo ──
  const gruposBorrarFiltrados = grupos
    .filter((g) => g.tipo_acceso !== 'SISTEMA' && g.codigo_grupo !== 'ADMIN')
    .filter((g) =>
      busquedaBorrar.length === 0 ||
      g.nombre.toLowerCase().includes(busquedaBorrar.toLowerCase()) ||
      g.codigo_grupo.toLowerCase().includes(busquedaBorrar.toLowerCase())
    )
  const totalPaginasBorrar = Math.max(1, Math.ceil(gruposBorrarFiltrados.length / PAGE_SIZE))
  const gruposPaginaBorrar = gruposBorrarFiltrados.slice((paginaBorrar - 1) * PAGE_SIZE, paginaBorrar * PAGE_SIZE)

  const borrarGrupoTab = async () => {
    if (!grupoSeleccionadoBorrar) return
    setBorrandoGrupoTab(true)
    setErrorBorrarTab('')
    try {
      await gruposApi.borrarCompleto(grupoSeleccionadoBorrar.codigo_grupo)
      setExitoBorrarTab(`El grupo "${grupoSeleccionadoBorrar.nombre}" fue eliminado correctamente.`)
      setGrupoSeleccionadoBorrar(null)
      setTextoBorrarTab('')
      cargar()
    } catch (e) {
      setErrorBorrarTab(e instanceof Error ? e.message : 'Error al borrar grupo')
    } finally {
      setBorrandoGrupoTab(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />

      {/* Header */}
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">Gestion de grupos, entidades y usuarios asociados</p>
      </div>

      {/* Lenguetas principales */}
      <div className="flex border-b border-borde -mt-2">
        {esSuperAdmin() && (
          <button
            onClick={() => setTabPrincipal('grupos')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tabPrincipal === 'grupos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'
            }`}
          >
            Grupos
          </button>
        )}
        {esSuperAdmin() && (
          <button
            onClick={() => setTabPrincipal('entidades')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tabPrincipal === 'entidades' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'
            }`}
          >
            Entidades
          </button>
        )}
        <button
          onClick={() => setTabPrincipal('cambiar')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tabPrincipal === 'cambiar' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'
          }`}
        >
          Cambiar Grupo
        </button>
        {esSuperAdmin() && (
          <button
            onClick={() => setTabPrincipal('borrar')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tabPrincipal === 'borrar' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'
            }`}
          >
            Borrar Grupo
          </button>
        )}
      </div>

      {/* ═══════════════════ TAB 1: GRUPOS ═══════════════════ */}
      {tabPrincipal === 'grupos' && (
        !esSuperAdmin() ? (
          <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
            No tienes permisos para acceder a esta sección.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="max-w-sm flex-1">
                <Input placeholder={t('filtrarPlaceholder')} value={busquedaGrupos} onChange={(e) => setBusquedaGrupos(e.target.value)} icono={<Search size={15} />} />
              </div>
              <div className="flex gap-2 ml-auto">
                <Boton variante="contorno" tamano="sm" disabled={gruposFiltrados.length === 0}
                  onClick={() => exportarExcel(gruposFiltrados as unknown as Record<string, unknown>[], [
                    { titulo: 'Código', campo: 'codigo_grupo' },
                    { titulo: 'Nombre', campo: 'nombre' },
                    { titulo: 'Tipo', campo: 'tipo' },
                    { titulo: 'Descripción', campo: 'descripcion' },
                  ], 'grupos')}>
                  <Download size={15} />Excel
                </Boton>
                <Boton variante="primario" onClick={abrirNuevoGrupo}><Plus size={16} />{t('nuevoGrupo')}</Boton>
              </div>
            </div>

            {cargando ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-surface border border-borde rounded-xl animate-pulse" />
                ))}
              </div>
            ) : gruposFiltrados.length === 0 ? (
              <p className="text-sm text-texto-muted py-4 text-center">
                {busquedaGrupos ? 'No se encontraron grupos' : 'No hay grupos registrados'}
              </p>
            ) : (
              <Tabla>
                <TablaCabecera>
                  <tr>
                    <TablaTh className="w-8" />
                    <TablaTh>Nombre</TablaTh>
                    <TablaTh>Código</TablaTh>
                    <TablaTh>Tipo</TablaTh>
                    <TablaTh className="text-right">Acciones</TablaTh>
                  </tr>
                </TablaCabecera>
                <TablaCuerpo>
                  <SortableDndContext
                    items={gruposFiltrados as unknown as Record<string, unknown>[]}
                    getId={(item) => (item as unknown as Grupo).codigo_grupo}
                    onReorder={(items) => reordenarGrupos(items as unknown as Grupo[])}
                  >
                    {gruposFiltrados.map((g) => (
                      <SortableRow key={g.codigo_grupo} id={g.codigo_grupo}>
                        <TablaTd onDoubleClick={() => abrirEditarGrupo(g)}><button className={`text-sm font-medium text-left w-full${grupoSeleccionado?.codigo_grupo === g.codigo_grupo ? ' text-primario' : ' text-texto'}`} onClick={() => setGrupoSeleccionado(g)}>{g.nombre}</button></TablaTd>
                        <TablaTd onDoubleClick={() => { setGrupoSeleccionado(g); setTabPrincipal('entidades') }}><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{g.codigo_grupo}</code></TablaTd>
                        <TablaTd onDoubleClick={() => { setGrupoSeleccionado(g); setTabPrincipal('entidades') }}><Insignia variante={varianteTipo(g.tipo_acceso)}>{etiquetaTipo(g.tipo_acceso)}</Insignia></TablaTd>
                        <TablaTd>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setGrupoSeleccionado(g); setTabPrincipal('entidades') }} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Ver entidades"><Eye size={14} /></button>
                            <button onClick={() => abrirEditarGrupo(g)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          </div>
                        </TablaTd>
                      </SortableRow>
                    ))}
                  </SortableDndContext>
                </TablaCuerpo>
              </Tabla>
            )}
          </>
        )
      )}

      {/* ═══════════════════ TAB 2: ENTIDADES ═══════════════════ */}
      {tabPrincipal === 'entidades' && (
        !esSuperAdmin() ? (
          <div className="flex items-center justify-center h-48 text-texto-muted text-sm">No tienes permisos para acceder a esta sección.</div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <p className="text-sm text-texto-muted">Grupo:</p>
              <select
                value={grupoSeleccionado?.codigo_grupo || ''}
                onChange={(e) => {
                  const g = grupos.find((x) => x.codigo_grupo === e.target.value) || null
                  setGrupoSeleccionado(g)
                }}
                className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario"
              >
                <option value="">Selecciona un grupo</option>
                {grupos.map((g) => <option key={g.codigo_grupo} value={g.codigo_grupo}>{g.nombre}</option>)}
              </select>
              {grupoSeleccionado && (
                <Boton variante="primario" tamano="sm" onClick={abrirNuevaEntidad}><Plus size={14} /> Nueva entidad</Boton>
              )}
            </div>

            {!grupoSeleccionado ? (
              <div className="bg-primario-muy-claro/50 border border-primario/20 rounded-lg px-4 py-3">
                <p className="text-sm text-primario-oscuro">Selecciona un grupo para ver sus entidades, o haz doble clic en un grupo de la lengüeta anterior.</p>
              </div>
            ) : cargandoDetalle ? (
              <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
            ) : (
              <Tabla>
                <TablaCabecera><tr>
                  <TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr></TablaCabecera>
                <TablaCuerpo>
                  {entidadesFiltradas.length === 0 ? (
                    <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={4 as never}>No hay entidades en este grupo</TablaTd></TablaFila>
                  ) : entidadesFiltradas.map((e) => (
                    <TablaFila key={e.codigo_entidad}>
                      <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{e.codigo_entidad}</code></TablaTd>
                      <TablaTd className="font-medium">{e.nombre}</TablaTd>
                      <TablaTd>
                        <Insignia variante='exito'>
                          Activo
                        </Insignia>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarEntidad(e)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmarDesactivar(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Desactivar"><Building2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            )}
          </>
        )
      )}

      {/* ═══════════════════ TAB 3: CAMBIAR GRUPO ═══════════════════ */}
      {tabPrincipal === 'cambiar' && (
        <div className="max-w-md p-6 bg-surface rounded-xl border border-borde shadow-sm">
          <h3 className="section-heading mb-1">Cambiar de Grupo</h3>
          <p className="text-sm text-texto-muted mb-6">
            Grupo actual:{' '}
            <span className="font-medium text-texto">{grupoActualNombre}</span>
          </p>

          {cargando ? (
            <div className="text-sm text-texto-muted py-4">Cargando grupos…</div>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-texto mb-1">Seleccionar nuevo grupo</label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full border border-borde rounded-lg px-3 py-2 text-sm text-texto bg-fondo focus:outline-none focus:ring-2 focus:ring-primario/40"
                    placeholder="Buscar grupo…"
                    value={grupoCambioSeleccionado ? (dropdownCambioAbierto ? busquedaCambio : grupoCambioNombre || '') : busquedaCambio}
                    onFocus={() => { setDropdownCambioAbierto(true); if (grupoCambioSeleccionado) setBusquedaCambio('') }}
                    onBlur={() => setTimeout(() => setDropdownCambioAbierto(false), 150)}
                    onChange={(e) => { setBusquedaCambio(e.target.value); if (grupoCambioSeleccionado) setGrupoCambioSeleccionado(null); setDropdownCambioAbierto(true) }}
                  />
                  {dropdownCambioAbierto && gruposCambioFiltrados.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-surface border border-borde rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {gruposCambioFiltrados.map((g) => (
                        <li
                          key={g.codigo_grupo}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-primario-muy-claro ${
                            g.codigo_grupo === usuario?.grupo_activo ? 'opacity-40 cursor-not-allowed' : ''
                          } ${grupoCambioSeleccionado === g.codigo_grupo ? 'bg-primario-muy-claro font-medium' : ''}`}
                          onMouseDown={() => {
                            if (g.codigo_grupo === usuario?.grupo_activo) return
                            setGrupoCambioSeleccionado(g.codigo_grupo)
                            setBusquedaCambio('')
                            setDropdownCambioAbierto(false)
                          }}
                        >
                          <span className="font-medium">{g.nombre}</span>
                          <span className="ml-2 text-xs text-texto-muted">{g.codigo_grupo}</span>
                          {g.codigo_grupo === usuario?.grupo_activo && (
                            <span className="ml-2 text-xs text-texto-muted">(actual)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {dropdownCambioAbierto && gruposCambioFiltrados.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-surface border border-borde rounded-lg shadow-lg px-3 py-2 text-sm text-texto-muted">
                      Sin resultados
                    </div>
                  )}
                </div>
              </div>

              {grupoCambioSeleccionado && grupoCambioSeleccionado !== usuario?.grupo_activo && (
                <div className="mb-4 p-3 rounded-lg bg-primario-muy-claro border border-primario/20 text-sm text-texto">
                  Cambiar a: <span className="font-semibold">{grupoCambioNombre}</span>
                </div>
              )}

              {errorCambio && (
                <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/30 text-sm text-error">
                  {errorCambio}
                </div>
              )}

              <button
                onClick={confirmarCambioGrupo}
                disabled={!grupoCambioSeleccionado || grupoCambioSeleccionado === usuario?.grupo_activo || guardandoCambio}
                className="w-full bg-primario text-primario-texto rounded-lg py-2 text-sm font-medium hover:bg-primario-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {guardandoCambio ? 'Cambiando…' : 'Confirmar cambio de grupo'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB 3: BORRAR GRUPO ═══════════════════ */}
      {tabPrincipal === 'borrar' && (
        !esSuperAdmin() ? (
          <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
            No tienes permisos para acceder a esta sección.
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-3xl">
            <p className="text-sm text-texto-muted -mt-2">
              Elimina permanentemente un grupo junto con todas sus entidades, usuarios, documentos, roles y parámetros.
              Esta acción es irreversible.
            </p>

            {exitoBorrarTab && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-sm text-green-800">{exitoBorrarTab}</p>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Zona de peligro</p>
                <p className="mt-1">
                  Al borrar un grupo se eliminan en cascada todas sus entidades, documentos vectorizados,
                  parámetros de configuración, roles y usuarios asociados. Los grupos de tipo SISTEMA
                  y el grupo ADMIN no pueden ser eliminados.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-texto-muted uppercase tracking-wider">
                  Selecciona el grupo a eliminar
                </h3>
                {!cargando && (
                  <span className="text-xs text-texto-muted">
                    {gruposBorrarFiltrados.length} grupo{gruposBorrarFiltrados.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={busquedaBorrar}
                  onChange={(e) => setBusquedaBorrar(e.target.value)}
                  className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>

              {cargando ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 bg-surface border border-borde rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : gruposBorrarFiltrados.length === 0 ? (
                <div className="text-sm text-texto-muted text-center py-8 border border-borde rounded-xl bg-surface">
                  {busquedaBorrar ? 'No se encontraron grupos con ese criterio.' : 'No hay grupos disponibles para eliminar.'}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {gruposPaginaBorrar.map((g) => (
                      <button
                        key={g.codigo_grupo}
                        onClick={() => { setGrupoSeleccionadoBorrar(g); setTextoBorrarTab(''); setErrorBorrarTab(''); setExitoBorrarTab('') }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors border-borde bg-surface hover:border-red-300 hover:bg-red-50"
                      >
                        <div className="p-2 rounded-lg bg-fondo text-texto-muted">
                          <Layers size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-texto truncate">{g.nombre}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-texto-muted">{g.codigo_grupo}</p>
                            <Insignia variante={varianteTipo(g.tipo_acceso)}>{etiquetaTipo(g.tipo_acceso)}</Insignia>
                          </div>
                        </div>
                        <Trash2 size={16} className="text-red-400 shrink-0" />
                      </button>
                    ))}
                  </div>

                  {totalPaginasBorrar > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-texto-muted">Página {paginaBorrar} de {totalPaginasBorrar}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPaginaBorrar((p) => Math.max(1, p - 1))}
                          disabled={paginaBorrar === 1}
                          className="p-1.5 rounded-lg border border-borde bg-surface hover:bg-fondo disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: totalPaginasBorrar }, (_, i) => i + 1)
                          .filter((n) => n === 1 || n === totalPaginasBorrar || Math.abs(n - paginaBorrar) <= 1)
                          .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                            if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...')
                            acc.push(n)
                            return acc
                          }, [])
                          .map((item, idx) =>
                            item === '...' ? (
                              <span key={`e${idx}`} className="px-1 text-xs text-texto-muted">…</span>
                            ) : (
                              <button
                                key={item}
                                onClick={() => setPaginaBorrar(item as number)}
                                className={`min-w-[28px] h-7 rounded-lg border text-xs font-medium transition-colors ${
                                  paginaBorrar === item
                                    ? 'border-primario bg-primario text-primario-texto'
                                    : 'border-borde bg-surface hover:bg-fondo text-texto'
                                }`}
                              >
                                {item}
                              </button>
                            )
                          )}
                        <button
                          onClick={() => setPaginaBorrar((p) => Math.min(totalPaginasBorrar, p + 1))}
                          disabled={paginaBorrar === totalPaginasBorrar}
                          className="p-1.5 rounded-lg border border-borde bg-surface hover:bg-fondo disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      )}

      {/* ═══════════ MODALES ═══════════ */}

      {/* Modal grupo */}
      <Modal abierto={modalGrupo} alCerrar={() => setModalGrupo(false)} titulo={grupoEditando ? 'Editar grupo' : 'Nuevo grupo'} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px] min-h-[500px]">
          <div className="flex border-b border-borde">
            {(['datos', ...(grupoEditando ? ['usuarios', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] : [])] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalGrupo(tab as typeof tabModalGrupo)}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalGrupo === tab ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : tab === 'usuarios' ? `Usuarios${usuariosModalGrupo.length > 0 ? ` (${usuariosModalGrupo.length})` : ''}` : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : tab === 'programacion_update' ? 'Prog. Update' : '.md'}
              </button>
            ))}
          </div>

          {tabModalGrupo === 'datos' && (
            <>
              <div className="grid grid-cols-[180px_1fr_220px] gap-3">
                <Input etiqueta="Código" value={formGrupo.codigo_grupo} disabled readOnly placeholder="(autogenerado)" />
                <Input etiqueta={t('etiquetaNombre')} value={formGrupo.nombre} onChange={(e) => setFormGrupo({ ...formGrupo, nombre: e.target.value })} placeholder={t('placeholderNombre')} />
                <Input etiqueta="Alias" value={formGrupo.alias} onChange={(e) => setFormGrupo({ ...formGrupo, alias: e.target.value })} placeholder="(igual al nombre si vacío)" />
              </div>
              <Textarea etiqueta="Descripción" value={formGrupo.descripcion} onChange={(e) => setFormGrupo({ ...formGrupo, descripcion: e.target.value })} rows={3} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Tipo</label>
                <div className="flex items-center gap-2 py-1">
                  <Insignia variante={varianteTipo(formGrupo.tipo_acceso)}>{etiquetaTipo(formGrupo.tipo_acceso)}</Insignia>
                  <span className="text-xs text-texto-muted">Solo modificable desde la base de datos</span>
                </div>
              </div>
            </>
          )}

          {tabModalGrupo === 'usuarios' && grupoEditando && (
            <div className="flex flex-col gap-3 flex-1">
              {cargandoUsuariosModal ? (
                <div className="text-sm text-texto-muted text-center py-8">Cargando usuarios...</div>
              ) : usuariosModalGrupo.length === 0 ? (
                <div className="text-sm text-texto-muted text-center py-8">No hay usuarios en este grupo</div>
              ) : (
                <Tabla>
                  <TablaCabecera><tr><TablaTh>Nombre</TablaTh><TablaTh>Código</TablaTh></tr></TablaCabecera>
                  <TablaCuerpo>
                    {usuariosModalGrupo.map((u) => (
                      <TablaFila key={u.codigo_usuario}>
                        <TablaTd className="font-medium">{u.usuarios?.nombre ?? u.codigo_usuario}</TablaTd>
                        <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{u.codigo_usuario}</code></TablaTd>
                      </TablaFila>
                    ))}
                  </TablaCuerpo>
                </Tabla>
              )}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalGrupo(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {tabModalGrupo === 'system_prompt' && grupoEditando && (
            <TabPrompts
              tabla="grupos_entidades"
              pkColumna="codigo_grupo"
              pkValor={grupoEditando.codigo_grupo}
              campos={{
                prompt_insert: formGrupo.prompt_insert,
                prompt_update: formGrupo.prompt_update,
                system_prompt: formGrupo.system_prompt,
                python_insert: formGrupo.python_insert,
                python_update: formGrupo.python_update,
                javascript: formGrupo.javascript,
                python_editado_manual: formGrupo.python_editado_manual,
                javascript_editado_manual: formGrupo.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setFormGrupo({ ...formGrupo, [c]: v })}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {tabModalGrupo === 'programacion_insert' && grupoEditando && (
            <TabPrompts
              tabla="grupos_entidades"
              pkColumna="codigo_grupo"
              pkValor={grupoEditando.codigo_grupo}
              campos={{
                prompt_insert: formGrupo.prompt_insert,
                prompt_update: formGrupo.prompt_update,
                system_prompt: formGrupo.system_prompt,
                python_insert: formGrupo.python_insert,
                python_update: formGrupo.python_update,
                javascript: formGrupo.javascript,
                python_editado_manual: formGrupo.python_editado_manual,
                javascript_editado_manual: formGrupo.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setFormGrupo({ ...formGrupo, [c]: v })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptUpdate={false}
              mostrarPythonUpdate={false}
            />
          )}
          {tabModalGrupo === 'programacion_update' && grupoEditando && (
            <TabPrompts
              tabla="grupos_entidades"
              pkColumna="codigo_grupo"
              pkValor={grupoEditando.codigo_grupo}
              campos={{
                prompt_insert: formGrupo.prompt_insert,
                prompt_update: formGrupo.prompt_update,
                system_prompt: formGrupo.system_prompt,
                python_insert: formGrupo.python_insert,
                python_update: formGrupo.python_update,
                javascript: formGrupo.javascript,
                python_editado_manual: formGrupo.python_editado_manual,
                javascript_editado_manual: formGrupo.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setFormGrupo({ ...formGrupo, [c]: v })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptInsert={false}
              mostrarPythonInsert={false}
            />
          )}

          {tabModalGrupo === 'md' && grupoEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={formGrupo.md || ''}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMdGrupo && (
                <p className={`text-xs px-1 ${mensajeMdGrupo.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMdGrupo.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMdGrupo(true); setMensajeMdGrupo(null)
                      try {
                        const r = await gruposApi.generarMd(grupoEditando.codigo_grupo)
                        setFormGrupo((prev) => ({ ...prev, md: r.md }))
                        setMensajeMdGrupo({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMdGrupo({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMdGrupo(false) }
                    }}
                    cargando={generandoMdGrupo}
                    disabled={generandoMdGrupo || sincronizandoMdGrupo}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMdGrupo(true); setMensajeMdGrupo(null)
                      try {
                        const r = await promptsApi.sincronizarFila('grupos_entidades', 'codigo_grupo', grupoEditando.codigo_grupo)
                        setMensajeMdGrupo({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMdGrupo({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMdGrupo(false) }
                    }}
                    cargando={sincronizandoMdGrupo}
                    disabled={generandoMdGrupo || sincronizandoMdGrupo || !formGrupo.md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalGrupo(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          {tabModalGrupo !== 'md' && tabModalGrupo !== 'usuarios' && (
            <PieBotonesModal
              editando={!!grupoEditando}
              onGuardar={() => guardarGrupo(false)}
              onGuardarYSalir={() => guardarGrupo(true)}
              onCerrar={() => setModalGrupo(false)}
              cargando={guardando}
              botonesIzquierda={(tabModalGrupo === 'programacion_insert' || tabModalGrupo === 'programacion_update') && grupoEditando ? (
                <PieBotonesPrompts
                  tabla="grupos_entidades"
                  pkColumna="codigo_grupo"
                  pkValor={grupoEditando.codigo_grupo}
                  promptInsert={formGrupo.prompt_insert ?? undefined}
                  promptUpdate={formGrupo.prompt_update ?? undefined}
                  mostrarSincronizar={false}
                />
              ) : undefined}
            />
          )}
        </div>
      </Modal>

      {/* Modal entidad */}
      <Modal abierto={modalEntidad} alCerrar={() => setModalEntidad(false)} titulo={entidadEditando ? `Editar entidad: ${entidadEditando.nombre}` : 'Nueva entidad'} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px] min-h-[500px]">
          {entidadEditando && (
            <div className="flex border-b border-borde -mx-1 overflow-x-auto">
              {(['datos', 'usuarios', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabModalEntidad(tab)}
                  className={`flex-1 text-center px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${tabModalEntidad === tab ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}
                >
                  {tab === 'datos' ? t('tabDatos') : tab === 'usuarios' ? `Usuarios (${usuariosEntidad.length})` : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : tab === 'programacion_update' ? 'Prog. Update' : '.md'}
                </button>
              ))}
            </div>
          )}

          {tabModalEntidad === 'datos' && (
            <>
              <div className="grid grid-cols-[180px_1fr] gap-3">
                <Input etiqueta="Código" value={formEntidad.codigo_entidad} disabled readOnly placeholder="(autogenerado)" />
                <Input etiqueta={t('etiquetaNombre')} value={formEntidad.nombre} onChange={(e) => setFormEntidad({ ...formEntidad, nombre: e.target.value })} placeholder={t('placeholderNombreEntidad')} />
              </div>
              <Textarea etiqueta="Descripción" value={formEntidad.descripcion} onChange={(e) => setFormEntidad({ ...formEntidad, descripcion: e.target.value })} placeholder="Descripción opcional" rows={3} />
              {errorEntidad && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEntidad}</p></div>}
              <PieBotonesModal editando={!!entidadEditando} onGuardar={() => guardarEntidad(false)} onGuardarYSalir={() => guardarEntidad(true)} onCerrar={() => setModalEntidad(false)} cargando={guardandoEntidad} />
            </>
          )}

          {tabModalEntidad === 'system_prompt' && entidadEditando && (
            <>
              <TabPrompts
                tabla="entidades"
                pkColumna="codigo_entidad"
                pkValor={entidadEditando.codigo_entidad}
                campos={{
                  prompt_insert: formEntidad.prompt_insert,
                  prompt_update: formEntidad.prompt_update,
                  system_prompt: formEntidad.system_prompt,
                  python_insert: formEntidad.python_insert,
                  python_update: formEntidad.python_update,
                  javascript: formEntidad.javascript,
                  python_editado_manual: formEntidad.python_editado_manual,
                  javascript_editado_manual: formEntidad.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormEntidad({ ...formEntidad, [c]: v })}
                mostrarPromptInsert={false}
                mostrarPromptUpdate={false}
                mostrarSystemPrompt={true}
                mostrarPythonInsert={false}
                mostrarPythonUpdate={false}
                mostrarJavaScript={false}
              />
              {errorEntidad && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEntidad}</p></div>}
              <PieBotonesModal editando={!!entidadEditando} onGuardar={() => guardarEntidad(false)} onGuardarYSalir={() => guardarEntidad(true)} onCerrar={() => setModalEntidad(false)} cargando={guardandoEntidad} />
            </>
          )}

          {tabModalEntidad === 'programacion_insert' && entidadEditando && (
            <>
              <TabPrompts
                tabla="entidades"
                pkColumna="codigo_entidad"
                pkValor={entidadEditando.codigo_entidad}
                campos={{
                  prompt_insert: formEntidad.prompt_insert,
                  prompt_update: formEntidad.prompt_update,
                  system_prompt: formEntidad.system_prompt,
                  python_insert: formEntidad.python_insert,
                  python_update: formEntidad.python_update,
                  javascript: formEntidad.javascript,
                  python_editado_manual: formEntidad.python_editado_manual,
                  javascript_editado_manual: formEntidad.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormEntidad({ ...formEntidad, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
              {errorEntidad && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEntidad}</p></div>}
              <PieBotonesModal
                editando={!!entidadEditando}
                onGuardar={() => guardarEntidad(false)}
                onGuardarYSalir={() => guardarEntidad(true)}
                onCerrar={() => setModalEntidad(false)}
                cargando={guardandoEntidad}
                botonesIzquierda={(
                  <PieBotonesPrompts
                    tabla="entidades"
                    pkColumna="codigo_entidad"
                    pkValor={entidadEditando.codigo_entidad}
                    promptInsert={formEntidad.prompt_insert ?? undefined}
                    promptUpdate={formEntidad.prompt_update ?? undefined}
                    mostrarSincronizar={false}
                  />
                )}
              />
            </>
          )}

          {tabModalEntidad === 'programacion_update' && entidadEditando && (
            <>
              <TabPrompts
                tabla="entidades"
                pkColumna="codigo_entidad"
                pkValor={entidadEditando.codigo_entidad}
                campos={{
                  prompt_insert: formEntidad.prompt_insert,
                  prompt_update: formEntidad.prompt_update,
                  system_prompt: formEntidad.system_prompt,
                  python_insert: formEntidad.python_insert,
                  python_update: formEntidad.python_update,
                  javascript: formEntidad.javascript,
                  python_editado_manual: formEntidad.python_editado_manual,
                  javascript_editado_manual: formEntidad.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormEntidad({ ...formEntidad, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
              {errorEntidad && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEntidad}</p></div>}
              <PieBotonesModal
                editando={!!entidadEditando}
                onGuardar={() => guardarEntidad(false)}
                onGuardarYSalir={() => guardarEntidad(true)}
                onCerrar={() => setModalEntidad(false)}
                cargando={guardandoEntidad}
                botonesIzquierda={(
                  <PieBotonesPrompts
                    tabla="entidades"
                    pkColumna="codigo_entidad"
                    pkValor={entidadEditando.codigo_entidad}
                    promptInsert={formEntidad.prompt_insert ?? undefined}
                    promptUpdate={formEntidad.prompt_update ?? undefined}
                    mostrarSincronizar={false}
                  />
                )}
              />
            </>
          )}

          {tabModalEntidad === 'md' && entidadEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={formEntidad.md || ''}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMdEntidad && (
                <p className={`text-xs px-1 ${mensajeMdEntidad.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMdEntidad.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMdEntidad(true); setMensajeMdEntidad(null)
                      try {
                        const r = await entidadesApi.generarMd(entidadEditando.codigo_entidad)
                        setFormEntidad((prev) => ({ ...prev, md: r.md }))
                        setMensajeMdEntidad({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMdEntidad({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMdEntidad(false) }
                    }}
                    cargando={generandoMdEntidad}
                    disabled={generandoMdEntidad || sincronizandoMdEntidad}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMdEntidad(true); setMensajeMdEntidad(null)
                      try {
                        const r = await promptsApi.sincronizarFila('entidades', 'codigo_entidad', entidadEditando.codigo_entidad)
                        setMensajeMdEntidad({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMdEntidad({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMdEntidad(false) }
                    }}
                    cargando={sincronizandoMdEntidad}
                    disabled={generandoMdEntidad || sincronizandoMdEntidad || !formEntidad.md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalEntidad(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {tabModalEntidad === 'usuarios' && entidadEditando && (
            <>
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={dropdownEntRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      type="text"
                      placeholder={t('buscarUsuarioPlaceholder')}
                      value={busquedaUsuarioEnt}
                      onChange={(e) => { setBusquedaUsuarioEnt(e.target.value); setDropdownEntAbierto(true); setUsuarioNuevoEnt('') }}
                      onFocus={() => setDropdownEntAbierto(true)}
                      className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                    />
                  </div>
                  {dropdownEntAbierto && busquedaUsuarioEnt.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {usuariosFiltradosEnt.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-texto-muted">No se encontraron usuarios</div>
                      ) : usuariosFiltradosEnt.slice(0, 20).map((u) => (
                        <button
                          key={u.codigo_usuario}
                          onClick={() => { setUsuarioNuevoEnt(u.codigo_usuario); setBusquedaUsuarioEnt(`${u.nombre} (${u.codigo_usuario})`); setDropdownEntAbierto(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors"
                        >
                          <span className="font-medium">{u.nombre}</span>
                          <span className="ml-2 text-texto-muted text-xs">{u.codigo_usuario}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Boton variante="primario" onClick={asignarUsuarioAEntidad} cargando={asignandoUsuarioEnt} disabled={!usuarioNuevoEnt}>
                  <Plus size={14} /> {t('agregarUsuario')}
                </Boton>
              </div>

              {cargandoUsuariosEntidad ? (
                <div className="text-sm text-texto-muted text-center py-4">Cargando...</div>
              ) : usuariosEntidad.length === 0 ? (
                <div className="text-sm text-texto-muted text-center py-4">No hay usuarios asignados a esta entidad</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {usuariosEntidad.map((u) => (
                    <div key={u.codigo_usuario} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface">
                      <div>
                        <span className="text-sm font-medium text-texto">{u.usuarios?.nombre_usuario ?? u.codigo_usuario}</span>
                        <span className="ml-2 text-xs text-texto-muted">{u.codigo_usuario}</span>
                      </div>
                      <button onClick={() => quitarUsuarioDeEntidad(u.codigo_usuario)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {errorEntidad && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEntidad}</p></div>}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalEntidad(false)}>Salir</Boton>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Confirmar desactivar entidad */}
      <ModalConfirmar
        abierto={!!confirmarDesactivar}
        alCerrar={() => setConfirmarDesactivar(null)}
        alConfirmar={() => confirmarDesactivar && desactivarEntidad(confirmarDesactivar)}
        titulo="Desactivar entidad"
        mensaje={`¿Desea desactivar la entidad "${confirmarDesactivar?.nombre}"?`}
        variante="peligro"
      />

      {/* Modal borrado desde tab Grupos */}
      <Modal
        abierto={!!confirmarBorrarGrupo}
        alCerrar={() => { setConfirmarBorrarGrupo(null); setTextoBorrar('') }}
        titulo="Borrar grupo completo"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">Esta acción es irreversible.</p>
              <p className="mt-1">
                Se eliminará permanentemente el grupo <strong>{confirmarBorrarGrupo?.nombre}</strong> junto
                con todas sus entidades, usuarios, documentos, roles, parámetros y registros de auditoría.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1">
              Escriba exactamente: <span className="font-mono text-red-600">Borrar grupo {confirmarBorrarGrupo?.nombre}</span>
            </label>
            <Input value={textoBorrar} onChange={(e) => setTextoBorrar(e.target.value)} placeholder={`Borrar grupo ${confirmarBorrarGrupo?.nombre ?? ''}`} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Boton variante="contorno" onClick={() => { setConfirmarBorrarGrupo(null); setTextoBorrar(''); setError('') }}>Cancelar</Boton>
            <Boton variante="peligro" onClick={borrarGrupoCompleto} disabled={textoBorrar !== `Borrar grupo ${confirmarBorrarGrupo?.nombre}` || borrandoGrupo} cargando={borrandoGrupo}>
              Borrar
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal borrado desde tab Borrar Grupo */}
      <Modal
        abierto={!!grupoSeleccionadoBorrar}
        alCerrar={() => { setGrupoSeleccionadoBorrar(null); setTextoBorrarTab(''); setErrorBorrarTab('') }}
        titulo="Borrar grupo completo"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">Esta acción es irreversible.</p>
              <p className="mt-1">
                Se eliminará permanentemente el grupo <strong>{grupoSeleccionadoBorrar?.nombre}</strong> junto
                con todas sus entidades, usuarios, documentos, roles, parámetros y registros de auditoría.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1">
              Escriba exactamente:{' '}
              <span className="font-mono text-red-600">Borrar grupo {grupoSeleccionadoBorrar?.nombre}</span>
            </label>
            <Input value={textoBorrarTab} onChange={(e) => setTextoBorrarTab(e.target.value)} placeholder={`Borrar grupo ${grupoSeleccionadoBorrar?.nombre ?? ''}`} />
          </div>
          {errorBorrarTab && <p className="text-sm text-red-600">{errorBorrarTab}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Boton variante="contorno" onClick={() => { setGrupoSeleccionadoBorrar(null); setTextoBorrarTab(''); setErrorBorrarTab('') }}>Cancelar</Boton>
            <Boton
              variante="peligro"
              onClick={borrarGrupoTab}
              disabled={textoBorrarTab !== `Borrar grupo ${grupoSeleccionadoBorrar?.nombre}` || borrandoGrupoTab}
              cargando={borrandoGrupoTab}
            >
              Borrar definitivamente
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
