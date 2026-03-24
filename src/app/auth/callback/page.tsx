'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Supabase maneja el intercambio de código automáticamente
    // Solo esperamos a que la sesión esté activa y redirigimos
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-fondo">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-4 border-primario border-t-transparent animate-spin" />
        <p className="text-sm text-texto-muted">Verificando sesión...</p>
      </div>
    </div>
  )
}
