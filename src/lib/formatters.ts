/**
 * Formatters compartidos.
 *
 * Toda página que necesite mostrar fechas, montos o números formateados debe
 * importar desde aquí en vez de re-implementar `toLocaleString` inline.
 */

const LOCALE_ES = 'es-CL'
const TZ_CHILE = 'America/Santiago'

export type FormatoFecha = 'corto' | 'mediano' | 'completo' | 'fecha' | 'hora'

/** Formatea un Date|string|null a fecha legible en es-CL, siempre en hora de Chile. */
export function formatFecha(
  valor: string | Date | null | undefined,
  formato: FormatoFecha = 'corto',
): string {
  if (!valor) return '—'
  const d = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(d.getTime())) return '—'

  switch (formato) {
    case 'fecha':
      return d.toLocaleDateString(LOCALE_ES, { dateStyle: 'short', timeZone: TZ_CHILE })
    case 'hora':
      return d.toLocaleTimeString(LOCALE_ES, { timeStyle: 'short', timeZone: TZ_CHILE })
    case 'mediano':
      return d.toLocaleString(LOCALE_ES, { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ_CHILE })
    case 'completo':
      return d.toLocaleString(LOCALE_ES, { dateStyle: 'long', timeStyle: 'medium', timeZone: TZ_CHILE })
    case 'corto':
    default:
      return d.toLocaleString(LOCALE_ES, { dateStyle: 'short', timeStyle: 'short', timeZone: TZ_CHILE })
  }
}

/** "Hace 3 minutos", "Hace 2 horas", "Ayer", etc. Para listas tipo log. */
export function formatFechaRelativa(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  const d = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(d.getTime())) return '—'

  const diff = Date.now() - d.getTime()
  const segundos = Math.floor(diff / 1000)
  const minutos = Math.floor(segundos / 60)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)

  if (segundos < 60) return 'Hace unos segundos'
  if (minutos < 60) return `Hace ${minutos} minuto${minutos === 1 ? '' : 's'}`
  if (horas < 24) return `Hace ${horas} hora${horas === 1 ? '' : 's'}`
  if (dias < 7) return `Hace ${dias} día${dias === 1 ? '' : 's'}`
  return formatFecha(d, 'fecha')
}

/** Formatea un número como pesos chilenos. `1234567` → `$1.234.567`. */
export function toCLP(valor: number | null | undefined, opciones?: { sinSimbolo?: boolean }): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  const formateado = new Intl.NumberFormat(LOCALE_ES, {
    style: opciones?.sinSimbolo ? 'decimal' : 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(valor)
  return formateado
}

/** Formatea un número en USD con N decimales. */
export function toUSD(valor: number | null | undefined, decimales = 2): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return new Intl.NumberFormat(LOCALE_ES, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

/** Formatea un número con separador de miles. `1234567` → `1.234.567`. */
export function formatNumero(
  valor: number | null | undefined,
  decimales = 0,
): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return new Intl.NumberFormat(LOCALE_ES, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

/** Formatea una duración en milisegundos a `1.2 s`, `345 ms`, `2 m 14 s`. */
export function formatDuracion(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const segundos = ms / 1000
  if (segundos < 60) return `${segundos.toFixed(1)} s`
  const m = Math.floor(segundos / 60)
  const s = Math.round(segundos % 60)
  return `${m} m ${s} s`
}

/** Formatea bytes a KB, MB, GB. */
export function formatBytes(bytes: number | null | undefined, decimales = 1): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))
  const valor = bytes / Math.pow(1024, i)
  return `${valor.toFixed(decimales)} ${unidades[i]}`
}
