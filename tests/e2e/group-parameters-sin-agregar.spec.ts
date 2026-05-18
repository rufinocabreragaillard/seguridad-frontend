import { test, expect } from '@playwright/test'

/**
 * En /group-parameters NO debe existir la opción de "Agregar parámetros".
 * El tab "Valores" muestra solo los parámetros existentes (editar/eliminar/nulificar),
 * sin el bloque inferior de "Agregar nuevo".
 */
test.describe('Group Parameters — sin opción de Agregar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/group-parameters')
  })

  test('el tab Valores no muestra el bloque Agregar parámetro', async ({ page }) => {
    // Esperar carga inicial
    await page.waitForLoadState('networkidle')

    // Cambiar al tab Valores (el segundo tab)
    const tabValores = page.getByRole('button').filter({ hasText: /^Valores/i }).first()
    if (await tabValores.count()) {
      await tabValores.click()
    }

    // No debe existir título "Agregar parámetro"
    await expect(page.getByText(/Agregar par[áa]metro/i)).toHaveCount(0)

    // No debe existir botón "Agregar"
    await expect(page.getByRole('button', { name: /^Agregar$/i })).toHaveCount(0)

    // No debe haber placeholder "Selecciona categoría" en esta vista
    await expect(page.getByText(/Selecciona categor[íi]a/i)).toHaveCount(0)
  })
})
