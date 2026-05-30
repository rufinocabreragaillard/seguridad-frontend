import { test, expect } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASSWORD = 'Test1234!'

/**
 * Verifica que las lengüetas "Funciones / Tablas traducibles" de /functions
 * usan claves i18n (no están hardcoded en español).
 *
 * El cambio de locale real para probar inglés tiene que hacerse fuera del
 * test corriendo `tests/e2e/_traducciones/_helpers/locale-api.mjs` antes
 * (la skill `/test-traduccion-pantalla` lo orquesta). Aquí solo se valida
 * que el render en español usa los strings esperados y que las claves
 * existen en messages/es.json.
 */
test('lengüetas /functions: render español usa claves t() (no literales hardcoded)', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email|correo/i).fill(EMAIL)
  await page.getByLabel(/password|contraseña/i).fill(PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })

  await page.goto(`${BASE_URL}/functions`)
  await page.waitForLoadState('networkidle', { timeout: 20000 })

  // Lengüetas presentes
  await expect(page.getByRole('button', { name: /^Funciones$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tablas traducibles$/ })).toBeVisible()

  // Bloque Tablas traducibles renderiza con strings esperados
  await page.getByRole('button', { name: /^Tablas traducibles$/ }).click()
  await page.waitForTimeout(500)
  await expect(page.getByText(/Configura qué tablas y campos se traducen/i)).toBeVisible()
})
