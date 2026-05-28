'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { tema as temaDefault } from '@/config/tema.config'

interface ThemeContextType {
  tema: Record<string, unknown> | null
  logo: { url: string; alt: string; ancho: number; alto: number }
}

const ThemeContext = createContext<ThemeContextType>({
  tema: null,
  logo: temaDefault.logo,
})

/**
 * Mapeo de claves del JSON de tema a nombres de CSS custom properties.
 * Las claves en BD usan guion bajo (primario_hover),
 * las CSS variables usan guion medio (--color-primario-hover).
 */

// Claves del sidebar que derivamos automáticamente del fondo para garantizar
// contraste legible (no importa si el grupo configura fondo claro u oscuro).
const SIDEBAR_TEXTO_DERIVADAS = [
  '--color-sidebar-texto',
  '--color-sidebar-texto-muted',
]

function parseColor(value: string): { r: number; g: number; b: number } | null {
  const v = value.trim()
  // #RGB / #RRGGBB
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  // rgb() / rgba()
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i)
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3] }
  }
  return null
}

// Luminancia relativa WCAG (0 = negro, 1 = blanco).
function luminancia({ r, g, b }: { r: number; g: number; b: number }): number {
  const norm = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * norm(r) + 0.7152 * norm(g) + 0.0722 * norm(b)
}

// Deriva colores de texto del sidebar según luminancia del fondo, para que el
// menú siga legible aunque el grupo configure un sidebar claro u oscuro.
// Se ejecuta DESPUÉS de aplicar los colores del grupo, sobreescribiendo
// sidebar_texto / sidebar_texto_muted para garantizar contraste.
function aplicarContrasteSidebar(
  colores: Record<string, string>,
  root: HTMLElement,
) {
  const fondoRaw =
    colores.sidebar ?? getComputedStyle(root).getPropertyValue('--color-sidebar')
  const fondo = parseColor(fondoRaw)
  if (!fondo) return

  const esOscuro = luminancia(fondo) < 0.5
  const textoFuerte = esOscuro ? '#FFFFFF' : '#0F172A'
  const textoMuted = esOscuro
    ? 'rgba(255, 255, 255, 0.78)'
    : 'rgba(15, 23, 42, 0.68)'

  root.style.setProperty('--color-sidebar-texto', textoFuerte)
  root.style.setProperty('--color-sidebar-texto-muted', textoMuted)
}

function aplicarColores(colores: Record<string, string>) {
  const root = document.documentElement
  Object.entries(colores).forEach(([key, value]) => {
    const cssVar = `--color-${key.replace(/_/g, '-')}`
    root.style.setProperty(cssVar, value)
  })
  aplicarContrasteSidebar(colores, root)
}

function limpiarColores(colores: Record<string, string>) {
  const root = document.documentElement
  Object.keys(colores).forEach((key) => {
    const cssVar = `--color-${key.replace(/_/g, '-')}`
    root.style.removeProperty(cssVar)
  })
  SIDEBAR_TEXTO_DERIVADAS.forEach((cssVar) => {
    root.style.removeProperty(cssVar)
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()

  useEffect(() => {
    const colores = (usuario?.tema as { colores?: Record<string, string> })?.colores
    if (!colores) return

    aplicarColores(colores)

    return () => {
      limpiarColores(colores)
    }
  }, [usuario?.tema])

  // Logo: del tema del grupo (parametros_*.APARIENCIA/LOGO) con fallback al estático
  const temaGrupo = usuario?.tema as { logo?: { url?: string } } | null
  const urlGrupo = temaGrupo?.logo?.url
  const logo = urlGrupo
    ? { ...temaDefault.logo, url: urlGrupo, alt: temaDefault.logo.alt }
    : temaDefault.logo

  return (
    <ThemeContext.Provider value={{ tema: usuario?.tema ?? null, logo }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTema() {
  return useContext(ThemeContext)
}
