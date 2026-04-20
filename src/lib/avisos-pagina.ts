/**
 * Store de avisos de página — problemas detectados en runtime que el usuario debe ver.
 *
 * Casos cubiertos:
 *  - Traducciones estáticas faltantes (i18n MISSING_MESSAGE)
 *  - Timeouts de carga (useCrudPage u otros hooks colgados)
 *  - Avisos genéricos registrados manualmente por páginas/servicios
 *
 * Patrón: store externo + `useSyncExternalStore` en el componente AvisoPagina.
 * Deduplicado por `clave`. La limpieza se dispara en AdminLayout al cambiar de ruta.
 */

'use client'

export type TipoAviso = 'i18n' | 'timeout' | 'generico'

export type Aviso = {
  tipo: TipoAviso
  clave: string
  detalle: string
}

const _avisos = new Map<string, Aviso>()
let _snapshot: Aviso[] = []
const _suscriptores = new Set<() => void>()

function _rebuildYNotificar() {
  _snapshot = Array.from(_avisos.values())
  for (const cb of _suscriptores) cb()
}

export function registrarAviso(aviso: Aviso): void {
  if (_avisos.has(aviso.clave)) return
  _avisos.set(aviso.clave, aviso)
  _rebuildYNotificar()
}

export function limpiarAvisos(): void {
  if (_avisos.size === 0) return
  _avisos.clear()
  _rebuildYNotificar()
}

export function suscribir(cb: () => void): () => void {
  _suscriptores.add(cb)
  return () => { _suscriptores.delete(cb) }
}

export function obtenerAvisos(): Aviso[] {
  return _snapshot
}

// ── Helpers tipados por caso de uso ──────────────────────────────────────────

export function registrarI18nFaltante(namespace: string, key: string, locale: string): void {
  registrarAviso({
    tipo: 'i18n',
    clave: `i18n:${namespace}.${key}`,
    detalle: `${namespace}.${key} (idioma ${locale})`,
  })
}

export function registrarTimeoutCarga(descripcion: string): void {
  registrarAviso({
    tipo: 'timeout',
    clave: `timeout:${descripcion}`,
    detalle: descripcion,
  })
}
