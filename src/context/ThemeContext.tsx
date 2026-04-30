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
function aplicarColores(colores: Record<string, string>) {
  const root = document.documentElement
  Object.entries(colores).forEach(([key, value]) => {
    const cssVar = `--color-${key.replace(/_/g, '-')}`
    root.style.setProperty(cssVar, value)
  })
}

function limpiarColores(colores: Record<string, string>) {
  const root = document.documentElement
  Object.keys(colores).forEach((key) => {
    const cssVar = `--color-${key.replace(/_/g, '-')}`
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
