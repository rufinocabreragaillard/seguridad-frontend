import { test, expect } from '@playwright/test';

test.describe('process-documents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/correo electrónico|email/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/contraseña|password/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 30000 });
    await page.goto('/process-documents');
    // Esperar que la página cargue (desaparece el spinner de la app)
    await expect(page.locator('body')).not.toContainText('Cargando...', { timeout: 30000 });
  });

  test('muestra las 3 tabs principales (sin Indexar todo)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /indexar documentos/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /revertir/i })).toBeVisible();
    // "Indexar todo" fue eliminado
    await expect(page.getByRole('button', { name: /indexar todo/i })).not.toBeVisible();
  });

  test('tab Vectorizar muestra 6 barras horizontales', async ({ page }) => {
    await page.getByRole('button', { name: /^vectorizar$/i }).click();
    // Las 6 barras: 1.Ubicaciones 2.Cargar 3.Extraer 4.Analizar 5.Chunkear 6.Vectorizar
    await expect(page.getByText('1. Ubicaciones')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2. Cargar')).toBeVisible();
    await expect(page.getByText('3. Extraer')).toBeVisible();
    await expect(page.getByText('4. Analizar')).toBeVisible();
    await expect(page.getByText('5. Chunkear')).toBeVisible();
    await expect(page.getByText('6. Vectorizar')).toBeVisible();
  });

  test('tab Vectorizar muestra botones de acción y selector de directorio', async ({ page }) => {
    await page.getByRole('button', { name: /^vectorizar$/i }).click();
    await expect(page.getByRole('button', { name: /sincronizar ubicaciones y cargar/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /procesar.*3-6/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /seleccionar directorio/i })).toBeVisible();
  });

  test('tab Revertir se carga sin errores', async ({ page }) => {
    await page.getByRole('button', { name: /revertir/i }).click();
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
  });
});
