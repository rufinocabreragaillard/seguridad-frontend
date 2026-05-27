import { test, expect } from '@playwright/test';

test('chat — diagnosticar Failed to fetch', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: { url: string; method: string; failure: string | null }[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText ?? null,
    });
  });
  page.on('response', async (resp) => {
    const u = resp.url();
    if (u.includes('/chat/') || u.includes('railway.app')) {
      console.log(`[response] ${resp.status()} ${resp.request().method()} ${u}`);
    }
  });

  await page.goto('/');
  await page.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
  await page.getByLabel(/password|contraseña/i).fill('Test1234!');
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 });

  await page.goto('/chat');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  await page.waitForTimeout(2000);

  const errorVisibleAntesDeEnviar = await page.getByText(/failed to fetch/i).isVisible().catch(() => false);
  console.log(`\n[diagnostic] "Failed to fetch" visible antes de enviar: ${errorVisibleAntesDeEnviar}`);

  const input = page.getByPlaceholder(/escribe un mensaje/i);
  await input.fill('hola test diagnostico');
  await input.press('Enter');

  await page.waitForTimeout(8000);

  const errorVisibleDespuesDeEnviar = await page.getByText(/failed to fetch/i).isVisible().catch(() => false);
  console.log(`[diagnostic] "Failed to fetch" visible despues de enviar: ${errorVisibleDespuesDeEnviar}`);

  console.log(`\n[diagnostic] requestfailed count: ${failedRequests.length}`);
  for (const f of failedRequests) {
    console.log(`  - ${f.method} ${f.url} -> ${f.failure}`);
  }
  console.log(`\n[diagnostic] console errors count: ${consoleErrors.length}`);
  for (const e of consoleErrors) {
    console.log(`  - ${e}`);
  }

  await page.screenshot({ path: '/tmp/chat-failed-to-fetch.png', fullPage: true });
});
