'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface SidebarContextValue {
  colapsado: boolean
  setColapsado: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  colapsado: false,
  setColapsado: () => {},
})

export function SidebarProvider({ defaultColapsado = false, children }: { defaultColapsado?: boolean; children: ReactNode }) {
  const [colapsado, setColapsado] = useState(defaultColapsado)
  return (
    <SidebarContext.Provider value={{ colapsado, setColapsado }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
