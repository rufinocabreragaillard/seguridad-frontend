import axios, { AxiosError } from 'axios'
import { obtenerToken } from './supabase'
import type {
  UsuarioContexto,
  Usuario,
  CrearUsuarioRequest,
  Rol,
  Funcion,
  Entidad,
  Grupo,
  Area,
  ParametroGeneral,
  ParametroUsuario,
  RegistroAuditoria,
  CategoriaParametro,
  TipoParametro,
} from './tipos'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 })

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
    const detail = (error.response?.data as { detail?: unknown })?.detail
    let msg: string
    if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc, msg, type}, ...]
      msg = detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ')
    } else if (typeof detail === 'string') {
      msg = detail
    } else {
      msg = error.message || 'Error desconocido'
    }
    return Promise.reject(new Error(msg))
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  yo: () => api.get<UsuarioContexto>('/auth/me').then((r) => r.data),
  cerrarSesion: () => api.post('/auth/logout'),
  cambiarEntidad: (codigoEntidad: string) =>
    api.post<UsuarioContexto>('/auth/cambiar-entidad', { codigo_entidad: codigoEntidad }).then((r) => r.data),
  cambiarGrupo: (codigoGrupo: string) =>
    api.post<UsuarioContexto>('/auth/cambiar-grupo', { codigo_grupo: codigoGrupo }).then((r) => r.data),
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const usuariosApi = {
  listar: () => api.get<Usuario[]>('/usuarios').then((r) => r.data),
  obtener: (id: string) => api.get<Usuario>(`/usuarios/${id}`).then((r) => r.data),
  crear: (datos: CrearUsuarioRequest) => api.post<Usuario>('/usuarios', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Usuario>) =>
    api.put<Usuario>(`/usuarios/${id}`, datos).then((r) => r.data),
  desactivar: (id: string) => api.delete(`/usuarios/${id}`),
  listarRoles: (id: string) =>
    api.get<{ codigo_grupo: string; codigo_rol: string; roles: { nombre: string; activo: boolean } }[]>(
      `/usuarios/${id}/roles`
    ).then((r) => r.data),
  asignarRol: (id: string, codigoRol: string, codigoGrupo: string) =>
    api.post(`/usuarios/${id}/roles`, { codigo_rol: codigoRol, codigo_grupo: codigoGrupo }),
  quitarRol: (id: string, codigoRol: string) =>
    api.delete(`/usuarios/${id}/roles/${codigoRol}`),
  listarEntidades: (id: string) =>
    api.get<{ codigo_entidad: string; codigo_grupo: string; codigo_area?: string; entidades: { nombre: string; activo: boolean } }[]>(
      `/usuarios/${id}/entidades`
    ).then((r) => r.data),
  asignarEntidad: (id: string, codigoEntidad: string, codigoGrupo: string, codigoArea?: string) =>
    api.post(`/usuarios/${id}/entidades`, {
      codigo_entidad: codigoEntidad,
      codigo_grupo: codigoGrupo,
      ...(codigoArea ? { codigo_area: codigoArea } : {}),
    }),
  listarGrupos: (id: string) =>
    api.get<{ codigo_grupo: string; grupos_entidades: { nombre: string; activo: boolean } }[]>(
      `/usuarios/${id}/grupos`
    ).then((r) => r.data),
  quitarEntidad: (id: string, codigoEntidad: string) =>
    api.delete(`/usuarios/${id}/entidades/${codigoEntidad}`),
  asignarGrupo: (id: string, codigoGrupo: string) =>
    api.post(`/usuarios/${id}/grupos`, { codigo_grupo: codigoGrupo }),
  quitarGrupo: (id: string, codigoGrupo: string) =>
    api.delete(`/usuarios/${id}/grupos/${codigoGrupo}`),
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export const rolesApi = {
  listar: () => api.get<Rol[]>('/roles').then((r) => r.data),
  obtener: (id: string) => api.get<Rol>(`/roles/${id}`).then((r) => r.data),
  crear: (datos: Partial<Rol>) => api.post<Rol>('/roles', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Rol>) =>
    api.put<Rol>(`/roles/${id}`, datos).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/roles/${id}`),
  listarFunciones: (id: string) =>
    api.get<{ codigo_funcion: string; funciones: { nombre_funcion: string; activo: boolean } }[]>(
      `/roles/${id}/funciones`
    ).then((r) => r.data),
  asignarFuncion: (id: string, codigoFuncion: string) =>
    api.post(`/roles/${id}/funciones`, { codigo_funcion: codigoFuncion }),
  quitarFuncion: (id: string, codigoFuncion: string) =>
    api.delete(`/roles/${id}/funciones/${codigoFuncion}`),
}

// ─── Funciones ────────────────────────────────────────────────────────────────

export const funcionesApi = {
  listar: () => api.get<Funcion[]>('/funciones').then((r) => r.data),
  crear: (datos: Partial<Funcion>) =>
    api.post<Funcion>('/funciones', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Funcion>) =>
    api.put<Funcion>(`/funciones/${id}`, datos).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/funciones/${id}`),
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
  listarParametros: (idEntidad: string) =>
    api.get(`/entidades/${idEntidad}/parametros`).then((r) => r.data),
  upsertParametro: (idEntidad: string, datos: { categoria_parametro: string; tipo_parametro: string; valor_parametro: string }) =>
    api.put(`/entidades/${idEntidad}/parametros`, datos),
  eliminarParametro: (idEntidad: string, categoria: string, tipo: string) =>
    api.delete(`/entidades/${idEntidad}/parametros/${categoria}/${tipo}`),
}

// ─── Grupos de Entidades ──────────────────────────────────────────────────────

export const gruposApi = {
  listar: () => api.get<Grupo[]>('/grupos').then((r) => r.data),
  crear: (datos: Partial<Grupo>) => api.post<Grupo>('/grupos', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Grupo>) =>
    api.put<Grupo>(`/grupos/${id}`, datos).then((r) => r.data),
  desactivar: (id: string) => api.delete(`/grupos/${id}`),
  listarEntidades: (id: string) =>
    api.get<Entidad[]>(`/grupos/${id}/entidades`).then((r) => r.data),
  listarParametros: (id: string) =>
    api.get(`/grupos/${id}/parametros`).then((r) => r.data),
  upsertParametro: (id: string, datos: { categoria_parametro: string; tipo_parametro: string; valor_parametro: string }) =>
    api.put(`/grupos/${id}/parametros`, datos),
  listarUsuarios: (id: string) =>
    api.get(`/grupos/${id}/usuarios`).then((r) => r.data),
  quitarUsuario: (id: string, codigoUsuario: string) =>
    api.delete(`/grupos/${id}/usuarios/${codigoUsuario}`),
}

// ─── Parámetros ───────────────────────────────────────────────────────────────

export const parametrosApi = {
  listarGenerales: () =>
    api.get<ParametroGeneral[]>('/parametros/generales').then((r) => r.data),
  actualizarGeneral: (codigo: string, valor: string) =>
    api.put(`/parametros/generales/${codigo}`, { valor }),
  upsertGenerales: (datos: { categoria_parametro: string; tipo_parametro: string; valor_parametro: string }) =>
    api.put('/parametros/generales', datos),
  eliminarGeneral: (categoria: string, tipo: string) =>
    api.delete(`/parametros/generales/${categoria}/${tipo}`),
  listarGrupo: () =>
    api.get('/parametros/grupo').then((r) => r.data),
  upsertGrupo: (datos: { categoria_parametro: string; tipo_parametro: string; valor_parametro: string }) =>
    api.put('/parametros/grupo', datos),
  eliminarGrupo: (categoria: string, tipo: string) =>
    api.delete(`/parametros/grupo/${categoria}/${tipo}`),
  listarUsuario: () =>
    api.get<ParametroUsuario[]>('/parametros/usuario').then((r) => r.data),
  actualizarUsuario: (codigo: string, valor: string) =>
    api.put(`/parametros/usuario/${codigo}`, { valor }),
  upsertUsuario: (datos: { categoria_parametro: string; tipo_parametro: string; valor_parametro: string }) =>
    api.put('/parametros/usuario', datos),
  eliminarUsuario: (categoria: string, tipo: string) =>
    api.delete(`/parametros/usuario/${categoria}/${tipo}`),
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

export const auditoriaApi = {
  listar: (params?: { pagina?: number; por_pagina?: number }) =>
    api.get<RegistroAuditoria[]>('/auditoria', { params }).then((r) => r.data),
}

// ─── Datos Básicos ────────────────────────────────────────────────────────────

export const datosBasicosApi = {
  listarCategorias: () =>
    api.get<CategoriaParametro[]>('/datos-basicos/categorias').then((r) => r.data),
  crearCategoria: (datos: Partial<CategoriaParametro>) =>
    api.post<CategoriaParametro>('/datos-basicos/categorias', datos).then((r) => r.data),
  actualizarCategoria: (categoria: string, datos: Partial<CategoriaParametro>) =>
    api.put<CategoriaParametro>(`/datos-basicos/categorias/${categoria}`, datos).then((r) => r.data),
  eliminarCategoria: (categoria: string) =>
    api.delete(`/datos-basicos/categorias/${categoria}`),

  listarTipos: (categoria?: string) =>
    api.get<TipoParametro[]>('/datos-basicos/tipos', { params: categoria ? { categoria } : {} }).then((r) => r.data),
  crearTipo: (datos: Partial<TipoParametro>) =>
    api.post<TipoParametro>('/datos-basicos/tipos', datos).then((r) => r.data),
  actualizarTipo: (categoria: string, tipo: string, datos: Partial<TipoParametro>) =>
    api.put<TipoParametro>(`/datos-basicos/tipos/${categoria}/${tipo}`, datos).then((r) => r.data),
  eliminarTipo: (categoria: string, tipo: string) =>
    api.delete(`/datos-basicos/tipos/${categoria}/${tipo}`),
}

export default api
