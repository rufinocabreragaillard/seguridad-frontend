/**
 * Utilidad para extraer texto de archivos usando File System Access API.
 * Soporta: PDF, DOCX, RTF, PPTX/POTX, XLSX, XLS, TXT, CSV, MD, JSON, XML, HTML
 */

/** Timeout máximo por archivo (ms). Archivos con firma digital o cifrado complejo
 *  pueden bloquear el parser varios segundos. Con este límite se marca NO_ESCANEABLE
 *  en vez de bloquear toda la cola.
 *  Subido a 25s (de 8s original) porque PDFs jurídicos densos legítimos pueden
 *  tardar 15-20s. Con sliding window el timeout largo no bloquea otros docs. */
const TIMEOUT_EXTRACCION_MS = 25_000

/**
 * Envuelve una promesa con un timeout.
 * Si transcurre más de `ms` lanza ArchivoNoEscaneable en vez de esperar indefinidamente.
 */
function conTimeout<T>(promesa: Promise<T>, ms: number, nombreArchivo: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new ArchivoNoEscaneable(`Extracción superó ${ms / 1000}s: ${nombreArchivo}`)),
        ms,
      )
    ),
  ])
}

const EXTENSIONES_TEXTO = new Set([
  'txt', 'csv', 'md', 'json', 'xml', 'html', 'htm', 'log', 'sql', 'py', 'js', 'ts', 'yaml', 'yml', 'ini', 'cfg',
])

const EXTENSIONES_PPTX = new Set(['pptx', 'potx', 'ppsx'])

/** Extensiones que NO se pueden extraer como texto en el frontend (imágenes, audio,
 *  video, binarios). Se usan para fast-path: en vez de abrir el archivo y dejar que
 *  el extractor retorne null tras navegar el filesystem (~8 s con N workers paralelos),
 *  el caller puede marcar NO_ESCANEABLE inmediatamente sin abrir el archivo. */
export const EXTENSIONES_NO_TEXTUALES = new Set([
  // Imágenes
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'heic', 'heif', 'svg', 'ico', 'avif',
  // Audio / Video
  'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v',
  // Binarios y archivos comprimidos
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  'exe', 'dll', 'bin', 'iso', 'dmg', 'pkg', 'deb', 'rpm',
])

/** Umbral de chars por página: menos que esto = página es imagen, no texto nativo. */
const CHARS_MINIMOS_PAGINA = 150

/** Página PDF renderizada como imagen JPEG (base64) para Vision LLM. */
export type PaginaImagen = { pagina: number; base64: string }

/**
 * Resultado de extracción mixta: texto nativo + imágenes de páginas sin texto.
 * Solo se retorna cuando hay páginas imagen; PDFs 100% texto siguen retornando string.
 */
export type ExtraccionMixta = { texto: string; paginasImagen: PaginaImagen[] }

/**
 * Timings finos del paso EXTRAER. Se llenan solo cuando el parámetro
 * DOCUMENTOS/DEBUG_TIEMPOS_EXTRAER='true'. El caller pasa un objeto que la
 * función va llenando in-place y luego adjunta a `timings_debug` al subir.
 */
export type TimingsExtraccion = {
  t_arrayBuffer_ms?: number
  t_pdfjs_getDocument_ms?: number
  t_pdfjs_paginas_ms?: number
  t_render_imagenes_ms?: number
  num_paginas?: number
  num_paginas_imagen?: number
  bytes?: number
}

/**
 * Lee un archivo del filesystem y extrae su contenido como texto.
 * Retorna null si el formato no es soportado.
 * Para PDFs mixtos (páginas nativas + páginas imagen), retorna ExtraccionMixta.
 */
export async function extraerTextoDeArchivo(
  fileHandle: FileSystemFileHandle,
  timeoutMs?: number,
  timings?: TimingsExtraccion,
): Promise<string | typeof NECESITA_OCR | ExtraccionMixta | null> {
  const ms = (timeoutMs && timeoutMs > 0) ? timeoutMs : TIMEOUT_EXTRACCION_MS
  const file = await fileHandle.getFile()
  const nombre = file.name.toLowerCase()
  const ext = nombre.split('.').pop() || ''
  if (timings) timings.bytes = file.size

  if (ext === 'pdf') {
    return conTimeout(extraerTextoPDF(file, timings), ms, file.name)
  }

  if (ext === 'docx') {
    return conTimeout(extraerTextoDOCX(file), ms, file.name)
  }

  if (ext === 'rtf') {
    return conTimeout(extraerTextoRTF(file), ms, file.name)
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    return conTimeout(extraerTextoExcel(file), ms, file.name)
  }

  if (EXTENSIONES_PPTX.has(ext)) {
    return conTimeout(extraerTextoPPTX(file), ms, file.name)
  }

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

async function extraerTextoPDF(file: File, timings?: TimingsExtraccion): Promise<string | typeof NECESITA_OCR | ExtraccionMixta> {
  const pdfjsLib = await getPdfjsLib()

  const _t_buf = performance.now()
  const arrayBuffer = await file.arrayBuffer()
  if (timings) timings.t_arrayBuffer_ms = Math.round(performance.now() - _t_buf)
  // PDF.js lanza PasswordException cuando el archivo requiere contraseña.
  // Lo capturamos aquí para relanzarlo como PdfProtegidoError (distinguible upstream).
  let pdf
  const _t_get = performance.now()
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer, worker: _pdfWorker }).promise
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name ?? ''
    const msg  = e instanceof Error ? e.message : String(e)
    if (timings) timings.t_pdfjs_getDocument_ms = Math.round(performance.now() - _t_get)
    if (name === 'PasswordException' || msg.toLowerCase().includes('password')) {
      throw new PdfProtegidoError()
    }
    // Cualquier otro error de PDF.js (corrupto, truncado, formato inválido)
    throw new ArchivoNoEscaneable(`PDF inválido: ${msg}`)
  }
  if (timings) {
    timings.t_pdfjs_getDocument_ms = Math.round(performance.now() - _t_get)
    timings.num_paginas = pdf.numPages
  }

  // Paralelizar extracción de páginas. PDF.js maneja la concurrencia interna
  // dentro del worker compartido. Para PDFs densos (jurídicos, balances) baja
  // wall-clock de páginas serial → cap por la página más lenta.
  const _t_pages = performance.now()
  const numsPaginaImagen: number[] = []
  const promesas: Promise<{ idx: number; texto: string }>[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const idx = i
    promesas.push((async () => {
      const pagina = await pdf.getPage(idx)
      const contenido = await pagina.getTextContent()
      const texto = contenido.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      return { idx, texto }
    })())
  }
  const resultados = await Promise.all(promesas)
  resultados.sort((a, b) => a.idx - b.idx)
  if (timings) timings.t_pdfjs_paginas_ms = Math.round(performance.now() - _t_pages)
  const paginas: string[] = resultados.map((r) => r.texto)
  resultados.forEach((r) => {
    if (r.texto.trim().length < CHARS_MINIMOS_PAGINA) {
      numsPaginaImagen.push(r.idx)
    }
  })

  // \f (form feed) = separador de página. El backend chunking.py lo usa
  // para dividir exactamente 1 chunk por página en PDFs nativos.
  const texto = paginas.join('\f')

  // Si el PDF no tiene capa de texto (imagen escaneada, DRM que bloquea extracción),
  // el texto queda vacío. Renderizamos todas las páginas como imágenes para Vision LLM.
  if (!texto.replace(/\f/g, '').trim()) {
    const _t_render = performance.now()
    const paginasImagen: PaginaImagen[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const pagina = await pdf.getPage(i)
        const viewport = pagina.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        await pagina.render({ canvasContext: ctx, viewport }).promise
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
        paginasImagen.push({ pagina: i, base64 })
      } catch {
        // Si falla el render de una página, se omite
      }
    }
    if (timings) {
      timings.t_render_imagenes_ms = Math.round(performance.now() - _t_render)
      timings.num_paginas_imagen = paginasImagen.length
    }
    if (paginasImagen.length > 0) {
      return { texto: '', paginasImagen }
    }
    // Fallback: si el render también falla, es realmente inaccesible
    return NECESITA_OCR
  }

  // PDF mixto: algunas páginas tienen poco texto (imagen embebida).
  // Renderizar esas páginas a JPEG para enviar a Vision LLM en ANALIZAR.
  // Solo paga Vision por estas páginas; el resto usa texto nativo (costo cero).
  if (numsPaginaImagen.length > 0) {
    const _t_render2 = performance.now()
    const paginasImagen: PaginaImagen[] = []
    for (const numPag of numsPaginaImagen) {
      try {
        const pagina = await pdf.getPage(numPag)
        // scale 2.0 para mejor calidad OCR (documentos CBR y similares de alta resolución)
        const viewport = pagina.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.warn(`[extraer-texto] No se pudo obtener contexto 2D para página ${numPag}`)
          continue
        }
        await pagina.render({ canvasContext: ctx, viewport }).promise
        // JPEG 85% — mejor legibilidad para documentos legales con texto fino
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        if (!base64) {
          console.warn(`[extraer-texto] toDataURL vacío para página ${numPag}`)
          continue
        }
        paginasImagen.push({ pagina: numPag, base64 })
      } catch (err) {
        console.error(`[extraer-texto] Error renderizando página ${numPag}:`, err)
      }
    }
    if (timings) {
      timings.t_render_imagenes_ms = Math.round(performance.now() - _t_render2)
      timings.num_paginas_imagen = paginasImagen.length
    }
    if (paginasImagen.length > 0) {
      return { texto, paginasImagen }
    }
    console.warn(`[extraer-texto] ${numsPaginaImagen.length} páginas imagen detectadas pero ninguna pudo renderizarse`)
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
 * Máximo de filas por hoja extraídas de archivos .xlsx/.xls/.xlsm.
 * Limita el texto enviado al LLM para documentos grandes (BD, padrones, etc.)
 * reduciendo tokens y tiempo de escaneo sin perder contexto del contenido.
 * Sincronizado con el parámetro DOCUMENTOS/MAX_FILAS_XLSX en parametros_generales.
 */
const MAX_FILAS_XLSX = 200

/**
 * Extrae texto de un Excel (.xlsx/.xls/.xlsm) usando SheetJS.
 * Cada hoja se serializa como CSV; las hojas se separan por encabezado.
 * Solo se extraen las primeras MAX_FILAS_XLSX filas por hoja.
 */
async function extraerTextoExcel(file: File): Promise<string> {
  try {
    const XLSX = await import('xlsx')
    const arrayBuffer = await file.arrayBuffer()
    // cellFormula/cellStyles/cellDates/cellNF=false evitan procesamiento innecesario
    // (fórmulas, estilos, fechas como objetos) — reduce tiempo de parsing ~30-50%
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellFormula: false,
      cellStyles: false,
      cellDates: false,
      cellNF: false,
    })
    const partes: string[] = []
    for (const nombreHoja of workbook.SheetNames) {
      const hoja = workbook.Sheets[nombreHoja]
      // Limitar a las primeras MAX_FILAS_XLSX filas (reduce tokens LLM en hojas grandes)
      const ref = hoja['!ref']
      if (ref) {
        const range = XLSX.utils.decode_range(ref)
        if (range.e.r >= MAX_FILAS_XLSX) {
          range.e.r = MAX_FILAS_XLSX - 1  // 0-indexed: fila 199 = fila 200 del usuario
          hoja['!ref'] = XLSX.utils.encode_range(range)
        }
      }
      const csv = XLSX.utils.sheet_to_csv(hoja, { blankrows: false })
      if (csv.trim()) {
        partes.push(`### Hoja: ${nombreHoja}\n${csv}`)
      }
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

    // Paralelizar extracción de slides (cada slide es un async unzip).
    // PPTX grandes (>10 MB, decenas de slides) bajan ~3-5x con esto.
    const promesasSlide = slideFiles.map(async (slidePath) => {
      const xml = await zip.files[slidePath].async('text')
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
      const numSlide = parseInt(slidePath.match(/slide(\d+)/)?.[1] || '0')
      return { numSlide, slidePath, textos }
    })
    const resultadosSlide = await Promise.all(promesasSlide)
    resultadosSlide.sort((a, b) => a.numSlide - b.numSlide)
    const partes: string[] = []
    for (const r of resultadosSlide) {
      if (r.textos.length > 0) {
        const num = r.numSlide || '?'
        partes.push(`### Slide ${num}\n${r.textos.join(' ')}`)
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

/**
 * Extrae texto plano de un archivo RTF.
 * RTF es ASCII con marcado tipo {\rtf1\ansi ...}. Los control words (\par, \b, etc.)
 * y los grupos {...} se descartan; queda solo el texto. Implementación FSM minimal
 * portada del algoritmo estándar de striprtf — suficiente para RAG (no preserva formato).
 *
 * Soporta:
 *   - Control words: \par, \line, \page → \n; \tab → \t; resto se descarta.
 *   - Grupos de cabecera (fonttbl, colortbl, stylesheet, info, *): se ignora todo el contenido.
 *   - \'XX → carácter Latin-1 (windows-1252).
 *   - \uNNNN? → carácter Unicode (con fallback char tras `?`).
 *   - \\, \{, \} → caracteres literales \, {, }.
 */
async function extraerTextoRTF(file: File): Promise<string> {
  const raw = await file.text()
  const out: string[] = []
  // Stack de profundidad de grupos a ignorar (header tables, picts, *).
  const ignorarHasta: number[] = []
  // Tablas de cabecera y elementos binarios cuyo contenido NO va al texto.
  const GRUPOS_IGNORAR = new Set([
    'fonttbl', 'colortbl', 'stylesheet', 'listtable', 'listoverridetable',
    'rsidtbl', 'generator', 'info', 'pict', 'themedata', 'datastore',
    'latentstyles', 'wgrffmtfilter', 'xmlnstbl', 'mmathPr', 'shppict',
    'nonshppict', 'header', 'footer', 'headerl', 'headerr', 'headerf',
    'footerl', 'footerr', 'footerf', 'object',
  ])
  let depth = 0
  let i = 0
  while (i < raw.length) {
    const c = raw[i]
    if (c === '{') {
      depth++
      // Detectar {\* — extensión Microsoft, ignorar grupo entero
      if (raw[i + 1] === '\\' && raw[i + 2] === '*') {
        ignorarHasta.push(depth)
      }
      i++
      continue
    }
    if (c === '}') {
      if (ignorarHasta.length > 0 && ignorarHasta[ignorarHasta.length - 1] === depth) {
        ignorarHasta.pop()
      }
      depth--
      i++
      continue
    }
    const ignorando = ignorarHasta.length > 0
    if (c === '\\') {
      // Caracteres escape: \\ \{ \}
      const nxt = raw[i + 1]
      if (nxt === '\\' || nxt === '{' || nxt === '}') {
        if (!ignorando) out.push(nxt)
        i += 2
        continue
      }
      // \'XX (hex Latin-1 / windows-1252)
      if (nxt === "'" && /[0-9a-fA-F]/.test(raw[i + 2] || '') && /[0-9a-fA-F]/.test(raw[i + 3] || '')) {
        if (!ignorando) {
          const code = parseInt(raw.slice(i + 2, i + 4), 16)
          out.push(String.fromCharCode(code))
        }
        i += 4
        continue
      }
      // \uNNNN? — carácter Unicode (con char ASCII de fallback que descartamos)
      if (nxt === 'u' && /\d|-/.test(raw[i + 2] || '')) {
        const m = /^\\u(-?\d+)\??/.exec(raw.slice(i))
        if (m) {
          if (!ignorando) {
            let code = parseInt(m[1], 10)
            if (code < 0) code += 65536
            out.push(String.fromCharCode(code & 0xFFFF))
          }
          i += m[0].length
          // Si después del ? hay un char ASCII de fallback, descartarlo
          if (raw[i] && raw[i] !== '\\' && raw[i] !== '{' && raw[i] !== '}') i++
          continue
        }
      }
      // Control word: \word seguido opcionalmente de número y un espacio
      const m = /^\\([a-zA-Z]+)(-?\d+)?[ \t]?/.exec(raw.slice(i))
      if (m) {
        const word = m[1]
        // Detectar grupos de cabecera al inicio del grupo actual
        if (GRUPOS_IGNORAR.has(word.toLowerCase())) {
          ignorarHasta.push(depth)
        } else if (!ignorando) {
          if (word === 'par' || word === 'line' || word === 'pard') out.push('\n')
          else if (word === 'page' || word === 'sect') out.push('\n\n')
          else if (word === 'tab') out.push('\t')
          else if (word === 'emdash') out.push('—')
          else if (word === 'endash') out.push('–')
          else if (word === 'lquote') out.push('‘')
          else if (word === 'rquote') out.push('’')
          else if (word === 'ldblquote') out.push('“')
          else if (word === 'rdblquote') out.push('”')
          else if (word === 'bullet') out.push('•')
        }
        i += m[0].length
        continue
      }
      // Símbolo solitario (\\n, etc.) — saltar la barra
      i++
      continue
    }
    if (!ignorando && c !== '\r') {
      out.push(c)
    }
    i++
  }
  // Colapsar saltos de línea triples y espacios al final
  return out.join('').replace(/\n{3,}/g, '\n\n').trim()
}
