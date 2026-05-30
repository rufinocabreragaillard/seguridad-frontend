import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASSWORD = 'Test1234!'

/**
 * Verifica que las lengüetas de navegación de pantalla usan claves i18n
 * (no están hardcoded en español). Cubre las pantallas que se corrigieron
 * para eliminar literales hardcoded en los tabs.
 *
 * El cambio de locale real para probar inglés se hace fuera del test
 * (skill /test-traduccion-pantalla, vía locale-api.mjs). Aquí se valida
 * que en español rendericen los strings esperados, confirmando que la
 * lengüeta efectivamente se monta. Sirve como regresión del wiring i18n.
 */
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email|correo/i).fill(EMAIL)
  await page.getByLabel(/password|contraseña/i).fill(PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
}

test.describe('Lengüetas de pantalla — i18n', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('/functions: "Funciones" y "Tablas traducibles" + bloque tablas', async ({ page }) => {
    await page.goto(`${BASE_URL}/functions`)
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    await expect(page.getByRole('button', { name: /^Funciones$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Tablas traducibles$/ })).toBeVisible()

    await page.getByRole('button', { name: /^Tablas traducibles$/ }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText(/Configura qué tablas y campos se traducen/i)).toBeVisible()
  })

  test('/groups: lengüeta Cambiar Grupo visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/groups`)
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    // "Cambiar Grupo" es visible para todos; Grupos/Entidades/Borrar dependen de super-admin
    await expect(page.getByRole('button', { name: /^Cambiar Grupo$/ })).toBeVisible()
  })

  test('/parameters: tabs Grupo/Entidad/Usuario', async ({ page }) => {
    await page.goto(`${BASE_URL}/parameters`)
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    await expect(page.getByRole('button', { name: /^Grupo$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Entidad$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Usuario$/ })).toBeVisible()
  })

  test('/messaging: lengüetas Plantillas/Canales/Historial', async ({ page }) => {
    await page.goto(`${BASE_URL}/messaging`)
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    await expect(page.getByRole('button', { name: /^Plantillas$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Canales$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Historial$/ })).toBeVisible()
  })
})
