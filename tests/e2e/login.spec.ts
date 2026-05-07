import { test, expect } from '@playwright/test';

test('login con credenciales válidas', async ({ page }) => {
  await page.goto('/');

  // Llenar formulario de login
  await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
  await page.getByLabel(/password|contraseña/i).fill('Test1234!');
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();

  // Verificar que accedió al dashboard
  await expect(page).not.toHaveURL(/login/i, { timeout: 10000 });
});

test('login con credenciales inválidas muestra error', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel(/email|correo/i).fill('invalido@test.com');
  await page.getByLabel(/password|contraseña/i).fill('wrongpassword');
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();

  // Debe seguir en la página de login
  await expect(page).toHaveURL(/login/i, { timeout: 5000 });
});
