import { test, expect } from '@playwright/test'

test.describe.serial('Limpieza de Logs (/cleanup)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/cleanup')
  })

  test('carga la página con tabla de políticas', async ({ page }) => {
    await expect(page.locator('text=Limpieza de Logs')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=auditoria')).toBeVisible({ timeout: 10000 })
  })

  test('permite editar libremente el valor N en el modal', async ({ page }) => {
    await page.waitForSelector('text=auditoria', { timeout: 10000 })
    // Abrir modal de la primera fila (botón pequeño dentro de la tabla)
    const filaAuditoria = page.locator('tr', { hasText: 'auditoria' })
    await filaAuditoria.getByRole('button', { name: /ejecutar/i }).click()

    // El modal debe abrirse con un input numérico
    const input = page.locator('input[type="number"]')
    await expect(input).toBeVisible({ timeout: 5000 })

    // Borrar el campo y tipear un número nuevo
    await input.click({ clickCount: 3 })
    await input.fill('30')
    await expect(input).toHaveValue('30')

    // También debe poder cambiarse a otro valor
    await input.fill('180')
    await expect(input).toHaveValue('180')
  })
})
