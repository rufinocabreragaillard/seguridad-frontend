import { expect, type BrowserContext, type Page } from '@playwright/test'

export type LocaleTest = 'es' | 'en' | 'pt' | 'fr' | 'de'

export interface LoginOpts {
  email: string
  password: string
  /** Locale ESPERADO. El control real lo hace la skill via UPDATE usuarios.locale. */
  locale: LocaleTest
}

/**
 * Login y estabilización del locale.
 *
 * IMPORTANTE — cómo se controla el idioma en serverlm:
 * El locale efectivo lo resuelve `fn_datos_usuario` en BD con cascada
 * parametros_usuario(PREFERENCIAS/IDIOMA) → parametros_grupo → parametros_generales
 * → usuarios.locale → 'es'. NO lo manda la cookie. Tras el login, AuthContext
 * (src/context/AuthContext.tsx) lee `ctx.locale` del backend y sincroniza la
 * cookie NEXT_LOCALE, forzando un reload si difiere. Por eso setear la cookie
 * desde el test es inútil: AuthContext la revierte.
 *
 * OJO con el caché: el backend (Railway) cachea el contexto del usuario 300s.
 * Un UPDATE directo a BD NO invalida ese caché → el login sigue viendo el locale
 * viejo hasta 5 min. La ÚNICA vía con efecto inmediato es el endpoint
 * `PUT /usuarios/{codigo}` (hace upsert + invalidar_cache_usuario).
 *
 * Responsabilidad de dejar al usuario en el locale objetivo: la skill
 * `/test-traduccion-pantalla` corre `_helpers/locale-api.mjs <email> <pass> en`
 * (que llama al endpoint) ANTES de lanzar el spec y restaura a 'es' al final.
 * Aquí solo logueamos, esperamos a que la sincronización/reload de AuthContext
 * termine, y verificamos el resultado.
 */
export async function loginYsetLocale(
  page: Page,
  _context: BrowserContext,
  { email, password, locale }: LoginOpts,
): Promise<void> {
  await page.goto('/')
  await page.getByLabel(/email|correo/i).fill(email)
  await page.getByLabel(/password|contraseña/i).fill(password)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })

  // AuthContext puede recargar para sincronizar la cookie con BD. Esperar a que
  // se estabilice (networkidle cubre el posible reload).
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

  // Verificación blanda: la cookie debe reflejar el locale objetivo. Si no,
  // significa que la skill no actualizó usuarios.locale antes de correr.
  const cookieLocale = (await page.context().cookies())
    .find((c) => c.name === 'NEXT_LOCALE')?.value
  if (cookieLocale && cookieLocale !== locale) {
    console.warn(
      `[traducciones] locale aplicado="${cookieLocale}" != esperado="${locale}". ` +
      `¿Se corrió locale-api.mjs <email> <pass> '${locale}' antes del spec?`,
    )
  }
}
