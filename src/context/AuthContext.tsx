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
import { authApi } from '@/lib/api'
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
  tieneFuncion: (codigoFuncion: string) => boolean
  tieneAccesoRuta: (ruta: string) => boolean
  esAdmin: () => boolean
  esSuperAdmin: () => boolean
  entidadActiva: string | null
  grupoActivo: string | null
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

  const cargarContexto = useCallback(async () => {
    try {
      const ctx = await authApi.yo()
      setUsuario(ctx)
      return ctx
    } catch {
      setUsuario(null)
      return null
    }
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
              if (!ctx && !PUBLIC_ROUTES.includes(pathname)) {
                router.push('/login')
              }
            }
          } else {
            if (isMounted) {
              setCargando(false)
              if (!PUBLIC_ROUTES.includes(pathname)) {
                router.push('/login')
              }
            }
          }
        } else if (event === 'SIGNED_IN') {
          // Solo redirigir si fue un login explícito del usuario
          if (loginExplicito.current) {
            loginExplicito.current = false
            const ctx = await cargarContexto()
            if (isMounted) {
              setCargando(false)
              if (ctx) {
                router.push(ctx.url_inicio || '/dashboard')
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
  }, [cargarContexto, router, pathname])

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
    await supabase.auth.signOut()
    setUsuario(null)
    router.push('/login')
  }

  const cambiarEntidad = async (codigoEntidad: string) => {
    try {
      const ctx = await authApi.cambiarEntidad(codigoEntidad)
      setUsuario(ctx)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar entidad')
      throw e
    }
  }

  const cambiarGrupo = async (codigoGrupo: string) => {
    try {
      const ctx = await authApi.cambiarGrupo(codigoGrupo)
      setUsuario(ctx)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar grupo')
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

  return (
    <AuthContext.Provider
      value={{
        usuario, cargando, error, login, loginConGoogle, logout,
        cambiarEntidad, cambiarGrupo, tieneFuncion, tieneAccesoRuta,
        esAdmin, esSuperAdmin, entidadActiva, grupoActivo,
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
