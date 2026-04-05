'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Building2, Layers, Check, Bell, Settings, LogOut, User, Save, AppWindow } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Avatar from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Boton } from '@/components/ui/boton'
import { usuariosApi, parametrosApi } from '@/lib/api'

export function Header({ titulo }: { titulo?: string }) {
  const { usuario, cambiarEntidad, cambiarGrupo, cambiarAplicacion, logout } = useAuth()
  const [cambiando, setCambiando] = useState(false)

  // Modal Mi Cuenta (con tabs: Cuenta + Parametros)
  const [modalCuenta, setModalCuenta] = useState(false)
  const [tabCuenta, setTabCuenta] = useState<'cuenta' | 'parametros'>('cuenta')
  const [formCuenta, setFormCuenta] = useState({
    nombre: '', telefono: '', rol_principal: '', alias: '', descripcion: '', aplicacion_por_defecto: ''
  })
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)
  const [errorCuenta, setErrorCuenta] = useState('')
  const [exitoCuenta, setExitoCuenta] = useState('')

  // Parametros (dentro de Mi Cuenta, tab Parametros)
  const [parametros, setParametros] = useState<{ categoria_parametro: string; tipo_parametro: string; valor_parametro: string }[]>([])
  const [cargandoParametros, setCargandoParametros] = useState(false)
  const [guardandoParametro, setGuardandoParametro] = useState(false)
  const [errorParametros, setErrorParametros] = useState('')
  const [exitoParametros, setExitoParametros] = useState('')

  // Modal Cambio Aplicacion
  const [modalAplicacion, setModalAplicacion] = useState(false)
  const [cambiandoApp, setCambiandoApp] = useState(false)

  const handleCambiarEntidad = async (codigoEntidad: string) => {
    if (codigoEntidad === usuario?.entidad_activa) return
    setCambiando(true)
    try {
      await cambiarEntidad(codigoEntidad)
    } finally {
      setCambiando(false)
    }
  }

  const handleCambiarGrupo = async (codigoGrupo: string) => {
    if (codigoGrupo === usuario?.grupo_activo) return
    setCambiando(true)
    try {
      await cambiarGrupo(codigoGrupo)
    } catch {
      setCambiando(false)
    }
  }

  const handleCambiarAplicacion = async (codigoApp: string) => {
    if (codigoApp === usuario?.aplicacion_activa) return
    setCambiandoApp(true)
    try {
      await cambiarAplicacion(codigoApp)
      setModalAplicacion(false)
    } catch {
      // error manejado en AuthContext
    } finally {
      setCambiandoApp(false)
    }
  }

  // Mi Cuenta
  const abrirMiCuenta = () => {
    setTabCuenta('cuenta')
    setFormCuenta({
      nombre: usuario?.nombre || '',
      telefono: '',
      rol_principal: usuario?.rol_principal || '',
      alias: '',
      descripcion: '',
      aplicacion_por_defecto: usuario?.aplicacion_activa || '',
    })
    setErrorCuenta('')
    setExitoCuenta('')
    if (usuario) {
      usuariosApi.obtener(usuario.codigo_usuario).then((u) => {
        setFormCuenta({
          nombre: u.nombre,
          telefono: u.telefono || '',
          rol_principal: u.rol_principal || '',
          alias: u.alias || '',
          descripcion: u.descripcion || '',
          aplicacion_por_defecto: u.aplicacion_por_defecto || '',
        })
      }).catch(() => {})
    }
    setModalCuenta(true)
  }

  const guardarMiCuenta = async () => {
    if (!usuario || !formCuenta.nombre) { setErrorCuenta('El nombre es obligatorio'); return }
    setGuardandoCuenta(true)
    setErrorCuenta('')
    setExitoCuenta('')
    try {
      await usuariosApi.actualizar(usuario.codigo_usuario, {
        nombre: formCuenta.nombre,
        telefono: formCuenta.telefono || undefined,
        rol_principal: formCuenta.rol_principal || undefined,
        alias: formCuenta.alias || undefined,
        descripcion: formCuenta.descripcion || undefined,
        aplicacion_por_defecto: formCuenta.aplicacion_por_defecto || undefined,
      })
      setExitoCuenta('Datos actualizados correctamente')
    } catch (e) {
      setErrorCuenta(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoCuenta(false)
    }
  }

  // Parametros
  const cargarParametros = useCallback(async () => {
    setCargandoParametros(true)
    setErrorParametros('')
    try {
      const data = await parametrosApi.listarUsuario()
      setParametros(data)
    } catch {
      setParametros([])
    } finally {
      setCargandoParametros(false)
    }
  }, [])

  const guardarParametro = async (cat: string, tipo: string, valor: string) => {
    setGuardandoParametro(true)
    setErrorParametros('')
    setExitoParametros('')
    try {
      await parametrosApi.upsertUsuario({ categoria_parametro: cat, tipo_parametro: tipo, valor_parametro: valor })
      setExitoParametros('Parametro guardado')
      cargarParametros()
    } catch (e) {
      setErrorParametros(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoParametro(false)
    }
  }

  // Cargar parametros cuando se abre la tab
  useEffect(() => {
    if (modalCuenta && tabCuenta === 'parametros') {
      cargarParametros()
    }
  }, [modalCuenta, tabCuenta, cargarParametros])

  const entidadActual = usuario?.entidades?.find(
    (e) => e.codigo_entidad === usuario?.entidad_activa
  )

  const grupoActual = usuario?.grupos?.find(
    (g) => g.codigo_grupo === usuario?.grupo_activo
  )

  const nombreMostrar = usuario?.alias || usuario?.nombre || ''
  const iniciales = nombreMostrar
    ? nombreMostrar.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const tieneMultiplesGrupos = (usuario?.grupos?.length ?? 0) > 1

  return (
    <>
      <header className="h-16 bg-surface border-b border-borde flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          {usuario?.nombre_aplicacion && (
            <span className="text-2xl font-bold text-texto-muted">
              {usuario.nombre_aplicacion}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de grupo */}
          {usuario && tieneMultiplesGrupos && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borde bg-fondo',
                    'text-sm font-medium text-texto hover:bg-primario-muy-claro hover:border-primario/30',
                    'transition-colors focus:outline-none',
                    cambiando && 'opacity-50 cursor-wait'
                  )}
                  disabled={cambiando}
                >
                  <Layers size={15} className="text-secundario shrink-0" />
                  <span className="max-w-[140px] truncate">
                    {grupoActual?.nombre_grupo ?? usuario.grupo_activo}
                  </span>
                  <ChevronDown size={14} className="text-texto-muted shrink-0" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[200px] bg-surface rounded-xl border border-borde shadow-lg p-1">
                  <p className="px-3 py-2 text-xs font-semibold text-texto-muted uppercase tracking-wider">Mis grupos</p>
                  {usuario.grupos.map((grupo) => (
                    <DropdownMenu.Item
                      key={grupo.codigo_grupo}
                      onSelect={() => handleCambiarGrupo(grupo.codigo_grupo)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer',
                        'hover:bg-primario-muy-claro hover:text-primario outline-none transition-colors',
                        grupo.codigo_grupo === usuario.grupo_activo ? 'text-primario font-medium bg-primario-muy-claro' : 'text-texto'
                      )}
                    >
                      <Check size={14} className={cn('shrink-0', grupo.codigo_grupo === usuario.grupo_activo ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{grupo.nombre_grupo}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Selector de entidad */}
          {usuario && usuario.entidades && usuario.entidades.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borde bg-fondo',
                    'text-sm font-medium text-texto hover:bg-primario-muy-claro hover:border-primario/30',
                    'transition-colors focus:outline-none',
                    cambiando && 'opacity-50 cursor-wait'
                  )}
                  disabled={cambiando}
                >
                  <Building2 size={15} className="text-primario shrink-0" />
                  <span className="max-w-[160px] truncate">{entidadActual?.nombre ?? usuario.entidad_activa}</span>
                  <ChevronDown size={14} className="text-texto-muted shrink-0" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[200px] bg-surface rounded-xl border border-borde shadow-lg p-1">
                  <p className="px-3 py-2 text-xs font-semibold text-texto-muted uppercase tracking-wider">Mis entidades</p>
                  {usuario.entidades.map((entidad) => (
                    <DropdownMenu.Item
                      key={entidad.codigo_entidad}
                      onSelect={() => handleCambiarEntidad(entidad.codigo_entidad)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer',
                        'hover:bg-primario-muy-claro hover:text-primario outline-none transition-colors',
                        entidad.codigo_entidad === usuario.entidad_activa ? 'text-primario font-medium bg-primario-muy-claro' : 'text-texto'
                      )}
                    >
                      <Check size={14} className={cn('shrink-0', entidad.codigo_entidad === usuario.entidad_activa ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{entidad.nombre}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Notificaciones */}
          <button className="p-2 rounded-lg hover:bg-fondo text-texto-muted hover:text-texto transition-colors relative">
            <Bell size={18} />
          </button>

          {/* Avatar y menu de usuario */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-fondo transition-colors focus:outline-none">
                <Avatar.Root className="h-8 w-8 rounded-full bg-secundario flex items-center justify-center shrink-0">
                  <Avatar.Fallback className="text-white text-xs font-semibold">{iniciales}</Avatar.Fallback>
                </Avatar.Root>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-medium text-texto leading-none truncate max-w-[120px]">{nombreMostrar}</p>
                </div>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[180px] bg-surface rounded-xl border border-borde shadow-lg p-1">
                <div className="px-3 py-2 border-b border-borde mb-1">
                  <p className="text-sm font-medium text-texto truncate">{usuario?.nombre}</p>
                  <p className="text-xs text-texto-muted truncate">{usuario?.codigo_usuario}</p>
                </div>
                <DropdownMenu.Item
                  onSelect={abrirMiCuenta}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-texto hover:bg-fondo cursor-pointer outline-none"
                >
                  <User size={14} className="shrink-0" />
                  Mi cuenta
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setModalAplicacion(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-texto hover:bg-fondo cursor-pointer outline-none"
                >
                  <AppWindow size={14} className="shrink-0" />
                  Cambio aplicacion
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-borde my-1" />
                <DropdownMenu.Item
                  onSelect={() => logout()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-error hover:bg-red-50 cursor-pointer outline-none"
                >
                  <LogOut size={14} className="shrink-0" />
                  Cerrar sesion
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Modal Mi Cuenta (con tabs) */}
      <Modal abierto={modalCuenta} alCerrar={() => setModalCuenta(false)} titulo="Mi cuenta">
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex border-b border-borde">
            <button
              onClick={() => setTabCuenta('cuenta')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                tabCuenta === 'cuenta'
                  ? 'border-primario text-primario'
                  : 'border-transparent text-texto-muted hover:text-texto'
              )}
            >
              Cuenta
            </button>
            <button
              onClick={() => setTabCuenta('parametros')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                tabCuenta === 'parametros'
                  ? 'border-primario text-primario'
                  : 'border-transparent text-texto-muted hover:text-texto'
              )}
            >
              Parametros
            </button>
          </div>

          {tabCuenta === 'cuenta' ? (
            /* Tab Cuenta */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Correo electronico</label>
                <p className="text-sm text-texto-muted bg-fondo px-3 py-2 rounded-lg">{usuario?.codigo_usuario}</p>
              </div>
              <Input
                etiqueta="Alias"
                value={formCuenta.alias}
                onChange={(e) => setFormCuenta({ ...formCuenta, alias: e.target.value })}
                placeholder="Alias del usuario"
              />
              <Input
                etiqueta="Nombre completo"
                value={formCuenta.nombre}
                onChange={(e) => setFormCuenta({ ...formCuenta, nombre: e.target.value })}
              />
              <Input
                etiqueta="Telefono"
                value={formCuenta.telefono}
                onChange={(e) => setFormCuenta({ ...formCuenta, telefono: e.target.value })}
                placeholder="+56 9 1234 5678"
              />
              <Textarea
                etiqueta="Descripcion"
                value={formCuenta.descripcion}
                onChange={(e) => setFormCuenta({ ...formCuenta, descripcion: e.target.value })}
                rows={3}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Rol principal</label>
                {usuario && usuario.roles.length > 0 ? (
                  <select
                    value={formCuenta.rol_principal}
                    onChange={(e) => setFormCuenta({ ...formCuenta, rol_principal: e.target.value })}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  >
                    <option value="">Sin rol principal</option>
                    {usuario.roles.map((rol) => (
                      <option key={rol} value={rol}>{rol}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-texto-muted bg-fondo px-3 py-2 rounded-lg">{usuario?.rol_principal || '\u2014'}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Aplicacion por defecto</label>
                {usuario?.aplicaciones_disponibles && usuario.aplicaciones_disponibles.length > 0 ? (
                  <select
                    value={formCuenta.aplicacion_por_defecto}
                    onChange={(e) => setFormCuenta({ ...formCuenta, aplicacion_por_defecto: e.target.value })}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  >
                    <option value="">Sin aplicacion por defecto</option>
                    {usuario.aplicaciones_disponibles.map((app) => (
                      <option key={app.codigo_aplicacion} value={app.codigo_aplicacion}>{app.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-texto-muted bg-fondo px-3 py-2 rounded-lg">{usuario?.aplicacion_activa || '\u2014'}</p>
                )}
              </div>
              {errorCuenta && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCuenta}</p></div>}
              {exitoCuenta && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3"><p className="text-sm text-exito">{exitoCuenta}</p></div>}
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalCuenta(false)}>Cerrar</Boton>
                <Boton variante="primario" onClick={guardarMiCuenta} cargando={guardandoCuenta}>
                  <Save size={14} /> Guardar
                </Boton>
              </div>
            </div>
          ) : (
            /* Tab Parametros */
            <div className="flex flex-col gap-4">
              {cargandoParametros ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-fondo rounded-lg animate-pulse" />)}
                </div>
              ) : parametros.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tienes parametros configurados</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {parametros.map((p) => (
                    <div key={`${p.categoria_parametro}/${p.tipo_parametro}`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde bg-surface">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-texto truncate">{p.categoria_parametro} / {p.tipo_parametro}</p>
                        <input
                          type="text"
                          defaultValue={p.valor_parametro}
                          onBlur={(e) => {
                            if (e.target.value !== p.valor_parametro) {
                              guardarParametro(p.categoria_parametro, p.tipo_parametro, e.target.value)
                            }
                          }}
                          className="w-full text-sm text-texto bg-transparent border-b border-transparent hover:border-borde focus:border-primario focus:outline-none py-0.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {errorParametros && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorParametros}</p></div>}
              {exitoParametros && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3"><p className="text-sm text-exito">{exitoParametros}</p></div>}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalCuenta(false)}>Cerrar</Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Cambio Aplicacion */}
      <Modal abierto={modalAplicacion} alCerrar={() => setModalAplicacion(false)} titulo="Cambiar aplicacion">
        <div className="flex flex-col gap-2">
          {usuario?.aplicaciones_disponibles && usuario.aplicaciones_disponibles.length > 0 ? (
            usuario.aplicaciones_disponibles.map((app) => (
              <button
                key={app.codigo_aplicacion}
                onClick={() => handleCambiarAplicacion(app.codigo_aplicacion)}
                disabled={cambiandoApp}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors text-left',
                  app.codigo_aplicacion === usuario.aplicacion_activa
                    ? 'bg-primario-muy-claro text-primario font-medium border border-primario/30'
                    : 'bg-surface border border-borde hover:bg-fondo text-texto',
                  cambiandoApp && 'opacity-50 cursor-wait'
                )}
              >
                <Check
                  size={16}
                  className={cn(
                    'shrink-0',
                    app.codigo_aplicacion === usuario.aplicacion_activa ? 'opacity-100 text-primario' : 'opacity-0'
                  )}
                />
                <div>
                  <p className="font-medium">{app.nombre}</p>
                  <p className="text-xs text-texto-muted">{app.codigo_aplicacion}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-sm text-texto-muted text-center py-4">No hay aplicaciones disponibles</p>
          )}
        </div>
      </Modal>
    </>
  )
}
