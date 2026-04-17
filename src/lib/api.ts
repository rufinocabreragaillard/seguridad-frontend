import axios, { AxiosError } from 'axios'
import { obtenerToken } from './supabase'
import type { RolMenu, RegistroLLM } from './tipos'
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
  ChatConversacion,
  ChatConversacionDetalle,
  Cargo,
  RolCargo,
  EspacioTrabajo,
  DocumentoEspacio,
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
  // Enviar locale para i18n de mensajes del backend
  if (typeof window !== 'undefined') {
    const locale = document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] || 'es'
    config.headers['Accept-Language'] = locale
  }
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
  yo: () => api.get<UsuarioContexto>('/auth/me', { timeout: 20000 }).then((r) => r.data),
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
  listarTodos: (params?: { activo?: boolean; q?: string }) =>
    api.get<Usuario[]>('/usuarios/todos', { params }).then((r) => r.data),
  listarPaginado: (params: { page: number; limit: number; activo?: boolean; q?: string }) =>
    api.get<RespuestaPaginadaApi<Usuario>>('/usuarios/paginado', { params }).then((r) => r.data),
  obtener: (id: string) => api.get<Usuario>(`/usuarios/${id}`).then((r) => r.data),
  crear: (datos: CrearUsuarioRequest) => api.post<Usuario>('/usuarios', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Usuario>) =>
    api.put<Usuario>(`/usuarios/${id}`, datos).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/usuarios/${id}`),
  listarRoles: (id: string) =>
    api.get<{ codigo_grupo: string; id_rol: number; codigo_rol?: string; orden: number; roles?: { codigo_rol: string; nombre: string; codigo_grupo: string | null } }[]>(
      `/usuarios/${id}/roles`
    ).then((r) => r.data),
  asignarRol: (id: string, idRol: number, codigoGrupo: string) =>
    api.post(`/usuarios/${id}/roles`, { id_rol: idRol, codigo_grupo: codigoGrupo }),
  reordenarRoles: (id: string, orden: { codigo_grupo: string; id_rol: number; orden: number }[]) =>
    api.put(`/usuarios/${id}/roles/orden`, orden),
  quitarRol: (id: string, idRol: number) =>
    api.delete(`/usuarios/${id}/roles/${idRol}`),
  listarEntidades: (id: string) =>
    api.get<{ codigo_entidad: string; codigo_grupo: string; codigo_area?: string; entidades: { nombre: string; activo: boolean } }[]>(
      `/usuarios/${id}/entidades`
    ).then((r) => r.data),
  asignarEntidad: (id: string, codigoEntidad: string, codigoGrupo: string, codigoArea?: string) =>
    api.post(`/usuarios/${id}/entidades`, {
      codigo_entidad: codigoEntidad,
      codigo_grupo: codigoGrupo,
      ...(codigoArea ? { codigo_area: codigoArea } : {}),
    }, { timeout: 45000 }),
  listarGrupos: (id: string) =>
    api.get<{ codigo_grupo: string; grupos_entidades: { nombre: string } }[]>(
      `/usuarios/${id}/grupos`
    ).then((r) => r.data),
  quitarEntidad: (id: string, codigoEntidad: string) =>
    api.delete(`/usuarios/${id}/entidades/${codigoEntidad}`),
  asignarGrupo: (id: string, codigoGrupo: string) =>
    api.post(`/usuarios/${id}/grupos`, { codigo_grupo: codigoGrupo }),
  quitarGrupo: (id: string, codigoGrupo: string) =>
    api.delete(`/usuarios/${id}/grupos/${codigoGrupo}`),
  cambiarGrupoPropio: (codigoGrupo: string) =>
    api.put('/usuarios/cambiar-grupo', { codigo_grupo: codigoGrupo }),
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export const rolesApi = {
  listar: (codigoGrupo?: string, incluirGlobales?: boolean) =>
    api.get<Rol[]>('/roles', { params: { ...(codigoGrupo && { codigo_grupo: codigoGrupo }), ...(incluirGlobales !== undefined && { incluir_globales: incluirGlobales }) } }).then((r) => r.data),
  listarGlobales: () => api.get<Rol[]>('/roles/globales').then((r) => r.data),
  obtener: (idRol: number) => api.get<Rol>(`/roles/${idRol}`).then((r) => r.data),
  crear: (datos: Partial<Rol>) => api.post<Rol>('/roles', datos).then((r) => r.data),
  actualizar: (idRol: number, datos: Partial<Rol>) =>
    api.put<Rol>(`/roles/${idRol}`, datos).then((r) => r.data),
  eliminar: (idRol: number) => api.delete(`/roles/${idRol}`),
  listarFunciones: (idRol: number) =>
    api.get<{ codigo_funcion: string; orden: number; funciones: { nombre_funcion: string } }[]>(
      `/roles/${idRol}/funciones`
    ).then((r) => r.data),
  asignarFuncion: (idRol: number, codigoFuncion: string) =>
    api.post(`/roles/${idRol}/funciones`, { codigo_funcion: codigoFuncion }),
  reordenarFunciones: (idRol: number, orden: { codigo_funcion: string; orden: number }[]) =>
    api.put(`/roles/${idRol}/funciones/orden`, orden),
  quitarFuncion: (idRol: number, codigoFuncion: string) =>
    api.delete(`/roles/${idRol}/funciones/${codigoFuncion}`),
  reordenar: (orden: { id_rol: number; orden: number }[]) =>
    api.put('/roles/orden', orden),
  listarPorGrupo: (codigoGrupo: string, incluirGlobales: boolean = true) =>
    api.get<Rol[]>('/roles', { params: { codigo_grupo: codigoGrupo, incluir_globales: incluirGlobales } }).then((r) => r.data),
  copiar: (datos: { id_rol_origen: number; codigo_grupo_destino: string }) =>
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
    api.get<{ codigo_aplicacion: string; aplicaciones: { nombre_aplicacion: string } }[]>(
      `/funciones/${id}/aplicaciones`
    ).then((r) => r.data),
  asignarAplicacion: (id: string, codigoApp: string) =>
    api.post(`/funciones/${id}/aplicaciones`, { codigo_aplicacion: codigoApp }),
  quitarAplicacion: (id: string, codigoApp: string) =>
    api.delete(`/funciones/${id}/aplicaciones/${codigoApp}`),
  reordenar: (orden: { codigo_funcion: string; orden: number }[]) =>
    api.put('/funciones/reordenar', orden),
}

// ─── Aplicaciones ─────────────────────────────────────────────────────────────

export const aplicacionesApi = {
  listar: (codigoGrupo?: string) =>
    api.get<Aplicacion[]>('/aplicaciones', { params: codigoGrupo ? { codigo_grupo: codigoGrupo } : {} }).then((r) => r.data),
  crear: (datos: Partial<Aplicacion>) => api.post<Aplicacion>('/aplicaciones', datos).then((r) => r.data),
  actualizar: (id: string, datos: Partial<Aplicacion>) =>
    api.put<Aplicacion>(`/aplicaciones/${id}`, datos).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/aplicaciones/${id}`),
  reordenar: (orden: { codigo_aplicacion: string; orden: number }[]) =>
    api.put('/aplicaciones/reordenar', orden),
  listarFunciones: (id: string) =>
    api.get<{ codigo_funcion: string; orden: number; inicial: boolean; funciones: { nombre_funcion: string } }[]>(
      `/aplicaciones/${id}/funciones`
    ).then((r) => r.data),
  asignarFuncion: (id: string, codigoFuncion: string) =>
    api.post(`/aplicaciones/${id}/funciones`, { codigo_funcion: codigoFuncion }),
  quitarFuncion: (id: string, codigoFuncion: string) =>
    api.delete(`/aplicaciones/${id}/funciones/${codigoFuncion}`),
  reordenarFunciones: (id: string, orden: { codigo_funcion: string; orden: number }[]) =>
    api.put(`/aplicaciones/${id}/funciones/reordenar`, orden),
  actualizarRelFuncion: (id: string, codigoFuncion: string, datos: { inicial?: boolean; orden?: number }) =>
    api.patch(`/aplicaciones/${id}/funciones/${codigoFuncion}`, datos),
  listarGrupos: (id: string) =>
    api.get<{ codigo_grupo: string; grupos_entidades: { nombre_grupo: string } }[]>(
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
  borrarCompleto: (id: string) => api.delete(`/grupos/${id}/completo`).then((r) => r.data),
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
  obtenerValor: (categoria: string, tipo: string) =>
    api.get<{ valor: string | null; nivel: string | null }>(`/parametros/valor/${categoria}/${tipo}`).then((r) => r.data),
  listarGenerales: () =>
    api.get<ParametroGeneral[]>('/parametros/generales').then((r) => r.data),
  actualizarGeneral: (codigo: string, valor: string) =>
    api.put(`/parametros/generales/${codigo}`, { valor }),
  upsertGenerales: (datos: { categoria_parametro: string; tipo_parametro: string; valor_parametro: string; replica?: boolean; visible?: boolean; editable?: boolean }) =>
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

export interface RespuestaPaginadaApi<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export const documentosApi = {
  listar: (params?: { codigo_estado_doc?: string; activo?: boolean; q?: string; limit?: number }) =>
    api.get<Documento[]>('/documentos', { params }).then((r) => r.data),
  listarPaginado: (params: { page: number; limit: number; codigo_estado_doc?: string; activo?: boolean; q?: string }) =>
    api.get<RespuestaPaginadaApi<Documento>>('/documentos/paginado', { params }).then((r) => r.data),
  contarPorEstado: () =>
    api.get<Record<string, number>>('/documentos/contar-por-estado').then((r) => r.data),
  crear: (datos: Partial<Documento>) =>
    api.post<Documento>('/documentos', datos).then((r) => r.data),
  actualizar: (id: number, datos: Partial<Documento>) =>
    api.put<Documento>(`/documentos/${id}`, datos).then((r) => r.data),
  desactivar: (id: number) => api.delete(`/documentos/${id}`),
  eliminarBulk: (ids: number[]) =>
    api.post<{ eliminados: number }>('/documentos/eliminar-bulk', { codigos_documento: ids }).then((r) => r.data),
  // Restablecer documentos NO_ESCANEABLE / NO_ENCONTRADO a CARGADO/METADATA
  restablecerEstado: (codigos_documento: number[]) =>
    api.post<{ restablecidos: number; a_cargado: number; a_metadata: number; omitidos: number }>(
      '/documentos/restablecer-estado',
      { codigos_documento },
    ).then((r) => r.data),
  resetearACargado: (codigos_documento: number[]) =>
    api.post<{ reseteados: number }>(
      '/documentos/resetear-a-cargado',
      { codigos_documento },
    ).then((r) => r.data),
  // Características
  listarCaracteristicas: (id: number) =>
    api.get<CategoriaConCaracteristicasDocs[]>(`/documentos/${id}/caracteristicas`).then((r) => r.data),
  crearCaracteristica: (id: number, datos: Partial<CaracteristicaDocumento>) =>
    api.post<CaracteristicaDocumento>(`/documentos/${id}/caracteristicas`, datos).then((r) => r.data),
  actualizarCaracteristica: (id: number, idCar: number, datos: Partial<CaracteristicaDocumento>) =>
    api.put<CaracteristicaDocumento>(`/documentos/${id}/caracteristicas/${idCar}`, datos).then((r) => r.data),
  eliminarCaracteristica: (id: number, idCar: number) =>
    api.delete(`/documentos/${id}/caracteristicas/${idCar}`),
  // Procesamiento LLM
  resumir: (id: number, texto: string, idModelo: number) =>
    api.post<{ resumen: string; tiempo_ms: number; modelo: string }>(`/documentos/${id}/resumir`, { texto, id_modelo: idModelo }, { timeout: 120000 }).then((r) => r.data),
  escanear: (id: number, idModelo: number) =>
    api.post<{ clasificaciones: { categoria: string; valor: string }[]; tiempo_ms: number; modelo: string }>(`/documentos/${id}/escanear`, { id_modelo: idModelo }, { timeout: 120000 }).then((r) => r.data),
  // Carga desde ubicaciones
  cargarDesdeUbicaciones: (archivos: { nombre_documento: string; ubicacion_documento: string; tamano_kb: number; fecha_modificacion: string; ruta_directorio: string }[]) =>
    api.post<{ insertados: number; actualizados: number }>('/documentos/cargar-desde-ubicaciones', { archivos }).then((r) => r.data),
  // EXTRAER: subir texto extraido del archivo (CARGADO -> METADATA)
  subirTexto: (
    id: number,
    body: {
      texto_fuente: string
      caracteres?: number
      paginas?: number
      fecha_inicio_extraccion?: string
      archivo_no_encontrado?: boolean
      formato_no_soportado?: string
      contenido_vacio?: boolean
    },
  ) =>
    api.post<{ codigo_documento: number; codigo_estado_doc: string; caracteres: number; paginas: number | null }>(
      `/documentos/${id}/texto`, body, { timeout: 60000 },
    ).then((r) => r.data),
  subirOcr: (id: number, pdfBytes: ArrayBuffer) => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const form = new FormData()
    form.append('archivo', blob, 'documento.pdf')
    return api.post<{ codigo_documento: number; codigo_estado_doc: string; caracteres: number; paginas: number | null }>(
      `/documentos/${id}/ocr`, form, { timeout: 120000 },
    ).then((r) => r.data)
  },
  // CHUNKS: ver chunks generados por el proceso CHUNKEAR
  listarChunks: (
    id: number,
    params?: { q?: string; page?: number; limit?: number },
  ) =>
    api.get<{
      documento: { codigo_documento: number; nombre_documento: string; codigo_estado_doc: string }
      stats: { total_chunks: number; n_chars_total: number; avg_chars: number; vectorizado: boolean }
      busqueda: { q: string; total_filtrado: number; page: number; limit: number }
      chunks: {
        id_chunk: number
        nro_chunk: number
        texto: string
        n_chars: number
        n_tokens_aprox: number
        metadata: Record<string, unknown>
        modelo_embedding: string | null
        match_inicio: number
        match_fin: number
      }[]
    }>(`/documentos/${id}/chunks`, { params }).then((r) => r.data),
  chatComando: (body: { mensaje: string; contexto: Record<string, unknown> }) =>
    api.post<{ explicacion: string; acciones: { tipo: string; proceso?: string; estado_origen?: string; estado_destino?: string; ubicacion?: string; tope?: number }[]; ejecutado: boolean }>('/documentos/chat-comando', body).then((r) => r.data),
}

// ─── Procesos (catálogo genérico multi-dominio) ────────────────────────────

export interface PasoProceso {
  id_paso: number
  codigo_proceso: string
  orden: number
  nombre_paso: string
  estado_origen: string | null
  estado_destino: string
  id_modelo: number | null
  descripcion_paso: string | null
  activo: boolean
  prompt?: string | null
  system_prompt?: string | null
}

export interface Proceso {
  codigo_proceso: string
  nombre_proceso: string
  descripcion: string | null
  tipo_entidad: string
  activo: boolean
  prompt?: string | null
  system_prompt?: string | null
  n_parallel: number
  pasos: PasoProceso[]
}

export const procesosApi = {
  listar: (tipoEntidad?: string) =>
    api.get<Proceso[]>('/procesos', { params: tipoEntidad ? { tipo_entidad: tipoEntidad } : undefined }).then((r) => r.data),
  obtener: (codigo: string) => api.get<Proceso>(`/procesos/${codigo}`).then((r) => r.data),
  actualizar: (codigo: string, data: { n_parallel?: number; nombre_proceso?: string; descripcion?: string }) =>
    api.patch<Proceso>(`/procesos/${codigo}`, data).then((r) => r.data),
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
  reordenar: (orden: { codigo: string; orden: number }[]) =>
    api.put('/categorias-caracteristica/orden', orden),
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
  asignarRol: (codigo: string, idRol: number) =>
    api.post(`/categorias-caracteristica/${codigo}/roles`, { id_rol: idRol }),
  reordenarRoles: (codigo: string, orden: { id_rol: number; orden: number }[]) =>
    api.put(`/categorias-caracteristica/${codigo}/roles/orden`, orden),
  quitarRol: (codigo: string, idRol: number) =>
    api.delete(`/categorias-caracteristica/${codigo}/roles/${idRol}`),
}

// ─── Categorías Características Documentos (consolidadas tras migración 051) ──
// Sin endpoints de roles — todas las categorías visibles para el grupo activo
// son accesibles para todos los usuarios del grupo.

export const categoriasCaractDocsApi = {
  listar: () => api.get<CategoriaCaractDocs[]>('/categorias-caracteristica-docs').then((r) => r.data),
  crear: (datos: Partial<CategoriaCaractDocs>) =>
    api.post<CategoriaCaractDocs>('/categorias-caracteristica-docs', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<CategoriaCaractDocs>) =>
    api.put<CategoriaCaractDocs>(`/categorias-caracteristica-docs/${codigo}`, datos).then((r) => r.data),
  desactivar: (codigo: string) => api.delete(`/categorias-caracteristica-docs/${codigo}`),
  reordenar: (orden: { codigo: string; orden: number }[]) =>
    api.put('/categorias-caracteristica-docs/orden', orden),
  // Tipos
  listarTipos: (codigo: string) =>
    api.get<TipoCaractDocs[]>(`/categorias-caracteristica-docs/${codigo}/tipos`).then((r) => r.data),
  crearTipo: (codigo: string, datos: Partial<TipoCaractDocs>) =>
    api.post<TipoCaractDocs>(`/categorias-caracteristica-docs/${codigo}/tipos`, datos).then((r) => r.data),
  actualizarTipo: (codigo: string, codigoTipo: string, datos: Partial<TipoCaractDocs>) =>
    api.put<TipoCaractDocs>(`/categorias-caracteristica-docs/${codigo}/tipos/${codigoTipo}`, datos).then((r) => r.data),
  desactivarTipo: (codigo: string, codigoTipo: string) =>
    api.delete(`/categorias-caracteristica-docs/${codigo}/tipos/${codigoTipo}`),
}

// ─── Registro LLM ───────────────────────────────────────────────────────────

export const registroLLMApi = {
  listar: () => api.get<RegistroLLM[]>('/registro-llm').then((r) => r.data),
  crear: (datos: Partial<RegistroLLM>) =>
    api.post<RegistroLLM>('/registro-llm', datos).then((r) => r.data),
  actualizar: (id: number, datos: Partial<RegistroLLM>) =>
    api.put<RegistroLLM>(`/registro-llm/${id}`, datos).then((r) => r.data),
  desactivar: (id: number) => api.delete(`/registro-llm/${id}`),
  probar: (id: number, mensaje: string) =>
    api.post<{ respuesta: string; tiempo_ms: number; modelo: string }>(`/registro-llm/${id}/probar`, { mensaje }).then((r) => r.data),
}

// ─── LLM Credenciales por grupo ──────────────────────────────────────────────

export interface LLMCredencial {
  codigo_grupo: string
  proveedor: 'anthropic' | 'google'
  alias: string
  api_key_preview: string
  activo: boolean
  limite_usd_mes: number | null
  ultimo_uso_en: string | null
  creado_por: string | null
  created_at: string | null
}

export interface LLMPrecio {
  proveedor: string
  nombre_tecnico: string
  precio_input_1m: number
  precio_output_1m: number
  precio_cache_read_1m: number
  precio_cache_write_1m: number
  vigente_desde: string
  activo: boolean
}

export const llmCredencialesApi = {
  listar: () => api.get<LLMCredencial[]>('/llm-credenciales').then((r) => r.data),
  crear: (datos: {
    proveedor: 'anthropic' | 'google'
    alias?: string
    api_key: string
    limite_usd_mes?: number | null
    activo?: boolean
  }) => api.post<LLMCredencial>('/llm-credenciales', datos).then((r) => r.data),
  actualizar: (
    proveedor: string,
    alias: string,
    datos: { api_key?: string; limite_usd_mes?: number | null; activo?: boolean },
  ) => api.put<LLMCredencial>(`/llm-credenciales/${proveedor}/${alias}`, datos).then((r) => r.data),
  eliminar: (proveedor: string, alias: string) =>
    api.delete(`/llm-credenciales/${proveedor}/${alias}`),
  probar: (proveedor: string, alias: string) =>
    api
      .post<{ ok: boolean; mensaje: string; tiempo_ms: number }>(
        `/llm-credenciales/${proveedor}/${alias}/probar`,
      )
      .then((r) => r.data),
}

export const llmPreciosApi = {
  listar: () => api.get<LLMPrecio[]>('/llm-precios').then((r) => r.data),
  upsert: (proveedor: string, nombre_tecnico: string, datos: Partial<LLMPrecio>) =>
    api
      .put(`/llm-precios/${proveedor}/${nombre_tecnico}`, {
        proveedor,
        nombre_tecnico,
        ...datos,
      })
      .then((r) => r.data),
}

// ─── LLM Uso ─────────────────────────────────────────────────────────────────

export interface LLMUsoFila {
  id: number
  codigo_grupo: string
  codigo_entidad: string | null
  codigo_usuario: string | null
  proveedor: string
  modelo: string
  alias_credencial: string | null
  uso_key_casa: boolean
  tokens_input: number
  tokens_output: number
  tokens_cache_read: number
  tokens_cache_write: number
  costo_estimado_usd: number
  codigo_funcion: string | null
  operacion: string | null
  id_documento: number | null
  exito: boolean
  error_mensaje: string | null
  duracion_ms: number | null
  created_at: string
}

export interface LLMUsoResumen {
  mes: string
  total_llamadas: number
  total_costo_usd: number
  costo_key_casa_usd: number
  costo_key_grupo_usd: number
  por_modelo: Array<{ clave: string; llamadas: number; costo_usd: number; tokens_input: number; tokens_output: number; errores: number }>
  por_usuario: Array<{ clave: string; llamadas: number; costo_usd: number; tokens_input: number; tokens_output: number; errores: number }>
}

export const llmUsoApi = {
  listar: (params: {
    desde?: string
    hasta?: string
    proveedor?: string
    modelo?: string
    codigo_usuario?: string
    limit?: number
  } = {}) => api.get<LLMUsoFila[]>('/llm-uso', { params }).then((r) => r.data),
  resumen: () => api.get<LLMUsoResumen>('/llm-uso/resumen').then((r) => r.data),
  mensual: (meses = 6) =>
    api.get<Array<Record<string, unknown>>>('/llm-uso/mensual', { params: { meses } }).then((r) => r.data),
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
  listar: (estadoCola?: string, estadoDestino?: string) => {
    const params: Record<string, string> = {}
    if (estadoCola) params.estado_cola = estadoCola
    if (estadoDestino) params.estado_destino = estadoDestino
    return api.get<ColaEstadoDoc[]>('/cola-estados-docs', { params: Object.keys(params).length ? params : undefined }).then((r) => r.data)
  },
  listarPaginado: (params: { page: number; limit: number; estado_cola?: string; q?: string }) =>
    api.get<RespuestaPaginadaApi<ColaEstadoDoc>>('/cola-estados-docs/paginado', { params }).then((r) => r.data),
  inicializar: (items: { codigo_documento: number; codigo_estado_doc_destino: string; prioridad?: number }[]) =>
    api.post<{ encolados: number; omitidos: number; total: number }>('/cola-estados-docs/inicializar', { items }).then((r) => r.data),
  inicializarPorEstado: (estado_origen: string, estado_destino: string, codigo_entidad?: string, tope?: number | null, codigo_ubicacion?: string | null) =>
    api.post<{ encolados: number; omitidos: number; total: number }>('/cola-estados-docs/inicializar-por-estado', { estado_origen, estado_destino, codigo_entidad, tope: tope || null, codigo_ubicacion: codigo_ubicacion || null }).then((r) => r.data),
  cerrar: () =>
    api.post<{ eliminados: number }>('/cola-estados-docs/cerrar').then((r) => r.data),
  eliminar: (id: number) => api.delete(`/cola-estados-docs/${id}`),
  // Dispara el worker backend (BackgroundTasks). Retorna inmediato; el
  // procesamiento corre en el servidor. El cliente hace polling de listar().
  ejecutar: (estadoDestino?: string) =>
    api.post<{ mensaje: string; pendientes_al_iniciar: number }>(
      '/cola-estados-docs/ejecutar',
      { estado_destino: estadoDestino || null },
    ).then((r) => r.data),
  recuperarHuerfanos: (minutos = 5) =>
    api.post<{ recuperados: number }>(
      '/cola-estados-docs/recuperar-huerfanos',
      undefined,
      { params: { minutos } },
    ).then((r) => r.data),
  idsInvalidos: (estadoDestino: string) =>
    api.get<number[]>('/cola-estados-docs/ids-invalidos', { params: { estado_destino: estadoDestino } }).then((r) => r.data),
  porDocumento: (codigoDocumento: number) =>
    api.get<ColaEstadoDoc[]>(`/cola-estados-docs/por-documento/${codigoDocumento}`).then((r) => r.data),
  porIds: (ids: number[]) =>
    api.get<ColaEstadoDoc[]>('/cola-estados-docs/por-ids', { params: { ids: ids.join(',') } }).then((r) => r.data),
}

// ─── Ubicaciones Docs ──────────────────────────────────────────────────────

export const ubicacionesDocsApi = {
  listar: (opciones?: string | { codigo_entidad?: string; tipo?: 'AREA' | 'CONTENIDO' }) => {
    const params: Record<string, string> = {}
    if (typeof opciones === 'string') {
      if (opciones) params.codigo_entidad = opciones
    } else if (opciones) {
      if (opciones.codigo_entidad) params.codigo_entidad = opciones.codigo_entidad
      if (opciones.tipo) params.tipo = opciones.tipo
    }
    return api.get<UbicacionDoc[]>('/ubicaciones-docs', { params: Object.keys(params).length ? params : undefined }).then((r) => r.data)
  },
  cambiarTipo: (codigo: string, tipo: 'AREA' | 'CONTENIDO') =>
    api.patch<{ mensaje: string; actualizadas: number }>(`/ubicaciones-docs/${codigo}/tipo`, { tipo_ubicacion: tipo }).then((r) => r.data),
  crear: (datos: Partial<UbicacionDoc>) =>
    api.post<UbicacionDoc>('/ubicaciones-docs', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<UbicacionDoc>) =>
    api.put<UbicacionDoc>(`/ubicaciones-docs/${codigo}`, datos).then((r) => r.data),
  previewEliminar: (codigo: string) =>
    api.get<{ ubicaciones: number; documentos_afectados: number; documentos_a_eliminar: number }>(`/ubicaciones-docs/${codigo}/preview-eliminar`).then((r) => r.data),
  eliminar: (codigo: string) =>
    api.delete<{ mensaje: string; ubicaciones: number; relaciones_quitadas: number; documentos_eliminados: number }>(`/ubicaciones-docs/${codigo}`).then((r) => r.data),
  /** @deprecated usar eliminar() — el backend ahora hace hard delete cascade */
  desactivar: (codigo: string) => api.delete(`/ubicaciones-docs/${codigo}`),
  sincronizar: (datos: { codigo_entidad?: string; directorios: { codigo_ubicacion: string; nombre_ubicacion: string; codigo_ubicacion_superior: string | null; ruta_completa: string; nivel: number }[] }) =>
    api.post<{ insertadas: number; eliminadas: number; actualizadas: number; total: number; excluidas: number }>('/ubicaciones-docs/sincronizar', datos).then((r) => r.data),
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
      '/documentos/cargar-desde-ubicaciones', datos, { timeout: 60000 }
    ).then((r) => r.data),
}

// ─── Chat con LLM ────────────────────────────────────────────────────────────

export const chatApi = {
  listarConversaciones: () =>
    api.get<ChatConversacion[]>('/chat/conversaciones').then((r) => r.data),
  obtenerConversacion: (id: number) =>
    api.get<ChatConversacionDetalle>(`/chat/conversaciones/${id}`).then((r) => r.data),
  crearConversacion: (codigoFuncion: string, titulo?: string) =>
    api.post<ChatConversacion>('/chat/conversaciones', {
      codigo_funcion: codigoFuncion,
      ...(titulo ? { titulo } : {}),
    }).then((r) => r.data),
  renombrarConversacion: (id: number, titulo: string) =>
    api.put<ChatConversacion>(`/chat/conversaciones/${id}`, { titulo }).then((r) => r.data),
  eliminarConversacion: (id: number) =>
    api.delete(`/chat/conversaciones/${id}`),

  /**
   * Envía un mensaje de usuario a la conversación y recibe la respuesta del LLM en streaming.
   * Cada chunk de texto se entrega al callback `onChunk`. Cuando termina, se llama `onDone`
   * con los IDs persistidos en BD. Si hay error, se llama `onError`.
   *
   * Implementado con fetch + ReadableStream porque axios no soporta streams en el navegador
   * de forma simple. El backend devuelve text/event-stream con líneas `data: {json}\n\n`.
   */
  enviarMensajeStream: async (
    idConversacion: number,
    contenido: string,
    callbacks: {
      onChunk: (text: string) => void
      onDone: (info: { id_mensaje_user: number | null; id_mensaje_assistant: number | null }) => void
      onError: (mensaje: string) => void
    }
  ): Promise<void> => {
    const token = await obtenerToken()
    if (!token) {
      callbacks.onError('No autenticado.')
      return
    }
    // Headers de override de sesión (igual que el axios interceptor)
    const overrideHeaders: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      const og = localStorage.getItem('cab_override_grupo')
      const oe = localStorage.getItem('cab_override_entidad')
      const oa = localStorage.getItem('cab_override_aplicacion')
      if (og) overrideHeaders['X-Override-Grupo'] = og
      if (oe) overrideHeaders['X-Override-Entidad'] = oe
      if (oa) overrideHeaders['X-Override-Aplicacion'] = oa
      overrideHeaders['X-Codigo-Funcion'] = _urlToFuncion[window.location.pathname] || 'CHAT-USUARIO'
    }
    let resp: Response
    try {
      resp = await fetch(`${BASE_URL}/chat/conversaciones/${idConversacion}/mensajes/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          ...overrideHeaders,
        },
        body: JSON.stringify({ contenido }),
      })
    } catch (e) {
      callbacks.onError(e instanceof Error ? e.message : 'Error de red')
      return
    }
    if (!resp.ok || !resp.body) {
      let detail = `HTTP ${resp.status}`
      try {
        const j = await resp.json()
        detail = j.detail || detail
      } catch { /* */ }
      callbacks.onError(detail)
      return
    }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // Procesar líneas completas separadas por \n\n
        let idx
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const linea = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 2)
          if (!linea.startsWith('data:')) continue
          const payload = linea.slice(5).trim()
          if (!payload) continue
          try {
            const evt = JSON.parse(payload)
            if (evt.error) {
              callbacks.onError(evt.error)
              return
            }
            if (evt.text) {
              callbacks.onChunk(evt.text)
            }
            if (evt.done) {
              callbacks.onDone({
                id_mensaje_user: evt.id_mensaje_user ?? null,
                id_mensaje_assistant: evt.id_mensaje_assistant ?? null,
              })
              return
            }
          } catch { /* línea malformada, ignorar */ }
        }
      }
    } catch (e) {
      callbacks.onError(e instanceof Error ? e.message : 'Error leyendo stream')
    }
  },
}

// ─── Cargos ───────────────────────────────────────────────────────────────────

export const cargosApi = {
  listar: (params?: { activo?: boolean; codigo_entidad?: string }) =>
    api.get<Cargo[]>('/cargos', { params }).then((r) => r.data),
  crear: (datos: { codigo_cargo?: string; nombre_cargo: string; alias?: string; descripcion?: string; codigo_entidad?: string }) =>
    api.post<Cargo>('/cargos', datos).then((r) => r.data),
  actualizar: (id: number, datos: Partial<Pick<Cargo, 'nombre_cargo' | 'alias' | 'descripcion' | 'activo' | 'codigo_entidad'>>) =>
    api.put<Cargo>(`/cargos/${id}`, datos).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/cargos/${id}`),
  listarRoles: (id: number) =>
    api.get<RolCargo[]>(`/cargos/${id}/roles`).then((r) => r.data),
  asignarRol: (id: number, id_rol: number) =>
    api.post(`/cargos/${id}/roles/${id_rol}`).then((r) => r.data),
  quitarRol: (id: number, id_rol: number) =>
    api.delete(`/cargos/${id}/roles/${id_rol}`).then((r) => r.data),
  reordenarRoles: (id: number, orden: { id_rol: number; orden: number }[]) =>
    api.put(`/cargos/${id}/roles/reordenar`, orden).then((r) => r.data),
}

// ─── Espacios de Trabajo ─────────────────────────────────────────────────────

export const espaciosTrabajoApi = {
  listarPaginado: (params: {
    page?: number; limit?: number; q?: string
    tipo_espacio?: string; solo_propios?: boolean
  }) =>
    api.get<RespuestaPaginadaApi<EspacioTrabajo>>('/espacios-trabajo', { params }).then((r) => r.data),

  crear: (datos: { nombre_espacio?: string; descripcion?: string; tipo_espacio?: string; fecha_termino?: string }) =>
    api.post<EspacioTrabajo>('/espacios-trabajo', datos).then((r) => r.data),

  actualizar: (id: number, datos: Partial<{ nombre_espacio: string; descripcion: string; tipo_espacio: string; fecha_termino: string | null }>) =>
    api.put<EspacioTrabajo>(`/espacios-trabajo/${id}`, datos).then((r) => r.data),

  eliminar: (id: number) => api.delete(`/espacios-trabajo/${id}`),

  listarDocumentos: (id: number, q?: string) =>
    api.get<DocumentoEspacio[]>(`/espacios-trabajo/${id}/documentos`, { params: q ? { q } : undefined }).then((r) => r.data),

  listarDocumentosDisponibles: (id: number, params?: { q?: string; limit?: number }) =>
    api.get<DocumentoEspacio[]>(`/espacios-trabajo/${id}/documentos-disponibles`, { params }).then((r) => r.data),

  agregarDocumentos: (id: number, codigos_documento: number[]) =>
    api.post(`/espacios-trabajo/${id}/documentos`, { codigos_documento }).then((r) => r.data),

  quitarDocumento: (id: number, codigo_documento: number) =>
    api.delete(`/espacios-trabajo/${id}/documentos/${codigo_documento}`).then((r) => r.data),
}

export default api
