'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function PaginaRaiz() {
  const router = useRouter()
  const { usuario, cargando } = useAuth()

  useEffect(() => {
    if (cargando) return
    if (usuario) {
      router.replace(usuario.url_inicio || '/dashboard')
    } else {
      router.replace('/login')
    }
  }, [usuario, cargando, router])

  return null
}
