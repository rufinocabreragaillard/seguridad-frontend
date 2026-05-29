import { test, expect } from '@playwright/test'

/**
 * /group-parameters quedó como una vista única de valores (estilo
 * /system-parameter-values): sin pestaña de "Categorías", sin agregar y
 * sin eliminar / quitar réplica. Solo se ven y editan inline los valores
 * del grupo, con buscador y filtro por categoría.
 */
test.describe('Group Parameters — vista única de valores, sin agregar ni eliminar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/group-parameters')
    await page.waitForLoadState('networkidle')
  })

  test('no existe la pestaña/tab de Categorías', async ({ page }) => {
    await expect(page.getByRole('button').filter({ hasText: /Categor[íi]as de Par[áa]metro/i })).toHaveCount(0)
    await expect(page.getByRole('button').filter({ hasText: /^Valores del Grupo$/i })).toHaveCount(0)
  })

  test('no muestra opción de Agregar parámetro', async ({ page }) => {
    await expect(page.getByText(/Agregar par[áa]metro/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Agregar$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Nuevo valor/i })).toHaveCount(0)
  })

  test('no muestra acciones de eliminar ni quitar réplica', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Eliminar$/i })).toHaveCount(0)
    await expect(page.locator('button[title="Eliminar"]')).toHaveCount(0)
    await expect(page.locator('button[title*="réplica" i]')).toHaveCount(0)
  })

  test('muestra buscador y filtro por categoría sobre la tabla de valores', async ({ page }) => {
    // Buscador
    await expect(page.getByPlaceholder(/Buscar/i)).toHaveCount(1)
    // Combo de categoría con opción "Todas"
    const combos = page.locator('select')
    await expect(combos.first()).toBeVisible()
    // Cabecera de la tabla con la columna Código
    await expect(page.getByRole('cell', { name: /^C[óo]digo$/i }).first()).toBeVisible()
  })
})
