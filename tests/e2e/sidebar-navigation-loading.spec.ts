import { test, expect } from '@playwright/test';

/**
 * Reproduce el bug reportado: al navegar entre funciones del sidebar,
 * la pantalla destino se queda en "Cargando..." y solo se resuelve con F5.
 *
 * Estrategia: login → ir a una pantalla con tabla server-side (users) →
 * navegar a otra (documents) vía sidebar → verificar que la tabla carga
 * sin requerir refresh.
 */

const EMAIL = 'rufinocabreragaillard@gmail.com';
const PASSWORD = 'Test1234!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email|correo/i).fill(EMAIL);
  await page.getByLabel(/password|contraseña/i).fill(PASSWORD);
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
}

test('navegacion entre funciones no deja la tabla en Cargando', async ({ page }) => {
  test.setTimeout(90000);

  // Capturar errores y requests fallidos durante toda la sesión
  const consolaErrors: string[] = [];
  const requestsFallidos: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consolaErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    requestsFallidos.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  await login(page);

  // 1) Visitar primera pantalla y esperar que cargue
  await page.goto('/users');
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  // Confirmar que NO está en "Cargando..."
  const cargandoInicial = page.getByText(/^Cargando\.\.\.$/i);
  await expect(cargandoInicial).toHaveCount(0, { timeout: 20000 });

  // 2) Hacer click en sidebar para ir a /documents
  // El link puede aparecer como "Indices Documentos" según el menú
  const linkDocs = page.locator('aside a[href="/documents"], nav a[href="/documents"]').first();
  await expect(linkDocs).toBeVisible({ timeout: 10000 });

  // Empezar a observar el request al endpoint paginado
  const reqPromise = page.waitForRequest(
    (req) => req.url().includes('/documentos/paginado'),
    { timeout: 10000 }
  ).catch(() => null);

  await linkDocs.click();
  await expect(page).toHaveURL(/\/documents$/, { timeout: 10000 });

  const req = await reqPromise;
  console.log('Request a /documentos/paginado disparado:', !!req);

  // 3) Verificar que la tabla NO se queda en "Cargando..." indefinidamente
  // Damos 15s para que el fetch termine. Si sigue diciendo "Cargando..." es bug.
  await page.waitForTimeout(15000);
  const cargandoDespues = page.getByText(/^Cargando\.\.\.$/i);
  const cantidadCargando = await cargandoDespues.count();

  console.log('Texto "Cargando..." aún visible después de 15s:', cantidadCargando);
  console.log('Errores de consola:', consolaErrors);
  console.log('Requests fallidos:', requestsFallidos);

  // Tomar screenshot del estado final
  await page.screenshot({ path: 'test-results/sidebar-nav-final.png', fullPage: true });

  expect(cantidadCargando).toBe(0);
});

test('navegacion repetida entre 3 funciones no rompe la carga', async ({ page }) => {
  test.setTimeout(120000);

  await login(page);

  // Rutas accesibles para Superadministrador con tablas server-side
  const rutas = ['/users', '/documents', '/llm-costs', '/system-parameter-values', '/messaging', '/document-states-queue'];

  for (let i = 0; i < 3; i++) {
    for (const ruta of rutas) {
      const link = page.locator(`aside a[href="${ruta}"], nav a[href="${ruta}"]`).first();
      const visible = await link.isVisible().catch(() => false);
      if (!visible) {
        console.log(`Saltando ${ruta} - no visible en sidebar`);
        continue;
      }
      await link.click();
      await expect(page).toHaveURL(new RegExp(ruta.replace(/\//g, '\\/') + '$'), { timeout: 10000 });
      // Esperar hasta 10s a que NO siga "Cargando..."
      const cargando = page.getByText(/^Cargando\.\.\.$/i);
      try {
        await expect(cargando).toHaveCount(0, { timeout: 15000 });
        console.log(`✓ ${ruta} cargó correctamente (iter ${i + 1})`);
      } catch {
        await page.screenshot({ path: `test-results/sidebar-nav-stuck-${ruta.replace(/\//g, '_')}-iter${i}.png`, fullPage: true });
        throw new Error(`Pantalla ${ruta} se quedó en "Cargando..." en iter ${i + 1}`);
      }
    }
  }
});
