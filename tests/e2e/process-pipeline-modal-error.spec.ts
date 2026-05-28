import { test, expect } from '@playwright/test';

/**
 * Verifica que /process-pipeline use el manejo estándar de errores (ModalError)
 * en lugar de window.alert() para los flujos de sincronización.
 *
 * No podemos disparar el error real desde Playwright (File System Access picker
 * requiere gesto nativo). La prueba se concentra en garantizar:
 *   1. La página carga sin errores de runtime tras introducir ModalError.
 *   2. Nunca se dispara window.alert durante el ciclo de vida.
 */
test.describe.serial('process-pipeline — manejo estándar de errores', () => {
  test('carga sin alert() ni errores de runtime', async ({ page }) => {
    let alertDisparado = false;
    page.on('dialog', async (dialog) => {
      alertDisparado = true;
      await dialog.dismiss().catch(() => undefined);
    });
    const erroresRuntime: string[] = [];
    page.on('pageerror', (err) => erroresRuntime.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const email = page.getByLabel(/email|correo/i);
    await email.waitFor({ state: 'visible', timeout: 15000 });
    await expect(email).toBeEnabled({ timeout: 10000 });
    await email.fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    const submit = page.getByRole('button', { name: /iniciar sesión|ingresar|login/i });
    await expect(submit).toBeEnabled({ timeout: 10000 });
    await submit.click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 30000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 15000 });
    // Esperar a que el sidebar admin termine de renderizar (señal de que la
    // app ya pasó el bootstrap).
    await expect(page.getByRole('link', { name: /carga sem[áa]ntica/i }).first()).toBeVisible({ timeout: 30000 });

    expect(alertDisparado).toBe(false);
    expect(erroresRuntime).toEqual([]);
  });
});
