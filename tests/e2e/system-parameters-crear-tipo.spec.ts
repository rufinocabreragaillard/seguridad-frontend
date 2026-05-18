import { test, expect } from '@playwright/test'

/**
 * Regresión: al crear un Tipo de Parámetro desde el modal de /system-parameters
 * NO debe fallar con
 *   null value in column "python_editado_manual" of relation "tipos_parametro"
 *
 * El modal debe mandar python_editado_manual=true (edición manual) y el backend
 * debe usar exclude_none al hacer el INSERT.
 */
test.describe.serial('System Parameters — crear Tipo', () => {
  const SUFIJO = Date.now().toString(36).toUpperCase()
  const TIPO_TEST = `TEST_CALIDAD_${SUFIJO}`
  const CATEGORIA = 'PROCESAMIENTO DE DOCUMENTOS'

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/system-parameters')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 })
  })

  test('crea un Tipo nuevo desde el modal sin error de NOT NULL', async ({ page }) => {
    // Ir al tab "Tipos"
    const tabTipos = page.getByRole('button', { name: /^Tipos$/ }).first()
    if (await tabTipos.isVisible().catch(() => false)) {
      await tabTipos.click()
    }

    // Abrir el modal "Nuevo tipo de parámetro"
    const botonNuevo = page.getByRole('button', { name: /nuevo tipo|nuevo|\+ nuevo/i }).first()
    await botonNuevo.click()

    // Esperar el modal
    await expect(page.getByText(/Nuevo tipo de parámetro/i)).toBeVisible({ timeout: 5000 })

    // Seleccionar categoría
    const selectCat = page.locator('select').first()
    await selectCat.selectOption({ label: new RegExp(CATEGORIA, 'i') }).catch(async () => {
      // fallback: tomar la primera opción no vacía
      const opciones = await selectCat.locator('option').allInnerTexts()
      const primera = opciones.find((o) => o.trim().length > 0)
      if (primera) await selectCat.selectOption({ label: primera })
    })

    // Código y Nombre
    const inputs = page.locator('input[type="text"], input:not([type])')
    await inputs.nth(0).fill(TIPO_TEST)
    await inputs.nth(1).fill(`Test ${SUFIJO}`)

    // Descripción
    const textareas = page.locator('textarea')
    await textareas.first().fill('Test de regresión — bug python_editado_manual NULL').catch(() => {})

    // Capturar diálogos de error
    const errores: string[] = []
    page.on('dialog', async (d) => {
      errores.push(d.message())
      await d.dismiss().catch(() => {})
    })

    // Click "Crear y Salir"
    const botonCrear = page.getByRole('button', { name: /^Crear y Salir$/i })
    await botonCrear.click()

    // Esperar a que cierre el modal o aparezca un error
    await page.waitForTimeout(3000)

    // El mensaje de error específico NO debe estar visible
    const errorPython = page.getByText(/python_editado_manual/i)
    await expect(errorPython).toHaveCount(0)

    // Tampoco debe haber error de NOT NULL constraint
    const errorNotNull = page.getByText(/not-null constraint|violates not-null/i)
    await expect(errorNotNull).toHaveCount(0)

    // El modal debió cerrarse
    await expect(page.getByText(/Nuevo tipo de parámetro/i)).toHaveCount(0, { timeout: 5000 })

    // Limpieza: eliminar el tipo creado para que el test sea idempotente
    // Buscar la fila por código y eliminarla
    const filaCreada = page.locator('code', { hasText: TIPO_TEST }).first()
    if (await filaCreada.isVisible().catch(() => false)) {
      const fila = filaCreada.locator('xpath=ancestor::tr')
      const botonEliminar = fila.getByRole('button').last()
      await botonEliminar.click().catch(() => {})
      // Confirmar
      await page.getByRole('button', { name: /confirmar|sí|aceptar|eliminar/i }).first().click().catch(() => {})
    }
  })
})
