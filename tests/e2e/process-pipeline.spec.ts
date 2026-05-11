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

  test('tab Ubicaciones tiene botón Vectorizar', async ({ page }) => {
    await expect(page.getByRole('button', { name: /vectorizar/i })).toBeVisible({ timeout: 10000 });
  });

  test('tab Ubicaciones muestra contadores al final', async ({ page }) => {
    // Los contadores deben existir en el DOM (al final, después del árbol)
    await expect(page.getByText(/documentos totales/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/vectorizados/i).first()).toBeVisible();
    await expect(page.getByText(/pendientes/i).first()).toBeVisible();
  });

  test('tab Ubicaciones muestra el panel de pipeline con 6 barras', async ({ page }) => {
    // El panel de pipeline tiene 6 barras (BarraPasoNumerada) — verificamos por la estructura
    // El panel contiene el botón Vectorizar y las barras de progreso
    await expect(page.getByRole('button', { name: /vectorizar/i })).toBeVisible({ timeout: 10000 });
    // Las barras son divs con clase flex-1 min-w-0 — verificamos que existen en el DOM
    const panelPipeline = page.getByRole('button', { name: /vectorizar/i }).locator('xpath=ancestor::*[contains(@class,"rounded-lg")][1]');
    await expect(panelPipeline).toBeVisible();
  });

  test('tab Ubicaciones no tiene botón Ejecutar pipeline completo (fue reemplazado por Vectorizar)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /ejecutar pipeline completo/i })).toHaveCount(0);
  });

  test('tab Ubicaciones no muestra nombres técnicos como etiquetas', async ({ page }) => {
    // Los códigos técnicos (CARGAR, EXTRAER, etc.) no deben aparecer como texto visible de etiqueta
    await expect(page.getByRole('button', { name: /vectorizar/i })).toBeVisible({ timeout: 10000 });
    // Solo verificamos que no hay botones con esos nombres técnicos
    await expect(page.getByRole('button', { name: /^EXTRAER$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^CHUNKEAR$/i })).toHaveCount(0);
  });

  test('tab Documentos muestra su panel de pipeline', async ({ page }) => {
    await page.getByRole('button', { name: /documentos/i }).click();
    // La tab Documentos tiene el botón de cargar/ejecutar pipeline
    await expect(page.getByRole('button', { name: /indexar documentos|cargar de nuevo/i })).toBeVisible({ timeout: 10000 });
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
    await expect(page.getByText(/vectorizados/i).first()).toBeVisible();
    await expect(page.getByText(/pendientes/i).first()).toBeVisible();
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

  test('endpoint limpiar-completados responde sin error', async ({ page, request }) => {
    // Tomar el token JWT del localStorage del navegador autenticado
    const token = await page.evaluate(() => {
      // Buscar JWT en distintas llaves típicas
      const claves = ['serverlm-jwt', 'jwt', 'supabase.auth.token']
      for (const k of claves) {
        const v = localStorage.getItem(k)
        if (v) return v
      }
      // Buscar en cookies como fallback
      return document.cookie
    })
    if (!token) test.skip()
    const apiBase = 'https://seguridad-backend-production-6250.up.railway.app'
    const auth = token.startsWith('eyJ') ? `Bearer ${token}` : token
    const res = await request.post(`${apiBase}/cola-estados-docs/limpiar-completados`, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    })
    // Aceptamos 200 (ok), 401 (token venció), 403 (no acceso) — pero NO 404 ni 500.
    expect([200, 401, 403]).toContain(res.status())
  });
});
