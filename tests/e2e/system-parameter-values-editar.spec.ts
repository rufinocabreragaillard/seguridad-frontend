import { test, expect } from '@playwright/test'

/**
 * Regresión: el modal de edición de /system-parameter-values debe mostrar el
 * valor REAL del parámetro en un input de texto editable, NO enmascarado como
 * contraseña por el autofill del navegador.
 *
 * Caso: SEGURIDAD / SESION_DURACION_MINUTOS tiene valor "90" en BD. El input
 * debe ser type=text, traer "90" y permitir edición. La causa raíz del bug era
 * la falta de autoComplete="off" (el password manager inyectaba puntos).
 */
test.describe.serial('System Parameter Values — editar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/system-parameter-values')
    await expect(page.getByText('SESION_DURACION_MINUTOS').first()).toBeVisible({ timeout: 20000 })
  })

  test('el campo Valor es texto editable y trae el valor real (no enmascarado)', async ({ page }) => {
    // Doble click en la celda del tipo para abrir el modal de edición
    await page.getByText('SESION_DURACION_MINUTOS').first().dblclick()

    const modal = page.locator('[role="dialog"], .fixed').filter({ hasText: /Editar Parámetro/i }).first()
    await expect(modal).toBeVisible({ timeout: 5000 })

    const valorInput = modal.locator('input[name="param-valor"]')
    await expect(valorInput).toBeVisible()

    // NO debe ser type=password (eso lo enmascararía)
    await expect(valorInput).not.toHaveAttribute('type', 'password')
    // Debe declarar autoComplete=off para frenar el autofill
    await expect(valorInput).toHaveAttribute('autocomplete', 'off')
    // Debe traer el valor real de BD
    await expect(valorInput).toHaveValue('90')

    // Debe permitir editar
    await valorInput.fill('120')
    await expect(valorInput).toHaveValue('120')
  })
})
