'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Building2, Layers, Check, Bell, LogOut, User, AppWindow } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Avatar from '@radix-ui/react-avatar'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { usuariosApi, traduccionesApi } from '@/lib/api'
import { useTranslations } from 'next-intl'
import { locales as localesFallback, type Locale } from '@/i18n/config'
import { tr } from '@/lib/traducir'
import type { LocaleSoportado } from '@/lib/tipos'

// Cache módulo-nivel para no re-fetchear en cada render
let _localesCache: LocaleSoportado[] | null = null

export function Header({ titulo }: { titulo?: string }) {
  const t = useTranslations('header')
  const tc = useTranslations('common')
  const router = useRouter()
  const { usuario, cambiarEntidad, cambiarGrupo, cambiarAplicacion, logout } = useAuth()
  const [cambiando, setCambiando] = useState(false)
  const [localesDinamicos, setLocalesDinamicos] = useState<LocaleSoportado[]>(_localesCache ?? [])

  // Cargar locales activos desde BD (una sola vez por sesión)
  useEffect(() => {
    if (_localesCache !== null) return
    traduccionesApi.listarLocalesActivos()
      .then((data) => {
        _localesCache = data
        setLocalesDinamicos(data)
      })
      .catch(() => {
        // Fallback silencioso a locales hardcodeados
        _localesCache = []
      })
  }, [])

  // Modal Mi Cuenta
  const [modalCuenta, setModalCuenta] = useState(false)
  const [tabCuenta, setTabCuenta] = useState<'datos' | 'preferencias'>('datos')
  const [formCuenta, setFormCuenta] = useState({
    nombre: '', telefono: '', alias: '', descripcion: '',
    sidebar_colapsado: false,
    id_rol_principal: null as number | null,
  })
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)
  const [errorCuenta, setErrorCuenta] = useState('')
  const [exitoCuenta, setExitoCuenta] = useState('')
  const [datosOriginales, setDatosOriginales] = useState<Record<string, unknown>>({})
  const [rolesUsuario, setRolesUsuario] = useState<{ id_rol: number; nombre: string; codigo_grupo: string }[]>([])

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
    } finally {
      setCambiando(false)
    }
  }

  const handleCambiarLocale = async (nuevoLocale: Locale) => {
    // BD primero: si falla, no tocar cookie ni recargar para evitar que AuthContext
    // detecte cookie ≠ BD en el próximo render y revierta el cambio.
    if (usuario?.codigo_usuario) {
      try {
        await usuariosApi.actualizar(usuario.codigo_usuario, { locale: nuevoLocale })
      } catch (e) {
        console.error('[locale] error al guardar preferencia:', e)
        alert('No se pudo guardar el idioma. Intenta nuevamente.')
        return
      }
    }
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
    document.cookie = `NEXT_LOCALE=${nuevoLocale}; Path=/; Max-Age=31536000; SameSite=Lax${isSecure ? '; Secure' : ''}`
    window.location.href = window.location.pathname + window.location.search
  }

  const handleCambiarAplicacion = async (codigoApp: string) => {
    if (codigoApp === usuario?.aplicacion_activa) return
    setCambiandoApp(true)
    try {
      const ctx = await cambiarAplicacion(codigoApp)
      setModalAplicacion(false)
      // Verificar si la app destino está en otro dominio (cross-app real)
      const urlBase = usuario?.aplicaciones_url?.[codigoApp]
      if (urlBase) {
        try {
          const destino = new URL(urlBase)
          const actual = window.location.origin
          // Solo navegar si es un dominio diferente y no es localhost
          if (destino.origin !== actual && destino.hostname !== 'localhost' && destino.hostname !== '127.0.0.1') {
            window.location.href = urlBase
            return
          }
        } catch { /* URL inválida, ignorar */ }
      }
      // Misma app/dominio o sin url_base: el estado ya se actualizó en AuthContext,
      // React re-renderiza el sidebar. Navegar a la URL de inicio del nuevo contexto.
      router.push(ctx.url_inicio || '/dashboard')
    } catch {
      // error manejado en AuthContext
    } finally {
      setCambiandoApp(false)
    }
  }

  // Mi Cuenta
  const abrirMiCuenta = () => {
    setFormCuenta({
      nombre: usuario?.nombre || '',
      telefono: '',
      alias: '',
      descripcion: '',
      sidebar_colapsado: false,
      id_rol_principal: usuario?.id_rol_principal ?? null,
    })
    setErrorCuenta('')
    setExitoCuenta('')
    setTabCuenta('datos')
    if (usuario) {
      usuariosApi.obtener(usuario.codigo_usuario).catch(() => null).then((u) => {
        if (u) {
          const datos = {
            nombre: u.nombre,
            telefono: u.telefono || '',
            alias: u.alias || '',
            descripcion: u.descripcion || '',
            sidebar_colapsado: u.sidebar_colapsado ?? false,
            id_rol_principal: u.id_rol_principal ?? null,
          }
          setFormCuenta(datos)
          setDatosOriginales(datos)
        }
      })
      usuariosApi.listarRoles(usuario.codigo_usuario).catch(() => []).then((rows) => {
        const items = (rows || []).map((r) => ({
          id_rol: r.id_rol,
          nombre: r.roles?.nombre || r.codigo_rol || String(r.id_rol),
          codigo_grupo: r.codigo_grupo,
        }))
        setRolesUsuario(items)
      })
    }
    setModalCuenta(true)
  }

  const guardarMiCuenta = async () => {
    if (!usuario || !formCuenta.nombre) { setErrorCuenta(t('nombreObligatorio')); return }
    setGuardandoCuenta(true)
    setErrorCuenta('')
    setExitoCuenta('')
    try {
      const cambios: Record<string, string | boolean | number | null | undefined> = {}
      cambios.nombre = formCuenta.nombre
      if (formCuenta.telefono !== datosOriginales.telefono) cambios.telefono = formCuenta.telefono || undefined
      if (formCuenta.alias !== datosOriginales.alias) cambios.alias = formCuenta.alias || undefined
      if (formCuenta.descripcion !== datosOriginales.descripcion) cambios.descripcion = formCuenta.descripcion || undefined
      if (String(formCuenta.sidebar_colapsado) !== String(datosOriginales.sidebar_colapsado)) {
        cambios.sidebar_colapsado = formCuenta.sidebar_colapsado
      }
      if (formCuenta.id_rol_principal !== datosOriginales.id_rol_principal) {
        cambios.id_rol_principal = formCuenta.id_rol_principal
      }
      await usuariosApi.actualizar(usuario.codigo_usuario, cambios)
      setExitoCuenta(t('datosActualizados'))
      setDatosOriginales({ ...formCuenta })
      return true
    } catch (e) {
      setErrorCuenta(e instanceof Error ? e.message : 'Error al guardar')
      return false
    } finally {
      setGuardandoCuenta(false)
    }
  }

  const guardarMiCuentaYSalir = async () => {
    const ok = await guardarMiCuenta()
    if (ok) setModalCuenta(false)
  }

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
          {(usuario?.alias_aplicacion || usuario?.nombre_aplicacion) && (
            <span className="app-name">
              {usuario.alias_aplicacion || tr('aplicaciones', 'nombre', usuario.aplicacion_activa || '', usuario.nombre_aplicacion || '')}
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
                  <p className="px-3 py-2 text-xs font-semibold text-texto-muted uppercase tracking-wider">{t('misGrupos')}</p>
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
            usuario.entidades.length === 1 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borde bg-fondo text-sm font-medium text-texto">
                <Building2 size={15} className="text-primario shrink-0" />
                <span className="max-w-[160px] truncate">{entidadActual?.nombre ?? usuario.entidad_activa}</span>
              </div>
            ) : (
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
                    <p className="px-3 py-2 text-xs font-semibold text-texto-muted uppercase tracking-wider">{t('misEntidades')}</p>
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
            )
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
                  {t('miCuenta')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setModalAplicacion(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-texto hover:bg-fondo cursor-pointer outline-none"
                >
                  <AppWindow size={14} className="shrink-0" />
                  {t('cambiarAplicacion')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-borde my-1" />
                <DropdownMenu.Item
                  onSelect={() => logout()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-error hover:bg-red-50 cursor-pointer outline-none"
                >
                  <LogOut size={14} className="shrink-0" />
                  {t('cerrarSesion')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Modal Mi Cuenta (con tabs) */}
      <Modal abierto={modalCuenta} alCerrar={() => setModalCuenta(false)} titulo={t('miCuentaTitulo', { email: usuario?.codigo_usuario || '' })} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {/* Pestañas */}
          <div className="flex border-b border-borde -mx-1 overflow-x-auto">
            {(['datos', 'preferencias'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabCuenta(tab)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  tabCuenta === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? t('tabDatos') : t('tabPreferencias')}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabCuenta === 'datos' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Input
                etiqueta={t('alias')}
                value={formCuenta.alias}
                onChange={(e) => setFormCuenta({ ...formCuenta, alias: e.target.value })}
                placeholder={t('aliasPlaceholder')}
              />
              <Input
                etiqueta={t('nombreCompleto')}
                value={formCuenta.nombre}
                onChange={(e) => setFormCuenta({ ...formCuenta, nombre: e.target.value })}
              />
              <Input
                etiqueta={t('telefono')}
                value={formCuenta.telefono}
                onChange={(e) => setFormCuenta({ ...formCuenta, telefono: e.target.value })}
                placeholder={t('telefonoPlaceholder')}
              />
              <div />
              <div className="col-span-2">
                <Textarea
                  etiqueta={t('descripcion')}
                  value={formCuenta.descripcion}
                  onChange={(e) => setFormCuenta({ ...formCuenta, descripcion: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Tab Preferencias */}
          {tabCuenta === 'preferencias' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">{t('rolPrincipal')}</label>
                <select
                  value={formCuenta.id_rol_principal ?? ''}
                  onChange={(e) => setFormCuenta({
                    ...formCuenta,
                    id_rol_principal: e.target.value ? Number(e.target.value) : null,
                  })}
                  className="w-full h-10 px-3 rounded-lg border border-borde bg-surface text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario"
                >
                  <option value="">{t('sinRolPrincipal')}</option>
                  {rolesUsuario
                    .filter((r) => r.codigo_grupo === usuario?.grupo_activo || !r.codigo_grupo)
                    .map((r) => (
                    <option key={`${r.codigo_grupo}-${r.id_rol}`} value={r.id_rol}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-texto-muted">{t('rolPorDefectoAyuda')}</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formCuenta.sidebar_colapsado}
                  onChange={(e) => setFormCuenta({ ...formCuenta, sidebar_colapsado: e.target.checked })}
                  className="rounded border-borde text-primario focus:ring-primario h-4 w-4"
                />
                <span className="text-sm text-texto">{t('sidebarColapsado')}</span>
              </label>

              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-medium text-texto-muted uppercase tracking-wide">{t('idioma')}:</span>
                <div className="flex gap-1 flex-wrap">
                  {(localesDinamicos.length > 0 ? localesDinamicos : localesFallback.map((codigo) => ({ codigo, nombre_nativo: codigo, nombre_es: codigo, es_base: codigo === 'es', orden: 0 }))).map((loc) => {
                    const codigo = typeof loc === 'string' ? loc : loc.codigo
                    const localeActivo = usuario?.locale ?? 'es'
                    const activo = codigo === localeActivo
                    return (
                      <button
                        key={codigo}
                        type="button"
                        onClick={() => handleCambiarLocale(codigo as Locale)}
                        title={typeof loc === 'string' ? codigo : loc.nombre_es}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                          activo
                            ? 'bg-primario text-primario-texto border-primario font-medium'
                            : 'text-texto-muted border-borde hover:text-texto hover:border-primario/50'
                        }`}
                      >
                        {codigo.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {errorCuenta && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorCuenta}</p></div>}
          {exitoCuenta && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3"><p className="text-sm text-exito">{exitoCuenta}</p></div>}

          <PieBotonesModal
            editando
            onGuardar={guardarMiCuenta}
            onGuardarYSalir={guardarMiCuentaYSalir}
            onCerrar={() => setModalCuenta(false)}
            cargando={guardandoCuenta}
          />
        </div>
      </Modal>

      {/* Modal Cambio Aplicacion */}
      <Modal abierto={modalAplicacion} alCerrar={() => setModalAplicacion(false)} titulo={t('cambiarAplicacion')}>
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
                  <p className="font-medium">{tr('aplicaciones', 'nombre',app.codigo_aplicacion, app.nombre)}</p>
                  <p className="text-xs text-texto-muted">{app.codigo_aplicacion}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-sm text-texto-muted text-center py-4">{t('sinAplicacionesDisponibles')}</p>
          )}
        </div>
      </Modal>
    </>
  )
}
