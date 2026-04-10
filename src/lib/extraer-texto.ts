/**
 * Utilidad para extraer texto de archivos usando File System Access API.
 * Soporta: PDF, DOCX, XLSX, XLS, TXT, CSV, MD, JSON, XML, HTML
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

  // Word (.docx). Nota: .doc binario antiguo NO soportado.
  if (ext === 'docx') {
    return extraerTextoDOCX(file)
  }

  // Excel (.xlsx / .xls / .xlsm)
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    return extraerTextoExcel(file)
  }

  // Archivos de texto plano
  if (EXTENSIONES_TEXTO.has(ext)) {
    return file.text()
  }

  return null
}

/**
 * Singleton de PDF.js para evitar race conditions con procesamiento paralelo.
 *
 * Con N_CONCURRENTE>1, múltiples llamadas a getDocument() ocurren simultáneamente.
 * Si cada una intenta inicializar el worker de PDF.js por separado, todas fallan con
 * "Setting up fake worker failed". La solución: un único PDFWorker compartido que
 * se crea una sola vez y se reutiliza en todos los documentos concurrentes.
 */
type PdfjsLib = typeof import('pdfjs-dist')
let _pdfjsPromise: Promise<PdfjsLib> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pdfWorker: any = null  // PDFWorker instance (tipo any para evitar imports circulares)

async function getPdfjsLib(): Promise<PdfjsLib> {
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`
      // Crear el PDFWorker una sola vez — se reutiliza en todos los getDocument()
      _pdfWorker = new lib.PDFWorker({ name: 'cab-pdf-worker' })
      return lib
    })()
  }
  return _pdfjsPromise
}

/**
 * Extrae texto de un archivo PDF usando pdf.js
 */
async function extraerTextoPDF(file: File): Promise<string> {
  const pdfjsLib = await getPdfjsLib()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, worker: _pdfWorker }).promise

  const paginas: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i)
    const contenido = await pagina.getTextContent()
    const texto = contenido.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    paginas.push(texto)
  }

  // \f (form feed) = separador de página. El backend chunking.py lo usa
  // para dividir exactamente 1 chunk por página en PDFs nativos.
  return paginas.join('\f')
}

/**
 * Extrae texto de un .docx usando mammoth.
 */
async function extraerTextoDOCX(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/**
 * Extrae texto de un Excel (.xlsx/.xls/.xlsm) usando SheetJS.
 * Cada hoja se serializa como CSV; las hojas se separan por encabezado.
 */
async function extraerTextoExcel(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const partes: string[] = []
  for (const nombreHoja of workbook.SheetNames) {
    const hoja = workbook.Sheets[nombreHoja]
    const csv = XLSX.utils.sheet_to_csv(hoja, { blankrows: false })
    if (csv.trim()) {
      partes.push(`### Hoja: ${nombreHoja}\n${csv}`)
    }
  }
  return partes.join('\n\n')
}

/**
 * Abre un archivo del filesystem dado un FileSystemDirectoryHandle y una ruta
 * "absoluta" tal como quedó guardada en BD (ej: "/cab/inmobiliario/legal/X.pdf").
 *
 * Estrategia: la ruta guardada en BD viene con segmentos que representan
 * directorios anidados desde algún ancestro del filesystem. El usuario puede
 * haber pickeado el directorio raíz en cualquier nivel de esa jerarquía
 * (ej. "inmobiliario" o "legal" o el propio "cab"). Intentamos encontrar el
 * archivo probando todos los puntos de partida posibles dentro de la ruta:
 *
 *   ruta = ['cab', 'inmobiliario', 'legal', 'X.pdf']
 *   handle = "legal"  →  prueba navegar [], luego ['inmobiliario'], luego
 *                        ['cab','inmobiliario'], etc.
 *
 * Para cada offset, intenta resolver el resto de la ruta. Devuelve el primero
 * que matchee.
 *
 * Heurística adicional: si dirHandle.name coincide con alguno de los segmentos,
 * lo prueba primero.
 */
export async function abrirArchivoPorRuta(
  dirHandle: FileSystemDirectoryHandle,
  rutaRelativa: string,
): Promise<FileSystemFileHandle | null> {
  const partes = rutaRelativa.split('/').filter(Boolean)
  if (partes.length === 0) return null

  const nombreArchivo = partes[partes.length - 1]
  const directorios = partes.slice(0, -1) // todos menos el archivo

  // Helper: navega desde dirHandle siguiendo `subdirs` y devuelve el file handle.
  const intentarDesde = async (subdirs: string[]): Promise<FileSystemFileHandle | null> => {
    let currentDir = dirHandle
    for (const sub of subdirs) {
      try {
        currentDir = await currentDir.getDirectoryHandle(sub)
      } catch {
        return null
      }
    }
    try {
      return await currentDir.getFileHandle(nombreArchivo)
    } catch {
      return null
    }
  }

  // Construir la lista de offsets a probar, en orden de preferencia.
  // 1. Si el nombre del handle aparece como un segmento de la ruta, empezar
  //    justo después de ese segmento (lo más probable).
  // 2. Probar todos los offsets desde el final hacia el inicio (más profundo
  //    primero: minimiza la chance de un falso positivo en directorios con
  //    nombres comunes como "legal").
  const offsetsAProbar: number[] = []
  const idxNombreHandle = directorios.lastIndexOf(dirHandle.name)
  if (idxNombreHandle >= 0) {
    offsetsAProbar.push(idxNombreHandle + 1)
  }
  for (let off = directorios.length; off >= 0; off--) {
    if (!offsetsAProbar.includes(off)) offsetsAProbar.push(off)
  }

  for (const off of offsetsAProbar) {
    const subdirs = directorios.slice(off)
    const fh = await intentarDesde(subdirs)
    if (fh) return fh
  }

  return null
}
