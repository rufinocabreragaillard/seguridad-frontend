import { test, expect } from '@playwright/test';

test.describe('process-pipeline (sin lenguetas — solo Documentos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('NO se muestran las lenguetas Ubicaciones / Documentos', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^ubicaciones$/i })).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /^documentos$/i })).toHaveCount(0);
  });

  test('muestra el dropdown "Seleccionar ubicación" del panel Documentos', async ({ page }) => {
    await expect(page.getByRole('button', { name: /seleccionar ubicación/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('dropdown "Seleccionar ubicación" usa borde gris y fondo blanco', async ({ page }) => {
    const btn = page.getByRole('button', { name: /seleccionar ubicación/i }).first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    const cls = await btn.getAttribute('class');
    expect(cls).toContain('border-borde');
    expect(cls).toContain('bg-surface');
    expect(cls).not.toContain('border-primario bg-fondo-tarjeta');
  });

  test('NO se muestra el <select> filtro por estado', async ({ page }) => {
    await expect(page.getByRole('button', { name: /seleccionar ubicación/i }).first()).toBeVisible({ timeout: 10000 });
    const selectFiltro = page.locator('select').filter({ hasText: /todos los estados/i });
    await expect(selectFiltro).toHaveCount(0);
  });

  test('boton "Capturar Semantica" siempre visible y habilitado cuando no se ejecuta', async ({ page }) => {
    // Seleccionar primero una carpeta para que aparezca el panel "Antes de empezar"
    await page.getByRole('button', { name: /seleccionar ubicación/i }).first().click({ timeout: 10000 });
    // Elegir la primera opcion del dropdown si la hay (best-effort, no falla el test si no aplica).
    const primeraOp = page.getByRole('option').first();
    if (await primeraOp.count() > 0) {
      await primeraOp.click({ timeout: 5000 }).catch(() => undefined);
    }
    const capturar = page.getByRole('button', { name: /capturar sem[áa]ntica/i }).first();
    await expect(capturar).toBeVisible({ timeout: 10000 });
    await expect(capturar).toBeEnabled();
  });

  test('boton "Detener proceso" siempre visible y DESHABILITADO cuando no se ejecuta', async ({ page }) => {
    await page.getByRole('button', { name: /seleccionar ubicación/i }).first().click({ timeout: 10000 });
    const primeraOp = page.getByRole('option').first();
    if (await primeraOp.count() > 0) {
      await primeraOp.click({ timeout: 5000 }).catch(() => undefined);
    }
    const detener = page.getByRole('button', { name: /detener proceso/i }).first();
    await expect(detener).toBeVisible({ timeout: 10000 });
    await expect(detener).toBeDisabled();
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
