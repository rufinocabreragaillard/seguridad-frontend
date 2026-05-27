import { test, expect } from '@playwright/test';

// Verifica la UI de reenvío de correo y el manejo de "email ya confirmado".
// Se interceptan las respuestas del backend para no crear usuarios reales en
// producción — el objetivo es validar el comportamiento del frontend.

async function irAModoRegistro(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /regístrate|registrate/i }).click();
  await expect(page.getByRole('heading', { name: /regístrate|registrate/i })).toBeVisible();
}

test('registro pendiente muestra botón reenviar con cooldown', async ({ page }) => {
  await page.route('**/auth/registro', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mensaje: 'Te enviamos un correo de invitación para confirmar tu cuenta.',
        ya_confirmado: false,
        email: 'nuevo@ejemplo.test',
      }),
    });
  });

  await irAModoRegistro(page);
  await page.getByLabel(/email|correo/i).fill('nuevo@ejemplo.test');
  await page.getByLabel(/nombre completo/i).fill('Usuario Prueba');
  await page.getByLabel(/empresa/i).fill('Empresa Prueba');
  await page.getByRole('button', { name: /registrarme|registrar/i }).click();

  await expect(page.getByText(/te enviamos un correo/i)).toBeVisible();
  // Botón reenviar visible; arranca con cooldown (30s)
  const reenviar = page.getByRole('button', { name: /reenviar correo/i });
  await expect(reenviar).toBeVisible();
  await expect(reenviar).toBeDisabled();
});

test('email ya confirmado muestra botón para ir al login (sin reenviar)', async ({ page }) => {
  await page.route('**/auth/registro', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mensaje: 'Tu correo ya estaba verificado. Tu cuenta quedó lista: inicia sesión directamente.',
        ya_confirmado: true,
        email: 'confirmado@ejemplo.test',
      }),
    });
  });

  await irAModoRegistro(page);
  await page.getByLabel(/email|correo/i).fill('confirmado@ejemplo.test');
  await page.getByLabel(/nombre completo/i).fill('Usuario Confirmado');
  await page.getByLabel(/empresa/i).fill('Empresa X');
  await page.getByRole('button', { name: /registrarme|registrar/i }).click();

  await expect(page.getByText(/ya estaba verificado/i)).toBeVisible();
  // No debe ofrecer reenviar; sí un botón primario para volver al login
  await expect(page.getByRole('button', { name: /reenviar correo/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /volver al login/i }).last()).toBeVisible();
});
