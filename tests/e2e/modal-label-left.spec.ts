import { test, expect } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufino@rufinocabrera.cl'
const PASSWORD = 'Test1234!'

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(admin|dashboard|chat|areas|documents)/, { timeout: 15000 })
})

test('modal Mi Cuenta: labels single-line a la izquierda del input', async ({ page }) => {
  await page.locator('button:has(span.bg-primario), button:has(div.bg-primario), header button:has([class*="rounded-full"])').last().click({ timeout: 10000 })
  await page.getByRole('menuitem').first().click()

  const modalBody = page.locator('.modal-body').first()
  await expect(modalBody).toBeVisible({ timeout: 5000 })

  const label = modalBody.locator('label', { hasText: /alias|nombre/i }).first()
  await expect(label).toBeVisible({ timeout: 5000 })

  const labelHandle = await label.elementHandle()
  if (!labelHandle) throw new Error('Label handle not found')
  const inputHandle = await labelHandle.evaluateHandle((el) => {
    const wrapper = el.parentElement
    return wrapper?.querySelector('input') ?? null
  })
  const input = inputHandle.asElement()
  if (!input) throw new Error('Input asociado al label no encontrado')

  const labelBox = await label.boundingBox()
  const inputBox = await (input as any).boundingBox()
  if (!labelBox || !inputBox) throw new Error('No boxes')

  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(inputBox.x + 4)

  const labelCenterY = labelBox.y + labelBox.height / 2
  const inputCenterY = inputBox.y + inputBox.height / 2
  expect(Math.abs(labelCenterY - inputCenterY)).toBeLessThan(inputBox.height)

  const afterContent = await label.evaluate(
    (el) => window.getComputedStyle(el, '::after').content
  )
  expect(afterContent).toContain(':')
})
