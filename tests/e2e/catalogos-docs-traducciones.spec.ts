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

test('/document-categories: botón "Regenerar traducciones" dispara generación de catálogos', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  const boton = page.getByRole('button', { name: /regenerar traducciones/i })
  await expect(boton).toBeVisible({ timeout: 10000 })

  // Capturamos la llamada al endpoint para verificar que envía grupo_tabla=catalogos_docs
  const [request] = await Promise.all([
    page.waitForRequest(
      (req) => req.url().includes('/traducciones/generar') && req.method() === 'POST',
      { timeout: 15000 },
    ),
    boton.click(),
  ])
  const body = request.postDataJSON() as { grupo_tabla?: string; modo?: string }
  expect(body.grupo_tabla).toBe('catalogos_docs')

  // Aparece feedback inline (ok o, si ya había una en curso, también ok)
  await expect(page.getByText(/traducciones|en proceso|progreso|minutos/i).first())
    .toBeVisible({ timeout: 15000 })
})

test('/translations: botón "Solo catálogos de docs" envía grupo_tabla=catalogos_docs', async ({ page }) => {
  await page.goto(`${BASE_URL}/translations`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  const boton = page.getByRole('button', { name: /solo cat.logos de docs/i })
  await expect(boton).toBeVisible({ timeout: 10000 })

  const [request] = await Promise.all([
    page.waitForRequest(
      (req) => req.url().includes('/traducciones/generar') && req.method() === 'POST',
      { timeout: 15000 },
    ),
    boton.click(),
  ])
  const body = request.postDataJSON() as { grupo_tabla?: string; modo?: string }
  expect(body.grupo_tabla).toBe('catalogos_docs')
  expect(body.modo).toBe('completo')
})
