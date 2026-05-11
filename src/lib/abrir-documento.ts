import { getDirectoryHandle, setDirectoryHandle, ensureReadPermission } from './file-handle-store'
import { abrirArchivoPorRuta } from './extraer-texto'

type WinWithPicker = Window & {
  showDirectoryPicker?: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle>
}

const IS_CLIENT_MODE = process.env.NEXT_PUBLIC_MODE === 'client'
const API_LOCAL = 'http://localhost:27182'

// ── Mensajes i18n ─────────────────────────────────────────────────────────
// Esta librería no es componente React, no puede usar useTranslations.
// Los callers deben pasar `mensajes` con las traducciones ya resueltas.
// Si no se pasan, se usan los defaults en español (fallback).
export interface MensajesAbrirDocumento {
  selectCarpetaRaiz: string
  permisoCaducado: string
  noSeEncontroArchivo: string
  navegadorNoSoporta: string
  permisoDenegado: string
  noSeEncontroArchivoEn: (ubicacion: string) => string
  sinUbicacionRegistrada: string
  errorAlAbrir: (error: string) => string
  errorAlDescargar: (error: string) => string
  noHayCarpetaRaiz: string
  noSeEncontroPath: (ubicacion: string) => string
  abriendo: string
  cargandoDocumento: string
  noPreviewBrowser: string
  descargarArchivo: string
}

const MENSAJES_DEFAULT: MensajesAbrirDocumento = {
  selectCarpetaRaiz: 'Selecciona primero una carpeta raíz en Adm. Indexación Docs.',
  permisoCaducado: 'Permiso de lectura del directorio caducado. Vuelve a seleccionar la carpeta raíz.',
  noSeEncontroArchivo: 'No se encontró el archivo.',
  navegadorNoSoporta: 'Tu navegador no soporta File System Access API. Usa Chrome o Edge.',
  permisoDenegado: 'Permiso de lectura denegado.',
  noSeEncontroArchivoEn: (u) => `No se encontró el archivo: ${u}`,
  sinUbicacionRegistrada: 'Este documento no tiene ubicación registrada.',
  errorAlAbrir: (e) => `Error al abrir: ${e}`,
  errorAlDescargar: (e) => `Error al descargar: ${e}`,
  noHayCarpetaRaiz: 'No hay carpeta raíz seleccionada. Ve a "Procesar Documentos" y selecciona el directorio raíz primero.',
  noSeEncontroPath: (u) => `No se encontró: ${u}`,
  abriendo: 'Abriendo…',
  cargandoDocumento: 'Cargando documento…',
  noPreviewBrowser: 'Este tipo de archivo no se puede previsualizar en el navegador.',
  descargarArchivo: 'Descargar archivo',
}

let mensajesActivos: MensajesAbrirDocumento = MENSAJES_DEFAULT

/**
 * Setter para inyectar mensajes traducidos desde un componente React.
 * Llamar desde un hook que escucha cambios de locale.
 */
export function setMensajesAbrirDocumento(m: Partial<MensajesAbrirDocumento>): void {
  mensajesActivos = { ...MENSAJES_DEFAULT, ...m }
}

async function abrirViaApiLocal(ruta: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_LOCAL}/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruta }),
    })
    return res.ok
  } catch {
    return false
  }
}

function _escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;'
  ))
}

// Tipos que el browser puede renderizar inline; el resto se entrega como descarga
// para evitar mostrar una pestaña en blanco con título correcto pero sin contenido.
const _INLINE_EXT = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'txt', 'md', 'csv', 'log', 'json', 'xml', 'html', 'htm',
  'mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov',
])

export function esVisualizableEnBrowser(nombreOUbicacion: string | null | undefined): boolean {
  if (!nombreOUbicacion) return false
  const ext = (nombreOUbicacion.split('.').pop() || '').toLowerCase()
  return _INLINE_EXT.has(ext)
}

function _abrirEnPestanaConNombre(blob: Blob, nombre: string, winPreAbierta?: Window | null): void {
  const ext = (nombre.split('.').pop() || '').toLowerCase()
  const inline = _INLINE_EXT.has(ext)
  const url = URL.createObjectURL(blob)
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)

  if (!inline) {
    const titulo = _escapeHtml(nombre)
    const src = _escapeHtml(url)
    const noPreview = _escapeHtml(mensajesActivos.noPreviewBrowser)
    const dl = _escapeHtml(mensajesActivos.descargarArchivo)
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;background:#1f1f1f;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;gap:1rem">
<p style="color:#ccc;font-size:15px">${noPreview}</p>
<p style="color:#888;font-size:13px">${titulo}</p>
<a href="${src}" download="${titulo}" style="color:#6ab0f5;font-size:14px">${dl}</a>
</body>
</html>`
    const wrapperBlob = new Blob([html], { type: 'text/html' })
    const wrapperUrl = URL.createObjectURL(wrapperBlob)
    setTimeout(() => URL.revokeObjectURL(wrapperUrl), 5 * 60_000)
    if (winPreAbierta && !winPreAbierta.closed) {
      winPreAbierta.location.replace(wrapperUrl)
    } else {
      window.open(wrapperUrl, '_blank')
    }
    return
  }

  const isPdf = (nombre.split('.').pop() || '').toLowerCase() === 'pdf'

  if (isPdf) {
    const setTitle = (win: Window) => {
      const trySetTitle = (attempts: number) => {
        if (win.closed) return
        try { win.document.title = nombre } catch { /* cross-origin tras navegación */ }
        if (attempts > 0) setTimeout(() => trySetTitle(attempts - 1), 300)
      }
      trySetTitle(5)
    }
    if (winPreAbierta && !winPreAbierta.closed) {
      winPreAbierta.location.replace(url)
      setTitle(winPreAbierta)
      return
    }
    const win = window.open(url, '_blank')
    if (win) {
      setTitle(win)
    } else {
      window.dispatchEvent(new CustomEvent('serverlm:preview', { detail: { url, nombre } }))
    }
    return
  }

  const titulo = _escapeHtml(nombre)
  const src = _escapeHtml(url)
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;padding:0;overflow:hidden;background:#1f1f1f">
<iframe src="${src}" style="width:100vw;height:100vh;border:0" title="${titulo}"></iframe>
</body>
</html>`
  const wrapperBlob = new Blob([html], { type: 'text/html' })
  const wrapperUrl = URL.createObjectURL(wrapperBlob)

  if (winPreAbierta && !winPreAbierta.closed) {
    winPreAbierta.location.replace(wrapperUrl)
    setTimeout(() => URL.revokeObjectURL(wrapperUrl), 5 * 60_000)
    return
  }

  const win = window.open(wrapperUrl, '_blank')
  if (win) {
    setTimeout(() => URL.revokeObjectURL(wrapperUrl), 5 * 60_000)
  } else {
    URL.revokeObjectURL(wrapperUrl)
    window.dispatchEvent(new CustomEvent('serverlm:preview', { detail: { url, nombre } }))
  }
}

export function abrirVentanaLoading(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  const titulo = _escapeHtml(mensajesActivos.abriendo)
  const cargando = _escapeHtml(mensajesActivos.cargandoDocumento)
  win.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;background:#1f1f1f;display:flex;align-items:center;justify-content:center;height:100vh">
<p style="color:#888;font-family:sans-serif;font-size:14px">${cargando}</p>
</body>
</html>`)
  win.document.close()
  return win
}

export async function cargarBlobDocumento(
  ubicacion: string,
  onBlob: (blobUrl: string, nombre: string) => void,
  onError: (msg: string) => void,
  userId?: string | null,
  grupoActivo?: string | null,
  handlePreseleccionado?: FileSystemDirectoryHandle | null,
): Promise<void> {
  if (IS_CLIENT_MODE) {
    try {
      const res = await fetch(`${API_LOCAL}/descargar?ruta=${encodeURIComponent(ubicacion)}`)
      if (res.ok) {
        const blob = await res.blob()
        const nombre = ubicacion.split(/[\\/]/).pop() || 'documento'
        const url = URL.createObjectURL(blob)
        onBlob(url, nombre)
        return
      }
    } catch { /* fallback */ }
  }

  const handle = handlePreseleccionado || await getDirectoryHandle(userId, grupoActivo)
  if (!handle) { onError(mensajesActivos.selectCarpetaRaiz); return }
  const ok = await ensureReadPermission(handle)
  if (!ok) { onError(mensajesActivos.permisoCaducado); return }
  const fileHandle = await abrirArchivoPorRuta(handle, ubicacion)
  if (!fileHandle) { onError(mensajesActivos.noSeEncontroArchivo); return }
  const file = await fileHandle.getFile()
  const url = URL.createObjectURL(file)
  onBlob(url, file.name)
}

async function abrirViaFileSystemApi(
  ubicacion: string,
  winPreAbierta?: Window | null,
  userId?: string | null,
  grupoActivo?: string | null,
  handlePreseleccionado?: FileSystemDirectoryHandle | null,
): Promise<void> {
  let handle = handlePreseleccionado || await getDirectoryHandle(userId, grupoActivo)

  if (!handle) {
    const picker = (window as WinWithPicker).showDirectoryPicker
    if (!picker) {
      if (winPreAbierta) winPreAbierta.close()
      alert(mensajesActivos.navegadorNoSoporta)
      return
    }
    try {
      handle = await picker({ mode: 'read', id: 'serverlm-docs' })
      await setDirectoryHandle(handle, userId, grupoActivo)
    } catch {
      if (winPreAbierta) winPreAbierta.close()
      return
    }
  }

  const ok = await ensureReadPermission(handle)
  if (!ok) { if (winPreAbierta) winPreAbierta.close(); alert(mensajesActivos.permisoDenegado); return }
  const fileHandle = await abrirArchivoPorRuta(handle, ubicacion)
  if (!fileHandle) { if (winPreAbierta) winPreAbierta.close(); alert(mensajesActivos.noSeEncontroArchivoEn(ubicacion)); return }
  const file = await fileHandle.getFile()
  _abrirEnPestanaConNombre(file, file.name, winPreAbierta)
}

export async function seleccionarDirectorioRaiz(
  userId?: string | null,
  grupoActivo?: string | null,
): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as WinWithPicker).showDirectoryPicker
  if (!picker) {
    alert(mensajesActivos.navegadorNoSoporta)
    return null
  }
  try {
    const handle = await picker({ mode: 'read', id: 'serverlm-docs' })
    await setDirectoryHandle(handle, userId, grupoActivo)
    return handle
  } catch {
    return null
  }
}

export type ResultadoHandle = { continuar: boolean; handle: FileSystemDirectoryHandle | null }

export async function asegurarHandleConPermiso(
  userId?: string | null,
  grupoActivo?: string | null,
): Promise<ResultadoHandle> {
  if (IS_CLIENT_MODE) return { continuar: true, handle: null }
  const handle = await getDirectoryHandle(userId, grupoActivo)
  if (handle) {
    const ok = await ensureReadPermission(handle)
    if (ok) return { continuar: true, handle }
  }
  const nuevo = await seleccionarDirectorioRaiz(userId, grupoActivo)
  if (!nuevo) return { continuar: false, handle: null }
  return { continuar: true, handle: nuevo }
}

export async function abrirDocumento(
  ubicacion: string | null | undefined,
  winPreAbierta?: Window | null,
  userId?: string | null,
  grupoActivo?: string | null,
  handlePreseleccionado?: FileSystemDirectoryHandle | null,
): Promise<void> {
  if (!ubicacion) { if (winPreAbierta) winPreAbierta.close(); alert(mensajesActivos.sinUbicacionRegistrada); return }

  if (IS_CLIENT_MODE) {
    const ok = await abrirViaApiLocal(ubicacion)
    if (ok) { if (winPreAbierta) winPreAbierta.close(); return }
  }

  try {
    await abrirViaFileSystemApi(ubicacion, winPreAbierta, userId, grupoActivo, handlePreseleccionado)
  } catch (e) {
    if (winPreAbierta) winPreAbierta.close()
    alert(mensajesActivos.errorAlAbrir(e instanceof Error ? e.message : String(e)))
  }
}

function _triggerDownload(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre || 'documento'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function descargarViaApiLocal(ruta: string, nombre: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_LOCAL}/descargar?ruta=${encodeURIComponent(ruta)}`)
    if (!res.ok) return false
    const blob = await res.blob()
    _triggerDownload(blob, nombre)
    return true
  } catch {
    return false
  }
}

async function descargarViaFileSystemApi(
  ubicacion: string,
  nombre: string,
  userId?: string | null,
  grupoActivo?: string | null,
): Promise<void> {
  const handle = await getDirectoryHandle(userId, grupoActivo)
  if (!handle) {
    alert(mensajesActivos.noHayCarpetaRaiz)
    return
  }
  const ok = await ensureReadPermission(handle)
  if (!ok) { alert(mensajesActivos.permisoDenegado); return }
  const fileHandle = await abrirArchivoPorRuta(handle, ubicacion)
  if (!fileHandle) { alert(mensajesActivos.noSeEncontroPath(ubicacion)); return }
  const file = await fileHandle.getFile()
  _triggerDownload(file, nombre || file.name)
}

export async function descargarDocumento(
  ubicacion: string | null | undefined,
  nombre: string = 'documento',
  userId?: string | null,
  grupoActivo?: string | null,
): Promise<void> {
  if (!ubicacion) { alert(mensajesActivos.sinUbicacionRegistrada); return }

  if (/^https?:\/\//i.test(ubicacion)) {
    const a = document.createElement('a')
    a.href = ubicacion
    a.download = nombre
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return
  }

  if (IS_CLIENT_MODE) {
    const ok = await descargarViaApiLocal(ubicacion, nombre)
    if (ok) return
  }

  try {
    await descargarViaFileSystemApi(ubicacion, nombre, userId, grupoActivo)
  } catch (e) {
    alert(mensajesActivos.errorAlDescargar(e instanceof Error ? e.message : String(e)))
  }
}
