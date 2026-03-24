import axios, { AxiosError } from 'axios'
import { obtenerToken } from './supabase'
import type {
  UsuarioContexto,
  Usuario,
  CrearUsuarioRequest,
  Rol,
  Funcion,
  Entidad,
  Area,
  ParametroGeneral,
  ParametroUsuario,
  RegistroAuditoria,
} from './tipos'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL })

// Interceptor: agrega el token JWT de Supabase en cada request
api.interceptors.request.use(async (config) => {
  const token = await obtenerToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Interceptor: manejo uniforme de errores
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const msg =
      (error.response?.data as { detail?: string })?.detail ||
      error.message ||
      'Error desconocido'
    return Promise.reject(new Error(msg))
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  yo: () => api.get<UsuarioContexto>('/auth/me').then((r) => r.data),
  cerrarSesion: () => api.post('/auth/logout'),
  cambiarEntidad: (codigoEntidad: string) =>
    api.post<UsuarioContexto>('/auth/cambiar-entidad', { codigo_entidad: codigoEntidad }).then((r) => r.data),
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const usuariosApi = {
  listar: () => api.get<Usuario[]>('/usuarios').then((r) => r.data),
  obtener: (id: string) => api.get<Usuario>(`/usuarios/${id}`).then((r) => r.data),
  crear: (datos: CrearUsuarioRequest) => api.post<Usuario>('/usuarios', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Usuario>) =>
    api.put<Usuario>(`/usuarios/${id}`, datos).then((r) => r.data),
  desactivar: (id: string) => api.delete(`/usuarios/${id}`),
  asignarRol: (id: string, codigoRol: string) =>
    api.post(`/usuarios/${id}/roles`, { codigo_rol: codigoRol }),
  quitarRol: (id: string, codigoRol: string) =>
    api.delete(`/usuarios/${id}/roles/${codigoRol}`),
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export const rolesApi = {
  listar: () => api.get<Rol[]>('/roles').then((r) => r.data),
  obtener: (id: string) => api.get<Rol>(`/roles/${id}`).then((r) => r.data),
  crear: (datos: Partial<Rol>) => api.post<Rol>('/roles', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Rol>) =>
    api.put<Rol>(`/roles/${id}`, datos).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/roles/${id}`),
  asignarFuncion: (id: string, codigoFuncion: string) =>
    api.post(`/roles/${id}/funciones`, { codigo_funcion: codigoFuncion }),
  quitarFuncion: (id: string, codigoFuncion: string) =>
    api.delete(`/roles/${id}/funciones/${codigoFuncion}`),
}

// ─── Funciones ────────────────────────────────────────────────────────────────

export const funcionesApi = {
  listar: () => api.get<Funcion[]>('/roles/funciones').then((r) => r.data),
  crear: (datos: Partial<Funcion>) =>
    api.post<Funcion>('/roles/funciones', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Funcion>) =>
    api.put<Funcion>(`/roles/funciones/${id}`, datos).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/roles/funciones/${id}`),
}

// ─── Entidades ────────────────────────────────────────────────────────────────

export const entidadesApi = {
  listar: () => api.get<Entidad[]>('/entidades').then((r) => r.data),
  obtener: (id: string) => api.get<Entidad>(`/entidades/${id}`).then((r) => r.data),
  crear: (datos: Partial<Entidad>) => api.post<Entidad>('/entidades', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Entidad>) =>
    api.put<Entidad>(`/entidades/${id}`, datos).then((r) => r.data),
  listarAreas: (idEntidad: string) =>
    api.get<Area[]>(`/entidades/${idEntidad}/areas`).then((r) => r.data),
  crearArea: (idEntidad: string, datos: Partial<Area>) =>
    api.post<Area>(`/entidades/${idEntidad}/areas`, datos).then((r) => r.data),
}

// ─── Parámetros ───────────────────────────────────────────────────────────────

export const parametrosApi = {
  listarGenerales: () =>
    api.get<ParametroGeneral[]>('/parametros/generales').then((r) => r.data),
  actualizarGeneral: (codigo: string, valor: string) =>
    api.put(`/parametros/generales/${codigo}`, { valor }),
  listarUsuario: () =>
    api.get<ParametroUsuario[]>('/parametros/usuario').then((r) => r.data),
  actualizarUsuario: (codigo: string, valor: string) =>
    api.put(`/parametros/usuario/${codigo}`, { valor }),
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

export const auditoriaApi = {
  listar: (params?: { pagina?: number; por_pagina?: number }) =>
    api.get<RegistroAuditoria[]>('/auditoria', { params }).then((r) => r.data),
}

export default api
