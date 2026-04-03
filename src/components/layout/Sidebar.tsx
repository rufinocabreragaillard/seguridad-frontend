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
  Menu,
  X,
  MessageSquare,
  ListChecks,
} from 'lucide-react'
import { useState } from 'react'
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

  // Determinar si usar menu dinamico o fallback
  const menuDinamico = usuario?.menu && usuario.menu.length > 0

  return (
    <aside
      className={cn(
        'flex flex-col h-full transition-all duration-300',
        'bg-sidebar text-sidebar-texto',
        colapsado ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo y boton colapsar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 min-h-[64px]">
        {!colapsado && (
          <Link href="/dashboard" className="flex items-center">
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
            <span className="text-white font-bold text-lg ml-2 hidden">{appNombreCorto}</span>
          </Link>
        )}
        <button
          onClick={() => setColapsado(!colapsado)}
          className="p-1.5 rounded-lg hover:bg-sidebar-hover text-sidebar-texto transition-colors ml-auto"
          title={colapsado ? 'Expandir menu' : 'Colapsar menu'}
        >
          {colapsado ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Navegacion */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-4 overflow-y-auto">
        {menuDinamico ? (
          /* Menu dinamico: roles como secciones, funciones como items */
          usuario!.menu!.map((rol) => (
            <div key={rol.codigo_rol}>
              {!colapsado && (
                <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-texto-muted">
                  {rol.alias}
                </span>
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
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
                        activo
                          ? 'bg-sidebar-activo text-white'
                          : 'text-sidebar-texto-muted hover:bg-sidebar-hover hover:text-white'
                      )}
                      title={colapsado ? fn.alias : undefined}
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
          /* Fallback: menu estatico hardcoded */
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
                <div className="flex flex-col gap-1 mt-1">
                  {itemsVisibles.map((item) => {
                    const activo = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icono = item.icono
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
                          activo
                            ? 'bg-sidebar-activo text-white'
                            : 'text-sidebar-texto-muted hover:bg-sidebar-hover hover:text-white'
                        )}
                        title={colapsado ? item.nombre : undefined}
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

      {/* Espacio inferior */}
      <div className="px-2 py-4 border-t border-white/10" />
    </aside>
  )
}
