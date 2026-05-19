import { test, expect } from '@playwright/test';

test.describe('process-pipeline — raíz visible y totales correctos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('cuando la raíz existe, NO se queda en "Cargando…" y se muestra la ubicación', async ({ page }) => {
    // Espera generosa para que termine la llamada al backend (ubicaciones-docs ~7s)
    await page.waitForTimeout(15000);

    // El placeholder "Cargando ubicaciones…" no debe quedar permanente cuando hay raíz
    await expect(page.getByText(/cargando ubicaciones…/i)).toHaveCount(0);
    // El placeholder antiguo "Cargando…" tampoco debe verse en la columna
    await expect(page.locator('text=/^Cargando…$/')).toHaveCount(0);

    // Verifica que aparezca la raíz RUFINOCABRERA (caso del grupo ADMIN del superadmin)
    await expect(page.getByText(/rufinocabrera/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('estadísticas debajo del dial muestran totales reales (no 0)', async ({ page }) => {
    // Espera a que carguen los conteos
    await page.waitForTimeout(15000);

    // El bloque de estadísticas combina vectorizados y no procesables
    const estadisticas = page.locator('text=/vectorizados/i').first();
    await expect(estadisticas).toBeVisible({ timeout: 5000 });

    const noProc = page.locator('text=/no procesables/i').first();
    await expect(noProc).toBeVisible({ timeout: 5000 });

    // Extrae los números de la barra de estadísticas
    const html = await page.content();
    // Busca el patrón "<numero> vectorizados" (puede tener comas/puntos)
    const matchVect = html.match(/([\d,.]+)\s*<\/span>\s*<span[^>]*>vectorizados/i);
    const matchNoProc = html.match(/([\d,.]+)\s*<\/span>\s*<span[^>]*>no procesables/i);

    // Para el grupo ADMIN del superadmin hay 894 vectorizados y 4248 NO_ESCANEABLE
    // No exigimos un valor exacto (varía en el tiempo), pero al menos uno debe ser > 0
    const valVect = matchVect ? parseInt(matchVect[1].replace(/[.,]/g, ''), 10) : 0;
    const valNoProc = matchNoProc ? parseInt(matchNoProc[1].replace(/[.,]/g, ''), 10) : 0;

    expect(valVect + valNoProc).toBeGreaterThan(0);
  });
});
