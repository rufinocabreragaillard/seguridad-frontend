'use client'

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

interface SoporteContextValue {
  abierto: boolean
  abrir: () => void
  cerrar: () => void
  toggle: () => void
}

const SoporteContext = createContext<SoporteContextValue | null>(null)

export function SoporteProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const abrir = useCallback(() => setAbierto(true), [])
  const cerrar = useCallback(() => setAbierto(false), [])
  const toggle = useCallback(() => setAbierto((v) => !v), [])
  return (
    <SoporteContext.Provider value={{ abierto, abrir, cerrar, toggle }}>
      {children}
    </SoporteContext.Provider>
  )
}

export function useSoporte() {
  const ctx = useContext(SoporteContext)
  if (!ctx) throw new Error('useSoporte must be used within SoporteProvider')
  return ctx
}
