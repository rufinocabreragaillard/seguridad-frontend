import { test, expect } from '@playwright/test';

// Valida el fix del bug "El servidor no está disponible / Reintentar" en loop:
// cuando un usuario tiene sesión válida en Supabase Auth pero su fila en
// `usuarios` ya no existe (ej: su grupo fue eliminado), /auth/me devuelve 403.
// El interceptor debe cerrar la sesión Supabase y redirigir a /login —no tratar
// el 403 como servidor caído— para que el usuario pueda registrarse de nuevo.

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
  await page.getByLabel(/password|contraseña/i).fill('Test1234!');
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
}

test('403 en /auth/me redirige a login y no muestra "servidor no disponible"', async ({ page }) => {
  await login(page);

  // Interceptar /auth/me y forzar un 403 "usuario no registrado", simulando que
  // la fila del usuario fue eliminada (grupo borrado) mientras la sesión sigue viva.
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Usuario no registrado en el sistema.' }),
    }),
  );

  // Recargar: el arranque vuelve a llamar /auth/me → 403 → debe ir a /login.
  await page.reload();

  await expect(page).toHaveURL(/login/i, { timeout: 20000 });
  // No debe quedar la tarjeta de error de servidor.
  await expect(page.getByText(/servidor no está disponible/i)).toHaveCount(0);
});
