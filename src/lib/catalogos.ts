/**
 * Caché en memoria de catálogos pequeños del backend.
 *
 * Estos endpoints devuelven datos que cambian raramente (solo cuando un
 * superadmin edita el catálogo via mantenedor). Antes se pedían una vez
 * por pantalla — con 6 pantallas que usan estados_docs eso son 6 requests
 * idénticos por sesión.
 *
 * Patrón: singleton por proceso (módulo). Primera llamada hace fetch;
 * siguientes devuelven el resultado cacheado de inmediato. Si dos pantallas
 * los piden en paralelo, comparten la misma Promise (no se duplica).
 *
 * Para invalidar (ej. cuando el admin edita el catálogo en su mantenedor):
 *   import { invalidarCatalogo } from '@/lib/catalogos'
 *   invalidarCatalogo('estadosDocs')
 *
 * El logout también limpia todo el caché.
 */

import { estadosDocsApi, procesosApi, traduccionesApi } from './api'
import type { Proceso } from './api'
import type { EstadoDoc, LocaleSoportado } from './tipos'

type CatalogoKey = 'estadosDocs' | 'procesosDocs' | 'localesActivos'

// Caché: mapa de promesas (no datos resueltos). Si está pendiente, los
// callers paralelos hacen await sobre la misma Promise.
const _cache: Partial<Record<CatalogoKey, Promise<unknown>>> = {}

function cargar<T>(key: CatalogoKey, fetcher: () => Promise<T>): Promise<T> {
  let p = _cache[key] as Promise<T> | undefined
  if (!p) {
    p = fetcher().catch((e) => {
      // Si falla, limpiar para que el próximo intento haga fetch nuevo
      delete _cache[key]
      throw e
    })
    _cache[key] = p
  }
  return p
}

export const getEstadosDocs = (): Promise<EstadoDoc[]> =>
  cargar('estadosDocs', () => estadosDocsApi.listar())

export const getProcesosDocs = (): Promise<Proceso[]> =>
  cargar('procesosDocs', () => procesosApi.listar('PROCESAR_DOCS'))

export const getLocalesActivos = (): Promise<LocaleSoportado[]> =>
  cargar('localesActivos', () => traduccionesApi.listarLocalesActivos())

export function invalidarCatalogo(key: CatalogoKey): void {
  delete _cache[key]
}

export function invalidarTodosLosCatalogos(): void {
  ;(Object.keys(_cache) as CatalogoKey[]).forEach((k) => delete _cache[k])
}
