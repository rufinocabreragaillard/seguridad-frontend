import { getDirectoryHandle, setDirectoryHandle, ensureReadPermission } from './file-handle-store'
import { abrirArchivoPorRuta } from './extraer-texto'

type WinWithPicker = Window & {
  showDirectoryPicker?: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle>
}

const IS_CLIENT_MODE = process.env.NEXT_PUBLIC_MODE === 'client'
const API_LOCAL = 'http://localhost:27182'

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
    // Para tipos que el browser no renderiza inline, abrir en pestaña nueva
    // con un wrapper HTML que muestra el nombre del archivo como título y un
    // enlace de descarga. No descargar automáticamente — el usuario eligió "ver".
    const titulo = _escapeHtml(nombre)
    const src = _escapeHtml(url)
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;background:#1f1f1f;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;gap:1rem">
<p style="color:#ccc;font-size:15px">Este tipo de archivo no se puede previsualizar en el navegador.</p>
<p style="color:#888;font-size:13px">${titulo}</p>
<a href="${src}" download="${titulo}" style="color:#6ab0f5;font-size:14px">Descargar archivo</a>
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

  // Envuelve el blob en un HTML con <title> real + <object> para mostrar el
  // nombre correcto en la pestaña y en el diálogo de descarga del visor.
  // <object> puede renderizar blobs anidados en Chrome (a diferencia de iframe).
  const titulo = _escapeHtml(nombre)
  const src = _escapeHtml(url)
  const isPdf = (nombre.split('.').pop() || '').toLowerCase() === 'pdf'
  const html = isPdf
    ? `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;padding:0;overflow:hidden;background:#1f1f1f">
<object data="${src}" type="application/pdf" style="width:100vw;height:100vh">
  <p style="color:#ccc;font-family:sans-serif;padding:2rem">
    No se puede mostrar el PDF en el navegador.
    <a href="${src}" download="${titulo}" style="color:#6ab0f5">Descargar</a>
  </p>
</object>
</body>
</html>`
    : `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;padding:0;overflow:hidden;background:#1f1f1f">
<iframe src="${src}" style="width:100vw;height:100vh;border:0" title="${titulo}"></iframe>
</body>
</html>`
  const wrapperBlob = new Blob([html], { type: 'text/html' })
  const wrapperUrl = URL.createObjectURL(wrapperBlob)
  // No revocar el wrapperUrl si lo usamos en el modal (el modal lo revoca al cerrar)

  if (winPreAbierta && !winPreAbierta.closed) {
    winPreAbierta.location.replace(wrapperUrl)
    setTimeout(() => URL.revokeObjectURL(wrapperUrl), 5 * 60_000)
    return
  }

  const win = window.open(wrapperUrl, '_blank')
  if (win) {
    setTimeout(() => URL.revokeObjectURL(wrapperUrl), 5 * 60_000)
  } else {
    // Popup bloqueado: mostrar en modal inline usando el blob original (no el wrapper)
    URL.revokeObjectURL(wrapperUrl)
    window.dispatchEvent(new CustomEvent('serverlm:preview', { detail: { url, nombre } }))
  }
}

// Abre una ventana de loading síncronamente (dentro de un click handler)
// para evitar que el popup blocker la bloquee cuando hay awaits intermedios.
export function abrirVentanaLoading(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Abriendo…</title></head>
<body style="margin:0;background:#1f1f1f;display:flex;align-items:center;justify-content:center;height:100vh">
<p style="color:#888;font-family:sans-serif;font-size:14px">Cargando documento…</p>
</body>
</html>`)
  win.document.close()
  return win
}

// Carga el archivo desde el filesystem y llama onBlob(blobUrl, nombre).
// Útil cuando el caller quiere renderizar el blob en su propio contenedor (ej. modal con iframe)
// en lugar de abrir una ventana nueva.
export async function cargarBlobDocumento(
  ubicacion: string,
  onBlob: (blobUrl: string, nombre: string) => void,
  onError: (msg: string) => void,
  userId?: string | null,
  grupoActivo?: string | null,
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

  let handle = await getDirectoryHandle(userId, grupoActivo)
  if (!handle) {
    const picker = (window as WinWithPicker).showDirectoryPicker
    if (!picker) { onError('Selecciona primero una carpeta raíz en Adm. Indexación Docs.'); return }
    try {
      handle = await picker({ mode: 'read' })
      await setDirectoryHandle(handle, userId, grupoActivo)
    } catch { return }
  }
  const ok = await ensureReadPermission(handle)
  if (!ok) { onError('Permiso de lectura denegado.'); return }
  const fileHandle = await abrirArchivoPorRuta(handle, ubicacion)
  if (!fileHandle) { onError(`No se encontró el archivo.`); return }
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
    // Sin handle guardado y sin preselección — cerrar ventana y avisar
    if (winPreAbierta) winPreAbierta.close()
    alert('Selecciona primero el directorio raíz usando el botón "Seleccionar directorio" en Adm. Indexación Docs.')
    return
  }

  const ok = await ensureReadPermission(handle)
  if (!ok) { if (winPreAbierta) winPreAbierta.close(); alert('Permiso de lectura denegado.'); return }
  const fileHandle = await abrirArchivoPorRuta(handle, ubicacion)
  if (!fileHandle) { if (winPreAbierta) winPreAbierta.close(); alert(`No se encontró el archivo: ${ubicacion}`); return }
  const file = await fileHandle.getFile()
  _abrirEnPestanaConNombre(file, file.name, winPreAbierta)
}

// Invoca showDirectoryPicker sincrónicamente respecto al gesto del usuario.
// Debe llamarse ANTES de cualquier await (ej. antes de abrirVentanaLoading).
export async function seleccionarDirectorioRaiz(
  userId?: string | null,
  grupoActivo?: string | null,
): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as WinWithPicker).showDirectoryPicker
  if (!picker) {
    alert('Tu navegador no soporta File System Access API. Usa Chrome o Edge.')
    return null
  }
  try {
    const handle = await picker({ mode: 'read' })
    await setDirectoryHandle(handle, userId, grupoActivo)
    return handle
  } catch {
    return null
  }
}

export async function abrirDocumento(
  ubicacion: string | null | undefined,
  winPreAbierta?: Window | null,
  userId?: string | null,
  grupoActivo?: string | null,
  handlePreseleccionado?: FileSystemDirectoryHandle | null,
): Promise<void> {
  if (!ubicacion) { if (winPreAbierta) winPreAbierta.close(); alert('Este documento no tiene ubicación registrada.'); return }

  if (IS_CLIENT_MODE) {
    const ok = await abrirViaApiLocal(ubicacion)
    if (ok) { if (winPreAbierta) winPreAbierta.close(); return }
    // Fallback a File System Access API si la API local no responde
  }

  try {
    await abrirViaFileSystemApi(ubicacion, winPreAbierta, userId, grupoActivo, handlePreseleccionado)
  } catch (e) {
    if (winPreAbierta) winPreAbierta.close()
    alert(`Error al abrir: ${e instanceof Error ? e.message : e}`)
  }
}

// ── Descargar ─────────────────────────────────────────────────────────────

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
    alert('No hay carpeta raíz seleccionada. Ve a "Procesar Documentos" y selecciona el directorio raíz primero.')
    return
  }
  const ok = await ensureReadPermission(handle)
  if (!ok) { alert('Permiso de lectura denegado.'); return }
  const fileHandle = await abrirArchivoPorRuta(handle, ubicacion)
  if (!fileHandle) { alert(`No se encontró: ${ubicacion}`); return }
  const file = await fileHandle.getFile()
  _triggerDownload(file, nombre || file.name)
}

export async function descargarDocumento(
  ubicacion: string | null | undefined,
  nombre: string = 'documento',
  userId?: string | null,
  grupoActivo?: string | null,
): Promise<void> {
  if (!ubicacion) { alert('Este documento no tiene ubicación registrada.'); return }

  // URL pública: delega al browser con <a download>
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
    // Fallback a File System Access API si la API local no responde
  }

  try {
    await descargarViaFileSystemApi(ubicacion, nombre, userId, grupoActivo)
  } catch (e) {
    alert(`Error al descargar: ${e instanceof Error ? e.message : e}`)
  }
}
