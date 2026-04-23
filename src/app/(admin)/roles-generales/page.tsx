'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Languages, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { SortableDndContext, SortableRow, SortableListItem } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaContenido } from '@/components/ui/tarjeta'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { rolesApi, funcionesApi, aplicacionesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Rol, Funcion, Aplicacion } from '@/lib/tipos'
import { etiquetaTipo, varianteTipo, normalizarTipo } from '@/lib/tipo-elemento'
import { Insignia } from '@/components/ui/insignia'
import { BotonChat } from '@/components/ui/boton-chat'

type FuncionAsignada = { codigo_funcion: string; orden: number; funciones: { nombre_funcion: string } }

type TabModal = 'datos' | 'funciones' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'

export default function PaginaRolesGenerales() {
  const t = useTranslations('rolesGenerales')

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">
          Administra roles
        </p>
      </div>

      <TabRolesGlobales />
    </div>
  )
}

// ── CRUD de Roles ─────────────────────────────────────────────────────────

function TabRolesGlobales() {
  const t = useTranslations('rolesGenerales')
  const tc = useTranslations('common')
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
    inicial: false,
    inicial_admin_grupo: false,
    inicial_admin_general: false,
    prompt_insert: '',
    prompt_update: '',
    system_prompt: '',
    python_insert: '',
    python_update: '',
    javascript: '',
    python_editado_manual: false,
    javascript_editado_manual: false,
    md: '',
  })
  const [guardando, setGuardando] = useState(false)

  const [confirmacion, setConfirmacion] = useState<Rol | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Tab dentro del modal de edición
  const [tabModal, setTabModal] = useState<TabModal>('datos')
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

  const reordenarFuncionesRol = async (nuevas: typeof funcionesRol) => {
    setFuncionesRol(nuevas)
    try { await rolesApi.reordenarFunciones(editando!.id_rol, nuevas.map(f => ({ codigo_funcion: f.codigo_funcion, orden: f.orden ?? 0 }))) }
    catch { if (editando) cargarFuncionesRol(editando.id_rol) }
  }

  const funcionesDisponibles = (() => {
    const sinAsignar = todasFunciones.filter((f) => !funcionesRol.some((fa) => fa.codigo_funcion === f.codigo_funcion))
    if (!editando) return sinAsignar
    const tipoRol = normalizarTipo(editando.tipo)
    if (tipoRol === 'SISTEMA') return sinAsignar.filter((f) => normalizarTipo(f.tipo) === 'SISTEMA')
    if (tipoRol === 'ADMINISTRADOR') return sinAsignar.filter((f) => normalizarTipo(f.tipo) !== 'SISTEMA')
    if (tipoRol === 'USUARIO') return sinAsignar.filter((f) => normalizarTipo(f.tipo) === 'USUARIO')
    return sinAsignar
  })()
  const funcionesRolFiltradas = funcionesDisponibles.filter(
    (f) =>
      busquedaFuncion.length === 0 ||
      f.nombre.toLowerCase().includes(busquedaFuncion.toLowerCase()) ||
      f.codigo_funcion.toLowerCase().includes(busquedaFuncion.toLowerCase()),
  )

  const [traduciendo, setTraduciendo] = useState<number | null>(null)

  const traducirRol = async (r: Rol) => {
    if (traduciendo) return
    setTraduciendo(r.id_rol)
    try {
      const res = await rolesApi.traducir(r.id_rol)
      const idiomas = res.idiomas?.join(', ') || '—'
      alert(`Traducción generada para "${r.nombre}".\nIdiomas: ${idiomas}\nRegistros: ${res.generadas}`)
    } catch (e) {
      alert(`Error traduciendo: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setTraduciendo(null)
    }
  }

  const reordenarRoles = async (nuevos: typeof roles) => {
    setRoles(nuevos)
    try { await rolesApi.reordenar(nuevos.map(r => ({ id_rol: r.id_rol, orden: r.orden ?? 0 }))) }
    catch { cargar() }
  }

  const cargar = async () => {
    setCargando(true)
    try {
      const [data, apps] = await Promise.all([rolesApi.listarGlobales(), aplicacionesApi.listar()])
      setAplicaciones(apps)
      const ordenado = data.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      setRoles(ordenado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar roles')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const abrirCrear = () => {
    setEditando(null)
    setForm({
      codigo_rol: '',
      nombre: '',
      alias_de_rol: '',
      descripcion: '',
      url_inicio: '',
      codigo_aplicacion_origen: aplicacionActiva || '',
      inicial: false,
      inicial_admin_grupo: false,
      inicial_admin_general: false,
      prompt_insert: '',
      prompt_update: '',
      system_prompt: '',
      python_insert: '',
      python_update: '',
      javascript: '',
      python_editado_manual: false,
      javascript_editado_manual: false,
      md: '',
    })
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
      inicial: r.inicial ?? false,
      inicial_admin_grupo: r.inicial_admin_grupo ?? false,
      inicial_admin_general: r.inicial_admin_general ?? false,
      prompt_insert: r.prompt_insert || '',
      prompt_update: r.prompt_update || '',
      system_prompt: r.system_prompt || '',
      python_insert: r.python_insert || '',
      python_update: r.python_update || '',
      javascript: r.javascript || '',
      python_editado_manual: r.python_editado_manual ?? false,
      javascript_editado_manual: r.javascript_editado_manual ?? false,
      md: '',
    })
    setError('')
    setTabModal('datos')
    cargarFuncionesRol(r.id_rol)
    setModalAbierto(true)
  }

  const guardar = async (cerrar: boolean) => {
    if (!form.codigo_rol.trim() || !form.nombre.trim()) {
      setError('Código y nombre son obligatorios')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const datos: Record<string, unknown> = {
        codigo_rol: form.codigo_rol.trim(),
        nombre: form.nombre.trim(),
        alias_de_rol: form.alias_de_rol.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined,
        url_inicio: form.url_inicio.trim() || undefined,
        codigo_aplicacion_origen: form.codigo_aplicacion_origen || null,
        codigo_grupo: null,
        inicial: form.inicial,
        inicial_admin_grupo: form.inicial_admin_grupo,
        inicial_admin_general: form.inicial_admin_general,
      }
      if (editando) {
        datos.prompt_insert = form.prompt_insert || undefined
        datos.prompt_update = form.prompt_update || undefined
        datos.system_prompt = form.system_prompt || undefined
        datos.python_insert = form.python_insert || undefined
        datos.python_update = form.python_update || undefined
        datos.javascript = form.javascript || undefined
        datos.python_editado_manual = form.python_editado_manual
        datos.javascript_editado_manual = form.javascript_editado_manual
        await rolesApi.actualizar(editando.id_rol, datos)
      } else {
        const nuevo = await rolesApi.crear(datos as Parameters<typeof rolesApi.crear>[0])
        if (!cerrar && nuevo) {
          setEditando(nuevo)
          cargarFuncionesRol(nuevo.id_rol)
        }
      }
      if (cerrar) {
        setModalAbierto(false)
      }
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

  const rolesVisibles = roles

  const TABS_MODAL: { key: TabModal; label: string }[] = [
    { key: 'datos', label: t('tabDatos') },
    ...(editando ? [
      { key: 'funciones' as TabModal, label: `${t('tabFunciones')} (${funcionesRol.length})` },
      { key: 'system_prompt' as TabModal, label: 'System Prompt' },
      { key: 'programacion_insert' as TabModal, label: 'Prog. Insert' },
      { key: 'programacion_update' as TabModal, label: 'Prog. Update' },
      { key: 'md' as TabModal, label: '.md' },
    ] : []),
  ]

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <div className="flex items-center justify-between w-full">
          <TarjetaTitulo>Roles</TarjetaTitulo>
          <Boton variante="primario" onClick={abrirCrear}>
            <Plus size={16} />
            {t('nuevoRol')}
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
        ) : rolesVisibles.length === 0 ? (
          <p className="text-sm text-texto-muted">
            No hay roles definidos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase text-texto-muted">
                  <th className="w-8" />
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Alias</th>
                  <th className="py-2 pr-4">Descripción</th>
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4 w-28 text-right">Acciones</th>
                </tr>
              </thead>
              <SortableDndContext items={rolesVisibles as unknown as Record<string, unknown>[]} getId={(r) => String(r.id_rol)} onReorder={(newItems) => reordenarRoles(newItems as unknown as Rol[])}>
              <tbody>
                {rolesVisibles.map((r) => {
                  return (
                  <SortableRow key={r.id_rol} id={String(r.id_rol)}>
                    <td className="py-2 pr-4">
                      <Insignia variante={varianteTipo(r.tipo)}>{etiquetaTipo(r.tipo)}</Insignia>
                    </td>
                    <td className="py-2 pr-4">{r.nombre}</td>
                    <td className="py-2 pr-4 text-texto-muted">{r.alias_de_rol || '—'}</td>
                    <td className="py-2 pr-4 text-texto-muted truncate max-w-xs">{r.descripcion || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.codigo_rol}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => traducirRol(r)}
                          disabled={traduciendo === r.id_rol}
                          className="p-1.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Traducir rol a todos los idiomas"
                        >
                          {traduciendo === r.id_rol ? <RefreshCw size={16} className="animate-spin" /> : <Languages size={16} />}
                        </button>
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
                  </SortableRow>
                  )
                })}
              </tbody>
              </SortableDndContext>
            </table>
          </div>
        )}
      </TarjetaContenido>

      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={editando ? `Editando rol: ${editando.alias_de_rol || editando.nombre}` : 'Nuevo rol'}
        className="w-[900px] max-w-[95vw]"
      >
        <div className="flex flex-col gap-4 min-h-[600px]">
          {/* Tabs */}
          <div className="flex border-b border-borde -mx-1 overflow-x-auto">
            {TABS_MODAL.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTabModal(tab.key)}
                className={`flex-1 text-center px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  tabModal === tab.key
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {tabModal === 'datos' && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="text-sm font-medium text-texto">{t('etiquetaCodigo')}</label>
                  <Input
                    value={form.codigo_rol}
                    onChange={(e) => setForm({ ...form, codigo_rol: e.target.value.toUpperCase() })}
                    placeholder={t('placeholderCodigo')}
                    disabled={!!editando}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">{t('etiquetaAlias')}</label>
                  <Input
                    value={form.alias_de_rol}
                    onChange={(e) => setForm({ ...form, alias_de_rol: e.target.value })}
                    placeholder={t('placeholderAlias')}
                    maxLength={40}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">{t('etiquetaNombre')}</label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder={t('placeholderNombre')}
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
                    {[...aplicaciones].sort((a, b) => {
                      const peso = (t?: string | null) => { const n = normalizarTipo(t); return n === 'USUARIO' ? 0 : n === 'ADMINISTRADOR' ? 1 : 2 }
                      const ta = peso(a.tipo)
                      const tb = peso(b.tipo)
                      if (ta !== tb) return ta - tb
                      return a.nombre.localeCompare(b.nombre, 'es')
                    }).map((a) => (
                      <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">{t('etiquetaUrlInicio')}</label>
                  <Input
                    value={form.url_inicio}
                    onChange={(e) => setForm({ ...form, url_inicio: e.target.value })}
                    placeholder={t('placeholderUrlInicio')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">{t('etiquetaDescripcion')}</label>
                  <Input
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder={t('placeholderDescripcion')}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 p-3 bg-fondo rounded-lg border border-borde">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.inicial}
                    onChange={(e) => setForm({ ...form, inicial: e.target.checked })}
                    className="w-4 h-4 rounded accent-primario"
                  />
                  <span className="text-sm text-texto">Rol inicial (asignar automáticamente a nuevos usuarios)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.inicial_admin_grupo}
                    onChange={(e) => setForm({ ...form, inicial_admin_grupo: e.target.checked })}
                    className="w-4 h-4 rounded accent-primario"
                  />
                  <span className="text-sm text-texto">Inicial Admin Grupo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.inicial_admin_general}
                    onChange={(e) => setForm({ ...form, inicial_admin_general: e.target.checked })}
                    className="w-4 h-4 rounded accent-primario"
                  />
                  <span className="text-sm text-texto">Inicial Admin General</span>
                </label>
              </div>
              <PieBotonesModal
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModalAbierto(false)}
                cargando={guardando}
              />
            </>
          )}

          {tabModal === 'funciones' && editando && (
            <div className="flex flex-col gap-3">
              {/* Aviso filtro por tipo de rol */}
              {(() => {
                const tipoRol = normalizarTipo(editando.tipo)
                if (tipoRol === 'SISTEMA') return <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">Solo funciones de tipo <strong>Sistema</strong> pueden asignarse a este rol.</div>
                if (tipoRol === 'ADMINISTRADOR') return <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">Funciones de tipo <strong>Sistema</strong> no pueden asignarse a roles de Administración.</div>
                if (tipoRol === 'USUARIO') return <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">Solo funciones de tipo <strong>Usuario</strong> pueden asignarse a este rol.</div>
                return null
              })()}
              {/* Asignar nueva */}
              <div>
                <label className="text-sm font-medium text-texto">{t('asignarFuncion')}</label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 relative">
                    <Input
                      placeholder={t('buscarFuncionPlaceholder')}
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
                    {t('asignar')}
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
                  <SortableDndContext items={funcionesRol as unknown as Record<string, unknown>[]} getId={(f) => (f as FuncionAsignada).codigo_funcion} onReorder={(newItems) => reordenarFuncionesRol(newItems as unknown as FuncionAsignada[])}>
                  <ul className="divide-y divide-borde">
                    {funcionesRol.map((fa) => (
                      <SortableListItem
                        key={fa.codigo_funcion}
                        id={fa.codigo_funcion}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fondo"
                      >
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
                      </SortableListItem>
                    ))}
                  </ul>
                  </SortableDndContext>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>
                  {tc('cerrar')}
                </Boton>
              </div>
            </div>
          )}

          {tabModal === 'system_prompt' && editando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">System Prompt (instrucción base LLM)</label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  placeholder="Instrucción base al LLM (se inyecta en system_prompt del chat)."
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto font-mono min-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>
              <PieBotonesModal
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModalAbierto(false)}
                cargando={guardando}
              />
            </div>
          )}

          {tabModal === 'programacion_insert' && editando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="roles"
                pkColumna="id_rol"
                pkValor={String(editando.id_rol)}
                campos={{
                  prompt_insert: form.prompt_insert,
                  prompt_update: form.prompt_update,
                  system_prompt: form.system_prompt,
                  python_insert: form.python_insert,
                  python_update: form.python_update,
                  javascript: form.javascript,
                  python_editado_manual: form.python_editado_manual,
                  javascript_editado_manual: form.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
              <PieBotonesModal
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModalAbierto(false)}
                cargando={guardando}
                botonesIzquierda={editando ? (
                  <PieBotonesPrompts
                    tabla="roles"
                    pkColumna="id_rol"
                    pkValor={String(editando.id_rol)}
                    promptInsert={form.prompt_insert || undefined}
                    promptUpdate={form.prompt_update || undefined}
                  />
                ) : undefined}
              />
            </div>
          )}

          {tabModal === 'programacion_update' && editando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="roles"
                pkColumna="id_rol"
                pkValor={String(editando.id_rol)}
                campos={{
                  prompt_insert: form.prompt_insert,
                  prompt_update: form.prompt_update,
                  system_prompt: form.system_prompt,
                  python_insert: form.python_insert,
                  python_update: form.python_update,
                  javascript: form.javascript,
                  python_editado_manual: form.python_editado_manual,
                  javascript_editado_manual: form.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
              <PieBotonesModal
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModalAbierto(false)}
                cargando={guardando}
                botonesIzquierda={editando ? (
                  <PieBotonesPrompts
                    tabla="roles"
                    pkColumna="id_rol"
                    pkValor={String(editando.id_rol)}
                    promptInsert={form.prompt_insert || undefined}
                    promptUpdate={form.prompt_update || undefined}
                  />
                ) : undefined}
              />
            </div>
          )}

          {tabModal === 'md' && editando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={form.md || ''}
                  readOnly
                  rows={13}
                  placeholder="La generación de .md para roles se configurará en el backend. Esta pestaña queda preparada para cuando esté disponible."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              <div className="flex justify-between items-center pt-2">
                <PieBotonesPrompts
                  tabla="roles"
                  pkColumna="id_rol"
                  pkValor={String(editando.id_rol)}
                  promptInsert={form.prompt_insert || undefined}
                  promptUpdate={form.prompt_update || undefined}
                  mostrarGenerar={true}
                  mostrarSincronizar={false}
                />
                <Boton variante="contorno" onClick={() => setModalAbierto(false)}>{tc('cerrar')}</Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminar}
        titulo="Eliminar rol"
        mensaje={
          confirmacion
            ? `¿Eliminar el rol "${confirmacion.nombre}" (${confirmacion.codigo_rol})?\n\n` +
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
