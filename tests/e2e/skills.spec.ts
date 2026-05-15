import { test, expect } from '@playwright/test'

test.describe('Habilidades del Sistema (/skills)', () => {
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
    // Doble clic en la celda de código (1ª celda)
    await filas.first().locator('td').first().dblclick()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[role="dialog"]')).toContainText('Editar Habilidad')
  })

  test('los filtros de Aplica a y Tipo están presentes', async ({ page }) => {
    // Navegar de nuevo para asegurar página limpia (sin modal abierto)
    await page.goto('/skills')
    await page.waitForSelector('tbody tr', { timeout: 15000 })
    // Verificar que hay opciones de filtro para DOCUMENTO y LLM
    await expect(page.locator('option[value="DOCUMENTO"]').first()).toBeAttached({ timeout: 10000 })
    await expect(page.locator('option[value="LLM"]').first()).toBeAttached({ timeout: 10000 })
  })

  test('modal de edición muestra los 3 botones estándar (Guardar / Guardar y Salir / Salir) y Salir cierra', async ({ page }) => {
    await page.waitForSelector('tbody tr', { timeout: 15000 })
    const filas = page.locator('tbody tr')
    const count = await filas.count()
    if (count === 0) { test.skip() }
    await filas.first().locator('td').first().dblclick()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog).toContainText('Editar Habilidad')

    // Los 3 botones del pie deben existir y ser visibles
    await expect(dialog.getByRole('button', { name: /^Guardar$/ })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^Guardar y Salir$/ })).toBeVisible()
    const btnSalir = dialog.getByRole('button', { name: /^Salir$/ })
    await expect(btnSalir).toBeVisible()

    // NO debe aparecer "Crear" cuando se está editando
    await expect(dialog.getByRole('button', { name: /^Crear$/ })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: /^Crear y Salir$/ })).toHaveCount(0)

    // Salir debe cerrar el modal
    await btnSalir.click()
    await expect(dialog).toBeHidden({ timeout: 3000 })
  })
})
