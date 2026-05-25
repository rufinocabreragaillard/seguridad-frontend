import { test, expect } from '@playwright/test'

// Mi Cuenta / Suscripción (/my-account) — panel de pagos (Paddle).
// Usa super-admin: es ADMIN, ve el botón "Contratar" (solo admins) y tiene la
// función MI_CUENTA (tipo ADMINISTRADOR) en su menú.
test.describe.serial('Mi Cuenta (/my-account)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/my-account')
  })

  test('carga la página y muestra la sección de suscripción actual', async ({ page }) => {
    await expect(page.locator('text=Suscripción actual').first()).toBeVisible({ timeout: 15000 })
  })

  test('lista los planes vendibles con precio', async ({ page }) => {
    await expect(page.locator('text=Planes disponibles').first()).toBeVisible({ timeout: 15000 })
    // Al menos un plan conocido del catálogo sandbox.
    await expect(page.locator('text=Professional').first()).toBeVisible({ timeout: 15000 })
    // Precio en formato $X /mes.
    await expect(page.locator('text=/\\$\\s*7\\.99/').first()).toBeVisible()
  })

  test('como admin, muestra el botón Contratar (no el aviso de solo-admin)', async ({ page }) => {
    await expect(page.locator('text=Planes disponibles').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /contratar/i }).first()).toBeVisible()
    await expect(page.locator('text=Solo el administrador del grupo')).toHaveCount(0)
  })
})
