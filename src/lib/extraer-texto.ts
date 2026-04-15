/**
 * Utilidad para extraer texto de archivos usando File System Access API.
 * Soporta: PDF, DOCX, PPTX/POTX, XLSX, XLS, TXT, CSV, MD, JSON, XML, HTML
 */

const EXTENSIONES_TEXTO = new Set([
  'txt', 'csv', 'md', 'json', 'xml', 'html', 'htm', 'log', 'sql', 'py', 'js', 'ts', 'yaml', 'yml', 'ini', 'cfg',
])

const EXTENSIONES_PPTX = new Set(['pptx', 'potx', 'ppsx'])

/**
 * Lee un archivo del filesystem y extrae su contenido como texto.
 * Retorna null si el formato no es soportado.
 */
export async function extraerTextoDeArchivo(fileHandle: FileSystemFileHandle): Promise<string | typeof NECESITA_OCR | null> {
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

  // PowerPoint (.pptx / .potx / .ppsx) — son ZIP con XML internos
  if (EXTENSIONES_PPTX.has(ext)) {
    return extraerTextoPPTX(file)
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
      // Worker local en /public — evita dependencia de CDN y problemas de versión
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      // Crear el PDFWorker una sola vez — se reutiliza en todos los getDocument()
      _pdfWorker = new lib.PDFWorker({ name: undefined })
      return lib
    })()
  }
  return _pdfjsPromise
}

/**
 * Extrae texto de un archivo PDF usando pdf.js
 */
// Error específico para PDFs protegidos con contraseña (password real, no solo DRM)
export class PdfProtegidoError extends Error {
  constructor() { super('PDF protegido con contraseña'); this.name = 'PdfProtegidoError' }
}

// Error para cualquier archivo que no se puede parsear (corrupto, encoding raro, etc.)
export class ArchivoNoEscaneable extends Error {
  constructor(detalle: string) { super(detalle); this.name = 'ArchivoNoEscaneable' }
}

// Sentinel: PDF se abrió correctamente pero no tiene capa de texto (imagen escaneada).
// El caller debe intentar OCR en el backend antes de marcar NO_ESCANEABLE.
export const NECESITA_OCR: unique symbol = Symbol('NECESITA_OCR')

async function extraerTextoPDF(file: File): Promise<string | typeof NECESITA_OCR> {
  const pdfjsLib = await getPdfjsLib()

  const arrayBuffer = await file.arrayBuffer()
  // PDF.js lanza PasswordException cuando el archivo requiere contraseña.
  // Lo capturamos aquí para relanzarlo como PdfProtegidoError (distinguible upstream).
  let pdf
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer, worker: _pdfWorker }).promise
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name ?? ''
    const msg  = e instanceof Error ? e.message : String(e)
    if (name === 'PasswordException' || msg.toLowerCase().includes('password')) {
      throw new PdfProtegidoError()
    }
    // Cualquier otro error de PDF.js (corrupto, truncado, formato inválido)
    throw new ArchivoNoEscaneable(`PDF inválido: ${msg}`)
  }

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
  const texto = paginas.join('\f')

  // Si el PDF no tiene capa de texto (imagen escaneada, DRM que bloquea extracción),
  // el texto queda vacío. Devolvemos el sentinel para que el caller intente OCR.
  if (!texto.replace(/\f/g, '').trim()) {
    return NECESITA_OCR
  }

  return texto
}

/**
 * Extrae texto de un .docx.
 *
 * Primero intenta mammoth (más fiel al formato). Si mammoth falla (tracked changes,
 * campos raros, estructura no soportada) pero el archivo es un ZIP válido con
 * word/document.xml, hace fallback a extracción directa de los nodos <w:t> del XML.
 * Así evita falsos NO_ESCANEABLE en .docx válidos.
 */
async function extraerTextoDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  let mammothError: string | null = null
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer })
    if (result.value && result.value.trim()) return result.value
    mammothError = 'mammoth devolvió texto vacío'
  } catch (e) {
    mammothError = e instanceof Error ? e.message : String(e)
  }

  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(arrayBuffer)
    const partes: string[] = []
    const candidatos = [
      'word/document.xml',
      ...Object.keys(zip.files).filter((n) => /^word\/document\d*\.xml$/i.test(n)),
      ...Object.keys(zip.files).filter((n) => /^word\/header\d+\.xml$/i.test(n)),
      ...Object.keys(zip.files).filter((n) => /^word\/footer\d+\.xml$/i.test(n)),
    ]
    const vistos = new Set<string>()
    for (const path of candidatos) {
      if (vistos.has(path) || !zip.files[path]) continue
      vistos.add(path)
      const xml = await zip.files[path].async('text')
      const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
      const parrafos: string[] = []
      let match
      while ((match = regex.exec(xml)) !== null) {
        const texto = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
        if (texto) parrafos.push(texto)
      }
      if (parrafos.length > 0) partes.push(parrafos.join(' '))
    }
    const texto = partes.join('\n\n').trim()
    if (texto) return texto
    throw new ArchivoNoEscaneable(`DOCX sin texto extraíble (${mammothError ?? 'vacío'})`)
  } catch (e) {
    if (e instanceof ArchivoNoEscaneable) throw e
    const msg = e instanceof Error ? e.message : String(e)
    throw new ArchivoNoEscaneable(`DOCX corrupto: ${mammothError ?? msg}`)
  }
}

/**
 * Extrae texto de un Excel (.xlsx/.xls/.xlsm) usando SheetJS.
 * Cada hoja se serializa como CSV con truncado inteligente:
 * - Máx. 200 filas iniciales + 20 filas finales (para preservar totales/resúmenes)
 * - Si hay más filas se agrega una nota indicando cuántas se omitieron
 * Esto evita tokens excesivos en Excel con miles de filas (ingresos, padrones, etc.)
 */
const EXCEL_MAX_FILAS_INICIO = 200
const EXCEL_MAX_FILAS_FINAL  = 20

async function extraerTextoExcel(file: File): Promise<string> {
  try {
    const XLSX = await import('xlsx')
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const partes: string[] = []
    for (const nombreHoja of workbook.SheetNames) {
      const hoja = workbook.Sheets[nombreHoja]
      const csv = XLSX.utils.sheet_to_csv(hoja, { blankrows: false })
      if (!csv.trim()) continue

      const filas = csv.split('\n').filter((f) => f.trim())
      const totalFilas = filas.length

      let csvTruncado: string
      if (totalFilas <= EXCEL_MAX_FILAS_INICIO + EXCEL_MAX_FILAS_FINAL) {
        csvTruncado = filas.join('\n')
      } else {
        const inicio = filas.slice(0, EXCEL_MAX_FILAS_INICIO)
        const final  = filas.slice(-EXCEL_MAX_FILAS_FINAL)
        const omitidas = totalFilas - EXCEL_MAX_FILAS_INICIO - EXCEL_MAX_FILAS_FINAL
        csvTruncado = [
          ...inicio,
          `... [${omitidas} filas omitidas] ...`,
          ...final,
        ].join('\n')
      }

      const notaTruncado = totalFilas > EXCEL_MAX_FILAS_INICIO + EXCEL_MAX_FILAS_FINAL
        ? ` (${totalFilas} filas totales, muestra representativa)`
        : ''
      partes.push(`### Hoja: ${nombreHoja}${notaTruncado}\n${csvTruncado}`)
    }
    return partes.join('\n\n')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new ArchivoNoEscaneable(`Excel corrupto: ${msg}`)
  }
}

/**
 * Extrae texto de un archivo PowerPoint (.pptx/.potx/.ppsx) usando JSZip.
 * Los archivos PPTX son ZIPs que contienen slides XML en ppt/slides/slideN.xml.
 * Extraemos el texto de los nodos <a:t> de cada slide.
 */
async function extraerTextoPPTX(file: File): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Encontrar slides de contenido (ppt/slides/slideN.xml).
    // Para plantillas .potx también se intenta extraer desde slide masters y layouts,
    // que contienen el texto estructural de la plantilla (títulos, marcadores, etc.)
    const allFiles = Object.keys(zip.files)
    const slideFiles = [
      ...allFiles.filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n)),
      ...allFiles.filter((n) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/i.test(n)),
      ...allFiles.filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(n)),
    ].sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0')
      const nb = parseInt(b.match(/\d+/)?.[0] || '0')
      return na - nb
    })

    if (slideFiles.length === 0) {
      throw new ArchivoNoEscaneable('Plantilla PowerPoint sin contenido de texto (no contiene slides)')
    }

    const partes: string[] = []
    for (const slidePath of slideFiles) {
      const xml = await zip.files[slidePath].async('text')
      // Extraer texto de nodos <a:t>...</a:t> (texto dentro de shapes)
      const textos: string[] = []
      const regex = /<a:t>(.*?)<\/a:t>/gs
      let match
      while ((match = regex.exec(xml)) !== null) {
        const texto = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
        if (texto.trim()) textos.push(texto)
      }
      if (textos.length > 0) {
        const numSlide = slidePath.match(/slide(\d+)/)?.[1] || '?'
        partes.push(`### Slide ${numSlide}\n${textos.join(' ')}`)
      }
    }

    return partes.join('\n\n')
  } catch (e) {
    if (e instanceof ArchivoNoEscaneable) throw e
    const msg = e instanceof Error ? e.message : String(e)
    throw new ArchivoNoEscaneable(`PPTX corrupto: ${msg}`)
  }
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
