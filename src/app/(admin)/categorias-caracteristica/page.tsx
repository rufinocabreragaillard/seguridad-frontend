'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, Download, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { categoriasCaractPersApi, rolesApi } from '@/lib/api'
import type { CategoriaCaractPers, TipoCaractPers, RolCaractPers, Rol } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'

type TabActiva = 'categorias' | 'tipos' | 'roles'

export default function PaginaCategoriasCaracteristica() {
  const { grupoActivo } = useAuth()

  const [tabActiva, setTabActiva] = useState<TabActiva>('categorias')

  // ── Categorías ────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaCaractPers[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [busquedaCat, setBusquedaCat] = useState('')
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaCaractPers | null>(null)
  const [formCat, setFormCat] = useState({
    codigo_cat_pers: '', nombre_cat_pers: '', descripcion_cat_pers: '',
    es_unica_pers: false, editable_en_detalle_pers: true,
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
      setRolesDisponibles(allRoles.filter((r) => r.activo))
    } finally {
      setCargandoRoles(false)
    }
  }, [catSeleccionada])

  useEffect(() => { if (tabActiva === 'roles') cargarRolesCategoria() }, [tabActiva, cargarRolesCategoria])

  // ── CRUD Categorías ───────────────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({ codigo_cat_pers: '', nombre_cat_pers: '', descripcion_cat_pers: '', es_unica_pers: false, editable_en_detalle_pers: true })
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaCaractPers) => {
    setCatEditando(c)
    setFormCat({
      codigo_cat_pers: c.codigo_cat_pers,
      nombre_cat_pers: c.nombre_cat_pers,
      descripcion_cat_pers: c.descripcion_cat_pers || '',
      es_unica_pers: c.es_unica_pers,
      editable_en_detalle_pers: c.editable_en_detalle_pers,
    })
    setErrorCat('')
    setModalCat(true)
  }

  const guardarCat = async () => {
    if (!formCat.codigo_cat_pers.trim() || !formCat.nombre_cat_pers.trim()) {
      setErrorCat('Código y nombre son obligatorios')
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
        })
      } else {
        await categoriasCaractPersApi.crear({
          codigo_cat_pers: formCat.codigo_cat_pers.toUpperCase(),
          codigo_grupo: grupoActivo,
          nombre_cat_pers: formCat.nombre_cat_pers,
          descripcion_cat_pers: formCat.descripcion_cat_pers || undefined,
          es_unica_pers: formCat.es_unica_pers,
          editable_en_detalle_pers: formCat.editable_en_detalle_pers,
        })
      }
      setModalCat(false)
      cargarCategorias()
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : 'Error al guardar')
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

  const abrirEditarTipo = (t: TipoCaractPers) => {
    setTipoEditando(t)
    setFormTipo({ codigo_tipo_pers: t.codigo_tipo_pers, nombre_tipo_pers: t.nombre_tipo_pers })
    setErrorTipo('')
    setModalTipo(true)
  }

  const guardarTipo = async () => {
    if (!catSeleccionada) return
    if (!formTipo.codigo_tipo_pers.trim() || !formTipo.nombre_tipo_pers.trim()) {
      setErrorTipo('Código y nombre son obligatorios')
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
          codigo_grupo: grupoActivo,
          codigo_cat_pers: catSeleccionada.codigo_cat_pers,
          codigo_tipo_pers: formTipo.codigo_tipo_pers.toUpperCase(),
          nombre_tipo_pers: formTipo.nombre_tipo_pers,
        })
      }
      setModalTipo(false)
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : 'Error al guardar')
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

  // ── Roles: asignar / quitar / reordenar ───────────────────────────────────
  const rolesNoAsignados = rolesDisponibles.filter(
    (r) => !rolesCategoria.some((rc) => rc.codigo_rol === r.codigo_rol)
  )

  const rolesNoAsignadosFiltrados = rolesNoAsignados.filter(
    (r) =>
      busquedaRol.length === 0 ||
      r.nombre.toLowerCase().includes(busquedaRol.toLowerCase()) ||
      r.codigo_rol.toLowerCase().includes(busquedaRol.toLowerCase())
  )

  const asignarRol = async (codigoRol: string) => {
    if (!catSeleccionada) return
    try {
      await categoriasCaractPersApi.asignarRol(catSeleccionada.codigo_cat_pers, codigoRol)
      setBusquedaRol('')
      setDropdownRolAbierto(false)
      cargarRolesCategoria()
    } catch { /* silencioso */ }
  }

  const quitarRol = async (codigoRol: string) => {
    if (!catSeleccionada) return
    await categoriasCaractPersApi.quitarRol(catSeleccionada.codigo_cat_pers, codigoRol)
    cargarRolesCategoria()
  }

  const moverRol = async (index: number, dir: 'arriba' | 'abajo') => {
    if (!catSeleccionada) return
    const lista = [...rolesCategoria]
    const swap = dir === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const oA = lista[index].orden; const oB = lista[swap].orden
    lista[index].orden = oB; lista[swap].orden = oA
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setRolesCategoria(lista)
    try {
      await categoriasCaractPersApi.reordenarRoles(
        catSeleccionada.codigo_cat_pers,
        lista.map((r) => ({ codigo_rol: r.codigo_rol, orden: r.orden }))
      )
    } catch {
      cargarRolesCategoria()
    }
  }

  // ── Filtro categorías ─────────────────────────────────────────────────────
  const catsFiltradas = categorias
    .filter((c) =>
      c.codigo_cat_pers.toLowerCase().includes(busquedaCat.toLowerCase()) ||
      c.nombre_cat_pers.toLowerCase().includes(busquedaCat.toLowerCase())
    )
    .sort((a, b) => a.nombre_cat_pers.localeCompare(b.nombre_cat_pers))

  // ── Selector de categoría (para Tipos y Roles) ───────────────────────────
  const selectorCategoria = (
    <div className="mb-4">
      <label className="block text-sm font-medium text-texto mb-1.5">Categoría</label>
      <select
        className="w-full max-w-sm rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm"
        value={catSeleccionada?.codigo_cat_pers || ''}
        onChange={(e) => {
          const cat = categorias.find((c) => c.codigo_cat_pers === e.target.value) || null
          setCatSeleccionada(cat)
        }}
      >
        <option value="">Seleccione una categoría...</option>
        {categorias.filter((c) => c.activo).map((c) => (
          <option key={c.codigo_cat_pers} value={c.codigo_cat_pers}>{c.nombre_cat_pers}</option>
        ))}
      </select>
    </div>
  )

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: TabActiva; label: string }[] = [
    { key: 'categorias', label: 'Categorías' },
    { key: 'tipos', label: 'Tipos' },
    { key: 'roles', label: 'Roles' },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Categorías de Características</h2>
        <p className="text-sm text-texto-muted mt-1">Gestión de categorías, tipos y permisos por rol</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-borde">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabActiva(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tabActiva === t.key
                ? 'border-primario text-primario'
                : 'border-transparent text-texto-muted hover:text-texto'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB CATEGORÍAS ═══ */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder="Buscar..." value={busquedaCat} onChange={(e) => setBusquedaCat(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" disabled={catsFiltradas.length === 0}
                onClick={() => exportarExcel(catsFiltradas as unknown as Record<string, unknown>[], [
                  { titulo: 'Código', campo: 'codigo_cat_pers' },
                  { titulo: 'Nombre', campo: 'nombre_cat_pers' },
                  { titulo: 'Única', campo: 'es_unica_pers', formato: (v: unknown) => (v ? 'Sí' : 'No') },
                  { titulo: 'Editable', campo: 'editable_en_detalle_pers', formato: (v: unknown) => (v ? 'Sí' : 'No') },
                  { titulo: 'Estado', campo: 'activo', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
                ], 'categorias-caracteristica')}>
                <Download size={15} />Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevaCat}><Plus size={16} />Nueva categoría</Boton>
            </div>
          </div>

          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>Código</TablaTh>
                <TablaTh>Nombre</TablaTh>
                <TablaTh>Única</TablaTh>
                <TablaTh>Editable</TablaTh>
                <TablaTh>Estado</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargandoCat ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>Cargando...</TablaTd></TablaFila>
              ) : catsFiltradas.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>Sin categorías</TablaTd></TablaFila>
              ) : catsFiltradas.map((c) => (
                <TablaFila key={c.codigo_cat_pers}>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{c.codigo_cat_pers}</code></TablaTd>
                  <TablaTd className="font-medium">{c.nombre_cat_pers}</TablaTd>
                  <TablaTd><Insignia variante={c.es_unica_pers ? 'advertencia' : 'neutro'}>{c.es_unica_pers ? 'Sí' : 'No'}</Insignia></TablaTd>
                  <TablaTd><Insignia variante={c.editable_en_detalle_pers ? 'exito' : 'neutro'}>{c.editable_en_detalle_pers ? 'Sí' : 'No'}</Insignia></TablaTd>
                  <TablaTd><Insignia variante={c.activo ? 'exito' : 'error'}>{c.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarCat(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmCat(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Desactivar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </>
      )}

      {/* ═══ TAB TIPOS ═══ */}
      {tabActiva === 'tipos' && (
        <>
          {selectorCategoria}
          {catSeleccionada ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-texto-muted">Tipos de: <strong>{catSeleccionada.nombre_cat_pers}</strong></span>
                <Boton variante="primario" tamano="sm" onClick={abrirNuevoTipo} className="ml-auto"><Plus size={14} />Nuevo tipo</Boton>
              </div>
              <Tabla>
                <TablaCabecera>
                  <tr>
                    <TablaTh>Código</TablaTh>
                    <TablaTh>Nombre</TablaTh>
                    <TablaTh>Estado</TablaTh>
                    <TablaTh className="text-right">Acciones</TablaTh>
                  </tr>
                </TablaCabecera>
                <TablaCuerpo>
                  {cargandoTipos ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>Cargando...</TablaTd></TablaFila>
                  ) : tipos.length === 0 ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={4 as never}>Sin tipos</TablaTd></TablaFila>
                  ) : tipos.map((t) => (
                    <TablaFila key={t.codigo_tipo_pers}>
                      <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{t.codigo_tipo_pers}</code></TablaTd>
                      <TablaTd className="font-medium">{t.nombre_tipo_pers}</TablaTd>
                      <TablaTd><Insignia variante={t.activo ? 'exito' : 'error'}>{t.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarTipo(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmTipo(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </>
          ) : (
            <p className="text-sm text-texto-muted">Seleccione una categoría para ver sus tipos.</p>
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
                <span className="text-sm text-texto-muted">Roles con acceso a: <strong>{catSeleccionada.nombre_cat_pers}</strong></span>
              </div>

              {/* Selector buscable de rol */}
              <div ref={dropdownRolRef} className="relative max-w-sm">
                <Input
                  placeholder="Buscar rol para asignar..."
                  value={busquedaRol}
                  onChange={(e) => { setBusquedaRol(e.target.value); setDropdownRolAbierto(true) }}
                  onFocus={() => setDropdownRolAbierto(true)}
                  icono={<Search size={15} />}
                />
                {dropdownRolAbierto && rolesNoAsignadosFiltrados.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {rolesNoAsignadosFiltrados.slice(0, 20).map((r) => (
                      <button
                        key={r.codigo_rol}
                        onClick={() => asignarRol(r.codigo_rol)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primario-muy-claro transition-colors flex justify-between"
                      >
                        <span className="font-medium">{r.nombre}</span>
                        <span className="text-texto-muted text-xs">{r.codigo_rol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabla roles asignados */}
              <Tabla>
                <TablaCabecera>
                  <tr>
                    <TablaTh>Orden</TablaTh>
                    <TablaTh>Rol</TablaTh>
                    <TablaTh className="text-right">Acciones</TablaTh>
                  </tr>
                </TablaCabecera>
                <TablaCuerpo>
                  {cargandoRoles ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={3 as never}>Cargando...</TablaTd></TablaFila>
                  ) : rolesCategoria.length === 0 ? (
                    <TablaFila><TablaTd className="py-6 text-center text-texto-muted" colSpan={3 as never}>Sin roles asignados</TablaTd></TablaFila>
                  ) : rolesCategoria.map((rc, idx) => (
                    <TablaFila key={rc.codigo_rol}>
                      <TablaTd>
                        <div className="flex items-center gap-1">
                          <button disabled={idx === 0} onClick={() => moverRol(idx, 'arriba')}
                            className="p-1 rounded hover:bg-fondo disabled:opacity-30"><ChevronUp size={14} /></button>
                          <button disabled={idx === rolesCategoria.length - 1} onClick={() => moverRol(idx, 'abajo')}
                            className="p-1 rounded hover:bg-fondo disabled:opacity-30"><ChevronDown size={14} /></button>
                          <span className="text-xs text-texto-muted ml-1">{rc.orden}</span>
                        </div>
                      </TablaTd>
                      <TablaTd className="font-medium">
                        {rc.roles?.nombre_rol || rc.codigo_rol}
                      </TablaTd>
                      <TablaTd>
                        <div className="flex justify-end">
                          <button onClick={() => quitarRol(rc.codigo_rol)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </>
          ) : (
            <p className="text-sm text-texto-muted">Seleccione una categoría para gestionar roles.</p>
          )}
        </>
      )}

      {/* ═══ MODALES ═══ */}

      {/* Modal Categoría */}
      <Modal abierto={modalCat} alCerrar={() => setModalCat(false)} titulo={catEditando ? `Editar: ${catEditando.nombre_cat_pers}` : 'Nueva categoría'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formCat.codigo_cat_pers}
            onChange={(e) => setFormCat({ ...formCat, codigo_cat_pers: e.target.value.toUpperCase() })}
            placeholder="Ej: DATOS_CONTACTO" disabled={!!catEditando} />
          <Input etiqueta="Nombre *" value={formCat.nombre_cat_pers}
            onChange={(e) => setFormCat({ ...formCat, nombre_cat_pers: e.target.value })}
            placeholder="Nombre de la categoría" />
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Descripción</label>
            <textarea className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[60px]"
              value={formCat.descripcion_cat_pers}
              onChange={(e) => setFormCat({ ...formCat, descripcion_cat_pers: e.target.value })} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formCat.es_unica_pers}
                onChange={(e) => setFormCat({ ...formCat, es_unica_pers: e.target.checked })}
                className="rounded border-borde" />
              Única por persona
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formCat.editable_en_detalle_pers}
                onChange={(e) => setFormCat({ ...formCat, editable_en_detalle_pers: e.target.checked })}
                className="rounded border-borde" />
              Editable en detalle
            </label>
          </div>
          {errorCat && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCat}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalCat(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarCat} cargando={guardandoCat}>{catEditando ? 'Guardar' : 'Crear'}</Boton>
          </div>
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal abierto={modalTipo} alCerrar={() => setModalTipo(false)} titulo={tipoEditando ? `Editar: ${tipoEditando.nombre_tipo_pers}` : 'Nuevo tipo'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formTipo.codigo_tipo_pers}
            onChange={(e) => setFormTipo({ ...formTipo, codigo_tipo_pers: e.target.value.toUpperCase() })}
            placeholder="Ej: EMAIL, TELEFONO" disabled={!!tipoEditando} />
          <Input etiqueta="Nombre *" value={formTipo.nombre_tipo_pers}
            onChange={(e) => setFormTipo({ ...formTipo, nombre_tipo_pers: e.target.value })}
            placeholder="Nombre del tipo" />
          {errorTipo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorTipo}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalTipo(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarTipo} cargando={guardandoTipo}>{tipoEditando ? 'Guardar' : 'Crear'}</Boton>
          </div>
        </div>
      </Modal>

      {/* Confirmaciones */}
      <ModalConfirmar abierto={!!confirmCat} alCerrar={() => setConfirmCat(null)} alConfirmar={eliminarCat}
        titulo="Desactivar categoría" mensaje={confirmCat ? `¿Desactivar "${confirmCat.nombre_cat_pers}"?` : ''} textoConfirmar="Desactivar" cargando={eliminandoCat} />
      <ModalConfirmar abierto={!!confirmTipo} alCerrar={() => setConfirmTipo(null)} alConfirmar={eliminarTipo}
        titulo="Desactivar tipo" mensaje={confirmTipo ? `¿Desactivar "${confirmTipo.nombre_tipo_pers}"?` : ''} textoConfirmar="Desactivar" cargando={eliminandoTipo} />
    </div>
  )
}
