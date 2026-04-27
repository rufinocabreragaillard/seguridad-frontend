'use client'

import { MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BotonChatProps {
  className?: string
}

/**
 * Botón de Chat para la esquina superior derecha de las páginas.
 * Navega a /chat al hacer clic.
 */
export function BotonChat({ className }: BotonChatProps) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.push('/chat')}
      title="Chat"
      aria-label="Chat"
      className={cn(
        'absolute top-0 right-0 z-10 inline-flex items-center gap-2 rounded-lg border border-borde bg-surface px-3 py-2 text-sm font-medium text-texto hover:bg-primario-muy-claro hover:text-primario transition-colors',
        className,
      )}
    >
      <MessageSquare size={16} />
      <span>Chat</span>
    </button>
  )
}
