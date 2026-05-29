import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { loginYsetLocale, type LocaleTest } from './_helpers/login'
import { capturar, registrarOmitida } from './_helpers/captura'
import * as crud from './_helpers/crud'

export interface CtxRoundTrip {
  page: Page
  context: BrowserContext
  /** Sentinel único de la corrida, p.ej. "TEST_TRAD_1716940000000". */
  sentinel: string
  capturar: (etapa: string) => Promise<void>
}

export interface ConfigTest {
  codigo: string
  url: string
  usuario: string
  password: string
  locale?: LocaleTest
  esMantenedor?: boolean
  permiteDelete?: boolean
  permiteUpdate?: boolean
  /**
   * Round-trip real opcional. Si se define, el template crea el sentinel,
   * invoca prepararDatos (llenar + guardar) y, en finally, limpiarDatos.
   * Sin estos hooks, el template solo abre el modal de crear y captura labels.
   */
  prepararDatos?: (ctx: CtxRoundTrip) => Promise<void>
  limpiarDatos?: (ctx: CtxRoundTrip) => Promise<void>
}

const TIMEOUT_ETAPA = 15000

/**
 * Define el test E2E de traducciones para una pantalla. Llamar desde un
 * wrapper `<codigo>.spec.ts`. Captura DOM+screenshot por etapa; el juicio de
 * "está en inglés / no" lo hace el agente leyendo los artefactos después.
 */
export function correrTestTraduccion(cfg: ConfigTest): void {
  const locale: LocaleTest = cfg.locale ?? 'en'

  test.describe(`traducciones · ${cfg.codigo} · ${locale}`, () => {
    test.describe.configure({ mode: 'serial' })

    test(`${cfg.codigo} — recorrido de traducción`, async ({ page, context }) => {
      test.setTimeout(180000)
      const cap = (etapa: string) => capturar(page, cfg.codigo, etapa)

      // ── LOGIN + LOCALE ──────────────────────────────────────────────
      await loginYsetLocale(page, context, {
        email: cfg.usuario,
        password: cfg.password,
        locale,
      })

      // ── INICIAL ─────────────────────────────────────────────────────
      await page.goto(cfg.url)
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT_ETAPA }).catch(() => {})
      await page.waitForTimeout(600) // hidratación
      await cap('INICIAL')

      // ── TABS ────────────────────────────────────────────────────────
      const tabsLoc = crud.tabs(page)
      const nTabs = await tabsLoc.count().catch(() => 0)
      for (let i = 0; i < nTabs; i++) {
        try {
          await tabsLoc.nth(i).click({ timeout: 5000 })
          await page.waitForTimeout(400)
          await cap(`TAB_${i}`)
        } catch {
          registrarOmitida(cfg.codigo, `TAB_${i}`, 'click de tab falló')
        }
      }

      // ── CRUD ────────────────────────────────────────────────────────
      if (cfg.esMantenedor) {
        // MODAL_CREAR: abrir el modal de crear y capturar labels/placeholders.
        const btnNuevo = crud.botonNuevo(page)
        const hayBtnNuevo = await btnNuevo.isVisible().catch(() => false)
        if (hayBtnNuevo) {
          try {
            await btnNuevo.click({ timeout: 5000 })
            await expect(crud.modal(page)).toBeVisible({ timeout: TIMEOUT_ETAPA })
            await cap('MODAL_CREAR')

            // VALIDACION: submit vacío → mensajes de error traducidos.
            const btnConfirmar = crud.botonConfirmar(page)
            if (await btnConfirmar.isVisible().catch(() => false)) {
              await btnConfirmar.click({ timeout: 5000 }).catch(() => {})
              await page.waitForTimeout(500)
              await cap('VALIDACION')
            }

            // Cerrar el modal sin guardar (recorrido genérico).
            const btnCancelar = crud.botonCancelar(page)
            if (await btnCancelar.isVisible().catch(() => false)) {
              await btnCancelar.click({ timeout: 5000 }).catch(() => {})
            } else {
              await page.keyboard.press('Escape').catch(() => {})
            }
            await page.waitForTimeout(300)
          } catch {
            registrarOmitida(cfg.codigo, 'MODAL_CREAR', 'no se pudo abrir el modal de crear')
          }
        } else {
          registrarOmitida(cfg.codigo, 'MODAL_CREAR', 'botón Nuevo no visible')
        }

        // ROUND-TRIP REAL (opcional, solo si la pantalla aportó hooks).
        if (cfg.prepararDatos) {
          const sentinel = `TEST_TRAD_${Date.now()}`
          const ctx: CtxRoundTrip = { page, context, sentinel, capturar: cap }
          try {
            await cfg.prepararDatos(ctx)
            await cap('TOAST_CREADO')

            if (cfg.permiteUpdate) {
              const btnEditar = crud.botonEditarFila(page, sentinel)
              if (await btnEditar.isVisible().catch(() => false)) {
                await btnEditar.click({ timeout: 5000 })
                await expect(crud.modal(page)).toBeVisible({ timeout: TIMEOUT_ETAPA })
                await cap('MODAL_EDITAR')
                await crud.botonCancelar(page).click({ timeout: 5000 }).catch(() => {})
                await page.waitForTimeout(300)
              }
            }

            if (cfg.permiteDelete) {
              const btnEliminar = crud.botonEliminarFila(page, sentinel)
              if (await btnEliminar.isVisible().catch(() => false)) {
                await btnEliminar.click({ timeout: 5000 })
                await expect(crud.modal(page)).toBeVisible({ timeout: TIMEOUT_ETAPA })
                await cap('MODAL_CONFIRMAR_DELETE')
                await crud.botonConfirmar(page).click({ timeout: 5000 })
                await page.waitForTimeout(800)
                await cap('TOAST_BORRADO')
              }
            }
          } finally {
            // Cleanup garantizado: si quedó el sentinel, intentar borrarlo por UI.
            if (cfg.limpiarDatos) {
              await cfg.limpiarDatos({ page, context, sentinel, capturar: cap }).catch((e) => {
                registrarOmitida(cfg.codigo, 'CLEANUP', `limpiarDatos falló: ${String(e)}`)
              })
            }
          }
        }
      }

      // ── FINAL ───────────────────────────────────────────────────────
      await page.goto(cfg.url).catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT_ETAPA }).catch(() => {})
      await cap('FINAL')
    })
  })
}
