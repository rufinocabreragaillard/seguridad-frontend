'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface SidebarContextValue {
  /** El sidebar está fijado expandido (toma su espacio en el layout). */
  pinned: boolean
  /** Cursor sobre el sidebar — relevante solo cuando NO está pinned. */
  hovered: boolean
  /** Derivado: pinned || hovered. Determina si se muestra el contenido ancho. */
  expandido: boolean
  /** Alias legacy de !expandido para consumidores que aún usan `colapsado`. */
  colapsado: boolean
  setPinned: (v: boolean) => void
  setHovered: (v: boolean) => void
  togglePinned: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  pinned: true,
  hovered: false,
  expandido: true,
  colapsado: false,
  setPinned: () => {},
  setHovered: () => {},
  togglePinned: () => {},
})

const STORAGE_KEY = 'serverlm:sidebar:pinned'

export function SidebarProvider({
  defaultPinned = true,
  children,
}: {
  defaultPinned?: boolean
  children: ReactNode
}) {
  const [pinned, setPinnedState] = useState(defaultPinned)
  const [hovered, setHovered] = useState(false)

  // Cargar preferencia persistida (sobrescribe el default de la aplicación).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === 'true' || raw === 'false') {
        setPinnedState(raw === 'true')
      }
    } catch {
      // localStorage puede no estar disponible (modo incógnito, SSR)
    }
  }, [])

  const setPinned = (v: boolean) => {
    setPinnedState(v)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(v))
    } catch {
      // ignorar
    }
    // Al pinear/desfijar, soltamos el hover para que el estado quede limpio.
    setHovered(false)
  }

  const togglePinned = () => setPinned(!pinned)

  const expandido = pinned || hovered

  return (
    <SidebarContext.Provider
      value={{
        pinned,
        hovered,
        expandido,
        colapsado: !expandido,
        setPinned,
        setHovered,
        togglePinned,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
