import axios, { AxiosError } from 'axios'
import { obtenerToken } from './supabase'
import type { RolMenu } from './tipos'
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
  Aplicacion,
  Documento,
  TipoDocumentoPersona,
  Persona,
  CategoriaCaractPers,
  TipoCaractPers,
  CaracteristicaPersona,
  CategoriaConCaracteristicas,
  RolCaractPers,
  CategoriaCaractDocs,
  TipoCaractDocs,
  CaracteristicaDocumento,
  CategoriaConCaracteristicasDocs,
  RolCaractDocs,
  CategoriaCaractGeneDocs,
  TipoCaractGeneDocs,
  CaracteristicaGeneDocumento,
  CategoriaConCaracteristicasGeneDocs,
  EstadoCanonicoConversacion,
  EstadoCanonicoCompromiso,
  TipoConversacion,
  TipoCompromiso,
  EstadoConversacion,
  EstadoCompromiso,
  Conversacion,
  ParticipanteConversacion,
  Compromiso,
  UbicacionDoc,
  EstadoDoc,
  ColaEstadoDoc,
} from './tipos'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 })

// ── Mapa URL → codigo_funcion (para auditoría) ──────────────────────────────
let _urlToFuncion: Record<string, string> = {}

/**
 * Actualiza el mapa de URL→codigo_funcion desde el menú dinámico del usuario.
 * Se llama desde AuthContext cada vez que cambia el usuario/grupo/entidad.
 */
export function actualizarMapaFunciones(menu?: RolMenu[]) {
  const mapa: Record<string, string> = {}
  if (menu) {
    for (const rol of menu) {
      for (const fn of rol.funciones) {
        if (fn.url) mapa[fn.url] = fn.codigo_funcion
      }
    }
  }
  _urlToFuncion = mapa
}

/**
 * Resuelve el pathname actual al codigo_funcion correspondiente.
 * Busca coincidencia exacta primero, luego por prefijo (para sub-rutas).
 */
function resolverFuncion(): string | null {
  if (typeof window === 'undefined') return null
  const path = window.location.pathname
  // Coincidencia exacta
  if (_urlToFuncion[path]) return _urlToFuncion[path]
  // Coincidencia por prefijo (ej: /entidades/editar → /entidades)
  for (const url of Object.keys(_urlToFuncion)) {
    if (path.startsWith(url + '/')) return _urlToFuncion[url]
  }
  return null
}

// ── Overrides de sesión (grupo/entidad/app) persistidos en localStorage ─────
const OVERRIDE_KEYS = {
  grupo: 'cab_override_grupo',
  entidad: 'cab_override_entidad',
  aplicacion: 'cab_override_aplicacion',
} as const

export function setOverrideSesion(tipo: 'grupo' | 'entidad' | 'aplicacion', valor: string | null) {
  if (typeof window === 'undefined') return
  if (valor) {
    localStorage.setItem(OVERRIDE_KEYS[tipo], valor)
  } else {
    localStorage.removeItem(OVERRIDE_KEYS[tipo])
  }
}

export function clearOverridesSesion() {
  if (typeof window === 'undefined') return
  Object.values(OVERRIDE_KEYS).forEach((k) => localStorage.removeItem(k))
}

// Interceptor: agrega el token JWT de Supabase, codigo_funcion y overrides en cada request
api.interceptors.request.use(async (config) => {
  const token = await obtenerToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const funcion = resolverFuncion()
  if (funcion) config.headers['X-Codigo-Funcion'] = funcion
  // Enviar overrides de sesión como headers
  if (typeof window !== 'undefined') {
    const og = localStorage.getItem(OVERRIDE_KEYS.grupo)
    const oe = localStorage.getItem(OVERRIDE_KEYS.entidad)
    const oa = localStorage.getItem(OVERRIDE_KEYS.aplicacion)
    if (og) config.headers['X-Override-Grupo'] = og
    if (oe) config.headers['X-Override-Entidad'] = oe
    if (oa) config.headers['X-Override-Aplicacion'] = oa
  }
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
  cambiarAplicacion: (codigoAplicacion: string) =>
    api.post<UsuarioContexto>('/auth/cambiar-aplicacion', { codigo_aplicacion: codigoAplicacion }).then((r) => r.data),
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
    api.get<{ codigo_grupo: string; codigo_rol: string; orden: number; roles: { nombre: string; activo: boolean } }[]>(
      `/usuarios/${id}/roles`
    ).then((r) => r.data),
  asignarRol: (id: string, codigoRol: string, codigoGrupo: string) =>
    api.post(`/usuarios/${id}/roles`, { codigo_rol: codigoRol, codigo_grupo: codigoGrupo }),
  reordenarRoles: (id: string, orden: { codigo_grupo: string; codigo_rol: string; orden: number }[]) =>
    api.put(`/usuarios/${id}/roles/orden`, orden),
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
    api.get<{ codigo_funcion: string; orden: number; funciones: { nombre_funcion: string; activo: boolean } }[]>(
      `/roles/${id}/funciones`
    ).then((r) => r.data),
  asignarFuncion: (id: string, codigoFuncion: string) =>
    api.post(`/roles/${id}/funciones`, { codigo_funcion: codigoFuncion }),
  reordenarFunciones: (id: string, orden: { codigo_funcion: string; orden: number }[]) =>
    api.put(`/roles/${id}/funciones/orden`, orden),
  quitarFuncion: (id: string, codigoFuncion: string) =>
    api.delete(`/roles/${id}/funciones/${codigoFuncion}`),
  listarPorGrupo: (codigoGrupo: string) =>
    api.get<Rol[]>('/roles', { params: { codigo_grupo: codigoGrupo } }).then((r) => r.data),
  copiar: (datos: { codigo_grupo_origen: string; codigo_rol: string; codigo_grupo_destino: string }) =>
    api.post<Rol>('/roles/copiar', datos).then((r) => r.data),
}

// ─── Funciones ────────────────────────────────────────────────────────────────

export const funcionesApi = {
  listar: (grupo?: string) =>
    api.get<Funcion[]>('/funciones', { params: grupo ? { grupo } : {} }).then((r) => r.data),
  crear: (datos: Partial<Funcion>) =>
    api.post<Funcion>('/funciones', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Funcion>) =>
    api.put<Funcion>(`/funciones/${id}`, datos).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/funciones/${id}`),
  listarAplicaciones: (id: string) =>
    api.get<{ codigo_aplicacion: string; aplicaciones: { nombre_aplicacion: string; activo: boolean } }[]>(
      `/funciones/${id}/aplicaciones`
    ).then((r) => r.data),
  asignarAplicacion: (id: string, codigoApp: string) =>
    api.post(`/funciones/${id}/aplicaciones`, { codigo_aplicacion: codigoApp }),
  quitarAplicacion: (id: string, codigoApp: string) =>
    api.delete(`/funciones/${id}/aplicaciones/${codigoApp}`),
}

// ─── Aplicaciones ─────────────────────────────────────────────────────────────

export const aplicacionesApi = {
  listar: (codigoGrupo?: string) =>
    api.get<Aplicacion[]>('/aplicaciones', { params: codigoGrupo ? { codigo_grupo: codigoGrupo } : {} }).then((r) => r.data),
  crear: (datos: Partial<Aplicacion>) => api.post<Aplicacion>('/aplicaciones', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Aplicacion>) =>
    api.put<Aplicacion>(`/aplicaciones/${id}`, datos).then((r) => r.data),
  desactivar: (id: string) => api.delete(`/aplicaciones/${id}`),
  listarFunciones: (id: string) =>
    api.get<{ codigo_funcion: string; funciones: { nombre_funcion: string; activo: boolean } }[]>(
      `/aplicaciones/${id}/funciones`
    ).then((r) => r.data),
  asignarFuncion: (id: string, codigoFuncion: string) =>
    api.post(`/aplicaciones/${id}/funciones`, { codigo_funcion: codigoFuncion }),
  quitarFuncion: (id: string, codigoFuncion: string) =>
    api.delete(`/aplicaciones/${id}/funciones/${codigoFuncion}`),
  listarGrupos: (id: string) =>
    api.get<{ codigo_grupo: string; activo: boolean; grupos_entidades: { nombre_grupo: string } }[]>(
      `/aplicaciones/${id}/grupos`
    ).then((r) => r.data),
  asignarGrupo: (id: string, codigoGrupo: string) =>
    api.post(`/aplicaciones/${id}/grupos`, { codigo_grupo: codigoGrupo }),
  quitarGrupo: (id: string, codigoGrupo: string) =>
    api.delete(`/aplicaciones/${id}/grupos/${codigoGrupo}`),
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
  desactivar: (id: string) => api.delete(`/entidades/${id}`),
  listarUsuarios: (id: string, codigoGrupo?: string) =>
    api.get<{ codigo_usuario: string; usuarios: { nombre_usuario: string; activo: boolean } }[]>(
      `/entidades/${id}/usuarios`, { params: codigoGrupo ? { codigo_grupo: codigoGrupo } : {} }
    ).then((r) => r.data),
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
  listar: (params?: { tipo?: string; pagina?: number; por_pagina?: number }) =>
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

// ─── Documentos ──────────────────────────────────────────────────────────────

export const documentosApi = {
  listar: () => api.get<Documento[]>('/documentos').then((r) => r.data),
  crear: (datos: Partial<Documento>) =>
    api.post<Documento>('/documentos', datos).then((r) => r.data),
  actualizar: (id: number, datos: Partial<Documento>) =>
    api.put<Documento>(`/documentos/${id}`, datos).then((r) => r.data),
  desactivar: (id: number) => api.delete(`/documentos/${id}`),
  // Características
  listarCaracteristicas: (id: number) =>
    api.get<CategoriaConCaracteristicasDocs[]>(`/documentos/${id}/caracteristicas`).then((r) => r.data),
  crearCaracteristica: (id: number, datos: Partial<CaracteristicaDocumento>) =>
    api.post<CaracteristicaDocumento>(`/documentos/${id}/caracteristicas`, datos).then((r) => r.data),
  actualizarCaracteristica: (id: number, idCar: number, datos: Partial<CaracteristicaDocumento>) =>
    api.put<CaracteristicaDocumento>(`/documentos/${id}/caracteristicas/${idCar}`, datos).then((r) => r.data),
  eliminarCaracteristica: (id: number, idCar: number) =>
    api.delete(`/documentos/${id}/caracteristicas/${idCar}`),
  // Características genéricas
  listarCaracteristicasGenericas: (id: number) =>
    api.get<CategoriaConCaracteristicasGeneDocs[]>(`/documentos/${id}/caracteristicas-genericas`).then((r) => r.data),
  crearCaracteristicaGenerica: (id: number, datos: Partial<CaracteristicaGeneDocumento>) =>
    api.post<CaracteristicaGeneDocumento>(`/documentos/${id}/caracteristicas-genericas`, datos).then((r) => r.data),
  actualizarCaracteristicaGenerica: (id: number, idCar: number, datos: Partial<CaracteristicaGeneDocumento>) =>
    api.put<CaracteristicaGeneDocumento>(`/documentos/${id}/caracteristicas-genericas/${idCar}`, datos).then((r) => r.data),
  eliminarCaracteristicaGenerica: (id: number, idCar: number) =>
    api.delete(`/documentos/${id}/caracteristicas-genericas/${idCar}`),
}

// ─── Tipos Documento Persona ─────────────────────────────────────────────────

export const tiposDocumentoPersonaApi = {
  listar: () => api.get<TipoDocumentoPersona[]>('/tipos-documento-persona').then((r) => r.data),
  crear: (datos: Partial<TipoDocumentoPersona>) =>
    api.post<TipoDocumentoPersona>('/tipos-documento-persona', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<TipoDocumentoPersona>) =>
    api.put<TipoDocumentoPersona>(`/tipos-documento-persona/${codigo}`, datos).then((r) => r.data),
  desactivar: (codigo: string) => api.delete(`/tipos-documento-persona/${codigo}`),
}

// ─── Categorías Características Persona ─────────────────────────────────────

export const categoriasCaractPersApi = {
  listar: () => api.get<CategoriaCaractPers[]>('/categorias-caracteristica').then((r) => r.data),
  crear: (datos: Partial<CategoriaCaractPers>) =>
    api.post<CategoriaCaractPers>('/categorias-caracteristica', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<CategoriaCaractPers>) =>
    api.put<CategoriaCaractPers>(`/categorias-caracteristica/${codigo}`, datos).then((r) => r.data),
  desactivar: (codigo: string) => api.delete(`/categorias-caracteristica/${codigo}`),
  // Tipos
  listarTipos: (codigo: string) =>
    api.get<TipoCaractPers[]>(`/categorias-caracteristica/${codigo}/tipos`).then((r) => r.data),
  crearTipo: (codigo: string, datos: Partial<TipoCaractPers>) =>
    api.post<TipoCaractPers>(`/categorias-caracteristica/${codigo}/tipos`, datos).then((r) => r.data),
  actualizarTipo: (codigo: string, codigoTipo: string, datos: Partial<TipoCaractPers>) =>
    api.put<TipoCaractPers>(`/categorias-caracteristica/${codigo}/tipos/${codigoTipo}`, datos).then((r) => r.data),
  desactivarTipo: (codigo: string, codigoTipo: string) =>
    api.delete(`/categorias-caracteristica/${codigo}/tipos/${codigoTipo}`),
  // Roles
  listarRoles: (codigo: string) =>
    api.get<RolCaractPers[]>(`/categorias-caracteristica/${codigo}/roles`).then((r) => r.data),
  asignarRol: (codigo: string, codigoRol: string) =>
    api.post(`/categorias-caracteristica/${codigo}/roles`, { codigo_rol: codigoRol }),
  reordenarRoles: (codigo: string, orden: { codigo_rol: string; orden: number }[]) =>
    api.put(`/categorias-caracteristica/${codigo}/roles/orden`, orden),
  quitarRol: (codigo: string, codigoRol: string) =>
    api.delete(`/categorias-caracteristica/${codigo}/roles/${codigoRol}`),
}

// ─── Categorías Características Documentos ──────────────────────────────────

export const categoriasCaractDocsApi = {
  listar: () => api.get<CategoriaCaractDocs[]>('/categorias-caracteristica-docs').then((r) => r.data),
  crear: (datos: Partial<CategoriaCaractDocs>) =>
    api.post<CategoriaCaractDocs>('/categorias-caracteristica-docs', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<CategoriaCaractDocs>) =>
    api.put<CategoriaCaractDocs>(`/categorias-caracteristica-docs/${codigo}`, datos).then((r) => r.data),
  desactivar: (codigo: string) => api.delete(`/categorias-caracteristica-docs/${codigo}`),
  // Tipos
  listarTipos: (codigo: string) =>
    api.get<TipoCaractDocs[]>(`/categorias-caracteristica-docs/${codigo}/tipos`).then((r) => r.data),
  crearTipo: (codigo: string, datos: Partial<TipoCaractDocs>) =>
    api.post<TipoCaractDocs>(`/categorias-caracteristica-docs/${codigo}/tipos`, datos).then((r) => r.data),
  actualizarTipo: (codigo: string, codigoTipo: string, datos: Partial<TipoCaractDocs>) =>
    api.put<TipoCaractDocs>(`/categorias-caracteristica-docs/${codigo}/tipos/${codigoTipo}`, datos).then((r) => r.data),
  desactivarTipo: (codigo: string, codigoTipo: string) =>
    api.delete(`/categorias-caracteristica-docs/${codigo}/tipos/${codigoTipo}`),
  // Roles
  listarRoles: (codigo: string) =>
    api.get<RolCaractDocs[]>(`/categorias-caracteristica-docs/${codigo}/roles`).then((r) => r.data),
  asignarRol: (codigo: string, codigoRol: string) =>
    api.post(`/categorias-caracteristica-docs/${codigo}/roles`, { codigo_rol: codigoRol }),
  reordenarRoles: (codigo: string, orden: { codigo_rol: string; orden: number }[]) =>
    api.put(`/categorias-caracteristica-docs/${codigo}/roles/orden`, orden),
  quitarRol: (codigo: string, codigoRol: string) =>
    api.delete(`/categorias-caracteristica-docs/${codigo}/roles/${codigoRol}`),
}

// ─── Categorías Genéricas Características Documentos ─────────────────────────

export const categoriasCaractGeneDocsApi = {
  listar: () => api.get<CategoriaCaractGeneDocs[]>('/categorias-caracteristica-gene-docs').then((r) => r.data),
  crear: (datos: Partial<CategoriaCaractGeneDocs>) =>
    api.post<CategoriaCaractGeneDocs>('/categorias-caracteristica-gene-docs', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<CategoriaCaractGeneDocs>) =>
    api.put<CategoriaCaractGeneDocs>(`/categorias-caracteristica-gene-docs/${codigo}`, datos).then((r) => r.data),
  desactivar: (codigo: string) => api.delete(`/categorias-caracteristica-gene-docs/${codigo}`),
  // Tipos
  listarTipos: (codigo: string) =>
    api.get<TipoCaractGeneDocs[]>(`/categorias-caracteristica-gene-docs/${codigo}/tipos`).then((r) => r.data),
  crearTipo: (codigo: string, datos: Partial<TipoCaractGeneDocs>) =>
    api.post<TipoCaractGeneDocs>(`/categorias-caracteristica-gene-docs/${codigo}/tipos`, datos).then((r) => r.data),
  actualizarTipo: (codigo: string, codigoTipo: string, datos: Partial<TipoCaractGeneDocs>) =>
    api.put<TipoCaractGeneDocs>(`/categorias-caracteristica-gene-docs/${codigo}/tipos/${codigoTipo}`, datos).then((r) => r.data),
  desactivarTipo: (codigo: string, codigoTipo: string) =>
    api.delete(`/categorias-caracteristica-gene-docs/${codigo}/tipos/${codigoTipo}`),
}

// ─── Personas ────────────────────────────────────────────────────────────────

export const personasApi = {
  listar: (search?: string) =>
    api.get<Persona[]>('/personas', { params: search ? { search } : {} }).then((r) => r.data),
  crear: (datos: Partial<Persona>) =>
    api.post<Persona>('/personas', datos).then((r) => r.data),
  actualizar: (id: number, datos: Partial<Persona>) =>
    api.put<Persona>(`/personas/${id}`, datos).then((r) => r.data),
  desactivar: (id: number) => api.delete(`/personas/${id}`),
  // Características
  listarCaracteristicas: (id: number) =>
    api.get<CategoriaConCaracteristicas[]>(`/personas/${id}/caracteristicas`).then((r) => r.data),
  crearCaracteristica: (id: number, datos: Partial<CaracteristicaPersona>) =>
    api.post<CaracteristicaPersona>(`/personas/${id}/caracteristicas`, datos).then((r) => r.data),
  actualizarCaracteristica: (id: number, idCar: number, datos: Partial<CaracteristicaPersona>) =>
    api.put<CaracteristicaPersona>(`/personas/${id}/caracteristicas/${idCar}`, datos).then((r) => r.data),
  eliminarCaracteristica: (id: number, idCar: number) =>
    api.delete(`/personas/${id}/caracteristicas/${idCar}`),
}

// ─── Compromisos: Datos Básicos ──────────────────────────────────────────────

export const compromisosDatosBasicosApi = {
  // Canónicos conversación
  listarCanonicosCnv: () =>
    api.get<EstadoCanonicoConversacion[]>('/compromisos-datos-basicos/canonicos-conversacion').then((r) => r.data),
  crearCanonicosCnv: (datos: Partial<EstadoCanonicoConversacion>) =>
    api.post('/compromisos-datos-basicos/canonicos-conversacion', datos).then((r) => r.data),
  actualizarCanonicosCnv: (codigo: string, datos: Partial<EstadoCanonicoConversacion>) =>
    api.put(`/compromisos-datos-basicos/canonicos-conversacion/${codigo}`, datos).then((r) => r.data),
  eliminarCanonicosCnv: (codigo: string) =>
    api.delete(`/compromisos-datos-basicos/canonicos-conversacion/${codigo}`),

  // Canónicos compromiso
  listarCanonicosCmp: () =>
    api.get<EstadoCanonicoCompromiso[]>('/compromisos-datos-basicos/canonicos-compromiso').then((r) => r.data),
  crearCanonicosCmp: (datos: Partial<EstadoCanonicoCompromiso>) =>
    api.post('/compromisos-datos-basicos/canonicos-compromiso', datos).then((r) => r.data),
  actualizarCanonicosCmp: (codigo: string, datos: Partial<EstadoCanonicoCompromiso>) =>
    api.put(`/compromisos-datos-basicos/canonicos-compromiso/${codigo}`, datos).then((r) => r.data),
  eliminarCanonicosCmp: (codigo: string) =>
    api.delete(`/compromisos-datos-basicos/canonicos-compromiso/${codigo}`),

  // Tipos conversación
  listarTiposCnv: () =>
    api.get<TipoConversacion[]>('/compromisos-datos-basicos/tipos-conversacion').then((r) => r.data),
  crearTipoCnv: (datos: Partial<TipoConversacion>) =>
    api.post('/compromisos-datos-basicos/tipos-conversacion', datos).then((r) => r.data),
  actualizarTipoCnv: (codigo: string, datos: Partial<TipoConversacion>) =>
    api.put(`/compromisos-datos-basicos/tipos-conversacion/${codigo}`, datos).then((r) => r.data),
  eliminarTipoCnv: (codigo: string) =>
    api.delete(`/compromisos-datos-basicos/tipos-conversacion/${codigo}`),

  // Tipos compromiso
  listarTiposCmp: () =>
    api.get<TipoCompromiso[]>('/compromisos-datos-basicos/tipos-compromiso').then((r) => r.data),
  crearTipoCmp: (datos: Partial<TipoCompromiso>) =>
    api.post('/compromisos-datos-basicos/tipos-compromiso', datos).then((r) => r.data),
  actualizarTipoCmp: (codigo: string, datos: Partial<TipoCompromiso>) =>
    api.put(`/compromisos-datos-basicos/tipos-compromiso/${codigo}`, datos).then((r) => r.data),
  eliminarTipoCmp: (codigo: string) =>
    api.delete(`/compromisos-datos-basicos/tipos-compromiso/${codigo}`),

  // Estados conversación
  listarEstadosCnv: (tipo?: string) =>
    api.get<EstadoConversacion[]>('/compromisos-datos-basicos/estados-conversacion', { params: tipo ? { tipo } : {} }).then((r) => r.data),
  crearEstadoCnv: (datos: Partial<EstadoConversacion>) =>
    api.post('/compromisos-datos-basicos/estados-conversacion', datos).then((r) => r.data),
  actualizarEstadoCnv: (tipo: string, codigo: string, datos: Partial<EstadoConversacion>) =>
    api.put(`/compromisos-datos-basicos/estados-conversacion/${tipo}/${codigo}`, datos).then((r) => r.data),
  eliminarEstadoCnv: (tipo: string, codigo: string) =>
    api.delete(`/compromisos-datos-basicos/estados-conversacion/${tipo}/${codigo}`),

  // Estados compromiso
  listarEstadosCmp: (tipo?: string) =>
    api.get<EstadoCompromiso[]>('/compromisos-datos-basicos/estados-compromiso', { params: tipo ? { tipo } : {} }).then((r) => r.data),
  crearEstadoCmp: (datos: Partial<EstadoCompromiso>) =>
    api.post('/compromisos-datos-basicos/estados-compromiso', datos).then((r) => r.data),
  actualizarEstadoCmp: (tipo: string, codigo: string, datos: Partial<EstadoCompromiso>) =>
    api.put(`/compromisos-datos-basicos/estados-compromiso/${tipo}/${codigo}`, datos).then((r) => r.data),
  eliminarEstadoCmp: (tipo: string, codigo: string) =>
    api.delete(`/compromisos-datos-basicos/estados-compromiso/${tipo}/${codigo}`),
}

// ─── Compromisos: Operación ──────────────────────────────────────────────────

export const compromisosApi = {
  // Conversaciones
  listarConversaciones: (params?: { tipo?: string; estado?: string }) =>
    api.get<Conversacion[]>('/compromisos/conversaciones', { params }).then((r) => r.data),
  obtenerConversacion: (id: number) =>
    api.get<Conversacion>(`/compromisos/conversaciones/${id}`).then((r) => r.data),
  crearConversacion: (datos: Partial<Conversacion>) =>
    api.post('/compromisos/conversaciones', datos).then((r) => r.data),
  actualizarConversacion: (id: number, datos: Partial<Conversacion>) =>
    api.put(`/compromisos/conversaciones/${id}`, datos).then((r) => r.data),
  eliminarConversacion: (id: number) =>
    api.delete(`/compromisos/conversaciones/${id}`),

  // Participantes
  listarParticipantes: (idConv: number) =>
    api.get<ParticipanteConversacion[]>(`/compromisos/conversaciones/${idConv}/participantes`).then((r) => r.data),
  agregarParticipante: (idConv: number, datos: Partial<ParticipanteConversacion>) =>
    api.post(`/compromisos/conversaciones/${idConv}/participantes`, datos).then((r) => r.data),
  eliminarParticipante: (idConv: number, idPart: number) =>
    api.delete(`/compromisos/conversaciones/${idConv}/participantes/${idPart}`),

  // Compromisos
  listarCompromisos: (params?: { tipo?: string; estado?: string; prioridad?: string; conversacion?: number }) =>
    api.get<Compromiso[]>('/compromisos/compromisos-lista', { params }).then((r) => r.data),
  obtenerCompromiso: (id: number) =>
    api.get<Compromiso>(`/compromisos/compromisos-lista/${id}`).then((r) => r.data),
  crearCompromiso: (datos: Partial<Compromiso>) =>
    api.post('/compromisos/compromisos-lista', datos).then((r) => r.data),
  actualizarCompromiso: (id: number, datos: Partial<Compromiso>) =>
    api.put(`/compromisos/compromisos-lista/${id}`, datos).then((r) => r.data),
  eliminarCompromiso: (id: number) =>
    api.delete(`/compromisos/compromisos-lista/${id}`),
}

// ─── Estados Docs ──────────────────────────────────────────────────────────

export const estadosDocsApi = {
  listar: () => api.get<EstadoDoc[]>('/estados-docs').then((r) => r.data),
  crear: (datos: Partial<EstadoDoc>) =>
    api.post<EstadoDoc>('/estados-docs', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<EstadoDoc>) =>
    api.put<EstadoDoc>(`/estados-docs/${codigo}`, datos).then((r) => r.data),
  desactivar: (codigo: string) => api.delete(`/estados-docs/${codigo}`),
}

// ─── Cola Estados Docs ─────────────────────────────────────────────────────

export const colaEstadosDocsApi = {
  listar: (estadoCola?: string) =>
    api.get<ColaEstadoDoc[]>('/cola-estados-docs', { params: estadoCola ? { estado_cola: estadoCola } : undefined }).then((r) => r.data),
  inicializar: (items: { codigo_documento: number; codigo_estado_doc_destino: string; prioridad?: number }[]) =>
    api.post<{ encolados: number; omitidos: number; total: number }>('/cola-estados-docs/inicializar', { items }).then((r) => r.data),
  cerrar: () =>
    api.post<{ eliminados: number }>('/cola-estados-docs/cerrar').then((r) => r.data),
  eliminar: (id: number) => api.delete(`/cola-estados-docs/${id}`),
}

// ─── Ubicaciones Docs ──────────────────────────────────────────────────────

export const ubicacionesDocsApi = {
  listar: (codigoEntidad?: string) =>
    api.get<UbicacionDoc[]>('/ubicaciones-docs', { params: codigoEntidad ? { codigo_entidad: codigoEntidad } : undefined }).then((r) => r.data),
  crear: (datos: Partial<UbicacionDoc>) =>
    api.post<UbicacionDoc>('/ubicaciones-docs', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<UbicacionDoc>) =>
    api.put<UbicacionDoc>(`/ubicaciones-docs/${codigo}`, datos).then((r) => r.data),
  desactivar: (codigo: string) => api.delete(`/ubicaciones-docs/${codigo}`),
  sincronizar: (datos: { codigo_entidad?: string; directorios: { codigo_ubicacion: string; nombre_ubicacion: string; codigo_ubicacion_superior: string | null; ruta_completa: string; nivel: number }[] }) =>
    api.post<{ insertadas: number; eliminadas: number; actualizadas: number; total: number }>('/ubicaciones-docs/sincronizar', datos).then((r) => r.data),
  // Documentos en ubicación
  listarDocumentos: (codigo: string) =>
    api.get(`/ubicaciones-docs/${codigo}/documentos`).then((r) => r.data),
  asignarDocumento: (codigo: string, idDoc: number) =>
    api.post(`/ubicaciones-docs/${codigo}/documentos/${idDoc}`).then((r) => r.data),
  quitarDocumento: (codigo: string, idDoc: number) =>
    api.delete(`/ubicaciones-docs/${codigo}/documentos/${idDoc}`),
}

// ── Carga masiva de documentos ────────────────────────────────────────────

export const cargaDocumentosApi = {
  cargar: (datos: {
    codigo_entidad?: string
    archivos: {
      nombre: string
      ruta_completa: string
      ruta_directorio: string
      tamano_kb?: number
      fecha_modificacion?: string
    }[]
  }) =>
    api.post<{ insertados: number; actualizados: number; total: number }>(
      '/documentos/cargar-desde-ubicaciones', datos
    ).then((r) => r.data),
}

export default api
