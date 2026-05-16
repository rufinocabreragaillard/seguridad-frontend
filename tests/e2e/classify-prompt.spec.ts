import { test, expect } from '@playwright/test'

test.describe.serial('Prompt de Clasificación (/classify-prompt)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email|correo/i).fill('rufinocabreragaillard@gmail.com')
    await page.getByLabel(/password|contraseña/i).fill('Test1234!')
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await expect(page).not.toHaveURL(/login/i, { timeout: 15000 })
    await page.goto('/classify-prompt')
    await expect(page.getByRole('heading', { name: 'Prompt de Clasificación' })).toBeVisible({ timeout: 20000 })
  })

  test('no muestra el campo "Grupo" en la barra de filtros', async ({ page }) => {
    // El header global ya muestra el grupo; no debe duplicarse en la barra de filtros.
    const filtros = page.locator('div').filter({ hasText: /^Documento \(opcional\)/ }).first()
    await expect(filtros).toBeVisible()
    // En la barra de filtros no debe aparecer la etiqueta "Grupo" sola.
    const grupoLabelEnFiltros = page.locator('label', { hasText: /^Grupo$/ })
    await expect(grupoLabelEnFiltros).toHaveCount(0)
  })

  test('botón Reintentar es el botón estándar (no <button> con clases sueltas)', async ({ page }) => {
    const boton = page.getByRole('button', { name: /Reintentar/ })
    await expect(boton).toBeVisible()
    const cls = await boton.getAttribute('class')
    // Los botones del catálogo Boton siempre tienen "rounded-lg" y "transition-colors".
    expect(cls).toContain('rounded-lg')
    expect(cls).toContain('transition-colors')
  })

  test('selector de documento es buscable (Input + dropdown)', async ({ page }) => {
    const buscador = page.getByPlaceholder(/Buscar documento por nombre o código/i)
    await expect(buscador).toBeVisible()
    await buscador.click()
    // Al abrir aparece la opción "Sin selección"
    await expect(page.getByRole('button', { name: /Sin selección/ })).toBeVisible({ timeout: 5000 })
  })

  test('System Prompt y User Prompt se renderizan', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'System Prompt' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('heading', { name: 'User Prompt' })).toBeVisible()
  })

  test('botón Copiar sin marcas existe en ambas secciones', async ({ page }) => {
    const botones = page.getByRole('button', { name: /Copiar sin marcas/ })
    await expect(botones).toHaveCount(2)
  })

  test('no existe el checkbox "Mostrar fuentes" (reemplazado por sidebar colapsable)', async ({ page }) => {
    const checkbox = page.locator('input[type="checkbox"]').filter({ has: page.locator(':scope') })
    // No debe haber un label con texto "Mostrar fuentes" envolviendo un checkbox
    const labelToggle = page.locator('label', { hasText: /^Mostrar fuentes$/ })
    await expect(labelToggle).toHaveCount(0)
    // Tampoco un checkbox al lado del selector de documento
    await expect(checkbox).toHaveCount(0)
  })

  test('panel de Fuentes se colapsa y expande con el botón Sidebar', async ({ page }) => {
    // Esperar a que cargue el contenido
    await expect(page.getByRole('heading', { name: 'System Prompt' })).toBeVisible({ timeout: 20000 })

    // Estado inicial: panel expandido, título "Fuentes" visible
    const headingFuentes = page.locator('div.section-heading', { hasText: /^Fuentes$/ }).first()
    await expect(headingFuentes).toBeVisible()

    // Botón colapsar (aria-label "Ocultar fuentes")
    const botonOcultar = page.getByRole('button', { name: /Ocultar fuentes/i })
    await expect(botonOcultar).toBeVisible()
    await botonOcultar.click()

    // Tras colapsar: el título "Fuentes" desaparece y aparece "Mostrar fuentes"
    await expect(headingFuentes).toBeHidden()
    const botonMostrar = page.getByRole('button', { name: /Mostrar fuentes/i })
    await expect(botonMostrar).toBeVisible()

    // Re-expandir
    await botonMostrar.click()
    await expect(headingFuentes).toBeVisible()
  })
})
