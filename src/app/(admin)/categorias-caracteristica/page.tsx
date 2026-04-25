'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, Download, Search } from 'lucide-react'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { categoriasCaractPersApi, rolesApi, promptsApi } from '@/lib/api'
import type { CategoriaCaractPers, TipoCaractPers, RolCaractPers, Rol } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

type TabActiva = 'categorias' | 'tipos' | 'roles'

export default function PaginaCategoriasCaracteristica() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('categoriasCaracteristica')
  const tc = useTranslations('common')

  const [tabActiva, setTabActiva] = useState<TabActiva>('categorias')

  // ── Categorías ────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaCaractPers[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [busquedaCat, setBusquedaCat] = useState('')
  const [modalCat, setModalCat] = useState(false)
  const [tabModalCat, setTabModalCat] = useState<'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMdCat, setGenerandoMdCat] = useState(false)
  const [sincronizandoMdCat, setSincronizandoMdCat] = useState(false)
  const [mensajeMdCat, setMensajeMdCat] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [mdCat, setMdCat] = useState('')
  const [catEditando, setCatEditando] = useState<CategoriaCaractPers | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_cat_pers: '', nombre_cat_pers: '', descripcion_cat_pers: '',
    es_unica_pers: false, editable_en_detalle_pers: true,
    prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
  })
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')
  const [confirmCat, setConfirmCat] = useState<CategoriaCaractPers | null>(null)
  const [eliminandoCat, setEliminandoCat] = useState(false)

  // ── Categoría seleccionada (para Tipos y Roles) ──────────────────────────
  const [catSeleccionada, setCatSeleccionada] = useState<CategoriaCaractPers | null>(null)

  // ── Tipos ─────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoCaractPers[]>([])
  const [cargandoTipos, setCargandoTipos] = useState(false)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoCaractPers | null>(null)
  const [formTipo, setFormTipo] = useState({ codigo_tipo_pers: '', nombre_tipo_pers: '' })
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [confirmTipo, setConfirmTipo] = useState<TipoCaractPers | null>(null)
  const [eliminandoTipo, setEliminandoTipo] = useState(false)

  // ── Roles ─────────────────────────────────────────────────────────────────
  const [rolesCategoria, setRolesCategoria] = useState<RolCaractPers[]>([])
  const [rolesDisponibles, setRolesDisponibles] = useState<Rol[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [busquedaRol, setBusquedaRol] = useState('')
  const [dropdownRolAbierto, setDropdownRolAbierto] = useState(false)
  const dropdownRolRef = useRef<HTMLDivElement>(null)

  // click-outside para dropdown roles
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRolRef.current && !dropdownRolRef.current.contains(e.target as Node))
        setDropdownRolAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Carga categorías ──────────────────────────────────────────────────────
  const cargarCategorias = useCallback(async () => {
    setCargandoCat(true)
    try {
      setCategorias(await categoriasCaractPersApi.listar())
    } finally {
      setCargandoCat(false)
    }
  }, [])

  useEffect(() => { cargarCategorias() }, [cargarCategorias])

  // ── Carga tipos ───────────────────────────────────────────────────────────
  const cargarTipos = useCallback(async () => {
    if (!catSeleccionada) { setTipos([]); return }
    setCargandoTipos(true)
    try {
      setTipos(await categoriasCaractPersApi.listarTipos(catSeleccionada.codigo_cat_pers))
    } finally {
      setCargandoTipos(false)
    }
  }, [catSeleccionada])

  useEffect(() => { if (tabActiva === 'tipos') cargarTipos() }, [tabActiva, cargarTipos])

  // ── Carga roles de categoría ──────────────────────────────────────────────
  const cargarRolesCategoria = useCallback(async () => {
    if (!catSeleccionada) { setRolesCategoria([]); return }
    setCargandoRoles(true)
    try {
      const [rc, allRoles] = await Promise.all([
        categoriasCaractPersApi.listarRoles(catSeleccionada.codigo_cat_pers),
        rolesApi.listar(),
      ])
      setRolesCategoria(rc)
      setRolesDisponibles(allRoles)
    } finally {
      setCargandoRoles(false)
    }
  }, [catSeleccionada])

  useEffect(() => { if (tabActiva === 'roles') cargarRolesCategoria() }, [tabActiva, cargarRolesCategoria])

  // ── CRUD Categorías ───────────────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({ codigo_cat_pers: '', nombre_cat_pers: '', descripcion_cat_pers: '', es_unica_pers: false, editable_en_detalle_pers: true, prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaCaractPers) => {
    setCatEditando(c)
    const c2 = c as unknown as Record<string, unknown>
    setFormCat({
      codigo_cat_pers: c.codigo_cat_pers,
      nombre_cat_pers: c.nombre_cat_pers,
      descripcion_cat_pers: c.descripcion_cat_pers || '',
      es_unica_pers: c.es_unica_pers,
      editable_en_detalle_pers: c.editable_en_detalle_pers,
      prompt_insert: c2.prompt_insert as string || '',
      prompt_update: c2.prompt_update as string || '',
      system_prompt: c2.system_prompt as string || '',
      python_insert: c2.python_insert as string || '',
      python_update: c2.python_update as string || '',
      javascript: c2.javascript as string || '',
      python_editado_manual: c2.python_editado_manual as boolean || false,
      javascript_editado_manual: c2.javascript_editado_manual as boolean || false,
    })
    setMdCat(c2.md as string || '')
    setMensajeMdCat(null)
    setTabModalCat('datos')
    setErrorCat('')
    setModalCat(true)
  }

  const guardarCat = async (cerrar = true) => {
    if (!formCat.nombre_cat_pers.trim()) {
      setErrorCat(t('errorNombreObligatorio'))
      return
    }
    setGuardandoCat(true)
    try {
      if (catEditando) {
        await categoriasCaractPersApi.actualizar(catEditando.codigo_cat_pers, {
          nombre_cat_pers: formCat.nombre_cat_pers,
          descripcion_cat_pers: formCat.descripcion_cat_pers || undefined,
          es_unica_pers: formCat.es_unica_pers,
          editable_en_detalle_pers: formCat.editable_en_detalle_pers,
          prompt_insert: formCat.prompt_insert || undefined,
          prompt_update: formCat.prompt_update || undefined,
          system_prompt: formCat.system_prompt || undefined,
          python_insert: formCat.python_insert || undefined,
          python_update: formCat.python_update || undefined,
          javascript: formCat.javascript || undefined,
          python_editado_manual: formCat.python_editado_manual,
          javascript_editado_manual: formCat.javascript_editado_manual,
        } as Record<string, unknown>)
      } else {
        await categoriasCaractPersApi.crear({
          ...(formCat.codigo_cat_pers.trim() ? { codigo_cat_pers: formCat.codigo_cat_pers.toUpperCase() } : {}),
          codigo_grupo: grupoActivo ?? undefined,
          nombre_cat_pers: formCat.nombre_cat_pers,
          descripcion_cat_pers: formCat.descripcion_cat_pers || undefined,
          es_unica_pers: formCat.es_unica_pers,
          editable_en_detalle_pers: formCat.editable_en_detalle_pers,
        })
      }
      if (cerrar) setModalCat(false)
      cargarCategorias()
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardandoCat(false)
    }
  }

  const eliminarCat = async () => {
    if (!confirmCat) return
    setEliminandoCat(true)
    try {
      await categoriasCaractPersApi.desactivar(confirmCat.codigo_cat_pers)
      setConfirmCat(null)
      cargarCategorias()
    } finally {
      setEliminandoCat(false)
    }
  }

  // ── CRUD Tipos ────────────────────────────────────────────────────────────
  const abrirNuevoTipo = () => {
    setTipoEditando(null)
    setFormTipo({ codigo_tipo_pers: '', nombre_tipo_pers: '' })
    setErrorTipo('')
    setModalTipo(true)
  }

  const abrirEditarTipo = (tipo: TipoCaractPers) => {
    setTipoEditando(tipo)
    setFormTipo({ codigo_tipo_pers: tipo.codigo_tipo_pers, nombre_tipo_pers: tipo.nombre_tipo_pers })
    setErrorTipo('')
    setModalTipo(true)
  }

  const guardarTipo = async (cerrar = true) => {
    if (!catSeleccionada) return
    if (!formTipo.nombre_tipo_pers.trim()) {
      setErrorTipo(t('errorNombreObligatorio'))
      return
    }
    setGuardandoTipo(true)
    try {
      if (tipoEditando) {
        await categoriasCaractPersApi.actualizarTipo(catSeleccionada.codigo_cat_pers, tipoEditando.codigo_tipo_pers, {
          nombre_tipo_pers: formTipo.nombre_tipo_pers,
        })
      } else {
        await categoriasCaractPersApi.crearTipo(catSeleccionada.codigo_cat_pers, {
          codigo_grupo: grupoActivo ?? undefined,
          codigo_cat_pers: catSeleccionada.codigo_cat_pers,
          ...(formTipo.codigo_tipo_pers.trim() ? { codigo_tipo_pers: formTipo.codigo_tipo_pers.toUpperCase() } : { codigo_tipo_pers: '' }),
          nombre_tipo_pers: formTipo.nombre_tipo_pers,
        })
      }
      if (cerrar) setModalTipo(false)
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardandoTipo(false)
    }
  }

  const eliminarTipo = async () => {
    if (!confirmTipo || !catSeleccionada) return
    setEliminandoTipo(true)
    try {
      await categoriasCaractPersApi.desactivarTipo(catSeleccionada.codigo_cat_pers, confirmTipo.codigo_tipo_pers)
      setConfirmTipo(null)
      cargarTipos()
    } finally {
      setEliminandoTipo(false)
    }
  }

  // ── Roles: asignar / quitar / reordenar (usa id_rol tras migración 051) ──
  const rolesNoAsignados = rolesDisponibles.filter(
    (r) => !rolesCategoria.some((rc) => rc.id_rol === r.id_rol)
  )

  const rolesNoAsignadosFiltrados = rolesNoAsignados.filter(
    (r) =>
      busquedaRol.length === 0 ||
      r.nombre.toLowerCase().includes(busquedaRol.toLowerCase()) ||
      r.codigo_rol.toLowerCase().includes(busquedaRol.toLowerCase())
  )

  const asignarRol = async (idRol: number) => {
    if (!catSeleccionada) return
    try {
      await categoriasCaractPersApi.asignarRol(catSeleccionada.codigo_cat_pers, idRol)
      setBusquedaRol('')
      setDropdownRolAbierto(false)
      cargarRolesCategoria()
    } catch { /* silencioso */ }
  }

  const quitarRol = async (idRol: number) => {
    if (!catSeleccionada) return
    await categoriasCaractPersApi.quitarRol(catSeleccionada.codigo_cat_pers, idRol)
    cargarRolesCategoria()
  }

  const reordenarRolesCategoria = async (nuevos: typeof rolesCategoria) => {
    setRolesCategoria(nuevos)
    try {
      await categoriasCaractPersApi.reordenarRoles(
        catSeleccionada!.codigo_cat_pers,
        nuevos.map((r) => ({ id_rol: r.id_rol, orden: r.orden ?? 0 }))
      )
    } catch {
      if (catSeleccionada) cargarRolesCategoria()
    }
  }

  // ── Reordenar categorías (drag-and-drop) ──────────────────────────────────
  const reordenarCategorias = async (nuevas: typeof categorias) => {
    setCategorias(nuevas)
    try {
      await categoriasCaractPersApi.reordenar(nuevas.map((c) => ({ codigo: c.codigo_cat_pers, orden: c.orden ?? 0 })))
    } catch {
      cargarCategorias()
    }
  }

  // ── Filtro categorías ─────────────────────────────────────────────────────
  const catsFiltradas = categorias
    .filter((c) =>
      c.codigo_cat_pers.toLowerCase().includes(busquedaCat.toLowerCase()) ||
      c.nombre_cat_pers.toLowerCase().includes(busquedaCat.toLowerCase())
    )

  // ── Selector de categoría (para Tipos y Roles) ───────────────────────────
  const selectorCategoria = (
    <div className="mb-4">
      <label className="block text-sm font-medium text-texto mb-1.5">{t('selectorCategoria')}</label>
      <select
        className="w-full max-w-sm rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm"
        value={catSeleccionada?.codigo_cat_pers || ''}
        onChange={(e) => {
          const cat = categorias.find((c) => c.codigo_cat_pers === e.target.value) || null
          setCatSeleccionada(cat)
        }}
      >
        <option value="">{t('selectorPlaceholder')}</option>
        {categorias.map((c) => (
          <option key={c.codigo_cat_pers} value={c.codigo_cat_pers}>{c.nombre_cat_pers}</option>
        ))}
      </select>
    </div>
  )

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: TabActiva; label: string }[] = [
    { key: 'categorias', label: t('tabCategorias') },
    { key: 'tipos', label: t('tabTipos') },
    { key: 'roles', label: t('tabRoles') },
  ]

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-borde">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabActiva(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tabActiva === tab.key
                ? 'border-primario text-primario'
                : 'border-transparent text-texto-muted hover:text-texto'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB CATEGORÍAS ═══ */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder={t('buscarPlaceholder')} value={busquedaCat} onChange={(e) => setBusquedaCat(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" disabled={catsFiltradas.length === 0}
                onClick={() => exportarExcel(catsFiltradas as unknown as Record<string, unknown>[], [
                  { titulo: t('colCodigo'), campo: 'codigo_cat_pers' },
                  { titulo: t('colNombre'), campo: 'nombre_cat_pers' },
                  { titulo: t('colUnica'), campo: 'es_unica_pers', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: t('colEditable'), campo: 'editable_en_detalle_pers', formato: (v: unknown) => (v ? tc('si') : tc('no')) },
                  { titulo: 'Nombre', campo: 'nombre_cat_pers', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
                ], 'categorias-caracteristica')}>
                <Download size={15} />Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaCat}><Plus size={16} />{t('nuevaCategoria')}</Boton>
            </div>
          </div>

          <SortableDndContext items={catsFiltradas as unknown as Record<string,unknown>[]} getId={(c) => (c as {codigo_cat_pers:string}).codigo_cat_pers} onReorder={(n) => reordenarCategorias(n as typeof categorias)} disabled={!!busquedaCat}>
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh className="w-8" />
                  <TablaTh>{t('colNombre')}</TablaTh>
                  <TablaTh>{t('colUnica')}</TablaTh>
                  <TablaTh>{t('colEditable')}</TablaTh>
                  
                  <TablaTh>{t('colCodigo')}</TablaTh>
                  <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {cargandoCat ? (
                  <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{tc('cargando')}</TablaTd></TablaFila>
                ) : catsFiltradas.length === 0 ? (
                  <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{t('sinCategorias')}</TablaTd></TablaFila>
                ) : catsFiltradas.map((c) => (
                  <SortableRow key={c.codigo_cat_pers} id={c.codigo_cat_pers}>
                    <TablaTd className="font-medium">{c.nombre_cat_pers}</TablaTd>
                    <TablaTd><Insignia variante={c.es_unica_pers ? 'advertencia' : 'neutro'}>{c.es_unica_pers ? tc('si') : tc('no')}</Insignia></TablaTd>
                    <TablaTd><Insignia variante={c.editable_en_detalle_pers ? 'exito' : 'neutro'}>{c.editable_en_detalle_pers ? tc('si') : tc('no')}</Insignia></TablaTd>
                    <TablaTd></TablaTd>
                    <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{c.codigo_cat_pers}</code></TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={tc('editar')}><Pencil size={14} /></button>
                        <button onClick={() => setConfirmCat(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title={t('desactivar')}><Trash2 size={14} /></button>
                      </div>
                    </TablaTd>
                  </SortableRow>
                ))}
              </TablaCuerpo>
            </Tabla>
          </SortableDndContext>
        </>
      )}

      {/* ═══ TAB TIPOS ═══ */}
      {tabActiva === 'tipos' && (
        <>
          {selectorCategoria}
          {catSeleccionada ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-texto-muted">{t('tiposDe', { nombre: catSeleccionada.nombre_cat_pers })}</span>
                <Boton variante="primario" tamano="sm" onClick={abrirNuevoTipo} className="ml-auto"><Plus size={14} />{t('nuevoTipo')}</Boton>
              </div>
              <Tabla>
                <TablaCabecera>
                  <tr>
                    <TablaTh>{t('colNombre')}</TablaTh>
                    
                    <TablaTh>{t('colCodigo')}</TablaTh>
                    <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                  </tr>
                </TablaCabecera>
                <TablaCuerpo>
                  {cargandoTipos ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>{tc('cargando')}</TablaTd></TablaFila>
                  ) : tipos.length === 0 ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>{t('sinTipos')}</TablaTd></TablaFila>
                  ) : tipos.map((tipo) => (
                    <TablaFila key={tipo.codigo_tipo_pers}>
                      <TablaTd className="font-medium">{tipo.nombre_tipo_pers}</TablaTd>
                      <TablaTd></TablaTd>
                      <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{tipo.codigo_tipo_pers}</code></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarTipo(tipo)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmTipo(tipo)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </>
          ) : (
            <p className="text-sm text-texto-muted">{t('seleccioneCategoria')}</p>
          )}
        </>
      )}

      {/* ═══ TAB ROLES ═══ */}
      {tabActiva === 'roles' && (
        <>
          {selectorCategoria}
          {catSeleccionada ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-texto-muted">{t('rolesConAcceso', { nombre: catSeleccionada.nombre_cat_pers })}</span>
              </div>

              {/* Selector buscable de rol */}
              <div ref={dropdownRolRef} className="relative max-w-sm">
                <Input
                  placeholder={t('buscarRolAsignar')}
                  value={busquedaRol}
                  onChange={(e) => { setBusquedaRol(e.target.value); setDropdownRolAbierto(true) }}
                  onFocus={() => setDropdownRolAbierto(true)}
                  icono={<Search size={15} />}
                />
                {dropdownRolAbierto && rolesNoAsignadosFiltrados.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {rolesNoAsignadosFiltrados.slice(0, 20).map((r) => (
                      <button
                        key={r.id_rol}
                        onClick={() => asignarRol(r.id_rol)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primario-muy-claro transition-colors flex justify-between"
                      >
                        <span className="font-medium">{r.nombre}</span>
                        <span className="text-texto-muted text-xs">{r.codigo_rol}{r.codigo_grupo == null ? ' [Global]' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabla roles asignados */}
              <SortableDndContext items={rolesCategoria as unknown as Record<string,unknown>[]} getId={(r) => String((r as {id_rol:number}).id_rol)} onReorder={(n) => reordenarRolesCategoria(n as typeof rolesCategoria)}>
                <Tabla>
                  <TablaCabecera>
                    <tr>
                      <TablaTh className="w-8" />
                      <TablaTh>{t('colRol')}</TablaTh>
                      <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                    </tr>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {cargandoRoles ? (
                      <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={3 as never}>{tc('cargando')}</TablaTd></TablaFila>
                    ) : rolesCategoria.length === 0 ? (
                      <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={3 as never}>{t('sinRolesAsignados')}</TablaTd></TablaFila>
                    ) : rolesCategoria.map((rc) => (
                      <SortableRow key={rc.id_rol} id={String(rc.id_rol)}>
                        <TablaTd className="font-medium">
                          {rc.roles?.nombre_rol || rc.codigo_rol || `id ${rc.id_rol}`}
                        </TablaTd>
                        <TablaTd>
                          <div className="flex justify-end">
                            <button onClick={() => quitarRol(rc.id_rol)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </TablaTd>
                      </SortableRow>
                    ))}
                  </TablaCuerpo>
                </Tabla>
              </SortableDndContext>
            </>
          ) : (
            <p className="text-sm text-texto-muted">{t('seleccioneCategoriaRoles')}</p>
          )}
        </>
      )}

      {/* ═══ MODALES ═══ */}

      {/* Modal Categoría */}
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? t('editarCategoriaTitulo', { nombre: catEditando.nombre_cat_pers }) : t('nuevaCategoriaTitulo')} className="max-w-3xl">
        <div className="flex flex-col gap-4 min-w-[520px] min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update', ...(catEditando ? ['md'] : [])] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabModalCat(tab as 'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md')}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalCat === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : tab === 'programacion_update' ? 'Prog. Update' : '.md'}
              </button>
            ))}
          </div>

          {tabModalCat === 'datos' && (<>
            <Input etiqueta={t('etiquetaNombre')} value={formCat.nombre_cat_pers}
              onChange={(e) => setFormCat({ ...formCat, nombre_cat_pers: e.target.value })}
              placeholder={t('placeholderNombre')} />
            <div>
              <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaDescripcion')}</label>
              <textarea className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[60px]"
                value={formCat.descripcion_cat_pers}
                onChange={(e) => setFormCat({ ...formCat, descripcion_cat_pers: e.target.value })} />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formCat.es_unica_pers}
                  onChange={(e) => setFormCat({ ...formCat, es_unica_pers: e.target.checked })}
                  className="rounded border-borde" />
                {t('unicaPorPersona')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formCat.editable_en_detalle_pers}
                  onChange={(e) => setFormCat({ ...formCat, editable_en_detalle_pers: e.target.checked })}
                  className="rounded border-borde" />
                {t('editableEnDetalle')}
              </label>
            </div>
            {catEditando && (
              <Input etiqueta={t('colCodigo')} value={formCat.codigo_cat_pers} disabled readOnly />
            )}
          </>)}

          {tabModalCat === 'system_prompt' && (
            <TabPrompts
              tabla="categorias_caract_pers"
              pkColumna="codigo_cat_pers"
              pkValor={catEditando?.codigo_cat_pers ?? null}
              campos={formCat}
              onCampoCambiado={(campo, valor) => setFormCat({ ...formCat, [campo]: valor })}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {tabModalCat === 'programacion_insert' && (
            <TabPrompts
              tabla="categorias_caract_pers"
              pkColumna="codigo_cat_pers"
              pkValor={catEditando?.codigo_cat_pers ?? null}
              campos={formCat}
              onCampoCambiado={(campo, valor) => setFormCat({ ...formCat, [campo]: valor })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptUpdate={false}
              mostrarPythonUpdate={false}
            />
          )}
          {tabModalCat === 'programacion_update' && (
            <TabPrompts
              tabla="categorias_caract_pers"
              pkColumna="codigo_cat_pers"
              pkValor={catEditando?.codigo_cat_pers ?? null}
              campos={formCat}
              onCampoCambiado={(campo, valor) => setFormCat({ ...formCat, [campo]: valor })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptInsert={false}
              mostrarPythonInsert={false}
            />
          )}

          {catEditando && tabModalCat === 'md' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={mdCat}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMdCat && (
                <p className={`text-xs px-1 ${mensajeMdCat.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMdCat.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await categoriasCaractPersApi.generarMd(catEditando.codigo_cat_pers)
                        setMdCat(r.md)
                        setMensajeMdCat({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMdCat(false) }
                    }}
                    cargando={generandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoMdCat(true); setMensajeMdCat(null)
                      try {
                        const r = await promptsApi.sincronizarFila('categorias_caract_pers', 'codigo_cat_pers', catEditando.codigo_cat_pers)
                        setMensajeMdCat({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMdCat({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMdCat(false) }
                    }}
                    cargando={sincronizandoMdCat}
                    disabled={generandoMdCat || sincronizandoMdCat || !mdCat}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalCat(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
          {tabModalCat !== 'md' && (
          <PieBotonesModal
            editando={!!catEditando}
            onGuardar={() => guardarCat(false)}
            onGuardarYSalir={() => guardarCat(true)}
            onCerrar={() => setModalCat(false)}
            cargando={guardandoCat}
            botonesIzquierda={(tabModalCat === 'system_prompt' || tabModalCat === 'programacion_insert' || tabModalCat === 'programacion_update') && catEditando ? (
              <PieBotonesPrompts
                tabla="categorias_caract_pers"
                pkColumna="codigo_cat_pers"
                pkValor={catEditando.codigo_cat_pers}
                promptInsert={formCat.prompt_insert || undefined}
                promptUpdate={formCat.prompt_update || undefined}
              />
            ) : undefined}
          />
          )}
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? t('editarTipoTitulo', { nombre: tipoEditando.nombre_tipo_pers }) : t('nuevoTipoTitulo')}>
        <div className="flex flex-col gap-4">
          <Input etiqueta={t('etiquetaNombreTipo')} value={formTipo.nombre_tipo_pers}
            onChange={(e) => setFormTipo({ ...formTipo, nombre_tipo_pers: e.target.value })}
            placeholder={t('placeholderNombreTipo')} />
          {tipoEditando && (
            <Input etiqueta={t('colCodigo')} value={formTipo.codigo_tipo_pers} disabled readOnly />
          )}
          {errorTipo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorTipo}</p></div>}
          <PieBotonesModal
            editando={!!tipoEditando}
            onGuardar={() => guardarTipo(false)}
            onGuardarYSalir={() => guardarTipo(true)}
            onCerrar={() => setModalTipo(false)}
            cargando={guardandoTipo}
          />
        </div>
      </Modal>

      {/* Confirmaciones */}
      <ModalConfirmar abierto={!!confirmCat} alCerrar={() => setConfirmCat(null)} alConfirmar={eliminarCat}
        titulo={t('desactivarCategoriaTitulo')} mensaje={confirmCat ? t('desactivarCategoriaConfirm', { nombre: confirmCat.nombre_cat_pers }) : ''} textoConfirmar={t('desactivar')} cargando={eliminandoCat} />
      <ModalConfirmar abierto={!!confirmTipo} alCerrar={() => setConfirmTipo(null)} alConfirmar={eliminarTipo}
        titulo={t('desactivarTipoTitulo')} mensaje={confirmTipo ? t('desactivarTipoConfirm', { nombre: confirmTipo.nombre_tipo_pers }) : ''} textoConfirmar={t('desactivar')} cargando={eliminandoTipo} />
    </div>
  )
}
