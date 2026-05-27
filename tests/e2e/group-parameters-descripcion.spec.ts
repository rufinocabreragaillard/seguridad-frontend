import { test, expect } from '@playwright/test'

/**
 * /group-parameters muestra al lado del nombre de cada parámetro un ícono de
 * ayuda (signo de interrogación). Al hacer clic se abre un modal con la
 * descripción completa del parámetro (puede ser larga), para que el usuario
 * final entienda para qué sirve cada parámetro.
 */
test.describe('Group Parameters — ícono de ayuda con descripción en modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/group-parameters')
    await page.waitForLoadState('networkidle')
  })

  test('cada fila con descripción muestra un botón de ayuda', async ({ page }) => {
    const botones = page.getByRole('button', { name: /Ver descripci[óo]n/i })
    await expect(botones.first()).toBeVisible({ timeout: 15000 })
  })

  test('al hacer clic en el ícono se abre un modal con la descripción', async ({ page }) => {
    const boton = page.getByRole('button', { name: /Ver descripci[óo]n/i }).first()
    await expect(boton).toBeVisible({ timeout: 15000 })
    await boton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // El modal incluye el código categoria/tipo del parámetro
    await expect(dialog.getByText(/\//).first()).toBeVisible()
    // Y un texto de descripción no vacío
    const cuerpo = await dialog.innerText()
    expect(cuerpo.trim().length).toBeGreaterThan(10)
  })
})
