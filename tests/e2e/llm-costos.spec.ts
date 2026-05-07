import { test, expect } from '@playwright/test'

test.describe.serial('Costos LLM (/llm-costos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/llm-costos')
  })

  test('carga la página y muestra tarjetas de resumen', async ({ page }) => {
    await expect(page.locator('text=Mes actual')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Costo total')).toBeVisible()
    await expect(page.locator('text=Key Casa / Grupo')).toBeVisible()
  })

  test('muestra la tabla de detalle con columnas Función y Habilidad', async ({ page }) => {
    await page.waitForSelector('text=Detalle de llamadas', { timeout: 15000 })
    await expect(page.locator('text=Función').first()).toBeVisible()
    await expect(page.locator('text=Habilidad').first()).toBeVisible()
  })
})
