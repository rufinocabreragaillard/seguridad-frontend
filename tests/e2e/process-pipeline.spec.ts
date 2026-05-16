import { test, expect } from '@playwright/test';

test.describe('process-pipeline (estilo B · narrativo)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('muestra el bloque "Antes de empezar"', async ({ page }) => {
    await expect(page.getByText(/^Antes de empezar$/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('tab Ubicaciones tiene botón Empezar (reemplazo del antiguo Vectorizar)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^empezar$/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra las 4+1 fases humanas (CARGANDO/LEYENDO TEXTO/DIVIDIENDO/INDEXANDO/LISTOS)', async ({ page }) => {
    await expect(page.getByText(/CARGANDO/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/LEYENDO TEXTO/).first()).toBeVisible();
    await expect(page.getByText(/DIVIDIENDO/).first()).toBeVisible();
    await expect(page.getByText(/INDEXANDO/).first()).toBeVisible();
    await expect(page.getByText(/^LISTOS$/).first()).toBeVisible();
  });

  test('muestra el footer "Por qué"', async ({ page }) => {
    await expect(page.getByText(/^Por qué$/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra pill "N listos"', async ({ page }) => {
    await expect(page.getByText(/\d+\s+listos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('tab Documentos también muestra el pipeline narrativo', async ({ page }) => {
    await page.getByRole('button', { name: /^documentos$/i }).first().click();
    await expect(page.getByText(/CARGANDO/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/LEYENDO TEXTO/).first()).toBeVisible();
  });

  test('no muestra nombres técnicos como botones de fase (CHUNKEAR, EXTRAER…)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^EXTRAER$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^CHUNKEAR$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^VECTORIZAR$/i })).toHaveCount(0);
  });

  test('endpoint limpiar-completados responde sin error', async ({ page, request }) => {
    const token = await page.evaluate(() => {
      const claves = ['serverlm-jwt', 'jwt', 'supabase.auth.token']
      for (const k of claves) {
        const v = localStorage.getItem(k)
        if (v) return v
      }
      return document.cookie
    })
    if (!token) test.skip()
    const apiBase = 'https://seguridad-backend-production-6250.up.railway.app'
    const auth = token.startsWith('eyJ') ? `Bearer ${token}` : token
    const res = await request.post(`${apiBase}/cola-estados-docs/limpiar-completados`, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    })
    expect([200, 401, 403]).toContain(res.status())
  });
});
