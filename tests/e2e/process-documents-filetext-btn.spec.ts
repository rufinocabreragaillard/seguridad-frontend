import { test, expect } from '@playwright/test';

test.describe('process-documents — botón FileText (📄)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
    await page.waitForTimeout(3000);
  });

  test('diagnóstico — estado real de la tabla en process-documents', async ({ page }) => {
    await page.screenshot({ path: '/tmp/pd-rufino-1.png' });

    // Ver qué tabs hay
    const tabs = page.locator('button[role="tab"], [class*="tab"] button, nav button').all();
    const allTabs = await tabs;
    for (const t of allTabs) {
      const txt = await t.textContent();
      if (txt?.trim()) console.log(`Tab: "${txt.trim()}"`);
    }

    // Ver filas
    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    console.log(`Filas: ${n}`);

    // Si hay filtro libre, aplicar búsqueda vacía
    const filtro = page.locator('input[placeholder*="Filtrar"]');
    if (await filtro.count() > 0) {
      await filtro.click();
      await filtro.press('Enter');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/pd-rufino-2.png' });
      console.log(`Filas después de Enter: ${await filas.count()}`);
    }

    // Mostrar info de primeras 3 filas y sus botones
    const n2 = await filas.count();
    for (let i = 0; i < Math.min(n2, 3); i++) {
      const txt = await filas.nth(i).textContent();
      console.log(`  Fila ${i}: ${txt?.substring(0, 100)}`);
      const btns = filas.nth(i).locator('button, a');
      const nb = await btns.count();
      for (let j = 0; j < nb; j++) {
        const title = await btns.nth(j).getAttribute('title');
        const tag = await btns.nth(j).evaluate(e => e.tagName);
        console.log(`    [${j}] ${tag} title="${title}"`);
      }
    }
  });

  test('click en botón FileText abre pestaña/ventana — NO descarga', async ({ page }) => {
    // Aplicar filtro vacío para cargar docs
    const filtro = page.locator('input[placeholder*="Filtrar"]');
    if (await filtro.count() > 0) {
      await filtro.click();
      await filtro.press('Enter');
      await page.waitForTimeout(3000);
    }

    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    console.log(`Filas disponibles: ${n}`);
    if (n === 0) { console.log('Sin filas'); return; }

    // Buscar botón "Abrir archivo" en cualquier fila
    const btnAbrir = page.locator('button[title*="Abrir"], button[title*="abrir"]').first();
    const existe = await btnAbrir.count() > 0;
    console.log(`Botón Abrir encontrado: ${existe}`);

    if (!existe) {
      // Ver todos los títulos de botones en la página
      const allBtns = await page.locator('table button').all();
      for (const b of allBtns.slice(0, 20)) {
        const t = await b.getAttribute('title');
        if (t) console.log(`  Botón: "${t}"`);
      }
      return;
    }

    // Click — verificar que NO descarga automáticamente
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
      btnAbrir.click(),
    ]);

    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/pd-rufino-despues-click.png' });

    if (download) {
      console.log(`❌ BUG: click en FileText descargó "${download.suggestedFilename()}"`);
    } else {
      console.log('✅ Click NO descargó automáticamente');
    }

    expect(download, 'FileText NO debe descargar automáticamente').toBeNull();
  });
});
