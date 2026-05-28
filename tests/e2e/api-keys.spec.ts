import { test, expect } from '@playwright/test';

// Valida la pantalla "API Keys del grupo" (/api-keys) — la entrada UI al chat externo.
// La pantalla es ADMINISTRADOR (rol SEG-GRUPO o tipo ADMINISTRADOR/SISTEMA).
// El usuario rufino@rufinocabrera.cl tiene rol SEG-GRUPO en CAB LTDA, así que puede entrar.
// Flujo:
//   1. login con admin del grupo
//   2. ir a /api-keys
//   3. crear una key para uno mismo
//   4. verificar modal "API Key creada" con token visible
//   5. cerrar modal, verificar fila con prefijo + nombre
//   6. revocar
//   7. verificar desaparición

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

  // Heading visible — admin del grupo accede
  await expect(page.getByRole('heading', { name: /API Keys del grupo/i })).toBeVisible({ timeout: 15000 });

  // Abrir modal "Nueva API Key"
  await page.getByRole('button', { name: /Nueva API Key/i }).click();
  await expect(page.getByRole('heading', { name: /^Nueva API Key$/i })).toBeVisible();

  const nombre = `E2E test ${Date.now()}`;
  await page.getByPlaceholder(/Integración|Bot|ej/i).fill(nombre);
  // Default: "Yo mismo" — no hay que cambiar nada del selector
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
  await page.getByRole('dialog').getByRole('button', { name: /^Revocar$/i }).click();

  await expect(page.getByText(nombre)).toHaveCount(0, { timeout: 10000 });
});
