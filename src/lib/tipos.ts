// ─── Grupos de Entidades ─────────────────────────────────────────────────────

export interface GrupoResumen {
  codigo_grupo: string
  nombre_grupo: string
}

export interface Grupo {
  codigo_grupo: string
  nombre: string
  descripcion?: string
  tipo?: 'USUARIO' | 'ADMINISTRADOR' | 'SISTEMA'
  orden?: number
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
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
  aplicaciones?: string[]
  system_prompt?: string | null
}

export interface RolMenu {
  id_rol: number
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
  locale?: string          // Locale preferido (es, en, fr-CA, etc.)
  activo: boolean
  tipo?: 'ADMINISTRADOR' | 'USUARIO' | 'TEST' | 'SISTEMA' | null
  grupo_activo: string
  nombre_grupo?: string
  grupos: GrupoResumen[]
  id_rol_principal: number | null
  rol_principal: string | null  // codigo_rol del id_rol_principal (conveniencia)
  roles: string[]               // codigo_rol[] del usuario en el grupo activo
  id_roles: number[]            // id_rol[] equivalente
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
  alias_aplicacion?: string | null
  sidebar_ancho?: boolean
  aplicaciones_disponibles?: AplicacionResumen[]
  aplicaciones_url?: Record<string, string>
  traducciones?: Record<string, string> | null
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
  orden?: number
  fecha_creacion?: string
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
}

export interface Area {
  codigo_area: string
  codigo_entidad: string
  nombre: string
  alias?: string | null
  descripcion?: string
  usuario_responsable?: string
  codigo_area_superior?: string
  tipo_ubicacion?: 'AREA' | 'CONTENIDO' | 'VIRTUAL'
  activo: boolean
  nivel?: number
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export interface Usuario {
  codigo_usuario: string   // email
  nombre: string
  alias?: string
  locale?: string          // Locale preferido (es, en, fr-CA, etc.)
  tipo?: 'ADMINISTRADOR' | 'USUARIO' | 'TEST' | 'SISTEMA' | null
  telefono?: string
  fono_verificado?: boolean
  descripcion?: string
  activo: boolean
  id_rol_principal?: number | null
  codigo_rol_principal?: string | null  // conveniencia: codigo_rol asociado
  entidad_por_defecto?: string
  grupo_por_defecto?: string
  codigo_area?: string
  aplicacion_por_defecto?: string
  fecha_creacion?: string
  ultimo_acceso?: string
  sidebar_colapsado?: boolean
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  fecha_inicial?: string | null
  fecha_final?: string | null
}

export interface CrearUsuarioRequest {
  codigo_usuario: string
  nombre: string
  tipo?: string
  alias?: string
  password?: string
  telefono?: string
  descripcion?: string
  id_rol_principal?: number | null
  entidad_por_defecto?: string
  grupo_por_defecto?: string
  codigo_area?: string
  aplicacion_por_defecto?: string
  sidebar_colapsado?: boolean
  invitar?: boolean
  fecha_inicial?: string | null
  fecha_final?: string | null
}

// ─── Roles y Funciones ───────────────────────────────────────────────────────

export interface Rol {
  id_rol: number
  codigo_rol: string
  nombre: string
  codigo_grupo?: string | null  // null = rol global
  alias_de_rol?: string
  descripcion?: string
  url_inicio?: string
  funcion_por_defecto?: string
  codigo_aplicacion_origen?: string | null  // FK a aplicaciones, agrupa para ordenar/filtrar
  orden?: number
  tipo?: 'USUARIO' | 'ADMINISTRADOR' | 'SISTEMA'
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
  inicial?: boolean
  inicial_admin_grupo?: boolean
  inicial_admin_general?: boolean
}

export interface Funcion {
  codigo_funcion: string
  nombre: string
  descripcion?: string
  ayuda_de_funcion?: string | null
  url_funcion?: string
  alias_de_funcion?: string
  icono_de_funcion?: string
  codigo_aplicacion_origen?: string | null  // FK a aplicaciones, agrupa para ordenar/filtrar
  tipo?: 'USUARIO' | 'ADMINISTRADOR' | 'SISTEMA'
  id_modelo?: number | null  // FK a registro_llm. NULL = sin LLM
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null  // instrucciones extra al LLM
  md?: string | null
  orden?: number
  perm_select?: boolean
  perm_insert?: boolean
  perm_update?: boolean
  perm_delete?: boolean
  traducir?: boolean
}

// ─── Chat con LLM ───────────────────────────────────────────────────────────

export interface ChatConversacion {
  id_conversacion: number
  codigo_grupo: string
  codigo_usuario: string
  codigo_funcion?: string | null
  id_modelo?: number | null
  nombre_modelo?: string | null
  titulo: string
  activo: boolean
  fecha_creacion: string
  fecha_actualizacion: string
}

export interface ChatMensaje {
  id_mensaje: number
  id_conversacion: number
  rol: 'user' | 'assistant' | 'system'
  contenido: string
  fecha_creacion: string
}

export interface ChatConversacionDetalle extends ChatConversacion {
  mensajes: ChatMensaje[]
}

// ─── Aplicaciones ────────────────────────────────────────────────────────────

export interface Aplicacion {
  codigo_aplicacion: string
  nombre: string
  alias?: string | null
  descripcion?: string
  tipo?: 'USUARIO' | 'ADMINISTRADOR' | 'SISTEMA'
  sidebar_ancho?: boolean
  orden?: number
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
}

// ─── Parámetros ──────────────────────────────────────────────────────────────

export interface ParametroGeneral {
  categoria_parametro: string
  tipo_parametro: string
  valor_parametro: string
  descripcion?: string
  replica_grupo?: boolean
  visible_grupo?: boolean
  editable_grupo?: boolean
  replica_usuario?: boolean
  visible_usuario?: boolean
  editable_usuario?: boolean
}

export interface ParametroGrupo {
  codigo_grupo: string
  categoria_parametro: string
  tipo_parametro: string
  valor_parametro: string
  visible?: boolean
  editable?: boolean
}

export interface ParametroUsuario {
  categoria_parametro: string
  tipo_parametro: string
  valor_parametro: string
  visible?: boolean
  editable?: boolean
}

// ─── Datos Básicos ────────────────────────────────────────────────────────────

export interface CategoriaParametro {
  categoria_parametro: string
  nombre: string
  descripcion?: string
  activo: boolean
  orden?: number
  fecha_creacion?: string
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
}

export interface TipoParametro {
  categoria_parametro: string
  tipo_parametro: string
  nombre: string
  descripcion?: string
  activo: boolean
  orden?: number
  fecha_creacion?: string
  categorias_parametro?: { nombre: string }
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
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

// ─── Tareas: Datos Básicos ──────────────────────────────────────────────────

export interface EstadoCanonicoTarea {
  codigo_estado_canonico: string
  nombre_estado_canonico: string
  descripcion_estado_canonico?: string
  activo: boolean
}

export interface EstadoCanonicalProceso {
  codigo_estado_canonico: string
  nombre: string
  descripcion?: string
  orden?: number
}

export interface CategoriaTarea {
  codigo_categoria_tarea: string
  nombre_categoria_tarea: string
  descripcion_categoria_tarea?: string
  activo: boolean
  orden?: number
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
}

export interface TipoCanonicoTarea {
  codigo_tipo_canonico: string
  nombre_tipo_canonico: string
  descripcion_tipo_canonico?: string
  activo: boolean
}

export interface TipoConversacion {
  codigo_grupo: string
  codigo_tipo_conversacion: string
  nombre: string
  descripcion?: string
  activo: boolean
}

export interface TipoTarea {
  codigo_grupo: string
  codigo_tipo_tarea: string
  codigo_categoria_tarea: string
  codigo_tipo_canonico?: string
  nombre_tipo_tarea: string
  descripcion_tipo_tarea?: string
  activo: boolean
  orden?: number
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
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

export interface CategoriaProceso {
  codigo_categoria_proceso: string
  nombre_categoria_proceso: string
  descripcion_categoria_proceso?: string
  alias?: string
  orden?: number
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
  system_prompt?: string | null
  md?: string | null
}

export interface TipoProceso {
  codigo_categoria_proceso: string
  codigo_tipo_proceso: string
  nombre_tipo_proceso: string
  descripcion_tipo_proceso?: string
  alias?: string
  orden?: number
  ayuda?: string | null
  traducir?: boolean
  tipo?: string
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
  system_prompt?: string | null
  md?: string | null
  created_at?: string
  updated_at?: string
}

export interface EstadoProceso {
  codigo_categoria_proceso: string
  codigo_tipo_proceso: string
  codigo_estado_proceso: string
  secuencia: number
  orden?: number
  nombre_estado: string
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
  system_prompt?: string | null
  ayuda?: string | null
  traducir: boolean
  md?: string | null
}

export interface EstadoTarea {
  codigo_grupo: string
  codigo_tipo_tarea: string
  codigo_estado_tarea: string
  codigo_categoria_tarea: string
  nombre_estado_tarea: string
  descripcion_estado_tarea?: string
  codigo_estado_canonico: string
  orden: number
  activo: boolean
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
}

// ─── Tareas: Operación ──────────────────────────────────────────────────────

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

export interface Tarea {
  id_tarea: number
  codigo_grupo: string
  codigo_entidad: string
  id_conversacion?: number
  codigo_categoria_tarea: string
  codigo_tipo_tarea: string
  codigo_usuario_destinatario?: string
  codigo_ubicacion_area_asignada?: string
  codigo_usuario_asignado?: string
  nombre_tarea: string
  descripcion_tarea?: string
  adjunto?: Adjunto
  comentarios?: string
  prioridad: 'urgente' | 'alto' | 'medio' | 'bajo'
  codigo_estado_tarea: string
  costo_tarea?: number
  esfuerzo_horas?: number
  fecha_creacion?: string
  fecha_esperada?: string
  fecha_cierre?: string
  json?: unknown | null
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
  javascript?: string | null
  python_editado_manual?: boolean
  javascript_editado_manual?: boolean
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
  codigo_estado_doc?: string | null
  detalle_estado?: string | null
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
  orden?: number
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
  id_rol: number
  codigo_grupo: string
  codigo_rol?: string  // resuelto vía join
  codigo_cat_pers: string
  orden: number
  roles?: { codigo_rol: string; nombre_rol: string } | null
}

export interface CategoriaConCaracteristicas {
  categoria: CategoriaCaractPers
  caracteristicas: CaracteristicaPersona[]
}

// ─── Características Documentos (consolidadas tras migración 051) ─────────
// codigo_grupo nullable: NULL = global, visible en todos los grupos
export interface CategoriaCaractDocs {
  codigo_grupo?: string | null
  codigo_cat_docs: string
  nombre_cat_docs: string
  descripcion_cat_docs?: string | null
  es_unica_docs: boolean
  editable_en_detalle_docs: boolean
  orden?: number
  id_modelo?: number | null
  activo: boolean
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
}

export interface TipoCaractDocs {
  codigo_cat_docs: string
  codigo_tipo_docs: string
  nombre_tipo_docs: string
  descripcion?: string | null
  orden?: number
  activo: boolean
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
}

export interface CaracteristicaDocumento {
  id_caracteristica_docs: number
  codigo_documento: number
  codigo_cat_docs: string
  codigo_tipo_docs: string
  valor_texto_docs?: string | null
  valor_numerico_docs?: number | null
  valor_fecha_docs?: string | null
  comentarios?: string | null
  tipos_caract_docs?: { nombre_tipo_docs: string } | null
}

export interface CategoriaConCaracteristicasDocs {
  categoria: CategoriaCaractDocs
  caracteristicas: CaracteristicaDocumento[]
}

// ─── Registro LLM ─────────────────────────────────────────────────────────

export interface RegistroLLM {
  id_modelo: number
  proveedor: string
  nombre_tecnico: string
  nombre_visible: string
  descripcion?: string | null
  estado_valido: boolean
  fecha_validacion?: string | null
  activo: boolean
}

// ─── Estados Docs ──────────────────────────────────────────────────────────

export interface EstadoDoc {
  codigo_estado_doc: string
  nombre_estado: string
  descripcion?: string | null
  orden: number
  activo: boolean
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
}

// ─── Cola Estados Docs ─────────────────────────────────────────────────────

export interface ColaEstadoDoc {
  id_cola: number
  codigo_grupo: string
  codigo_documento: number
  codigo_estado_doc_origen?: string | null
  codigo_estado_doc_destino: string
  estado_cola: string
  prioridad: number
  fecha_cola: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
  codigo_usuario: string
  resultado?: string | null
  mensaje_error?: string | null
  modelo_usado?: string | null
  intentos: number
  max_intentos: number
  documentos?: { codigo_documento: number; nombre_documento: string; codigo_estado_doc: string | null } | null
}

// ─── SQL Ejecutados ────────────────────────────────────────────────────────

export interface SqlEjecutado {
  id: number
  fecha_inicio: string
  fecha_termino: string
  duracion_ms: number
  codigo_usuario?: string | null
  codigo_grupo?: string | null
  codigo_entidad?: string | null
  codigo_funcion?: string | null
  endpoint?: string | null
  operacion?: string | null
  tabla?: string | null
  sql_text: string
  sql_hash: string
  filas_afectadas?: number | null
  error?: string | null
  creado_en: string
}

// ─── Ubicaciones Docs ──────────────────────────────────────────────────────

export interface UbicacionDoc {
  codigo_ubicacion: string
  codigo_grupo: string
  codigo_entidad?: string | null
  nombre_ubicacion: string
  alias_ubicacion?: string | null
  descripcion?: string | null
  codigo_ubicacion_superior?: string | null
  ruta_completa?: string | null
  nivel: number
  orden: number
  activo: boolean
  ubicacion_habilitada: boolean
  tipo_ubicacion: 'AREA' | 'CONTENIDO'
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
}

// ─── Cargos ───────────────────────────────────────────────────────────────────

export interface Cargo {
  codigo_grupo: string
  codigo_entidad: string          // '' = cargo de grupo
  codigo_cargo: string
  nombre_cargo: string
  alias: string
  descripcion?: string | null
  prompt_insert?: string | null
  prompt_update?: string | null
  python_insert?: string | null
  python_update?: string | null
  system_prompt?: string | null
}

export interface RolCargo {
  codigo_cargo: string
  id_rol: number
  orden: number
  roles?: {
    id_rol: number
    codigo_rol: string
    nombre_rol: string
    codigo_grupo: string | null
    codigo_aplicacion_origen?: string | null
  }
}

// ─── Traducciones ─────────────────────────────────────────────────────────────

export interface LocaleSoportado {
  codigo: string
  nombre_nativo: string
  nombre_es: string
  activo: boolean
  es_base: boolean
  orden: number
}

export interface ProgresoTraduccion {
  idioma_actual: string | null
  idiomas_ok: string[]
  total: number
}

export interface EstadoTraducciones {
  pendiente: boolean
  generando: boolean
  progreso: ProgresoTraduccion | null
  ultima_generacion: string | null
  cambios_pendientes: number
  idiomas: string[]
  conteos_por_locale: Record<string, number>
  locales: LocaleSoportado[]
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

// ─── Espacios de Trabajo ───────────────────────────────────────────────────────
export interface EspacioTrabajo {
  id_espacio: number
  nombre_espacio: string
  descripcion?: string | null
  tipo_espacio: 'GUARDADO' | 'TEMPORAL'
  codigo_grupo: string
  codigo_entidad: string
  codigo_usuario: string
  fecha_creacion?: string | null
  fecha_termino?: string | null
  total_documentos?: number
}
