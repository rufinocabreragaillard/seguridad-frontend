import { test, expect } from '@playwright/test'

/**
 * Pestaña "Paso a Paso" en /process-documents.
 *
 * Pedido del usuario: en lugar de un número grande arriba (tarjeta narrativa única
 * "CARGANDO N"), debe mostrarse una barra de progreso global con la estadística debajo,
 * y luego la cantidad de documentos por estado del pipeline, con los inválidos
 * (NO_ANALIZABLE, NO_ESCANEABLE) al final. Mismo formato que la pestaña "Vectorizar todo".
 */
test.describe('process-documents · Paso a Paso · panel Estado del pipeline (barra + stats)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/process-documents')
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 })
    // Asegurarse de que la pestaña "Paso a Paso" esté activa (lo está por defecto)
  })

  test('muestra el título "Estado del pipeline"', async ({ page }) => {
    await expect(page.getByText(/estado del pipeline/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('muestra una barra de progreso global con el resumen "N de N listos · X% completado"', async ({ page }) => {
    const resumen = page.getByText(/\d+\s+de\s+\d+\s+listos\s+·\s+\d+%\s+completado/i).first()
    await expect(resumen).toBeVisible({ timeout: 15000 })
  })

  test('NO muestra la tarjeta narrativa antigua con "CARGANDO" (número grande)', async ({ page }) => {
    // "CARGANDO" era la etiqueta de la tarjeta narrativa única. Tras el cambio,
    // ya no debe existir (el estado del pipeline es "CARGADO", no "CARGANDO").
    await expect(page.getByText(/^CARGANDO$/)).toHaveCount(0, { timeout: 10000 })
  })

  test('grid de estados incluye los 7 estados en el orden esperado (inválidos al final)', async ({ page }) => {
    const titulo = page.getByText(/estado del pipeline/i).first()
    await expect(titulo).toBeVisible({ timeout: 15000 })

    const estadosEsperados = ['CARGADO', 'METADATA', 'ESCANEADO', 'CHUNKEADO', 'VECTORIZADO', 'NO ANALIZABLE', 'NO ESCANEABLE']
    const posiciones: number[] = []
    for (const estado of estadosEsperados) {
      // Buscar el texto exacto (case-insensitive). Los estados del grid se muestran en mayúsculas.
      const re = new RegExp(`^${estado.replace(/ /g, '\\s*')}$`, 'i')
      const el = page.getByText(re).first()
      await expect(el).toBeVisible({ timeout: 10000 })
      const box = await el.boundingBox()
      expect(box).not.toBeNull()
      posiciones.push(box!.x + box!.y * 10000) // y domina (filas), x desempata (columnas)
    }
    // Verificar orden monotónicamente creciente (los 7 estados visualmente en orden)
    for (let i = 1; i < posiciones.length; i++) {
      expect(posiciones[i]).toBeGreaterThan(posiciones[i - 1])
    }
  })

  test('la barra de progreso aparece arriba del grid de estados', async ({ page }) => {
    const resumen = page.getByText(/\d+\s+de\s+\d+\s+listos\s+·\s+\d+%\s+completado/i).first()
    const primerEstado = page.getByText(/^CARGADO$/i).first()
    await expect(resumen).toBeVisible({ timeout: 15000 })
    await expect(primerEstado).toBeVisible()

    const boxResumen = await resumen.boundingBox()
    const boxEstado = await primerEstado.boundingBox()
    expect(boxResumen).not.toBeNull()
    expect(boxEstado).not.toBeNull()
    expect(boxEstado!.y).toBeGreaterThan(boxResumen!.y)
  })
})
