import { test, expect } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufino@rufinocabrera.cl'
const PASSWORD = 'Test1234!'

test('document-locations: muestra CAB como raíz del árbol', async ({ page }) => {
  // Login
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(admin|dashboard|chat)/, { timeout: 15000 })

  // Navigate to document locations
  await page.goto(`${BASE_URL}/document-locations`)
  await page.waitForLoadState('networkidle', { timeout: 20000 })

  // CAB should appear as a root node in the tree (span.font-medium with exact text "cab")
  const cabNode = page.locator('span.font-medium').filter({ hasText: /^cab$/ })
  await expect(cabNode).toBeVisible({ timeout: 15000 })
})
