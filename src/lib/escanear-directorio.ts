/**
 * Escanea un directorio local usando File System Access API.
 * Retorna lista plana de directorios con jerarquía.
 *
 * Requiere navegador con soporte: Chrome 86+, Edge 86+, Safari 15.2+
 * Funciona con carpetas en cloud storage montado (Dropbox, Google Drive, OneDrive).
 */

export interface DirectorioEscaneado {
  // codigo_ubicacion ya no se genera en cliente: lo autogenera el backend
  // (correlativo único desde seq_codigo_ubicacion). Se conserva en el tipo
  // para compatibilidad con código que lo lea, pero siempre llega como null
  // en escaneos nuevos.
  codigo_ubicacion: string | null
  nombre_ubicacion: string
  alias_ubicacion: string                 // slug legible del nombre (ej. "QUINTAY")
  codigo_ubicacion_superior: string | null
  ruta_completa: string                   // identificador local único del nodo
  ruta_completa_superior: string | null   // referencia al padre por path
  nivel: number
}

/**
 * Genera un alias legible a partir de un nombre de directorio.
 * Ej: "Contratos 2024" → "CONTRATOS_2024". El backend autogenera el
 * codigo_ubicacion para evitar colisiones de PK global entre grupos.
 */
function generarAlias(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100)
}

/**
 * Recorre recursivamente un FileSystemDirectoryHandle.
 *
 * @param rutasDeshabilitadas - Set de rutas (paths completos, ej.
 *   "/cab/inmobiliario/Quintay") inhabilitadas en BD. Si el directorio físico
 *   mapea a una ruta de ese set, se omite por completo y no se recursa.
 */
async function recorrer(
  handle: FileSystemDirectoryHandle,
  rutaPadre: string,
  nivel: number,
  resultado: DirectorioEscaneado[],
  rutasDeshabilitadas?: Set<string>,
): Promise<void> {
  const entries: FileSystemHandle[] = []
  for await (const entry of (handle as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
    if (entry.kind === 'directory') {
      entries.push(entry)
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const nombre = entry.name
    if (nombre.startsWith('.') || nombre === 'node_modules' || nombre === '__pycache__') {
      continue
    }

    const ruta = `${rutaPadre}/${nombre}`
    if (rutasDeshabilitadas?.has(ruta)) {
      continue
    }

    resultado.push({
      codigo_ubicacion: null,
      nombre_ubicacion: nombre,
      alias_ubicacion: generarAlias(nombre),
      codigo_ubicacion_superior: null,
      ruta_completa: ruta,
      ruta_completa_superior: rutaPadre,
      nivel,
    })

    await recorrer(
      entry as FileSystemDirectoryHandle,
      ruta,
      nivel + 1,
      resultado,
      rutasDeshabilitadas,
    )
  }
}

/**
 * Verifica si el navegador soporta File System Access API.
 */
export function soportaDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Abre selector de directorio, escanea recursivamente y retorna
 * lista plana de directorios.
 *
 * @param handleExterno - handle ya autorizado (de IndexedDB). Si no se provee, abre el picker.
 * @param rutasDeshabilitadas - paths completos a omitir (incluyendo sus hijos).
 * @returns null si el usuario canceló, o la lista de directorios
 */
export async function escanearDirectorio(
  handleExterno?: FileSystemDirectoryHandle | null,
  rutasDeshabilitadas?: Set<string>,
): Promise<{
  nombreRaiz: string
  directorios: DirectorioEscaneado[]
  dirHandle: FileSystemDirectoryHandle
} | null> {
  let dirHandle: FileSystemDirectoryHandle
  if (handleExterno) {
    dirHandle = handleExterno
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const picked = await (window as any).showDirectoryPicker({ mode: 'read', id: 'serverlm-docs' }).catch(() => null)
    if (!picked) return null
    dirHandle = picked
  }

  const nombreRaiz = dirHandle.name
  const rutaRaiz = `/${nombreRaiz}`

  const resultado: DirectorioEscaneado[] = [{
    codigo_ubicacion: null,
    nombre_ubicacion: nombreRaiz,
    alias_ubicacion: generarAlias(nombreRaiz),
    codigo_ubicacion_superior: null,
    ruta_completa: rutaRaiz,
    ruta_completa_superior: null,
    nivel: 0,
  }]

  await recorrer(dirHandle, rutaRaiz, 1, resultado, rutasDeshabilitadas)

  return { nombreRaiz, directorios: resultado, dirHandle }
}

// ── Escaneo de archivos (para carga de documentos) ─────────────────────────

export interface ArchivoEscaneado {
  nombre: string
  ruta_completa: string
  ruta_directorio: string   // ruta del directorio que lo contiene
  tamano_kb: number
  fecha_modificacion: string  // ISO 8601
  vacio: boolean            // true si el archivo pesa 0 bytes (típico de Dropbox/iCloud "solo en línea")
}

/**
 * Cuenta cuántos archivos escaneados están vacíos (0 bytes). Un conteo > 0 suele
 * indicar archivos "solo en línea" (Dropbox/iCloud smart-sync) que no se descargaron
 * localmente: se cargan pero luego fallan en el pipeline por no tener contenido.
 */
export function contarArchivosVacios(archivos: ArchivoEscaneado[]): number {
  return archivos.reduce((n, a) => n + (a.vacio ? 1 : 0), 0)
}

/**
 * Escanea archivos en un directorio dado (o abre el picker si no se provee handle).
 * Respeta el límite de profundidad maxNiveles (0 = solo la raíz, 5 = cinco niveles).
 *
 * @param handleExterno - FileSystemDirectoryHandle ya obtenido (con permisos). Si es null/undefined, abre el picker.
 * @param maxNiveles - Profundidad máxima a recorrer (default 5).
 * @param signal - AbortSignal para cancelar el escaneo.
 * @param rutasDeshabilitadas - Set de rutas completas (e.g. "/MiMusica/Cubase") que deben omitirse junto con sus hijos.
 * @param maxArchivos - Tope opcional: el escáner se detiene en cuanto se acumulan N archivos.
 *   Cuando se detiene por tope, rutasEscaneadas queda vacío para que el backend no
 *   trate como "ubicaciones completamente escaneadas" rutas que no terminamos de recorrer
 *   (eso evita que fn_carga_masiva_documentos elimine huérfanos por error).
 */
export async function escanearArchivosDirectorio(
  handleExterno?: FileSystemDirectoryHandle | null,
  maxNiveles = 5,
  signal?: AbortSignal,
  rutasDeshabilitadas?: Set<string>,
  maxArchivos?: number,
): Promise<{
  nombreRaiz: string
  archivos: ArchivoEscaneado[]
  carpetasSinMatch: string[]
  rutasEscaneadas: string[]
  dirHandle: FileSystemDirectoryHandle
} | null> {
  let dirHandle: FileSystemDirectoryHandle
  if (handleExterno) {
    dirHandle = handleExterno
  } else {
    // Solo abrimos el picker cuando no hay handle externo (requiere gesto de usuario)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const picked = await (window as any).showDirectoryPicker({ mode: 'read', id: 'serverlm-docs' }).catch(() => null)
    if (!picked) return null
    dirHandle = picked
  }

  const nombreRaiz: string = dirHandle.name
  const archivos: ArchivoEscaneado[] = []
  const rutasEscaneadas: string[] = []
  const topeActivo = typeof maxArchivos === 'number' && maxArchivos > 0
  let detenidoPorTope = false
  const topeAlcanzado = () => topeActivo && archivos.length >= (maxArchivos as number)

  async function recorrerArchivos(
    handle: FileSystemDirectoryHandle,
    rutaActual: string,
    nivel: number,
  ): Promise<void> {
    if (signal?.aborted) return
    if (topeAlcanzado()) { detenidoPorTope = true; return }
    if (rutasDeshabilitadas?.has(rutaActual)) return
    rutasEscaneadas.push(rutaActual)

    const entries: { handle: FileSystemHandle; kind: string }[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const entry of (handle as any).values()) {
      if (signal?.aborted) return
      entries.push({ handle: entry, kind: entry.kind })
    }

    for (const entry of entries) {
      if (signal?.aborted) return
      if (topeAlcanzado()) { detenidoPorTope = true; return }
      if (entry.kind === 'file') {
        const nombre = entry.handle.name
        if (nombre.startsWith('.')) continue
        try {
          const file = await (entry.handle as FileSystemFileHandle).getFile()
          archivos.push({
            nombre: file.name,
            ruta_completa: `${rutaActual}/${file.name}`,
            ruta_directorio: rutaActual,
            tamano_kb: Math.round((file.size / 1024) * 100) / 100,
            fecha_modificacion: new Date(file.lastModified).toISOString(),
            vacio: file.size === 0,
          })
        } catch {
          // archivo no accesible, ignorar
        }
      }
    }

    if (nivel < maxNiveles) {
      for (const entry of entries) {
        if (signal?.aborted) return
        if (topeAlcanzado()) { detenidoPorTope = true; return }
        if (entry.kind === 'directory') {
          const nombre = entry.handle.name
          if (nombre.startsWith('.') || nombre === 'node_modules' || nombre === '__pycache__') continue
          await recorrerArchivos(
            entry.handle as FileSystemDirectoryHandle,
            `${rutaActual}/${nombre}`,
            nivel + 1,
          )
          if (detenidoPorTope) return
        }
      }
    }
  }

  await recorrerArchivos(dirHandle, `/${nombreRaiz}`, 0)

  if (signal?.aborted) return null

  return {
    nombreRaiz,
    archivos,
    carpetasSinMatch: [],
    rutasEscaneadas: detenidoPorTope ? [] : rutasEscaneadas,
    dirHandle,
  }
}

/**
 * Abre selector de directorio y retorna SOLO el directorio seleccionado,
 * sin escanear sus hijos. El codigo_ubicacion queda null para que el backend
 * lo autogenere.
 */
export async function escanearDirectorioSinHijos(): Promise<{
  nombreRaiz: string
  directorio: DirectorioEscaneado
  dirHandle: FileSystemDirectoryHandle
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read', id: 'serverlm-docs' }).catch(() => null)
  if (!dirHandle) return null

  const nombreRaiz = dirHandle.name

  return {
    nombreRaiz,
    directorio: {
      codigo_ubicacion: null,
      nombre_ubicacion: nombreRaiz,
      alias_ubicacion: generarAlias(nombreRaiz),
      codigo_ubicacion_superior: null,
      ruta_completa: `/${nombreRaiz}`,
      ruta_completa_superior: null,
      nivel: 0,
    },
    dirHandle,
  }
}
