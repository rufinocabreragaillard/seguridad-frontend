'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Globe } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { tema } from '@/config/tema.config'
import api from '@/lib/api'
import { useTranslations } from 'next-intl'
import { locales, type Locale } from '@/i18n/config'

const LOCALE_LABELS: Record<string, string> = { es: 'ES', en: 'EN', pt: 'PT', fr: 'FR', de: 'DE' }

function cambiarLocale(nuevoLocale: Locale) {
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  document.cookie = `NEXT_LOCALE=${nuevoLocale}; Path=/; Max-Age=31536000; SameSite=Lax${isSecure ? '; Secure' : ''}`
  window.location.href = window.location.pathname + window.location.search
}

export default function PaginaLogin() {
  const t = useTranslations('login')
  const { login, loginConGoogle, loginConMicrosoft, cargando, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [errorLocal, setErrorLocal] = useState('')
  const [modoRecuperacion, setModoRecuperacion] = useState(false)
  const [emailRecuperacion, setEmailRecuperacion] = useState('')
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false)
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState('')
  const [modoRegistro, setModoRegistro] = useState(false)
  const [formRegistro, setFormRegistro] = useState({ email: '', nombre: '', empresa: '' })
  const [enviandoRegistro, setEnviandoRegistro] = useState(false)
  const [mensajeRegistro, setMensajeRegistro] = useState('')

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

  const handleMicrosoft = async () => {
    setErrorLocal('')
    try {
      await loginConMicrosoft()
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : 'Error con Microsoft')
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

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorLocal('')
    setMensajeRegistro('')
    const { email, nombre, empresa } = formRegistro
    if (!email || !nombre || !empresa) {
      setErrorLocal('Todos los campos son obligatorios')
      return
    }
    setEnviandoRegistro(true)
    try {
      const res = await api.post('/auth/registro', { email: email.toLowerCase(), nombre, empresa })
      setMensajeRegistro(res.data.mensaje)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorLocal(detail || 'Error al procesar el registro. Intenta nuevamente.')
    } finally {
      setEnviandoRegistro(false)
    }
  }

  const mensajeError = errorLocal || error

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ backgroundColor: '#ebebeb' }}
      >
        {/* Círculos decorativos */}
        <div
          className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20"
          style={{ backgroundColor: tema.colores.primario }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full opacity-15"
          style={{ backgroundColor: tema.colores.primario }}
        />

        <div className="relative z-10 flex flex-col items-center text-center gap-1 max-w-sm">
          <Image
            src={tema.logo.url}
            alt={tema.logo.alt}
            width={284}
            height={92}
            className="object-contain"
            onError={(e) => {
              const t = e.target as HTMLImageElement
              t.style.display = 'none'
            }}
          />
          <p className="font-semibold tracking-wide" style={{ fontSize: '1.45rem', color: '#5a5a5a', textAlign: 'center' }}>
            {t('tagline')}
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-fondo">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src={tema.logo.url}
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
            {modoRegistro ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModoRegistro(false)
                    setErrorLocal('')
                    setMensajeRegistro('')
                    setFormRegistro({ email: '', nombre: '', empresa: '' })
                  }}
                  className="flex items-center gap-1 text-sm text-primario hover:text-primario-hover transition-colors mb-4"
                >
                  <ArrowLeft size={14} />
                  {t('volverLogin')}
                </button>
                <h1 className="auth-heading mb-1">Regístrate</h1>
                <p className="text-sm text-texto-muted mb-6">
                  Recibirás una invitación por correo, para confirmar tu mail.
                </p>

                {mensajeRegistro ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-blue-700">{mensajeRegistro}</p>
                  </div>
                ) : (
                  <form onSubmit={handleRegistro} className="flex flex-col gap-4">
                    <Input
                      etiqueta={t('email')}
                      type="email"
                      id="reg-email"
                      value={formRegistro.email}
                      onChange={(e) => setFormRegistro({ ...formRegistro, email: e.target.value })}
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      icono={<Mail size={16} />}
                      disabled={enviandoRegistro}
                    />
                    <Input
                      etiqueta="Nombre completo"
                      type="text"
                      id="reg-nombre"
                      value={formRegistro.nombre}
                      onChange={(e) => setFormRegistro({ ...formRegistro, nombre: e.target.value })}
                      placeholder="Nombre Apellido"
                      autoComplete="name"
                      disabled={enviandoRegistro}
                    />
                    <Input
                      etiqueta="Nombre de empresa"
                      type="text"
                      id="reg-empresa"
                      value={formRegistro.empresa}
                      onChange={(e) => setFormRegistro({ ...formRegistro, empresa: e.target.value })}
                      placeholder="Mi Empresa S.A."
                      disabled={enviandoRegistro}
                    />

                    {mensajeError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <p className="text-sm text-error">{mensajeError}</p>
                      </div>
                    )}

                    <Boton
                      type="submit"
                      variante="primario"
                      className="w-full mt-2"
                      style={{ backgroundColor: '#1A1E2E', borderColor: '#1A1E2E' }}
                      cargando={enviandoRegistro}
                      disabled={enviandoRegistro}
                    >
                      Registrarme
                    </Boton>
                  </form>
                )}
              </>
            ) : modoRecuperacion ? (
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
                  {t('volverLogin')}
                </button>
                <h1 className="auth-heading mb-1">{t('recuperarTitulo')}</h1>
                <p className="text-sm text-texto-muted mb-8">
                  {t('recuperarSubtitulo')}
                </p>

                <form onSubmit={handleRecuperarClave} className="flex flex-col gap-4">
                  <Input
                    etiqueta={t('email')}
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
                    <div className={`border rounded-lg px-4 py-3 ${mensajeError.startsWith('Conectando') ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                      <p className={`text-sm ${mensajeError.startsWith('Conectando') ? 'text-blue-700' : 'text-error'}`}>{mensajeError}</p>
                    </div>
                  )}

                  <Boton
                    type="submit"
                    variante="primario"
                    className="w-full mt-2"
                    cargando={enviandoRecuperacion}
                    disabled={enviandoRecuperacion}
                  >
                    {t('enviarEnlace')}
                  </Boton>
                </form>
              </>
            ) : (
              <>
                <h1 className="auth-heading mb-1">{t('titulo')}</h1>
                <p className="text-sm text-texto-muted mb-8">
                  {t('subtitulo')}
                </p>

                {/* Botones OAuth */}
                <div className="flex flex-col gap-3 mb-4">
                  <Boton
                    variante="contorno"
                    className="w-full"
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
                    {t('google')}
                  </Boton>

                  <Boton
                    variante="contorno"
                    className="w-full"
                    onClick={handleMicrosoft}
                    type="button"
                    disabled={cargando}
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                    </svg>
                    {t('microsoft')}
                  </Boton>
                </div>

                <div className="relative flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-borde" />
                  <span className="text-xs text-texto-muted">{t('separador')}</span>
                  <div className="flex-1 h-px bg-borde" />
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    etiqueta={t('email')}
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
                        etiqueta={t('password')}
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

                  {mensajeError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-error">{mensajeError}</p>
                    </div>
                  )}

                  <Boton
                    type="submit"
                    variante="primario"
                    className="w-full mt-2"
                    style={{ backgroundColor: '#1A1E2E', borderColor: '#1A1E2E' }}
                    cargando={cargando}
                    disabled={cargando}
                  >
                    {t('entrar')}
                  </Boton>
                </form>

                {/* Fuera del form para que Enter no lo active accidentalmente */}
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModoRegistro(true)
                      setErrorLocal('')
                      setFormRegistro({ email, nombre: '', empresa: '' })
                    }}
                    className="text-sm text-primario hover:text-primario-hover transition-colors"
                  >
                    ¿No tienes cuenta? <span className="font-medium">Regístrate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoRecuperacion(true)
                      setErrorLocal('')
                      setEmailRecuperacion(email)
                    }}
                    className="text-sm text-primario hover:text-primario-hover transition-colors"
                  >
                    {t('olvidoPassword')}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-texto-muted">
              {tema.app.nombre} v{tema.app.version}
            </p>
            <div className="flex items-center gap-1">
              <Globe size={12} className="text-texto-muted" />
              {locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => cambiarLocale(loc)}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    (typeof document !== 'undefined' && document.cookie.includes(`NEXT_LOCALE=${loc}`)) ||
                    (typeof document !== 'undefined' && !document.cookie.includes('NEXT_LOCALE=') && loc === 'es')
                      ? 'bg-primario text-primario-texto font-medium'
                      : 'text-texto-muted hover:text-texto'
                  }`}
                >
                  {LOCALE_LABELS[loc] || loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
