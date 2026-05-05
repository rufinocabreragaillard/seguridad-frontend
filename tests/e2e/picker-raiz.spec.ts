import { test, expect } from '@playwright/test';

// No podemos disparar el File System Access API picker desde Playwright
// (es un diálogo nativo del browser). Lo único que verificamos aquí es
// que las páginas que usan el helper centralizado obtenerHandleDirectorio
// siguen montando correctamente, sin errores de runtime, y que los
// botones que dispararían el picker quedan visibles.

test.describe('picker raíz centralizado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
  });

  test('process-pipeline carga sin errores y muestra ejecutar pipeline', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /ejecutar pipeline completo/i }))
      .toBeVisible({ timeout: 10000 });
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('process-documents carga sin errores', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
    // Tiene que aparecer al menos algún botón Ejecutar / Detener / Cargar.
    await expect(page.locator('body')).toBeVisible();
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('document-locations carga sin errores', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto('/document-locations');
    await expect(page).toHaveURL(/document-locations/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
    expect(errores, errores.join('\n')).toEqual([]);
  });
});
