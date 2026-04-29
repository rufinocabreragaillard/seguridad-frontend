/**
 * ErrorService — singleton para registrar errores frontend en el backend.
 *
 * Diseño cerrado 2026-04-28. Ver .claude/docs/PLAN_MANEJO_ERRORES.md.
 *
 * Uso:
 *   await ErrorService.instancia().reportar(error, { url_pantalla: '/documentos' })
 *
 * Retorna ErrorResponse con codigo_proceso para mostrar al usuario.
 */

import { obtenerToken } from './supabase'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ErrorResponse {
  mensaje_usuario: string
  sugerencia: string | null
  codigo_proceso: string
  error_tecnico: string | null
}

export interface ErrorContexto {
  url_pantalla?: string
  codigo_usuario?: string
  codigo_grupo?: string
  codigo_entidad?: string
  codigo_funcion?: string
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export class ErrorService {
  private static _instancia: ErrorService | null = null

  static instancia(): ErrorService {
    if (!ErrorService._instancia) {
      ErrorService._instancia = new ErrorService()
    }
    return ErrorService._instancia
  }

  /**
   * Reporta un error al backend y retorna el ErrorResponse con codigo_proceso.
   * Si no puede registrarlo, retorna una respuesta de fallback sin romper el flujo.
   */
  async reportar(
    error: unknown,
    contexto: ErrorContexto = {},
  ): Promise<ErrorResponse> {
    const mensaje = _extraerMensaje(error)
    const stack = error instanceof Error ? (error.stack || null) : null
    const url_pantalla = contexto.url_pantalla || (typeof window !== 'undefined' ? window.location.pathname : '')

    try {
      return await this._enviarABackend({
        mensaje,
        stack,
        url_pantalla,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        contexto_extra: {
          codigo_usuario: contexto.codigo_usuario,
          codigo_grupo: contexto.codigo_grupo,
          codigo_entidad: contexto.codigo_entidad,
          codigo_funcion: contexto.codigo_funcion,
        },
      })
    } catch {
      return {
        mensaje_usuario: 'Se produjo un error en la interfaz. Recargue la página o contacte al administrador.',
        sugerencia: null,
        codigo_proceso: 'ERR-SIN-REGISTRO',
        error_tecnico: mensaje,
      }
    }
  }

  private async _enviarABackend(payload: {
    mensaje: string
    stack: string | null
    url_pantalla: string
    user_agent: string | null
    contexto_extra?: Record<string, unknown>
  }): Promise<ErrorResponse> {
    const token = await obtenerToken()
    const r = await fetch(`${BASE_URL}/errores/registrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      throw new Error(`/errores/registrar retornó ${r.status}`)
    }
    return r.json() as Promise<ErrorResponse>
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _extraerMensaje(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Error desconocido'
  }
}
