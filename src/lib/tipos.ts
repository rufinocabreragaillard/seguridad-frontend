// ─── Grupos de Entidades ─────────────────────────────────────────────────────

export interface GrupoResumen {
  codigo_grupo: string
  nombre_grupo: string
}

export interface Grupo {
  codigo_grupo: string
  nombre: string
  descripcion?: string
  activo: boolean
}

// ─── Autenticación ───────────────────────────────────────────────────────────

export interface EntidadResumen {
  codigo_entidad: string
  nombre: string
  es_default: boolean
}

export interface FuncionMenu {
  codigo_funcion: string
  alias: string
  icono: string | null
  url: string | null
  orden: number
  codigo_aplicacion?: string | null
}

export interface RolMenu {
  codigo_rol: string
  alias: string
  orden: number
  funciones: FuncionMenu[]
}

export interface AplicacionResumen {
  codigo_aplicacion: string
  nombre: string
}

export interface UsuarioContexto {
  codigo_usuario: string   // email
  nombre: string
  alias?: string | null
  activo: boolean
  grupo_activo: string
  nombre_grupo?: string
  grupos: GrupoResumen[]
  rol_principal: string | null
  roles: string[]
  funciones: string[]
  entidades: EntidadResumen[]
  entidad_activa: string
  url_inicio: string
  sesion_duracion_minutos?: number
  menu?: RolMenu[]
  tema?: Record<string, unknown> | null
  aplicacion_por_defecto?: string | null
  aplicacion_activa?: string | null
  nombre_aplicacion?: string | null
  aplicaciones_disponibles?: AplicacionResumen[]
  aplicaciones_url?: Record<string, string>
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
  codigo_grupo?: string
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
  codigo_area_superior?: string
  activo: boolean
  nivel?: number
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export interface Usuario {
  codigo_usuario: string   // email
  nombre: string
  alias?: string
  telefono?: string
  fono_verificado?: boolean
  descripcion?: string
  activo: boolean
  rol_principal?: string
  entidad_por_defecto?: string
  grupo_por_defecto?: string
  codigo_area_por_defecto?: string
  aplicacion_por_defecto?: string
  fecha_creacion?: string
  ultimo_acceso?: string
}

export interface CrearUsuarioRequest {
  codigo_usuario: string
  nombre: string
  alias?: string
  password?: string
  telefono?: string
  descripcion?: string
  rol_principal?: string
  entidad_por_defecto?: string
  grupo_por_defecto?: string
  codigo_area_por_defecto?: string
  invitar?: boolean
}

// ─── Roles y Funciones ───────────────────────────────────────────────────────

export interface Rol {
  codigo_rol: string
  nombre: string
  codigo_grupo?: string
  alias_de_rol?: string
  descripcion?: string
  url_inicio?: string
  funcion_por_defecto?: string
  activo: boolean
}

export interface Funcion {
  codigo_funcion: string
  nombre: string
  descripcion?: string
  url_funcion?: string
  alias_de_funcion?: string
  icono_de_funcion?: string
  activo: boolean
}

// ─── Aplicaciones ────────────────────────────────────────────────────────────

export interface Aplicacion {
  codigo_aplicacion: string
  nombre: string
  descripcion?: string
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

// ─── Datos Básicos ────────────────────────────────────────────────────────────

export interface CategoriaParametro {
  categoria_parametro: string
  nombre: string
  descripcion?: string
  activo: boolean
  fecha_creacion?: string
}

export interface TipoParametro {
  categoria_parametro: string
  tipo_parametro: string
  nombre: string
  descripcion?: string
  activo: boolean
  fecha_creacion?: string
  categorias_parametro?: { nombre: string }
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

export interface RegistroAuditoria {
  id_auditoria: number
  fecha_hora: string
  codigo_usuario: string
  tabla_afectada: string
  operacion: string
  codigo_registro: string
  codigo_entidad?: string
  codigo_grupo?: string
  datos_anteriores?: Record<string, unknown>
  datos_nuevos?: Record<string, unknown>
}

// ─── Compromisos: Datos Básicos ─────────────────────────────────────────────

export interface EstadoCanonicoConversacion {
  codigo_estado_canonico: string
  nombre: string
  activo: boolean
}

export interface EstadoCanonicoCompromiso {
  codigo_estado_canonico: string
  nombre: string
  activo: boolean
}

export interface TipoConversacion {
  codigo_grupo: string
  codigo_tipo_conversacion: string
  nombre: string
  descripcion?: string
  activo: boolean
}

export interface TipoCompromiso {
  codigo_grupo: string
  codigo_tipo_compromiso: string
  nombre: string
  descripcion?: string
  activo: boolean
}

export interface EstadoConversacion {
  codigo_grupo: string
  codigo_tipo_conversacion: string
  codigo_estado_conversacion: string
  nombre: string
  codigo_estado_canonico: string
  orden: number
  activo: boolean
}

export interface EstadoCompromiso {
  codigo_grupo: string
  codigo_tipo_compromiso: string
  codigo_estado_compromiso: string
  nombre: string
  codigo_estado_canonico: string
  orden: number
  activo: boolean
}

// ─── Compromisos: Operación ─────────────────────────────────────────────────

export interface Adjunto {
  nombre: string
  url: string
  tipo_mime: string
  tamano: number
}

export interface Conversacion {
  id_conversacion: number
  codigo_grupo: string
  codigo_entidad: string
  codigo_tipo_conversacion: string
  tipo_id_persona?: string
  id_persona?: string
  verificador_persona?: string
  nombre_persona: string
  telefono_persona?: number
  correo_persona?: string
  direccion_persona?: string
  forma_alternativa_contacto?: string
  tipo_representacion?: string
  asunto: string
  comentarios?: string
  adjunto?: Adjunto
  fecha_conversacion: string
  codigo_usuario_responsable: string
  esfuerzo_horas?: number
  costo_conversacion?: number
  codigo_estado_conversacion: string
  fecha_ingreso?: string
  fecha_cierre?: string
}

export interface ParticipanteConversacion {
  id_conversacion: number
  id_participante: number
  tipo_id_persona?: string
  id_persona?: string
  nombre_persona: string
}

export interface Compromiso {
  id_compromiso: number
  codigo_grupo: string
  codigo_entidad: string
  id_conversacion?: number
  codigo_tipo_compromiso: string
  codigo_usuario_destinatario?: string
  codigo_area_asignada?: string
  codigo_usuario_asignado?: string
  asunto: string
  descripcion?: string
  adjunto?: Adjunto
  comentarios?: string
  prioridad: 'urgente' | 'alto' | 'medio' | 'bajo'
  codigo_estado_compromiso: string
  costo_compromiso?: number
  esfuerzo_horas?: number
  fecha_creacion?: string
  fecha_esperada?: string
  fecha_cierre?: string
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export interface Documento {
  codigo_documento: number
  codigo_grupo: string
  codigo_entidad?: string | null
  nombre_documento: string
  ubicacion_documento?: string | null
  resumen_documento?: string | null
  fecha_modificacion?: string | null
  tamano_kb?: number | null
  activo: boolean
}

// ─── Personas ───────────────────────────────────────────────────────────────

export interface TipoDocumentoPersona {
  codigo_grupo: string
  codigo_tipo_doc: string
  nombre: string
  descripcion?: string | null
  activo: boolean
}

export interface Persona {
  id_persona: number
  codigo_grupo: string
  codigo_entidad?: string | null
  nombre: string
  codigo_tipo_doc?: string | null
  documento_id?: string | null
  activo: boolean
}

export interface CategoriaCaractPers {
  codigo_grupo: string
  codigo_cat_pers: string
  nombre_cat_pers: string
  descripcion_cat_pers?: string | null
  es_unica_pers: boolean
  editable_en_detalle_pers: boolean
  activo: boolean
}

export interface TipoCaractPers {
  codigo_grupo: string
  codigo_cat_pers: string
  codigo_tipo_pers: string
  nombre_tipo_pers: string
  activo: boolean
}

export interface CaracteristicaPersona {
  id_caracteristica_pers: number
  id_persona: number
  codigo_grupo: string
  codigo_cat_pers: string
  codigo_tipo_pers: string
  valor_texto_pers?: string | null
  valor_numerico_pers?: number | null
  valor_fecha_pers?: string | null
  tipos_caract_pers?: { nombre_tipo_pers: string } | null
}

export interface RolCaractPers {
  codigo_grupo: string
  codigo_rol: string
  codigo_cat_pers: string
  orden: number
  roles?: { nombre_rol: string; activo: boolean } | null
}

export interface CategoriaConCaracteristicas {
  categoria: CategoriaCaractPers
  caracteristicas: CaracteristicaPersona[]
}

// ─── Características Documentos ─────────────────────────────────────────────
export interface CategoriaCaractDocs {
  codigo_grupo: string
  codigo_cat_docs: string
  nombre_cat_docs: string
  descripcion_cat_docs?: string | null
  es_unica_docs: boolean
  editable_en_detalle_docs: boolean
  activo: boolean
}

export interface TipoCaractDocs {
  codigo_grupo: string
  codigo_cat_docs: string
  codigo_tipo_docs: string
  nombre_tipo_docs: string
  activo: boolean
}

export interface CaracteristicaDocumento {
  id_caracteristica_docs: number
  codigo_documento: number
  codigo_grupo: string
  codigo_cat_docs: string
  codigo_tipo_docs: string
  valor_texto_docs?: string | null
  valor_numerico_docs?: number | null
  valor_fecha_docs?: string | null
  tipos_caract_docs?: { nombre_tipo_docs: string } | null
}

export interface RolCaractDocs {
  codigo_grupo: string
  codigo_rol: string
  codigo_cat_docs: string
  orden: number
  roles?: { nombre_rol: string; activo: boolean } | null
}

export interface CategoriaConCaracteristicasDocs {
  categoria: CategoriaCaractDocs
  caracteristicas: CaracteristicaDocumento[]
}

// ─── Ubicaciones Docs ──────────────────────────────────────────────────────

export interface UbicacionDoc {
  codigo_ubicacion: string
  codigo_grupo: string
  codigo_entidad?: string | null
  nombre_ubicacion: string
  descripcion?: string | null
  codigo_ubicacion_superior?: string | null
  ruta_completa?: string | null
  nivel: number
  orden: number
  activo: boolean
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
