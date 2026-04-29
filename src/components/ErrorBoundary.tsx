'use client'

/**
 * ErrorBoundary global — captura errores de React que burbujean hasta el layout admin.
 * Reporta automáticamente al backend via ErrorService y muestra un panel de fallback.
 */

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { ErrorService } from '@/lib/error-service'
import type { ErrorResponse } from '@/lib/error-service'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  respuesta: ErrorResponse | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, respuesta: null }
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const url_pantalla = typeof window !== 'undefined' ? window.location.pathname : ''
    ErrorService.instancia()
      .reportar(error, { url_pantalla })
      .then((respuesta) => {
        this.setState({ respuesta })
      })
      .catch(() => {
        this.setState({
          respuesta: {
            mensaje_usuario: 'Se produjo un error en la interfaz.',
            sugerencia: null,
            codigo_proceso: 'ERR-SIN-REGISTRO',
            error_tecnico: error.message,
          },
        })
      })

    console.error('[ErrorBoundary]', error, info)
  }

  private _recargar = () => {
    this.setState({ hasError: false, respuesta: null })
    window.location.reload()
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    const { respuesta } = this.state

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-texto-muted px-4">
        <AlertTriangle className="h-14 w-14 text-yellow-500" />
        <h2 className="page-heading text-center">
          {respuesta?.mensaje_usuario || 'Se produjo un error inesperado en la interfaz.'}
        </h2>
        {respuesta?.sugerencia && (
          <p className="text-sm text-center max-w-md">{respuesta.sugerencia}</p>
        )}
        {respuesta?.codigo_proceso && respuesta.codigo_proceso !== 'ERR-SIN-REGISTRO' && (
          <p className="text-xs text-texto-muted mt-1">
            Referencia de soporte:{' '}
            <span className="font-mono font-semibold">{respuesta.codigo_proceso}</span>
          </p>
        )}
        <button
          onClick={this._recargar}
          className="mt-4 px-4 py-2 text-sm bg-primario text-primario-texto rounded-md hover:bg-primario-hover transition-colors"
        >
          Recargar página
        </button>
      </div>
    )
  }
}
