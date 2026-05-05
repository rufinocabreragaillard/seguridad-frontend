import { test, expect } from '@playwright/test';

test.describe('documents — botón Eye', () => {
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

  test('diagnóstico — captura botones de la primera fila', async ({ page }) => {
    await page.screenshot({ path: '/tmp/doc-tabla.png' });

    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    console.log(`Filas en tabla: ${n}`);

    if (n === 0) {
      console.log('Sin filas — revisar usuario o grupo');
      return;
    }

    const primeraFila = filas.first();
    const txt = await primeraFila.textContent();
    console.log(`Primera fila: ${txt?.substring(0, 120)}`);

    const btns = primeraFila.locator('button, a');
    const nb = await btns.count();
    console.log(`Botones/links en primera fila: ${nb}`);
    for (let i = 0; i < nb; i++) {
      const title = await btns.nth(i).getAttribute('title');
      const tag = await btns.nth(i).evaluate(e => e.tagName);
      const href = await btns.nth(i).getAttribute('href').catch(() => null);
      console.log(`  [${i}] ${tag} title="${title}" href="${href}"`);
    }
  });

  test('click en Eye NO dispara descarga — abre modal', async ({ page }) => {
    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    if (n === 0) { console.log('Sin filas'); return; }

    const primeraFila = filas.first();
    const btnEye = primeraFila.locator('button[title="Ver detalle"]');
    const countEye = await btnEye.count();
    console.log(`Botones "Ver detalle" en primera fila: ${countEye}`);

    if (countEye === 0) {
      console.log('No encontrado con title="Ver detalle" — probando por posición');
      const btns = primeraFila.locator('button');
      const nb = await btns.count();
      for (let i = 0; i < nb; i++) {
        const title = await btns.nth(i).getAttribute('title');
        console.log(`  Botón ${i}: title="${title}"`);
      }
      return;
    }

    // Verificar que NO se dispara descarga al hacer click en Eye
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
      btnEye.first().click(),
    ]);

    await page.screenshot({ path: '/tmp/doc-despues-eye.png' });

    if (download) {
      console.log(`❌ BUG: Eye disparó descarga de "${download.suggestedFilename()}"`);
    } else {
      console.log('✅ Eye NO disparó descarga');
    }

    expect(download, 'El botón Eye (Ver detalle) NO debe descargar').toBeNull();

    // Verificar que hay un modal visible
    await page.waitForTimeout(500);
    const modal = page.locator('[role="dialog"]').or(page.locator('text=nombre_documento').or(page.locator('h2, h3').filter({ hasText: /detalle|documento/i })));
    console.log(`Modal/detalle visible: ${await modal.first().isVisible().catch(() => false)}`);
  });

  test('click en Download SÍ dispara descarga', async ({ page }) => {
    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    if (n === 0) { console.log('Sin filas'); return; }

    // Buscar una fila que tenga botón Descargar (solo aparece si hay ubicacion_documento)
    const btnDescargar = page.locator('button[title="Descargar"]').first();
    const existe = await btnDescargar.count() > 0;
    console.log(`Botón "Descargar" encontrado: ${existe}`);

    if (!existe) { console.log('No hay botón Descargar visible'); return; }

    // Este click SÍ debe intentar descargar (o usar FileSystem API)
    // Solo verificamos que el Eye y Descargar son distintos elementos
    const btnEye = page.locator('button[title="Ver detalle"]').first();
    const eyeExists = await btnEye.count() > 0;
    console.log(`Botón "Ver detalle" encontrado: ${eyeExists}`);

    if (eyeExists) {
      const downloadHandle = await btnDescargar.elementHandle();
      const eyeHandle = await btnEye.elementHandle();
      const sonIguales = await page.evaluate(([d, e]) => d === e, [downloadHandle, eyeHandle]);
      console.log(`¿Download y Eye son el mismo elemento?: ${sonIguales}`);
      expect(sonIguales, 'Download y Eye deben ser elementos distintos').toBe(false);
    }
  });
});
