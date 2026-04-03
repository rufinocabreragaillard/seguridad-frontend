'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Download, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { aplicacionesApi, funcionesApi, usuariosApi, gruposApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Aplicacion, Funcion, Usuario, Grupo } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

type FuncionApp = { codigo_funcion: string; funciones: { nombre_funcion: string; activo: boolean } }
type UsuarioApp = { codigo_usuario: string; usuarios: { nombre: string; activo: boolean } }
type AppDeFuncion = { codigo_aplicacion: string; aplicaciones?: { nombre_aplicacion: string; activo: boolean } }
type Dependencia = { codigo_aplicacion_previa: string; orden: number; aplicaciones?: { nombre_aplicacion: string; activo: boolean } }
type GrupoApp = { codigo_grupo: string; activo: boolean; grupos_entidades: { nombre_grupo: string } }

export default function PaginaAplicacionesFunciones() {
  const { grupoActivo } = useAuth()
  const [tabPrincipal, setTabPrincipal] = useState<'aplicaciones' | 'funciones'>('aplicaciones')
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [busquedaApps, setBusquedaApps] = useState('')
  const [busquedaFunciones, setBusquedaFunciones] = useState('')

  // ── Modal Aplicación ──────────────────────────────────────────────────────
  const [modalApp, setModalApp] = useState(false)
  const [appEditando, setAppEditando] = useState<Aplicacion | null>(null)
  const [formApp, setFormApp] = useState({ codigo_aplicacion: '', nombre: '', descripcion: '' })
  const [tabModalApp, setTabModalApp] = useState<'datos' | 'funciones' | 'usuarios' | 'dependencias' | 'grupos'>('datos')
  const [guardandoApp, setGuardandoApp] = useState(false)
  const [errorApp, setErrorApp] = useState('')

  // Funciones de la app
  const [funcionesApp, setFuncionesApp] = useState<FuncionApp[]>([])
  const [cargandoFuncionesApp, setCargandoFuncionesApp] = useState(false)
  const [funcionNuevaApp, setFuncionNuevaApp] = useState('')
  const [asignandoFuncionApp, setAsignandoFuncionApp] = useState(false)

  // Usuarios de la app
  const [usuariosApp, setUsuariosApp] = useState<UsuarioApp[]>([])
  const [cargandoUsuariosApp, setCargandoUsuariosApp] = useState(false)
  const [usuarioNuevoApp, setUsuarioNuevoApp] = useState('')
  const [asignandoUsuarioApp, setAsignandoUsuarioApp] = useState(false)

  // Dependencias de la app
  const [dependenciasApp, setDependenciasApp] = useState<Dependencia[]>([])
  const [cargandoDeps, setCargandoDeps] = useState(false)
  const [depNueva, setDepNueva] = useState('')
  const [asignandoDep, setAsignandoDep] = useState(false)

  // Grupos de la app
  const [gruposApp, setGruposApp] = useState<GrupoApp[]>([])
  const [todosGrupos, setTodosGrupos] = useState<Grupo[]>([])
  const [cargandoGruposApp, setCargandoGruposApp] = useState(false)
  const [grupoNuevoApp, setGrupoNuevoApp] = useState('')
  const [asignandoGrupoApp, setAsignandoGrupoApp] = useState(false)

  // ── Modal Función ─────────────────────────────────────────────────────────
  const [modalFuncion, setModalFuncion] = useState(false)
  const [funcionEditando, setFuncionEditando] = useState<Funcion | null>(null)
  const [formFuncion, setFormFuncion] = useState({ codigo_funcion: '', nombre: '', descripcion: '', url_funcion: '', alias_de_funcion: '', icono_de_funcion: '' })
  const [tabModalFuncion, setTabModalFuncion] = useState<'datos' | 'aplicaciones'>('datos')
  const [guardandoFuncion, setGuardandoFuncion] = useState(false)
  const [errorFuncion, setErrorFuncion] = useState('')

  // Aplicaciones de la función
  const [appsDeFuncion, setAppsDeFuncion] = useState<AppDeFuncion[]>([])
  const [cargandoAppsFuncion, setCargandoAppsFuncion] = useState(false)
  const [appNuevaFuncion, setAppNuevaFuncion] = useState('')
  const [asignandoAppFuncion, setAsignandoAppFuncion] = useState(false)

  // ── Confirmar eliminación ─────────────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<{ tipo: 'app' | 'funcion'; item: Aplicacion | Funcion } | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [a, f, u, g] = await Promise.all([aplicacionesApi.listar(), funcionesApi.listar(), usuariosApi.listar(), gruposApi.listar()])
      setAplicaciones(a)
      setFunciones(f)
      setTodosUsuarios(u)
      setTodosGrupos(g)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Aplicación: cargar relaciones ─────────────────────────────────────────
  const cargarFuncionesApp = useCallback(async (c: string) => {
    setCargandoFuncionesApp(true)
    try { setFuncionesApp(await aplicacionesApi.listarFunciones(c)) } catch { setFuncionesApp([]) }
    finally { setCargandoFuncionesApp(false) }
  }, [])

  const cargarUsuariosApp = useCallback(async (c: string) => {
    setCargandoUsuariosApp(true)
    try { setUsuariosApp(await aplicacionesApi.listarUsuarios(c)) } catch { setUsuariosApp([]) }
    finally { setCargandoUsuariosApp(false) }
  }, [])

  const cargarDependenciasApp = useCallback(async (c: string) => {
    setCargandoDeps(true)
    try { setDependenciasApp(await aplicacionesApi.listarDependencias(c)) } catch { setDependenciasApp([]) }
    finally { setCargandoDeps(false) }
  }, [])

  const cargarGruposApp = useCallback(async (c: string) => {
    setCargandoGruposApp(true)
    try { setGruposApp(await aplicacionesApi.listarGrupos(c)) } catch { setGruposApp([]) }
    finally { setCargandoGruposApp(false) }
  }, [])

  // ── Aplicación: CRUD ──────────────────────────────────────────────────────
  const abrirNuevaApp = () => {
    setAppEditando(null); setFormApp({ codigo_aplicacion: '', nombre: '', descripcion: '' })
    setErrorApp(''); setTabModalApp('datos'); setModalApp(true)
  }
  const abrirEditarApp = (a: Aplicacion) => {
    setAppEditando(a); setFormApp({ codigo_aplicacion: a.codigo_aplicacion, nombre: a.nombre, descripcion: a.descripcion || '' })
    setErrorApp(''); setTabModalApp('datos'); cargarFuncionesApp(a.codigo_aplicacion); cargarUsuariosApp(a.codigo_aplicacion); cargarDependenciasApp(a.codigo_aplicacion); cargarGruposApp(a.codigo_aplicacion); setModalApp(true)
  }
  const guardarApp = async () => {
    if (!formApp.codigo_aplicacion || !formApp.nombre) { setErrorApp('Código y nombre son obligatorios'); return }
    setGuardandoApp(true)
    try {
      if (appEditando) { await aplicacionesApi.actualizar(appEditando.codigo_aplicacion, { nombre: formApp.nombre, descripcion: formApp.descripcion || undefined }) }
      else { await aplicacionesApi.crear(formApp) }
      setModalApp(false); cargar()
    } catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoApp(false) }
  }

  // ── Aplicación: funciones ─────────────────────────────────────────────────
  const asignarFuncionApp = async () => {
    if (!funcionNuevaApp || !appEditando) return; setAsignandoFuncionApp(true)
    try { await aplicacionesApi.asignarFuncion(appEditando.codigo_aplicacion, funcionNuevaApp); setFuncionNuevaApp(''); cargarFuncionesApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') } finally { setAsignandoFuncionApp(false) }
  }
  const quitarFuncionApp = async (c: string) => {
    if (!appEditando) return
    try { await aplicacionesApi.quitarFuncion(appEditando.codigo_aplicacion, c); cargarFuncionesApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
  }

  // ── Aplicación: usuarios ──────────────────────────────────────────────────
  const asignarUsuarioApp = async () => {
    if (!usuarioNuevoApp || !appEditando) return; setAsignandoUsuarioApp(true)
    try { await aplicacionesApi.asignarUsuario(appEditando.codigo_aplicacion, usuarioNuevoApp); setUsuarioNuevoApp(''); cargarUsuariosApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') } finally { setAsignandoUsuarioApp(false) }
  }
  const quitarUsuarioApp = async (c: string) => {
    if (!appEditando) return
    try { await aplicacionesApi.quitarUsuario(appEditando.codigo_aplicacion, c); cargarUsuariosApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
  }

  // ── Aplicación: dependencias ────────────────────────────────────────────────
  const asignarDep = async () => {
    if (!depNueva || !appEditando) return; setAsignandoDep(true)
    try { await aplicacionesApi.agregarDependencia(appEditando.codigo_aplicacion, depNueva); setDepNueva(''); cargarDependenciasApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') } finally { setAsignandoDep(false) }
  }
  const quitarDep = async (c: string) => {
    if (!appEditando) return
    try { await aplicacionesApi.quitarDependencia(appEditando.codigo_aplicacion, c); cargarDependenciasApp(appEditando.codigo_aplicacion) }
    catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error') }
  }
  const moverDep = async (index: number, dir: 'arriba' | 'abajo') => {
    if (!appEditando) return
    const lista = [...dependenciasApp]; const swap = dir === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const oA = lista[index].orden; const oB = lista[swap].orden
    lista[index].orden = oB; lista[swap].orden = oA
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setDependenciasApp(lista)
    try { await aplicacionesApi.reordenarDependencias(appEditando.codigo_aplicacion, lista.map((d) => ({ codigo_aplicacion_previa: d.codigo_aplicacion_previa, orden: d.orden }))) }
    catch { cargarDependenciasApp(appEditando.codigo_aplicacion) }
  }

  // ── Aplicación: grupos ────────────────────────────────────────────────────
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

  // ── Función: CRUD ─────────────────────────────────────────────────────────
  const abrirNuevaFuncion = () => {
    setFuncionEditando(null); setFormFuncion({ codigo_funcion: '', nombre: '', descripcion: '', url_funcion: '', alias_de_funcion: '', icono_de_funcion: '' })
    setErrorFuncion(''); setTabModalFuncion('datos'); setModalFuncion(true)
  }
  const abrirEditarFuncion = (f: Funcion) => {
    setFuncionEditando(f); setFormFuncion({ codigo_funcion: f.codigo_funcion, nombre: f.nombre, descripcion: f.descripcion || '', url_funcion: f.url_funcion || '', alias_de_funcion: f.alias_de_funcion || '', icono_de_funcion: f.icono_de_funcion || '' })
    setErrorFuncion(''); setTabModalFuncion('datos'); cargarAppsDeFuncion(f.codigo_funcion); setModalFuncion(true)
  }
  const guardarFuncion = async () => {
    if (!formFuncion.codigo_funcion || !formFuncion.nombre) { setErrorFuncion('Código y nombre son obligatorios'); return }
    setGuardandoFuncion(true)
    try {
      if (funcionEditando) {
        await funcionesApi.actualizar(funcionEditando.codigo_funcion, { nombre: formFuncion.nombre, descripcion: formFuncion.descripcion, url_funcion: formFuncion.url_funcion, alias_de_funcion: formFuncion.alias_de_funcion, icono_de_funcion: formFuncion.icono_de_funcion || undefined })
      } else {
        await funcionesApi.crear(formFuncion)
      }
      setModalFuncion(false); cargar()
    } catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoFuncion(false) }
  }

  // ── Función: aplicaciones ─────────────────────────────────────────────────
  const cargarAppsDeFuncion = useCallback(async (c: string) => {
    setCargandoAppsFuncion(true)
    try { setAppsDeFuncion(await funcionesApi.listarAplicaciones(c)) } catch { setAppsDeFuncion([]) }
    finally { setCargandoAppsFuncion(false) }
  }, [])

  const asignarAppAFuncion = async () => {
    if (!appNuevaFuncion || !funcionEditando) return; setAsignandoAppFuncion(true)
    try { await funcionesApi.asignarAplicacion(funcionEditando.codigo_funcion, appNuevaFuncion); setAppNuevaFuncion(''); cargarAppsDeFuncion(funcionEditando.codigo_funcion) }
    catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') } finally { setAsignandoAppFuncion(false) }
  }
  const quitarAppDeFuncion = async (c: string) => {
    if (!funcionEditando) return
    try { await funcionesApi.quitarAplicacion(funcionEditando.codigo_funcion, c); cargarAppsDeFuncion(funcionEditando.codigo_funcion) }
    catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') }
  }

  // ── Eliminación ───────────────────────────────────────────────────────────
  const ejecutarEliminacion = async () => {
    if (!confirmacion) return; setEliminando(true)
    try {
      if (confirmacion.tipo === 'app') { await aplicacionesApi.desactivar((confirmacion.item as Aplicacion).codigo_aplicacion) }
      else { await funcionesApi.eliminar((confirmacion.item as Funcion).codigo_funcion) }
      setConfirmacion(null); cargar()
    } catch (e) { setErrorApp(e instanceof Error ? e.message : 'Error'); setConfirmacion(null) }
    finally { setEliminando(false) }
  }

  // ── Listas filtradas ──────────────────────────────────────────────────────
  const funcionesDisponiblesApp = funciones.filter((f) => f.activo && !funcionesApp.some((fa) => fa.codigo_funcion === f.codigo_funcion))
  const usuariosDisponiblesApp = todosUsuarios.filter((u) => u.activo && !usuariosApp.some((ua) => ua.codigo_usuario === u.codigo_usuario))
  const appsDisponiblesFuncion = aplicaciones.filter((a) => a.activo && !appsDeFuncion.some((af) => af.codigo_aplicacion === a.codigo_aplicacion))

  const depsDisponibles = aplicaciones.filter((a) => a.activo && a.codigo_aplicacion !== appEditando?.codigo_aplicacion && !dependenciasApp.some((d) => d.codigo_aplicacion_previa === a.codigo_aplicacion))
  const gruposDisponiblesApp = todosGrupos.filter((g) => g.activo && !gruposApp.some((ga) => ga.codigo_grupo === g.codigo_grupo))

  const appsFiltradas = aplicaciones.filter((a) => a.nombre.toLowerCase().includes(busquedaApps.toLowerCase()) || a.codigo_aplicacion.toLowerCase().includes(busquedaApps.toLowerCase())).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const funcionesFiltradas = funciones.filter((f) => f.nombre.toLowerCase().includes(busquedaFunciones.toLowerCase()) || f.codigo_funcion.toLowerCase().includes(busquedaFunciones.toLowerCase()) || (f.alias_de_funcion || '').toLowerCase().includes(busquedaFunciones.toLowerCase())).sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Aplicaciones y Funciones</h2>
        <p className="text-sm text-texto-muted mt-1">Gestión de aplicaciones, funciones y sus relaciones</p>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {(['aplicaciones', 'funciones'] as const).map((tab) => (
          <button key={tab} onClick={() => setTabPrincipal(tab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${tabPrincipal === tab ? 'bg-surface text-primario shadow-sm border border-borde' : 'text-texto-muted hover:text-texto'}`}>
            {tab === 'aplicaciones' ? 'Aplicaciones' : 'Funciones'}
          </button>
        ))}
      </div>

      {/* ═══ TAB APLICACIONES ═══ */}
      {tabPrincipal === 'aplicaciones' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder="Buscar por nombre o código..." value={busquedaApps} onChange={(e) => setBusquedaApps(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(appsFiltradas as Record<string, unknown>[], [{ titulo: 'Código', campo: 'codigo_aplicacion' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Descripción', campo: 'descripcion' }, { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' }], 'aplicaciones')} disabled={appsFiltradas.length === 0}><Download size={15} />Excel</Boton>
              <Boton variante="primario" onClick={abrirNuevaApp}><Plus size={16} />Nueva aplicación</Boton>
            </div>
          </div>
          <Tabla>
            <TablaCabecera><tr><TablaTh>Código</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Descripción</TablaTh><TablaTh>Estado</TablaTh><TablaTh className="text-right">Acciones</TablaTh></tr></TablaCabecera>
            <TablaCuerpo>
              {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>Cargando...</TablaTd></TablaFila>
              ) : appsFiltradas.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>No se encontraron aplicaciones</TablaTd></TablaFila>
              ) : appsFiltradas.map((a) => (
                <TablaFila key={a.codigo_aplicacion}>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{a.codigo_aplicacion}</code></TablaTd>
                  <TablaTd className="font-medium">{a.nombre}</TablaTd>
                  <TablaTd className="text-texto-muted text-sm">{a.descripcion || '—'}</TablaTd>
                  <TablaTd><Insignia variante={a.activo ? 'exito' : 'error'}>{a.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarApp(a)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmacion({ tipo: 'app', item: a })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {/* ═══ TAB FUNCIONES ═══ */}
      {tabPrincipal === 'funciones' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder="Buscar por nombre, código o alias..." value={busquedaFunciones} onChange={(e) => setBusquedaFunciones(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(funcionesFiltradas as Record<string, unknown>[], [{ titulo: 'Código', campo: 'codigo_funcion' }, { titulo: 'Alias', campo: 'alias_de_funcion' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Icono', campo: 'icono_de_funcion' }, { titulo: 'URL', campo: 'url_funcion' }, { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activa' : 'Inactiva' }], `funciones_${grupoActivo || 'todos'}`)} disabled={funcionesFiltradas.length === 0}><Download size={15} />Excel</Boton>
              <Boton variante="primario" onClick={abrirNuevaFuncion}><Plus size={16} />Nueva función</Boton>
            </div>
          </div>
          <Tabla>
            <TablaCabecera><tr><TablaTh>Código</TablaTh><TablaTh>Alias</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Icono</TablaTh><TablaTh>URL</TablaTh><TablaTh>Estado</TablaTh><TablaTh className="text-right">Acciones</TablaTh></tr></TablaCabecera>
            <TablaCuerpo>
              {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Cargando...</TablaTd></TablaFila>
              ) : funcionesFiltradas.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>No se encontraron funciones</TablaTd></TablaFila>
              ) : funcionesFiltradas.map((f) => (
                <TablaFila key={f.codigo_funcion}>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{f.codigo_funcion}</code></TablaTd>
                  <TablaTd className="text-sm">{f.alias_de_funcion || '—'}</TablaTd>
                  <TablaTd className="font-medium">{f.nombre}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{f.icono_de_funcion || '—'}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{f.url_funcion || '—'}</TablaTd>
                  <TablaTd><Insignia variante={f.activo ? 'exito' : 'error'}>{f.activo ? 'Activa' : 'Inactiva'}</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarFuncion(f)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmacion({ tipo: 'funcion', item: f })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {/* ═══ MODAL APLICACIÓN ═══ */}
      <Modal abierto={modalApp} alCerrar={() => setModalApp(false)} titulo={appEditando ? `Editar: ${appEditando.codigo_aplicacion}` : 'Nueva aplicación'}>
        <div className="flex flex-col gap-4">
          {appEditando && (
            <div className="flex border-b border-borde -mx-1">
              {(['datos', 'funciones', 'usuarios', 'dependencias', 'grupos'] as const).map((tab) => (
                <button key={tab} onClick={() => setTabModalApp(tab)} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalApp === tab ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>
                  {tab === 'datos' ? 'Datos' : tab === 'funciones' ? `Funciones (${funcionesApp.length})` : tab === 'usuarios' ? `Usuarios (${usuariosApp.length})` : tab === 'dependencias' ? `Dependencias (${dependenciasApp.length})` : `Grupos (${gruposApp.length})`}
                </button>
              ))}
            </div>
          )}
          {tabModalApp === 'datos' && (<>
            <Input etiqueta="Código *" value={formApp.codigo_aplicacion} onChange={(e) => setFormApp({ ...formApp, codigo_aplicacion: e.target.value.toUpperCase() })} disabled={!!appEditando} placeholder="SEGURIDAD" />
            <Input etiqueta="Nombre *" value={formApp.nombre} onChange={(e) => setFormApp({ ...formApp, nombre: e.target.value })} placeholder="Sistema de Seguridad" />
            <Input etiqueta="Descripción" value={formApp.descripcion} onChange={(e) => setFormApp({ ...formApp, descripcion: e.target.value })} />
            {errorApp && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorApp}</p></div>}
            <div className="flex gap-3 justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Cancelar</Boton><Boton variante="primario" onClick={guardarApp} cargando={guardandoApp}>{appEditando ? 'Guardar' : 'Crear'}</Boton></div>
          </>)}
          {tabModalApp === 'funciones' && appEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2"><div className="flex-1"><select value={funcionNuevaApp} onChange={(e) => setFuncionNuevaApp(e.target.value)} className={selectClass}><option value="">Seleccionar función...</option>{funcionesDisponiblesApp.map((f) => (<option key={f.codigo_funcion} value={f.codigo_funcion}>{f.nombre} ({f.codigo_funcion})</option>))}</select></div><Boton variante="primario" onClick={asignarFuncionApp} cargando={asignandoFuncionApp} disabled={!funcionNuevaApp}><Plus size={14} />Asignar</Boton></div>
              {cargandoFuncionesApp ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : funcionesApp.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene funciones asignadas</p>
              : <div className="flex flex-col gap-2">{funcionesApp.map((fa) => (<div key={fa.codigo_funcion} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"><div><span className="text-sm font-medium text-texto">{fa.funciones?.nombre_funcion || fa.codigo_funcion}</span><span className="ml-2 text-xs text-texto-muted">{fa.codigo_funcion}</span></div><button onClick={() => quitarFuncionApp(fa.codigo_funcion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button></div>))}</div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Cerrar</Boton></div>
            </div>
          )}
          {tabModalApp === 'usuarios' && appEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2"><div className="flex-1"><select value={usuarioNuevoApp} onChange={(e) => setUsuarioNuevoApp(e.target.value)} className={selectClass}><option value="">Seleccionar usuario...</option>{usuariosDisponiblesApp.map((u) => (<option key={u.codigo_usuario} value={u.codigo_usuario}>{u.nombre} ({u.codigo_usuario})</option>))}</select></div><Boton variante="primario" onClick={asignarUsuarioApp} cargando={asignandoUsuarioApp} disabled={!usuarioNuevoApp}><Plus size={14} />Asignar</Boton></div>
              {cargandoUsuariosApp ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : usuariosApp.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene usuarios asignados</p>
              : <div className="flex flex-col gap-2">{usuariosApp.map((ua) => (<div key={ua.codigo_usuario} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"><div><span className="text-sm font-medium text-texto">{ua.usuarios?.nombre || ua.codigo_usuario}</span><span className="ml-2 text-xs text-texto-muted">{ua.codigo_usuario}</span></div><button onClick={() => quitarUsuarioApp(ua.codigo_usuario)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button></div>))}</div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Cerrar</Boton></div>
            </div>
          )}
          {tabModalApp === 'dependencias' && appEditando && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-texto-muted">Aplicaciones que deben estar habilitadas antes de poder activar esta aplicación.</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select value={depNueva} onChange={(e) => setDepNueva(e.target.value)} className={selectClass}>
                    <option value="">Seleccionar aplicación previa...</option>
                    {depsDisponibles.map((a) => (<option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>))}
                  </select>
                </div>
                <Boton variante="primario" onClick={asignarDep} cargando={asignandoDep} disabled={!depNueva}><Plus size={14} />Agregar</Boton>
              </div>
              {cargandoDeps ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : dependenciasApp.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene dependencias</p>
              : <div className="flex flex-col gap-2">{dependenciasApp.map((d, idx) => (
                <div key={d.codigo_aplicacion_previa} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde bg-surface">
                  <div className="flex flex-col">
                    <button onClick={() => moverDep(idx, 'arriba')} disabled={idx === 0} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                    <button onClick={() => moverDep(idx, 'abajo')} disabled={idx === dependenciasApp.length - 1} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                  </div>
                  <span className="text-xs text-texto-muted w-5 text-center">{d.orden}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-texto">{d.aplicaciones?.nombre_aplicacion || d.codigo_aplicacion_previa}</span>
                    <span className="ml-2 text-xs text-texto-muted">{d.codigo_aplicacion_previa}</span>
                  </div>
                  <button onClick={() => quitarDep(d.codigo_aplicacion_previa)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button>
                </div>
              ))}</div>}
              {errorApp && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorApp}</p></div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalApp(false)}>Cerrar</Boton></div>
            </div>
          )}
          {tabModalApp === 'grupos' && appEditando && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-texto-muted">Grupos de entidades que tienen acceso a esta aplicación.</p>
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

      {/* ═══ MODAL FUNCIÓN ═══ */}
      <Modal abierto={modalFuncion} alCerrar={() => setModalFuncion(false)} titulo={funcionEditando ? `Editar: ${funcionEditando.codigo_funcion}` : 'Nueva función'}>
        <div className="flex flex-col gap-4">
          {funcionEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button onClick={() => setTabModalFuncion('datos')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Datos</button>
              <button onClick={() => setTabModalFuncion('aplicaciones')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'aplicaciones' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Aplicaciones ({appsDeFuncion.length})</button>
            </div>
          )}
          {tabModalFuncion === 'datos' && (<>
            <Input etiqueta="Código *" value={formFuncion.codigo_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_funcion: e.target.value.toUpperCase() })} disabled={!!funcionEditando} placeholder="GEST_USUARIOS" />
            <Input etiqueta="Alias *" value={formFuncion.alias_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, alias_de_funcion: e.target.value.substring(0, 40) })} placeholder="Usuarios" />
            <Input etiqueta="Nombre *" value={formFuncion.nombre} onChange={(e) => setFormFuncion({ ...formFuncion, nombre: e.target.value })} placeholder="Gestión de usuarios" />
            <Input etiqueta="Icono" value={formFuncion.icono_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, icono_de_funcion: e.target.value })} placeholder="Users, Shield, Settings..." />
            <Input etiqueta="Descripción" value={formFuncion.descripcion} onChange={(e) => setFormFuncion({ ...formFuncion, descripcion: e.target.value })} />
            <Input etiqueta="URL función" value={formFuncion.url_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, url_funcion: e.target.value })} placeholder="/usuarios" />
            {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
            <div className="flex gap-3 justify-end pt-2"><Boton variante="contorno" onClick={() => setModalFuncion(false)}>Cancelar</Boton><Boton variante="primario" onClick={guardarFuncion} cargando={guardandoFuncion}>{funcionEditando ? 'Guardar' : 'Crear función'}</Boton></div>
          </>)}
          {tabModalFuncion === 'aplicaciones' && funcionEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2"><div className="flex-1"><select value={appNuevaFuncion} onChange={(e) => setAppNuevaFuncion(e.target.value)} className={selectClass}><option value="">Seleccionar aplicación...</option>{appsDisponiblesFuncion.map((a) => (<option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>))}</select></div><Boton variante="primario" onClick={asignarAppAFuncion} cargando={asignandoAppFuncion} disabled={!appNuevaFuncion}><Plus size={14} />Asignar</Boton></div>
              {cargandoAppsFuncion ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : appsDeFuncion.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene aplicaciones asignadas</p>
              : <div className="flex flex-col gap-2">{appsDeFuncion.map((af) => (<div key={af.codigo_aplicacion} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"><div><span className="text-sm font-medium text-texto">{af.aplicaciones?.nombre_aplicacion || af.codigo_aplicacion}</span><span className="ml-2 text-xs text-texto-muted">{af.codigo_aplicacion}</span></div><button onClick={() => quitarAppDeFuncion(af.codigo_aplicacion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button></div>))}</div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalFuncion(false)}>Cerrar</Boton></div>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══ MODAL CONFIRMAR ═══ */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo={confirmacion?.tipo === 'app' ? 'Desactivar aplicación' : 'Eliminar función'}
        mensaje={confirmacion?.tipo === 'app'
          ? `¿Estás seguro de desactivar la aplicación "${confirmacion.item.nombre}"?`
          : `¿Estás seguro de eliminar la función "${confirmacion?.item.nombre}"? Se eliminarán todas las asignaciones.`}
        textoConfirmar={confirmacion?.tipo === 'app' ? 'Desactivar' : 'Eliminar'}
        cargando={eliminando}
      />
    </div>
  )
}
