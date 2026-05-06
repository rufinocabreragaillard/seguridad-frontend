import { test, expect } from '@playwright/test';

test.describe('documents — botón FileText (📄)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/documents');
    await expect(page).toHaveURL(/documents/, { timeout: 10000 });
    await page.waitForTimeout(3000);
  });

  test('diagnóstico — estado real de la tabla en /documents', async ({ page }) => {
    await page.screenshot({ path: '/tmp/docs-rufino-1.png' });

    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    console.log(`Filas en tabla: ${n}`);

    // Mostrar info de primeras 5 filas
    for (let i = 0; i < Math.min(n, 5); i++) {
      const txt = await filas.nth(i).textContent();
      console.log(`  Fila ${i}: ${txt?.substring(0, 120)}`);
      const btns = filas.nth(i).locator('button, a[role="button"]');
      const nb = await btns.count();
      for (let j = 0; j < nb; j++) {
        const title = await btns.nth(j).getAttribute('title');
        const ariaLabel = await btns.nth(j).getAttribute('aria-label');
        console.log(`    [${j}] title="${title}" aria-label="${ariaLabel}"`);
      }
    }

    await page.screenshot({ path: '/tmp/docs-rufino-2.png' });
  });

  test('click en botón FileText NO descarga — verifica comportamiento post-click', async ({ page, context }) => {
    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    console.log(`Filas disponibles: ${n}`);

    if (n === 0) {
      console.log('Sin filas — no hay documentos para este usuario/grupo');
      return;
    }

    const btnFileText = page.locator('button[title*="Abrir documento"]').first();
    const existe = await btnFileText.count() > 0;
    console.log(`Botón "Abrir documento" encontrado: ${existe}`);

    if (!existe) {
      const allBtns = await page.locator('table button').all();
      for (const b of allBtns.slice(0, 20)) {
        const t = await b.getAttribute('title');
        if (t) console.log(`  Botón: title="${t}"`);
      }
      return;
    }

    // Capturar errores de consola
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Escuchar nueva pestaña
    const [download, newPage] = await Promise.all([
      page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
      context.waitForEvent('page', { timeout: 3000 }).catch(() => null),
      btnFileText.click(),
    ]);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/docs-rufino-click.png' });

    if (download) {
      console.log(`❌ BUG: click descargó "${download.suggestedFilename()}"`);
    } else {
      console.log('✅ Click NO descargó automáticamente');
    }

    if (newPage) {
      const url = newPage.url();
      console.log(`✅ Se abrió nueva pestaña: ${url}`);
    } else {
      console.log('ℹ️  No se abrió nueva pestaña (puede haberse abierto picker nativo del OS o window bloqueada)');
    }

    if (consoleErrors.length > 0) {
      console.log(`⚠️  Errores de consola: ${consoleErrors.join(' | ')}`);
    } else {
      console.log('✅ Sin errores de consola');
    }

    expect(download, 'FileText NO debe descargar automáticamente').toBeNull();
  });
});
