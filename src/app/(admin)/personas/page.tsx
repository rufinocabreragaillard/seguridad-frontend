'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Download, Search, ChevronDown as ChevronIcon } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { personasApi, tiposDocumentoPersonaApi, entidadesApi, categoriasCaractPersApi } from '@/lib/api'
import type { Persona, TipoDocumentoPersona, Entidad, CategoriaConCaracteristicas, CaracteristicaPersona, TipoCaractPers } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

type TabModal = 'datos' | 'caracteristicas'

export default function PaginaPersonas() {
  const t = useTranslations('personas')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()

  // ── Lista ─────────────────────────────────────────────────────────────────
  const [personas, setPersonas] = useState<Persona[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // ── Datos de referencia ───────────────────────────────────────────────────
  const [tiposDoc, setTiposDoc] = useState<TipoDocumentoPersona[]>([])
  const [entidades, setEntidades] = useState<Entidad[]>([])

  // ── Modal detalle ─────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Persona | null>(null)
  const [tabModal, setTabModal] = useState<TabModal>('datos')
  const [form, setForm] = useState({ nombre: '', codigo_tipo_doc: '', documento_id: '', codigo_entidad: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Selector buscable tipo doc ────────────────────────────────────────────
  const [busquedaTipoDoc, setBusquedaTipoDoc] = useState('')
  const [dropdownTipoDocAbierto, setDropdownTipoDocAbierto] = useState(false)
  const dropdownTipoDocRef = useRef<HTMLDivElement>(null)

  // ── Selector buscable entidad ─────────────────────────────────────────────
  const [busquedaEntidad, setBusquedaEntidad] = useState('')
  const [dropdownEntidadAbierto, setDropdownEntidadAbierto] = useState(false)
  const dropdownEntidadRef = useRef<HTMLDivElement>(null)

  // ── Modal Confirmar ───────────────────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<Persona | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Características ───────────────────────────────────────────────────────
  const [categoriasConCaract, setCategoriasConCaract] = useState<CategoriaConCaracteristicas[]>([])
  const [cargandoCaract, setCargandoCaract] = useState(false)
  const [tiposPorCat, setTiposPorCat] = useState<Record<string, TipoCaractPers[]>>({})

  // ── Formulario nueva característica ───────────────────────────────────────
  const [formCaract, setFormCaract] = useState<{
    codigo_cat_pers: string
    codigo_tipo_pers: string
    valor_texto_pers: string
    valor_numerico_pers: string
    valor_fecha_pers: string
  }>({ codigo_cat_pers: '', codigo_tipo_pers: '', valor_texto_pers: '', valor_numerico_pers: '', valor_fecha_pers: '' })
  const [guardandoCaract, setGuardandoCaract] = useState(false)

  // ── Click outside dropdowns ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownTipoDocRef.current && !dropdownTipoDocRef.current.contains(e.target as Node))
        setDropdownTipoDocAbierto(false)
      if (dropdownEntidadRef.current && !dropdownEntidadRef.current.contains(e.target as Node))
        setDropdownEntidadAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [p, td, ent] = await Promise.all([
        personasApi.listar(),
        tiposDocumentoPersonaApi.listar(),
        entidadesApi.listar(),
      ])
      setPersonas(p)
      setTiposDoc(td)
      setEntidades(ent)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Cargar características ────────────────────────────────────────────────
  const cargarCaracteristicas = useCallback(async (idPersona: number) => {
    setCargandoCaract(true)
    try {
      const data = await personasApi.listarCaracteristicas(idPersona)
      setCategoriasConCaract(data)
      // Cargar tipos para cada categoría
      const tiposMap: Record<string, TipoCaractPers[]> = {}
      for (const cc of data) {
        const cod = cc.categoria.codigo_cat_pers
        if (!tiposMap[cod]) {
          tiposMap[cod] = await categoriasCaractPersApi.listarTipos(cod)
        }
      }
      setTiposPorCat(tiposMap)
    } finally {
      setCargandoCaract(false)
    }
  }, [])

  // ── CRUD Persona ──────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', codigo_tipo_doc: '', documento_id: '', codigo_entidad: '' })
    setBusquedaTipoDoc('')
    setBusquedaEntidad('')
    setError('')
    setTabModal('datos')
    setCategoriasConCaract([])
    setModal(true)
  }

  const abrirEditar = (p: Persona) => {
    setEditando(p)
    setForm({
      nombre: p.nombre,
      codigo_tipo_doc: p.codigo_tipo_doc || '',
      documento_id: p.documento_id || '',
      codigo_entidad: p.codigo_entidad || '',
    })
    setBusquedaTipoDoc('')
    setBusquedaEntidad('')
    setError('')
    setTabModal('datos')
    setModal(true)
    cargarCaracteristicas(p.id_persona)
  }

  const guardar = async (cerrar: boolean) => {
    if (!form.nombre.trim()) {
      setError(t('errorNombreObligatorio'))
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await personasApi.actualizar(editando.id_persona, {
          nombre: form.nombre,
          codigo_tipo_doc: form.codigo_tipo_doc || undefined,
          documento_id: form.documento_id || undefined,
          codigo_entidad: form.codigo_entidad || undefined,
        })
        if (cerrar) setModal(false)
      } else {
        const nuevo = await personasApi.crear({
          nombre: form.nombre,
          codigo_grupo: grupoActivo ?? undefined,
          codigo_tipo_doc: form.codigo_tipo_doc || undefined,
          documento_id: form.documento_id || undefined,
          codigo_entidad: form.codigo_entidad || undefined,
        })
        if (!cerrar) {
          setEditando(nuevo)
          setForm({
            nombre: nuevo.nombre,
            codigo_tipo_doc: nuevo.codigo_tipo_doc || '',
            documento_id: nuevo.documento_id || '',
            codigo_entidad: nuevo.codigo_entidad || '',
          })
          cargarCaracteristicas(nuevo.id_persona)
        } else {
          setModal(false)
        }
      }
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEliminacion = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await personasApi.desactivar(confirmacion.id_persona)
      setConfirmacion(null)
      cargar()
    } finally {
      setEliminando(false)
    }
  }

  // ── CRUD Características ──────────────────────────────────────────────────
  const agregarCaracteristica = async (codigoCat: string) => {
    if (!editando || !formCaract.codigo_tipo_pers) return
    setGuardandoCaract(true)
    try {
      await personasApi.crearCaracteristica(editando.id_persona, {
        codigo_grupo: grupoActivo ?? undefined,
        codigo_cat_pers: codigoCat,
        codigo_tipo_pers: formCaract.codigo_tipo_pers,
        valor_texto_pers: formCaract.valor_texto_pers || undefined,
        valor_numerico_pers: formCaract.valor_numerico_pers ? parseInt(formCaract.valor_numerico_pers) : undefined,
        valor_fecha_pers: formCaract.valor_fecha_pers || undefined,
      } as Partial<CaracteristicaPersona>)
      setFormCaract({ codigo_cat_pers: '', codigo_tipo_pers: '', valor_texto_pers: '', valor_numerico_pers: '', valor_fecha_pers: '' })
      cargarCaracteristicas(editando.id_persona)
    } catch { /* error silencioso */ } finally {
      setGuardandoCaract(false)
    }
  }

  const eliminarCaracteristica = async (idCar: number) => {
    if (!editando) return
    await personasApi.eliminarCaracteristica(editando.id_persona, idCar)
    cargarCaracteristicas(editando.id_persona)
  }

  // ── Filtro lista ──────────────────────────────────────────────────────────
  const filtrados = personas
    .filter((p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.documento_id || '').toLowerCase().includes(busqueda.toLowerCase())
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // ── Helpers selectores ────────────────────────────────────────────────────
  const tiposDocFiltrados = tiposDoc.filter((t) =>
    busquedaTipoDoc.length === 0 ||
    t.nombre.toLowerCase().includes(busquedaTipoDoc.toLowerCase()) ||
    t.codigo_tipo_doc.toLowerCase().includes(busquedaTipoDoc.toLowerCase())
  )

  const entidadesFiltradas = entidades.filter((e) =>
    busquedaEntidad.length === 0 ||
    e.nombre.toLowerCase().includes(busquedaEntidad.toLowerCase()) ||
    e.codigo_entidad.toLowerCase().includes(busquedaEntidad.toLowerCase())
  )

  const tipoDocSeleccionado = tiposDoc.find((t) => t.codigo_tipo_doc === form.codigo_tipo_doc)
  const entidadSeleccionada = entidades.find((e) => e.codigo_entidad === form.codigo_entidad)

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input placeholder={t('buscarPlaceholder')} value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Boton variante="contorno" tamano="sm" disabled={filtrados.length === 0}
            onClick={() => exportarExcel(filtrados as unknown as Record<string, unknown>[], [
              { titulo: 'ID', campo: 'id_persona' },
              { titulo: 'Nombre', campo: 'nombre' },
              { titulo: 'Tipo Doc', campo: 'codigo_tipo_doc' },
              { titulo: 'Documento', campo: 'documento_id' },
              { titulo: 'Entidad', campo: 'codigo_entidad' },
              { titulo: 'Estado', campo: 'nombre_documento', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
            ], 'personas')}>
            <Download size={15} />{tc('exportarExcel')}
          </Boton>
          <Boton variante="primario" onClick={abrirNuevo}><Plus size={16} />{t('nuevaPersona')}</Boton>
        </div>
      </div>

      {/* Tabla personas */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>{t('colNombre')}</TablaTh>
            <TablaTh>{t('colTipoDoc')}</TablaTh>
            <TablaTh>{t('colDocumento')}</TablaTh>
            <TablaTh>{t('colEntidad')}</TablaTh>
            <TablaTh>{t('colEstado')}</TablaTh>
            <TablaTh className="text-right">{tc('acciones')}</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>{tc('cargando')}</TablaTd></TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>{t('sinPersonas')}</TablaTd></TablaFila>
          ) : filtrados.map((p) => (
            <TablaFila key={p.id_persona}>
              <TablaTd className="font-medium">{p.nombre}</TablaTd>
              <TablaTd className="text-sm text-texto-muted">{p.codigo_tipo_doc || '—'}</TablaTd>
              <TablaTd className="text-sm">{p.documento_id || '—'}</TablaTd>
              <TablaTd className="text-sm text-texto-muted">{p.codigo_entidad || '—'}</TablaTd>
              <TablaTd><Insignia variante='exito'>tc('activo')</Insignia></TablaTd>
              <TablaTd>
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => abrirEditar(p)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={tc('editar')}><Pencil size={14} /></button>
                  <button onClick={() => setConfirmacion(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title={t('desactivarTitulo')}><Trash2 size={14} /></button>
                </div>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      {/* ═══ Modal detalle persona ═══ */}
      <Modal abierto={modal} alCerrar={() => setModal(false)}
        titulo={editando ? t('editarTitulo', { nombre: editando.nombre }) : t('nuevoTitulo')}>
        <div className="flex flex-col gap-4 min-w-[500px] min-h-[500px]">
          {/* Tabs dentro del modal */}
          {editando && (
            <div className="flex gap-1 border-b border-borde -mt-2">
              {(['datos', 'caracteristicas'] as TabModal[]).map((tab) => (
                <button key={tab} onClick={() => setTabModal(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tabModal === tab ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                  }`}>
                  {tab === 'datos' ? t('tabDatos') : t('tabCaracteristicas')}
                </button>
              ))}
            </div>
          )}

          {/* ─── Tab Datos ─── */}
          {(tabModal === 'datos' || !editando) && (
            <div className="flex flex-col gap-4">
              <Input etiqueta={t('etiquetaNombre')} value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder={t('placeholderNombre')} />

              {/* Selector buscable Tipo Documento */}
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaTipoDoc')}</label>
                <div ref={dropdownTipoDocRef} className="relative">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      className="w-full rounded-lg border border-borde bg-fondo-tarjeta pl-9 pr-3 py-2 text-sm"
                      placeholder={tipoDocSeleccionado ? tipoDocSeleccionado.nombre : t('placeholderTipoDoc')}
                      value={busquedaTipoDoc}
                      onChange={(e) => { setBusquedaTipoDoc(e.target.value); setDropdownTipoDocAbierto(true) }}
                      onFocus={() => setDropdownTipoDocAbierto(true)}
                    />
                  </div>
                  {dropdownTipoDocAbierto && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <button onClick={() => { setForm({ ...form, codigo_tipo_doc: '' }); setDropdownTipoDocAbierto(false); setBusquedaTipoDoc('') }}
                        className="w-full px-3 py-2 text-left text-sm text-texto-muted hover:bg-fondo">{t('sinTipoDoc')}</button>
                      {tiposDocFiltrados.slice(0, 20).map((t) => (
                        <button key={t.codigo_tipo_doc}
                          onClick={() => { setForm({ ...form, codigo_tipo_doc: t.codigo_tipo_doc }); setDropdownTipoDocAbierto(false); setBusquedaTipoDoc('') }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primario-muy-claro flex justify-between">
                          <span className="font-medium">{t.nombre}</span>
                          <span className="text-texto-muted text-xs">{t.codigo_tipo_doc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Input etiqueta={t('etiquetaDocumentoId')} value={form.documento_id}
                onChange={(e) => setForm({ ...form, documento_id: e.target.value })}
                placeholder={t('placeholderDocumentoId')} />

              {/* Selector buscable Entidad */}
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaEntidad')}</label>
                <div ref={dropdownEntidadRef} className="relative">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      className="w-full rounded-lg border border-borde bg-fondo-tarjeta pl-9 pr-3 py-2 text-sm"
                      placeholder={entidadSeleccionada ? entidadSeleccionada.nombre : t('placeholderEntidad')}
                      value={busquedaEntidad}
                      onChange={(e) => { setBusquedaEntidad(e.target.value); setDropdownEntidadAbierto(true) }}
                      onFocus={() => setDropdownEntidadAbierto(true)}
                    />
                  </div>
                  {dropdownEntidadAbierto && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <button onClick={() => { setForm({ ...form, codigo_entidad: '' }); setDropdownEntidadAbierto(false); setBusquedaEntidad('') }}
                        className="w-full px-3 py-2 text-left text-sm text-texto-muted hover:bg-fondo">{t('sinEntidad')}</button>
                      {entidadesFiltradas.slice(0, 20).map((e) => (
                        <button key={e.codigo_entidad}
                          onClick={() => { setForm({ ...form, codigo_entidad: e.codigo_entidad }); setDropdownEntidadAbierto(false); setBusquedaEntidad('') }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primario-muy-claro flex justify-between">
                          <span className="font-medium">{e.nombre}</span>
                          <span className="text-texto-muted text-xs">{e.codigo_entidad}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}

              <PieBotonesModal
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModal(false)}
                cargando={guardando}
              />
            </div>
          )}

          {/* ─── Tab Características ─── */}
          {tabModal === 'caracteristicas' && editando && (
            <div className="flex flex-col gap-4">
              {cargandoCaract ? (
                <p className="text-sm text-texto-muted py-4 text-center">{t('cargandoCaracteristicas')}</p>
              ) : categoriasConCaract.length === 0 ? (
                <p className="text-sm text-texto-muted py-4 text-center">{t('sinCategoriasVisibles')}</p>
              ) : (
                categoriasConCaract.map((cc) => {
                  const cat = cc.categoria
                  const tiposDisponibles = (tiposPorCat[cat.codigo_cat_pers] || [])
                  const puedeAgregar = cat.editable_en_detalle_pers && (!cat.es_unica_pers || cc.caracteristicas.length === 0)

                  return (
                    <div key={cat.codigo_cat_pers} className="border border-borde rounded-lg">
                      {/* Cabecera de categoría */}
                      <div className="bg-fondo px-4 py-2 flex items-center justify-between rounded-t-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{cat.nombre_cat_pers}</span>
                          {cat.es_unica_pers && <Insignia variante="advertencia">{t('unica')}</Insignia>}
                          {!cat.editable_en_detalle_pers && <Insignia variante="neutro">{t('soloLectura')}</Insignia>}
                        </div>
                        <span className="text-xs text-texto-muted">{t('registros', { n: cc.caracteristicas.length })}</span>
                      </div>

                      {/* Lista de características */}
                      <div className="divide-y divide-borde">
                        {cc.caracteristicas.map((c) => (
                          <div key={c.id_caracteristica_pers} className="px-4 py-2 flex items-center gap-3 text-sm">
                            <span className="text-texto-muted min-w-[120px]">
                              {c.tipos_caract_pers?.nombre_tipo_pers || c.codigo_tipo_pers}
                            </span>
                            <span className="flex-1">
                              {c.valor_texto_pers || c.valor_numerico_pers || c.valor_fecha_pers || '—'}
                            </span>
                            {cat.editable_en_detalle_pers && (
                              <button onClick={() => eliminarCaracteristica(c.id_caracteristica_pers)}
                                className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}

                        {cc.caracteristicas.length === 0 && (
                          <p className="px-4 py-3 text-sm text-texto-muted">{t('sinCaracteristicas')}</p>
                        )}
                      </div>

                      {/* Formulario agregar */}
                      {puedeAgregar && (
                        <div className="border-t border-borde px-4 py-3 flex items-end gap-2">
                          <div className="flex-1">
                            <select
                              className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-1.5 text-sm"
                              value={formCaract.codigo_cat_pers === cat.codigo_cat_pers ? formCaract.codigo_tipo_pers : ''}
                              onChange={(e) => setFormCaract({ ...formCaract, codigo_cat_pers: cat.codigo_cat_pers, codigo_tipo_pers: e.target.value })}
                            >
                              <option value="">{t('placeholderTipo')}</option>
                              {tiposDisponibles.map((t) => (
                                <option key={t.codigo_tipo_pers} value={t.codigo_tipo_pers}>{t.nombre_tipo_pers}</option>
                              ))}
                            </select>
                          </div>
                          <input className="flex-1 rounded-lg border border-borde bg-fondo-tarjeta px-3 py-1.5 text-sm"
                            placeholder={t('placeholderValorTexto')}
                            value={formCaract.codigo_cat_pers === cat.codigo_cat_pers ? formCaract.valor_texto_pers : ''}
                            onChange={(e) => setFormCaract({ ...formCaract, codigo_cat_pers: cat.codigo_cat_pers, valor_texto_pers: e.target.value })} />
                          <input className="w-24 rounded-lg border border-borde bg-fondo-tarjeta px-3 py-1.5 text-sm"
                            placeholder={t('placeholderNumero')} type="number"
                            value={formCaract.codigo_cat_pers === cat.codigo_cat_pers ? formCaract.valor_numerico_pers : ''}
                            onChange={(e) => setFormCaract({ ...formCaract, codigo_cat_pers: cat.codigo_cat_pers, valor_numerico_pers: e.target.value })} />
                          <input className="w-36 rounded-lg border border-borde bg-fondo-tarjeta px-3 py-1.5 text-sm"
                            type="date"
                            value={formCaract.codigo_cat_pers === cat.codigo_cat_pers ? formCaract.valor_fecha_pers : ''}
                            onChange={(e) => setFormCaract({ ...formCaract, codigo_cat_pers: cat.codigo_cat_pers, valor_fecha_pers: e.target.value })} />
                          <Boton variante="primario" tamano="sm"
                            onClick={() => agregarCaracteristica(cat.codigo_cat_pers)}
                            cargando={guardandoCaract}
                            disabled={formCaract.codigo_cat_pers !== cat.codigo_cat_pers || !formCaract.codigo_tipo_pers}>
                            <Plus size={14} />
                          </Boton>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <PieBotonesModal
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModal(false)}
                cargando={guardando}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Confirmar */}
      <ModalConfirmar abierto={!!confirmacion} alCerrar={() => setConfirmacion(null)} alConfirmar={ejecutarEliminacion}
        titulo={t('desactivarTitulo')} mensaje={confirmacion ? t('desactivarConfirm', { nombre: confirmacion.nombre }) : ''}
        textoConfirmar={t('desactivarTitulo')} cargando={eliminando} />
    </div>
  )
}
