'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useTema } from '@/context/ThemeContext'
import { obtenerIcono } from '@/lib/icon-map'
import { tr } from '@/lib/traducir'
import { tema as temaDefault } from '@/config/tema.config'

export function Sidebar() {
  const pathname = usePathname()
  const { usuario } = useAuth()
  const { logo, appNombreCorto } = useTema()
  // sidebar_ancho viene de aplicaciones.sidebar_ancho — true=expandido, false=colapsado
  const sidebarAnchoPorDefecto = usuario?.sidebar_ancho !== false
  const [colapsado, setColapsado] = useState(!sidebarAnchoPorDefecto)

  const menuFiltrado = useMemo(() => {
    if (!usuario?.menu) return []
    const appActiva = usuario.aplicacion_activa
    if (!appActiva) return usuario.menu
    return usuario.menu
      .map(rol => ({
        ...rol,
        funciones: rol.funciones.filter(fn =>
          fn.aplicaciones?.includes(appActiva) || !fn.aplicaciones?.length
        )
      }))
      .filter(rol => rol.funciones.length > 0)
  }, [usuario?.menu, usuario?.aplicacion_activa])

  // Clases comunes para items del menú
  const itemBase = cn(
    'flex items-center rounded-lg transition-colors text-sm font-medium',
    colapsado ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5'
  )
  const itemActivo = 'bg-sidebar-activo text-sidebar-texto'
  const itemInactivo = 'text-sidebar-texto-muted hover:bg-sidebar-hover hover:text-sidebar-texto'

  return (
    <aside
      className={cn(
        'flex flex-col h-full transition-all duration-300 shrink-0',
        'bg-sidebar text-sidebar-texto',
        colapsado ? 'w-16' : 'w-60'
      )}
    >
      {/* Cabecera: logo + botón colapsar */}
      <div className={cn(
        'flex items-center border-b border-sidebar-texto/40 min-h-[64px]',
        colapsado ? 'justify-center px-2' : 'justify-between px-4'
      )}>
        {!colapsado && (
          <Link href="/dashboard" className="flex items-center min-w-0">
            <Image
              src={logo.url}
              alt={logo.alt}
              width={logo.ancho}
              height={logo.alto}
              className="object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (target.src.includes(temaDefault.logo.url)) {
                  target.style.display = 'none'
                } else {
                  target.src = temaDefault.logo.url
                }
              }}
            />
            <span className="font-bold text-lg ml-2 hidden">{appNombreCorto}</span>
          </Link>
        )}
        <button
          onClick={() => setColapsado(!colapsado)}
          className="p-1.5 rounded-lg hover:bg-sidebar-hover text-texto-muted hover:text-sidebar-texto transition-colors shrink-0"
          title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
        >
          {colapsado
            ? <PanelLeftOpen size={18} />
            : <PanelLeftClose size={18} />
          }
        </button>
      </div>

      {/* Navegación — 100% dinámica desde BD (usuario.menu).
          Si el usuario no tiene funciones en el grupo/app activo, el sidebar queda vacío. */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-4 overflow-y-auto">
        {menuFiltrado.length === 0 ? (
          !colapsado && usuario?.menu && (
            <div className="px-3 py-2 text-xs text-sidebar-texto-muted">
              Sin funciones disponibles en este grupo/aplicación.
            </div>
          )
        ) : (
          menuFiltrado.map((rol) => (
            <div key={rol.id_rol}>
              {!colapsado && (
                <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-texto-muted">
                  {tr('roles', 'alias', String(rol.id_rol), rol.alias)}
                </span>
              )}
              {/* Separador fino cuando está colapsado */}
              {colapsado && (
                <div className="w-6 mx-auto border-t border-sidebar-texto/40 mb-1" />
              )}
              <div className="flex flex-col gap-1 mt-1">
                {rol.funciones.map((fn) => {
                  const href = fn.url || '#'
                  const activo = pathname === href || pathname.startsWith(href + '/')
                  const Icono = obtenerIcono(fn.icono)
                  return (
                    <Link
                      key={fn.codigo_funcion}
                      href={href}
                      className={cn(itemBase, activo ? itemActivo : itemInactivo)}
                      title={tr('funciones', 'alias', fn.codigo_funcion, fn.alias)}
                    >
                      <Icono size={18} className="shrink-0" />
                      {!colapsado && <span>{tr('funciones', 'alias', fn.codigo_funcion, fn.alias)}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Pie */}
      <div className="px-2 py-4 border-t border-sidebar-texto/40" />
    </aside>
  )
}
