'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authApi } from '@/lib/api'

async function irAInicio(router: ReturnType<typeof useRouter>) {
  try {
    const ctx = await authApi.yo()
    router.push(ctx.url_inicio || '/dashboard')
  } catch {
    router.push('/dashboard')
  }
}

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Escucha el evento SIGNED_IN que Supabase emite después de
    // completar el intercambio del código OAuth (PKCE flow).
    // Llamar a getSession() de inmediato no funciona porque el
    // intercambio es asíncrono y aún no ha terminado.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          router.push('/auth/reset-password')
        } else if (event === 'SIGNED_IN' && session) {
          irAInicio(router)
        } else if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
      }
    )

    // Verificar si ya hay sesión activa (el evento pudo haberse disparado antes del mount)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) irAInicio(router)
    })

    // Timeout de seguridad: si en 8s no hay sesión, redirigir al login
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) router.push('/login')
      else irAInicio(router)
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
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
