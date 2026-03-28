'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authApi } from '@/lib/api'
import type { UsuarioContexto } from '@/lib/tipos'

// Default 90 minutos — se sobreescribe con el parámetro del backend
const DEFAULT_INACTIVITY_TIMEOUT_MS = 90 * 60 * 1000

// Rutas que no requieren autenticación
const PUBLIC_ROUTES = ['/login', '/auth/callback']

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
  const contextoCargado = useRef(false)

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

  // Único flujo de autenticación: onAuthStateChange maneja todo
  // INITIAL_SESSION se dispara siempre al cargar (con o sin sesión)
  useEffect(() => {
    let isMounted = true

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (event === 'INITIAL_SESSION') {
          // Carga inicial (refresh de página o primera visita)
          if (session) {
            // Hay sesión guardada — cargar contexto del backend
            const ctx = await cargarContexto()
            if (isMounted) {
              setCargando(false)
              contextoCargado.current = true
              // No redirigir — el usuario está refrescando la página actual
              if (!ctx && !PUBLIC_ROUTES.includes(pathname)) {
                // Sesión de Supabase existe pero el backend la rechazó
                router.push('/login')
              }
            }
          } else {
            // No hay sesión guardada
            if (isMounted) {
              setCargando(false)
              contextoCargado.current = true
              if (!PUBLIC_ROUTES.includes(pathname)) {
                router.push('/login')
              }
            }
          }
        } else if (event === 'SIGNED_IN') {
          // Login explícito del usuario
          const ctx = await cargarContexto()
          if (isMounted) {
            setCargando(false)
            if (ctx) {
              router.push(ctx.url_inicio || '/dashboard')
            }
          }
        } else if (event === 'SIGNED_OUT') {
          // Logout
          setUsuario(null)
          if (isMounted) {
            setCargando(false)
            router.push('/login')
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refrescado automáticamente — solo recargar contexto silenciosamente
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
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw new Error(err.message)
      // onAuthStateChange SIGNED_IN maneja la redirección
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar sesión')
      setCargando(false)
      throw e
    }
  }

  const loginConGoogle = async () => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (err) {
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
      // Recargar la página para que todos los datos se refresquen con el nuevo grupo
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar grupo')
      throw e
    }
  }

  const tieneFuncion = (codigoFuncion: string) =>
    usuario?.funciones?.includes(codigoFuncion) ?? false

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
        cambiarEntidad, cambiarGrupo, tieneFuncion, esAdmin, esSuperAdmin,
        entidadActiva, grupoActivo,
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
