import { test, expect } from '@playwright/test'

/**
 * Lengüeta "Paso a Paso" en /process-documents tras la reorganización:
 * - Ubicación vive en el bloque superior "Antes de empezar" (no en el config card).
 * - Configuración usa formato inline "Label: campo" (no label arriba + campo abajo).
 * - Las estadísticas (fases + barra de progreso + pill) están justo arriba de la grilla,
 *   ya no entre el "Antes de empezar" y el config card.
 * - El pill "N listos" incluye el porcentaje.
 */
test.describe('process-documents · lengüeta Paso a Paso · reorganización', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/process-documents')
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 })
  })

  test('bloque "Antes de empezar" contiene el selector de Ubicación + botón Empezar', async ({ page }) => {
    const antesDeEmpezar = page.getByText(/^Antes de empezar$/i).first()
    await expect(antesDeEmpezar).toBeVisible({ timeout: 10000 })

    // El selector de Ubicación con su label inline "Ubicación:" debe estar dentro del bloque
    const ubicacionLabel = page.getByText(/^Ubicación:$/).first()
    await expect(ubicacionLabel).toBeVisible({ timeout: 10000 })

    const botonEmpezar = page.getByRole('button', { name: /^empezar$/i }).first()
    await expect(botonEmpezar).toBeVisible()
  })

  test('configuración usa formato inline "Label:" para Proceso, Estado y Filtro libre', async ({ page }) => {
    await expect(page.getByText(/^Proceso:$/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/^Estado:$/).first()).toBeVisible()
    // Filtro libre puede traducirse — en español/Chile aparece como "Filtro libre:"
    const filtro = page.getByText(/^Filtro libre:$/i).first()
    await expect(filtro).toBeVisible()
  })

  test('pill incluye porcentaje (formato "N listos · X%")', async ({ page }) => {
    const pill = page.getByText(/\d+\s+listos\s+·\s+\d+%/i).first()
    await expect(pill).toBeVisible({ timeout: 15000 })
  })

  test('estadísticas (fases) están arriba de la grilla de documentos, no entre antes-de-empezar y config', async ({ page }) => {
    // Las fases siguen existiendo
    const carga = page.getByText(/^CARGANDO$/).first()
    await expect(carga).toBeVisible({ timeout: 10000 })

    // El bloque "Antes de empezar" debe estar por encima de las fases
    const antes = page.getByText(/^Antes de empezar$/i).first()
    await expect(antes).toBeVisible()

    // Y el config card "Proceso:" también por encima de las fases (la estadística va abajo)
    const proceso = page.getByText(/^Proceso:$/).first()
    await expect(proceso).toBeVisible()

    const antesBox = await antes.boundingBox()
    const procesoBox = await proceso.boundingBox()
    const cargaBox = await carga.boundingBox()
    expect(antesBox).not.toBeNull()
    expect(procesoBox).not.toBeNull()
    expect(cargaBox).not.toBeNull()
    // Estadísticas debajo del config (antes → proceso → carga)
    expect(antesBox!.y).toBeLessThan(procesoBox!.y)
    expect(procesoBox!.y).toBeLessThan(cargaBox!.y)
  })

  test('lengüeta "Paso a Paso" sigue activa y muestra otras tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /vectorizar todo/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /^revertir$/i })).toBeVisible()
  })
})
