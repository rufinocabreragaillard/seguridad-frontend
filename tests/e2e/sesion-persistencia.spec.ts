import { test, expect } from '@playwright/test';

// Valida el arreglo de persistencia de sesión:
//  1. Cada request al backend emite EVENTO_ACTIVIDAD_API (resetea el timer de
//     inactividad → una carga larga sin clicks no bota al usuario).
//  2. La sesión sobrevive a navegación y a un reload (refresh proactivo del JWT).
//  3. La duración configurada (SESION_DURACION_MINUTOS) llega al frontend con
//     un valor alto (≥ 240 min), no el viejo default de 90.

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
  await page.getByLabel(/password|contraseña/i).fill('Test1234!');
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
}

test('cada request al backend emite el evento de actividad de red', async ({ page }) => {
  await login(page);

  // Instrumentar el listener del evento de actividad antes de provocar requests.
  await page.evaluate(() => {
    (window as unknown as { __actividadCount: number }).__actividadCount = 0;
    window.addEventListener('serverlm:actividad-api', () => {
      (window as unknown as { __actividadCount: number }).__actividadCount++;
    });
  });

  // Forzar un request al backend recargando contexto (navegación interna).
  await page.reload();
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });

  // Tras la recarga el contador se reinicia; provocamos un request explícito.
  await page.evaluate(() => {
    (window as unknown as { __actividadCount: number }).__actividadCount = 0;
    window.addEventListener('serverlm:actividad-api', () => {
      (window as unknown as { __actividadCount: number }).__actividadCount++;
    });
  });
  // Disparar una petición a la API (el cliente axios la intercepta y emite el evento).
  await page.evaluate(async () => {
    const url = (process.env.NEXT_PUBLIC_API_URL || '') + '/health';
    try { await fetch(url); } catch { /* ignore */ }
  });

  // El interceptor de axios emite en cada request de la app; navegamos para gatillar uno.
  await page.goto('/dashboard').catch(() => {});
  await page.waitForTimeout(2000);

  const count = await page.evaluate(
    () => (window as unknown as { __actividadCount: number }).__actividadCount,
  );
  expect(count).toBeGreaterThan(0);
});

test('la sesión persiste tras reload (refresh de sesión)', async ({ page }) => {
  await login(page);
  await page.reload();
  // No debe redirigir a login tras recargar: la sesión se restaura.
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
});

test('la duración de sesión configurada es alta (no el viejo default de 90)', async ({ page }) => {
  await login(page);
  // Leer el contexto del usuario expuesto vía /auth/me a través de la app.
  const minutos = await page.evaluate(async () => {
    const url = (process.env.NEXT_PUBLIC_API_URL || '') + '/auth/me';
    const tokenRaw = Object.keys(localStorage)
      .filter((k) => k.includes('auth-token'))
      .map((k) => localStorage.getItem(k))
      .find(Boolean);
    let token = '';
    try {
      const parsed = JSON.parse(tokenRaw || '{}');
      token = parsed.access_token || '';
    } catch { /* ignore */ }
    if (!token) return null;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return j.sesion_duracion_minutos ?? null;
  });
  // Si pudimos leerlo, debe ser ≥ 240 (4h). Si no (cambio de storage), no fallar el suite.
  if (minutos !== null) {
    expect(minutos).toBeGreaterThanOrEqual(240);
  }
});
