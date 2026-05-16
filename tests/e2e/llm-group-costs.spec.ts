import { test, expect } from '@playwright/test'

test.describe.serial('Costos LLM del Grupo (/llm-group-costs)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/llm-group-costs')
    await page.waitForSelector('text=Detalle de llamadas', { timeout: 20000 })
  })

  test('botón "Aplicar filtros" está en la misma línea de los filtros', async ({ page }) => {
    const boton = page.getByRole('button', { name: 'Aplicar filtros' })
    const inputDesde = page.locator('input[type="date"]').first()

    await expect(boton).toBeVisible()
    await expect(inputDesde).toBeVisible()

    const bbBoton = await boton.boundingBox()
    const bbInput = await inputDesde.boundingBox()
    expect(bbBoton).not.toBeNull()
    expect(bbInput).not.toBeNull()

    // Misma fila: las cajas se traslapan verticalmente al menos en 1 px.
    const arriba = Math.max(bbBoton!.y, bbInput!.y)
    const abajo = Math.min(bbBoton!.y + bbBoton!.height, bbInput!.y + bbInput!.height)
    expect(abajo - arriba).toBeGreaterThan(0)
  })

  test('paginación real: muestra <= 20 filas y botones siguiente/anterior funcionan', async ({ page }) => {
    // Selector del Paginador: contiene "Página X de Y" o "Sin resultados".
    const paginador = page.locator('text=/Página \\d+ de \\d+|Sin resultados/').first()
    await expect(paginador).toBeVisible({ timeout: 20000 })

    const texto = (await paginador.textContent())?.trim() ?? ''
    if (texto === 'Sin resultados') {
      test.skip(true, 'No hay datos en el grupo activo para paginar')
      return
    }

    // Tabla de detalle = la que está dentro del card "Detalle de llamadas".
    const cardDetalle = page.locator('div').filter({ has: page.locator('h3', { hasText: 'Detalle de llamadas' }) }).last()
    const filas = cardDetalle.locator('table tbody tr')
    const totalFilas = await filas.count()
    expect(totalFilas).toBeGreaterThan(0)
    expect(totalFilas).toBeLessThanOrEqual(20)

    // Capturo la primera fila visible para detectar cambio de página.
    const primeraFilaP1 = (await filas.first().textContent())?.trim()

    // Página 1 confirmada por el Paginador.
    await expect(cardDetalle.locator('text=/Página 1 de \\d+/')).toBeVisible()

    // Click en "siguiente" (chevron derecho simple, no doble).
    const siguiente = cardDetalle.locator('button:has(svg.lucide-chevron-right):not(:has(svg.lucide-chevrons-right))').first()
    await expect(siguiente).toBeEnabled()
    await siguiente.click()
    await page.waitForLoadState('networkidle')

    // Página 2: cambia el indicador del Paginador y la primera fila.
    await expect(cardDetalle.locator('text=/Página 2 de \\d+/')).toBeVisible()
    const primeraFilaP2 = (await cardDetalle.locator('table tbody tr').first().textContent())?.trim()
    expect(primeraFilaP2).not.toBe(primeraFilaP1)

    // Botón anterior vuelve a la página 1.
    const anterior = cardDetalle.locator('button:has(svg.lucide-chevron-left):not(:has(svg.lucide-chevrons-left))').first()
    await expect(anterior).toBeEnabled()
    await anterior.click()
    await page.waitForLoadState('networkidle')
    await expect(cardDetalle.locator('text=/Página 1 de \\d+/')).toBeVisible()
  })
})
