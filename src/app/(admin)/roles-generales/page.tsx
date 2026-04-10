'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaContenido } from '@/components/ui/tarjeta'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { rolesApi, gruposApi, funcionesApi, aplicacionesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Rol, Grupo, Funcion, Aplicacion } from '@/lib/tipos'

type FuncionAsignada = { codigo_funcion: string; orden: number; funciones: { nombre_funcion: string } }

type Tab = 'globales' | 'copiar'

export default function PaginaRolesGenerales() {
  const [tab, setTab] = useState<Tab>('globales')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-texto">Roles Generales</h2>
        <p className="text-sm text-texto-muted mt-1">
          Administra roles transversales (sin grupo) y copia roles entre grupos
        </p>
      </div>

      <div className="flex gap-1 border-b border-borde">
        <button
          onClick={() => setTab('globales')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'globales'
              ? 'border-primario text-primario'
              : 'border-transparent text-texto-muted hover:text-texto'
          }`}
        >
          Roles generales
        </button>
        <button
          onClick={() => setTab('copiar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'copiar'
              ? 'border-primario text-primario'
              : 'border-transparent text-texto-muted hover:text-texto'
          }`}
        >
          Copiar entre grupos
        </button>
      </div>

      {tab === 'globales' ? <TabRolesGlobales /> : <TabCopiarRoles />}
    </div>
  )
}

// ── Tab 1: CRUD de Roles Globales ─────────────────────────────────────────

function TabRolesGlobales() {
  const { aplicacionActiva } = useAuth()
  const [roles, setRoles] = useState<Rol[]>([])
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Rol | null>(null)
  const [form, setForm] = useState({
    codigo_rol: '',
    nombre: '',
    alias_de_rol: '',
    descripcion: '',
    url_inicio: '',
    codigo_aplicacion_origen: '',
  })
  const [guardando, setGuardando] = useState(false)

  const [confirmacion, setConfirmacion] = useState<Rol | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Tab dentro del modal de edición: datos | funciones
  const [tabModal, setTabModal] = useState<'datos' | 'funciones'>('datos')
  const [todasFunciones, setTodasFunciones] = useState<Funcion[]>([])
  const [funcionesRol, setFuncionesRol] = useState<FuncionAsignada[]>([])
  const [cargandoFunciones, setCargandoFunciones] = useState(false)
  const [busquedaFuncion, setBusquedaFuncion] = useState('')
  const [funcionNueva, setFuncionNueva] = useState('')
  const [asignandoFuncion, setAsignandoFuncion] = useState(false)

  const cargarFuncionesRol = useCallback(async (idRol: number) => {
    setCargandoFunciones(true)
    try {
      setFuncionesRol(await rolesApi.listarFunciones(idRol))
    } catch {
      setFuncionesRol([])
    } finally {
      setCargandoFunciones(false)
    }
  }, [])

  useEffect(() => {
    funcionesApi.listar().then(setTodasFunciones).catch(() => setTodasFunciones([]))
  }, [])

  const asignarFuncion = async () => {
    if (!funcionNueva || !editando) return
    setAsignandoFuncion(true)
    try {
      await rolesApi.asignarFuncion(editando.id_rol, funcionNueva)
      setFuncionNueva('')
      setBusquedaFuncion('')
      cargarFuncionesRol(editando.id_rol)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar función')
    } finally {
      setAsignandoFuncion(false)
    }
  }

  const quitarFuncion = async (codigoFuncion: string) => {
    if (!editando) return
    try {
      await rolesApi.quitarFuncion(editando.id_rol, codigoFuncion)
      cargarFuncionesRol(editando.id_rol)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar función')
    }
  }

  const moverFuncion = async (index: number, direccion: 'arriba' | 'abajo') => {
    if (!editando) return
    const lista = [...funcionesRol]
    const swap = direccion === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const a = lista[index].orden
    const b = lista[swap].orden
    lista[index].orden = b
    lista[swap].orden = a
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setFuncionesRol(lista)
    try {
      await rolesApi.reordenarFunciones(
        editando.id_rol,
        lista.map((f) => ({ codigo_funcion: f.codigo_funcion, orden: f.orden })),
      )
    } catch {
      cargarFuncionesRol(editando.id_rol)
    }
  }

  const funcionesDisponibles = todasFunciones.filter(
    (f) => !funcionesRol.some((fa) => fa.codigo_funcion === f.codigo_funcion),
  )
  const funcionesRolFiltradas = funcionesDisponibles.filter(
    (f) =>
      busquedaFuncion.length === 0 ||
      f.nombre.toLowerCase().includes(busquedaFuncion.toLowerCase()) ||
      f.codigo_funcion.toLowerCase().includes(busquedaFuncion.toLowerCase()),
  )

  const cargar = async () => {
    setCargando(true)
    try {
      const [data, apps] = await Promise.all([rolesApi.listarGlobales(), aplicacionesApi.listar()])
      setAplicaciones(apps)
      // Orden por (nombre app origen, nombre rol). Sin app origen al final.
      const mapaApp = Object.fromEntries(apps.map((a) => [a.codigo_aplicacion, a.nombre]))
      const ordenado = data.sort((a, b) => {
        const na = a.codigo_aplicacion_origen ? (mapaApp[a.codigo_aplicacion_origen] || a.codigo_aplicacion_origen) : ''
        const nb = b.codigo_aplicacion_origen ? (mapaApp[b.codigo_aplicacion_origen] || b.codigo_aplicacion_origen) : ''
        const sa = na ? 0 : 1; const sb = nb ? 0 : 1
        if (sa !== sb) return sa - sb
        if (na !== nb) return na.localeCompare(nb, 'es')
        return a.nombre.localeCompare(b.nombre, 'es')
      })
      setRoles(ordenado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar roles generales')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const abrirCrear = () => {
    setEditando(null)
    setForm({ codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '', codigo_aplicacion_origen: aplicacionActiva || '' })
    setError('')
    setTabModal('datos')
    setFuncionesRol([])
    setModalAbierto(true)
  }

  const abrirEditar = (r: Rol) => {
    setEditando(r)
    setForm({
      codigo_rol: r.codigo_rol,
      nombre: r.nombre,
      alias_de_rol: r.alias_de_rol || '',
      descripcion: r.descripcion || '',
      url_inicio: r.url_inicio || '',
      codigo_aplicacion_origen: r.codigo_aplicacion_origen || '',
    })
    setError('')
    setTabModal('datos')
    cargarFuncionesRol(r.id_rol)
    setModalAbierto(true)
  }

  const guardar = async () => {
    if (!form.codigo_rol.trim() || !form.nombre.trim()) {
      setError('Código y nombre son obligatorios')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const datos = {
        codigo_rol: form.codigo_rol.trim(),
        nombre: form.nombre.trim(),
        alias_de_rol: form.alias_de_rol.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined,
        url_inicio: form.url_inicio.trim() || undefined,
        codigo_aplicacion_origen: form.codigo_aplicacion_origen || null,
        codigo_grupo: null, // rol global
      }
      if (editando) {
        await rolesApi.actualizar(editando.id_rol, datos)
      } else {
        await rolesApi.crear(datos)
      }
      setModalAbierto(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEliminar = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await rolesApi.eliminar(confirmacion.id_rol)
      setConfirmacion(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
      setConfirmacion(null)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <div className="flex items-center justify-between w-full">
          <TarjetaTitulo>Roles generales (sin grupo)</TarjetaTitulo>
          <Boton variante="primario" onClick={abrirCrear}>
            <Plus size={16} />
            Nuevo rol general
          </Boton>
        </div>
      </TarjetaCabecera>
      <TarjetaContenido>
        {error && !modalAbierto && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-error">
            {error}
          </div>
        )}
        {cargando ? (
          <p className="text-sm text-texto-muted">Cargando...</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-texto-muted">
            No hay roles generales definidos. Los roles generales son visibles en todos los grupos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase text-texto-muted">
                  <th className="py-2 pr-4">App origen</th>
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Alias</th>
                  <th className="py-2 pr-4">Descripción</th>
                  <th className="py-2 pr-4 w-24 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const nombreAppOrigen = r.codigo_aplicacion_origen
                    ? (aplicaciones.find((a) => a.codigo_aplicacion === r.codigo_aplicacion_origen)?.nombre || r.codigo_aplicacion_origen)
                    : '—'
                  return (
                  <tr key={r.id_rol} className="border-b border-borde/50 hover:bg-surface-hover">
                    <td className="py-2 pr-4 text-xs text-texto-muted">{nombreAppOrigen}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.codigo_rol}</td>
                    <td className="py-2 pr-4">{r.nombre}</td>
                    <td className="py-2 pr-4 text-texto-muted">{r.alias_de_rol || '—'}</td>
                    <td className="py-2 pr-4 text-texto-muted truncate max-w-xs">{r.descripcion || '—'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => abrirEditar(r)}
                          className="p-1.5 rounded hover:bg-surface-hover text-texto-muted hover:text-primario"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmacion(r)}
                          className="p-1.5 rounded hover:bg-surface-hover text-texto-muted hover:text-error"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </TarjetaContenido>

      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={editando ? `Editar rol general "${editando.codigo_rol}"` : 'Nuevo rol general'}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-3">
          {/* Tabs (solo si editando) */}
          {editando && (
            <div className="flex gap-1 border-b border-borde -mt-2">
              <button
                type="button"
                onClick={() => setTabModal('datos')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tabModal === 'datos'
                    ? 'border-primario text-primario'
                    : 'border-transparent text-texto-muted hover:text-texto'
                }`}
              >
                Datos
              </button>
              <button
                type="button"
                onClick={() => setTabModal('funciones')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tabModal === 'funciones'
                    ? 'border-primario text-primario'
                    : 'border-transparent text-texto-muted hover:text-texto'
                }`}
              >
                Funciones ({funcionesRol.length})
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {tabModal === 'datos' && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="text-sm font-medium text-texto">Código *</label>
                  <Input
                    value={form.codigo_rol}
                    onChange={(e) => setForm({ ...form, codigo_rol: e.target.value.toUpperCase() })}
                    placeholder="Ej: SEG-USUARIOS"
                    disabled={!!editando}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">Alias</label>
                  <Input
                    value={form.alias_de_rol}
                    onChange={(e) => setForm({ ...form, alias_de_rol: e.target.value })}
                    placeholder="Alias corto"
                    maxLength={40}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">Nombre *</label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Nombre descriptivo del rol"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">Aplicación origen</label>
                  <select
                    value={form.codigo_aplicacion_origen}
                    onChange={(e) => setForm({ ...form, codigo_aplicacion_origen: e.target.value })}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  >
                    <option value="">— sin asignar —</option>
                    {[...aplicaciones].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((a) => (
                      <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">URL de inicio</label>
                  <Input
                    value={form.url_inicio}
                    onChange={(e) => setForm({ ...form, url_inicio: e.target.value })}
                    placeholder="/dashboard"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">Descripción</label>
                  <Input
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Descripción del rol..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Boton variante="contorno" onClick={() => setModalAbierto(false)} disabled={guardando}>
                  Cancelar
                </Boton>
                <Boton variante="primario" onClick={guardar} cargando={guardando}>
                  {editando ? 'Guardar cambios' : 'Crear rol general'}
                </Boton>
              </div>
            </>
          )}

          {tabModal === 'funciones' && editando && (
            <div className="flex flex-col gap-3">
              {/* Asignar nueva */}
              <div>
                <label className="text-sm font-medium text-texto">Asignar función</label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Buscar función por nombre o código..."
                      value={busquedaFuncion}
                      onChange={(e) => setBusquedaFuncion(e.target.value)}
                      icono={<Search size={14} />}
                    />
                    {busquedaFuncion.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-borde bg-surface shadow-lg">
                        {funcionesRolFiltradas.length === 0 ? (
                          <div className="p-2 text-xs text-texto-muted">Sin resultados</div>
                        ) : (
                          funcionesRolFiltradas.slice(0, 20).map((f) => (
                            <button
                              key={f.codigo_funcion}
                              type="button"
                              onClick={() => {
                                setFuncionNueva(f.codigo_funcion)
                                setBusquedaFuncion(f.nombre)
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro border-b border-borde/50 last:border-0"
                            >
                              <div className="font-medium">{f.nombre}</div>
                              <div className="text-xs text-texto-muted font-mono">{f.codigo_funcion}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <Boton
                    variante="primario"
                    tamano="sm"
                    onClick={asignarFuncion}
                    disabled={!funcionNueva || asignandoFuncion}
                  >
                    <Plus size={14} />
                    Agregar
                  </Boton>
                </div>
              </div>

              {/* Listado actual */}
              <div className="border border-borde rounded-lg overflow-hidden">
                {cargandoFunciones ? (
                  <div className="p-4 text-sm text-texto-muted text-center">Cargando...</div>
                ) : funcionesRol.length === 0 ? (
                  <div className="p-4 text-sm text-texto-muted text-center">
                    Este rol no tiene funciones asignadas.
                  </div>
                ) : (
                  <ul className="divide-y divide-borde">
                    {funcionesRol.map((fa, idx) => (
                      <li
                        key={fa.codigo_funcion}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fondo"
                      >
                        <div className="flex flex-col gap-0.5 items-center">
                          <button
                            type="button"
                            onClick={() => moverFuncion(idx, 'arriba')}
                            disabled={idx === 0}
                            className="text-texto-muted hover:text-primario disabled:opacity-30"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moverFuncion(idx, 'abajo')}
                            disabled={idx === funcionesRol.length - 1}
                            className="text-texto-muted hover:text-primario disabled:opacity-30"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{fa.funciones?.nombre_funcion}</div>
                          <div className="text-xs text-texto-muted font-mono">{fa.codigo_funcion}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => quitarFuncion(fa.codigo_funcion)}
                          className="p-1 rounded text-texto-muted hover:text-error hover:bg-red-50"
                          title="Quitar"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>
                  Cerrar
                </Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminar}
        titulo="Eliminar rol general"
        mensaje={
          confirmacion
            ? `¿Eliminar el rol general "${confirmacion.nombre}" (${confirmacion.codigo_rol})?\n\n` +
              `Esta acción borra el rol en cascada:\n` +
              `• Asignaciones a funciones (rel_rol_funcion)\n` +
              `• Asignaciones a usuarios en todos los grupos\n\n` +
              `Los usuarios que tenían este rol como principal quedarán sin rol principal.\n\n` +
              `Esta acción NO se puede deshacer.`
            : ''
        }
        textoConfirmar="Eliminar definitivamente"
        cargando={eliminando}
      />
    </Tarjeta>
  )
}

// ── Tab 2: Copiar Roles entre Grupos ──────────────────────────────────────

function TabCopiarRoles() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoOrigen, setGrupoOrigen] = useState('')
  const [rolesOrigen, setRolesOrigen] = useState<Rol[]>([])
  const [rolCopiar, setRolCopiar] = useState('')
  const [grupoDestino, setGrupoDestino] = useState('')
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    gruposApi.listar().then(setGrupos).catch(() => setGrupos([]))
  }, [])

  const cargarRoles = async (codigoGrupo: string) => {
    setGrupoOrigen(codigoGrupo)
    setRolCopiar('')
    setRolesOrigen([])
    setMensaje(null)
    if (!codigoGrupo) return
    setCargandoRoles(true)
    try {
      setRolesOrigen(await rolesApi.listarPorGrupo(codigoGrupo, false))
    } catch {
      setRolesOrigen([])
    } finally {
      setCargandoRoles(false)
    }
  }

  const ejecutarCopia = async () => {
    if (!grupoOrigen || !rolCopiar || !grupoDestino) return
    setCopiando(true)
    setMensaje(null)
    try {
      await rolesApi.copiar({
        id_rol_origen: Number(rolCopiar),
        codigo_grupo_destino: grupoDestino,
      })
      const rolNombre = rolesOrigen.find((r) => String(r.id_rol) === rolCopiar)?.nombre || rolCopiar
      setMensaje({ tipo: 'exito', texto: `Rol "${rolNombre}" copiado exitosamente al grupo "${grupoDestino}".` })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al copiar rol' })
    } finally {
      setCopiando(false)
    }
  }

  const gruposDestino = useMemo(
    () => grupos.filter((g) => g.codigo_grupo !== grupoOrigen),
    [grupos, grupoOrigen],
  )

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <TarjetaTitulo>Copiar un rol y sus funciones entre grupos</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido>
        <div className="flex flex-col gap-4 max-w-xl">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">Grupo de origen *</label>
            <select
              value={grupoOrigen}
              onChange={(e) => cargarRoles(e.target.value)}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
            >
              <option value="">Seleccionar grupo...</option>
              {grupos.map((g) => (
                <option key={g.codigo_grupo} value={g.codigo_grupo}>
                  {g.nombre} ({g.codigo_grupo})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">Rol a copiar *</label>
            <select
              value={rolCopiar}
              onChange={(e) => {
                setRolCopiar(e.target.value)
                setMensaje(null)
              }}
              disabled={!grupoOrigen || cargandoRoles}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50"
            >
              <option value="">{cargandoRoles ? 'Cargando...' : 'Seleccionar rol...'}</option>
              {rolesOrigen.map((r) => (
                <option key={r.id_rol} value={String(r.id_rol)}>
                  {r.nombre} ({r.codigo_rol})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">Grupo de destino *</label>
            <select
              value={grupoDestino}
              onChange={(e) => {
                setGrupoDestino(e.target.value)
                setMensaje(null)
              }}
              disabled={!grupoOrigen}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50"
            >
              <option value="">Seleccionar grupo...</option>
              {gruposDestino.map((g) => (
                <option key={g.codigo_grupo} value={g.codigo_grupo}>
                  {g.nombre} ({g.codigo_grupo})
                </option>
              ))}
            </select>
          </div>

          {mensaje && (
            <div
              className={`border rounded-lg px-4 py-3 ${
                mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <p className={`text-sm ${mensaje.tipo === 'exito' ? 'text-green-700' : 'text-error'}`}>{mensaje.texto}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Boton
              variante="primario"
              onClick={ejecutarCopia}
              cargando={copiando}
              disabled={!grupoOrigen || !rolCopiar || !grupoDestino}
            >
              <Copy size={16} />
              Copiar rol
            </Boton>
          </div>
        </div>
      </TarjetaContenido>
    </Tarjeta>
  )
}
