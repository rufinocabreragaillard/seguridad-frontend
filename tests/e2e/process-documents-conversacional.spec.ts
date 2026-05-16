import { test, expect } from '@playwright/test';

test.describe('process-documents (estilo C · conversacional)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
  });

  test('tab Paso a Paso muestra el eyebrow CONVERSACIONAL', async ({ page }) => {
    await expect(page.getByText(/^CONVERSACIONAL$/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra el titular "El sistema explica lo que hace"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /el sistema explica lo que hace/i })).toBeVisible({ timeout: 10000 });
  });

  test('muestra el mensaje del asistente con "Encontré N documentos"', async ({ page }) => {
    await expect(page.getByText(/encontré .*documentos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra los botones "Sí, empezar" y "Elegir otra carpeta" / o solo "Sí, empezar"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sí, empezar/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra el footer "Por qué"', async ({ page }) => {
    await expect(page.getByText(/^Por qué$/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra el dial triple (svg con aria-label de progreso)', async ({ page }) => {
    // El svg tiene role="img" y aria-label que contiene "Progreso"
    await expect(page.getByRole('img', { name: /progreso/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra leyenda del dial: Lote / Etapa / contador', async ({ page }) => {
    await expect(page.getByText(/^Lote\s+\d+\/\d+$/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^Etapa\s+\d+\/\d+$/i).first()).toBeVisible();
  });

  test('mantiene tab Vectorizar todo y tab Revertir disponibles', async ({ page }) => {
    await expect(page.getByRole('button', { name: /vectorizar todo/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^revertir$/i })).toBeVisible();
  });
});
