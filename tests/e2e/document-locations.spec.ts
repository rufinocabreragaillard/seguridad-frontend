import { test, expect } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufino@rufinocabrera.cl'
const PASSWORD = 'Test1234!'

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(admin|dashboard|chat|document-locations)/, { timeout: 15000 })
})

test('document-locations: muestra CAB como raíz del árbol', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-locations`)
  await page.waitForLoadState('networkidle', { timeout: 20000 })

  const cabNode = page.locator('span.font-medium').filter({ hasText: /^cab$/ })
  await expect(cabNode).toBeVisible({ timeout: 15000 })
})

test('document-locations: botón Indexar Ubicaciones no queda colgado con spinner infinito', async ({ page }) => {
  // Mock showDirectoryPicker para simular cancelación (sin abrir el OS picker)
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).showDirectoryPicker = async () => {
      throw new DOMException('User cancelled', 'AbortError')
    }
  })

  await page.goto(`${BASE_URL}/document-locations`)
  await page.waitForLoadState('networkidle', { timeout: 20000 })

  // El botón debe estar visible y sin spinner
  const boton = page.locator('button', { hasText: /Indexar Ubicaciones desde Directorio/i })
  await expect(boton).toBeVisible({ timeout: 10000 })
  await expect(boton).not.toBeDisabled()

  // Click — el picker "cancela" inmediatamente gracias al mock
  await boton.click()

  // Esperar un momento y verificar que el spinner desaparece (botón vuelve a estado normal)
  await page.waitForTimeout(2000)
  await expect(boton).not.toBeDisabled()
  // El botón no debe tener clase animate-spin (indicador de carga)
  const spinner = boton.locator('.animate-spin')
  await expect(spinner).toHaveCount(0)
})
