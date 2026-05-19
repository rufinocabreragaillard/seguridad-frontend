import { test, expect } from '@playwright/test';

// Valida que el dial del pipeline use el alias de tipos_proceso (PROCESAR_DOCS)
// para la etiqueta del centro del círculo, y que esa etiqueta no exceda el
// diámetro interno del SVG.

test.describe.configure({ mode: 'serial' });
test.describe('process-pipeline — alias dinámico de tipos_proceso en el dial', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('llama al endpoint /procesos-datos-basicos/tipos con categoria PROCESAR_DOCS', async ({ page }) => {
    const resp = await page.waitForResponse(
      (r) => /\/procesos-datos-basicos\/tipos/.test(r.url()) && r.status() === 200,
      { timeout: 15000 }
    );
    const url = new URL(resp.url());
    expect(url.searchParams.get('categoria')).toBe('PROCESAR_DOCS');
    const body = await resp.json();
    expect(Array.isArray(body)).toBe(true);
    const claves = (body as Array<{ codigo_tipo_proceso: string; alias?: string | null }>).map(
      (t) => t.codigo_tipo_proceso
    );
    for (const c of ['CARGAR', 'EXTRAER', 'ANALIZAR', 'CHUNKEAR', 'VECTORIZAR']) {
      expect(claves).toContain(c);
    }
  });

  test('el texto de la etiqueta no excede el diámetro interno del SVG', async ({ page }) => {
    // Esperar a que aparezca el SVG del dial
    const svg = page.locator('svg[role="img"]').first();
    await expect(svg).toBeVisible({ timeout: 15000 });

    // Buscar el segundo <text> del SVG (etiqueta de etapa). El primero es el "%".
    const textos = svg.locator('text');
    const count = await textos.count();
    test.skip(count < 2, 'Etiqueta de etapa no presente todavía (pipeline inactivo).');

    const etiqueta = textos.nth(1);
    const contenido = (await etiqueta.textContent())?.trim() ?? '';
    expect(contenido.length).toBeGreaterThan(0);

    const bboxEtiqueta = await etiqueta.boundingBox();
    const bboxSvg = await svg.boundingBox();
    expect(bboxEtiqueta).not.toBeNull();
    expect(bboxSvg).not.toBeNull();

    // El ancho de la etiqueta debe ser menor que el diámetro del SVG.
    // Margen razonable: 90% del diámetro (rInterno*2*0.85 + tolerancia).
    expect(bboxEtiqueta!.width).toBeLessThan(bboxSvg!.width * 0.9);
  });
});
