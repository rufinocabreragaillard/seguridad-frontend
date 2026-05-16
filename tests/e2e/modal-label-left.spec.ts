import { test, expect } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufino@rufinocabrera.cl'
const PASSWORD = 'Test1234!'

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(admin|dashboard|chat|areas)/, { timeout: 15000 })
})

test('modal de Áreas: labels de campos single-line a la izquierda del input', async ({ page }) => {
  await page.goto(`${BASE_URL}/areas`)
  await page.waitForLoadState('networkidle', { timeout: 20000 })

  const filaArea = page.locator('tbody tr').first()
  await expect(filaArea).toBeVisible({ timeout: 15000 })
  await page.locator('tbody tr button[title="Editar"]').first().click()

  const modalBody = page.locator('.modal-body').first()
  await expect(modalBody).toBeVisible({ timeout: 5000 })

  const label = modalBody.locator('label').first()
  await expect(label).toBeVisible()
  const input = modalBody.locator('input').first()
  await expect(input).toBeVisible()

  const labelBox = await label.boundingBox()
  const inputBox = await input.boundingBox()
  expect(labelBox).not.toBeNull()
  expect(inputBox).not.toBeNull()
  if (!labelBox || !inputBox) throw new Error('No boxes')

  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(inputBox.x + 4)

  const tops = Math.abs(labelBox.y - inputBox.y)
  expect(tops).toBeLessThan(labelBox.height + 4)

  const labelText = (await label.textContent()) ?? ''
  expect(labelText.trim().length).toBeGreaterThan(0)
  const labelAfterContent = await label.evaluate(
    (el) => window.getComputedStyle(el, '::after').content
  )
  expect(labelAfterContent).toContain(':')
})
