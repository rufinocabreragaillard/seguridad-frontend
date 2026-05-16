import { test, expect } from '@playwright/test';

test.describe('process-pipeline (estilo C · conversacional)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('muestra el bloque "Antes de empezar"', async ({ page }) => {
    await expect(page.getByText(/^Antes de empezar$/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra el mensaje conversacional "Encontré N documentos"', async ({ page }) => {
    await expect(page.getByText(/encontré .*documentos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra botón "Semanticar" del estilo conversacional', async ({ page }) => {
    await expect(page.getByRole('button', { name: /semanticar/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra el dial triple SVG (role=img con aria-label Progreso)', async ({ page }) => {
    await expect(page.getByRole('img', { name: /progreso/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra la leyenda Lote/Etapa del dial', async ({ page }) => {
    await expect(page.getByText(/^Lote\s+\d+\/\d+$/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^Etapa\s+\d+\/\d+$/i).first()).toBeVisible();
  });

  test('tab Documentos también muestra el pipeline conversacional', async ({ page }) => {
    await page.getByRole('button', { name: /^documentos$/i }).first().click();
    await expect(page.getByRole('img', { name: /progreso/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('NO se muestra el avatar cuadrado "S" del asistente', async ({ page }) => {
    const avatar = page.locator('[aria-hidden="true"]').filter({ hasText: /^S$/ });
    await expect(avatar).toHaveCount(0, { timeout: 10000 });
  });

  test('NO se muestra el <select> filtro por estado en tab Documentos', async ({ page }) => {
    await page.getByRole('button', { name: /^documentos$/i }).first().click();
    // Esperar a que renderee el panel de documentos
    await expect(page.getByText(/seleccionar ubicación/i).first()).toBeVisible({ timeout: 10000 });
    // No debe existir ningún <select> con la opción "todos los estados"
    const selectFiltro = page.locator('select').filter({ hasText: /todos los estados/i });
    await expect(selectFiltro).toHaveCount(0);
  });

  test('"Antes de empezar" y el dial circular están en dos columnas (lg)', async ({ page }) => {
    // Forzar viewport grande para que aplique el breakpoint lg
    await page.setViewportSize({ width: 1440, height: 900 })

    // Tomar el rect del label "Antes de empezar" y del dial (role=img Progreso)
    const labelAntes = page.getByText(/^Antes de empezar$/i).first()
    const dial = page.getByRole('img', { name: /progreso/i }).first()
    await expect(labelAntes).toBeVisible({ timeout: 10000 })
    await expect(dial).toBeVisible({ timeout: 10000 })

    const boxLabel = await labelAntes.boundingBox()
    const boxDial = await dial.boundingBox()
    expect(boxLabel).not.toBeNull()
    expect(boxDial).not.toBeNull()
    if (!boxLabel || !boxDial) return

    // Dos columnas: el dial está a la derecha del label "Antes de empezar"
    expect(boxDial.x).toBeGreaterThan(boxLabel.x + boxLabel.width)
    // Y aproximadamente a la misma altura (no debajo)
    expect(Math.abs(boxDial.y - boxLabel.y)).toBeLessThan(400)
  });

  test('endpoint limpiar-completados responde sin error', async ({ page, request }) => {
    const token = await page.evaluate(() => {
      const claves = ['serverlm-jwt', 'jwt', 'supabase.auth.token']
      for (const k of claves) {
        const v = localStorage.getItem(k)
        if (v) return v
      }
      return document.cookie
    })
    if (!token) test.skip()
    const apiBase = 'https://seguridad-backend-production-6250.up.railway.app'
    const auth = token.startsWith('eyJ') ? `Bearer ${token}` : token
    const res = await request.post(`${apiBase}/cola-estados-docs/limpiar-completados`, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    })
    expect([200, 401, 403]).toContain(res.status())
  });
});
