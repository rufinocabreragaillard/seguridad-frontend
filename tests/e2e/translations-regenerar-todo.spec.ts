import { test, expect } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASSWORD = 'Test1234!'

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email|correo/i).fill(EMAIL)
  await page.getByLabel(/password|contraseña/i).fill(PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
})

// /translations: el botón "Regenerar TODO" tiene que disparar el nuevo
// endpoint /traducciones/generar-todo (no el viejo /traducciones/generar)
// con es_json + locales_actuales en el body. Esto garantiza que la pantalla
// envía el snapshot de los messages/*.json para que el backend pueda calcular
// el diff de namespaces UI faltantes.
test('/translations: "Regenerar TODO" llama /generar-todo con es_json y locales_actuales', async ({ page }) => {
  await page.goto(`${BASE_URL}/translations`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // El botón muestra "Regenerar TODO (pendientes)" según la i18n actualizada
  const boton = page.getByRole('button', { name: /regenerar todo/i })
  await expect(boton).toBeVisible({ timeout: 10000 })

  // Hay un modal de confirmación que se abre primero
  await boton.click()

  const confirmar = page.getByRole('button', { name: /sí, regenerar pendientes/i })
  await expect(confirmar).toBeVisible({ timeout: 5000 })

  const [request] = await Promise.all([
    page.waitForRequest(
      (req) => req.url().includes('/traducciones/generar-todo') && req.method() === 'POST',
      { timeout: 15000 },
    ),
    confirmar.click(),
  ])

  const body = request.postDataJSON() as {
    es_json?: Record<string, unknown>
    locales_actuales?: Record<string, unknown>
  }

  // Debe enviar el es.json completo con namespaces conocidos
  expect(body.es_json).toBeDefined()
  expect(typeof body.es_json).toBe('object')
  expect(Object.keys(body.es_json!).length).toBeGreaterThan(20) // muchos namespaces

  // Debe enviar al menos los locales no-base (en/pt/fr/de) como snapshot
  expect(body.locales_actuales).toBeDefined()
  const locales = Object.keys(body.locales_actuales!)
  expect(locales).toContain('en')
  expect(locales).toContain('pt')
  expect(locales).toContain('fr')
  expect(locales).toContain('de')
})

// Verifica que la nota visible Railway→Vercel está presente.
// Esto le recuerda al admin que tras "Regenerar TODO" debe correr el skill
// /traducciones-aplicar desde su máquina para commitear los messages/<x>.json
// al repo serverlm-frontend (Vercel redespliega).
test('/translations: muestra nota Railway→Vercel cerca de los botones', async ({ page }) => {
  await page.goto(`${BASE_URL}/translations`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // El texto de la nota menciona el skill por nombre
  await expect(page.getByText(/traducciones-aplicar/i).first())
    .toBeVisible({ timeout: 10000 })
})
