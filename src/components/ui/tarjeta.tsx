import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface TarjetaProps {
  className?: string
  children: ReactNode
}

function Tarjeta({ className, children }: TarjetaProps) {
  return (
    <div className={cn('bg-surface rounded-xl border border-borde shadow-sm', className)}>
      {children}
    </div>
  )
}

function TarjetaCabecera({ className, children }: TarjetaProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-borde', className)}>{children}</div>
  )
}

function TarjetaTitulo({ className, children }: TarjetaProps) {
  return <h3 className={cn('text-base font-semibold text-texto', className)}>{children}</h3>
}

function TarjetaDescripcion({ className, children }: TarjetaProps) {
  return <p className={cn('text-sm text-texto-muted mt-0.5', className)}>{children}</p>
}

function TarjetaContenido({ className, children }: TarjetaProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

function TarjetaPie({ className, children }: TarjetaProps) {
  return (
    <div className={cn('px-6 py-4 border-t border-borde bg-fondo rounded-b-xl', className)}>
      {children}
    </div>
  )
}

export { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaDescripcion, TarjetaContenido, TarjetaPie }
