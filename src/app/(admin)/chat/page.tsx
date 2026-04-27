'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaChatRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/chat-usuario')
  }, [router])
  return null
}
