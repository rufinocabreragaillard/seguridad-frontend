import { test, expect } from '@playwright/test';

test.describe('documents — botones de acción', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/documents');
    await expect(page).toHaveURL(/\/documents/, { timeout: 10000 });
    await page.waitForTimeout(3000);
  });

  test('botón Eye (Ver detalle) abre modal — NO descarga', async ({ page }) => {
    const filas = page.locator('table tbody tr');
    expect(await filas.count()).toBeGreaterThan(0);

    const primeraFila = filas.first();
    const btnEye = primeraFila.locator('button[title="Ver detalle"]');
    expect(await btnEye.count()).toBe(1);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
      btnEye.click(),
    ]);

    expect(download, 'Eye NO debe descargar').toBeNull();

    // modal abierto
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test('botón FileText (📄) abre pestaña nueva — NO descarga automáticamente', async ({ page }) => {
    const filas = page.locator('table tbody tr');
    expect(await filas.count()).toBeGreaterThan(0);

    const primeraFila = filas.first();
    const btnFile = primeraFila.locator('button[title*="Abrir documento"]').first();
    const existe = await btnFile.count() > 0;
    if (!existe) { test.skip(); return; }

    // Verificar que NO dispara descarga automática
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
      btnFile.click(),
    ]);

    expect(download, 'El botón 📄 NO debe descargar automáticamente').toBeNull();
  });

  test('Download y Eye son elementos distintos cuando ambos existen', async ({ page }) => {
    // Buscar una fila que tenga AMBOS botones (requiere ubicacion_documento)
    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    let primeraFila = null;
    for (let i = 0; i < n; i++) {
      const f = filas.nth(i);
      if (await f.locator('button[title="Descargar"]').count() > 0 &&
          await f.locator('button[title="Ver detalle"]').count() > 0) {
        primeraFila = f;
        break;
      }
    }
    if (!primeraFila) { test.skip(); return; }

    const btnDescargar = primeraFila.locator('button[title="Descargar"]');
    const btnEye = primeraFila.locator('button[title="Ver detalle"]');
    const dH = await btnDescargar.elementHandle();
    const eH = await btnEye.elementHandle();
    const iguales = await page.evaluate(([d, e]) => d === e, [dH, eH]);
    expect(iguales).toBe(false);
  });
});
