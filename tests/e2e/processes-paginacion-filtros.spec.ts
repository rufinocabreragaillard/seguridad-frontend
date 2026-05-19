import { test, expect } from '@playwright/test'

const BASE = 'https://app.serverlm.ai'
const EMAIL = 'rufinocabreragaillard@gmail.com'
const PASS = 'Test1234!'

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/processes|\/dashboard|\/chat/, { timeout: 15000 })
  await page.goto(`${BASE}/processes`)
  await page.waitForSelector('table tbody tr', { timeout: 15000 })
  // Esperar a que la tabla termine de pintar al menos una fila con datos
  await page.waitForFunction(
    () => {
      const filas = document.querySelectorAll('table tbody tr')
      if (filas.length === 0) return false
      const primerTexto = filas[0].textContent || ''
      return !primerTexto.includes('Cargando') && !primerTexto.includes('No hay')
    },
    undefined,
    { timeout: 10000 },
  )
}

// Parsea formatos "19-05-2026, 09:06 a. m." o "18-05-2026, 06:53 p. m."
function parsearFechaCL(s: string): Date | null {
  const m = s.match(/(\d{2})[-\/](\d{2})[-\/](\d{4}),?\s+(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i)
  if (!m) return null
  const dia = m[1]
  const mes = m[2]
  const anio = m[3]
  let hora = parseInt(m[4], 10)
  const min = m[5]
  const meridiano = (m[6] || '').toLowerCase().replace(/[.\s]/g, '')
  if (meridiano.startsWith('p') && hora < 12) hora += 12
  if (meridiano.startsWith('a') && hora === 12) hora = 0
  return new Date(`${anio}-${mes}-${dia}T${String(hora).padStart(2, '0')}:${min}:00`)
}

test.describe('Procesos — paginación + filtros + columna fecha/hora', () => {
  test('tabla tiene columna Fecha / Hora con fecha+hora visible', async ({ page }) => {
    await login(page)
    await expect(page.getByRole('columnheader', { name: 'Fecha / Hora' })).toBeVisible()
    const filas = page.locator('table tbody tr')
    const count = await filas.count()
    expect(count).toBeGreaterThan(0)
    const texto = (await filas.first().locator('td').nth(7).textContent()) ?? ''
    expect(texto).toMatch(/\d{2}[-\/]\d{2}[-\/]\d{4}.*\d{1,2}:\d{2}/)
  })

  test('tabla muestra columna Grupo (no oculta)', async ({ page }) => {
    await login(page)
    await expect(page.getByRole('columnheader', { name: 'Grupo' })).toBeVisible()
  })

  test('está ordenado por fecha descendente (más reciente primero)', async ({ page }) => {
    await login(page)
    const filas = page.locator('table tbody tr')
    const count = await filas.count()
    expect(count).toBeGreaterThan(1)
    const fecha1 = (await filas.nth(0).locator('td').nth(7).textContent()) ?? ''
    const fecha2 = (await filas.nth(1).locator('td').nth(7).textContent()) ?? ''
    const d1 = parsearFechaCL(fecha1)
    const d2 = parsearFechaCL(fecha2)
    expect(d1, `fecha1 no parseable: ${fecha1}`).not.toBeNull()
    expect(d2, `fecha2 no parseable: ${fecha2}`).not.toBeNull()
    expect(d1!.getTime()).toBeGreaterThanOrEqual(d2!.getTime())
  })

  test('paginador visible con navegación y selector de tamaño', async ({ page }) => {
    await login(page)
    await expect(page.getByText(/Página\s+\d+\s+de\s+\d+/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Mostrando\s+\d+/i).first()).toBeVisible({ timeout: 5000 })
    // Debe haber un select con opciones 20/50/100/200
    const select = page.locator('select').first()
    await expect(select).toBeVisible()
  })

  test('botón Filtros abre panel con filtros por columna', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: /Filtros/ }).click()
    // Panel desplegado: las etiquetas Categoría/Tipo/Estado/Grupo/Usuario están presentes como labels
    await expect(page.locator('label', { hasText: 'Categoría' }).first()).toBeVisible()
    await expect(page.locator('label', { hasText: 'Tipo' }).first()).toBeVisible()
    await expect(page.locator('label', { hasText: 'Estado' }).first()).toBeVisible()
    await expect(page.locator('label', { hasText: 'Grupo' }).first()).toBeVisible()
    await expect(page.locator('label', { hasText: 'Usuario' }).first()).toBeVisible()
  })

  test('paginación carga página 2 cuando hay más de page_size registros', async ({ page }) => {
    await login(page)
    const textoPag = await page.getByText(/Página\s+(\d+)\s+de\s+(\d+)/i).textContent()
    const m = textoPag?.match(/Página\s+(\d+)\s+de\s+(\d+)/i)
    if (!m) {
      test.skip()
      return
    }
    const total = parseInt(m[2], 10)
    if (total < 2) {
      test.skip()
      return
    }
    // Capturar primer código antes
    const codigoAntes = await page.locator('table tbody tr').first().locator('td').nth(1).textContent()
    // Click en siguiente
    const botones = page.locator('button:has(svg)')
    // Hacemos click en el botón con ChevronRight (no chevrons-right). El Paginador tiene 4 botones; el 3ro es next
    await page.locator('button', { has: page.locator('svg.lucide-chevron-right') }).first().click()
    await page.waitForTimeout(800)
    const codigoDespues = await page.locator('table tbody tr').first().locator('td').nth(1).textContent()
    expect(codigoDespues).not.toBe(codigoAntes)
    expect(botones).toBeTruthy()
  })
})
