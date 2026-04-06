/**
 * Utilidad para extraer texto de archivos usando File System Access API.
 * Soporta: PDF, TXT, CSV, MD, JSON, XML, HTML
 */

const EXTENSIONES_TEXTO = new Set([
  'txt', 'csv', 'md', 'json', 'xml', 'html', 'htm', 'log', 'sql', 'py', 'js', 'ts', 'yaml', 'yml', 'ini', 'cfg',
])

/**
 * Lee un archivo del filesystem y extrae su contenido como texto.
 * Retorna null si el formato no es soportado.
 */
export async function extraerTextoDeArchivo(fileHandle: FileSystemFileHandle): Promise<string | null> {
  const file = await fileHandle.getFile()
  const nombre = file.name.toLowerCase()
  const ext = nombre.split('.').pop() || ''

  // PDF
  if (ext === 'pdf') {
    return extraerTextoPDF(file)
  }

  // Archivos de texto plano
  if (EXTENSIONES_TEXTO.has(ext)) {
    return file.text()
  }

  return null
}

/**
 * Extrae texto de un archivo PDF usando pdf.js
 */
async function extraerTextoPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')

  // Configurar worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const paginas: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i)
    const contenido = await pagina.getTextContent()
    const texto = contenido.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    paginas.push(texto)
  }

  return paginas.join('\n\n')
}

/**
 * Abre un archivo del filesystem dado un FileSystemDirectoryHandle y una ruta relativa.
 * La ruta es relativa al directorio raíz (ej: "/Contratos/2024/contrato.pdf")
 */
export async function abrirArchivoPorRuta(
  dirHandle: FileSystemDirectoryHandle,
  rutaRelativa: string,
): Promise<FileSystemFileHandle | null> {
  // Normalizar ruta: quitar / inicial y el nombre del directorio raíz
  const partes = rutaRelativa.split('/').filter(Boolean)

  // Las primeras partes son directorios, la última es el archivo
  if (partes.length === 0) return null

  let currentDir = dirHandle
  // Navegar por los subdirectorios (saltar el primero que es el nombre del directorio raíz)
  for (let i = 1; i < partes.length - 1; i++) {
    try {
      currentDir = await currentDir.getDirectoryHandle(partes[i])
    } catch {
      return null // Directorio no encontrado
    }
  }

  // Obtener el archivo
  const nombreArchivo = partes[partes.length - 1]
  try {
    return await currentDir.getFileHandle(nombreArchivo)
  } catch {
    return null // Archivo no encontrado
  }
}
