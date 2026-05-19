import { test, expect } from '@playwright/test'

test.describe.serial('Costos LLM (/llm-cost)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/llm-cost')
  })

  test('carga la página y muestra tarjetas de resumen', async ({ page }) => {
    await expect(page.locator('text=Mes actual')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Costo total')).toBeVisible()
  })

  test('tabla muestra columnas Función, Habilidad y Proceso (mig 443) y NO Operación', async ({ page }) => {
    await page.waitForSelector('text=Detalle de llamadas', { timeout: 15000 })
    // Columnas presentes (3 ejes del modelo nuevo)
    await expect(page.getByRole('columnheader', { name: /Función/ })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Habilidad/ })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Proceso/ })).toBeVisible()
    // Columna eliminada
    await expect(page.getByRole('columnheader', { name: /^Operación$/ })).toHaveCount(0)
  })
})
