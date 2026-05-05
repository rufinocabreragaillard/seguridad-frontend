import { test, expect } from '@playwright/test';

test.describe('process-documents', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    // Navegar a process-documents
    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
  });

  test('muestra las 4 tabs principales', async ({ page }) => {
    await expect(page.getByRole('button', { name: /paso a paso/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /indexar documentos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /indexar todo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /revertir/i })).toBeVisible();
  });

  test('tab Indexar documentos muestra barras de progreso numeradas desde Paso 1', async ({ page }) => {
    await page.getByRole('button', { name: /indexar documentos/i }).click();
    // Esperar que cargue el pipeline
    await expect(page.getByText('Paso 1').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Paso 2')).toBeVisible();
    await expect(page.getByText('Paso 3')).toBeVisible();
    await expect(page.getByText('Paso 4')).toBeVisible();
  });

  test('tab Indexar todo muestra Paso 1 con botón Iniciar y pipeline desde Paso 2', async ({ page }) => {
    await page.getByRole('button', { name: /indexar todo/i }).click();
    // Paso 1 con botón de iniciar
    await expect(page.getByText('Paso 1').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /iniciar.*indexar ubicaciones/i })).toBeVisible();
    // Los pasos del pipeline empiezan en 2
    await expect(page.getByText('Paso 2').first()).toBeVisible();
    await expect(page.getByText('Paso 5')).toBeVisible();
  });

  test('tab Indexar documentos muestra botón Seleccionar directorio', async ({ page }) => {
    await page.getByRole('button', { name: /indexar documentos/i }).click();
    await expect(page.getByRole('button', { name: /seleccionar directorio/i })).toBeVisible({ timeout: 10000 });
  });

  test('tab Revertir se carga sin errores', async ({ page }) => {
    await page.getByRole('button', { name: /revertir/i }).click();
    // El tab revertir debe mostrar algún contenido (selector de proceso o tabla)
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
  });
});
