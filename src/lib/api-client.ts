/**
 * ApiClient — wrapper tipado sobre el `api` axios instance existente.
 *
 * No reemplaza a `lib/api.ts` (que tiene servicios específicos como
 * `auditoriaApi`, `documentosApi`, etc.) — lo COMPLEMENTA con un cliente
 * genérico tipado para llamadas ad-hoc.
 *
 * Beneficios:
 *   - Tipado fuerte del response (`apiClient.get<Foo>(...)`).
 *   - Manejo uniforme de errores axios → Error con mensaje legible.
 *   - Misma instancia de axios → hereda interceptores de auth, headers, etc.
 *
 * Ejemplo:
 *   const perfiles = await apiClient.get<Perfil[]>('/positions')
 *   await apiClient.post('/positions', { nombre_perfil: 'Director' })
 */

import axios from 'axios'
import api from './api'

class ApiClient {
  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    try {
      const res = await api.get<T>(path, { params })
      return res.data
    } catch (e) {
      throw this.toError(e)
    }
  }

  async post<T = unknown>(path: string, body?: any, params?: Record<string, any>): Promise<T> {
    try {
      const res = await api.post<T>(path, body, { params })
      return res.data
    } catch (e) {
      throw this.toError(e)
    }
  }

  async put<T = unknown>(path: string, body?: any, params?: Record<string, any>): Promise<T> {
    try {
      const res = await api.put<T>(path, body, { params })
      return res.data
    } catch (e) {
      throw this.toError(e)
    }
  }

  async patch<T = unknown>(path: string, body?: any, params?: Record<string, any>): Promise<T> {
    try {
      const res = await api.patch<T>(path, body, { params })
      return res.data
    } catch (e) {
      throw this.toError(e)
    }
  }

  async delete<T = void>(path: string, params?: Record<string, any>): Promise<T> {
    try {
      const res = await api.delete<T>(path, { params })
      return res.data
    } catch (e) {
      throw this.toError(e)
    }
  }

  private toError(e: unknown): Error {
    if (axios.isAxiosError(e)) {
      const detail = e.response?.data?.detail || e.response?.data?.message || e.message
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail)
      const err = new Error(msg)
      ;(err as any).status = e.response?.status
      ;(err as any).response = e.response
      return err
    }
    return e instanceof Error ? e : new Error(String(e))
  }
}

export const apiClient = new ApiClient()
export default apiClient
