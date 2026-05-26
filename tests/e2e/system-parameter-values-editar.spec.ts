import { test, expect } from '@playwright/test'

/**
 * Regresión: editar un parámetro PRIVADO (categoría con privado=true, ej.
 * SEGURIDAD) desde el modal de /system-parameter-values.
 *
 * El backend enmascara el valor con "••••••••••••••••" y devuelve es_privado=true.
 * Al abrir el modal de edición, el frontend debe llamar a revelarGeneral para
 * traer el valor real (SESION_DURACION_MINUTOS = "90") y permitir editarlo.
 */
test.describe.serial('System Parameter Values — editar privado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/system-parameter-values')
    await expect(page.getByText('SESION_DURACION_MINUTOS').first()).toBeVisible({ timeout: 20000 })
  })

  test('revela el valor real del parámetro privado y permite editarlo', async ({ page }) => {
    // El endpoint revelarGeneral se llama al abrir el modal
    const revelarPromise = page.waitForResponse(
      (r) => /\/parametros\/revelar\/generales\/SEGURIDAD\/SESION_DURACION_MINUTOS/.test(r.url()),
      { timeout: 15000 },
    )

    await page.getByText('SESION_DURACION_MINUTOS').first().dblclick()

    const modal = page.locator('[role="dialog"], .fixed').filter({ hasText: /Editar Parámetro/i }).first()
    await expect(modal).toBeVisible({ timeout: 5000 })

    const resp = await revelarPromise
    expect(resp.status()).toBe(200)
    expect((await resp.json()).valor).toBe('90')

    // Arranca enmascarado (type=password) con el valor real ya cargado
    const valorInput = modal.locator('input[type="password"]')
    await expect(valorInput).toHaveValue('90', { timeout: 5000 })

    // Botón ojo revela el campo (pasa a type=text)
    await modal.getByRole('button', { name: /Mostrar/i }).click()
    await expect(modal.locator('input[type="text"]').last()).toHaveValue('90')

    // Permite editar
    await modal.locator('input[type="text"]').last().fill('120')
    await expect(modal.locator('input[type="text"]').last()).toHaveValue('120')
  })
})
