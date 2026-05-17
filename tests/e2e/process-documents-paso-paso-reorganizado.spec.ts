import { test, expect } from '@playwright/test'

/**
 * Pestaña "Paso a Paso" en /process-documents · layout reorganizado.
 *
 * - Ubicación vive dentro del bloque Configuración (con label inline "Ubicación:").
 * - Configuración usa formato inline "Label: campo" para Proceso, Estado, Filtro libre, etc.
 * - El panel "Estado del pipeline" (barra global + stats por estado) está debajo del
 *   bloque Configuración, no entre antes-de-empezar y config.
 */
test.describe('process-documents · Paso a Paso · layout reorganizado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/process-documents')
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 })
  })

  test('configuración usa formato inline "Label:" para Proceso, Estado y Filtro libre', async ({ page }) => {
    await expect(page.getByText(/^Proceso:$/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/^Estado:$/).first()).toBeVisible()
    const filtro = page.getByText(/^Filtro libre:$/i).first()
    await expect(filtro).toBeVisible()
  })

  test('panel "Estado del pipeline" aparece debajo del config card "Proceso:"', async ({ page }) => {
    const proceso = page.getByText(/^Proceso:$/).first()
    const panel = page.getByText(/estado del pipeline/i).first()
    await expect(proceso).toBeVisible({ timeout: 10000 })
    await expect(panel).toBeVisible({ timeout: 10000 })

    const procesoBox = await proceso.boundingBox()
    const panelBox = await panel.boundingBox()
    expect(procesoBox).not.toBeNull()
    expect(panelBox).not.toBeNull()
    expect(panelBox!.y).toBeGreaterThan(procesoBox!.y)
  })

  test('pestaña "Paso a Paso" sigue activa y muestra otras tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /vectorizar todo/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /^revertir$/i })).toBeVisible()
  })
})
