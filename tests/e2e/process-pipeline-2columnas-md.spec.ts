import { test, expect } from '@playwright/test'

test.describe('process-pipeline · 2 columnas en md (≥768px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/process-pipeline')
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 })
  })

  test('tab Ubicaciones: 2 columnas en viewport md (900x800)', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    const labelAntes = page.getByText(/^Antes de empezar$/i).first()
    const dial = page.getByRole('img', { name: /progreso/i }).first()
    await expect(labelAntes).toBeVisible({ timeout: 10000 })
    await expect(dial).toBeVisible({ timeout: 10000 })
    const rectAntes = await labelAntes.boundingBox()
    const rectDial = await dial.boundingBox()
    expect(rectAntes).not.toBeNull()
    expect(rectDial).not.toBeNull()
    // El dial debe estar a la derecha del label "Antes de empezar"
    expect(rectDial!.x).toBeGreaterThan(rectAntes!.x + rectAntes!.width)
  })

  test('tab Documentos: sin envoltorio externo y 2 columnas en md', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    await page.getByRole('button', { name: /^documentos$/i }).first().click()
    const labelAntes = page.getByText(/^Antes de empezar$/i).first()
    const dial = page.getByRole('img', { name: /progreso/i }).first()
    await expect(labelAntes).toBeVisible({ timeout: 10000 })
    await expect(dial).toBeVisible({ timeout: 10000 })
    const rectAntes = await labelAntes.boundingBox()
    const rectDial = await dial.boundingBox()
    expect(rectDial!.x).toBeGreaterThan(rectAntes!.x + rectAntes!.width)
  })
})
