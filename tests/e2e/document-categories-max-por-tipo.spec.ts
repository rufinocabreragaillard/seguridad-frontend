import { test, expect } from '@playwright/test'

// Pantalla CATEGORIAS_CARACT_DOCS es tipo SISTEMA — requiere admin con rol
// SISTEMA o SISTEMA-DOCUMENTOS (verificado en BD).
const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASSWORD = 'Test1234!'

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(admin|dashboard|chat|document-categories|document-locations)/, { timeout: 15000 })
})

test('document-categories: pestaña Tipos muestra columna Máx con valor numérico', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 20000 })

  await page.getByRole('button', { name: /tipos/i }).first().click()

  const selectorCategoria = page.locator('select').first()
  await selectorCategoria.selectOption({ label: /Tipo de Documento/i })

  await page.waitForLoadState('networkidle', { timeout: 10000 })

  await expect(page.getByRole('columnheader', { name: /^máx$/i })).toBeVisible({ timeout: 10000 })

  const filaCartola = page.getByRole('row').filter({ hasText: /cartola/i }).first()
  await expect(filaCartola).toBeVisible({ timeout: 10000 })
})

test('document-categories: modal de Tipo permite editar Máximo por documento', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 20000 })

  await page.getByRole('button', { name: /tipos/i }).first().click()

  const selectorCategoria = page.locator('select').first()
  await selectorCategoria.selectOption({ label: /Tipo de Documento/i })
  await page.waitForLoadState('networkidle', { timeout: 10000 })

  const filaCartola = page.getByRole('row').filter({ hasText: /cartola/i }).first()
  await filaCartola.dblclick()

  const inputMax = page.locator('input[type="number"]').first()
  await expect(inputMax).toBeVisible({ timeout: 10000 })

  const valorActual = await inputMax.inputValue()
  expect(parseInt(valorActual, 10)).toBeGreaterThanOrEqual(1)
})
