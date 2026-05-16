import { test, expect } from '@playwright/test'

/**
 * Lengüeta "Vectorizar todo" en /process-documents:
 * - Las estadísticas viven en UNA SOLA zona: la tarjeta "Estado del pipeline".
 * - Esa tarjeta tiene barra de progreso global ARRIBA y conteos por estado ABAJO.
 * - Ya no existen las tarjetas CARGANDO/LEYENDO TEXTO/DIVIDIENDO/INDEXANDO/LISTOS
 *   (que vivían en el bloque superior duplicado).
 */
test.describe('process-documents · lengüeta Vectorizar todo · estadísticas unificadas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/process-documents')
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 })
    await page.getByRole('button', { name: /vectorizar todo/i }).click()
  })

  test('zona "Estado del pipeline" existe y contiene barra de progreso + conteos por estado', async ({ page }) => {
    const titulo = page.getByText(/estado del pipeline/i).first()
    await expect(titulo).toBeVisible({ timeout: 10000 })

    // Barra de progreso global presente: el texto "listos · X% completado"
    await expect(page.getByText(/listos · \d+% completado/i).first()).toBeVisible()

    // Los conteos por estado siguen abajo (CARGADO, METADATA, ..., VECTORIZADO)
    await expect(page.getByText(/^CARGADO$/i).first()).toBeVisible()
    await expect(page.getByText(/^VECTORIZADO$/i).first()).toBeVisible()
  })

  test('NO existen las tarjetas duplicadas CARGANDO/LEYENDO TEXTO/DIVIDIENDO/INDEXANDO', async ({ page }) => {
    // Estas etiquetas vivían sólo en las tarjetas de fase del PipelineNarrativo
    // que se eliminaron. "CARGADO" (sin "ANDO") sí existe — es del grid inferior.
    await expect(page.getByText(/^CARGANDO$/)).toHaveCount(0)
    await expect(page.getByText(/^LEYENDO TEXTO$/)).toHaveCount(0)
    await expect(page.getByText(/^DIVIDIENDO$/)).toHaveCount(0)
    await expect(page.getByText(/^INDEXANDO$/)).toHaveCount(0)
  })

  test('barra de progreso está por encima del grid de estados', async ({ page }) => {
    const barraTexto = page.getByText(/listos · \d+% completado/i).first()
    const gridEstadoCargado = page.getByText(/^CARGADO$/i).first()
    await expect(barraTexto).toBeVisible({ timeout: 10000 })
    await expect(gridEstadoCargado).toBeVisible()
    const rectBarra = await barraTexto.boundingBox()
    const rectGrid = await gridEstadoCargado.boundingBox()
    expect(rectBarra).not.toBeNull()
    expect(rectGrid).not.toBeNull()
    expect(rectGrid!.y).toBeGreaterThan(rectBarra!.y)
  })
})
