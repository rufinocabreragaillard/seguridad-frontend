import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

type Mensajes = Record<string, unknown>

/**
 * Merge profundo: el locale activo gana; las claves ausentes se completan con
 * el fallback (es.json). Esto sostiene la regla operativa del proyecto: solo se
 * commitea `es.json` cuando se agregan strings nuevos; los demás idiomas se
 * traducen luego en batch. Sin este merge el usuario vería el path técnico
 * (ej. "processPipeline.btnCargarDesdeDirectorio") en cada idioma desfasado.
 */
function mergeDeep(base: Mensajes, override: Mensajes): Mensajes {
  const out: Mensajes = { ...base }
  for (const [k, v] of Object.entries(override)) {
    const b = out[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = mergeDeep(b as Mensajes, v as Mensajes)
    } else {
      out[k] = v
    }
  }
  return out
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('NEXT_LOCALE')?.value || defaultLocale
  const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale

  const esMessages = (await import(`../../messages/es.json`)).default as Mensajes
  const localeMessages = locale === 'es'
    ? esMessages
    : ((await import(`../../messages/${locale}.json`)).default as Mensajes)

  const messages = locale === 'es' ? esMessages : mergeDeep(esMessages, localeMessages)

  return {
    locale,
    messages,
  }
})
