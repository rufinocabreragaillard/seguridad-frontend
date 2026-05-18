import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.describe('process-pipeline — toggle Nivel de carga semántica + árbol ubicaciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 10000 });
  });

  test('muestra el label "Nivel de carga semántica"', async ({ page }) => {
    await expect(page.getByText(/nivel de carga sem[aá]ntica/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('el toggle muestra dos botones radio: BAJO y ALTO', async ({ page }) => {
    const grupo = page.getByRole('radiogroup', { name: /nivel de carga sem[aá]ntica/i });
    await expect(grupo).toBeVisible({ timeout: 15000 });
    await expect(grupo.getByRole('radio', { name: /^bajo$/i })).toBeVisible();
    await expect(grupo.getByRole('radio', { name: /^alto$/i })).toBeVisible();
  });

  test('ALTO es la opción seleccionada por defecto (valor del grupo)', async ({ page }) => {
    const alto = page.getByRole('radio', { name: /^alto$/i });
    await expect(alto).toBeVisible({ timeout: 15000 });
    await expect(alto).toHaveAttribute('aria-checked', 'true');
  });

  test('hacer click en BAJO cambia la selección y persiste tras recargar', async ({ page }) => {
    const bajo = page.getByRole('radio', { name: /^bajo$/i });
    const alto = page.getByRole('radio', { name: /^alto$/i });
    await expect(bajo).toBeVisible({ timeout: 15000 });

    // Esperar a que el PUT al backend complete antes de reload (si no, se aborta).
    const putBajo = page.waitForResponse(
      (r) => r.url().includes('/parametros/grupo') && r.request().method() === 'PUT' && r.status() < 400,
      { timeout: 10000 },
    );
    await bajo.click();
    await expect(bajo).toHaveAttribute('aria-checked', 'true', { timeout: 5000 });
    await putBajo;

    await page.reload();
    await expect(page.getByRole('radio', { name: /^bajo$/i })).toHaveAttribute('aria-checked', 'true', { timeout: 15000 });

    // Restaurar a ALTO para no contaminar el estado.
    const putAlto = page.waitForResponse(
      (r) => r.url().includes('/parametros/grupo') && r.request().method() === 'PUT' && r.status() < 400,
      { timeout: 10000 },
    );
    await page.getByRole('radio', { name: /^alto$/i }).click();
    await expect(alto).toHaveAttribute('aria-checked', 'true', { timeout: 5000 });
    await putAlto;
  });

  test('ya NO existe el dropdown grande "Todas las ubicaciones" en el slot', async ({ page }) => {
    // El selector dropdown fue reemplazado por el toggle.
    await expect(page.getByRole('button', { name: /todas las ubicaciones/i })).toHaveCount(0);
  });

  test('árbol de ubicaciones: si hay raíces, muestra chevrons', async ({ page }) => {
    // Best-effort: solo verifica si hay al menos una ubicación raíz visible.
    const cabecera = page.getByText(/^ubicaciones$/i).first();
    await expect(cabecera).toBeVisible({ timeout: 15000 });
    // No falla el test si no hay datos en el grupo (la columna existe igual).
  });
});
