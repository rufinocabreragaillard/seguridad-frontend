import { test, expect } from '@playwright/test'

/**
 * Mantenedor de Secretos — dos pantallas sobre la tabla secretos_grupo:
 *   /secrets        → secretos del grupo activo (admin de grupo)
 *   /secrets-system → secretos del producto (codigo_grupo NULL, super-admin)
 *
 * Se usa el super-admin (rufinocabreragaillard@gmail.com) porque tiene acceso a
 * ambas pantallas. El valor del secreto es solo-escritura: nunca se muestra.
 */

const SUPER_ADMIN = 'rufinocabreragaillard@gmail.com'
const PASSWORD = 'Test1234!'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByLabel(/email|correo/i).fill(SUPER_ADMIN)
  await page.getByLabel(/password|contraseña/i).fill(PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
}

test.describe('Secretos', () => {
  test('la pantalla /secrets carga y muestra el botón Nuevo secreto', async ({ page }) => {
    await login(page)
    await page.goto('/secrets')
    await page.waitForLoadState('networkidle')
    // No quedó atascada en login ni en error
    await expect(page).toHaveURL(/\/secrets$/)
    await expect(page.getByRole('button', { name: /nuevo secreto|new secret/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('la pantalla /secrets-system carga (secretos del producto)', async ({ page }) => {
    await login(page)
    await page.goto('/secrets-system')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/secrets-system$/)
    await expect(page.getByRole('button', { name: /nuevo secreto|new secret/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('crear y eliminar un secreto de producto (round-trip)', async ({ page }) => {
    const tipo = `E2E_TEST_${Date.now()}`
    await login(page)
    await page.goto('/secrets-system')
    await page.waitForLoadState('networkidle')

    // Abrir modal nuevo
    await page.getByRole('button', { name: /nuevo secreto|new secret/i }).click()

    // Llenar tipo (placeholder VECTOR_STORE_DSN), valor (input password) y descripción
    await page.getByPlaceholder(/VECTOR_STORE_DSN/i).fill(tipo)
    await page.locator('input[type="password"]').fill('valor-secreto-de-prueba-123')
    await page.getByPlaceholder(/para qué se usa|what this secret/i).fill('Secreto de prueba E2E')

    // Crear y salir (al crear, el botón dice "Crear y Salir")
    await page.getByRole('button', { name: /crear y salir|create and close/i }).click()

    // Aparece en la tabla
    await expect(page.getByText(tipo, { exact: false })).toBeVisible({ timeout: 10000 })

    // El valor en claro NUNCA debe aparecer en la pantalla
    await expect(page.getByText('valor-secreto-de-prueba-123')).toHaveCount(0)

    // Eliminar: botón de fila → confirmar
    const fila = page.getByRole('row').filter({ hasText: tipo })
    await fila.getByRole('button').last().click()
    await page.getByRole('button', { name: /^eliminar$|^delete$/i }).last().click()

    // Ya no aparece
    await expect(page.getByText(tipo, { exact: false })).toHaveCount(0, { timeout: 10000 })
  })
})
