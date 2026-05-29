/**
 * Funciones puras de ejecución del pipeline de documentos.
 * Fuente de verdad única — page.tsx (Paso a Paso) y tab-pipeline-todo.tsx (Vectorizar todo)
 * usan exactamente estas funciones. No duplicar lógica aquí.
 */

import { documentosApi, colaEstadosDocsApi, cargaDocumentosApi, parametrosApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import {
  extraerTextoDeArchivo,
  abrirArchivoPorRuta,
  PdfProtegidoError,
  ArchivoNoEscaneable,
  NECESITA_OCR,
  NECESITA_DOC_BACKEND,
  EXTENSIONES_NO_TEXTUALES,
  type ExtraccionMixta,
  type TimingsExtraccion,
} from '@/lib/extraer-texto'
import {
  getDirectoryHandle as idbGetHandle,
  setDirectoryHandle as idbSetHandle,
  ensureReadPermission,
} from '@/lib/file-handle-store'
import { escanearArchivosDirectorio } from '@/lib/escanear-directorio'
import type { MutableRefObject } from 'react'

// ── Tipos compartidos ──────────────────────────────────────────────────────────

export interface ItemColaLocal {
  id_cola: number
  codigo_documento: string
  nombre_documento: string
  ubicacion_documento?: string
  estado_cola: string
  resultado?: string | null
  tiempo_ms?: number
  modelo_usado?: string | null
}

export interface UbicacionOpt {
  codigo_ubicacion: string
  nombre_ubicacion: string
  url: string
  nivel: number
  tipo_ubicacion?: 'AREA' | 'CONTENIDO'
  codigo_ubicacion_superior?: string
  ubicacion_habilitada?: boolean
}

export interface FiltrosPipeline {
  ubicacionSel?: string
  filtroLibre?: string
  tope?: string
}

// Callbacks para reportar progreso al componente
export interface ProgresoCb {
  onTotal?: (total: number) => void
  onCompletado?: (completados: number) => void
  onItem?: (item: ItemColaLocal) => void
}

// ── CARGAR: FILESYSTEM → CARGADO ──────────────────────────────────────────────

export type ScanResult = NonNullable<Awaited<ReturnType<typeof escanearArchivosDirectorio>>>

export interface PendingCarga {
  scan: ScanResult
  archivosParaCargar: ScanResult['archivos']
  codigosUbicacionEscaneadas: string[]
}

export async function escanearParaCarga(opts: {
  userId: string | null
  grupoActivo: string | null
  ubicaciones: UbicacionOpt[]
  nivelesDirectorio: number
  tope?: string
  dirHandle?: FileSystemDirectoryHandle | null
  abortSignal?: AbortSignal
}): Promise<PendingCarga | null> {
  const { userId, grupoActivo, ubicaciones, nivelesDirectorio, tope, dirHandle, abortSignal } = opts

  let handleEfectivo: FileSystemDirectoryHandle | null = dirHandle ?? null
  if (!handleEfectivo) {
    const stored = await idbGetHandle(userId, grupoActivo)
    if (stored) handleEfectivo = stored
  }
  // Si tenemos handle pero el permiso está en "prompt", intentar pedirlo;
  // si falla (sin gesto de usuario), igual usamos el handle — Chrome suele
  // permitir el acceso aunque queryPermission diga "prompt" cuando el handle
  // fue obtenido recientemente en la misma sesión.
  if (handleEfectivo) {
    const ok = await ensureReadPermission(handleEfectivo)
    if (!ok) {
      // Intentar de todas formas — si el handle no tiene acceso real,
      // escanearArchivosDirectorio retornará null y el paso se saltará.
    }
  }

  const rutasDeshabilitadas = new Set(
    ubicaciones.filter((u) => u.ubicacion_habilitada === false && u.url).map((u) => u.url)
  )

  const scan = await escanearArchivosDirectorio(
    handleEfectivo ?? undefined,
    nivelesDirectorio,
    abortSignal,
    rutasDeshabilitadas,
    tope ? parseInt(tope) : undefined,
  )
  if (!scan) return null

  await idbSetHandle(scan.dirHandle, userId, grupoActivo)

  const archivosParaCargar = tope ? scan.archivos.slice(0, parseInt(tope)) : scan.archivos
  const codigosUbicacionEscaneadas = ubicaciones
    .filter((u) => u.url && scan.rutasEscaneadas.includes(u.url))
    .map((u) => u.codigo_ubicacion)

  return { scan, archivosParaCargar, codigosUbicacionEscaneadas }
}

// Tamaño de lote por defecto si no se puede leer el parámetro de configuración.
const TAMANO_LOTE_CARGA_DEFAULT = 3000

// El tamaño de lote de la carga reutiliza el mismo parámetro que los demás pasos
// del pipeline (PROCESAMIENTO / TAMANO_PAQUETE), para tener un único knob.
async function obtenerTamanoLoteCarga(): Promise<number> {
  try {
    const r = await parametrosApi.obtenerValor('PROCESAMIENTO', 'TAMANO_PAQUETE')
    const n = parseInt(String(r?.valor ?? ''), 10)
    if (Number.isFinite(n) && n > 0) return n
  } catch { /* usar default */ }
  return TAMANO_LOTE_CARGA_DEFAULT
}

export async function ejecutarCarga(
  pending: PendingCarga,
  onProgreso?: (completados: number, total: number) => void,
): Promise<{
  insertados: number
  actualizados: number
  eliminados: number
}> {
  const { archivosParaCargar, codigosUbicacionEscaneadas } = pending
  const total = archivosParaCargar.length
  const codigosUbic = codigosUbicacionEscaneadas.length > 0 ? codigosUbicacionEscaneadas : undefined

  // Un solo POST con cientos de miles de archivos (~90 MB de JSON) supera el
  // límite de tamaño del proxy de Railway y falla con ERR_NETWORK ("no se recibió
  // respuesta"). Troceamos en lotes de TAMANO_PAQUETE; el UPSERT del backend es
  // idempotente, así que enviar en lotes es seguro.
  const tamanoLote = await obtenerTamanoLoteCarga()
  const lotes: (typeof archivosParaCargar)[] = []
  for (let i = 0; i < total; i += tamanoLote) {
    lotes.push(archivosParaCargar.slice(i, i + tamanoLote))
  }
  if (lotes.length === 0) lotes.push([])

  let insertados = 0
  let actualizados = 0
  let eliminados = 0
  onProgreso?.(0, total)

  // `codigos_ubicacion_escaneadas` dispara en el backend el borrado de documentos
  // huérfanos: los que están en esas ubicaciones pero NO vienen en el lote actual.
  // Con múltiples lotes eso borraría lo cargado por los lotes anteriores, así que
  // solo lo enviamos cuando hay un único lote (preserva el comportamiento previo en
  // cargas chicas). El UPSERT del backend es idempotente, por eso trocear es seguro.
  const esLoteUnico = lotes.length === 1
  for (let idx = 0; idx < lotes.length; idx++) {
    const res = await cargaDocumentosApi.cargar({
      archivos: lotes[idx],
      codigos_ubicacion_escaneadas: esLoteUnico ? codigosUbic : undefined,
    })
    insertados += res.insertados
    actualizados += res.actualizados
    eliminados += res.eliminados ?? 0
    onProgreso?.(Math.min((idx + 1) * tamanoLote, total), total)
  }

  return { insertados, actualizados, eliminados }
}

// ── EXTRAER: CARGADO → METADATA (client-side) ─────────────────────────────────

export async function ejecutarExtraer(opts: {
  userId: string | null
  grupoActivo: string | null
  procesos: ProcesoCatalogo[]
  filtros: FiltrosPipeline
  dirHandle?: FileSystemDirectoryHandle | null
  abortRef: MutableRefObject<boolean>
  onDirHandle?: (h: FileSystemDirectoryHandle) => void
  onItem?: (item: ItemColaLocal) => void
  onProgreso?: (completados: number, total: number) => void
}): Promise<{ ok: boolean; dirHandle?: FileSystemDirectoryHandle }> {
  const { userId, grupoActivo, procesos, filtros, abortRef, onDirHandle, onItem, onProgreso } = opts

  // 1. Obtener documentos en estado CARGADO
  const params: Record<string, unknown> = { codigo_estado_doc: 'CARGADO' }
  if (filtros.ubicacionSel) params.codigo_ubicacion = filtros.ubicacionSel
  if (filtros.filtroLibre?.trim()) params.q = filtros.filtroLibre.trim()
  const topeNum = filtros.tope ? parseInt(filtros.tope) : 0
  const docs = await documentosApi.listar(params as Parameters<typeof documentosApi.listar>[0])
  const docsFinal = topeNum > 0 ? docs.slice(0, topeNum) : docs
  if (docsFinal.length === 0) return { ok: true }

  // 2. Resolver handle de directorio
  let handle: FileSystemDirectoryHandle | null = opts.dirHandle ?? null
  if (!handle) {
    const stored = await idbGetHandle(userId, grupoActivo)
    if (stored) {
      handle = stored
      onDirHandle?.(stored)
    }
  }
  // Intentar obtener permiso si está en "prompt"; si falla (sin gesto de usuario),
  // usamos el handle de todas formas — Chrome suele permitir el acceso cuando el
  // handle fue obtenido en la misma sesión. Solo abrimos el picker si no hay handle.
  if (handle) {
    const ok = await ensureReadPermission(handle)
    if (ok) {
      await idbSetHandle(handle, userId, grupoActivo)
    }
    // Si !ok, intentamos igualmente con el handle existente
  } else {
    // Sin handle en absoluto: marcar todos como NO_ENCONTRADO
    for (const doc of docsFinal) {
      await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true }).catch(() => {})
    }
    return { ok: true }
  }

  // 3. Config del proceso EXTRAER
  const procesoExtraer = procesos.find((p) => p.estado_origen === 'CARGADO' && p.estado_destino === 'METADATA')
  const N_CONCURRENTE = procesoExtraer?.n_parallel ?? 6
  const timeoutExtraccionMs = procesoExtraer?.timeout_extraccion_seg
    ? procesoExtraer.timeout_extraccion_seg * 1000
    : undefined

  // 4. Flag DEBUG_TIEMPOS_PIPELINE
  let debugTiempos = false
  try {
    const r = await parametrosApi.obtenerValor('DOCUMENTOS', 'DEBUG_TIEMPOS_PIPELINE')
    debugTiempos = (r?.valor || '').toLowerCase() === 'true'
  } catch { /* apagado */ }

  // 5. Cola local inicial
  const colaInicial: ItemColaLocal[] = docsFinal.map((doc) => ({
    id_cola: 0,
    codigo_documento: doc.codigo_documento,
    nombre_documento: doc.nombre_documento,
    ubicacion_documento: doc.ubicacion_documento || undefined,
    estado_cola: 'PENDIENTE',
  }))
  onProgreso?.(0, docsFinal.length)

  let completados = 0
  const handleFinal = handle

  const procesarUno = async (item: ItemColaLocal, idx: number) => {
    if (abortRef.current) return
    onItem?.({ ...item, estado_cola: 'EN_PROCESO' })
    const t0 = Date.now()
    const timings: TimingsExtraccion | undefined = debugTiempos ? {} : undefined
    let tAbrirHandleMs = 0
    let subDuracionMs = 0

    try {
      if (!item.ubicacion_documento) {
        await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
        onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO (sin ubicación)', tiempo_ms: Date.now() - t0 })
        return
      }

      // Fast-path: extensiones no textuales
      const extPrev = (item.ubicacion_documento.split('.').pop() || '').toLowerCase()
      if (EXTENSIONES_NO_TEXTUALES.has(extPrev)) {
        await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: extPrev })
        onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (.${extPrev})`, tiempo_ms: Date.now() - t0 })
        return
      }

      const _tAbrir = Date.now()
      const fileHandle = await abrirArchivoPorRuta(handleFinal, item.ubicacion_documento)
      tAbrirHandleMs = Date.now() - _tAbrir

      if (!fileHandle) {
        await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
        onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: 'NO_ENCONTRADO', tiempo_ms: Date.now() - t0 })
        return
      }

      const ext = (item.ubicacion_documento.split('.').pop() || '').toLowerCase()
      const tExtraccion = Date.now()
      const contenidoRaw = await extraerTextoDeArchivo(fileHandle, timeoutExtraccionMs, timings)
      subDuracionMs = Date.now() - tExtraccion

      let contenido: string | typeof NECESITA_OCR | typeof NECESITA_DOC_BACKEND | null
      let paginasImagen: ExtraccionMixta['paginasImagen'] | undefined
      if (typeof contenidoRaw === 'object' && contenidoRaw !== null && 'paginasImagen' in contenidoRaw) {
        contenido = (contenidoRaw as ExtraccionMixta).texto
        paginasImagen = (contenidoRaw as ExtraccionMixta).paginasImagen
      } else {
        contenido = contenidoRaw as string | typeof NECESITA_OCR | typeof NECESITA_DOC_BACKEND | null
      }

      if (contenido === null) {
        await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', formato_no_soportado: ext || 'desconocido' })
        onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (.${ext})`, tiempo_ms: Date.now() - t0 })
        return
      }

      if (contenido === NECESITA_DOC_BACKEND) {
        onItem?.({ ...item, estado_cola: 'EN_PROCESO', resultado: 'antiword en proceso…' })
        try {
          const rawFile = await fileHandle.getFile()
          const rawBytes = await rawFile.arrayBuffer()
          const docRes = await documentosApi.subirDoc(item.codigo_documento, rawBytes)
          onItem?.({
            ...item,
            estado_cola: 'COMPLETADO',
            resultado: docRes.codigo_estado_doc === 'METADATA'
              ? `METADATA via antiword (${docRes.caracteres} chars)`
              : 'NO_ESCANEABLE (antiword sin texto)',
            tiempo_ms: Date.now() - t0,
          })
        } catch (docErr) {
          const docMsg = docErr instanceof Error ? docErr.message : 'Error antiword'
          let estadoReal: string | null = null
          try { const d = await documentosApi.obtener(item.codigo_documento); estadoReal = d?.codigo_estado_doc || null } catch { /* best effort */ }
          if (estadoReal === 'METADATA') {
            onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: 'METADATA via antiword (respuesta perdida — backend OK)', tiempo_ms: Date.now() - t0 })
          } else {
            onItem?.({ ...item, estado_cola: 'ERROR', resultado: `antiword falló: ${docMsg}`, tiempo_ms: Date.now() - t0 })
          }
        }
        return
      }

      if (contenido === NECESITA_OCR) {
        onItem?.({ ...item, estado_cola: 'EN_PROCESO', resultado: 'OCR en proceso…' })
        try {
          const rawFile = await fileHandle.getFile()
          const rawBytes = await rawFile.arrayBuffer()
          const ocrRes = await documentosApi.subirOcr(item.codigo_documento, rawBytes)
          onItem?.({
            ...item,
            estado_cola: 'COMPLETADO',
            resultado: ocrRes.codigo_estado_doc === 'METADATA'
              ? `METADATA via OCR (${ocrRes.caracteres} chars)`
              : 'NO_ESCANEABLE (OCR sin texto)',
            tiempo_ms: Date.now() - t0,
          })
        } catch (ocrErr) {
          const ocrMsg = ocrErr instanceof Error ? ocrErr.message : 'Error OCR'
          let estadoReal: string | null = null
          try { const d = await documentosApi.obtener(item.codigo_documento); estadoReal = d?.codigo_estado_doc || null } catch { /* best effort */ }
          if (estadoReal === 'METADATA') {
            onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: 'METADATA via OCR (respuesta perdida — backend OK)', tiempo_ms: Date.now() - t0 })
          } else {
            onItem?.({ ...item, estado_cola: 'ERROR', resultado: `OCR falló: ${ocrMsg}`, tiempo_ms: Date.now() - t0 })
          }
        }
        return
      }

      if (!contenido.trim() && !paginasImagen?.length) {
        await documentosApi.subirTexto(item.codigo_documento, { texto_fuente: '', contenido_vacio: true })
        onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: 'NO_ESCANEABLE (vacío)', tiempo_ms: Date.now() - t0 })
        return
      }

      // Limpiar chars nulos y truncar a 60k (límite Railway)
      const MAX_CHARS = 60_000
      // eslint-disable-next-line no-control-regex
      const textoLimpio = contenido.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      const textoFinal = textoLimpio.length > MAX_CHARS ? textoLimpio.slice(0, MAX_CHARS) : textoLimpio

      const timingsDebug = timings
        ? { ...timings, t_abrir_handle_ms: tAbrirHandleMs, t_total_extraccion_ms: subDuracionMs }
        : undefined

      const res = await documentosApi.subirTexto(item.codigo_documento, {
        texto_fuente: textoFinal,
        caracteres: contenido.length,
        fecha_inicio_extraccion: new Date(t0).toISOString(),
        sub_duracion_ms: subDuracionMs,
        ...(paginasImagen ? { paginas_imagen: paginasImagen } : {}),
        ...(timingsDebug ? { timings_debug: timingsDebug } : {}),
      })
      if (timingsDebug) {
        console.debug('[EXTRAER timings]', item.codigo_documento, { ...timingsDebug, t_total_ms: Date.now() - t0 })
      }
      onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: `METADATA (${res.caracteres} chars)`, tiempo_ms: Date.now() - t0 })

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      if (e instanceof PdfProtegidoError || e instanceof ArchivoNoEscaneable) {
        const detalle = e instanceof PdfProtegidoError ? 'pdf-protegido' : msg
        const etiqueta = e instanceof PdfProtegidoError ? 'PDF protegido' : msg
        const timingsDebug = timings
          ? { ...timings, t_abrir_handle_ms: tAbrirHandleMs, t_total_extraccion_ms: subDuracionMs }
          : undefined
        try {
          await documentosApi.subirTexto(item.codigo_documento, {
            texto_fuente: '',
            formato_no_soportado: detalle,
            ...(timingsDebug ? { timings_debug: timingsDebug } : {}),
          })
        } catch { /* al menos queda visible en UI */ }
        if (timingsDebug) console.debug('[EXTRAER timings (fail)]', item.codigo_documento, { ...timingsDebug, t_total_ms: Date.now() - t0 })
        onItem?.({ ...item, estado_cola: 'COMPLETADO', resultado: `NO_ESCANEABLE (${etiqueta})`, tiempo_ms: Date.now() - t0 })
      } else {
        onItem?.({ ...item, estado_cola: 'ERROR', resultado: msg, tiempo_ms: Date.now() - t0 })
      }
    } finally {
      completados++
      onProgreso?.(completados, docsFinal.length)
    }
  }

  // Sliding window: N workers concurrentes
  let nextIdx = 0
  const worker = async () => {
    while (!abortRef.current) {
      const myIdx = nextIdx++
      if (myIdx >= colaInicial.length) return
      await procesarUno(colaInicial[myIdx], myIdx)
    }
  }
  await Promise.all(Array.from({ length: N_CONCURRENTE }, () => worker()))

  return { ok: true, dirHandle: handle ?? undefined }
}

// ── BACKEND: cualquier paso via cola (ANALIZAR, CHUNKEAR, VECTORIZAR) ─────────

export async function ejecutarPasoBackend(opts: {
  estadoOrigen: string
  estadoDestino: string
  codigoProceso: string
  filtros: FiltrosPipeline
  abortRef: MutableRefObject<boolean>
  resolveColaRef: MutableRefObject<(() => void) | null>
  onProgreso?: (completados: number, total: number) => void
  opcionesExtra?: Record<string, unknown>
}): Promise<boolean> {
  const { estadoOrigen, estadoDestino, codigoProceso, filtros, abortRef, resolveColaRef, onProgreso, opcionesExtra } = opts

  const params: Record<string, unknown> = { codigo_estado_doc: estadoOrigen }
  if (filtros.ubicacionSel) params.codigo_ubicacion = filtros.ubicacionSel
  if (filtros.filtroLibre?.trim()) params.q = filtros.filtroLibre.trim()
  const topeNum = filtros.tope ? parseInt(filtros.tope) : 0
  const docsRaw = await documentosApi.listar(params as Parameters<typeof documentosApi.listar>[0])
  const docs = topeNum > 0 ? docsRaw.slice(0, topeNum) : docsRaw
  if (docs.length === 0) return true

  onProgreso?.(0, docs.length)

  // Encolar e iniciar worker backend
  await colaEstadosDocsApi.inicializarPorEstado(
    estadoOrigen,
    estadoDestino,
    undefined,
    topeNum > 0 ? topeNum : null,
    filtros.ubicacionSel || null,
    filtros.filtroLibre?.trim() || null,
    codigoProceso || null,
    opcionesExtra ?? null,
  )

  // El procesamiento real lo hace una BackgroundTask autónoma del backend (worker
  // con lease): drena la cola moviendo los ítems PENDIENTE→EN_PROCESO→COMPLETADO
  // por su cuenta. La lanzamos y luego MONITOREAMOS su avance.
  try { await colaEstadosDocsApi.ejecutar(estadoDestino, codigoProceso || undefined) } catch { /* continuar */ }

  const esperarCambio = () => new Promise<void>((resolve) => {
    // Timeout reducido a 5s: si el realtime no llega, polling frecuente evita bloqueos
    const timeoutId = setTimeout(() => { resolveColaRef.current = null; resolve() }, 5_000)
    resolveColaRef.current = () => { clearTimeout(timeoutId); resolve() }
  })

  // Progreso autoritativo: contamos sobre el estado REAL de la fase (destino) que
  // reporta `resumen-pipeline` —la misma fuente que usa el resto de la pantalla—,
  // y no sobre un snapshot de id_cola. El worker autónomo mueve y completa ítems
  // por su cuenta, y entre paquetes se borran los COMPLETADO: un snapshot de ids se
  // desincronizaba y dejaba el contador clavado en 0 mientras el backend avanzaba.
  const total = docs.length
  const refrescar = async (): Promise<number> => {
    const resumen = await colaEstadosDocsApi.resumenPipeline(120)
    const fase = resumen?.por_destino?.[estadoDestino]
    if (!fase) return 0
    onProgreso?.(Math.min(fase.completado, total), total)
    return fase.pendiente + fase.en_proceso
  }

  // Primera lectura: si no hay nada activo (todo ya avanzó o no se encoló nada),
  // damos una pasada de gracia —el worker puede no haber marcado EN_PROCESO aún—
  // antes de dar el paso por terminado, para no cerrarlo por una lectura prematura.
  try {
    if (await refrescar() === 0) {
      await esperarCambio()
      if (abortRef.current) return false
      if (await refrescar() === 0) return !abortRef.current
    }
  } catch { /* continuar al loop de monitoreo */ }

  while (!abortRef.current) {
    await esperarCambio()
    if (abortRef.current) return false
    try {
      if (await refrescar() === 0) break
    } catch { /* reintentar */ }
  }

  return !abortRef.current
}
