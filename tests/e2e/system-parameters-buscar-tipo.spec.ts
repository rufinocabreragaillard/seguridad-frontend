import { test, expect } from '@playwright/test'

/**
 * Buscador de la pestaña "Tipos de Parámetro" en /system-parameters.
 *
 * Verifica que el input de búsqueda envía el parámetro `q` al endpoint
 * /datos-basicos/tipos/paginado, filtrando por código/nombre/descripción
 * sin necesidad de seleccionar una categoría.
 */
test.describe.serial('System Parameters — buscador de Tipos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
  })

  test('escribir en el buscador envía q a /tipos/paginado', async ({ page }) => {
    await page.goto('/system-parameters')
    await page.getByRole('button', { name: /Tipos de Parámetro/i }).click()

    const buscador = page.getByPlaceholder(/Buscar por código, nombre o descripción/i)
    await expect(buscador).toBeVisible({ timeout: 20000 })

    const respPromise = page.waitForResponse(
      (r) => {
        if (!r.url().includes('/datos-basicos/tipos/paginado')) return false
        return new URL(r.url()).searchParams.get('q') === 'doc'
      },
      { timeout: 20000 },
    )
    await buscador.fill('doc')

    const resp = await respPromise
    const body = await resp.json()
    expect(body).toHaveProperty('items')
    expect(Array.isArray(body.items)).toBe(true)
  })
})
