/**
 * Client LM — detección del puente nativo y operaciones 100% locales.
 *
 * Cuando el Web canónico corre dentro del Client LM (shell PySide6 + WebView),
 * el cliente inyecta `window.serverlmClient` vía QWebChannel. Su presencia activa
 * el "modo local": elegir carpeta con el Finder nativo (ruta ABSOLUTA, que el
 * navegador no puede capturar) y correr el pipeline contra el FastAPI local
 * (127.0.0.1). El contenido y los embeddings nunca salen del disco.
 *
 * Desde un browser normal `window.serverlmClient` no existe y el Web mantiene su
 * flujo cloud intacto.
 */

type PuenteClient = {
  puerto(cb: (port: number) => void): void
  elegirCarpeta(cb: (ruta: string) => void): void
  plataforma(cb: (p: string) => void): void
  version(cb: (v: string) => void): void
}

declare global {
  interface Window {
    serverlmClient?: PuenteClient
  }
}

export type StatusLocal = {
  ok: boolean
  tareas_pendientes: number
  en_proceso: number
  completadas: number
  errores: number
  primera: { codigo_documento: string; codigo_estado_doc_origen: string; codigo_estado_doc_destino: string } | null
  docs_por_estado: Record<string, number>
  vectorizados: number
  no_procesables: number
  total_docs: number
}

export type ResultadoIngesta = {
  ok: boolean
  directorio: string
  total_archivos: number
  nuevos: number
  actualizados: number
  sin_cambio: number
  encolados: number
  ubicaciones_nuevas: number
  errores: number
}

/** ¿Estamos corriendo dentro del Client LM (puente ya inyectado)? */
export function hayClientLM(): boolean {
  return typeof window !== 'undefined' && !!window.serverlmClient
}

/**
 * Espera a que el puente esté listo. El objeto lo inyecta QWebChannel de forma
 * asíncrona tras cargar la página, así que puede no existir en el primer render.
 * Resuelve `true` si aparece dentro del timeout, `false` si no (browser normal).
 */
export function esperarClientLM(timeoutMs = 4000): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (hayClientLM()) return Promise.resolve(true)
  return new Promise((resolve) => {
    let resuelto = false
    const fin = (val: boolean) => {
      if (resuelto) return
      resuelto = true
      window.removeEventListener('serverlmClientReady', onReady)
      clearInterval(iv)
      resolve(val)
    }
    const onReady = () => fin(true)
    window.addEventListener('serverlmClientReady', onReady, { once: true })
    const t0 = Date.now()
    const iv = setInterval(() => {
      if (hayClientLM()) fin(true)
      else if (Date.now() - t0 > timeoutMs) fin(false)
    }, 100)
  })
}

/** Envuelve un método callback-style del puente QWebChannel en una Promise. */
function llamarPuente<T>(metodo: keyof PuenteClient): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const c = window.serverlmClient
    if (!c) {
      reject(new Error('Client LM no disponible'))
      return
    }
    try {
      ;(c[metodo] as (cb: (res: T) => void) => void)((res: T) => resolve(res))
    } catch (e) {
      reject(e)
    }
  })
}

let _baseUrl: string | null = null

/** URL base del FastAPI local (resuelve el puerto vía el puente, una sola vez). */
export async function baseUrlLocal(): Promise<string> {
  if (_baseUrl) return _baseUrl
  const port = await llamarPuente<number>('puerto')
  const p = Math.trunc(Number(port) || 0)
  if (!p) throw new Error('API local sin puerto (¿el servidor local no arrancó?)')
  _baseUrl = `http://127.0.0.1:${p}`
  return _baseUrl
}

/** Abre el Finder nativo y devuelve la ruta absoluta elegida ("" si cancela). */
export async function elegirCarpetaLocal(): Promise<string> {
  const ruta = await llamarPuente<string>('elegirCarpeta')
  return ruta || ''
}

/** Escanea una carpeta local (ruta absoluta) → alta CARGADO + encolar. */
export async function ingestarLocal(directorio: string): Promise<ResultadoIngesta> {
  const base = await baseUrlLocal()
  const r = await fetch(`${base}/api/cliente/ingestar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directorio }),
  })
  if (!r.ok) throw new Error(`Ingesta local falló (${r.status}): ${await r.text()}`)
  return r.json()
}

/** Dispara una pasada del procesador local (vacía la cola en background). */
export async function ejecutarLocal(): Promise<{ ok: boolean; mensaje?: string }> {
  const base = await baseUrlLocal()
  const r = await fetch(`${base}/api/cliente/procesador/ejecutar`, { method: 'POST' })
  if (!r.ok) throw new Error(`Procesador local falló (${r.status})`)
  return r.json()
}

/** Estado de la corrida local (alimenta el anillo de progreso). */
export async function statusLocal(): Promise<StatusLocal> {
  const base = await baseUrlLocal()
  const r = await fetch(`${base}/api/cliente/status-procesador`)
  if (!r.ok) throw new Error(`Status local falló (${r.status})`)
  return r.json()
}
