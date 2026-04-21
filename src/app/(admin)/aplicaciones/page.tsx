'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Download, Search, Brain } from 'lucide-react'
import { SortableDndContext, SortableRow, SortableListItem } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { ModalEditorPrompts } from '@/components/ui/modal-editor-prompts'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { aplicacionesApi, funcionesApi, gruposApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Aplicacion, Funcion, Grupo } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useTranslations } from 'next-intl'
import { TIPOS_ELEMENTO, ETIQUETA_TIPO, DESCRIPCION_TIPO, etiquetaTipo, varianteTipo, normalizarTipo, type TipoElemento } from '@/lib/tipo-elemento'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { TabPrompts } from '@/components/ui/tab-prompts'

type FuncionApp = { codigo_funcion: string; orden: number; inicial: boolean; funciones: { nombre_funcion: string } }
type GrupoApp = { codigo_grupo: string; grupos_entidades: { nombre_grupo: string } }

export default function PaginaAplicaciones() {
  const t = useTranslations('aplicaciones')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // ── Modal Aplicacion ──────────────────────────────────────────────────────
  const [modalApp, setModalApp] = useState(false)
  const [appEditando, setAppEditando] = useState<Aplicacion | null>(null)
  const [formApp, setFormApp] = useState<{ codigo_aplicacion: string; nombre: string; alias: string; descripcion: string; tipo: TipoElemento; sidebar_ancho: boolean; prompt: string; system_prompt: string; python: string; javascript: string; python_editado_manual: boolean; javascript_editado_manual: boolean }>({ codigo_aplicacion: '', nombre: '', alias: '', descripcion: '', tipo: 'USUARIO', sidebar_ancho: true, prompt: '', system_prompt: '', python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
  const [tabModalApp, setTabModalApp] = useState<'datos' | 'funciones' | 'grupos' | 'prompts'>('datos')
  const [guardandoApp, setGuardandoApp] = useState(false)
  const [errorApp, setErrorApp] = useState('')

  // Funciones de la app
  const [funcionesApp, setFuncionesApp] = useState<FuncionApp[]>([])
  const [cargandoFuncionesApp, setCargandoFuncionesApp] = useState(false)
  const [funcionNuevaApp, setFuncionNuevaApp] = useState('')
  const [asignandoFuncionApp, setAsignandoFuncionApp] = useState(false)
  const [busquedaFuncionApp, setBusquedaFuncionApp] = useState('')
  const [dropdownFuncionAppAbierto, setDropdownFuncionAppAbierto] = useState(false)
  const dropdownFuncionAppRef = useRef<HTMLDivElement>(null)

  // Grupos de la app
  const [gruposApp, setGruposApp] = useState<GrupoApp[]>([])
  const [todosGrupos, setTodosGrupos] = useState<Grupo[]>([])
  const [cargandoGruposApp, setCargandoGruposApp] = useState(false)
  const [grupoNuevoApp, setGrupoNuevoApp] = useState('')
  const [asignandoGrupoApp, setAsignandoGrupoApp] = useState(false)

  // Confirmar eliminacion
  const [confirmacion, setConfirmacion] = useState<Aplicacion | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [a, f, g] = await Promise.all([aplicacionesApi.listar(), funcionesApi.listar(), gruposApi.listar()])
      setAplicaciones(a)
      setFunciones(f)
      setTodosGrupos(g)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownFuncionAppRef.current && !dropdownFuncionAppRef.current.contains(e.target as Node)) {
        setDropdownFuncionAppAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Aplicacion: cargar relaciones ─────────────────────────────────────────
  const cargarFuncionesApp = useCallback(async (c: string) => {
    setCargandoFuncionesApp(true)
    try { setFuncionesApp(await aplicacionesApi.listarFunciones(c)) } catch { setFuncionesApp([]) }
    finally { setCargandoFuncionesApp(false) }
  }, [])

  const cargarGruposApp = useCallback(async (c: string) => {
    setCargandoGruposApp(true)
    try { setGruposApp(await aplicacionesApi.listarGrupos(c)) } catch { setGruposApp([]) }
    finally { setCargandoGruposApp(false) }
  }, [])

  // ── Aplicacion: CRUD ──────────────────────────────────────────────────────
  const abrirNuevaApp = () => {
    setAppEditando(null); setFormApp({ codigo_aplicacion: '', nombre: '', alias: '', descripcion: '', tipo: 'USUARIO', sidebar_ancho: true, prompt: '', system_prompt: '', python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setErrorApp(''); setTabModalApp('datos'); setModalApp(true)
  }
  const abrirEditarApp = (a: Aplicacion) => {
    setAppEditando(a); setFormApp({
      codigo_aplicacion: a.codigo_aplicacion, nombre: a.nombre, alias: a.alias || '', descripcion: a.descripcion || '',
      tipo: normalizarTipo(a.tipo), sidebar_ancho: a.sidebar_ancho !== false,
      prompt: (a as Record<string, unknown>).prompt as string || '',
      system_prompt: (a as Record<string, unknown>).system_prompt as string || '',
      python: (a as Record<string, unknown>).python as string || '',
      javascript: (a as Record<string, unknown>).javascript as string || '',
      python_editado_manual: ((a as Record<string, unknown>).python_editado_manual as boolean) ?? false,
      javascript_editado_manual: ((a as Record<string, unknown>).javascript_editado_manual as boolean) ?? false,
    })
    setErrorApp(''); setTabModalApp('datos'); cargarFuncionesApp(a.codigo_aplicacion); cargarGruposApp(a.codigo_aplicacion); setModalApp(true)
  }
  const guardarApp = async (cerrar: boolean) => {
    if (!formApp.codigo_aplicacion || !formApp.nombre) { setErrorApp('Codigo y nombre son obligatorios'); return }
    setGuardandoApp(true)
    try {
      if (appEditando) { await aplicacionesApi.actualizar(appEditando.codigo_aplicacion, { nombre: formApp.nombre, alias: formApp.alias || undefined, descripcion: formApp.descripcion || undefined, tipo: formApp.tipo, sidebar_ancho: formApp.sidebar_ancho, prompt: formApp.prompt || undefined, system_prompt: formApp.system_prompt || undefined, python: formApp.python || undefined, javascript: formApp.javascript || undefined, python_editado_manual: formApp.python_editado_manual, javascript_editado_manual: formApp.javascript_editado_manual } as Record<string, unknown>) }
      else {
        const nuevo = await aplicacionesApi.crear(formApp)
        if (!cerrar) {
          setAppEditando(nuevo)
          cargarFuncionesApp(nuevo.codigo_aplicacion)
          cargarGruposApp(nuevo.codigo_aplicacion)
        }
      }
      if (cerrar) { setModalApp(false) }
      cargar()
    } catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoApp(false) }
  }

  // ── Aplicacion: funciones ─────────────────────────────────────────────────
  const funcionesDisponiblesApp = funciones.filter((f) =>
    !funcionesApp.some((fa) => fa.codigo_funcion === f.codigo_funcion) &&
    normalizarTipo(f.tipo) === normalizarTipo(appEditando?.tipo)
  )
  const funcionesAppFiltradas = funcionesDisponiblesApp.filter((f) =>
    busquedaFuncionApp.length === 0 ||
    f.nombre.toLowerCase().includes(busquedaFuncionApp.toLowerCase()) ||
    f.codigo_funcion.toLowerCase().includes(busquedaFuncionApp.toLowerCase())
  )
  const asignarFuncionApp = async () => {
    if (!funcionNuevaApp || !appEditando) return; setAsignandoFuncionApp(true)
    try { await aplicacionesApi.asignarFuncion(appEditando.codigo_aplicacion, funcionNuevaApp); setFuncionNuevaApp(''); setBusquedaFuncionApp(''); cargarFuncionesApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') } finally { setAsignandoFuncionApp(false) }
  }
  const quitarFuncionApp = async (c: string) => {
    if (!appEditando) return
    try { await aplicacionesApi.quitarFuncion(appEditando.codigo_aplicacion, c); cargarFuncionesApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
  }

  const reordenarFuncionesApp = async (nuevas: typeof funcionesApp) => {
    setFuncionesApp(nuevas)
    try {
      await aplicacionesApi.reordenarFunciones(appEditando!.codigo_aplicacion, nuevas.map(f => ({ codigo_funcion: f.codigo_funcion, orden: f.orden ?? 0 })))
    } catch { if (appEditando) cargarFuncionesApp(appEditando.codigo_aplicacion) }
  }

  // ── Aplicacion: grupos ────────────────────────────────────────────────────
  const gruposDisponiblesApp = todosGrupos.filter((g) => !gruposApp.some((ga) => ga.codigo_grupo === g.codigo_grupo))
  const asignarGrupoApp = async () => {
    if (!grupoNuevoApp || !appEditando) return; setAsignandoGrupoApp(true)
    try { await aplicacionesApi.asignarGrupo(appEditando.codigo_aplicacion, grupoNuevoApp); setGrupoNuevoApp(''); cargarGruposApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') } finally { setAsignandoGrupoApp(false) }
  }
  const quitarGrupoApp = async (c: string) => {
    if (!appEditando) return
    try { await aplicacionesApi.quitarGrupo(appEditando.codigo_aplicacion, c); cargarGruposApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
  }

  // ── Eliminacion ───────────────────────────────────────────────────────────
  const ejecutarEliminacion = async () => {
    if (!confirmacion) return; setEliminando(true)
    try {
      await aplicacionesApi.eliminar(confirmacion.codigo_aplicacion)
      setConfirmacion(null); cargar()
    } catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error'); setConfirmacion(null) }
    finally { setEliminando(false) }
  }

  // ── Reordenar aplicaciones ────────────────────────────────────────────────
  const reordenarApps = async (nuevas: Aplicacion[]) => {
    setAplicaciones(nuevas)
    try {
      await aplicacionesApi.reordenar(nuevas.map(a => ({ codigo_aplicacion: a.codigo_aplicacion, orden: a.orden ?? 0 })))
    } catch { cargar() }
  }

  // ── Lista filtrada ────────────────────────────────────────────────────────
  const appsFiltradas = aplicaciones
    .filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase()) || a.codigo_aplicacion.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat />
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">Gestiona las aplicaciones del sistema, sus funciones y grupos</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input placeholder={t('buscarPlaceholder')} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(appsFiltradas as unknown as Record<string, unknown>[], [{ titulo: 'Codigo', campo: 'codigo_aplicacion' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Tipo', campo: 'tipo' }, { titulo: 'Descripcion', campo: 'descripcion' }], 'aplicaciones')} disabled={appsFiltradas.length === 0}><Download size={15} />Excel</Boton>
          <Boton variante="primario" onClick={abrirNuevaApp}><Plus size={16} />{t('nuevaApp')}</Boton>
        </div>
      </div>

      <SortableDndContext items={appsFiltradas as unknown as Record<string,unknown>[]} getId={(a) => (a as Aplicacion).codigo_aplicacion} onReorder={(n) => reordenarApps(n as unknown as Aplicacion[])} disabled={!!busqueda}>
        <Tabla>
          <TablaCabecera><tr><TablaTh className="w-8" /><TablaTh>{t('colCodigo')}</TablaTh><TablaTh>{t('colNombre')}</TablaTh><TablaTh>{t('colTipo')}</TablaTh><TablaTh>{t('colDescripcion')}</TablaTh><TablaTh className="text-right">{tc('acciones')}</TablaTh></tr></TablaCabecera>
          <TablaCuerpo>
            {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>Cargando...</TablaTd></TablaFila>
            ) : appsFiltradas.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>No se encontraron aplicaciones</TablaTd></TablaFila>
            ) : appsFiltradas.map((a) => (
              <SortableRow key={a.codigo_aplicacion} id={a.codigo_aplicacion}>
                <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{a.codigo_aplicacion}</code></TablaTd>
                <TablaTd className="font-medium">{a.nombre}</TablaTd>
                <TablaTd><Insignia variante={varianteTipo(a.tipo)}>{etiquetaTipo(a.tipo)}</Insignia></TablaTd>
                <TablaTd className="text-texto-muted text-sm">{a.descripcion || '—'}</TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => abrirEditarApp(a)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => setConfirmacion(a)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                </TablaTd>
              </SortableRow>
            ))}
          </TablaCuerpo>
        </Tabla>
      </SortableDndContext>

      {/* ── MODAL APLICACION ── */}
      <Modal abierto={modalApp} alCerrar={() => setModalApp(false)} titulo={appEditando ? `Editar aplicacion: ${appEditando.nombre}` : 'Nueva aplicacion'} className="max-w-2xl min-h-[680px]">
        <div className="flex flex-col gap-4">
          {appEditando && (
            <div className="flex border-b border-borde -mx-1 overflow-x-auto">
              {([
                { key: 'datos', label: 'Datos' },
                { key: 'funciones', label: `${t('tabFunciones')} (${funcionesApp.length})` },
                { key: 'grupos', label: `${t('tabGrupos')} (${gruposApp.length})` },
                { key: 'prompts', label: 'Prompts' },
              ] as { key: typeof tabModalApp; label: string }[]).map((tab) => (
                <button key={tab.key} onClick={() => setTabModalApp(tab.key)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${tabModalApp === tab.key ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {tabModalApp === 'datos' && (<>
            <Input etiqueta={t('etiquetaCodigo')} value={formApp.codigo_aplicacion} onChange={(e) => setFormApp({ ...formApp, codigo_aplicacion: e.target.value.toUpperCase() })} disabled={!!appEditando} placeholder={t('placeholderCodigo')} />
            <Input etiqueta={t('etiquetaNombre')} value={formApp.nombre} onChange={(e) => setFormApp({ ...formApp, nombre: e.target.value })} placeholder={t('placeholderNombre')} />
            <Input etiqueta="Alias (nombre corto para la barra superior)" value={formApp.alias} onChange={(e) => setFormApp({ ...formApp, alias: e.target.value })} placeholder="Ej: Documentos" />
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Tipo *</label>
              <select value={formApp.tipo} onChange={(e) => setFormApp({ ...formApp, tipo: e.target.value as TipoElemento })} className={selectClass}>
                {TIPOS_ELEMENTO.map((t) => (
                  <option key={t} value={t}>{DESCRIPCION_TIPO[t]}</option>
                ))}
              </select>
            </div>
            <Input etiqueta="Descripcion" value={formApp.descripcion} onChange={(e) => setFormApp({ ...formApp, descripcion: e.target.value })} />
            <div className="flex items-center gap-3">
              <input type="checkbox" id="sidebar_ancho" checked={formApp.sidebar_ancho} onChange={(e) => setFormApp({ ...formApp, sidebar_ancho: e.target.checked })} className="w-4 h-4 rounded accent-primario cursor-pointer" />
              <label htmlFor="sidebar_ancho" className="text-sm text-texto cursor-pointer">Sidebar expandido al iniciar <span className="text-texto-muted">(desmarcar para apps de uso único como Chat)</span></label>
            </div>
            {errorApp && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorApp}</p></div>}
            <PieBotonesModal editando={!!appEditando} onGuardar={() => guardarApp(false)} onGuardarYSalir={() => guardarApp(true)} onCerrar={() => setModalApp(false)} cargando={guardandoApp} />
          </>)}
          {tabModalApp === 'funciones' && appEditando && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-texto-muted">Solo se muestran funciones de tipo <span className="font-medium">{ETIQUETA_TIPO[normalizarTipo(appEditando.tipo)]}</span> — una aplicación solo admite funciones de su mismo tipo.</p>
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={dropdownFuncionAppRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      type="text"
                      placeholder={t('buscarFuncionPlaceholder')}
                      value={busquedaFuncionApp}
                      onChange={(e) => { setBusquedaFuncionApp(e.target.value); setDropdownFuncionAppAbierto(true); setFuncionNuevaApp('') }}
                      onFocus={() => setDropdownFuncionAppAbierto(true)}
                      className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                    />
                  </div>
                  {dropdownFuncionAppAbierto && (
                    <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {funcionesAppFiltradas.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-texto-muted">No se encontraron funciones</div>
                      ) : funcionesAppFiltradas.slice(0, 20).map((f) => (
                        <button
                          key={f.codigo_funcion}
                          onClick={() => {
                            setFuncionNuevaApp(f.codigo_funcion)
                            setBusquedaFuncionApp(`${f.nombre} (${f.codigo_funcion})`)
                            setDropdownFuncionAppAbierto(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors"
                        >
                          <span className="font-medium">{f.nombre}</span>
                          <span className="ml-2 text-texto-muted text-xs">{f.codigo_funcion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Boton variante="primario" onClick={asignarFuncionApp} cargando={asignandoFuncionApp} disabled={!funcionNuevaApp}><Plus size={14} />{t('asignarFuncion')}</Boton>
              </div>
              {cargandoFuncionesApp ? (
                <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              ) : funcionesApp.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tiene funciones asignadas</p>
              ) : (
                <SortableDndContext items={funcionesApp as unknown as Record<string,unknown>[]} getId={(f) => (f as {codigo_funcion:string}).codigo_funcion} onReorder={(n) => reordenarFuncionesApp(n as typeof funcionesApp)}>
                  <ul className="divide-y divide-borde border border-borde rounded-lg overflow-hidden">
                    {funcionesApp.map((fa) => (
                      <SortableListItem key={fa.codigo_funcion} id={fa.codigo_funcion} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface hover:bg-fondo">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{fa.funciones?.nombre_funcion || fa.codigo_funcion}</div>
                          <div className="text-xs text-texto-muted font-mono">{fa.codigo_funcion}</div>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="Marcar como función inicial de la aplicación">
                          <input
                            type="checkbox"
                            checked={!!fa.inicial}
                            onChange={async (e) => {
                              if (!appEditando) return
                              const nuevo = e.target.checked
                              try {
                                await aplicacionesApi.actualizarRelFuncion(appEditando.codigo_aplicacion, fa.codigo_funcion, { inicial: nuevo })
                                cargarFuncionesApp(appEditando.codigo_aplicacion)
                              } catch (err) {
                                setErrorApp(err instanceof Error ? err.message : 'Error')
                              }
                            }}
                            className="w-4 h-4 rounded accent-primario"
                          />
                          <span className="text-texto-muted">Inicial</span>
                        </label>
                        <button onClick={() => quitarFuncionApp(fa.codigo_funcion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button>
                      </SortableListItem>
                    ))}
                  </ul>
                </SortableDndContext>
              )}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Salir</Boton></div>
            </div>
          )}
          {tabModalApp === 'prompts' && appEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="aplicaciones"
                pkColumna="codigo_aplicacion"
                pkValor={appEditando.codigo_aplicacion}
                campos={{
                  prompt: formApp.prompt,
                  system_prompt: formApp.system_prompt,
                  python: formApp.python,
                  javascript: formApp.javascript,
                  python_editado_manual: formApp.python_editado_manual,
                  javascript_editado_manual: formApp.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormApp({ ...formApp, [c]: v })}
              />
              {errorApp && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorApp}</p></div>}
              <PieBotonesModal editando={!!appEditando} onGuardar={() => guardarApp(false)} onGuardarYSalir={() => guardarApp(true)} onCerrar={() => setModalApp(false)} cargando={guardandoApp} />
            </div>
          )}
          {tabModalApp === 'grupos' && appEditando && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-texto-muted">{t('gruposAcceso')}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select value={grupoNuevoApp} onChange={(e) => setGrupoNuevoApp(e.target.value)} className={selectClass}>
                    <option value="">Seleccionar grupo...</option>
                    {gruposDisponiblesApp.map((g) => (<option key={g.codigo_grupo} value={g.codigo_grupo}>{g.nombre} ({g.codigo_grupo})</option>))}
                  </select>
                </div>
                <Boton variante="primario" onClick={asignarGrupoApp} cargando={asignandoGrupoApp} disabled={!grupoNuevoApp}><Plus size={14} />{t('agregarGrupo')}</Boton>
              </div>
              {cargandoGruposApp ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : gruposApp.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene grupos asignados</p>
              : <div className="flex flex-col gap-2">{gruposApp.map((g) => (
                <div key={g.codigo_grupo} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-texto">{g.grupos_entidades?.nombre_grupo || g.codigo_grupo}</span>
                    <span className="ml-2 text-xs text-texto-muted">{g.codigo_grupo}</span>
                  </div>
                  <button onClick={() => quitarGrupoApp(g.codigo_grupo)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button>
                </div>
              ))}</div>}
              {errorApp && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorApp}</p></div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Salir</Boton></div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL CONFIRMAR ── */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo={t('eliminarApp')}
        mensaje={confirmacion ? `¿Estas seguro de eliminar la aplicacion "${confirmacion.nombre}"? Esta accion no se puede deshacer.` : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
