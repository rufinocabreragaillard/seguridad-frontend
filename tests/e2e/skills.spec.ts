import { test, expect } from '@playwright/test'

test.describe.serial('Habilidades del Sistema (/skills)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/skills')
  })

  test('carga la página y muestra la tabla con columnas correctas', async ({ page }) => {
    await expect(page.locator('text=Habilidades').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('th', { hasText: 'Código' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Nombre' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Tipo' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Aplica a' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Salida' }).first()).toBeVisible()
  })

  test('el código aparece antes del nombre en la tabla', async ({ page }) => {
    await page.waitForSelector('th', { timeout: 15000 })
    const headers = await page.locator('th').allTextContents()
    const idxCodigo = headers.findIndex((h) => h.includes('Código'))
    const idxNombre = headers.findIndex((h) => h.includes('Nombre'))
    expect(idxCodigo).toBeLessThan(idxNombre)
  })

  test('doble clic en fila abre el modal de edición', async ({ page }) => {
    await page.waitForSelector('tbody tr', { timeout: 15000 })
    const filas = page.locator('tbody tr')
    const count = await filas.count()
    if (count === 0) { test.skip() }
    await filas.first().dblclick()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[role="dialog"]')).toContainText('Editar Habilidad')
  })

  test('filtro Aplica a filtra correctamente', async ({ page }) => {
    await page.waitForSelector('tbody tr', { timeout: 15000 })
    await page.selectOption('select >> nth=0', 'DOCUMENTO')
    await page.waitForTimeout(300)
    const insignias = await page.locator('tbody').locator('text=TEXTOS').count()
    expect(insignias).toBe(0)
  })
})
