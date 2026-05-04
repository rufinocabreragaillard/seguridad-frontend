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

function _abrirEnPestanaConNombre(blob: Blob, nombre: string, winPreAbierta?: Window | null): void {
  const ext = (nombre.split('.').pop() || '').toLowerCase()
  const inline = _INLINE_EXT.has(ext)
  const url = URL.createObjectURL(blob)
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)

  if (!inline) {
    if (winPreAbierta && !winPreAbierta.closed) winPreAbierta.close()
    _triggerDownload(blob, nombre)
    return
  }

  if (winPreAbierta && !winPreAbierta.closed) {
    // Navegar la ventana ya abierta al blob URL directamente
    winPreAbierta.location.replace(url)
    return
  }

  // Sin ventana pre-abierta: intentar abrir normal
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    // Popup bloqueado: descargar como fallback
    _triggerDownload(blob, nombre)
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

  let handle = await getDirectoryHandle()
  if (!handle) {
    const picker = (window as WinWithPicker).showDirectoryPicker
    if (!picker) { onError('Selecciona primero una carpeta raíz en Adm. Indexación Docs.'); return }
    try {
      handle = await picker({ mode: 'read' })
      await setDirectoryHandle(handle)
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

async function abrirViaFileSystemApi(ubicacion: string, winPreAbierta?: Window | null): Promise<void> {
  let handle = await getDirectoryHandle()

  if (!handle) {
    // No hay carpeta guardada: pedir al usuario que seleccione la raíz
    const picker = (window as WinWithPicker).showDirectoryPicker
    if (!picker) {
      if (winPreAbierta) winPreAbierta.close()
      alert('Tu navegador no soporta File System Access API. Usa Chrome o Edge.')
      return
    }
    try {
      handle = await picker({ mode: 'read' })
      await setDirectoryHandle(handle)
    } catch {
      if (winPreAbierta) winPreAbierta.close()
      return
    }
  }

  const ok = await ensureReadPermission(handle)
  if (!ok) { if (winPreAbierta) winPreAbierta.close(); alert('Permiso de lectura denegado.'); return }
  const fileHandle = await abrirArchivoPorRuta(handle, ubicacion)
  if (!fileHandle) { if (winPreAbierta) winPreAbierta.close(); alert(`No se encontró el archivo: ${ubicacion}`); return }
  const file = await fileHandle.getFile()
  _abrirEnPestanaConNombre(file, file.name, winPreAbierta)
}

export async function abrirDocumento(ubicacion: string | null | undefined, winPreAbierta?: Window | null): Promise<void> {
  if (!ubicacion) { if (winPreAbierta) winPreAbierta.close(); alert('Este documento no tiene ubicación registrada.'); return }

  if (IS_CLIENT_MODE) {
    const ok = await abrirViaApiLocal(ubicacion)
    if (ok) { if (winPreAbierta) winPreAbierta.close(); return }
    // Fallback a File System Access API si la API local no responde
  }

  try {
    await abrirViaFileSystemApi(ubicacion, winPreAbierta)
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

async function descargarViaFileSystemApi(ubicacion: string, nombre: string): Promise<void> {
  const handle = await getDirectoryHandle()
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
    await descargarViaFileSystemApi(ubicacion, nombre)
  } catch (e) {
    alert(`Error al descargar: ${e instanceof Error ? e.message : e}`)
  }
}
