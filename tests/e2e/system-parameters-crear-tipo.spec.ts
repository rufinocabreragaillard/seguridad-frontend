import { test, expect } from '@playwright/test'

/**
 * Regresión: al crear un Tipo de Parámetro desde el modal de /system-parameters
 * NO debe fallar con
 *   null value in column "python_editado_manual" of relation "tipos_parametro"
 *
 * El modal manda python_editado_manual=true (edición manual) y el backend
 * usa exclude_none=True al hacer el INSERT.
 */
test.describe.serial('System Parameters — crear Tipo', () => {
  const SUFIJO = Date.now().toString(36).toUpperCase()
  const TIPO_TEST = `TEST_${SUFIJO}`

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/system-parameters')
    await expect(page.getByText(/Configuración de Parámetros del Sistema/i)).toBeVisible({ timeout: 20000 })
  })

  test('crea un Tipo nuevo desde el modal sin error de NOT NULL', async ({ page }) => {
    // Cambiar al tab "Tipos de Parámetro"
    await page.getByRole('button', { name: /Tipos de Parámetro/i }).click()

    // Click "+ Nuevo tipo"
    await page.getByRole('button', { name: /Nuevo tipo/i }).click()

    // Esperar el modal
    await expect(page.getByText(/Nuevo tipo de parámetro/i)).toBeVisible({ timeout: 5000 })

    // Seleccionar categoría DOCUMENTOS (value === categoria_parametro en BD)
    // Usamos el select que tiene la opción "Selecciona categoría" como placeholder.
    const selectCat = page.locator('select').filter({ hasText: 'Selecciona categoría' }).first()
    await selectCat.selectOption('DOCUMENTOS')
    await expect(selectCat).toHaveValue('DOCUMENTOS')

    // Código y Nombre (los inputs visibles del modal de Datos)
    const modal = page.locator('[role="dialog"], .fixed').filter({ hasText: /Nuevo tipo de parámetro/i }).first()
    await modal.locator('input').nth(0).fill(TIPO_TEST)
    await modal.locator('input').nth(1).fill(`Test ${SUFIJO}`)
    await modal.locator('textarea').first().fill('Test regresión python_editado_manual NULL').catch(() => {})

    // Capturar respuestas del POST
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/datos-basicos/tipos') && r.request().method() === 'POST',
      { timeout: 15000 },
    )

    // Click "Crear y Salir"
    await page.getByRole('button', { name: /^Crear y Salir$/i }).click()

    const resp = await respPromise
    expect(resp.status(), `respuesta inesperada: ${await resp.text().catch(() => '')}`).toBe(201)
    const body = await resp.json()
    expect(body.python_editado_manual).toBe(true)
    expect(body.javascript_editado_manual).toBe(true)

    // Error específico del bug NO debe aparecer
    await expect(page.getByText(/python_editado_manual/i)).toHaveCount(0)
    await expect(page.getByText(/violates not-null/i)).toHaveCount(0)
  })

  test.afterAll(async ({ request }) => {
    // Limpieza vía API: login + DELETE
    const loginResp = await request.post('https://seguridad-backend-production-6250.up.railway.app/auth/login', {
      data: { email: 'rufinocabreragaillard@gmail.com', password: 'Test1234!' },
    })
    if (!loginResp.ok()) return
    const { access_token } = await loginResp.json()
    await request.delete(
      `https://seguridad-backend-production-6250.up.railway.app/datos-basicos/tipos/DOCUMENTOS/${TIPO_TEST}`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    ).catch(() => {})
  })
})
