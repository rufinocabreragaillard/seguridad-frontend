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

  test('muestra las features cualitativas de los planes (iguales al sitio)', async ({ page }) => {
    await expect(page.locator('text=Planes disponibles').first()).toBeVisible({ timeout: 15000 })
    // Features copiadas del sitio comercial (planes.mjs). Verifica un par de
    // bullets representativos que NO son límites numéricos.
    await expect(page.locator('text=Client LM: la indexación no sale de tu red').first()).toBeVisible()
    await expect(page.locator('text=Control de acceso por área o perfil').first()).toBeVisible()
  })

  test('resalta Business como plan recomendado (espejo del sitio comercial)', async ({ page }) => {
    await expect(page.locator('text=Planes disponibles').first()).toBeVisible({ timeout: 15000 })
    // El badge "Recomendado" aparece (en la tarjeta destacada = Business).
    await expect(page.locator('text=Recomendado').first()).toBeVisible({ timeout: 15000 })
  })

  test('muestra la tarjeta Corporate "A medida" con botón Contactarnos', async ({ page }) => {
    await expect(page.locator('text=Planes disponibles').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Corporate').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=A medida').first()).toBeVisible()
    // Botón de contacto (abre mailto vía window.open), no un botón "Contratar".
    const contacto = page.getByRole('button', { name: /contactarnos/i }).first()
    await expect(contacto).toBeVisible()
  })

  test('como admin, muestra el botón Contratar (no el aviso de solo-admin)', async ({ page }) => {
    await expect(page.locator('text=Planes disponibles').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /contratar/i }).first()).toBeVisible()
    await expect(page.locator('text=Solo el administrador del grupo')).toHaveCount(0)
  })

  test('Paddle.js se carga e inicializa (checkout listo)', async ({ page }) => {
    await expect(page.locator('text=Planes disponibles').first()).toBeVisible({ timeout: 15000 })
    // Paddle.js inyecta window.Paddle al cargar el script de cdn.paddle.com.
    await expect
      .poll(async () => page.evaluate(() => typeof (window as { Paddle?: unknown }).Paddle), {
        timeout: 20000,
      })
      .toBe('object')
  })

  test('clic en Contratar abre el overlay de Paddle (no muestra error de checkout no listo)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /contratar/i }).first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /contratar/i }).first().click()
    // El overlay de Paddle se monta como iframe de buy.paddle.com / sandbox.
    await expect(page.locator('iframe[src*="paddle.com"]').first()).toBeVisible({ timeout: 25000 })
    // No debe aparecer el toast de "checkout no está listo".
    await expect(page.locator('text=checkout no está listo')).toHaveCount(0)
  })
})
