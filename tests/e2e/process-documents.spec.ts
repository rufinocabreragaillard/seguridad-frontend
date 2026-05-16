import { test, expect } from '@playwright/test';

test.describe('process-documents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/correo electrónico|email/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/contraseña|password/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 30000 });
    await page.goto('/process-documents');
    await expect(page.locator('body')).not.toContainText('Cargando...', { timeout: 30000 });
  });

  test('muestra las 3 tabs principales', async ({ page }) => {
    // div.border-b tiene un botón vacío (ícono) + 3 tabs de texto
    const tabs = page.locator('div.border-b button').filter({ hasText: /.+/ });
    await expect(tabs).toHaveCount(3, { timeout: 15000 });
  });

  test('tab Vectorizar muestra 6 barras horizontales con números', async ({ page }) => {
    // Segundo tab de texto (índice 1 entre los que tienen texto)
    const tabs = page.locator('div.border-b button').filter({ hasText: /.+/ });
    await tabs.nth(1).click();
    // 6 barras numeradas del 1 al 6
    for (let i = 1; i <= 6; i++) {
      await expect(page.getByText(`${i}.`).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('tab Vectorizar muestra selector de ubicación y filtros', async ({ page }) => {
    const tabs = page.locator('div.border-b button').filter({ hasText: /.+/ });
    await tabs.nth(1).click();
    // El dropdown de ubicación siempre está presente (tiene FolderOpen icon)
    await expect(page.locator('button svg').first()).toBeVisible({ timeout: 10000 });
    // Hay al menos un input numérico (paralelo o tope)
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
  });

  test('tab Revertir se carga sin errores', async ({ page }) => {
    const tabs = page.locator('div.border-b button').filter({ hasText: /.+/ });
    await tabs.nth(2).click();
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
  });

  test('tab Revertir: dropdown Proceso usa Portal (no recortado por la tarjeta)', async ({ page }) => {
    const tabs = page.locator('div.border-b button').filter({ hasText: /.+/ });
    await tabs.nth(2).click();

    // Abrir el dropdown de Proceso
    const procesoBtn = page.locator('button:has-text("— Sin valor —")').first();
    await procesoBtn.click();

    // El menú abierto está en document.body con position: fixed y z-[9999]
    const menuPortal = page.locator('body > div.fixed.z-\\[9999\\]').first();
    await expect(menuPortal).toBeVisible({ timeout: 5000 });

    // Y NO está anidado dentro del <Tarjeta> del filtro (eso era el bug — quedaba clipeado)
    const menuDentroDeTarjeta = page.locator('div.bg-surface.rounded-xl div.fixed.z-\\[9999\\]');
    await expect(menuDentroDeTarjeta).toHaveCount(0);

    // El primer ítem "— Sin valor —" del menú está visible y dentro del viewport
    const itemSinValor = menuPortal.getByRole('button', { name: /— Sin valor —/i }).first();
    await expect(itemSinValor).toBeVisible();
    const box = await itemSinValor.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.y).toBeGreaterThan(0);
      expect(box.y + box.height).toBeLessThan(viewport.height);
    }
  });
});
