import { test, expect } from '@playwright/test'

/**
 * Pagineo real de servidor en /system-parameters.
 *
 * Verifica que ambas tabs (Categorías de Parámetro / Tipos de Parámetro)
 * consultan los endpoints paginados con limit=20 y que el Paginador se
 * renderiza con el selector de tamaño de página.
 */
test.describe.serial('System Parameters — pagineo de servidor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
  })

  test('Categorías llama /categorias/paginado con limit=20 y muestra el paginador', async ({ page }) => {
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/datos-basicos/categorias/paginado') && r.request().method() === 'GET',
      { timeout: 20000 },
    )
    await page.goto('/system-parameters')

    const resp = await respPromise
    const url = new URL(resp.url())
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('page')).toBe('1')

    const body = await resp.json()
    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('total')
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeLessThanOrEqual(20)

    // El paginador con su selector "N por página" debe estar visible
    await expect(page.locator('select option', { hasText: /\/\s*p[áa]gina/i }).first())
      .toHaveCount(1, { timeout: 10000 })
  })

  test('Tipos llama /tipos/paginado con limit=20', async ({ page }) => {
    await page.goto('/system-parameters')
    await expect(page.getByRole('button', { name: /Tipos de Parámetro/i })).toBeVisible({ timeout: 20000 })

    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/datos-basicos/tipos/paginado') && r.request().method() === 'GET',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /Tipos de Parámetro/i }).click()

    const resp = await respPromise
    const url = new URL(resp.url())
    expect(url.searchParams.get('limit')).toBe('20')

    const body = await resp.json()
    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('total')
    expect(body.items.length).toBeLessThanOrEqual(20)
  })

  test('cambiar tamaño de página a 50 re-consulta con limit=50', async ({ page }) => {
    await page.goto('/system-parameters')
    await expect(page.locator('select option', { hasText: /\/\s*p[áa]gina/i }).first())
      .toHaveCount(1, { timeout: 15000 })

    // El select de tamaño de página es el que contiene las opciones "N por página"
    const selectLimit = page.locator('select').filter({
      has: page.locator('option', { hasText: /\/\s*p[áa]gina/i }),
    }).first()

    const respPromise = page.waitForResponse(
      (r) => {
        if (!r.url().includes('/datos-basicos/categorias/paginado')) return false
        return new URL(r.url()).searchParams.get('limit') === '50'
      },
      { timeout: 20000 },
    )
    await selectLimit.selectOption('50')
    await respPromise
  })
})
