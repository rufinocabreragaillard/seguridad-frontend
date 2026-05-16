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

  test('tab Paso a Paso muestra "Antes de empezar"', async ({ page }) => {
    await expect(page.getByText(/^Antes de empezar$/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('tab Paso a Paso muestra las 4+1 fases humanas (CARGANDO/LEYENDO TEXTO/DIVIDIENDO/INDEXANDO/LISTOS)', async ({ page }) => {
    await expect(page.getByText(/CARGANDO/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/LEYENDO TEXTO/).first()).toBeVisible();
    await expect(page.getByText(/DIVIDIENDO/).first()).toBeVisible();
    await expect(page.getByText(/INDEXANDO/).first()).toBeVisible();
    await expect(page.getByText(/^LISTOS$/).first()).toBeVisible();
  });

  test('tab Paso a Paso tiene botón Empezar (estilo B)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^empezar$/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('tab Paso a Paso muestra pill "N listos"', async ({ page }) => {
    await expect(page.getByText(/\d+\s+listos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra el footer "Por qué"', async ({ page }) => {
    await expect(page.getByText(/^Por qué$/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('tab Vectorizar todo muestra el pipeline narrativo con sus filtros', async ({ page }) => {
    await page.getByRole('button', { name: /vectorizar todo/i }).click();
    // Verifica filtros propios del tab
    await expect(page.getByText(/filtros del pipeline/i).first()).toBeVisible({ timeout: 10000 });
    // Verifica estilo narrativo
    await expect(page.getByText(/CARGANDO/).first()).toBeVisible();
    await expect(page.getByText(/LEYENDO TEXTO/).first()).toBeVisible();
    await expect(page.getByText(/^LISTOS$/).first()).toBeVisible();
  });

  test('mantiene tab Vectorizar todo y tab Revertir disponibles', async ({ page }) => {
    await expect(page.getByRole('button', { name: /vectorizar todo/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^revertir$/i })).toBeVisible();
  });

  test('botón Empezar usa color primario (no negro hardcoded)', async ({ page }) => {
    const boton = page.getByRole('button', { name: /^empezar$/i }).first();
    await expect(boton).toBeVisible({ timeout: 10000 });
    const bgColor = await boton.evaluate(el => getComputedStyle(el).backgroundColor);
    // No debe ser negro puro ni "casi negro" (var --color-texto = #1A1E2E → rgb(26,30,46)).
    expect(bgColor).not.toMatch(/^rgb\(0, ?0, ?0\)/);
    expect(bgColor).not.toMatch(/^rgb\(26, ?30, ?46\)/);
  });
});
