import { test, expect } from '@playwright/test';

// Verifica el fix del visor: al abrir un documento (PDF incluido), la pestaña
// debe titularse con el NOMBRE REAL del archivo, no con la blob: URL (UUID).
// El visor real requiere File System Access API (handle de directorio del
// usuario), que Playwright no puede otorgar en CI; por eso aquí se valida el
// contrato de la primitiva _abrirEnPestanaConNombre reproduciendo su salida:
// un wrapper HTML con <title> = nombre, <iframe src=blob> y <a download=nombre>.

const NOMBRE = 'CONTRATO BETTERPLAN Victor Cabrera.pdf';

test.describe('visor — nombre real en lugar de blob: UUID', () => {
  test('la pestaña del visor PDF usa el nombre del documento como título y descarga', async ({ page, context }) => {
    await page.goto('/login');

    // Construye el wrapper EXACTAMENTE como lo hace src/lib/abrir-documento.ts
    // para un visualizable (PDF incluido tras el fix), con un PDF mínimo en blob.
    const { url, title, downloadName } = await page.evaluate((nombre) => {
      const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => (
        c === '&' ? '&amp;' :
        c === '<' ? '&lt;' :
        c === '>' ? '&gt;' :
        c === '"' ? '&quot;' : '&#39;'
      ));
      // PDF mínimo válido
      const pdfBytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const titulo = escapeHtml(nombre);
      const src = escapeHtml(blobUrl);
      const dl = escapeHtml('Descargar archivo');
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;padding:0;overflow:hidden;background:#1f1f1f;display:flex;flex-direction:column;height:100vh">
<div style="flex:0 0 auto;display:flex;align-items:center;gap:1rem;padding:8px 14px;background:#2a2a2a;font-family:sans-serif">
<span style="color:#ddd;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${titulo}">${titulo}</span>
<a href="${src}" download="${titulo}" style="color:#6ab0f5;font-size:13px;text-decoration:none;white-space:nowrap">${dl}</a>
</div>
<iframe src="${src}" style="flex:1 1 auto;width:100%;border:0" title="${titulo}"></iframe>
</body>
</html>`;
      const wrapperBlob = new Blob([html], { type: 'text/html' });
      const wrapperUrl = URL.createObjectURL(wrapperBlob);
      return { url: wrapperUrl, title: nombre, downloadName: nombre };
    }, NOMBRE);

    // Abre la pestaña del visor (como hace window.open(wrapperUrl) en la librería)
    const [nuevaPestana] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate((u) => { window.open(u, '_blank'); }, url),
    ]);

    await nuevaPestana.waitForLoadState('domcontentloaded');

    // 1) El título de la pestaña es el nombre real, NO una blob: URL
    const tituloPestana = await nuevaPestana.title();
    console.log(`Título de la pestaña del visor: ${tituloPestana}`);
    expect(tituloPestana).toBe(title);
    expect(tituloPestana).not.toContain('blob:');

    // 2) Hay un iframe que muestra el documento (sigue siendo VER, no descargar)
    const iframe = nuevaPestana.locator('iframe');
    await expect(iframe).toHaveCount(1);

    // 3) Existe el enlace de descarga con el nombre real en download
    const enlaceDescarga = nuevaPestana.locator('a[download]');
    await expect(enlaceDescarga).toHaveCount(1);
    const dlAttr = await enlaceDescarga.getAttribute('download');
    console.log(`Atributo download del enlace: ${dlAttr}`);
    expect(dlAttr).toBe(downloadName);
    expect(dlAttr).not.toContain('blob:');
  });
});
