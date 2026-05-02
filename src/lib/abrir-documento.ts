import { getDirectoryHandle, ensureReadPermission } from './file-handle-store'
import { abrirArchivoPorRuta } from './extraer-texto'

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

function _abrirEnPestanaConNombre(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const ext = (nombre.split('.').pop() || '').toLowerCase()
  const inline = _INLINE_EXT.has(ext)

  if (!inline) {
    // No renderizable inline: forzar descarga con el nombre correcto
    _triggerDownload(blob, nombre)
    return
  }

  const win = window.open('', '_blank')
  if (!win) {
    // Popup bloqueado: fallback directo (mostrará UUID, pero abrirá)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
    return
  }

  const titulo = _escapeHtml(nombre)
  const src = _escapeHtml(url)
  win.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;background:#1f1f1f">
<iframe src="${src}" style="width:100vw;height:100vh;border:0" title="${titulo}"></iframe>
</body>
</html>`)
  win.document.close()
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
}

async function abrirViaFileSystemApi(ubicacion: string): Promise<void> {
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
  _abrirEnPestanaConNombre(file, file.name)
}

export async function abrirDocumento(ubicacion: string | null | undefined): Promise<void> {
  if (!ubicacion) { alert('Este documento no tiene ubicación registrada.'); return }

  if (IS_CLIENT_MODE) {
    const ok = await abrirViaApiLocal(ubicacion)
    if (ok) return
    // Fallback a File System Access API si la API local no responde
  }

  try {
    await abrirViaFileSystemApi(ubicacion)
  } catch (e) {
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
