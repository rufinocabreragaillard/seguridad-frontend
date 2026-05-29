import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

/** Raíz donde viven los artefactos. Cubierta por /test-results/ en .gitignore. */
export function dirPantalla(codigo: string): string {
  return join('test-results', 'traducciones', codigo)
}

/**
 * Captura una etapa de la pantalla: screenshot full-page + innerText visible +
 * HTML completo. El juez (Fase 3) lee estos tres artefactos:
 *  - .png  → juicio visual del agente (tooltips, canvas, dropdowns de catálogo)
 *  - .txt  → diff contra es.json/en.json (SPANISH_LEAK)
 *  - .html → regex de tags i18n literales (TAG_LITERAL)
 */
export async function capturar(page: Page, codigo: string, etapa: string): Promise<void> {
  const dir = dirPantalla(codigo)
  mkdirSync(dir, { recursive: true })

  await page.screenshot({ path: join(dir, `${etapa}.png`), fullPage: true })

  const texto = await page.locator('body').innerText().catch(() => '')
  writeFileSync(join(dir, `${etapa}.txt`), texto, 'utf-8')

  const html = await page.content().catch(() => '')
  writeFileSync(join(dir, `${etapa}.html`), html, 'utf-8')
}

/** Registra una etapa que no se pudo ejecutar (selector no resolvió, timeout). */
export function registrarOmitida(codigo: string, etapa: string, motivo: string): void {
  const dir = dirPantalla(codigo)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${etapa}.OMITIDA.txt`), motivo, 'utf-8')
}
