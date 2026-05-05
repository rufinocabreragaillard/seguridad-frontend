import { test, expect } from '@playwright/test';

test.describe('process-documents — botón ver (Eye)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });

    // Cambiar al grupo MUNIPIRQUE donde hay documentos
    await page.waitForTimeout(1500);
    const selectorGrupo = page.locator('button, [role="button"]').filter({ hasText: /Server LM|ADMIN/i }).first();
    if (await selectorGrupo.count() > 0) {
      await selectorGrupo.click();
      await page.waitForTimeout(800);
      const opcionMuni = page.locator('[role="option"], li, a').filter({ hasText: /MUNIPIRQUE/i }).first();
      if (await opcionMuni.count() > 0) {
        await opcionMuni.click();
        await page.waitForTimeout(1500);
      }
    }

    await page.goto('/process-documents');
    await expect(page).toHaveURL(/process-documents/, { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('diagnóstico — ver qué grupo y documentos carga', async ({ page }) => {
    // Aplicar búsqueda vacía para listar todos
    const filtro = page.locator('input[placeholder*="Filtrar"]');
    if (await filtro.count() > 0) {
      await filtro.click();
      await filtro.press('Enter');
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: '/tmp/pd-con-grupo.png' });

    const filas = page.locator('table tbody tr');
    const n = await filas.count();
    console.log(`Filas en tabla: ${n}`);

    for (let i = 0; i < Math.min(n, 3); i++) {
      const txt = await filas.nth(i).textContent();
      console.log(`  Fila ${i}: ${txt?.substring(0, 120)}`);
      const btns = filas.nth(i).locator('button');
      const nb = await btns.count();
      for (let j = 0; j < nb; j++) {
        const title = await btns.nth(j).getAttribute('title');
        console.log(`    Botón ${j}: title="${title}"`);
      }
    }
  });

  test('botón Eye (Ver detalle) NO dispara descarga', async ({ page }) => {
    // Aplicar búsqueda vacía para listar todos
    const filtro = page.locator('input[placeholder*="Filtrar"]');
    if (await filtro.count() > 0) {
      await filtro.click();
      await filtro.press('Enter');
      await page.waitForTimeout(3000);
    }

    // Buscar primera fila con botón "Ver detalle"
    const btnVerDetalle = page.locator('button[title="Ver detalle"]').first();
    const existe = await btnVerDetalle.count() > 0;

    if (!existe) {
      console.log('No se encontró botón "Ver detalle" — no hay documentos en este grupo');
      await page.screenshot({ path: '/tmp/pd-sin-btn-ver.png' });
      test.skip();
      return;
    }

    console.log('✅ Botón "Ver detalle" encontrado — haciendo click...');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
      btnVerDetalle.click(),
    ]);

    await page.screenshot({ path: '/tmp/pd-despues-eye.png' });

    if (download) {
      console.log(`❌ BUG CONFIRMADO: click en Eye disparó descarga de "${download.suggestedFilename()}"`);
    } else {
      console.log('✅ Click en Eye NO disparó descarga — comportamiento correcto');
    }

    expect(download, 'El botón Eye (Ver detalle) NO debe descargar nada').toBeNull();

    // Verificar que se abrió panel de detalle
    await page.waitForTimeout(800);
    const panelDetalle = page.locator('text=Ubicación').or(page.locator('text=Estado')).first();
    const visible = await panelDetalle.isVisible().catch(() => false);
    console.log(`Panel de detalle visible: ${visible}`);
  });
});
