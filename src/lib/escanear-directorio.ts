/**
 * Escanea un directorio local usando File System Access API.
 * Retorna lista plana de directorios con jerarquía.
 *
 * Requiere navegador con soporte: Chrome 86+, Edge 86+, Safari 15.2+
 * Funciona con carpetas en cloud storage montado (Dropbox, Google Drive, OneDrive).
 */

export interface DirectorioEscaneado {
  codigo_ubicacion: string
  nombre_ubicacion: string
  codigo_ubicacion_superior: string | null
  ruta_completa: string
  nivel: number
}

/**
 * Genera un código válido a partir de un nombre de directorio.
 * Ej: "Contratos 2024" → "CONTRATOS_2024"
 */
function generarCodigo(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar acentos
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '_')    // caracteres no alfanuméricos → _
    .replace(/_+/g, '_')               // colapsar underscores
    .replace(/^_|_$/g, '')             // trim underscores
    .slice(0, 100)                     // máx 100 chars (PK)
}

/**
 * Hace un código único agregando sufijo si hay duplicados.
 */
function hacerUnico(codigo: string, existentes: Set<string>): string {
  if (!existentes.has(codigo)) return codigo
  let i = 2
  while (existentes.has(`${codigo}_${i}`)) i++
  return `${codigo}_${i}`
}

/**
 * Recorre recursivamente un FileSystemDirectoryHandle.
 */
async function recorrer(
  handle: FileSystemDirectoryHandle,
  codigoPadre: string | null,
  rutaPadre: string,
  nivel: number,
  resultado: DirectorioEscaneado[],
  codigos: Set<string>,
): Promise<void> {
  const entries: FileSystemHandle[] = []
  for await (const entry of (handle as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
    if (entry.kind === 'directory') {
      entries.push(entry)
    }
  }

  // Ordenar alfabéticamente
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const nombre = entry.name
    // Ignorar carpetas ocultas y de sistema
    if (nombre.startsWith('.') || nombre === 'node_modules' || nombre === '__pycache__') {
      continue
    }

    let codigo = generarCodigo(nombre)
    codigo = hacerUnico(codigo, codigos)
    codigos.add(codigo)

    const ruta = `${rutaPadre}/${nombre}`

    resultado.push({
      codigo_ubicacion: codigo,
      nombre_ubicacion: nombre,
      codigo_ubicacion_superior: codigoPadre,
      ruta_completa: ruta,
      nivel,
    })

    // Recursión
    await recorrer(
      entry as FileSystemDirectoryHandle,
      codigo,
      ruta,
      nivel + 1,
      resultado,
      codigos,
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
 * @returns null si el usuario canceló, o la lista de directorios
 */
export async function escanearDirectorio(): Promise<{
  nombreRaiz: string
  directorios: DirectorioEscaneado[]
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirHandle = await (window as any).showDirectoryPicker().catch(() => null)
  if (!dirHandle) return null

  const nombreRaiz = dirHandle.name
  const codigos = new Set<string>()

  // La raíz misma es el primer directorio
  let codigoRaiz = generarCodigo(nombreRaiz)
  codigoRaiz = hacerUnico(codigoRaiz, codigos)
  codigos.add(codigoRaiz)

  const resultado: DirectorioEscaneado[] = [{
    codigo_ubicacion: codigoRaiz,
    nombre_ubicacion: nombreRaiz,
    codigo_ubicacion_superior: null,
    ruta_completa: `/${nombreRaiz}`,
    nivel: 0,
  }]

  await recorrer(dirHandle, codigoRaiz, `/${nombreRaiz}`, 1, resultado, codigos)

  return { nombreRaiz, directorios: resultado }
}

/**
 * Abre selector de directorio y retorna SOLO el directorio seleccionado,
 * sin escanear sus hijos.
 *
 * @returns null si el usuario canceló, o un solo directorio
 */
// ── Escaneo de archivos (para carga de documentos) ─────────────────────────

export interface ArchivoEscaneado {
  nombre: string
  ruta_completa: string
  ruta_directorio: string   // ruta del directorio que lo contiene
  tamano_kb: number
  fecha_modificacion: string  // ISO 8601
}

/**
 * Escanea recursivamente un directorio y retorna todos los archivos
 * encontrados junto con la ruta del directorio que los contiene.
 *
 * @param rutasHabilitadas - Set de rutas de ubicaciones habilitadas en BD.
 *   Solo se listan archivos de directorios cuya ruta está en este Set.
 * @returns archivos encontrados + carpetas sin match en BD
 */
/**
 * Escanea archivos en un directorio dado (o abre el picker si no se provee handle).
 * Respeta el límite de profundidad maxNiveles (0 = solo la raíz, 5 = cinco niveles).
 *
 * @param handleExterno - FileSystemDirectoryHandle ya obtenido (con permisos). Si es null/undefined, abre el picker.
 * @param maxNiveles - Profundidad máxima a recorrer (default 5).
 */
export async function escanearArchivosDirectorio(
  handleExterno?: FileSystemDirectoryHandle | null,
  maxNiveles = 5,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const picked = await (window as any).showDirectoryPicker().catch(() => null)
    if (!picked) return null
    dirHandle = picked
  }

  const nombreRaiz: string = dirHandle.name
  const archivos: ArchivoEscaneado[] = []
  const rutasEscaneadas: string[] = []

  async function recorrerArchivos(
    handle: FileSystemDirectoryHandle,
    rutaActual: string,
    nivel: number,
  ): Promise<void> {
    rutasEscaneadas.push(rutaActual)

    const entries: { handle: FileSystemHandle; kind: string }[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const entry of (handle as any).values()) {
      entries.push({ handle: entry, kind: entry.kind })
    }

    // Archivos de este directorio
    for (const entry of entries) {
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
          })
        } catch {
          // archivo no accesible, ignorar
        }
      }
    }

    // Recursión en subdirectorios (respeta límite de niveles)
    if (nivel < maxNiveles) {
      for (const entry of entries) {
        if (entry.kind === 'directory') {
          const nombre = entry.handle.name
          if (nombre.startsWith('.') || nombre === 'node_modules' || nombre === '__pycache__') continue
          await recorrerArchivos(
            entry.handle as FileSystemDirectoryHandle,
            `${rutaActual}/${nombre}`,
            nivel + 1,
          )
        }
      }
    }
  }

  await recorrerArchivos(dirHandle, `/${nombreRaiz}`, 0)

  return { nombreRaiz, archivos, carpetasSinMatch: [], rutasEscaneadas, dirHandle }
}

export async function escanearDirectorioSinHijos(): Promise<{
  nombreRaiz: string
  directorio: DirectorioEscaneado
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirHandle = await (window as any).showDirectoryPicker().catch(() => null)
  if (!dirHandle) return null

  const nombreRaiz = dirHandle.name
  const codigoRaiz = generarCodigo(nombreRaiz)

  return {
    nombreRaiz,
    directorio: {
      codigo_ubicacion: codigoRaiz,
      nombre_ubicacion: nombreRaiz,
      codigo_ubicacion_superior: null,
      ruta_completa: `/${nombreRaiz}`,
      nivel: 0,
    },
  }
}
