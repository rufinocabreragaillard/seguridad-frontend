/**
 * Helper centralizado: obtiene el FileSystemDirectoryHandle del directorio
 * raíz del grupo activo, validando contra la "raíz madre" registrada en BD.
 *
 * Flujo:
 *   1. Resolver raíz madre vía obtenerRaizMadre(grupoActivo).
 *   2. Buscar handle particionado por (userId, grupoActivo, codigoRaiz)
 *      en IndexedDB. Si existe, validar nombre y permiso.
 *   3. Si falla (no existe / nombre no coincide / sin permiso) → abrir
 *      showDirectoryPicker. Validar que el nombre coincida con la raíz BD
 *      (case-insensitive). Si coincide, persistir bajo la key particionada.
 *      Si no coincide, devolver error claro y NO guardar.
 */

import {
  getDirectoryHandle,
  setDirectoryHandle,
  ensureReadPermission,
} from './file-handle-store'
import { obtenerRaizMadre, type RaizMadre } from './raiz-grupo'

type WinWithPicker = Window & {
  showDirectoryPicker?: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle>
}

export interface ResultadoHandle {
  handle: FileSystemDirectoryHandle | null
  raiz: RaizMadre | null
  error?: string
  aviso?: string
}

export interface OpcionesObtenerHandle {
  userId: string | null | undefined
  grupoActivo: string | null | undefined
  /** Si es true (default) abre el picker cuando no hay handle válido. */
  abrirPickerSiHaceFalta?: boolean
}

export async function obtenerHandleDirectorio(
  opts: OpcionesObtenerHandle,
): Promise<ResultadoHandle> {
  const { userId, grupoActivo } = opts
  const abrirPicker = opts.abrirPickerSiHaceFalta !== false

  const raiz = await obtenerRaizMadre(grupoActivo)
  if (!raiz) {
    // Sin raíz BD. Caemos a comportamiento legacy: handle por (user, grupo)
    // sin validación de nombre.
    const stored = await getDirectoryHandle(userId, grupoActivo)
    if (stored && (await ensureReadPermission(stored))) {
      return { handle: stored, raiz: null }
    }
    if (!abrirPicker) return { handle: null, raiz: null }
    const picker = (window as WinWithPicker).showDirectoryPicker
    if (!picker) {
      return {
        handle: null,
        raiz: null,
        error: 'Tu navegador no soporta File System Access API. Usa Chrome o Edge.',
      }
    }
    try {
      const handle = await picker({ mode: 'read' })
      await setDirectoryHandle(handle, userId, grupoActivo)
      return { handle, raiz: null }
    } catch {
      return { handle: null, raiz: null }
    }
  }

  const nombreEsperado = raiz.nombre.toLowerCase()

  // 1) Intentar handle particionado por raíz
  const stored = await getDirectoryHandle(userId, grupoActivo, raiz.codigo)
  if (
    stored &&
    stored.name.toLowerCase() === nombreEsperado &&
    (await ensureReadPermission(stored))
  ) {
    return { handle: stored, raiz, aviso: raiz.aviso }
  }

  if (!abrirPicker) {
    return { handle: null, raiz, aviso: raiz.aviso }
  }

  // 2) Pedir al usuario vía picker
  const picker = (window as WinWithPicker).showDirectoryPicker
  if (!picker) {
    return {
      handle: null,
      raiz,
      error: 'Tu navegador no soporta File System Access API. Usa Chrome o Edge.',
    }
  }
  let handle: FileSystemDirectoryHandle
  try {
    handle = await picker({ mode: 'read' })
  } catch {
    return { handle: null, raiz, aviso: raiz.aviso }
  }

  if (handle.name.toLowerCase() !== nombreEsperado) {
    return {
      handle: null,
      raiz,
      error: `Seleccionaste '${handle.name}' pero el grupo espera '${raiz.nombre}'. Selecciona el directorio correcto.`,
    }
  }

  await setDirectoryHandle(handle, userId, grupoActivo, raiz.codigo)
  // Mantener compat con consumidores legacy que leen sin codigoRaiz.
  await setDirectoryHandle(handle, userId, grupoActivo)
  return { handle, raiz, aviso: raiz.aviso }
}
