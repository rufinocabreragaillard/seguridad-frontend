import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASSWORD = 'Test1234!'

/**
 * Humo de la pantalla /applications tras relajar los genéricos de
 * TablaCrud / SortableDndContext a <T extends object> (commit c0771a1).
 *
 * La tabla de aplicaciones es drag-and-drop (SortableDndContext) y se
 * eliminaron los casts `as Record<string, unknown>`. Este test confirma
 * que la tabla sigue renderizando filas y que el modal de edición abre
 * con sus lengüetas — verificando que el cambio de tipos no rompió runtime.
 */
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email|correo/i).fill(EMAIL)
  await page.getByLabel(/password|contraseña/i).fill(PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
}

test.describe('Aplicaciones — humo tabla drag-and-drop', () => {
  test('la tabla carga filas y el modal de edición abre', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/applications`)
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    // Cabeceras de la tabla visibles (la tabla montó)
    await expect(page.getByRole('columnheader').first()).toBeVisible()

    // Hay al menos una fila de datos (no quedó en "Cargando..." ni vacía)
    const filas = page.locator('tbody tr')
    await expect(filas.first()).toBeVisible({ timeout: 15000 })
    expect(await filas.count()).toBeGreaterThan(0)

    // El botón "Editar" (ícono lápiz) de la primera fila abre el modal con su lengüeta "Datos"
    await filas.first().getByRole('button', { name: /editar/i }).click()
    await expect(page.getByRole('button', { name: /^Datos$/ })).toBeVisible({ timeout: 10000 })
  })
})
