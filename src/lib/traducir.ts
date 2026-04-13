/**
 * Helper de traducción para campos de BD del sistema.
 *
 * Los textos en español viven en las columnas originales de las tablas.
 * Esta capa resuelve traducciones a otros idiomas desde un mapa cargado al login.
 * Si no hay traducción → fallback al valor original (español).
 */

let _traducciones: Record<string, string> = {}
let _locale: string = 'es'

/**
 * Inicializa el mapa de traducciones. Llamar desde AuthContext al cargar contexto.
 */
export function setTraducciones(mapa: Record<string, string>, locale: string) {
  _traducciones = mapa
  _locale = locale
}

/**
 * Traduce un campo de BD del sistema.
 *
 * @param tabla - Nombre de la tabla (ej: 'funciones', 'roles', 'aplicaciones')
 * @param campo - Nombre del campo (ej: 'nombre_funcion', 'alias_de_funcion')
 * @param clave - PK del registro (ej: codigo_funcion, id_rol como string)
 * @param valorOriginal - Valor en español desde la columna original
 * @returns Traducción si existe, o el valor original como fallback
 */
export function tr(tabla: string, campo: string, clave: string, valorOriginal: string): string {
  if (_locale === 'es') return valorOriginal
  return _traducciones[`${tabla}.${campo}.${clave}`] ?? valorOriginal
}

/**
 * Retorna el locale activo del sistema de traducciones de BD.
 */
export function getLocaleTraduccion(): string {
  return _locale
}
