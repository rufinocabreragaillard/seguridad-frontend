// ─── Tipo de elemento (aplicaciones, funciones, roles, grupos, procesos, tareas) ──
// BD enum: USUARIO | ADMINISTRADOR | TEST | SISTEMA
// (Constraint CHECK real en tablas `aplicaciones`, `funciones`, `roles`, `grupos_entidades`,
//  `usuarios`, `procesos`, `procesos_grupo`, `tareas_grupo` — las tablas _grupo no permiten SISTEMA).

export type TipoElemento = 'USUARIO' | 'ADMINISTRADOR' | 'TEST' | 'SISTEMA'

export type VarianteInsigniaTipo = 'primario' | 'exito' | 'error' | 'advertencia' | 'neutro' | 'secundario'

export const TIPOS_ELEMENTO: TipoElemento[] = ['USUARIO', 'ADMINISTRADOR', 'TEST', 'SISTEMA']

export const TIPOS_ELEMENTO_SIN_SISTEMA: TipoElemento[] = ['USUARIO', 'ADMINISTRADOR', 'TEST']

export const ETIQUETA_TIPO: Record<TipoElemento, string> = {
  USUARIO: 'Usuario',
  ADMINISTRADOR: 'Administración',
  TEST: 'Test',
  SISTEMA: 'Sistema',
}

export const DESCRIPCION_TIPO: Record<TipoElemento, string> = {
  USUARIO: 'Usuario — disponible para cualquier rol de usuario final',
  ADMINISTRADOR: 'Administración — solo administradores de grupo',
  TEST: 'Test — entornos de prueba',
  SISTEMA: 'Sistema — solo super-admin puede asignar',
}

export const VARIANTE_TIPO: Record<TipoElemento, VarianteInsigniaTipo> = {
  USUARIO: 'exito',
  ADMINISTRADOR: 'advertencia',
  TEST: 'neutro',
  SISTEMA: 'error',
}

export function normalizarTipo(tipo?: string | null): TipoElemento {
  const t = (tipo || 'USUARIO').toUpperCase()
  // Compat: PRUEBAS migrado a TEST. Si llega PRUEBAS por cache antiguo, lo normalizamos.
  if (t === 'PRUEBAS') return 'TEST'
  return (TIPOS_ELEMENTO as string[]).includes(t) ? (t as TipoElemento) : 'USUARIO'
}

export function etiquetaTipo(tipo?: string | null): string {
  return ETIQUETA_TIPO[normalizarTipo(tipo)]
}

export function varianteTipo(tipo?: string | null): VarianteInsigniaTipo {
  return VARIANTE_TIPO[normalizarTipo(tipo)]
}

export function esTipoSensible(tipo?: string | null): boolean {
  const t = normalizarTipo(tipo)
  return t === 'SISTEMA' || t === 'ADMINISTRADOR'
}
