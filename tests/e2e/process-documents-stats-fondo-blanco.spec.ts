import { test, expect } from '@playwright/test';

/**
 * Valida que las "estadísticas" (tarjetas de fase del pipeline narrativo
 * y bloque unificado de Vectorizar todo) queden sobre fondo blanco
 * (#FFFFFF / bg-surface), como el resto de tarjetas del estándar de la app.
 */

test.describe('process-documents · estadísticas sobre fondo blanco', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
  });

  test('Paso a Paso: tarjeta CARGANDO tiene fondo blanco', async ({ page }) => {
    const etiqueta = page.getByText(/^CARGANDO$/).first();
    await expect(etiqueta).toBeVisible({ timeout: 15000 });

    // La tarjeta es el div padre con clase 'rounded-xl border ... bg-surface'
    const tarjeta = etiqueta.locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
    await expect(tarjeta).toBeVisible();

    const bg = await tarjeta.evaluate((el) => getComputedStyle(el).backgroundColor);
    // bg-surface = #FFFFFF → rgb(255, 255, 255)
    expect(bg).toBe('rgb(255, 255, 255)');
  });

  test('Vectorizar todo: bloque "Estado del pipeline" tiene fondo blanco', async ({ page }) => {
    await page.getByRole('button', { name: /vectorizar todo/i }).click();

    const label = page.getByText(/estado del pipeline/i).first();
    await expect(label).toBeVisible({ timeout: 15000 });

    // El contenedor está dos niveles arriba (rounded-lg border bg-surface)
    const tarjeta = label.locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
    await expect(tarjeta).toBeVisible();

    const bg = await tarjeta.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');
  });
});
