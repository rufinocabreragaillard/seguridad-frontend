// ─── Autenticación ───────────────────────────────────────────────────────────

export interface EntidadResumen {
  codigo_entidad: string
  nombre: string
  es_default: boolean
}

export interface UsuarioContexto {
  codigo_usuario: string   // email
  nombre: string
  activo: boolean
  rol_principal: string | null
  roles: string[]
  funciones: string[]
  entidades: EntidadResumen[]
  entidad_activa: string
  url_inicio: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  usuario: UsuarioContexto
}

// ─── Entidades ───────────────────────────────────────────────────────────────

export interface Entidad {
  codigo_entidad: string
  nombre: string
  descripcion?: string
  activo: boolean
  fecha_creacion?: string
}

export interface Area {
  codigo_area: string
  codigo_entidad: string
  nombre: string
  descripcion?: string
  usuario_responsable?: string
  activo: boolean
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export interface Usuario {
  codigo_usuario: string   // email
  nombre: string
  telefono?: string
  activo: boolean
  rol_principal?: string
  entidad_por_defecto?: string
  fecha_creacion?: string
  ultimo_acceso?: string
}

export interface CrearUsuarioRequest {
  codigo_usuario: string
  nombre: string
  password?: string
  telefono?: string
  rol_principal?: string
  entidad_por_defecto?: string
  invitar?: boolean
}

// ─── Roles y Funciones ───────────────────────────────────────────────────────

export interface Rol {
  codigo_rol: string
  nombre: string
  descripcion?: string
  url_inicio?: string
  activo: boolean
}

export interface Funcion {
  codigo_funcion: string
  nombre: string
  descripcion?: string
  url_default?: string
  activo: boolean
}

// ─── Parámetros ──────────────────────────────────────────────────────────────

export interface ParametroGeneral {
  codigo_parametro: string
  nombre: string
  valor: string
  tipo_dato: string
  descripcion?: string
  editable: boolean
}

export interface ParametroUsuario {
  codigo_parametro: string
  valor: string
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

export interface RegistroAuditoria {
  id: number
  fecha_hora: string
  codigo_usuario: string
  tabla_afectada: string
  operacion: string
  registro_id: string
  datos_anteriores?: Record<string, unknown>
  datos_nuevos?: Record<string, unknown>
}

// ─── Utilitarios ─────────────────────────────────────────────────────────────

export interface RespuestaPaginada<T> {
  items: T[]
  total: number
  pagina: number
  por_pagina: number
}

export interface RespuestaAPI<T = unknown> {
  data?: T
  error?: string
  mensaje?: string
}
