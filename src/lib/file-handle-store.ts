/**
 * Persistencia compartida del FileSystemDirectoryHandle del directorio raíz
 * que el usuario seleccionó. Particionado por (userId, grupoActivo) para que
 * cada combinación usuario/grupo recuerde su propio directorio.
 *
 * Se guarda en IndexedDB para que sobreviva recargas y pueda usarse desde
 * otras pantallas (ej. /documentos para "abrir documento original").
 *
 * El handle queda válido mientras el usuario no limpie la sesión del browser.
 * El permiso de lectura puede caducar y hay que repedirlo con
 * `requestPermission`.
 */

const IDB_NAME = 'serverlm-docs'
const IDB_STORE = 'handles'
const IDB_KEY_LEGACY = 'dirHandle' // clave usada por la versión anterior (sin partición)
const IDB_NAME_LEGACY = 'cab-procesar-docs'

function buildKey(userId?: string | null, grupoActivo?: string | null): string {
  // Si no hay user/grupo, caer al esquema legacy para no romper consumidores que aún
  // no propagan el contexto. Se logueará en consola para detectar.
  if (!userId || !grupoActivo) return IDB_KEY_LEGACY
  return `dirHandle:${userId}:${grupoActivo}`
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getDirectoryHandle(
  userId?: string | null,
  grupoActivo?: string | null,
): Promise<FileSystemDirectoryHandle | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await idbOpen()
    const key = buildKey(userId, grupoActivo)
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setDirectoryHandle(
  handle: FileSystemDirectoryHandle | null,
  userId?: string | null,
  grupoActivo?: string | null,
) {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await idbOpen()
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const key = buildKey(userId, grupoActivo)
    if (handle) tx.objectStore(IDB_STORE).put(handle, key)
    else tx.objectStore(IDB_STORE).delete(key)
  } catch {
    /* ignore */
  }
}

/**
 * Verifica el permiso 'read' del handle. Si no esta concedido, lo solicita.
 * Devuelve true si quedo concedido, false en cualquier otro caso.
 */
export async function ensureReadPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  // El tipo FileSystemHandle.queryPermission no esta en lib.dom todavia.
  type WithPermission = FileSystemDirectoryHandle & {
    queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
    requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  }
  const h = handle as WithPermission
  try {
    if (h.queryPermission) {
      const estado = await h.queryPermission({ mode: 'read' })
      if (estado === 'granted') return true
    }
    if (h.requestPermission) {
      const estado = await h.requestPermission({ mode: 'read' })
      return estado === 'granted'
    }
  } catch {
    return false
  }
  return false
}

/**
 * Elimina la base de datos antigua `cab-procesar-docs` (esquema sin partición).
 * Se llama una sola vez al cargar la app para liberar el handle huérfano.
 */
let _purgaEjecutada = false
export async function purgarBaseAntigua(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  if (_purgaEjecutada) return
  _purgaEjecutada = true
  try {
    indexedDB.deleteDatabase(IDB_NAME_LEGACY)
  } catch {
    /* ignore */
  }
}

export type RelacionHandles =
  | 'igual'
  | 'nuevo-es-descendiente'
  | 'nuevo-es-ancestro'
  | 'no-relacionados'

/**
 * Determina la relación entre dos FileSystemDirectoryHandle usando `resolve()`.
 *
 *   existente.resolve(nuevo) === [] → mismo directorio
 *   existente.resolve(nuevo) === [...] → nuevo es descendiente de existente
 *   nuevo.resolve(existente) === [...] → nuevo es ancestro de existente
 *   ambos null → directorios laterales sin relación
 */
export async function compararHandles(
  existente: FileSystemDirectoryHandle,
  nuevo: FileSystemDirectoryHandle,
): Promise<RelacionHandles> {
  type WithResolve = FileSystemDirectoryHandle & {
    resolve: (other: FileSystemHandle) => Promise<string[] | null>
  }
  const e = existente as WithResolve
  const n = nuevo as WithResolve

  const desc = await e.resolve(nuevo).catch(() => null)
  if (desc !== null) return desc.length === 0 ? 'igual' : 'nuevo-es-descendiente'

  const anc = await n.resolve(existente).catch(() => null)
  if (anc !== null) return anc.length === 0 ? 'igual' : 'nuevo-es-ancestro'

  return 'no-relacionados'
}
