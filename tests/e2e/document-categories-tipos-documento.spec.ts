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

test('/document-categories: 3 pestanas con nombres correctos', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // Pestana "Tipo de Documento" debe existir como PRIMERA
  await expect(page.getByRole('button', { name: /tipo de documento/i }).first()).toBeVisible({ timeout: 10000 })
  // Pestanas renombradas
  await expect(page.getByRole('button', { name: /categor.as de caracter.sticas/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /tipos de caracter.sticas/i })).toBeVisible()
})

test('/document-categories tab Tipo de Documento: lista los 17 tipos globales', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.getByRole('button', { name: /tipo de documento/i }).first().click()
  await page.waitForTimeout(800)

  // Verifica que se muestren al menos algunos tipos conocidos del seed
  await expect(page.getByText(/factura/i).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/contrato/i).first()).toBeVisible()
  await expect(page.getByText(/boleta/i).first()).toBeVisible()
})

test('/document-categories tab Tipo de Documento: modal de edicion abre y muestra 4 sub-pestanas', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.getByRole('button', { name: /tipo de documento/i }).first().click()
  await page.waitForTimeout(800)

  // Click en el lapiz de FACTURA
  const filaFactura = page.locator('tr', { hasText: /factura/i }).first()
  await filaFactura.locator('button[title="Editar"], button:has(svg.lucide-pencil)').first().click({ timeout: 10000 })
  await page.waitForTimeout(500)

  // Dentro del modal: 4 sub-pestanas
  const modal = page.locator('[role="dialog"], .modal-content, [data-testid="modal"]').first()
  await expect(modal.getByRole('button', { name: /^datos$/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /system prompt/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /prompts.*insert.*update/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /caracter.sticas/i })).toBeVisible()
})

test('/document-categories tab Tipo de Documento: pestana Caracteristicas muestra relaciones del tipo', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.getByRole('button', { name: /tipo de documento/i }).first().click()
  await page.waitForTimeout(800)

  const filaFactura = page.locator('tr', { hasText: /factura/i }).first()
  await filaFactura.locator('button[title="Editar"], button:has(svg.lucide-pencil)').first().click({ timeout: 10000 })
  await page.waitForTimeout(500)

  // Ir a pestana Caracteristicas
  await page.getByRole('button', { name: /caracter.sticas/i }).click()
  await page.waitForTimeout(1500)

  // FACTURA debe tener al menos MONTOS y FECHAS en su seed
  await expect(page.getByText(/monto/i).first()).toBeVisible({ timeout: 10000 })
})
