'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Download, Search } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { aplicacionesApi, funcionesApi, gruposApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Aplicacion, Funcion, Grupo } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

type FuncionApp = { codigo_funcion: string; funciones: { nombre_funcion: string } }
type GrupoApp = { codigo_grupo: string; grupos_entidades: { nombre_grupo: string } }

export default function PaginaAplicaciones() {
  const { grupoActivo } = useAuth()
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // ── Modal Aplicacion ──────────────────────────────────────────────────────
  const [modalApp, setModalApp] = useState(false)
  const [appEditando, setAppEditando] = useState<Aplicacion | null>(null)
  const [formApp, setFormApp] = useState<{ codigo_aplicacion: string; nombre: string; descripcion: string; tipo: 'NORMAL' | 'RESTRINGIDA' }>({ codigo_aplicacion: '', nombre: '', descripcion: '', tipo: 'NORMAL' })
  const [tabModalApp, setTabModalApp] = useState<'datos' | 'funciones' | 'grupos'>('datos')
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
    setAppEditando(null); setFormApp({ codigo_aplicacion: '', nombre: '', descripcion: '', tipo: 'NORMAL' })
    setErrorApp(''); setTabModalApp('datos'); setModalApp(true)
  }
  const abrirEditarApp = (a: Aplicacion) => {
    setAppEditando(a); setFormApp({ codigo_aplicacion: a.codigo_aplicacion, nombre: a.nombre, descripcion: a.descripcion || '', tipo: (a.tipo as 'NORMAL' | 'RESTRINGIDA') || 'NORMAL' })
    setErrorApp(''); setTabModalApp('datos'); cargarFuncionesApp(a.codigo_aplicacion); cargarGruposApp(a.codigo_aplicacion); setModalApp(true)
  }
  const guardarApp = async () => {
    if (!formApp.codigo_aplicacion || !formApp.nombre) { setErrorApp('Codigo y nombre son obligatorios'); return }
    setGuardandoApp(true)
    try {
      if (appEditando) { await aplicacionesApi.actualizar(appEditando.codigo_aplicacion, { nombre: formApp.nombre, descripcion: formApp.descripcion || undefined, tipo: formApp.tipo }) }
      else { await aplicacionesApi.crear(formApp) }
      setModalApp(false); cargar()
    } catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoApp(false) }
  }

  // ── Aplicacion: funciones ─────────────────────────────────────────────────
  const funcionesDisponiblesApp = funciones.filter((f) => !funcionesApp.some((fa) => fa.codigo_funcion === f.codigo_funcion))
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

  // ── Lista filtrada ────────────────────────────────────────────────────────
  const appsFiltradas = aplicaciones.filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase()) || a.codigo_aplicacion.toLowerCase().includes(busqueda.toLowerCase())).sort((a, b) => {
    const ta = (a.tipo || 'NORMAL'); const tb = (b.tipo || 'NORMAL')
    if (ta !== tb) return ta.localeCompare(tb)
    return a.nombre.localeCompare(b.nombre)
  })

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Aplicaciones</h2>
        <p className="text-sm text-texto-muted mt-1">Gestiona las aplicaciones del sistema, sus funciones y grupos</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input placeholder="Buscar por nombre o codigo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(appsFiltradas as unknown as Record<string, unknown>[], [{ titulo: 'Codigo', campo: 'codigo_aplicacion' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Tipo', campo: 'tipo' }, { titulo: 'Descripcion', campo: 'descripcion' }], 'aplicaciones')} disabled={appsFiltradas.length === 0}><Download size={15} />Excel</Boton>
          <Boton variante="primario" onClick={abrirNuevaApp}><Plus size={16} />Nueva aplicacion</Boton>
        </div>
      </div>

      <Tabla>
        <TablaCabecera><tr><TablaTh>Codigo</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Tipo</TablaTh><TablaTh>Descripcion</TablaTh><TablaTh className="text-right">Acciones</TablaTh></tr></TablaCabecera>
        <TablaCuerpo>
          {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>Cargando...</TablaTd></TablaFila>
          ) : appsFiltradas.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>No se encontraron aplicaciones</TablaTd></TablaFila>
          ) : appsFiltradas.map((a) => (
            <TablaFila key={a.codigo_aplicacion}>
              <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{a.codigo_aplicacion}</code></TablaTd>
              <TablaTd className="font-medium">{a.nombre}</TablaTd>
              <TablaTd><Insignia variante={a.tipo === 'RESTRINGIDA' ? 'error' : 'exito'}>{a.tipo === 'RESTRINGIDA' ? 'Restringida' : 'Normal'}</Insignia></TablaTd>
              <TablaTd className="text-texto-muted text-sm">{a.descripcion || '—'}</TablaTd>
              <TablaTd>
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => abrirEditarApp(a)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => setConfirmacion(a)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      {/* ── MODAL APLICACION ── */}
      <Modal abierto={modalApp} alCerrar={() => setModalApp(false)} titulo={appEditando ? `Editar aplicacion: ${appEditando.nombre}` : 'Nueva aplicacion'} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {appEditando && (
            <div className="flex border-b border-borde -mx-1">
              {(['datos', 'funciones', 'grupos'] as const).map((tab) => (
                <button key={tab} onClick={() => setTabModalApp(tab)} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalApp === tab ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>
                  {tab === 'datos' ? 'Datos' : tab === 'funciones' ? `Funciones (${funcionesApp.length})` : `Grupos (${gruposApp.length})`}
                </button>
              ))}
            </div>
          )}
          {tabModalApp === 'datos' && (<>
            <Input etiqueta="Codigo *" value={formApp.codigo_aplicacion} onChange={(e) => setFormApp({ ...formApp, codigo_aplicacion: e.target.value.toUpperCase() })} disabled={!!appEditando} placeholder="SEGURIDAD" />
            <Input etiqueta="Nombre *" value={formApp.nombre} onChange={(e) => setFormApp({ ...formApp, nombre: e.target.value })} placeholder="Sistema de Seguridad" />
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Tipo *</label>
              <select value={formApp.tipo} onChange={(e) => setFormApp({ ...formApp, tipo: e.target.value as 'NORMAL' | 'RESTRINGIDA' })} className={selectClass}>
                <option value="NORMAL">NORMAL — visible para asignar a cualquier usuario</option>
                <option value="RESTRINGIDA">RESTRINGIDA — solo super-admin puede asignar sus roles</option>
              </select>
            </div>
            <Input etiqueta="Descripcion" value={formApp.descripcion} onChange={(e) => setFormApp({ ...formApp, descripcion: e.target.value })} />
            {errorApp && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorApp}</p></div>}
            <div className="flex gap-3 justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Cancelar</Boton><Boton variante="primario" onClick={guardarApp} cargando={guardandoApp}>{appEditando ? 'Guardar' : 'Crear'}</Boton></div>
          </>)}
          {tabModalApp === 'funciones' && appEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={dropdownFuncionAppRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      type="text"
                      placeholder="Buscar funcion por nombre o codigo..."
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
                <Boton variante="primario" onClick={asignarFuncionApp} cargando={asignandoFuncionApp} disabled={!funcionNuevaApp}><Plus size={14} />Asignar</Boton>
              </div>
              {cargandoFuncionesApp ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : funcionesApp.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene funciones asignadas</p>
              : <div className="flex flex-col gap-2">{funcionesApp.map((fa) => (<div key={fa.codigo_funcion} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"><div><span className="text-sm font-medium text-texto">{fa.funciones?.nombre_funcion || fa.codigo_funcion}</span><span className="ml-2 text-xs text-texto-muted">{fa.codigo_funcion}</span></div><button onClick={() => quitarFuncionApp(fa.codigo_funcion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button></div>))}</div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Cerrar</Boton></div>
            </div>
          )}
          {tabModalApp === 'grupos' && appEditando && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-texto-muted">Grupos de entidades que tienen acceso a esta aplicacion.</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select value={grupoNuevoApp} onChange={(e) => setGrupoNuevoApp(e.target.value)} className={selectClass}>
                    <option value="">Seleccionar grupo...</option>
                    {gruposDisponiblesApp.map((g) => (<option key={g.codigo_grupo} value={g.codigo_grupo}>{g.nombre} ({g.codigo_grupo})</option>))}
                  </select>
                </div>
                <Boton variante="primario" onClick={asignarGrupoApp} cargando={asignandoGrupoApp} disabled={!grupoNuevoApp}><Plus size={14} />Agregar</Boton>
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
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Cerrar</Boton></div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL CONFIRMAR ── */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo="Eliminar aplicacion"
        mensaje={confirmacion ? `¿Estas seguro de eliminar la aplicacion "${confirmacion.nombre}"? Esta accion no se puede deshacer.` : ''}
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </div>
  )
}
