'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Estilo visual del botón.
   *
   * Variantes base:
   * - `primario` — acción primaria (azul, "Guardar", "Crear", "Continuar")
   * - `secundario` — acción secundaria (gris/secundario, raro)
   * - `fantasma` — sin fondo, hover suave (acciones inline en filas)
   * - `peligro` — destrucción (rojo, "Eliminar", "Limpiar")
   * - `contorno` — borde + fondo claro ("Cancelar", "Cerrar", "Excel")
   *
   * Variantes semánticas (consistencia visual entre pantallas con la misma
   * acción): usar siempre las semánticas cuando aplique.
   * - `accion-sincronizar` — sincronizar (azul cielo)
   * - `accion-generar` — generar/calcular (violeta)
   * - `accion-procesar` — procesar pipeline / extraer (verde)
   * - `accion-importar` — importar desde fuente externa (índigo)
   * - `accion-exportar` — exportar a archivo (gris-azul)
   */
  variante?:
    | 'primario'
    | 'secundario'
    | 'fantasma'
    | 'peligro'
    | 'contorno'
    | 'accion-sincronizar'
    | 'accion-generar'
    | 'accion-procesar'
    | 'accion-importar'
    | 'accion-exportar'
  tamano?: 'sm' | 'md' | 'lg'
  cargando?: boolean
}

const Boton = forwardRef<HTMLButtonElement, BotonProps>(
  ({ className, variante = 'primario', tamano = 'md', cargando, children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variantes = {
      primario: 'bg-primario text-primario-texto hover:bg-primario-hover focus:ring-primario',
      secundario: 'bg-primario-light text-white hover:bg-primario-hover focus:ring-primario',
      fantasma: 'bg-transparent text-texto hover:bg-primario-muy-claro focus:ring-primario',
      peligro: 'bg-error text-white hover:bg-red-700 focus:ring-error',
      contorno:
        'border border-borde bg-surface text-texto hover:bg-fondo focus:ring-primario',
      // Variantes semánticas — colores fijos sin depender del tema del grupo,
      // para que la acción sea reconocible entre pantallas.
      'accion-sincronizar': 'bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500',
      'accion-generar': 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500',
      'accion-procesar': 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
      'accion-importar': 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
      'accion-exportar': 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500',
    }

    const tamanos = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || cargando}
        className={cn(base, variantes[variante], tamanos[tamano], className)}
        {...props}
      >
        {cargando && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Boton.displayName = 'Boton'

export { Boton }
