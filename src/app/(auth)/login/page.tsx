'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { tema } from '@/config/tema.config'
import api from '@/lib/api'

export default function PaginaLogin() {
  const { login, loginConGoogle, cargando, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [errorLocal, setErrorLocal] = useState('')
  const [modoRecuperacion, setModoRecuperacion] = useState(false)
  const [emailRecuperacion, setEmailRecuperacion] = useState('')
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false)
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorLocal('')
    if (!email || !password) {
      setErrorLocal('Ingresa tu correo y contraseña')
      return
    }
    try {
      await login(email, password)
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : 'Error al iniciar sesión')
    }
  }

  const handleGoogle = async () => {
    setErrorLocal('')
    try {
      await loginConGoogle()
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : 'Error con Google')
    }
  }

  const handleRecuperarClave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorLocal('')
    setMensajeRecuperacion('')
    if (!emailRecuperacion) {
      setErrorLocal('Ingresa tu correo electrónico')
      return
    }
    setEnviandoRecuperacion(true)
    try {
      const res = await api.post('/auth/recuperar-clave', { email: emailRecuperacion })
      setMensajeRecuperacion(res.data.mensaje)
    } catch (err) {
      setMensajeRecuperacion('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.')
    } finally {
      setEnviandoRecuperacion(false)
    }
  }

  const mensajeError = errorLocal || error

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ backgroundColor: '#074B91' }}
      >
        {/* Círculos decorativos */}
        <div
          className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-10"
          style={{ backgroundColor: tema.colores.acento }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full opacity-10"
          style={{ backgroundColor: tema.colores.secundario }}
        />

        <div className="relative z-10 flex flex-col items-center text-center gap-6 max-w-sm">
          <Image
            src={tema.logo.src}
            alt={tema.logo.alt}
            width={160}
            height={52}
            className="object-contain"
            onError={(e) => {
              const t = e.target as HTMLImageElement
              t.style.display = 'none'
            }}
          />
          <div>
            <h2 className="text-3xl font-bold text-white">{tema.app.nombre}</h2>
            <p className="text-sidebar-texto-muted mt-3 text-sm leading-relaxed">
              Gestión centralizada de usuarios, roles y permisos para todas tus aplicaciones.
            </p>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-fondo">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
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
            {modoRecuperacion ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModoRecuperacion(false)
                    setErrorLocal('')
                    setMensajeRecuperacion('')
                  }}
                  className="flex items-center gap-1 text-sm text-primario hover:text-primario-hover transition-colors mb-4"
                >
                  <ArrowLeft size={14} />
                  Volver al login
                </button>
                <h1 className="text-2xl font-bold text-texto mb-1">Recuperar contraseña</h1>
                <p className="text-sm text-texto-muted mb-8">
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña
                </p>

                <form onSubmit={handleRecuperarClave} className="flex flex-col gap-4">
                  <Input
                    etiqueta="Correo electrónico"
                    type="email"
                    id="emailRecuperacion"
                    value={emailRecuperacion}
                    onChange={(e) => setEmailRecuperacion(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    icono={<Mail size={16} />}
                    disabled={enviandoRecuperacion}
                  />

                  {mensajeRecuperacion && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-blue-700">{mensajeRecuperacion}</p>
                    </div>
                  )}

                  {mensajeError && !mensajeRecuperacion && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-error">{mensajeError}</p>
                    </div>
                  )}

                  <Boton
                    type="submit"
                    variante="primario"
                    className="w-full mt-2"
                    cargando={enviandoRecuperacion}
                    disabled={enviandoRecuperacion}
                  >
                    Enviar enlace de recuperación
                  </Boton>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-texto mb-1">Iniciar sesión</h1>
                <p className="text-sm text-texto-muted mb-8">
                  Accede con tu cuenta para continuar
                </p>

                {/* Botón Google */}
                <Boton
                  variante="contorno"
                  className="w-full mb-4"
                  onClick={handleGoogle}
                  type="button"
                  disabled={cargando}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </Boton>

                <div className="relative flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-borde" />
                  <span className="text-xs text-texto-muted">o ingresa con tu correo</span>
                  <div className="flex-1 h-px bg-borde" />
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    etiqueta="Correo electrónico"
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    icono={<Mail size={16} />}
                    disabled={cargando}
                  />

                  <div className="flex flex-col gap-1.5">
                    <div className="relative">
                      <Input
                        etiqueta="Contraseña"
                        type={verPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
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
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setModoRecuperacion(true)
                      setErrorLocal('')
                      setEmailRecuperacion(email)
                    }}
                    className="text-sm text-primario hover:text-primario-hover transition-colors text-right -mt-2"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>

                  {mensajeError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-error">{mensajeError}</p>
                    </div>
                  )}

                  <Boton
                    type="submit"
                    variante="primario"
                    className="w-full mt-2"
                    cargando={cargando}
                    disabled={cargando}
                  >
                    Iniciar sesión
                  </Boton>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-texto-muted mt-6">
            {tema.app.nombre} v{tema.app.version}
          </p>
        </div>
      </div>
    </div>
  )
}
