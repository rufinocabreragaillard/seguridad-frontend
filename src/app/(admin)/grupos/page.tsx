'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Layers, Users, Building2, X, Search, Download, Trash2, AlertTriangle } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { gruposApi, usuariosApi, entidadesApi } from '@/lib/api'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { useAuth } from '@/context/AuthContext'
import type { Grupo, Entidad, Usuario } from '@/lib/tipos'
import { etiquetaTipo, varianteTipo, normalizarTipo, type TipoElemento } from '@/lib/tipo-elemento'
import { exportarExcel } from '@/lib/exportar-excel'
import { useTranslations } from 'next-intl'

type UsuarioGrupo = { codigo_usuario: string; fecha_alta?: string; usuarios?: { nombre: string; activo: boolean } }

export default function PaginaGrupos() {
  const t = useTranslations('grupos')
  const tc = useTranslations('common')
  const { esSuperAdmin } = useAuth()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null)
  const [entidadesGrupo, setEntidadesGrupo] = useState<Entidad[]>([])
  const [usuariosGrupo, setUsuariosGrupo] = useState<UsuarioGrupo[]>([])
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [tabActivo, setTabActivo] = useState<'entidades' | 'usuarios'>('entidades')
  const [busquedaGrupos, setBusquedaGrupos] = useState('')
  const [busquedaEntidades, setBusquedaEntidades] = useState('')
  const [busquedaUsuariosLista, setBusquedaUsuariosLista] = useState('')

  const [modalGrupo, setModalGrupo] = useState(false)
  const [grupoEditando, setGrupoEditando] = useState<Grupo | null>(null)
  const [formGrupo, setFormGrupo] = useState({ codigo_grupo: '', nombre: '', descripcion: '', tipo: 'USUARIO' as TipoElemento, prompt: '', system_prompt: '' })
  const [tabModalGrupo, setTabModalGrupo] = useState<'datos' | 'prompt' | 'system_prompt'>('datos')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Asignación de usuarios al grupo
  const [usuarioNuevo, setUsuarioNuevo] = useState('')
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [dropdownAbierto, setDropdownAbierto] = useState(false)
  const [asignandoUsuario, setAsignandoUsuario] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // CRUD de entidades del grupo
  const [modalEntidad, setModalEntidad] = useState(false)
  const [entidadEditando, setEntidadEditando] = useState<Entidad | null>(null)
  const [formEntidad, setFormEntidad] = useState({ codigo_entidad: '', nombre: '', descripcion: '' })
  const [guardandoEntidad, setGuardandoEntidad] = useState(false)
  const [errorEntidad, setErrorEntidad] = useState('')
  const [confirmarDesactivar, setConfirmarDesactivar] = useState<Entidad | null>(null)
  const [tabModalEntidad, setTabModalEntidad] = useState<'datos' | 'usuarios'>('datos')

  // Borrado completo de grupo
  const [confirmarBorrarGrupo, setConfirmarBorrarGrupo] = useState<Grupo | null>(null)
  const [textoBorrar, setTextoBorrar] = useState('')
  const [borrandoGrupo, setBorrandoGrupo] = useState(false)

  // Usuarios de una entidad (dentro del modal de entidad, tab Usuarios)
  type UsuarioEntidad = { codigo_usuario: string; usuarios: { nombre_usuario: string; activo: boolean } }
  const [usuariosEntidad, setUsuariosEntidad] = useState<UsuarioEntidad[]>([])
  const [cargandoUsuariosEntidad, setCargandoUsuariosEntidad] = useState(false)
  const [usuarioNuevoEnt, setUsuarioNuevoEnt] = useState('')
  const [busquedaUsuarioEnt, setBusquedaUsuarioEnt] = useState('')
  const [dropdownEntAbierto, setDropdownEntAbierto] = useState(false)
  const [asignandoUsuarioEnt, setAsignandoUsuarioEnt] = useState(false)
  const dropdownEntRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (grupoSeleccionado) cargarDetalle(grupoSeleccionado.codigo_grupo)
  }, [grupoSeleccionado, cargarDetalle])

  const abrirNuevoGrupo = () => {
    setGrupoEditando(null)
    setFormGrupo({ codigo_grupo: '', nombre: '', descripcion: '', tipo: 'USUARIO', prompt: '', system_prompt: '' })
    setTabModalGrupo('datos')
    setError('')
    setModalGrupo(true)
  }

  const abrirEditarGrupo = (g: Grupo) => {
    setGrupoEditando(g)
    setFormGrupo({ codigo_grupo: g.codigo_grupo, nombre: g.nombre, descripcion: g.descripcion || '', tipo: normalizarTipo(g.tipo), prompt: g.prompt || '', system_prompt: g.system_prompt || '' })
    setTabModalGrupo('datos')
    setError('')
    setModalGrupo(true)
  }

  const guardarGrupo = async (cerrar: boolean) => {
    if (!formGrupo.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      if (grupoEditando) {
        await gruposApi.actualizar(grupoEditando.codigo_grupo, { nombre: formGrupo.nombre, descripcion: formGrupo.descripcion || undefined, prompt: formGrupo.prompt || undefined, system_prompt: formGrupo.system_prompt || undefined })
        if (cerrar) setModalGrupo(false)
      } else {
        const nuevo = await gruposApi.crear({ nombre: formGrupo.nombre, descripcion: formGrupo.descripcion || undefined })
        if (cerrar) {
          setModalGrupo(false)
        } else {
          setGrupoEditando(nuevo)
          setFormGrupo({ codigo_grupo: nuevo.codigo_grupo, nombre: nuevo.nombre, descripcion: nuevo.descripcion || '', tipo: normalizarTipo(nuevo.tipo), prompt: nuevo.prompt || '', system_prompt: nuevo.system_prompt || '' })
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

  // ── Entidades CRUD ──
  const abrirNuevaEntidad = () => {
    setEntidadEditando(null)
    setFormEntidad({ codigo_entidad: '', nombre: '', descripcion: '' })
    setErrorEntidad('')
    setTabModalEntidad('datos')
    setModalEntidad(true)
  }

  const abrirEditarEntidad = async (e: Entidad) => {
    setEntidadEditando(e)
    setFormEntidad({ codigo_entidad: e.codigo_entidad, nombre: e.nombre, descripcion: e.descripcion || '' })
    setErrorEntidad('')
    setTabModalEntidad('datos')
    setBusquedaUsuarioEnt('')
    setUsuarioNuevoEnt('')
    setModalEntidad(true)
    // Cargar usuarios de la entidad
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
        await entidadesApi.actualizar(entidadEditando.codigo_entidad, { nombre: formEntidad.nombre, descripcion: formEntidad.descripcion || undefined })
        if (cerrar) setModalEntidad(false)
      } else {
        const nueva = await entidadesApi.crear({ nombre: formEntidad.nombre, descripcion: formEntidad.descripcion || undefined, codigo_grupo: grupoSeleccionado?.codigo_grupo })
        if (cerrar) {
          setModalEntidad(false)
        } else {
          setEntidadEditando(nueva)
          setFormEntidad({ codigo_entidad: nueva.codigo_entidad, nombre: nueva.nombre, descripcion: nueva.descripcion || '' })
          // Cargar usuarios de la nueva entidad
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

  // ── Usuarios por entidad ──
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
    u.activo && !usuariosEntidad.some((ue) => ue.codigo_usuario === u.codigo_usuario)
  )

  const usuariosFiltradosEnt = usuariosDisponiblesEnt.filter((u) =>
    busquedaUsuarioEnt.length === 0 ||
    u.nombre.toLowerCase().includes(busquedaUsuarioEnt.toLowerCase()) ||
    u.codigo_usuario.toLowerCase().includes(busquedaUsuarioEnt.toLowerCase())
  )

  // Cerrar dropdown entidad al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownEntRef.current && !dropdownEntRef.current.contains(e.target as Node)) {
        setDropdownEntAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Usuarios disponibles para asignar (excluir los ya asignados al grupo)
  const usuariosDisponibles = todosUsuarios.filter((u) =>
    u.activo && !usuariosGrupo.some((ug) => ug.codigo_usuario === u.codigo_usuario)
  )

  // Filtro de búsqueda para el selector de usuarios
  const usuariosFiltrados = usuariosDisponibles.filter((u) =>
    busquedaUsuario.length === 0 ||
    u.nombre.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
    u.codigo_usuario.toLowerCase().includes(busquedaUsuario.toLowerCase())
  )

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Listas filtradas por búsqueda
  const entidadesFiltradas = entidadesGrupo
    .filter((e) => e.nombre.toLowerCase().includes(busquedaEntidades.toLowerCase()) || e.codigo_entidad.toLowerCase().includes(busquedaEntidades.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const usuariosListaFiltrados = usuariosGrupo
    .filter((u) => {
      const nombre = u.usuarios?.nombre ?? u.codigo_usuario
      return nombre.toLowerCase().includes(busquedaUsuariosLista.toLowerCase()) || u.codigo_usuario.toLowerCase().includes(busquedaUsuariosLista.toLowerCase())
    })

  if (!esSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
        No tienes permisos para acceder a esta seccion.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
          <p className="text-sm text-texto-muted mt-1">Gestion de grupos, entidades y usuarios asociados</p>
        </div>
        <Boton variante="primario" onClick={abrirNuevoGrupo}><Plus size={16} />{t('nuevoGrupo')}</Boton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de grupos */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-texto-muted uppercase tracking-wider px-1">Grupos</h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
            <input
              type="text"
              placeholder={t('filtrarPlaceholder')}
              value={busquedaGrupos}
              onChange={(e) => setBusquedaGrupos(e.target.value)}
              className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
            />
          </div>
          {cargando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-surface border border-borde rounded-xl animate-pulse" />
              ))}
            </div>
          ) : grupos.filter((g) =>
            busquedaGrupos.length === 0 ||
            g.nombre.toLowerCase().includes(busquedaGrupos.toLowerCase()) ||
            g.codigo_grupo.toLowerCase().includes(busquedaGrupos.toLowerCase())
          ).sort((a, b) => {
            const peso = (t?: string | null) => { const n = normalizarTipo(t); return n === 'USUARIO' ? 0 : n === 'PRUEBAS' ? 1 : n === 'ADMINISTRADOR' ? 2 : 3 }
            const dt = peso(a.tipo) - peso(b.tipo)
            return dt !== 0 ? dt : a.nombre.localeCompare(b.nombre)
          }).map((g) => (
            <button
              key={g.codigo_grupo}
              onClick={() => setGrupoSeleccionado(g)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                grupoSeleccionado?.codigo_grupo === g.codigo_grupo
                  ? 'border-primario bg-primario-muy-claro'
                  : 'border-borde bg-surface hover:bg-fondo'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                grupoSeleccionado?.codigo_grupo === g.codigo_grupo
                  ? 'bg-primario text-primario-texto'
                  : 'bg-fondo text-texto-muted'
              }`}>
                <Layers size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-texto truncate">{g.nombre}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-texto-muted">{g.codigo_grupo}</p>
                  <Insignia variante={varianteTipo(g.tipo)}>{etiquetaTipo(g.tipo)}</Insignia>
                </div>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); abrirEditarGrupo(g) }}
                className="ml-auto p-1 rounded hover:bg-white text-texto-muted hover:text-primario transition-colors"
              >
                <Pencil size={13} />
              </button>
            </button>
          ))}
        </div>

        {/* Detalle del grupo seleccionado */}
        <div className="lg:col-span-2">
          {grupoSeleccionado ? (
            <Tarjeta>
              <div className="px-6 py-4 border-b border-borde">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-texto">{grupoSeleccionado.nombre}</h3>
                    <p className="text-xs text-texto-muted mt-0.5">Codigo: {grupoSeleccionado.codigo_grupo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                  {esSuperAdmin && grupoSeleccionado.tipo !== 'RESTRINGIDO' && grupoSeleccionado.codigo_grupo !== 'ADMIN' && (
                    <Boton
                      variante="peligro"
                      tamano="sm"
                      onClick={() => { setConfirmarBorrarGrupo(grupoSeleccionado); setTextoBorrar('') }}
                    >
                      <Trash2 size={14} />
                    </Boton>
                  )}
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => {
                      if (tabActivo === 'entidades') {
                        exportarExcel(entidadesFiltradas as unknown as Record<string, unknown>[], [
                          { titulo: 'Grupo', campo: 'codigo_grupo' },
                          { titulo: 'Código entidad', campo: 'codigo_entidad' },
                          { titulo: 'Nombre', campo: 'nombre' },
                          { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                        ], `entidades_grupo_${grupoSeleccionado.codigo_grupo}`)
                      } else {
                        exportarExcel(usuariosListaFiltrados.map((u) => ({
                          codigo_usuario: u.codigo_usuario,
                          nombre: u.usuarios?.nombre ?? u.codigo_usuario,
                          activo: u.usuarios?.activo,
                        })), [
                          { titulo: 'Correo', campo: 'codigo_usuario' },
                          { titulo: 'Nombre', campo: 'nombre' },
                          { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                        ], `usuarios_grupo_${grupoSeleccionado.codigo_grupo}`)
                      }
                    }}
                    disabled={tabActivo === 'entidades' ? entidadesFiltradas.length === 0 : usuariosListaFiltrados.length === 0}
                  >
                    <Download size={14} />
                    Excel
                  </Boton>
                  </div>
                </div>
                {/* Tabs */}
                <div className="flex gap-4 mt-3">
                  <button
                    onClick={() => setTabActivo('entidades')}
                    className={`flex items-center gap-1.5 pb-1 text-sm font-medium border-b-2 transition-colors ${
                      tabActivo === 'entidades' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                    }`}
                  >
                    <Building2 size={14} /> Entidades ({entidadesGrupo.length})
                  </button>
                  <button
                    onClick={() => setTabActivo('usuarios')}
                    className={`flex items-center gap-1.5 pb-1 text-sm font-medium border-b-2 transition-colors ${
                      tabActivo === 'usuarios' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                    }`}
                  >
                    <Users size={14} /> Usuarios ({usuariosGrupo.length})
                  </button>
                </div>
              </div>
              <TarjetaContenido className="p-0">
                {/* Tab Entidades */}
                {tabActivo === 'entidades' && (
                  <div>
                    <div className="px-4 py-3 border-b border-borde flex items-center gap-3">
                      <div className="max-w-sm flex-1">
                        <Input
                          placeholder={t('buscarEntidadPlaceholder')}
                          value={busquedaEntidades}
                          onChange={(e) => setBusquedaEntidades(e.target.value)}
                          icono={<Search size={15} />}
                        />
                      </div>
                      <Boton variante="primario" tamano="sm" onClick={abrirNuevaEntidad}><Plus size={14} />{t('nuevaEntidad')}</Boton>
                    </div>
                  <Tabla>
                    <TablaCabecera>
                      <tr><TablaTh>{t('colNombre')}</TablaTh><TablaTh>{t('colEstado')}</TablaTh><TablaTh>{t('colCodigo')}</TablaTh><TablaTh className="text-right">{tc('acciones')}</TablaTh></tr>
                    </TablaCabecera>
                    <TablaCuerpo>
                      {cargandoDetalle ? (
                        <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>Cargando...</TablaTd></TablaFila>
                      ) : entidadesFiltradas.length === 0 ? (
                        <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>{busquedaEntidades ? 'No se encontraron entidades' : 'No hay entidades en este grupo'}</TablaTd></TablaFila>
                      ) : entidadesFiltradas.map((e) => (
                        <TablaFila key={e.codigo_entidad}>
                          <TablaTd className="font-medium">{e.nombre}</TablaTd>
                          <TablaTd><Insignia variante={e.activo ? 'exito' : 'advertencia'}>{e.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                          <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{e.codigo_entidad}</code></TablaTd>
                          <TablaTd className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => abrirEditarEntidad(e)} className="p-1 rounded hover:bg-fondo text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                              {e.activo && (
                                <button onClick={() => setConfirmarDesactivar(e)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Desactivar"><X size={14} /></button>
                              )}
                            </div>
                          </TablaTd>
                        </TablaFila>
                      ))}
                    </TablaCuerpo>
                  </Tabla>
                  </div>
                )}

                {/* Tab Usuarios — con asignación/desasignación */}
                {tabActivo === 'usuarios' && (
                  <div className="flex flex-col gap-4 p-4">
                    {/* Asignar usuario al grupo — con búsqueda */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative" ref={dropdownRef}>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                          <input
                            type="text"
                            placeholder={t('buscarUsuarioPlaceholder')}
                            value={busquedaUsuario}
                            onChange={(e) => { setBusquedaUsuario(e.target.value); setDropdownAbierto(true); setUsuarioNuevo('') }}
                            onFocus={() => setDropdownAbierto(true)}
                            className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                          />
                        </div>
                        {dropdownAbierto && busquedaUsuario.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {usuariosFiltrados.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-texto-muted">No se encontraron usuarios</div>
                            ) : usuariosFiltrados.slice(0, 20).map((u) => (
                              <button
                                key={u.codigo_usuario}
                                onClick={() => {
                                  setUsuarioNuevo(u.codigo_usuario)
                                  setBusquedaUsuario(`${u.nombre} (${u.codigo_usuario})`)
                                  setDropdownAbierto(false)
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors"
                              >
                                <span className="font-medium">{u.nombre}</span>
                                <span className="ml-2 text-texto-muted text-xs">{u.codigo_usuario}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Boton
                        variante="primario"
                        onClick={() => { asignarUsuarioAlGrupo(); setBusquedaUsuario('') }}
                        cargando={asignandoUsuario}
                        disabled={!usuarioNuevo}
                      >
                        <Plus size={14} />
                        {t('agregarUsuario')}
                      </Boton>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <p className="text-sm text-error">{error}</p>
                      </div>
                    )}

                    {/* Filtro de usuarios del grupo */}
                    {usuariosGrupo.length > 0 && (
                      <div className="max-w-sm">
                        <Input
                          placeholder={t('filtrarUsuariosPlaceholder')}
                          value={busquedaUsuariosLista}
                          onChange={(e) => setBusquedaUsuariosLista(e.target.value)}
                          icono={<Search size={15} />}
                        />
                      </div>
                    )}

                    {/* Lista de usuarios del grupo */}
                    {cargandoDetalle ? (
                      <div className="flex flex-col gap-2">
                        {[1, 2].map((i) => (
                          <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />
                        ))}
                      </div>
                    ) : usuariosGrupo.length === 0 ? (
                      <p className="text-sm text-texto-muted text-center py-4">No hay usuarios en este grupo</p>
                    ) : usuariosListaFiltrados.length === 0 ? (
                      <p className="text-sm text-texto-muted text-center py-4">No se encontraron usuarios</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {usuariosListaFiltrados.map((u) => (
                          <div
                            key={u.codigo_usuario}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"
                          >
                            <div>
                              <span className="text-sm font-medium text-texto">
                                {u.usuarios?.nombre ?? u.codigo_usuario}
                              </span>
                              <span className="ml-2 text-xs text-texto-muted">{u.codigo_usuario}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Insignia variante={u.usuarios?.activo ? 'exito' : 'advertencia'}>
                                {u.usuarios?.activo ? 'Activo' : 'Inactivo'}
                              </Insignia>
                              <button
                                onClick={() => quitarUsuarioDelGrupo(u.codigo_usuario)}
                                className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                                title="Quitar del grupo"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TarjetaContenido>
            </Tarjeta>
          ) : (
            <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
              Selecciona un grupo para ver su detalle
            </div>
          )}
        </div>
      </div>

      {/* Modal grupo */}
      <Modal abierto={modalGrupo} alCerrar={() => setModalGrupo(false)} titulo={grupoEditando ? 'Editar grupo' : 'Nuevo grupo'} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'prompt', 'system_prompt'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalGrupo(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalGrupo === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : tab === 'prompt' ? 'Prompt' : 'System Prompt'}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalGrupo === 'datos' && (
            <>
              <Input etiqueta={t('etiquetaNombre')} value={formGrupo.nombre} onChange={(e) => setFormGrupo({ ...formGrupo, nombre: e.target.value })} placeholder={t('placeholderNombre')} />
              <Textarea etiqueta="Descripción" value={formGrupo.descripcion} onChange={(e) => setFormGrupo({ ...formGrupo, descripcion: e.target.value })} rows={3} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Tipo</label>
                <div className="flex items-center gap-2 py-1">
                  <Insignia variante={varianteTipo(formGrupo.tipo)}>{etiquetaTipo(formGrupo.tipo)}</Insignia>
                  <span className="text-xs text-texto-muted">Solo modificable desde la base de datos</span>
                </div>
              </div>
              {grupoEditando && (
                <Input etiqueta="Código" value={formGrupo.codigo_grupo} disabled readOnly />
              )}
            </>
          )}

          {/* Tab Prompt */}
          {tabModalGrupo === 'prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Texto que se inyecta en el prompt del LLM para dar contexto específico a este grupo. Se usa en clasificación de documentos y análisis.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder={t('placeholderDescripcion')}
                value={formGrupo.prompt}
                onChange={(e) => setFormGrupo({ ...formGrupo, prompt: e.target.value })}
              />
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalGrupo === 'system_prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Instrucciones de sistema que se prependen a todas las conversaciones y análisis LLM en este grupo. Define el tono, restricciones y rol del asistente.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder={t('placeholderSystemPrompt')}
                value={formGrupo.system_prompt}
                onChange={(e) => setFormGrupo({ ...formGrupo, system_prompt: e.target.value })}
              />
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="secundario" onClick={() => setModalGrupo(false)}>Salir</Boton>
            <Boton variante="primario" onClick={() => guardarGrupo(false)} cargando={guardando}>{grupoEditando ? tc('guardar') : t('crearGrupo')}</Boton>
          </div>
        </div>
      </Modal>

      {/* Modal entidad (con tabs Datos y Usuarios en edición) */}
      <Modal abierto={modalEntidad} alCerrar={() => setModalEntidad(false)} titulo={entidadEditando ? `Editar entidad: ${entidadEditando.nombre}` : 'Nueva entidad'}>
        <div className="flex flex-col gap-4">
          {/* Tabs (solo en edición) */}
          {entidadEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button onClick={() => setTabModalEntidad('datos')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalEntidad === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabDatos')}</button>
              <button onClick={() => setTabModalEntidad('usuarios')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalEntidad === 'usuarios' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Usuarios ({usuariosEntidad.length})</button>
            </div>
          )}

          {/* Tab Datos */}
          {tabModalEntidad === 'datos' && (
            <>
              <Input etiqueta={t('etiquetaNombre')} value={formEntidad.nombre} onChange={(e) => setFormEntidad({ ...formEntidad, nombre: e.target.value })} placeholder={t('placeholderNombreEntidad')} />
              <Textarea etiqueta="Descripción" value={formEntidad.descripcion} onChange={(e) => setFormEntidad({ ...formEntidad, descripcion: e.target.value })} placeholder="Descripción opcional" rows={3} />
              {entidadEditando && (
                <Input etiqueta="Código" value={formEntidad.codigo_entidad} disabled readOnly />
              )}
              {errorEntidad && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorEntidad}</p></div>}
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="secundario" onClick={() => setModalEntidad(false)}>Salir</Boton>
                <Boton variante="primario" onClick={() => guardarEntidad(false)} cargando={guardandoEntidad}>{entidadEditando ? tc('guardar') : t('crearEntidad')}</Boton>
              </div>
            </>
          )}

          {/* Tab Usuarios */}
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
                          onClick={() => {
                            setUsuarioNuevoEnt(u.codigo_usuario)
                            setBusquedaUsuarioEnt(`${u.nombre} (${u.codigo_usuario})`)
                            setDropdownEntAbierto(false)
                          }}
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
                <Boton variante="secundario" onClick={() => setModalEntidad(false)}>Cerrar</Boton>
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

      {/* Modal borrado completo de grupo */}
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
            <Input
              value={textoBorrar}
              onChange={(e) => setTextoBorrar(e.target.value)}
              placeholder={`Borrar grupo ${confirmarBorrarGrupo?.nombre ?? ''}`}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Boton variante="contorno" onClick={() => { setConfirmarBorrarGrupo(null); setTextoBorrar(''); setError('') }}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              onClick={borrarGrupoCompleto}
              disabled={textoBorrar !== `Borrar grupo ${confirmarBorrarGrupo?.nombre}` || borrandoGrupo}
              cargando={borrandoGrupo}
            >
              Borrar
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
