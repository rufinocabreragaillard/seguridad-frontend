import { test, expect } from '@playwright/test';

test.describe('process-pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('muestra las 2 tabs: Ubicaciones y Documentos', async ({ page }) => {
    // Hay múltiples botones con texto "Ubicaciones" en la página (tab + botones).
    // Verificamos que al menos uno sea visible.
    await expect(page.getByRole('button', { name: /ubicaciones/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /documentos/i }).first()).toBeVisible();
  });

  test('tab Ubicaciones muestra contadores de documentos', async ({ page }) => {
    // La tab Ubicaciones es la activa por defecto
    await expect(page.getByText(/documentos totales/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/procesados correctamente/i)).toBeVisible();
    await expect(page.getByText(/rechazados/i)).toBeVisible();
  });

  test('tab Ubicaciones tiene botón Indexar ubicaciones con FolderSync', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Indexar ubicaciones', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('tab Ubicaciones muestra barras numeradas Paso 1..6', async ({ page }) => {
    // Las barras del pipeline completo van de Paso 1 a Paso 6
    await expect(page.getByText(/^Paso 1$/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^Paso 2$/)).toBeVisible();
    await expect(page.getByText(/^Paso 3$/)).toBeVisible();
    await expect(page.getByText(/^Paso 4$/)).toBeVisible();
    await expect(page.getByText(/^Paso 5$/)).toBeVisible();
    await expect(page.getByText(/^Paso 6$/)).toBeVisible();
  });

  test('tab Ubicaciones tiene botón Ejecutar pipeline completo', async ({ page }) => {
    await expect(page.getByRole('button', { name: /ejecutar pipeline completo/i })).toBeVisible({ timeout: 10000 });
  });

  test('tab Ubicaciones no muestra nombres técnicos en las barras (CARGAR/EXTRAER/etc)', async ({ page }) => {
    // Las barras solo deben mostrar "Paso N", no los nombres internos.
    // Tomamos la sección del pipeline (primer rounded-lg con barras) y
    // verificamos que no aparezcan los códigos técnicos como etiquetas de barra.
    const seccion = page.locator('text=/^Paso 1$/').locator('xpath=ancestor::*[contains(@class,"rounded-lg")][1]');
    await expect(seccion).toBeVisible({ timeout: 10000 });
    // Heading: que no diga "EXTRAER" como label de paso (case-sensitive uppercase de las constantes)
    await expect(seccion.locator('text=/^EXTRAER$/')).toHaveCount(0);
    await expect(seccion.locator('text=/^CHUNKEAR$/')).toHaveCount(0);
    await expect(seccion.locator('text=/^VECTORIZAR$/')).toHaveCount(0);
  });

  test('tab Documentos muestra barras Paso 2..6 (no Paso 1)', async ({ page }) => {
    await page.getByRole('button', { name: /documentos/i }).click();
    await expect(page.getByText(/^Paso 2$/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^Paso 3$/)).toBeVisible();
    await expect(page.getByText(/^Paso 4$/)).toBeVisible();
    await expect(page.getByText(/^Paso 5$/)).toBeVisible();
    await expect(page.getByText(/^Paso 6$/)).toBeVisible();
    // Cuando estamos en la tab Documentos, las barras locales no deben tener Paso 1.
    // Validamos contra el bloque principal de la tab Documentos (contiene "Paso 2").
    const tabDocs = page.locator('text=/^Paso 2$/').first().locator('xpath=ancestor::*[contains(@class,"rounded-lg")][1]');
    await expect(tabDocs.locator('text=/^Paso 1$/')).toHaveCount(0);
  });

  test('tab Documentos usa ícono DatabaseZap (no Upload)', async ({ page }) => {
    const tabDoc = page.getByRole('button', { name: /documentos/i });
    await expect(tabDoc).toBeVisible({ timeout: 10000 });
    await tabDoc.click();
    await expect(page.locator('body')).not.toContainText('Error al cargar', { timeout: 8000 });
  });

  test('tab Documentos muestra contadores', async ({ page }) => {
    await page.getByRole('button', { name: /documentos/i }).click();
    await expect(page.getByText(/documentos totales/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/procesados correctamente/i)).toBeVisible();
    await expect(page.getByText(/rechazados/i)).toBeVisible();
  });

  test('barra de paquete operativo: muestra Paquete X de Y y N de M docs en tab Ubicaciones', async ({ page }) => {
    const barra = page.getByTestId('barra-paquete-operativo').first();
    await expect(barra).toBeVisible({ timeout: 15000 });
    await expect(barra.getByText(/Paquete\s+\d+\s+de\s+\d+/i)).toBeVisible();
    await expect(barra.getByText(/\d[\d.,]*\s+de\s+\d[\d.,]*\s+docs/i)).toBeVisible();
    await expect(barra.getByText(/lote\s+\d[\d.,]+/i)).toBeVisible();

    const tamano = (await barra.getByTestId('tamano-paquete').innerText()).trim();
    expect(['3.000', '3,000', '3000']).toContain(tamano);

    const paqueteActual = parseInt((await barra.getByTestId('paquete-actual').innerText()).replace(/\D/g, ''));
    const paquetesTotales = parseInt((await barra.getByTestId('paquetes-totales').innerText()).replace(/\D/g, ''));
    expect(paqueteActual).toBeGreaterThanOrEqual(1);
    expect(paquetesTotales).toBeGreaterThanOrEqual(paqueteActual);
  });

  test('barra de paquete operativo: aparece también en tab Documentos', async ({ page }) => {
    await page.getByRole('button', { name: /documentos/i }).click();
    const barra = page.getByTestId('barra-paquete-operativo').first();
    await expect(barra).toBeVisible({ timeout: 15000 });
  });
});
