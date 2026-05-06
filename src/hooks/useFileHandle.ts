'use client'

/**
 * Hook que consolida el manejo del FileSystemDirectoryHandle del directorio
 * raíz del usuario. Encapsula:
 *
 *   - Persistencia particionada por (userId, grupoActivo) en IndexedDB.
 *   - showDirectoryPicker con `id: 'serverlm-docs'` (Chrome recuerda la última
 *     carpeta seleccionada con ese id y abre desde el padre la próxima vez).
 *   - Permisos de lectura.
 *   - Comparación con `resolve()` para validar relación ancestro/descendiente.
 *   - Re-vinculación con sanity check del nombre raíz esperado.
 *
 * Para uso desde componentes React. Las funciones de lib que necesiten esto
 * fuera del árbol React deben llamar directamente las funciones de
 * `@/lib/file-handle-store`.
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getDirectoryHandle,
  setDirectoryHandle,
  ensureReadPermission,
  compararHandles,
  type RelacionHandles,
} from '@/lib/file-handle-store'

const PICKER_ID = 'serverlm-docs'

type WinPicker = Window & {
  showDirectoryPicker?: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle>
}

export interface UsoFileHandle {
  /** Handle persistido (reactivo). null si no hay. */
  handle: FileSystemDirectoryHandle | null
  /** True mientras se carga el handle inicial desde IndexedDB. */
  cargando: boolean
  /** Soporte del navegador para File System Access API. */
  soportado: boolean
  /**
   * Devuelve el handle persistido con permiso `read` activo.
   * Si no hay handle o se perdió el permiso, abre el picker, valida y guarda.
   * Retorna null si el usuario canceló o el navegador no soporta.
   */
  asegurarHandle: (opts?: { startIn?: FileSystemDirectoryHandle | string }) => Promise<FileSystemDirectoryHandle | null>
  /**
   * SIEMPRE abre el picker (usado por botón "Seleccionar carpeta").
   * NO guarda — el caller decide vía `guardarHandle()` o `revincular()`.
   */
  pedirHandle: (opts?: { startIn?: FileSystemDirectoryHandle | string }) => Promise<FileSystemDirectoryHandle | null>
  /** Guarda un handle nuevo en IndexedDB y actualiza el estado reactivo. */
  guardarHandle: (h: FileSystemDirectoryHandle | null) => Promise<void>
  /**
   * Re-vincula el handle. Abre el picker y valida que `handle.name` esté
   * incluido en `rootEsperados`. Si coincide, guarda y retorna. Si no
   * coincide, NO guarda y retorna null.
   */
  revincular: (rootEsperados: string[]) => Promise<FileSystemDirectoryHandle | null>
  /** Compara un handle nuevo con el persistido. */
  compararConPersistido: (nuevo: FileSystemDirectoryHandle) => Promise<RelacionHandles | 'sin-persistido'>
  /** Borra el handle persistido. */
  limpiar: () => Promise<void>
}

export function useFileHandle(): UsoFileHandle {
  const { usuario, grupoActivo } = useAuth()
  const userId = usuario?.codigo_usuario ?? null
  const [handle, setHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [soportado, setSoportado] = useState(true)

  useEffect(() => {
    setSoportado(typeof window !== 'undefined' && 'showDirectoryPicker' in window)
  }, [])

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    getDirectoryHandle(userId, grupoActivo).then((h) => {
      if (!cancelado) {
        setHandleState(h)
        setCargando(false)
      }
    })
    return () => { cancelado = true }
  }, [userId, grupoActivo])

  const guardarHandle = useCallback(async (h: FileSystemDirectoryHandle | null) => {
    setHandleState(h)
    await setDirectoryHandle(h, userId, grupoActivo)
  }, [userId, grupoActivo])

  const pedirHandle = useCallback(async (
    opts: { startIn?: FileSystemDirectoryHandle | string } = {},
  ): Promise<FileSystemDirectoryHandle | null> => {
    const picker = (window as WinPicker).showDirectoryPicker
    if (!picker) return null
    try {
      const pickerOpts: Record<string, unknown> = { mode: 'read', id: PICKER_ID }
      if (opts.startIn) pickerOpts.startIn = opts.startIn
      return await picker(pickerOpts)
    } catch {
      return null
    }
  }, [])

  const asegurarHandle = useCallback(async (
    opts: { startIn?: FileSystemDirectoryHandle | string } = {},
  ): Promise<FileSystemDirectoryHandle | null> => {
    let h: FileSystemDirectoryHandle | null = handle ?? await getDirectoryHandle(userId, grupoActivo)
    if (h && !(await ensureReadPermission(h))) h = null
    if (h) return h
    h = await pedirHandle(opts)
    if (h) await guardarHandle(h)
    return h
  }, [handle, userId, grupoActivo, pedirHandle, guardarHandle])

  const revincular = useCallback(async (
    rootEsperados: string[],
  ): Promise<FileSystemDirectoryHandle | null> => {
    const h = await pedirHandle()
    if (!h) return null
    if (rootEsperados.length > 0 && !rootEsperados.includes(h.name)) {
      return null
    }
    await guardarHandle(h)
    return h
  }, [pedirHandle, guardarHandle])

  const compararConPersistido = useCallback(async (
    nuevo: FileSystemDirectoryHandle,
  ): Promise<RelacionHandles | 'sin-persistido'> => {
    const persistido = handle ?? await getDirectoryHandle(userId, grupoActivo)
    if (!persistido) return 'sin-persistido'
    return compararHandles(persistido, nuevo)
  }, [handle, userId, grupoActivo])

  const limpiar = useCallback(async () => {
    await guardarHandle(null)
  }, [guardarHandle])

  return {
    handle,
    cargando,
    soportado,
    asegurarHandle,
    pedirHandle,
    guardarHandle,
    revincular,
    compararConPersistido,
    limpiar,
  }
}
