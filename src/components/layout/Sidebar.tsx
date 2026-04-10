'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  SlidersHorizontal,
  ClipboardList,
  Database,
  AppWindow,
  MessageSquare,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useTema } from '@/context/ThemeContext'
import { obtenerIcono } from '@/lib/icon-map'

interface NavItem {
  nombre: string
  href: string
  icono: typeof LayoutDashboard
  requiereSuperAdmin?: boolean
}

interface NavGrupo {
  titulo: string
  items: NavItem[]
}

const navegacion: NavGrupo[] = [
  {
    titulo: 'Operación',
    items: [
      { nombre: 'Dashboard', href: '/dashboard', icono: LayoutDashboard },
      { nombre: 'Usuarios', href: '/usuarios', icono: Users },
      { nombre: 'Auditoría', href: '/auditoria', icono: ClipboardList },
    ],
  },
  {
    titulo: 'Organización',
    items: [
      { nombre: 'Parámetros por Nivel', href: '/parametros', icono: SlidersHorizontal },
      { nombre: 'Entidades, Áreas y Roles', href: '/entidades', icono: Building2 },
      { nombre: 'Grupos', href: '/grupos', icono: Layers },
    ],
  },
  {
    titulo: 'Compromisos',
    items: [
      { nombre: 'Conversaciones', href: '/compromisos/conversaciones', icono: MessageSquare },
      { nombre: 'Compromisos', href: '/compromisos/compromisos', icono: ListChecks },
      { nombre: 'Datos Básicos', href: '/compromisos/datos-basicos', icono: Database },
    ],
  },
  {
    titulo: 'Básicos',
    items: [
      { nombre: 'Aplicaciones y Funciones', href: '/aplicaciones', icono: AppWindow },
      { nombre: 'Datos Básicos', href: '/datos-basicos', icono: Database },
      { nombre: 'Parámetros Generales', href: '/parametros-generales', icono: SlidersHorizontal },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { esSuperAdmin, usuario } = useAuth()
  const { logo, appNombreCorto } = useTema()
  const [colapsado, setColapsado] = useState(false)

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

  const menuDinamico = menuFiltrado.length > 0

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
                target.style.display = 'none'
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

      {/* Navegación */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-4 overflow-y-auto">
        {menuDinamico ? (
          menuFiltrado.map((rol) => (
            <div key={rol.id_rol}>
              {!colapsado && (
                <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-texto-muted">
                  {rol.alias}
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
                      title={fn.alias}
                    >
                      <Icono size={18} className="shrink-0" />
                      {!colapsado && <span>{fn.alias}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          navegacion.map((grupo) => {
            const itemsVisibles = grupo.items.filter((item) => !item.requiereSuperAdmin || esSuperAdmin())
            if (itemsVisibles.length === 0) return null
            return (
              <div key={grupo.titulo}>
                {!colapsado && (
                  <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-texto-muted">
                    {grupo.titulo}
                  </span>
                )}
                {colapsado && (
                  <div className="w-6 mx-auto border-t border-sidebar-texto/40 mb-1" />
                )}
                <div className="flex flex-col gap-1 mt-1">
                  {itemsVisibles.map((item) => {
                    const activo = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icono = item.icono
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(itemBase, activo ? itemActivo : itemInactivo)}
                        title={item.nombre}
                      >
                        <Icono size={18} className="shrink-0" />
                        {!colapsado && <span>{item.nombre}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </nav>

      {/* Pie */}
      <div className="px-2 py-4 border-t border-sidebar-texto/40" />
    </aside>
  )
}
