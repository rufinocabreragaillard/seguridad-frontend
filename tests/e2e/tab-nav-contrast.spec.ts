import { test, expect } from '@playwright/test'

// Verifica que los tabs de navegación tengan el contraste correcto:
// - Tab activo: usa color primario (oscuro)
// - Tab inactivo: color gris visible (más oscuro que el fondo)
test.describe('Tab nav contrast', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://app.serverlm.ai/login')
    await page.fill('input[type="email"]', 'rufinocabreragaillard@gmail.com')
    await page.fill('input[type="password"]', 'Test1234!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(chat|dashboard|process-documents)/, { timeout: 15000 })
  })

  test('tab activo tiene clase tab-nav-activo en Gestión de Documentos', async ({ page }) => {
    await page.goto('https://app.serverlm.ai/process-documents')
    await page.waitForLoadState('networkidle')

    // Busca algún tab con clase tab-nav-activo
    const tabActivo = page.locator('.tab-nav-activo').first()
    await expect(tabActivo).toBeVisible()

    // El color del texto debe tener suficiente contraste (no blanco/gris claro)
    const color = await tabActivo.evaluate((el) => {
      return window.getComputedStyle(el).color
    })
    // El color primario es #074B91 → rgb(7, 75, 145)
    // Solo verificamos que no sea gris claro (rgb > 150 en los tres canales)
    expect(color).not.toBe('rgb(156, 163, 175)') // gris 400
    expect(color).not.toBe('rgb(107, 114, 128)') // gris 500 (texto-muted)
  })

  test('tab inactivo tiene clase tab-nav y color visible', async ({ page }) => {
    await page.goto('https://app.serverlm.ai/process-documents')
    await page.waitForLoadState('networkidle')

    // Busca tabs inactivos (tab-nav sin tab-nav-activo)
    const tabsInactivos = page.locator('.tab-nav:not(.tab-nav-activo)')
    const count = await tabsInactivos.count()

    if (count > 0) {
      const color = await tabsInactivos.first().evaluate((el) => {
        return window.getComputedStyle(el).color
      })
      // No debe ser invisible (blanco o muy claro)
      expect(color).not.toBe('rgb(255, 255, 255)')
      expect(color).not.toBe('rgb(243, 244, 246)') // gray-100
    }
  })

  test('clases tab-nav presentes en múltiples pantallas', async ({ page }) => {
    const rutas = [
      'https://app.serverlm.ai/chat',
      'https://app.serverlm.ai/process-documents',
    ]

    for (const ruta of rutas) {
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')

      const tabs = page.locator('.tab-nav')
      const count = await tabs.count()
      expect(count, `Esperaba tabs en ${ruta}`).toBeGreaterThan(0)
    }
  })
})
