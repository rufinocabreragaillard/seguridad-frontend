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

test('modal /functions tab Otros Datos: sin "Aplicación origen", orden correcto, labels arriba en multilinea', async ({ page }) => {
  await page.goto(`${BASE_URL}/functions`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.locator('button[title="Editar"], button:has(svg.lucide-pencil)').first().click({ timeout: 10000 })

  await page.getByRole('button', { name: /otros datos/i }).click()
  await page.waitForTimeout(500)

  await expect(page.getByText(/aplicación origen/i)).toHaveCount(0)

  const modal = page.locator('[role="dialog"], .modal-body').first()

  const descTextarea = modal.locator('textarea').first()
  const helpTextarea = modal.locator('textarea').nth(1)
  const traducirCheck = modal.locator('label:has-text("Traducir")').first()

  const descBox = await descTextarea.boundingBox()
  const helpBox = await helpTextarea.boundingBox()
  const tradBox = await traducirCheck.boundingBox()

  if (!descBox || !helpBox || !tradBox) throw new Error('No boxes for fields')

  expect(descBox.y).toBeLessThan(helpBox.y)
  expect(helpBox.y).toBeLessThan(tradBox.y)

  const permisosLabel = modal.locator('label', { hasText: /permisos de operación/i }).first()
  await expect(permisosLabel).toBeVisible()

  const permisosBox = await permisosLabel.boundingBox()
  const permisosContainer = modal.locator('div.grid.grid-cols-2:has(input[type="checkbox"])').last()
  const permisosContainerBox = await permisosContainer.boundingBox()
  if (!permisosBox || !permisosContainerBox) throw new Error('No boxes for permisos')

  expect(permisosBox.y + permisosBox.height).toBeLessThanOrEqual(permisosContainerBox.y + 4)
})
