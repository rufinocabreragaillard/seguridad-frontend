import { test, expect } from '@playwright/test';

/**
 * Banner de alerta LLM en /process-pipeline.
 *
 * Cuando el provider LLM (Google Gemini, Anthropic, OpenAI…) está rechazando
 * todas las llamadas por un error IRRECUPERABLE (spending cap superado,
 * quota agotada, api key inválida, billing no habilitado), reintentar no
 * resuelve nada y los docs cuelgan 9-13 min por timeout. La pantalla
 * /process-pipeline debe mostrar un banner rojo con el mensaje del provider
 * + sugerencia + link a la consola para que el admin actúe.
 *
 * Fuente del banner: GET /cola-estados-docs/resumen-pipeline → `alerta_llm`.
 *
 * Esta prueba intercepta la respuesta del endpoint, inyecta una alerta
 * sintética y verifica que el banner aparezca con los datos correctos
 * y que el botón "Ya lo resolví" llame al endpoint de resolución.
 */
test.describe('process-pipeline — banner de alerta LLM', () => {
  const ALERTA_FAKE = {
    proveedor: 'google',
    modelo: 'gemini-2.5-flash-lite',
    categoria: 'spending_cap',
    mensaje:
      'Your project has exceeded its monthly spending cap. Please go to AI Studio to manage your project spend cap.',
    sugerencia:
      'El proyecto del proveedor LLM superó su tope de gasto mensual. Sube el cap o rota la API key a otra cuenta para reanudar.',
    url_ayuda: 'https://ai.studio/spend',
    primera_aparicion: '2026-05-29T22:00:00+00:00',
    ultima_aparicion: '2026-05-29T22:30:00+00:00',
    total_apariciones: 932,
  };

  test('muestra banner con datos del provider y permite resolver', async ({ page }) => {
    let resolverLlamado = false;

    // Interceptar el endpoint de resumen-pipeline para inyectar la alerta.
    await page.route('**/cola-estados-docs/resumen-pipeline**', async (route) => {
      const response = await route.fetch();
      const json = await response.json().catch(() => ({}));
      await route.fulfill({
        response,
        json: { ...json, alerta_llm: ALERTA_FAKE },
      });
    });

    // Interceptar el POST de resolver para confirmar que el botón funciona.
    // Usamos un matcher amplio porque axios añade query strings y hostnames cambian.
    await page.route(/alertas-llm\/resolver/, async (route) => {
      resolverLlamado = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resuelto: true }),
      });
    });

    // Login
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const email = page.getByLabel(/email|correo/i);
    await email.waitFor({ state: 'visible', timeout: 15000 });
    await email.fill('rufino@rufinocabrera.cl');
    await page.getByLabel(/password|contraseña/i).fill('Test1234!');
    const submit = page.getByRole('button', { name: /iniciar sesión|ingresar|login/i });
    await expect(submit).toBeEnabled({ timeout: 10000 });
    await submit.click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 30000 });

    // Ir a process-pipeline
    await page.goto('/process-pipeline');
    await expect(page).toHaveURL(/process-pipeline/, { timeout: 15000 });

    // El banner debe aparecer (el poll de resumen-pipeline ocurre al montar
    // y luego cada 2.5s; basta con esperar la 1ra carga).
    const banner = page.getByTestId('banner-alerta-llm');
    await expect(banner).toBeVisible({ timeout: 30000 });
    await expect(banner).toHaveAttribute('data-categoria', 'spending_cap');

    // Contenido visible esperado
    await expect(banner).toContainText('google');
    await expect(banner).toContainText('gemini-2.5-flash-lite');
    await expect(banner).toContainText(/spending cap/i);
    await expect(banner).toContainText('932');

    // Link a la consola del provider
    const link = banner.getByRole('link', { name: /consola del proveedor/i });
    await expect(link).toHaveAttribute('href', 'https://ai.studio/spend');
    await expect(link).toHaveAttribute('target', '_blank');

    // Botón "Ya lo resolví" llama al endpoint y oculta el banner.
    // Cambio el mock de resumen-pipeline para que el siguiente poll devuelva
    // alerta_llm=null, lo que debe ocultar el banner.
    await page.unroute('**/cola-estados-docs/resumen-pipeline**');
    await page.route('**/cola-estados-docs/resumen-pipeline**', async (route) => {
      try {
        const response = await route.fetch();
        const json = await response.json().catch(() => ({}));
        await route.fulfill({ response, json: { ...json, alerta_llm: null } });
      } catch {
        // Si la página ya cerró el contexto al final del test, ignorar
        await route.abort().catch(() => undefined);
      }
    });

    // Click + esperar la respuesta del endpoint de resolución
    const respResolver = page.waitForResponse(
      (r) => /alertas-llm\/resolver/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15000 },
    );
    await banner.getByRole('button', { name: /ya lo resolv/i }).click();
    await respResolver;
    expect(resolverLlamado).toBe(true);
    await expect(banner).toBeHidden({ timeout: 10000 });

    // Limpiar routes pendientes antes de cerrar el contexto.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});
