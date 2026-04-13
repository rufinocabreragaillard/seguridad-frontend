'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authApi, actualizarMapaFunciones, setOverrideSesion, clearOverridesSesion } from '@/lib/api'
import type { UsuarioContexto } from '@/lib/tipos'

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/auth/reset-password']

interface AuthContextType {
  usuario: UsuarioContexto | null
  cargando: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  loginConGoogle: () => Promise<void>
  logout: () => Promise<void>
  cambiarEntidad: (codigoEntidad: string) => Promise<void>
  cambiarGrupo: (codigoGrupo: string) => Promise<void>
  cambiarAplicacion: (codigoAplicacion: string) => Promise<void>
  tieneFuncion: (codigoFuncion: string) => boolean
  tieneAccesoRuta: (ruta: string) => boolean
  esAdmin: () => boolean
  esSuperAdmin: () => boolean
  entidadActiva: string | null
  grupoActivo: string | null
  aplicacionActiva: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioContexto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Flag: true solo cuando el usuario hace login explícito (clic en "Iniciar sesión")
  // Se usa para distinguir SIGNED_IN por login vs SIGNED_IN por restauración de sesión
  const loginExplicito = useRef(false)
  // Ref para pathname: permite leerlo dentro del efecto de auth sin que cambie
  // de pathname dispare un re-registro de onAuthStateChange (lo que causaba el
  // lock de Supabase de 5s en la primera carga).
  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  const cargarContexto = useCallback(async () => {
    const MAX_INTENTOS = 3
    const PAUSA_MS = 3000 // pausa entre reintentos mientras Railway despierta

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        const ctx = await authApi.yo()
        setUsuario(ctx)
        actualizarMapaFunciones(ctx.menu)
        // Cargar traducciones de campos de BD del sistema
        const { setTraducciones } = await import('@/lib/traducir')
        setTraducciones(ctx.traducciones ?? {}, ctx.locale ?? 'es')
        return ctx
      } catch (e: unknown) {
        const esUltimoIntento = intento === MAX_INTENTOS
        const esTimeout = e instanceof Error && (e.message.includes('timeout') || e.message === 'Network Error')

        if (!esUltimoIntento && esTimeout) {
          // Railway puede estar despertando — esperar y reintentar automáticamente
          await new Promise((r) => setTimeout(r, PAUSA_MS))
          continue
        }

        // Último intento fallido o error no recuperable
        setUsuario(null)
        actualizarMapaFunciones()
        let msg = 'Error al cargar datos del usuario'
        if (e instanceof Error) {
          if (e.message === 'Network Error' || e.message.includes('timeout')) {
            msg = 'No se pudo conectar con el servidor. Intente recargar la página.'
          } else {
            msg = e.message
          }
        }
        setError(msg)
        return null
      }
    }
    return null
  }, [])

  useEffect(() => {
    let isMounted = true

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (event === 'INITIAL_SESSION') {
          // Carga inicial: refresh de página o primera visita
          if (session) {
            const ctx = await cargarContexto()
            if (isMounted) {
              setCargando(false)
              // Si ctx es null (backend no respondió), NO redirigir a /login:
              // la sesión Supabase sigue válida. page.tsx mostrará el error
              // con botón Reintentar. Solo redirigir si no hay sesión Supabase.
              if (!ctx && !PUBLIC_ROUTES.includes(pathnameRef.current)) {
                // No hacemos router.push('/login') — el error ya fue seteado en cargarContexto
              }
            }
          } else {
            if (isMounted) {
              setCargando(false)
              if (!PUBLIC_ROUTES.includes(pathnameRef.current)) {
                router.push('/login')
              }
            }
          }
        } else if (event === 'SIGNED_IN') {
          // Login fresco (email/password o OAuth callback): SIEMPRE limpiar overrides
          // para que se inicialice con los defaults de BD del usuario
          clearOverridesSesion()
          // Solo redirigir si fue un login explícito del usuario
          if (loginExplicito.current) {
            loginExplicito.current = false
            const ctx = await cargarContexto()
            if (isMounted) {
              setCargando(false)
              if (ctx) {
                router.push(ctx.url_inicio || '/dashboard')
              } else {
                // Backend rechazó: cerrar sesión de Supabase para permitir reintento
                await supabase.auth.signOut()
              }
            }
          }
          // Si no es login explícito (restauración de sesión), ignorar
          // INITIAL_SESSION ya lo manejó
        } else if (event === 'SIGNED_OUT') {
          setUsuario(null)
          if (isMounted) {
            setCargando(false)
            router.push('/login')
          }
        } else if (event === 'TOKEN_REFRESHED') {
          if (session) {
            await cargarContexto()
          }
        }
      }
    )

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [cargarContexto, router]) // pathname se lee via pathnameRef para evitar re-registro del lock

  // Timeout de inactividad: usa la duración configurada desde el backend
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!usuario) return

    const timeoutMs = (usuario.sesion_duracion_minutos ?? 90) * 60 * 1000

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      inactivityTimer.current = setTimeout(() => {
        logout()
      }, timeoutMs)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  const login = async (email: string, password: string) => {
    setError(null)
    setCargando(true)
    loginExplicito.current = true  // Marcar que es login explícito
    clearOverridesSesion()  // Garantizar inicio con defaults de BD
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        loginExplicito.current = false
        throw new Error(err.message)
      }
    } catch (e) {
      loginExplicito.current = false
      setError(e instanceof Error ? e.message : 'Error al iniciar sesión')
      setCargando(false)
      throw e
    }
  }

  const loginConGoogle = async () => {
    setError(null)
    loginExplicito.current = true
    clearOverridesSesion()  // Garantizar inicio con defaults de BD
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (err) {
      loginExplicito.current = false
      setError(err.message)
      throw new Error(err.message)
    }
  }

  const logout = async () => {
    clearOverridesSesion()
    await supabase.auth.signOut()
    setUsuario(null)
    actualizarMapaFunciones()
    router.push('/login')
  }

  const cambiarEntidad = async (codigoEntidad: string) => {
    try {
      setOverrideSesion('entidad', codigoEntidad)
      const ctx = await authApi.cambiarEntidad(codigoEntidad)
      setUsuario(ctx)
      actualizarMapaFunciones(ctx.menu)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar entidad')
      throw e
    }
  }

  const cambiarGrupo = async (codigoGrupo: string) => {
    try {
      setOverrideSesion('grupo', codigoGrupo)
      setOverrideSesion('entidad', null)  // reset entidad al cambiar grupo
      setOverrideSesion('aplicacion', null)  // reset app al cambiar grupo
      const ctx = await authApi.cambiarGrupo(codigoGrupo)
      setUsuario(ctx)
      actualizarMapaFunciones(ctx.menu)
      // Guardar la entidad que el backend seleccionó para el nuevo grupo
      if (ctx.entidad_activa) setOverrideSesion('entidad', ctx.entidad_activa)
      router.push('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar grupo')
      throw e
    }
  }

  const cambiarAplicacion = async (codigoAplicacion: string) => {
    try {
      setOverrideSesion('aplicacion', codigoAplicacion)
      const ctx = await authApi.cambiarAplicacion(codigoAplicacion)
      setUsuario(ctx)
      actualizarMapaFunciones(ctx.menu)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar aplicación')
      throw e
    }
  }

  const tieneFuncion = (codigoFuncion: string) =>
    usuario?.funciones?.includes(codigoFuncion) ?? false

  // URLs permitidas extraídas del menú dinámico (se recalcula solo cuando cambia usuario)
  const urlsPermitidas = useMemo(() => {
    const urls = new Set<string>(['/dashboard']) // dashboard siempre accesible
    if (usuario?.menu) {
      for (const rol of usuario.menu) {
        for (const fn of rol.funciones) {
          if (fn.url) urls.add(fn.url)
        }
      }
    }
    return urls
  }, [usuario])

  const tieneAccesoRuta = useCallback((ruta: string) => {
    if (!usuario) return false
    // Super-admins (grupo ADMIN) tienen acceso a todo
    if (usuario.grupos?.some((g) => g.codigo_grupo === 'ADMIN')) return true
    // Verificar si la ruta coincide con alguna URL del menú
    for (const url of urlsPermitidas) {
      if (ruta === url || ruta.startsWith(url + '/')) return true
    }
    return false
  }, [usuario, urlsPermitidas])

  const esAdmin = () =>
    usuario?.roles?.includes('ADMIN') || usuario?.rol_principal === 'ADMIN' ? true : false

  const esSuperAdmin = () =>
    usuario?.grupos?.some((g) => g.codigo_grupo === 'ADMIN') ?? false

  const entidadActiva = usuario?.entidad_activa ?? null
  const grupoActivo = usuario?.grupo_activo ?? null
  const aplicacionActiva = usuario?.aplicacion_activa ?? null

  return (
    <AuthContext.Provider
      value={{
        usuario, cargando, error, login, loginConGoogle, logout,
        cambiarEntidad, cambiarGrupo, cambiarAplicacion,
        tieneFuncion, tieneAccesoRuta,
        esAdmin, esSuperAdmin, entidadActiva, grupoActivo, aplicacionActiva,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
