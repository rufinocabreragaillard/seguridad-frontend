import { test, expect } from '@playwright/test'

const BASE = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASS = 'Test1234!'

test.describe('Procesos — borrado masivo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/processes|\/dashboard|\/chat/, { timeout: 15000 })
    await page.goto(`${BASE}/processes`)
    await page.waitForSelector('table', { timeout: 10000 })
  })

  test('muestra botón Seleccionar todos y Eliminar por fecha', async ({ page }) => {
    await expect(page.getByText('Seleccionar todos')).toBeVisible()
    await expect(page.getByText('Eliminar por fecha')).toBeVisible()
  })

  test('seleccionar todos activa botón de eliminar seleccionados', async ({ page }) => {
    const filas = page.locator('table tbody tr')
    // Esperar a que la tabla cargue datos y los checkboxes sean interactuables
    await expect(filas.first()).toBeVisible({ timeout: 10000 })
    await expect(filas.first().locator('input[type="checkbox"]')).toBeVisible({ timeout: 5000 })
    const count = await filas.count()
    if (count === 0) {
      test.skip()
      return
    }

    // El botón contiene un ícono SVG + texto, usar click por role button
    await page.getByRole('button', { name: /Seleccionar todos|Deseleccionar todos/ }).click()
    await expect(page.getByRole('button', { name: /Eliminar seleccionados/ })).toBeVisible({ timeout: 5000 })

    // Deseleccionar
    await page.getByRole('button', { name: /Deseleccionar todos/ }).click()
    await expect(page.getByRole('button', { name: /Eliminar seleccionados/ })).not.toBeVisible()
  })

  test('modal Eliminar por fecha se abre y tiene campos de fecha', async ({ page }) => {
    await page.getByText('Eliminar por fecha').click()
    await expect(page.getByText('Eliminar procesos por fecha')).toBeVisible()
    await expect(page.locator('input[type="date"]').first()).toBeVisible()

    // Cancelar sin borrar nada
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByText('Eliminar procesos por fecha')).not.toBeVisible()
  })

  test('checkbox individual selecciona una fila', async ({ page }) => {
    const filas = page.locator('table tbody tr')
    const count = await filas.count()
    if (count === 0) {
      test.skip()
      return
    }

    const checkbox = filas.first().locator('input[type="checkbox"]')
    await checkbox.click()
    await expect(page.getByText('Eliminar seleccionados (1)')).toBeVisible()

    await checkbox.click()
    await expect(page.getByText(/Eliminar seleccionados/)).not.toBeVisible()
  })
})
