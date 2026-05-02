'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import type { FuncionMenu } from '@/lib/tipos'

/**
 * Devuelve la FuncionMenu correspondiente a la ruta actual (pathname).
 * nombre y ayuda ya vienen traducidos si el usuario tiene locale != es.
 * Retorna null si la ruta no está registrada en el menú del usuario.
 */
export function useFuncionActual(): FuncionMenu | null {
  const pathname = usePathname()
  const { usuario } = useAuth()

  if (!usuario?.menu || !pathname) return null

  for (const rol of usuario.menu) {
    for (const fn of rol.funciones) {
      if (!fn.url) continue
      if (fn.url === pathname || pathname.startsWith(fn.url + '/')) {
        return fn
      }
    }
  }

  return null
}
