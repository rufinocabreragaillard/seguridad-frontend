import { test, expect } from '@playwright/test';

test.describe('process-documents (estilo B · narrativo)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
  });

  test('tab Paso a Paso NO muestra el bloque "Antes de empezar"', async ({ page }) => {
    // El header "Antes de empezar" debe haber desaparecido por completo en esta vista.
    await expect(page.getByText(/^Antes de empezar$/i)).toHaveCount(0, { timeout: 10000 });
  });

  test('tab Paso a Paso muestra sólo la primera tarjeta de fase (CARGANDO)', async ({ page }) => {
    // La primera tarjeta sigue visible
    await expect(page.getByText(/CARGANDO/).first()).toBeVisible({ timeout: 10000 });
    // El resto de fases narrativas y "LISTOS" no deben aparecer aquí (sólo se conserva la primera).
    await expect(page.getByText(/^LISTOS$/)).toHaveCount(0);
  });

  test('Ubicación queda dentro de la tarjeta Configuración (debajo de Proceso)', async ({ page }) => {
    // Etiqueta de Ubicación visible junto a la de Proceso
    await expect(page.getByText(/^Ubicación:?$/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^Proceso:?$/i).first()).toBeVisible();
  });

  test('tab Paso a Paso NO muestra barra de progreso ni pill "N listos"', async ({ page }) => {
    // Ya no debe existir el resumen "X de Y listos · N% completado"
    await expect(page.getByText(/\d+\s+de\s+\d+\s+listos/i)).toHaveCount(0, { timeout: 10000 });
  });

  test('mantiene tab Vectorizar todo y tab Revertir disponibles', async ({ page }) => {
    await expect(page.getByRole('button', { name: /vectorizar todo/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^revertir$/i })).toBeVisible();
  });
});
