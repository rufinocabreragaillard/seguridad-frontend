/**
 * Resolución de la "raíz madre" de un grupo activo a partir de las
 * ubicaciones raíz registradas en BD.
 *
 * Reglas (ver Tarea 1):
 *   1. GET /ubicaciones-docs?solo_raices=true (filtra por grupo en backend).
 *   2. Si hay 1 raíz → esa es la madre.
 *   3. Si hay varias → buscar prefijo común no trivial (más profundo que `/`).
 *      Si una de las raíces ES exactamente ese prefijo, esa es la madre.
 *      Si no hay prefijo común no trivial → tomar la primera por orden alfabético
 *      de `codigo_ubicacion` y emitir aviso.
 */

import { ubicacionesDocsApi } from './api'
import type { UbicacionDoc } from './tipos'

export interface RaizMadre {
  codigo: string
  nombre: string
  url: string
  aviso?: string
}

function normalizarUrl(u: string | null | undefined): string {
  if (!u) return ''
  // unifica separadores y quita trailing slash
  let s = u.replace(/\\/g, '/')
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s
}

/**
 * Encuentra el prefijo de path común a todas las urls (segmento por segmento).
 * Devuelve '' si solo comparten la raíz (`/` o vacío).
 */
function prefijoComunPath(urls: string[]): string {
  if (urls.length === 0) return ''
  const partes = urls.map((u) => u.split('/'))
  const minLen = Math.min(...partes.map((p) => p.length))
  const comunes: string[] = []
  for (let i = 0; i < minLen; i++) {
    const seg = partes[0][i]
    if (partes.every((p) => p[i] === seg)) comunes.push(seg)
    else break
  }
  // comunes[0] suele ser '' (porque la url empieza con '/').
  // Si solo tenemos '' o ['', ''] → trivial.
  const join = comunes.join('/')
  if (!join || join === '' || join === '/') return ''
  // Necesitamos al menos un segmento no vacío real.
  const segmentosReales = comunes.filter((s) => s.length > 0)
  if (segmentosReales.length === 0) return ''
  return join
}

export async function obtenerRaizMadre(
  grupoActivo: string | null | undefined,
): Promise<RaizMadre | null> {
  if (!grupoActivo) return null
  let raices: UbicacionDoc[] = []
  try {
    raices = await ubicacionesDocsApi.listar({ solo_raices: true })
  } catch {
    return null
  }
  if (!raices || raices.length === 0) return null

  if (raices.length === 1) {
    const r = raices[0]
    return {
      codigo: r.codigo_ubicacion,
      nombre: r.nombre_ubicacion,
      url: normalizarUrl(r.url) || '',
    }
  }

  const urls = raices.map((r) => normalizarUrl(r.url)).filter((u) => u.length > 0)
  if (urls.length === raices.length) {
    const prefijo = prefijoComunPath(urls)
    if (prefijo) {
      // ¿alguna fila ES exactamente este prefijo?
      const exacta = raices.find((r) => normalizarUrl(r.url) === prefijo)
      if (exacta) {
        return {
          codigo: exacta.codigo_ubicacion,
          nombre: exacta.nombre_ubicacion,
          url: prefijo,
        }
      }
      // Prefijo válido pero ninguna fila lo es. Caemos a la primera.
      const primera = [...raices].sort((a, b) =>
        a.codigo_ubicacion.localeCompare(b.codigo_ubicacion),
      )[0]
      return {
        codigo: primera.codigo_ubicacion,
        nombre: primera.nombre_ubicacion,
        url: normalizarUrl(primera.url) || '',
        aviso: `Se detectaron varias raíces con ancestro común '${prefijo}'. Usando: ${primera.nombre_ubicacion}`,
      }
    }
  }

  // Sin prefijo común no trivial.
  const primera = [...raices].sort((a, b) =>
    a.codigo_ubicacion.localeCompare(b.codigo_ubicacion),
  )[0]
  return {
    codigo: primera.codigo_ubicacion,
    nombre: primera.nombre_ubicacion,
    url: normalizarUrl(primera.url) || '',
    aviso: `Se detectaron varias raíces sin ancestro común. Usando: ${primera.nombre_ubicacion}`,
  }
}
