'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta?: string
  error?: string
  icono?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, etiqueta, error, icono, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {etiqueta && (
          <label htmlFor={id} className="text-sm font-medium text-texto">
            {etiqueta}
          </label>
        )}
        <div className="relative">
          {icono && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-texto-muted">
              {icono}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto',
              'placeholder:text-texto-light',
              'focus:outline-none focus:ring-2 focus:ring-primario focus:border-primario',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-error focus:ring-error',
              icono && 'pl-10',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
