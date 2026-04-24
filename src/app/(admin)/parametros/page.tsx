'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Save, SlidersHorizontal, Layers, Building2, User, Trash2, Lock, EyeOff } from 'lucide-react'
import { SortableDndContext, SortableListItem } from '@/components/ui/sortable'
import { Paginador } from '@/components/ui/paginador'
import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaDescripcion, TarjetaContenido } from '@/components/ui/tarjeta'
import { useAuth } from '@/context/AuthContext'
import { parametrosApi, entidadesApi, datosBasicosApi } from '@/lib/api'
import type { CategoriaParametro, TipoParametro, ParametroGeneral, ParametroGrupo, ParametroUsuario } from '@/lib/tipos'

type TabId = 'generales' | 'grupo' | 'entidad' | 'usuario'

interface ParametroRow {
  categoria_parametro: string
  tipo_parametro: string
  valor_parametro: string
  descripcion?: string
  orden?: number
  // flags generales
  replica_grupo?: boolean
  visible_grupo?: boolean
  editable_grupo?: boolean
  replica_usuario?: boolean
  visible_usuario?: boolean
  editable_usuario?: boolean
  // flags grupo/usuario
  visible?: boolean
  editable?: boolean
}

const PAGE_SIZE = 15

export default function PaginaParametros() {
  const t = useTranslations('parametros')
  const tc = useTranslations('common')
  const { esAdmin, esSuperAdmin, usuario } = useAuth()
  const [tabActiva, setTabActiva] = useState<TabId>('grupo')

  // Generales
  const [paramsGenerales, setParamsGenerales] = useState<ParametroRow[]>([])
  const [cargandoGenerales, setCargandoGenerales] = useState(false)
  const [guardandoFlags, setGuardandoFlags] = useState<string | null>(null)

  // Grupo
  const [paramsGrupo, setParamsGrupo] = useState<ParametroRow[]>([])
  const [cargandoGrupo, setCargandoGrupo] = useState(false)

  // Entidad
  const [paramsEntidad, setParamsEntidad] = useState<ParametroRow[]>([])
  const [cargandoEntidad, setCargandoEntidad] = useState(false)

  // Usuario
  const [paramsUsuario, setParamsUsuario] = useState<ParametroRow[]>([])
  const [cargandoUsuario, setCargandoUsuario] = useState(false)

  // Paginación (client-side)
  const [page, setPage] = useState(1)

  // Categorías y tipos (para dropdowns al agregar)
  const [categorias, setCategorias] = useState<CategoriaParametro[]>([])
  const [tiposPorCat, setTiposPorCat] = useState<TipoParametro[]>([])

  // Nuevo parámetro (para grupo, entidad, usuario)
  const [nuevoParam, setNuevoParam] = useState({
    categoria_parametro: '',
    tipo_parametro: '',
    valor_parametro: '',
  })

  const [guardando, setGuardando] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState('')
  const [error, setError] = useState('')

  const mostrarExito = (msg: string) => {
    setMensajeExito(msg)
    setError('')
    setTimeout(() => setMensajeExito(''), 3000)
  }

  // ── Cargar categorías y tipos para los dropdowns ───────────────────────────
  useEffect(() => {
    datosBasicosApi.listarCategorias().then(setCategorias).catch(() => {})
  }, [])

  useEffect(() => {
    if (!nuevoParam.categoria_parametro) {
      setTiposPorCat([])
      return
    }
    datosBasicosApi.listarTipos(nuevoParam.categoria_parametro).then(setTiposPorCat).catch(() => {})
  }, [nuevoParam.categoria_parametro])

  // ── Cargar Generales ──────────────────────────────────────────────────────
  const cargarGenerales = useCallback(async () => {
    setCargandoGenerales(true)
    try {
      const data = await parametrosApi.listarGenerales()
      setParamsGenerales(data.map((p: ParametroGeneral) => ({
        categoria_parametro: p.categoria_parametro,
        tipo_parametro: p.tipo_parametro,
        valor_parametro: p.valor_parametro,
        descripcion: p.descripcion,
        orden: (p as ParametroGeneral & { orden?: number }).orden ?? 0,
        replica_grupo: p.replica_grupo ?? false,
        visible_grupo: p.visible_grupo ?? true,
        editable_grupo: p.editable_grupo ?? true,
        replica_usuario: p.replica_usuario ?? false,
        visible_usuario: p.visible_usuario ?? true,
        editable_usuario: p.editable_usuario ?? true,
      })))
    } catch { setParamsGenerales([]) }
    finally { setCargandoGenerales(false) }
  }, [])

  // ── Cargar Grupo ──────────────────────────────────────────────────────────
  const cargarGrupo = useCallback(async () => {
    setCargandoGrupo(true)
    try {
      const data = await parametrosApi.listarGrupo()
      setParamsGrupo(data.map((p: ParametroGrupo) => ({
        categoria_parametro: p.categoria_parametro,
        tipo_parametro: p.tipo_parametro,
        valor_parametro: p.valor_parametro,
        orden: (p as ParametroGrupo & { orden?: number }).orden ?? 0,
        visible: p.visible ?? true,
        editable: p.editable ?? true,
      })))
    } catch { setParamsGrupo([]) }
    finally { setCargandoGrupo(false) }
  }, [])

  // ── Cargar Entidad ────────────────────────────────────────────────────────
  const cargarEntidad = useCallback(async () => {
    if (!usuario?.entidad_activa) return
    setCargandoEntidad(true)
    try {
      const data = await entidadesApi.listarParametros(usuario.entidad_activa)
      setParamsEntidad(data.map((p: ParametroRow) => ({
        ...p,
        orden: p.orden ?? 0,
      })))
    } catch { setParamsEntidad([]) }
    finally { setCargandoEntidad(false) }
  }, [usuario?.entidad_activa])

  // ── Cargar Usuario ────────────────────────────────────────────────────────
  const cargarUsuario = useCallback(async () => {
    setCargandoUsuario(true)
    try {
      const data = await parametrosApi.listarUsuario()
      setParamsUsuario(data.map((p: ParametroUsuario) => ({
        categoria_parametro: p.categoria_parametro,
        tipo_parametro: p.tipo_parametro,
        valor_parametro: p.valor_parametro,
        orden: (p as ParametroUsuario & { orden?: number }).orden ?? 0,
        visible: p.visible ?? true,
        editable: p.editable ?? true,
      })))
    } catch { setParamsUsuario([]) }
    finally { setCargandoUsuario(false) }
  }, [])

  const recargar = useCallback(() => {
    setPage(1)
    if (tabActiva === 'generales') cargarGenerales()
    else if (tabActiva === 'grupo') cargarGrupo()
    else if (tabActiva === 'entidad') cargarEntidad()
    else cargarUsuario()
  }, [tabActiva, cargarGenerales, cargarGrupo, cargarEntidad, cargarUsuario])

  useEffect(() => {
    setPage(1)
    if (tabActiva === 'generales') cargarGenerales()
    else if (tabActiva === 'grupo') cargarGrupo()
    else if (tabActiva === 'entidad') cargarEntidad()
    else if (tabActiva === 'usuario') cargarUsuario()
  }, [tabActiva, cargarGenerales, cargarGrupo, cargarEntidad, cargarUsuario])

  // ── Reordenar ─────────────────────────────────────────────────────────────
  const reordenar = async (nuevosPagina: ParametroRow[]) => {
    // Reemplazar los items de la página actual en el array completo
    const full = tabActiva === 'generales' ? paramsGenerales
      : tabActiva === 'grupo' ? paramsGrupo
      : tabActiva === 'entidad' ? paramsEntidad
      : paramsUsuario
    const start = (page - 1) * PAGE_SIZE
    const nuevosCompletos = [
      ...full.slice(0, start),
      ...nuevosPagina,
      ...full.slice(start + PAGE_SIZE),
    ]

    const setParams = tabActiva === 'generales' ? setParamsGenerales
      : tabActiva === 'grupo' ? setParamsGrupo
      : tabActiva === 'entidad' ? setParamsEntidad
      : setParamsUsuario

    setParams(nuevosCompletos)

    try {
      const items = nuevosCompletos.map((p, idx) => ({
        categoria_parametro: p.categoria_parametro,
        tipo_parametro: p.tipo_parametro,
        orden: idx + 1,
      }))

      if (tabActiva === 'generales') {
        await parametrosApi.reordenarGenerales(items)
      } else if (tabActiva === 'grupo') {
        await parametrosApi.reordenarGrupo(items)
      } else if (tabActiva === 'entidad' && usuario?.entidad_activa) {
        await entidadesApi.reordenarParametros(usuario.entidad_activa, items)
      } else if (tabActiva === 'usuario') {
        await parametrosApi.reordenarUsuario(items)
      }
    } catch {
      recargar()
    }
  }

  // ── Guardar parámetro inline ──────────────────────────────────────────────
  const guardarInline = async (tab: TabId, cat: string, tipo: string, valor: string) => {
    const key = `${cat}/${tipo}`
    setGuardando(key)
    setError('')
    try {
      const datos = { categoria_parametro: cat, tipo_parametro: tipo, valor_parametro: valor }
      if (tab === 'generales') {
        await parametrosApi.upsertGenerales(datos)
      } else if (tab === 'grupo') {
        await parametrosApi.upsertGrupo(datos)
      } else if (tab === 'entidad' && usuario?.entidad_activa) {
        await entidadesApi.upsertParametro(usuario.entidad_activa, datos)
      } else if (tab === 'usuario') {
        await parametrosApi.upsertUsuario(datos)
      }
      mostrarExito(t('parametroGuardado'))
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardando(null)
    }
  }

  // ── Guardar flags de parámetro general ───────────────────────────────────
  const guardarFlagGeneral = async (cat: string, tipo: string, flag: string, valor: boolean) => {
    const key = `${cat}/${tipo}/${flag}`
    setGuardandoFlags(key)
    const param = paramsGenerales.find(p => p.categoria_parametro === cat && p.tipo_parametro === tipo)
    if (!param) return
    setParamsGenerales(prev => prev.map(p =>
      p.categoria_parametro === cat && p.tipo_parametro === tipo ? { ...p, [flag]: valor } : p
    ))
    try {
      await parametrosApi.upsertGenerales({
        categoria_parametro: cat,
        tipo_parametro: tipo,
        valor_parametro: param.valor_parametro,
        [flag]: valor,
      })
    } catch {
      setParamsGenerales(prev => prev.map(p =>
        p.categoria_parametro === cat && p.tipo_parametro === tipo ? { ...p, [flag]: !valor } : p
      ))
      setError('Error al guardar el flag')
    } finally {
      setGuardandoFlags(null)
    }
  }

  // ── Eliminar parámetro ────────────────────────────────────────────────────
  const [paramAEliminar, setParamAEliminar] = useState<{ cat: string; tipo: string } | null>(null)
  const [eliminandoParam, setEliminandoParam] = useState(false)

  const eliminarParam = async (cat: string, tipo: string) => {
    setError('')
    try {
      if (tabActiva === 'generales') {
        await parametrosApi.eliminarGeneral(cat, tipo)
      } else if (tabActiva === 'grupo') {
        await parametrosApi.eliminarGrupo(cat, tipo)
      } else if (tabActiva === 'entidad' && usuario?.entidad_activa) {
        await entidadesApi.eliminarParametro(usuario.entidad_activa, cat, tipo)
      } else if (tabActiva === 'usuario') {
        await parametrosApi.eliminarUsuario(cat, tipo)
      }
      mostrarExito(t('parametroEliminado'))
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlEliminar'))
    }
  }

  // ── Agregar nuevo parámetro ───────────────────────────────────────────────
  const agregarNuevo = async () => {
    if (!nuevoParam.categoria_parametro || !nuevoParam.tipo_parametro || !nuevoParam.valor_parametro) {
      setError(t('camposObligatorios'))
      return
    }
    await guardarInline(tabActiva, nuevoParam.categoria_parametro, nuevoParam.tipo_parametro, nuevoParam.valor_parametro)
    setNuevoParam({ categoria_parametro: '', tipo_parametro: '', valor_parametro: '' })
    recargar()
  }

  // ── Tabs config ───────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: typeof SlidersHorizontal; visible: boolean }[] = [
    { id: 'generales', label: 'Generales', icon: SlidersHorizontal, visible: esSuperAdmin() },
    { id: 'grupo', label: t('tabGrupo'), icon: Layers, visible: true },
    { id: 'entidad', label: t('tabEntidad'), icon: Building2, visible: true },
    { id: 'usuario', label: t('tabUsuario'), icon: User, visible: true },
  ]

  const visibleTabs = tabs.filter((t) => t.visible)

  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === tabActiva)) {
      setTabActiva(visibleTabs[0]?.id || 'grupo')
    }
  }, [visibleTabs, tabActiva])

  // Datos y estado de carga según tab
  const getParams = (): ParametroRow[] => {
    if (tabActiva === 'generales') return paramsGenerales
    if (tabActiva === 'grupo') return paramsGrupo
    if (tabActiva === 'entidad') return paramsEntidad
    return paramsUsuario
  }

  const isCargando = (): boolean => {
    if (tabActiva === 'generales') return cargandoGenerales
    if (tabActiva === 'grupo') return cargandoGrupo
    if (tabActiva === 'entidad') return cargandoEntidad
    return cargandoUsuario
  }

  const getDescripcion = (): string => {
    if (tabActiva === 'generales') return t('subtitulo')
    if (tabActiva === 'grupo') return t('descGrupo', { nombre: usuario?.nombre_grupo || usuario?.grupo_activo || '' })
    if (tabActiva === 'entidad') return t('descEntidad', { nombre: usuario?.entidad_activa || '' })
    return t('descUsuario')
  }

  const puedeAgregar = tabActiva !== 'generales' || esAdmin()

  // Tipos filtrados por categoría seleccionada y los ya asignados
  const tiposDisponibles = tiposPorCat.filter(
    (t) => !getParams().some(
      (p) => p.categoria_parametro === t.categoria_parametro && p.tipo_parametro === t.tipo_parametro
    )
  )

  // ── Paginación client-side ────────────────────────────────────────────────
  const allParams = getParams()
  const totalItems = allParams.length
  const pagedParams = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return allParams.slice(start, start + PAGE_SIZE)
  }, [allParams, page])

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50'
  const checkboxCls = 'h-3.5 w-3.5 rounded border-borde text-primario cursor-pointer'
  const labelFlagCls = 'flex items-center gap-1.5 text-xs text-texto-muted cursor-pointer select-none'

  // Componente inline para los 6 flags de un parámetro general — una sola línea
  const FlagsGenerales = ({ p }: { p: ParametroRow }) => {
    const key = `${p.categoria_parametro}/${p.tipo_parametro}`
    const saving = (flag: string) => guardandoFlags === `${key}/${flag}`
    return (
      <div className="mt-2 pt-2 border-t border-borde/60 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-texto-muted shrink-0">Grupos:</span>
        <label className={labelFlagCls}>
          <input type="checkbox" className={checkboxCls}
            checked={p.replica_grupo ?? false}
            disabled={saving('replica_grupo')}
            onChange={e => guardarFlagGeneral(p.categoria_parametro, p.tipo_parametro, 'replica_grupo', e.target.checked)} />
          Replicar
        </label>
        <label className={labelFlagCls}>
          <input type="checkbox" className={checkboxCls}
            checked={p.visible_grupo ?? true}
            disabled={saving('visible_grupo')}
            onChange={e => guardarFlagGeneral(p.categoria_parametro, p.tipo_parametro, 'visible_grupo', e.target.checked)} />
          Visible
        </label>
        <label className={labelFlagCls}>
          <input type="checkbox" className={checkboxCls}
            checked={p.editable_grupo ?? true}
            disabled={saving('editable_grupo')}
            onChange={e => guardarFlagGeneral(p.categoria_parametro, p.tipo_parametro, 'editable_grupo', e.target.checked)} />
          Editable
        </label>
        <span className="text-texto-light/40 select-none">|</span>
        <span className="text-xs font-medium text-texto-muted shrink-0">Usuarios:</span>
        <label className={labelFlagCls}>
          <input type="checkbox" className={checkboxCls}
            checked={p.replica_usuario ?? false}
            disabled={saving('replica_usuario')}
            onChange={e => guardarFlagGeneral(p.categoria_parametro, p.tipo_parametro, 'replica_usuario', e.target.checked)} />
          Replicar
        </label>
        <label className={labelFlagCls}>
          <input type="checkbox" className={checkboxCls}
            checked={p.visible_usuario ?? true}
            disabled={saving('visible_usuario')}
            onChange={e => guardarFlagGeneral(p.categoria_parametro, p.tipo_parametro, 'visible_usuario', e.target.checked)} />
          Visible
        </label>
        <label className={labelFlagCls}>
          <input type="checkbox" className={checkboxCls}
            checked={p.editable_usuario ?? true}
            disabled={saving('editable_usuario')}
            onChange={e => guardarFlagGeneral(p.categoria_parametro, p.tipo_parametro, 'editable_usuario', e.target.checked)} />
          Editable
        </label>
      </div>
    )
  }

  // Indicadores de estado para grupo/usuario
  const BadgesParam = ({ p }: { p: ParametroRow }) => {
    if (tabActiva === 'generales') return null
    const editable = p.editable !== false
    const visible = p.visible !== false
    if (editable && visible) return null
    return (
      <div className="flex items-center gap-1 shrink-0">
        {!editable && <span title="Solo lectura" className="text-texto-muted"><Lock size={12} /></span>}
        {!visible && <span title="Oculto para usuarios" className="text-texto-muted"><EyeOff size={12} /></span>}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-6 max-w-3xl">
      <BotonChat />
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {mensajeExito && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-exito font-medium">{mensajeExito}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tabActiva === tab.id
                  ? 'bg-surface text-primario-oscuro shadow-sm border border-borde'
                  : 'text-texto-muted hover:text-texto'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>
            {visibleTabs.find((tab) => tab.id === tabActiva)?.label || t('titulo')}
          </TarjetaTitulo>
          <TarjetaDescripcion>{getDescripcion()}</TarjetaDescripcion>
        </TarjetaCabecera>
        <TarjetaContenido>
          {isCargando() ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-fondo rounded-lg animate-pulse" />
              ))}
            </div>
          ) : allParams.length === 0 ? (
            <p className="text-sm text-texto-muted text-center py-4">{t('sinParametros')}</p>
          ) : (
            <>
              <SortableDndContext
                items={pagedParams as unknown as Record<string, unknown>[]}
                getId={(p) => `${(p as ParametroRow).categoria_parametro}/${(p as ParametroRow).tipo_parametro}`}
                onReorder={(nuevos) => reordenar(nuevos as unknown as ParametroRow[])}
              >
                <div className="flex flex-col gap-3">
                  {pagedParams.map((p) => {
                    const key = `${p.categoria_parametro}/${p.tipo_parametro}`
                    const esEditable = p.editable !== false
                    const esVisible = p.visible !== false

                    return (
                      <SortableListItem
                        key={key}
                        id={key}
                        className={`flex items-start gap-2 px-3 py-2 rounded-lg border border-borde bg-surface ${!esVisible ? 'opacity-60' : ''}`}
                      >
                        <div className="flex flex-col flex-1 min-w-0">
                          {/* Fila principal */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-texto-muted mb-1">
                                {p.categoria_parametro}
                                <span className="mx-1 text-texto-light">/</span>
                                {p.tipo_parametro}
                              </p>
                              <input
                                type="text"
                                defaultValue={p.valor_parametro}
                                disabled={!esEditable}
                                onBlur={(e) => {
                                  if (e.target.value !== p.valor_parametro) {
                                    guardarInline(tabActiva, p.categoria_parametro, p.tipo_parametro, e.target.value)
                                  }
                                }}
                                className="w-full text-sm text-texto bg-transparent border-b border-transparent hover:border-borde focus:border-primario focus:outline-none py-0.5 disabled:cursor-not-allowed disabled:text-texto-muted"
                              />
                            </div>
                            <BadgesParam p={p} />
                            {/* Guardar */}
                            {esEditable && (
                              <button
                                onClick={(e) => {
                                  const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)
                                  if (input) guardarInline(tabActiva, p.categoria_parametro, p.tipo_parametro, input.value)
                                }}
                                disabled={guardando === key}
                                className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors shrink-0"
                                title={tc('guardar')}
                              >
                                <Save size={14} />
                              </button>
                            )}
                            {/* Eliminar */}
                            <button
                              onClick={() => setParamAEliminar({ cat: p.categoria_parametro, tipo: p.tipo_parametro })}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors shrink-0"
                              title={t('eliminarTitulo')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {/* Flags (solo tab generales) */}
                          {tabActiva === 'generales' && <FlagsGenerales p={p} />}
                        </div>
                      </SortableListItem>
                    )
                  })}
                </div>
              </SortableDndContext>

              {/* Paginador */}
              {totalItems > PAGE_SIZE && (
                <div className="mt-4 border-t border-borde pt-3">
                  <Paginador
                    page={page}
                    limit={PAGE_SIZE}
                    total={totalItems}
                    onChangePage={setPage}
                  />
                </div>
              )}
            </>
          )}

          {/* Agregar nuevo parámetro */}
          {puedeAgregar && (
            <div className="border-t border-borde mt-4 pt-4">
              <p className="text-xs font-semibold text-texto-muted uppercase tracking-wider mb-3">
                {t('agregarParametro')}
              </p>
              <div className="flex flex-col gap-2">
                {/* Fila 1: Categoría y Tipo (dropdowns) */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={nuevoParam.categoria_parametro}
                    onChange={(e) =>
                      setNuevoParam({ categoria_parametro: e.target.value, tipo_parametro: '', valor_parametro: nuevoParam.valor_parametro })
                    }
                    className={selectClass}
                  >
                    <option value="">{t('placeholderCategoria')}</option>
                    {categorias.filter((c) => c.activo).map((c) => (
                      <option key={c.categoria_parametro} value={c.categoria_parametro}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={nuevoParam.tipo_parametro}
                    onChange={(e) => setNuevoParam({ ...nuevoParam, tipo_parametro: e.target.value })}
                    disabled={!nuevoParam.categoria_parametro}
                    className={selectClass}
                  >
                    <option value="">{t('placeholderTipo')}</option>
                    {tiposDisponibles.map((t) => (
                      <option key={t.tipo_parametro} value={t.tipo_parametro}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Fila 2: Valor y botón */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('placeholderValor')}
                    value={nuevoParam.valor_parametro}
                    onChange={(e) => setNuevoParam({ ...nuevoParam, valor_parametro: e.target.value })}
                    className="flex-1 rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario"
                  />
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={agregarNuevo}
                    cargando={guardando === 'nuevo'}
                    disabled={!nuevoParam.categoria_parametro || !nuevoParam.tipo_parametro || !nuevoParam.valor_parametro}
                  >
                    {t('agregarParametro')}
                  </Boton>
                </div>
              </div>
            </div>
          )}
        </TarjetaContenido>
      </Tarjeta>

      {/* Modal Confirmar Eliminación */}
      <ModalConfirmar
        abierto={!!paramAEliminar}
        alCerrar={() => setParamAEliminar(null)}
        alConfirmar={async () => {
          if (!paramAEliminar) return
          setEliminandoParam(true)
          await eliminarParam(paramAEliminar.cat, paramAEliminar.tipo)
          setEliminandoParam(false)
          setParamAEliminar(null)
        }}
        titulo={t('eliminarTitulo')}
        mensaje={paramAEliminar ? t('eliminarConfirm', { cat: paramAEliminar.cat, tipo: paramAEliminar.tipo }) : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminandoParam}
      />
    </div>
  )
}
