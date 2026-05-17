import { test, expect } from '@playwright/test';

/**
 * Pestaña "Paso a Paso" en /process-documents.
 *
 * Tras el cambio: el bloque grande con la tarjeta narrativa única ("CARGANDO N")
 * fue reemplazado por el mismo panel "Estado del pipeline" que usa "Vectorizar todo":
 * barra de progreso global ARRIBA + estadísticas por estado ABAJO (inválidos al final).
 */
test.describe('process-documents · Paso a Paso · panel Estado del pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
  });

  test('NO muestra el bloque "Antes de empezar"', async ({ page }) => {
    await expect(page.getByText(/^Antes de empezar$/i)).toHaveCount(0, { timeout: 10000 });
  });

  test('NO muestra la tarjeta narrativa "CARGANDO" (número grande)', async ({ page }) => {
    // La etiqueta "CARGANDO" (en mayúsculas, sin más texto) era de la tarjeta narrativa.
    // Tras el cambio el panel usa "CARGADO" (estado), no "CARGANDO".
    await expect(page.getByText(/^CARGANDO$/)).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(/^LISTOS$/)).toHaveCount(0);
  });

  test('muestra panel "Estado del pipeline" con barra global y grid de estados', async ({ page }) => {
    await expect(page.getByText(/estado del pipeline/i).first()).toBeVisible({ timeout: 10000 });
    // Barra global: texto "N de N listos · X% completado"
    await expect(page.getByText(/\d+\s+de\s+\d+\s+listos\s+·\s+\d+%\s+completado/i).first()).toBeVisible();
    // Grid de estados (CARGADO ... VECTORIZADO ... y los inválidos al final)
    await expect(page.getByText(/^CARGADO$/i).first()).toBeVisible();
    await expect(page.getByText(/^VECTORIZADO$/i).first()).toBeVisible();
  });

  test('mantiene tabs "Vectorizar todo" y "Revertir" disponibles', async ({ page }) => {
    await expect(page.getByRole('button', { name: /vectorizar todo/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^revertir$/i })).toBeVisible();
  });
});
