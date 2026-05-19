import { test, expect } from '@playwright/test'

const BASE = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASS = 'Test1234!'

test.describe('Procesos — paginación + filtros + columna fecha/hora', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/processes|\/dashboard|\/chat/, { timeout: 15000 })
    await page.goto(`${BASE}/processes`)
    await page.waitForSelector('table', { timeout: 15000 })
  })

  test('tabla tiene columna Fecha / Hora con fecha+hora visible', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Fecha / Hora' })).toBeVisible()

    const filas = page.locator('table tbody tr')
    const count = await filas.count()
    if (count === 0) {
      test.skip()
      return
    }
    // Primer fila: la celda fecha debe contener dígitos y ":" (hora)
    const fechaCelda = filas.first().locator('td').nth(7)
    const texto = (await fechaCelda.textContent()) ?? ''
    expect(texto).toMatch(/\d{2}-\d{2}-\d{4}.*\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}.*\d{2}:\d{2}/)
  })

  test('tabla muestra columna Grupo (no oculta) con nombre', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Grupo' })).toBeVisible()
  })

  test('está ordenado por fecha descendente (más reciente primero)', async ({ page }) => {
    const filas = page.locator('table tbody tr')
    const count = await filas.count()
    if (count < 2) {
      test.skip()
      return
    }
    const fecha1 = (await filas.nth(0).locator('td').nth(7).textContent()) ?? ''
    const fecha2 = (await filas.nth(1).locator('td').nth(7).textContent()) ?? ''
    // Convertir fechas chilenas dd-mm-yyyy a Date
    const parsear = (s: string) => {
      const m = s.match(/(\d{2})[-\/](\d{2})[-\/](\d{4}),?\s+(\d{2}):(\d{2})/)
      if (!m) return null
      return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`)
    }
    const d1 = parsear(fecha1)
    const d2 = parsear(fecha2)
    if (d1 && d2) {
      expect(d1.getTime()).toBeGreaterThanOrEqual(d2.getTime())
    }
  })

  test('paginador visible con botones de navegación', async ({ page }) => {
    // El paginador del Paginador.tsx usa "Página X de Y"
    await expect(page.getByText(/Página\s+\d+\s+de\s+\d+|Mostrando\s+\d+/i)).toBeVisible({ timeout: 5000 })
  })

  test('botón Filtros abre panel con filtros por columna', async ({ page }) => {
    await page.getByRole('button', { name: /Filtros/ }).click()
    await expect(page.getByText('Categoría', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Tipo', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Estado', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Grupo', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Usuario', { exact: false }).first()).toBeVisible()
  })
})
