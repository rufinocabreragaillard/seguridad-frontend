import { test, expect } from '@playwright/test';

test.describe('process-pipeline — columna izquierda con ubicaciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('NO muestra cabecera "Ubicaciones" en la columna izquierda', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText(/^ubicaciones$/i)).toHaveCount(0);
  });

  test('muestra botón "Cargar desde directorio" habilitado', async ({ page }) => {
    const btn = page.getByRole('button', { name: /cargar desde directorio/i }).first();
    await expect(btn).toBeVisible({ timeout: 15000 });
    await expect(btn).toBeEnabled();
  });

  test('NO muestra botón "Solo este directorio"', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: /solo este directorio/i })).toHaveCount(0);
  });

  test('layout grid usa 3 columnas (md:grid-cols-3) en desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(page.getByRole('button', { name: /cargar desde directorio/i }).first()).toBeVisible({ timeout: 15000 });
    const grid = page.locator('div.grid.md\\:grid-cols-3').first();
    await expect(grid).toBeVisible({ timeout: 10000 });
  });

  test('botón "Cargar Semántica" sigue visible (no se rompió la UI original)', async ({ page }) => {
    const btn = page.getByRole('button', { name: /cargar sem[áa]ntica/i }).first();
    await expect(btn).toBeVisible({ timeout: 15000 });
  });

  test('botón "Detener proceso" sigue visible y deshabilitado en reposo', async ({ page }) => {
    const btn = page.getByRole('button', { name: /detener proceso/i }).first();
    await expect(btn).toBeVisible({ timeout: 15000 });
    await expect(btn).toBeDisabled();
  });
});
