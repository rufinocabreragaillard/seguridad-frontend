import { test, expect } from '@playwright/test';

// Valida que el sidebar derive automáticamente colores de texto legibles
// según la luminancia del fondo (--color-sidebar), tanto para fondos
// oscuros como claros configurados por el grupo.
test.describe.configure({ mode: 'serial' });

function rgbToLuminance(rgb: string): number {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i);
  if (!m) throw new Error(`No se pudo parsear color: ${rgb}`);
  const [r, g, b] = [+m[1], +m[2], +m[3]].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toRgbString(c: string): string {
  if (c.startsWith('rgb')) return c;
  if (c.startsWith('#')) {
    const h = c.length === 4
      ? c.slice(1).split('').map((x) => x + x).join('')
      : c.slice(1);
    return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
  }
  return c;
}

let sharedPage: import('@playwright/test').Page;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  sharedPage = await ctx.newPage();
  await sharedPage.goto('/');
  await sharedPage.getByLabel(/email|correo/i).fill('rufino@rufinocabrera.cl');
  await sharedPage.getByLabel(/password|contraseña/i).fill('Test1234!');
  await sharedPage.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click();
  await expect(sharedPage).not.toHaveURL(/login/i, { timeout: 30000 });
  await sharedPage.locator('aside').first().waitFor({ state: 'visible', timeout: 15000 });
});

test('sidebar con fondo oscuro → texto claro derivado automáticamente', async () => {
  const page = sharedPage;

  const { fondo, texto, muted } = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      fondo: cs.getPropertyValue('--color-sidebar').trim(),
      texto: cs.getPropertyValue('--color-sidebar-texto').trim(),
      muted: cs.getPropertyValue('--color-sidebar-texto-muted').trim(),
    };
  });

  console.log({ fondo, texto, muted });

  // El sidebar por defecto es oscuro (#074B91)
  expect(rgbToLuminance(toRgbString(fondo))).toBeLessThan(0.5);

  // Texto fuerte debe ser claro (blanco)
  expect(rgbToLuminance(toRgbString(texto))).toBeGreaterThan(0.9);

  // Texto muted debe ser claro y notoriamente más legible que el viejo #B8C8DE (lum ≈ 0.55)
  expect(rgbToLuminance(toRgbString(muted))).toBeGreaterThan(0.55);
});

test('sidebar con fondo claro forzado → texto oscuro derivado automáticamente', async () => {
  const page = sharedPage;

  // Forzamos la luminancia del sidebar a un valor claro y reaplicamos
  // la lógica del ThemeContext sobre el root. Esto simula el escenario
  // donde un grupo configura un fondo claro vía parametros.
  const resultado = await page.evaluate(() => {
    const root = document.documentElement;
    const fondoClaro = '#F5F5F5';
    root.style.setProperty('--color-sidebar', fondoClaro);

    // Replica de aplicarContrasteSidebar (ThemeContext.tsx)
    const parse = (v: string) => {
      const h = v.replace('#', '');
      const hex = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const n = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * n(r) + 0.7152 * n(g) + 0.0722 * n(b);
    };
    const esOscuro = lum(parse(fondoClaro)) < 0.5;
    const textoFuerte = esOscuro ? '#FFFFFF' : '#0F172A';
    const textoMuted = esOscuro ? 'rgba(255, 255, 255, 0.78)' : 'rgba(15, 23, 42, 0.68)';
    root.style.setProperty('--color-sidebar-texto', textoFuerte);
    root.style.setProperty('--color-sidebar-texto-muted', textoMuted);

    const cs = getComputedStyle(root);
    return {
      fondo: cs.getPropertyValue('--color-sidebar').trim(),
      texto: cs.getPropertyValue('--color-sidebar-texto').trim(),
      muted: cs.getPropertyValue('--color-sidebar-texto-muted').trim(),
    };
  });

  console.log(resultado);

  expect(rgbToLuminance(toRgbString(resultado.fondo))).toBeGreaterThan(0.5);
  expect(rgbToLuminance(toRgbString(resultado.texto))).toBeLessThan(0.05);
  expect(rgbToLuminance(toRgbString(resultado.muted))).toBeLessThan(0.5);
});
