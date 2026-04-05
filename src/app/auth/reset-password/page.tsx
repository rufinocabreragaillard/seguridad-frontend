'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { tema } from '@/config/tema.config'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [verConfirmar, setVerConfirmar] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [sesionValida, setSesionValida] = useState(false)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    // Supabase inyecta la sesión de recovery automáticamente al cargar la página
    // (el hash fragment contiene access_token + type=recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          setSesionValida(true)
          setVerificando(false)
        } else if (event === 'INITIAL_SESSION' && session) {
          // Ya hay sesión activa (recovery token procesado)
          setSesionValida(true)
          setVerificando(false)
        }
      }
    )

    // Timeout: si en 5s no se detecta sesión recovery, mostrar error
    const timeout = setTimeout(() => {
      setVerificando(false)
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password || !confirmarPassword) {
      setError('Completa ambos campos')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw new Error(err.message)
      setExito(true)
      // Cerrar sesión de recovery y redirigir al login
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push('/login')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña')
    } finally {
      setCargando(false)
    }
  }

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fondo">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-4 border-primario border-t-transparent animate-spin" />
          <p className="text-sm text-texto-muted">Verificando enlace...</p>
        </div>
      </div>
    )
  }

  if (!sesionValida) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fondo p-6">
        <div className="w-full max-w-md bg-surface rounded-2xl border border-borde shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-texto mb-2">Enlace no válido</h1>
          <p className="text-sm text-texto-muted mb-6">
            El enlace de recuperación ha expirado o no es válido. Solicita uno nuevo desde la página de inicio de sesión.
          </p>
          <Boton
            variante="primario"
            onClick={() => router.push('/login')}
          >
            Ir al login
          </Boton>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fondo p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src={tema.logo.src}
            alt={tema.logo.alt}
            width={120}
            height={40}
            className="object-contain"
            onError={(e) => {
              const t = e.target as HTMLImageElement
              t.style.display = 'none'
            }}
          />
        </div>

        <div className="bg-surface rounded-2xl border border-borde shadow-sm p-8">
          {exito ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle size={48} className="text-green-500" />
              <h1 className="text-2xl font-bold text-texto">Contraseña actualizada</h1>
              <p className="text-sm text-texto-muted">
                Tu contraseña ha sido actualizada correctamente. Serás redirigido al login...
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-texto mb-1">Nueva contraseña</h1>
              <p className="text-sm text-texto-muted mb-8">
                Ingresa tu nueva contraseña
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative">
                  <Input
                    etiqueta="Nueva contraseña"
                    type={verPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    icono={<Lock size={16} />}
                    disabled={cargando}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword(!verPassword)}
                    className="absolute right-3 top-9 text-texto-muted hover:text-texto transition-colors"
                  >
                    {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    etiqueta="Confirmar contraseña"
                    type={verConfirmar ? 'text' : 'password'}
                    id="confirmarPassword"
                    value={confirmarPassword}
                    onChange={(e) => setConfirmarPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    icono={<Lock size={16} />}
                    disabled={cargando}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setVerConfirmar(!verConfirmar)}
                    className="absolute right-3 top-9 text-texto-muted hover:text-texto transition-colors"
                  >
                    {verConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-error">{error}</p>
                  </div>
                )}

                <Boton
                  type="submit"
                  variante="primario"
                  className="w-full mt-2"
                  cargando={cargando}
                  disabled={cargando}
                >
                  Actualizar contraseña
                </Boton>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
