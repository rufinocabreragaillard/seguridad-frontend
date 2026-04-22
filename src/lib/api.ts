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
  EstadoCanonicalProceso,
  EstadoCanonicoTarea,
  TipoConversacion,
  TipoTarea,
  EstadoConversacion,
  EstadoTarea,
  CategoriaTarea,
  TipoCanonicoTarea,
  CategoriaProceso,
  TipoProceso,
  EstadoProceso,
  Conversacion,
  ParticipanteConversacion,
  Tarea,
  UbicacionDoc,
  EstadoDoc,
  ColaEstadoDoc,
  SqlEjecutado,
  ChatConversacion,
  ChatConversacionDetalle,
  Cargo,
  RolCargo,
  LocaleSoportado,
  EstadoTraducciones,
  EspacioTrabajo,
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

// Detecta si un mensaje de error contiene un código SQLSTATE de PostgreSQL
function _esErrorPostgres(msg: string): boolean {
  return /['"]code['"]\s*:\s*['"][0-9A-Z]{5}['"]/.test(msg)
}

// Interceptor: manejo uniforme de errores
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // Sin respuesta del servidor (red caída, timeout, CORS, servidor dormido)
    if (!error.response) {
      const msg =
        error.code === 'ECONNABORTED'
          ? 'La solicitud tardó demasiado. Intente nuevamente en unos segundos.'
          : 'No se pudo conectar con el servidor. Verifique su conexión o intente más tarde.'
      return Promise.reject(new Error(msg))
    }

    const detail = (error.response?.data as { detail?: unknown })?.detail
    let msg: string
    if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc, msg, type}, ...]
      msg = detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ')
    } else if (typeof detail === 'string') {
      msg = detail
    } else if (error.response.status === 500) {
      msg = 'Ocurrió un error interno en el servidor. Si el problema persiste, contacte al administrador.'
    } else {
      msg = error.message || 'Error desconocido'
    }

    // Si es un error PostgreSQL, pedirle al LLM que lo diagnostique
    if (_esErrorPostgres(msg)) {
      try {
        const token = await obtenerToken()
        // Extrae endpoint y método de la request original (contexto para el LLM)
        const endpoint = error.config?.url || null
        const metodo = error.config?.method?.toUpperCase() || null
        const r = await fetch(`${BASE_URL}/utils/explicar-error`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            error_tecnico: msg,
            endpoint,
            metodo,
          }),
        })
        if (r.ok) {
          const data = await r.json()
          if (data.es_error_tecnico && data.mensaje_usuario) {
            const partes: string[] = []
            // Prefijo de categoría (icono textual)
            const iconoCat: Record<string, string> = {
              dato_usuario: 'ℹ️',
              configuracion: '⚙️',
              bug: '⚠️',
              desconocido: '',
            }
            const icono = iconoCat[data.categoria as string] || ''
            partes.push(`${icono ? icono + ' ' : ''}${data.mensaje_usuario}`.trim())
            if (data.sugerencia) {
              partes.push(`\nSugerencia: ${data.sugerencia}`)
            }
            if (data.detalle_tecnico) {
              partes.push(`\nDetalle técnico: ${data.detalle_tecnico}`)
            }
            msg = partes.join('\n')
          }
        }
      } catch {
        // Mantener el mensaje original si falla la llamada al LLM
      }
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
  traducir: (idRol: number) =>
    api.post<{ generadas: number; idiomas: string[]; campos_traducidos?: string[]; mensaje?: string }>(
      '/traducciones/registro', { tabla: 'roles', pk: String(idRol) }
    ).then((r) => r.data),
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
  traducir: (codigo: string) =>
    api.post<{ generadas: number; idiomas: string[]; campos_traducidos?: string[]; mensaje?: string }>(
      '/traducciones/registro', { tabla: 'funciones', pk: codigo }
    ).then((r) => r.data),
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
  reordenar: (items: { codigo_grupo: string; codigo_entidad: string; orden: number }[]) =>
    api.put('/entidades/reordenar', items).then((r) => r.data),
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
  reordenar: (items: { codigo_grupo: string; orden: number }[]) =>
    api.put('/grupos/reordenar', items).then((r) => r.data),
}

// ─── Parámetros ───────────────────────────────────────────────────────────────

export const parametrosApi = {
  obtenerValor: (categoria: string, tipo: string) =>
    api.get<{ valor: string | null; nivel: string | null }>(`/parametros/valor/${categoria}/${tipo}`).then((r) => r.data),
  listarGenerales: () =>
    api.get<ParametroGeneral[]>('/parametros/generales').then((r) => r.data),
  actualizarGeneral: (codigo: string, valor: string) =>
    api.put(`/parametros/generales/${codigo}`, { valor }),
  upsertGenerales: (datos: {
    categoria_parametro: string; tipo_parametro: string; valor_parametro: string;
    replica_grupo?: boolean; visible_grupo?: boolean; editable_grupo?: boolean;
    replica_usuario?: boolean; visible_usuario?: boolean; editable_usuario?: boolean;
  }) =>
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

  reordenarCategorias: (items: { categoria_parametro: string; orden: number }[]) =>
    api.put('/datos-basicos/categorias/reordenar', items).then((r) => r.data),

  listarTipos: (categoria?: string) =>
    api.get<TipoParametro[]>('/datos-basicos/tipos', { params: categoria ? { categoria } : {} }).then((r) => r.data),
  crearTipo: (datos: Partial<TipoParametro>) =>
    api.post<TipoParametro>('/datos-basicos/tipos', datos).then((r) => r.data),
  actualizarTipo: (categoria: string, tipo: string, datos: Partial<TipoParametro>) =>
    api.put<TipoParametro>(`/datos-basicos/tipos/${categoria}/${tipo}`, datos).then((r) => r.data),
  eliminarTipo: (categoria: string, tipo: string) =>
    api.delete(`/datos-basicos/tipos/${categoria}/${tipo}`),
  reordenarTipos: (items: { categoria_parametro: string; tipo_parametro: string; orden: number }[]) =>
    api.put('/datos-basicos/tipos/reordenar', items).then((r) => r.data),
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
  listarPaginado: (params: { page: number; limit: number; codigo_estado_doc?: string; activo?: boolean; q?: string; ruta_prefijo?: string }) =>
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
  // Revertir al estado anterior (solo UPDATE, sin procesamiento).
  // estados_origen incluye éxito + inválido del mismo paso.
  // Ej: ['VECTORIZADO','NO_VECTORIZADO'] → 'CHUNKEADO'  (NO toca NO_CHUNKEADO)
  revertirEstado: (
    codigos_documento: number[],
    estados_origen: string[] = ['VECTORIZADO', 'NO_VECTORIZADO'],
    estado_destino = 'CHUNKEADO',
  ) =>
    api.post<{ revertidos: number; estados_origen: string[]; estado_destino: string }>(
      '/documentos/revertir-estado',
      { codigos_documento, estados_origen, estado_destino },
    ).then((r) => r.data),
  // Revertir masivo por filtros (sin lista de IDs).
  // Si solo_contar=true devuelve conteo sin hacer UPDATE.
  revertir: (params: {
    estados_origen: string[]
    estado_destino: string
    codigo_entidad?: string
    q?: string
    codigo_ubicacion?: string
    tope?: number
    solo_contar?: boolean
  }) =>
    api.post<{ conteo: number; revertidos: number; solo_contar: boolean }>(
      '/documentos/revertir',
      params,
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
      sub_duracion_ms?: number
      archivo_no_encontrado?: boolean
      formato_no_soportado?: string
      contenido_vacio?: boolean
      /** Mensaje de error directo del extractor (PdfProtegidoError, ArchivoNoEscaneable) */
      detalle_error?: string
      /** Páginas PDF renderizadas como JPEG (solo PDFs mixtos texto+imagen) */
      paginas_imagen?: Array<{ pagina: number; base64: string }>
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
  // TEXTO: ver texto_fuente extraído en EXTRAER (tabla documento_texto)
  obtenerTexto: (id: number) =>
    api.get<{
      codigo_documento: number
      nombre_documento: string | null
      codigo_estado_doc: string | null
      detalle_estado: string | null
      tiene_texto: boolean
      texto_fuente: string | null
      caracteres: number
      paginas: number | null
      fecha_extraccion: string | null
    }>(`/documentos/${id}/texto`).then((r) => r.data),
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
  tipo: string
  orden: number
  prompt?: string | null
  system_prompt?: string | null
  n_parallel: number
  batch_size?: number | null
  batch_timeout_seg?: number | null
  codigo_funcion?: string | null
  /** Campos desde rel_transiciones_estado */
  estado_origen?: string | null
  estado_destino?: string | null
  id_modelo?: number | null
  /** Categoría de la transición: PROCESAR | REVERTIR | CORREGIR */
  categoria_transicion?: string | null
  id_transicion?: number | null
  /** Campo libre JSONB para configuración/datos arbitrarios del proceso */
  json?: unknown | null
  /** @deprecated — ya no se devuelve desde el backend; usar estado_origen/estado_destino/id_modelo */
  pasos?: PasoProceso[]
}

export const procesosApi = {
  /** @param categoria_transicion — PROCESAR | REVERTIR | CORREGIR (filtra por tipo de transición) */
  listar: (categoria_transicion?: string) =>
    api.get<Proceso[]>('/procesos', {
      params: {
        ...(categoria_transicion ? { categoria_transicion } : {}),
      },
    }).then((r) => r.data),
  listarTransiciones: (categoria?: string) =>
    api.get<{ id: number; categoria: string; estado_origen: string | null; estado_destino: string; codigo_tipo_proceso: string; nombre_proceso: string; id_modelo: number | null; orden: number }[]>(
      '/procesos/transiciones',
      { params: categoria ? { categoria } : {} }
    ).then((r) => r.data),
  obtener: (codigo: string) => api.get<Proceso>(`/procesos/${codigo}`).then((r) => r.data),
  actualizar: (codigo: string, data: { n_parallel?: number; nombre_proceso?: string; descripcion?: string; tipo?: string; orden?: number; codigo_funcion?: string | null; json?: unknown | null }) =>
    api.patch<Proceso>(`/procesos/${codigo}`, data).then((r) => r.data),
  reordenar: (orden: { codigo_proceso: string; orden: number }[]) =>
    api.put('/procesos/reordenar', orden).then((r) => r.data),
}

// ─── Procesos del Grupo ──────────────────────────────────────────────────────

export interface ProcesoGrupo {
  id_proceso_grupo: number
  codigo_grupo: string
  codigo_entidad: string
  codigo_proceso_grupo: string
  nombre_proceso_grupo: string
  descripcion: string | null
  tipo: string
  orden: number
  alias: string | null
  prompt: string | null
  system_prompt: string | null
  ayuda: string | null
}

export const procesosGrupoApi = {
  listar: (codigoEntidad?: string) =>
    api.get<ProcesoGrupo[]>('/procesos-grupo', { params: codigoEntidad ? { codigo_entidad: codigoEntidad } : undefined }).then((r) => r.data),
  obtener: (id: number) => api.get<ProcesoGrupo>(`/procesos-grupo/${id}`).then((r) => r.data),
  crear: (data: Partial<ProcesoGrupo>) => api.post<ProcesoGrupo>('/procesos-grupo', data).then((r) => r.data),
  actualizar: (id: number, data: Partial<ProcesoGrupo>) =>
    api.put<ProcesoGrupo>(`/procesos-grupo/${id}`, data).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/procesos-grupo/${id}`),
  reordenar: (orden: { id_proceso_grupo: number; orden: number }[]) =>
    api.put('/procesos-grupo/reordenar', orden).then((r) => r.data),
}

// ─── Tareas del Grupo ────────────────────────────────────────────────────────

export interface TareaGrupo {
  id_tarea_grupo: number
  codigo_grupo: string
  codigo_entidad: string
  codigo_tarea_grupo: string
  nombre_tarea_grupo: string
  descripcion: string | null
  tipo: string
  orden: number
  alias: string | null
  prompt: string | null
  system_prompt: string | null
  ayuda: string | null
}

export const tareasGrupoApi = {
  listar: (codigoEntidad?: string) =>
    api.get<TareaGrupo[]>('/tareas-grupo', { params: codigoEntidad ? { codigo_entidad: codigoEntidad } : undefined }).then((r) => r.data),
  obtener: (id: number) => api.get<TareaGrupo>(`/tareas-grupo/${id}`).then((r) => r.data),
  crear: (data: Partial<TareaGrupo>) => api.post<TareaGrupo>('/tareas-grupo', data).then((r) => r.data),
  actualizar: (id: number, data: Partial<TareaGrupo>) =>
    api.put<TareaGrupo>(`/tareas-grupo/${id}`, data).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/tareas-grupo/${id}`),
  reordenar: (orden: { id_tarea_grupo: number; orden: number }[]) =>
    api.put('/tareas-grupo/reordenar', orden).then((r) => r.data),
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

// ─── Tareas: Datos Básicos ───────────────────────────────────────────────────

export const tareasDatosBasicosApi = {
  // Canónicos proceso
  listarCanonicosPro: () =>
    api.get<EstadoCanonicalProceso[]>('/tareas-datos-basicos/canonicos-proceso').then((r) => r.data),
  crearCanonicosPro: (datos: Partial<EstadoCanonicalProceso>) =>
    api.post('/tareas-datos-basicos/canonicos-proceso', datos).then((r) => r.data),
  actualizarCanonicosPro: (codigo: string, datos: Partial<EstadoCanonicalProceso>) =>
    api.put(`/tareas-datos-basicos/canonicos-proceso/${codigo}`, datos).then((r) => r.data),
  eliminarCanonicosPro: (codigo: string) =>
    api.delete(`/tareas-datos-basicos/canonicos-proceso/${codigo}`),
  reordenarCanonicosPro: (items: { codigo_estado_canonico: string; orden: number }[]) =>
    api.put('/tareas-datos-basicos/canonicos-proceso/reordenar', items).then((r) => r.data),

  // Canónicos tarea
  listarCanonicosTar: () =>
    api.get<EstadoCanonicoTarea[]>('/tareas-datos-basicos/canonicos-tarea').then((r) => r.data),
  crearCanonicosTar: (datos: Partial<EstadoCanonicoTarea>) =>
    api.post('/tareas-datos-basicos/canonicos-tarea', datos).then((r) => r.data),
  actualizarCanonicosTar: (codigo: string, datos: Partial<EstadoCanonicoTarea>) =>
    api.put(`/tareas-datos-basicos/canonicos-tarea/${codigo}`, datos).then((r) => r.data),
  eliminarCanonicosTar: (codigo: string) =>
    api.delete(`/tareas-datos-basicos/canonicos-tarea/${codigo}`),

  // Categorías de tarea (globales)
  listarCategorias: () =>
    api.get<CategoriaTarea[]>('/tareas-datos-basicos/categorias').then((r) => r.data),
  crearCategoria: (datos: Partial<CategoriaTarea>) =>
    api.post('/tareas-datos-basicos/categorias', datos).then((r) => r.data),
  actualizarCategoria: (codigo: string, datos: Partial<CategoriaTarea>) =>
    api.put(`/tareas-datos-basicos/categorias/${codigo}`, datos).then((r) => r.data),
  eliminarCategoria: (codigo: string) =>
    api.delete(`/tareas-datos-basicos/categorias/${codigo}`),
  reordenarCategorias: (items: { codigo_categoria_tarea: string; orden: number }[]) =>
    api.put('/tareas-datos-basicos/categorias/reordenar', items).then((r) => r.data),

  // Tipos canónicos (globales)
  listarTiposCanonicos: () =>
    api.get<TipoCanonicoTarea[]>('/tareas-datos-basicos/tipos-canonicos').then((r) => r.data),
  crearTipoCanonico: (datos: Partial<TipoCanonicoTarea>) =>
    api.post('/tareas-datos-basicos/tipos-canonicos', datos).then((r) => r.data),
  actualizarTipoCanonico: (codigo: string, datos: Partial<TipoCanonicoTarea>) =>
    api.put(`/tareas-datos-basicos/tipos-canonicos/${codigo}`, datos).then((r) => r.data),
  eliminarTipoCanonico: (codigo: string) =>
    api.delete(`/tareas-datos-basicos/tipos-canonicos/${codigo}`),

  // Tipos conversación
  listarTiposCnv: () =>
    api.get<TipoConversacion[]>('/tareas-datos-basicos/tipos-conversacion').then((r) => r.data),
  crearTipoCnv: (datos: Partial<TipoConversacion>) =>
    api.post('/tareas-datos-basicos/tipos-conversacion', datos).then((r) => r.data),
  actualizarTipoCnv: (codigo: string, datos: Partial<TipoConversacion>) =>
    api.put(`/tareas-datos-basicos/tipos-conversacion/${codigo}`, datos).then((r) => r.data),
  eliminarTipoCnv: (codigo: string) =>
    api.delete(`/tareas-datos-basicos/tipos-conversacion/${codigo}`),

  // Tipos tarea
  listarTiposTar: (categoria?: string) =>
    api.get<TipoTarea[]>('/tareas-datos-basicos/tipos-tarea', { params: categoria ? { categoria } : {} }).then((r) => r.data),
  crearTipoTar: (datos: Partial<TipoTarea>) =>
    api.post('/tareas-datos-basicos/tipos-tarea', datos).then((r) => r.data),
  actualizarTipoTar: (categoria: string, codigo: string, datos: Partial<TipoTarea>) =>
    api.put(`/tareas-datos-basicos/tipos-tarea/${categoria}/${codigo}`, datos).then((r) => r.data),
  eliminarTipoTar: (categoria: string, codigo: string) =>
    api.delete(`/tareas-datos-basicos/tipos-tarea/${categoria}/${codigo}`),
  reordenarTiposTar: (items: { codigo_categoria_tarea: string; codigo_tipo_tarea: string; orden: number }[]) =>
    api.put('/tareas-datos-basicos/tipos-tarea/reordenar', items).then((r) => r.data),

  // Estados conversación
  listarEstadosCnv: (tipo?: string) =>
    api.get<EstadoConversacion[]>('/tareas-datos-basicos/estados-conversacion', { params: tipo ? { tipo } : {} }).then((r) => r.data),
  crearEstadoCnv: (datos: Partial<EstadoConversacion>) =>
    api.post('/tareas-datos-basicos/estados-conversacion', datos).then((r) => r.data),
  actualizarEstadoCnv: (tipo: string, codigo: string, datos: Partial<EstadoConversacion>) =>
    api.put(`/tareas-datos-basicos/estados-conversacion/${tipo}/${codigo}`, datos).then((r) => r.data),
  eliminarEstadoCnv: (tipo: string, codigo: string) =>
    api.delete(`/tareas-datos-basicos/estados-conversacion/${tipo}/${codigo}`),

  // Estados tarea
  listarEstadosTar: (params?: { categoria?: string; tipo?: string }) =>
    api.get<EstadoTarea[]>('/tareas-datos-basicos/estados-tarea', { params: params ?? {} }).then((r) => r.data),
  crearEstadoTar: (datos: Partial<EstadoTarea>) =>
    api.post('/tareas-datos-basicos/estados-tarea', datos).then((r) => r.data),
  actualizarEstadoTar: (categoria: string, tipo: string, codigo: string, datos: Partial<EstadoTarea>) =>
    api.put(`/tareas-datos-basicos/estados-tarea/${categoria}/${tipo}/${codigo}`, datos).then((r) => r.data),
  eliminarEstadoTar: (categoria: string, tipo: string, codigo: string) =>
    api.delete(`/tareas-datos-basicos/estados-tarea/${categoria}/${tipo}/${codigo}`),
  reordenarEstadosTar: (items: { codigo_categoria_tarea: string; codigo_tipo_tarea: string; codigo_estado_tarea: string; orden: number }[]) =>
    api.put('/tareas-datos-basicos/estados-tarea/reordenar', items).then((r) => r.data),
}

// ─── Procesos: Datos Básicos ──────────────────────────────────────────────────

export const procesosDatosBasicosApi = {
  listarCategorias: () =>
    api.get<CategoriaProceso[]>('/procesos-datos-basicos/categorias').then((r) => r.data),
  crearCategoria: (datos: Partial<CategoriaProceso>) =>
    api.post('/procesos-datos-basicos/categorias', datos).then((r) => r.data),
  actualizarCategoria: (codigo: string, datos: Partial<CategoriaProceso>) =>
    api.put(`/procesos-datos-basicos/categorias/${codigo}`, datos).then((r) => r.data),
  eliminarCategoria: (codigo: string) =>
    api.delete(`/procesos-datos-basicos/categorias/${codigo}`),
  reordenarCategorias: (items: { codigo_categoria_proceso: string; orden: number }[]) =>
    api.put('/procesos-datos-basicos/categorias/reordenar', items).then((r) => r.data),

  listarTipos: (categoria?: string) =>
    api.get<TipoProceso[]>('/procesos-datos-basicos/tipos', { params: categoria ? { categoria } : {} }).then((r) => r.data),
  crearTipo: (datos: Partial<TipoProceso>) =>
    api.post('/procesos-datos-basicos/tipos', datos).then((r) => r.data),
  actualizarTipo: (categoria: string, codigo: string, datos: Partial<TipoProceso>) =>
    api.put(`/procesos-datos-basicos/tipos/${categoria}/${codigo}`, datos).then((r) => r.data),
  eliminarTipo: (categoria: string, codigo: string) =>
    api.delete(`/procesos-datos-basicos/tipos/${categoria}/${codigo}`),
  reordenarTipos: (items: { codigo_categoria_proceso: string; codigo_tipo_proceso: string; orden: number }[]) =>
    api.put('/procesos-datos-basicos/tipos/reordenar', items).then((r) => r.data),

  listarEstados: (params?: { categoria?: string; tipo?: string }) =>
    api.get<EstadoProceso[]>('/procesos-datos-basicos/estados', { params: params ?? {} }).then((r) => r.data),
  crearEstado: (datos: Partial<EstadoProceso>) =>
    api.post('/procesos-datos-basicos/estados', datos).then((r) => r.data),
  actualizarEstado: (categoria: string, tipo: string, codigo: string, datos: Partial<EstadoProceso>) =>
    api.put(`/procesos-datos-basicos/estados/${categoria}/${tipo}/${codigo}`, datos).then((r) => r.data),
  eliminarEstado: (categoria: string, tipo: string, codigo: string) =>
    api.delete(`/procesos-datos-basicos/estados/${categoria}/${tipo}/${codigo}`),
  reordenarEstados: (items: { codigo_categoria_proceso: string; codigo_tipo_proceso: string; codigo_estado_proceso: string; orden: number }[]) =>
    api.put('/procesos-datos-basicos/estados/reordenar', items).then((r) => r.data),
}

// ─── Tareas: Operación ───────────────────────────────────────────────────────

export const tareasApi = {
  // Conversaciones
  listarConversaciones: (params?: { tipo?: string; estado?: string }) =>
    api.get<Conversacion[]>('/tareas/conversaciones', { params }).then((r) => r.data),
  obtenerConversacion: (id: number) =>
    api.get<Conversacion>(`/tareas/conversaciones/${id}`).then((r) => r.data),
  crearConversacion: (datos: Partial<Conversacion>) =>
    api.post('/tareas/conversaciones', datos).then((r) => r.data),
  actualizarConversacion: (id: number, datos: Partial<Conversacion>) =>
    api.put(`/tareas/conversaciones/${id}`, datos).then((r) => r.data),
  eliminarConversacion: (id: number) =>
    api.delete(`/tareas/conversaciones/${id}`),

  // Participantes
  listarParticipantes: (idConv: number) =>
    api.get<ParticipanteConversacion[]>(`/tareas/conversaciones/${idConv}/participantes`).then((r) => r.data),
  agregarParticipante: (idConv: number, datos: Partial<ParticipanteConversacion>) =>
    api.post(`/tareas/conversaciones/${idConv}/participantes`, datos).then((r) => r.data),
  eliminarParticipante: (idConv: number, idPart: number) =>
    api.delete(`/tareas/conversaciones/${idConv}/participantes/${idPart}`),

  // Tareas
  listarTareas: (params?: { tipo?: string; estado?: string; prioridad?: string; conversacion?: number; categoria?: string }) =>
    api.get<Tarea[]>('/tareas/tareas-lista', { params }).then((r) => r.data),
  obtenerTarea: (id: number) =>
    api.get<Tarea>(`/tareas/tareas-lista/${id}`).then((r) => r.data),
  crearTarea: (datos: Partial<Tarea>) =>
    api.post('/tareas/tareas-lista', datos).then((r) => r.data),
  actualizarTarea: (id: number, datos: Partial<Tarea>) =>
    api.put(`/tareas/tareas-lista/${id}`, datos).then((r) => r.data),
  eliminarTarea: (id: number) =>
    api.delete(`/tareas/tareas-lista/${id}`),
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
  inicializar: (
    items: { codigo_documento: number; codigo_estado_doc_destino: string; prioridad?: number }[],
    opts?: { codigo_proceso?: string; codigo_funcion?: string },
  ) =>
    api.post<{ encolados: number; omitidos: number; total: number }>(
      '/cola-estados-docs/inicializar',
      { items, ...(opts || {}) },
    ).then((r) => r.data),
  inicializarPorEstado: (estado_origen: string, estado_destino: string, codigo_entidad?: string, tope?: number | null, codigo_ubicacion?: string | null, q?: string | null) =>
    api.post<{ encolados: number; omitidos: number; total: number }>('/cola-estados-docs/inicializar-por-estado', { estado_origen, estado_destino, codigo_entidad, tope: tope || null, codigo_ubicacion: codigo_ubicacion || null, q: q || null }).then((r) => r.data),
  cerrar: () =>
    api.post<{ eliminados: number }>('/cola-estados-docs/cerrar').then((r) => r.data),
  eliminar: (id: number) => api.delete(`/cola-estados-docs/${id}`),
  // Dispara el worker backend (BackgroundTasks). Retorna inmediato; el
  // procesamiento corre en el servidor. El cliente hace polling de listar().
  ejecutar: (estadoDestino?: string, opts?: { codigo_proceso?: string; codigo_funcion?: string }) =>
    api.post<{ mensaje: string; pendientes_al_iniciar: number }>(
      '/cola-estados-docs/ejecutar',
      { estado_destino: estadoDestino || null, ...(opts || {}) },
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

// ─── SQL Ejecutados ─────────────────────────────────────────────────────────

export const sqlEjecutadosApi = {
  listarPaginado: (params: { page: number; limit: number; q?: string }) =>
    api
      .get<RespuestaPaginadaApi<SqlEjecutado>>('/sql-ejecutados/paginado', { params })
      .then((r) => r.data),
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
  listar: (params?: { codigo_entidad?: string }) =>
    api.get<Cargo[]>('/cargos', { params }).then((r) => r.data),
  crear: (datos: { codigo_cargo?: string; nombre_cargo: string; alias?: string; descripcion?: string; codigo_entidad?: string; prompt?: string; system_prompt?: string }) =>
    api.post<Cargo>('/cargos', datos).then((r) => r.data),
  actualizar: (codigo_cargo: string, datos: Partial<Pick<Cargo, 'nombre_cargo' | 'alias' | 'descripcion' | 'codigo_entidad' | 'prompt' | 'system_prompt'>>) =>
    api.put<Cargo>(`/cargos/${codigo_cargo}`, datos).then((r) => r.data),
  eliminar: (codigo_cargo: string) => api.delete(`/cargos/${codigo_cargo}`),
  listarRoles: (codigo_cargo: string) =>
    api.get<RolCargo[]>(`/cargos/${codigo_cargo}/roles`).then((r) => r.data),
  asignarRol: (codigo_cargo: string, id_rol: number) =>
    api.post(`/cargos/${codigo_cargo}/roles/${id_rol}`).then((r) => r.data),
  quitarRol: (codigo_cargo: string, id_rol: number) =>
    api.delete(`/cargos/${codigo_cargo}/roles/${id_rol}`).then((r) => r.data),
  reordenarRoles: (codigo_cargo: string, orden: { id_rol: number; orden: number }[]) =>
    api.put(`/cargos/${codigo_cargo}/roles/reordenar`, orden).then((r) => r.data),
}

// ─── Traducciones ─────────────────────────────────────────────────────────────

export const traduccionesApi = {
  estado: () =>
    api.get<EstadoTraducciones>('/traducciones/estado').then((r) => r.data),

  listarLocales: () =>
    api.get<LocaleSoportado[]>('/traducciones/locales').then((r) => r.data),

  listarLocalesActivos: () =>
    api.get<LocaleSoportado[]>('/traducciones/locales', { params: { solo_activos: true } }).then((r) => r.data),

  actualizarLocale: (codigo: string, datos: Partial<Pick<LocaleSoportado, 'activo' | 'nombre_nativo' | 'nombre_es' | 'orden'>>) =>
    api.patch<LocaleSoportado>(`/traducciones/locales/${codigo}`, datos).then((r) => r.data),

  crearLocale: (datos: { codigo: string; nombre_nativo: string; nombre_es: string; activo?: boolean; orden?: number }) =>
    api.post<LocaleSoportado>('/traducciones/locales', datos).then((r) => r.data),

  eliminarLocale: (codigo: string) =>
    api.delete(`/traducciones/locales/${codigo}`),

  // Devuelve 202 inmediato; la generación corre en background.
  // Usa polling de /traducciones/estado para seguir el progreso.
  generar: (modo: 'completo' | 'incremental', idiomas?: string[]) =>
    api.post<{ status: string; mensaje: string }>(
      '/traducciones/generar',
      { modo, idiomas },
      { timeout: 30_000 }  // 30s — solo esperar la respuesta 202
    ).then((r) => r.data),

  // Resetea el estado GENERANDO (para desatascar una generación fallida)
  cancelar: () =>
    api.post<{ status: string; mensaje: string }>('/traducciones/cancelar').then((r) => r.data),
}

// ─── Espacios de Trabajo ─────────────────────────────────────────────────────
export const espaciosTrabajoApi = {
  listarPaginado: (params: { page: number; limit: number; q?: string }) =>
    api.get<RespuestaPaginadaApi<EspacioTrabajo>>('/espacios-trabajo/paginado', { params }).then((r) => r.data),
  crear: (datos: { nombre_espacio?: string; tipo_espacio?: 'GUARDADO' | 'TEMPORAL'; ids_documentos: number[] }) =>
    api.post<EspacioTrabajo>('/espacios-trabajo', datos).then((r) => r.data),
  actualizar: (id: number, datos: { nombre_espacio?: string; tipo_espacio?: string }) =>
    api.put<EspacioTrabajo>(`/espacios-trabajo/${id}`, datos).then((r) => r.data),
  eliminar: (id: number) =>
    api.delete(`/espacios-trabajo/${id}`),
  listarDocumentos: (id: number, params: { page: number; limit: number; q?: string; codigo_estado_doc?: string }) =>
    api.get<RespuestaPaginadaApi<Documento>>(`/espacios-trabajo/${id}/documentos/paginado`, { params }).then((r) => r.data),
  agregarDocumentos: (id: number, ids_documentos: number[]) =>
    api.post<{ documentos: number }>(`/espacios-trabajo/${id}/documentos`, { ids_documentos }).then((r) => r.data),
  quitarDocumento: (id: number, codigo_documento: number) =>
    api.delete(`/espacios-trabajo/${id}/documentos/${codigo_documento}`),
}

// ─── Sistema "Todo por Prompts" ───────────────────────────────────────────
export interface TablaConteoPrompts {
  tabla: string
  total_filas?: number
  con_prompt?: number
  pendientes_sync?: number
  error?: string
}

export interface EstadoPrompts {
  tablas: TablaConteoPrompts[]
  total_pendientes_sync: number
}

export interface CompilarPromptRequest {
  tabla: string
  pk_columna: string
  pk_valor: string
  lenguaje?: 'python' | 'javascript' | 'ambos'
  forzar?: boolean
  prompt_insert_content?: string
  prompt_update_content?: string
}

export interface CompilarPromptResponse {
  python_insert?: string | null
  python_update?: string | null
  javascript?: string | null
  tabla: string
  pk_valor: string
}

export interface Plan {
  codigo_plan: string
  nombre: string
  alias?: string | null
  descripcion?: string | null
  mensaje_bienvenida?: string | null
  precio_mensual_usd?: number | null
  precio_anual_usd?: number | null
  tokens_mensuales?: number | null
  documentos_maximos?: number | null
  tokens_extras_disponibles: boolean
  dias_duracion?: number | null
  dias_gracia_renovacion: number
  conversacion_documentos: boolean
  focos_lenguaje_natural: boolean
  control_por_area: boolean
  control_por_cargo: boolean
  servidor_cliente_local: boolean
  personalizacion: boolean
  eleccion_llms: boolean
  multi_entidad_holdings: boolean
  storage_propio: boolean
  es_plan_de_prueba: boolean
  orden: number
  prompt_insert?: string | null
  prompt_update?: string | null
  system_prompt?: string | null
  python_insert?: string | null
  python_update?: string | null
  javascript?: string | null
  python_editado_manual: boolean
  javascript_editado_manual: boolean
}

export const planesApi = {
  listar: () => api.get<Plan[]>('/planes').then((r) => r.data),
  crear: (datos: Partial<Plan>) => api.post<Plan>('/planes', datos).then((r) => r.data),
  actualizar: (codigo: string, datos: Partial<Plan>) =>
    api.put<Plan>(`/planes/${codigo}`, datos).then((r) => r.data),
  eliminar: (codigo: string) => api.delete(`/planes/${codigo}`),
}

export const promptsApi = {
  estado: () =>
    api.get<EstadoPrompts>('/prompts/estado').then((r) => r.data),

  listarTablas: () =>
    api.get<{ tablas: string[]; excluidas: string[] }>('/prompts/tablas').then((r) => r.data),

  compilar: (req: CompilarPromptRequest) =>
    api.post<CompilarPromptResponse>('/prompts/compilar', req, { timeout: 120_000 }).then((r) => r.data),

  sincronizarFila: (tabla: string, pk_columna: string, pk_valor: string) =>
    api.post<{ codigo_documento: number; accion: string; nombre: string }>(
      '/prompts/sincronizar/fila',
      { tabla, pk_columna, pk_valor },
    ).then((r) => r.data),

  sincronizarTabla: (tabla: string, solo_cambiadas: boolean = true) =>
    api.post<{ tabla: string; total: number; sincronizadas: number; errores: Array<{ fila: string; error: string }> }>(
      '/prompts/sincronizar/tabla',
      { tabla, solo_cambiadas },
      { timeout: 120_000 },
    ).then((r) => r.data),

  sincronizarTodas: (solo_cambiadas: boolean = true) =>
    api.post<{ status: string; mensaje: string }>(
      '/prompts/sincronizar/todas',
      { solo_cambiadas },
    ).then((r) => r.data),

  regenerarApis: () =>
    api.post<{ total_vista: number; upserted: number }>('/prompts/apis/regenerar').then((r) => r.data),

  getFila: (tabla: string, pk_columna: string, pk_valor: string) =>
    api.get<Record<string, unknown>>('/prompts/fila', { params: { tabla, pk_columna, pk_valor } }).then((r) => r.data),

  patchFila: (tabla: string, pk_columna: string, pk_valor: string, campos: Record<string, unknown>) =>
    api.patch<{ ok: boolean; actualizado: number }>('/prompts/fila', { tabla, pk_columna, pk_valor, campos }).then((r) => r.data),
}

export default api
