import { test, expect } from '@playwright/test';

/**
 * Regresión estructural del modal "Índice de Documento" → pestaña Características:
 * tras la limpieza visual, los marcadores de orden interno ('#' y '—') ya no
 * deben renderizarse como etiquetas separadas — los campos se muestran solo
 * separados por '·'. El formato es-CL del número se aplica en el callback
 * `numericoRender` y solo se materializa al descifrar (lo cual requiere la
 * clave personal del usuario que no está disponible en el test).
 *
 * Documento de prueba: 6664 (2015-02-BCI.pdf), cartola BCI cuya categoría
 * MONTOS expone un valor_numerico_docs=5000000.
 */
test.describe('documento-detalle-modal — formato monto', () => {
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

  test('Características no muestra etiquetas "#" / "—" como marcadores de orden', async ({ page }) => {
    // Filtrar por nombre del documento
    const buscador = page.getByPlaceholder(/buscar|filtrar/i).first();
    await buscador.fill('2015-02-BCI');
    await page.waitForTimeout(1500);

    const filas = page.locator('table tbody tr');
    expect(await filas.count()).toBeGreaterThan(0);

    const fila = filas.filter({ hasText: '2015-02-BCI' }).first();
    await fila.locator('button[title="Ver detalle"]').click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Ir a pestaña Características (es un <button>, no role=tab)
    await modal.getByRole('button', { name: /^Caracter[íi]sticas/i }).click();
    await page.waitForTimeout(1500);

    // Hay características cargadas (categorías visibles como FECHAS_IMPORTANTES, MONTOS, etc.)
    await expect(modal.getByText('Montos', { exact: true }).first()).toBeVisible({ timeout: 5000 });

    // Estructural: ni '#' ni '—' deben aparecer como nodos-etiqueta de campo
    // (eran los marcadores antiguos del orden interno de los 4 valores).
    const hashLabels = await modal.locator('span', { hasText: /^#$/ }).count();
    expect(hashLabels, "no debe haber etiqueta '#' como marcador de orden").toBe(0);
    const dashLabels = await modal.locator('span', { hasText: /^—$/ }).count();
    expect(dashLabels, "no debe haber etiqueta '—' como marcador de orden").toBe(0);
  });
});
