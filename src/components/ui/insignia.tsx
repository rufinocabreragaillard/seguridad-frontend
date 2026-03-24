import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface InsigniaProps {
  variante?: 'primario' | 'exito' | 'error' | 'advertencia' | 'neutro' | 'secundario'
  children: ReactNode
  className?: string
}

export function Insignia({ variante = 'neutro', children, className }: InsigniaProps) {
  const variantes = {
    primario: 'bg-primario-muy-claro text-primario border-primario/20',
    exito: 'bg-green-50 text-exito border-green-200',
    error: 'bg-red-50 text-error border-red-200',
    advertencia: 'bg-amber-50 text-advertencia border-amber-200',
    neutro: 'bg-fondo text-texto-muted border-borde',
    secundario: 'bg-secundario-muy-claro text-secundario border-secundario/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variantes[variante],
        className
      )}
    >
      {children}
    </span>
  )
}
