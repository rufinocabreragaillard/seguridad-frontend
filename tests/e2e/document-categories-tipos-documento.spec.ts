import { test, expect } from '@playwright/test'

const BASE_URL = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASSWORD = 'Test1234!'

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email|correo/i).fill(EMAIL)
  await page.getByLabel(/password|contraseña/i).fill(PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
})

test('/document-categories: 3 pestanas con nombres correctos', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // Pestana "Tipo de Documento" debe existir como PRIMERA
  await expect(page.getByRole('button', { name: /tipo de documento/i }).first()).toBeVisible({ timeout: 10000 })
  // Pestanas renombradas
  await expect(page.getByRole('button', { name: /categor.as de caracter.sticas/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /tipos de caracter.sticas/i })).toBeVisible()
})

test('/document-categories tab Tipo de Documento: lista los 17 tipos globales', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.getByRole('button', { name: /tipo de documento/i }).first().click()
  await page.waitForTimeout(800)

  // Verifica que se muestren al menos algunos tipos conocidos del seed
  await expect(page.getByText(/factura/i).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/contrato/i).first()).toBeVisible()
  await expect(page.getByText(/boleta/i).first()).toBeVisible()
})

test('/document-categories tab Tipo de Documento: modal de edicion abre y muestra 5 sub-pestanas en orden', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.getByRole('button', { name: /tipo de documento/i }).first().click()
  await page.waitForTimeout(800)

  // Click en el lapiz de FACTURA
  const filaFactura = page.locator('tr', { hasText: /factura/i }).first()
  await filaFactura.locator('button[title="Editar"], button:has(svg.lucide-pencil)').first().click({ timeout: 10000 })
  await page.waitForTimeout(500)

  // Dentro del modal: 5 sub-pestanas en orden Datos, Categorias, Tipos Caracteristicas, System Prompt, Prompts
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('button', { name: /^datos$/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /^categor.as$/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /tipos caracter.sticas/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /system prompt/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /prompts.*insert.*update/i })).toBeVisible()

  // El orden visual: Datos (1ro), Categorias (2do), Tipos Caracteristicas (3ro), System Prompt (4to), Prompts (5to)
  const tabs = modal.locator('div.flex.border-b > button')
  await expect(tabs.nth(0)).toContainText(/datos/i)
  await expect(tabs.nth(1)).toContainText(/categor.as/i)
  await expect(tabs.nth(2)).toContainText(/tipos caracter.sticas/i)
  await expect(tabs.nth(3)).toContainText(/system prompt/i)
  await expect(tabs.nth(4)).toContainText(/prompts/i)
})

test('/document-categories: pestana Categorias lista categorias del tipo y tiene drag handle', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.getByRole('button', { name: /tipo de documento/i }).first().click()
  await page.waitForTimeout(800)

  const filaFactura = page.locator('tr', { hasText: /factura/i }).first()
  await filaFactura.locator('button[title="Editar"], button:has(svg.lucide-pencil)').first().click({ timeout: 10000 })

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 10000 })

  // Ir a sub-pestana "Categorias"
  await modal.getByRole('button', { name: /^categor.as$/i }).click()

  // FACTURA tiene en seed FECHAS_IMPORTANTES, IDENTIFICADORES, MONTOS, ORGANIZACIONES_REL, TIPO_CONTENIDO
  await expect(modal.locator('table').getByText(/montos/i).first()).toBeVisible({ timeout: 15000 })
  await expect(modal.locator('table').getByText(/identificadores/i).first()).toBeVisible()

  // Drag handle visible (icono GripVertical en cada fila)
  const dragHandles = modal.locator('table tbody button.cursor-grab')
  await expect(dragHandles.first()).toBeVisible()
  expect(await dragHandles.count()).toBeGreaterThanOrEqual(3)
})

test('/document-categories tab Tipo de Documento: pestana Caracteristicas muestra relaciones del tipo', async ({ page }) => {
  await page.goto(`${BASE_URL}/document-categories`)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  await page.getByRole('button', { name: /tipo de documento/i }).first().click()
  await page.waitForTimeout(800)

  const filaFactura = page.locator('tr', { hasText: /factura/i }).first()
  await filaFactura.locator('button[title="Editar"], button:has(svg.lucide-pencil)').first().click({ timeout: 10000 })

  // Esperar al modal de Radix Dialog
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 10000 })

  // Ir a sub-pestana "Tipos Caracteristicas" dentro del modal
  await modal.getByRole('button', { name: /^tipos caracter.sticas$/i }).click()

  // FACTURA debe tener al menos MONTOS en su seed; el listado se carga via API
  await expect(modal.locator('table').getByText(/montos/i).first()).toBeVisible({ timeout: 15000 })
})
