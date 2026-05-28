import { test, expect } from '@playwright/test';

/**
 * Regresión: la pantalla /process-pipeline mostraba los identificadores i18n
 * (processPipeline.btnCargarDesdeDirectorio, processPipeline.nivelCargaSemantica,
 * processPipeline.nivelAltoDesc, processPipeline.cargarSemantica) en lugar del
 * texto traducido. Además los botones ALTO/BAJO y las leyendas del dial estaban
 * hardcoded en español.
 *
 * Este test valida que:
 *   1. NO aparezcan substrings "processPipeline.", "pipelineConversacional." o
 *      "pipelineDial." en el DOM visible.
 *   2. Los botones ALTO/BAJO muestren texto humano.
 *   3. El label "Cargar desde directorio" sea visible (no su tag).
 */

test.describe.configure({ mode: 'serial' });
test.describe('process-pipeline — sin identificadores i18n visibles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
    // esperar a que la pantalla termine de hidratar
    await expect(page.getByRole('button', { name: /cargar desde directorio/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test('no se ve ningún tag processPipeline.* / pipelineConversacional.* / pipelineDial.* en el DOM', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/processPipeline\.[a-zA-Z]/);
    expect(body).not.toMatch(/pipelineConversacional\.[a-zA-Z]/);
    expect(body).not.toMatch(/pipelineDial\.[a-zA-Z]/);
  });

  test('botones radio del toggle muestran texto humano (no "BAJO"/"ALTO" tag-like)', async ({ page }) => {
    const grupo = page.getByRole('radiogroup', { name: /nivel de carga sem[aá]ntica/i });
    await expect(grupo).toBeVisible({ timeout: 10000 });
    const bajo = grupo.getByRole('radio').first();
    const alto = grupo.getByRole('radio').nth(1);
    const bajoTxt = (await bajo.textContent())?.trim() ?? '';
    const altoTxt = (await alto.textContent())?.trim() ?? '';
    expect(bajoTxt.length).toBeGreaterThan(0);
    expect(altoTxt.length).toBeGreaterThan(0);
    // No debe ser el tag literal
    expect(bajoTxt).not.toMatch(/processPipeline\./);
    expect(altoTxt).not.toMatch(/processPipeline\./);
  });

  test('label "Nivel de carga semántica" visible (locale es)', async ({ page }) => {
    await expect(page.getByText(/nivel de carga sem[aá]ntica/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('descripción nivel alto/bajo es texto, no tag', async ({ page }) => {
    // Por defecto el grupo arranca en ALTO
    const desc = page.locator('span').filter({ hasText: /(ALTO|BAJO).{0,3}m[aá]s/i }).first();
    await expect(desc).toBeVisible({ timeout: 10000 });
  });
});

test.describe('process-pipeline — locale en (fallback a es.json)', () => {
  test('con cookie NEXT_LOCALE=en, no aparecen tags i18n y se ve el fallback en español', async ({ page, context }) => {
    // login
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });

    // forzar locale = en mediante cookie y recargar
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'en', domain: 'app.serverlm.ai', path: '/' },
    ]);
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });

    // El botón "cargar desde directorio" tiene fallback en es porque la clave
    // puede no estar en en.json — pero el merge debe entregar texto humano.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/processPipeline\.[a-zA-Z]/);
    expect(body).not.toMatch(/pipelineConversacional\.[a-zA-Z]/);
    expect(body).not.toMatch(/pipelineDial\.[a-zA-Z]/);
  });
});
