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
  for await (const entry of handle.values()) {
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
