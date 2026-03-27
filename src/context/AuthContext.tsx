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
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authApi } from '@/lib/api'
import type { UsuarioContexto } from '@/lib/tipos'

// Timeout de inactividad en milisegundos (90 minutos por defecto)
const INACTIVITY_TIMEOUT_MS = 90 * 60 * 1000

interface AuthContextType {
  usuario: UsuarioContexto | null
  cargando: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  loginConGoogle: () => Promise<void>
  logout: () => Promise<void>
  cambiarEntidad: (codigoEntidad: string) => Promise<void>
  tieneFuncion: (codigoFuncion: string) => boolean
  esAdmin: () => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioContexto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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

  // Escucha cambios de sesión de Supabase (login, logout, OAuth callback)
  useEffect(() => {
    let isMounted = true
    let initialLoadDone = false

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        initialLoadDone = true
        if (session) {
          const ctx = await cargarContexto()
          if (isMounted && ctx && event === 'SIGNED_IN') {
            router.push(ctx.url_inicio || '/dashboard')
          }
        } else {
          setUsuario(null)
          if (event === 'SIGNED_OUT') {
            router.push('/login')
          }
        }
        if (isMounted) setCargando(false)
      }
    )

    // Carga inicial - solo si el listener no la manejó ya
    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted || initialLoadDone) return
      if (data.session) {
        await cargarContexto()
      }
      if (isMounted) setCargando(false)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [cargarContexto, router])

  // Timeout de inactividad: cierra sesión si no hay actividad
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!usuario) return

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      inactivityTimer.current = setTimeout(() => {
        logout()
      }, INACTIVITY_TIMEOUT_MS)
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
      // onAuthStateChange maneja la redirección
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

  const tieneFuncion = (codigoFuncion: string) =>
    usuario?.funciones?.includes(codigoFuncion) ?? false

  const esAdmin = () =>
    usuario?.roles?.includes('ADMIN') || usuario?.rol_principal === 'ADMIN' ? true : false

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, error, login, loginConGoogle, logout, cambiarEntidad, tieneFuncion, esAdmin }}
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
