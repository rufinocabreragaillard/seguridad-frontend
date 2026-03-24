'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authApi } from '@/lib/api'
import type { UsuarioContexto } from '@/lib/tipos'

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
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const ctx = await cargarContexto()
          if (ctx && event === 'SIGNED_IN') {
            router.push(ctx.url_inicio || '/dashboard')
          }
        } else {
          setUsuario(null)
          if (event === 'SIGNED_OUT') {
            router.push('/login')
          }
        }
        setCargando(false)
      }
    )

    // Carga inicial
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        cargarContexto().finally(() => setCargando(false))
      } else {
        setCargando(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [cargarContexto, router])

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
