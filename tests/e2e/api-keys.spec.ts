import { test, expect } from '@playwright/test';

// Valida la pantalla "Mis API Keys" (/api-keys) — la entrada UI al chat externo.
// Flujo:
//   1. login con usuario normal
//   2. ir a /api-keys
//   3. crear una key con un nombre único
//   4. verificar que aparece el modal "API Key creada" con el token visible
//   5. cerrar modal, verificar que la fila aparece en la tabla con el prefijo
//   6. revocar la key creada
//   7. verificar que ya no aparece en la lista

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
  await page.getByLabel(/password|contraseña/i).fill('Test1234!');
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
}

test('crear, ver y revocar una API Key desde /api-keys', async ({ page }) => {
  await login(page);
  await page.goto('/api-keys');

  // Heading visible
  await expect(page.getByRole('heading', { name: /Mis API Keys/i })).toBeVisible({ timeout: 15000 });

  // Abrir modal "Nueva API Key"
  await page.getByRole('button', { name: /Nueva API Key/i }).click();
  await expect(page.getByRole('heading', { name: /^Nueva API Key$/i })).toBeVisible();

  const nombre = `E2E test ${Date.now()}`;
  await page.getByPlaceholder(/Integración|Bot|ej/i).fill(nombre);
  await page.getByRole('button', { name: /^Crear$/i }).click();

  // Modal "API Key creada" muestra el token
  await expect(page.getByRole('heading', { name: /API Key creada/i })).toBeVisible({ timeout: 15000 });
  const codigoToken = page.locator('code').filter({ hasText: /slm_live_/ }).first();
  await expect(codigoToken).toBeVisible();
  const tokenTxt = (await codigoToken.textContent()) || '';
  expect(tokenTxt).toMatch(/^slm_live_[a-f0-9]+$/);
  const prefijo = tokenTxt.slice(0, 16);

  // Cerrar modal y verificar fila
  await page.getByRole('button', { name: /Entendido/i }).click();
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(prefijo, { exact: false }).first()).toBeVisible();

  // Revocar
  const fila = page.locator('tr', { hasText: nombre });
  await fila.getByRole('button', { name: /Revocar/i }).click();
  await expect(page.getByRole('heading', { name: /Revocar API Key/i })).toBeVisible();
  // El botón del modal de confirmación (no el de la fila)
  await page.getByRole('dialog').getByRole('button', { name: /^Revocar$/i }).click();

  // Tras revocar la fila ya no debe estar
  await expect(page.getByText(nombre)).toHaveCount(0, { timeout: 10000 });
});
