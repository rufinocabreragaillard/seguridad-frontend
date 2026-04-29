'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'
import { useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useTema } from '@/context/ThemeContext'
import { useTipoAccesoGrafo } from '@/hooks/useTipoAccesoGrafo'
import { obtenerIcono } from '@/lib/icon-map'
import { tr } from '@/lib/traducir'
import { tema as temaDefault } from '@/config/tema.config'

// Tooltip portal — se renderiza en document.body para escapar del overflow del sidebar
function TooltipPortal({ texto, rect }: { texto: string; rect: DOMRect }) {
  const top = rect.top + rect.height / 2
  const left = rect.right + 8
  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top, left, transform: 'translateY(-50%)' }}
    >
      <div className="bg-gray-900 text-white text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg relative">
        {texto}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </div>
    </div>,
    document.body
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { usuario } = useAuth()
  const { logo, appNombreCorto } = useTema()
  // sidebar_ancho viene de aplicaciones.sidebar_ancho — true=expandido, false=colapsado
  const sidebarAnchoPorDefecto = usuario?.sidebar_ancho !== false
  const [colapsado, setColapsado] = useState(!sidebarAnchoPorDefecto)
  const [tooltip, setTooltip] = useState<{ texto: string; rect: DOMRect } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busquedaRef = useRef<HTMLInputElement>(null)

  // Buscador visible solo para SISTEMA (y cualquier ancestro futuro de SISTEMA).
  // Usa el closure table tipo_acceso_grafo, así que se ajusta solo si la jerarquía cambia.
  const { esDescendiente } = useTipoAccesoGrafo()
  const puedeBuscar = esDescendiente(usuario?.tipo_acceso, 'SISTEMA')

  const mostrarTooltip = useCallback((e: React.MouseEvent<HTMLDivElement>, texto: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // Leer rect ANTES del timeout (el evento React se reutiliza)
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    timerRef.current = setTimeout(() => {
      setTooltip({ texto, rect })
    }, 120)
  }, [])

  const ocultarTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTooltip(null)
  }, [])

  const menuFiltrado = useMemo(() => {
    if (!usuario?.menu) return []
    const appActiva = usuario.aplicacion_activa
    const q = busqueda.trim().toLowerCase()
    return usuario.menu
      .map(rol => ({
        ...rol,
        funciones: rol.funciones.filter(fn => {
          const matchApp = !appActiva
            || fn.aplicaciones?.includes(appActiva)
            || !fn.aplicaciones?.length
          if (!matchApp) return false
          if (!q) return true
          const alias = tr('funciones', 'alias', fn.codigo_funcion, fn.alias).toLowerCase()
          return alias.includes(q) || fn.codigo_funcion.toLowerCase().includes(q)
        })
      }))
      .filter(rol => rol.funciones.length > 0)
  }, [usuario?.menu, usuario?.aplicacion_activa, busqueda])

  const enfocarBusqueda = useCallback(() => {
    if (colapsado) {
      setColapsado(false)
      setTimeout(() => busquedaRef.current?.focus(), 60)
    } else {
      busquedaRef.current?.focus()
    }
  }, [colapsado])

  // Clases comunes para items del menú
  const itemBase = cn(
    'flex items-center rounded-lg transition-colors text-sm font-medium',
    colapsado ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5'
  )
  const itemActivo = 'bg-sidebar-activo text-sidebar-texto'
  const itemInactivo = 'text-sidebar-texto-muted hover:bg-sidebar-hover hover:text-sidebar-texto'

  return (
    <>
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

      {/* Buscador de funciones — solo SISTEMA (y futuros ancestros) en la jerarquía tipo_acceso */}
      {puedeBuscar && (
        colapsado ? (
          <button
            onClick={enfocarBusqueda}
            className="mx-auto mt-3 p-2 rounded-lg hover:bg-sidebar-hover text-sidebar-texto-muted hover:text-sidebar-texto transition-colors"
            title="Buscar función"
            aria-label="Buscar función"
          >
            <Search size={18} />
          </button>
        ) : (
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
              <input
                ref={busquedaRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setBusqueda('') }}
                placeholder="Buscar función..."
                className="w-full pl-8 pr-7 py-1.5 text-sm rounded-md bg-gray-200 text-gray-800 placeholder:text-gray-500 border border-gray-300 focus:outline-none focus:border-gray-400"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-300"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )
      )}

      {/* Navegación — 100% dinámica desde BD (usuario.menu).
          Si el usuario no tiene funciones en el grupo/app activo, el sidebar queda vacío. */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-4 overflow-y-auto">
        {menuFiltrado.length === 0 ? (
          !colapsado && usuario?.menu && (
            <div className="px-3 py-2 text-xs text-sidebar-texto-muted">
              {busqueda
                ? `Sin resultados para "${busqueda}"`
                : 'Sin funciones disponibles en este grupo/aplicación.'}
            </div>
          )
        ) : (
          menuFiltrado.map((rol) => (
            <div key={rol.id_rol}>
              {!colapsado && (
                <span className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-texto-muted opacity-60">
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
                  const alias = tr('funciones', 'alias', fn.codigo_funcion, fn.alias)
                  return (
                    <div
                      key={fn.codigo_funcion}
                      onMouseEnter={colapsado ? (e) => mostrarTooltip(e, alias) : undefined}
                      onMouseLeave={colapsado ? ocultarTooltip : undefined}
                    >
                      <Link
                        href={href}
                        className={cn(itemBase, activo ? itemActivo : itemInactivo)}
                      >
                        <Icono size={18} className="shrink-0" />
                        {!colapsado && <span>{alias}</span>}
                      </Link>
                    </div>
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
    {/* Tooltip portal — fuera del aside para escapar del overflow */}
    {tooltip && <TooltipPortal texto={tooltip.texto} rect={tooltip.rect} />}
  </>
  )
}
