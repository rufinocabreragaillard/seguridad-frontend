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
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { tema } from '@/config/tema.config'

interface NavItem {
  nombre: string
  href: string
  icono: typeof LayoutDashboard
  requiereSuperAdmin?: boolean
  requiereFuncion?: string | string[]
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
      { nombre: 'Usuarios', href: '/usuarios', icono: Users, requiereFuncion: 'GEST_USUARIOS' },
      { nombre: 'Auditoría', href: '/auditoria', icono: ClipboardList, requiereFuncion: 'VER_AUDITORIA' },
    ],
  },
  {
    titulo: 'Organización',
    items: [
      { nombre: 'Parámetros por Nivel', href: '/parametros', icono: SlidersHorizontal },
      { nombre: 'Entidades, Áreas y Roles', href: '/entidades', icono: Building2, requiereFuncion: ['GEST_ENTIDADES', 'GEST_AREAS', 'GEST_ROLES'] },
      { nombre: 'Grupos', href: '/grupos', icono: Layers, requiereSuperAdmin: true },
    ],
  },
  {
    titulo: 'Básicos',
    items: [
      { nombre: 'Aplicaciones y Funciones', href: '/aplicaciones', icono: AppWindow, requiereFuncion: ['GEST_APLICACIONES', 'GEST_FUNCIONES'] },
      { nombre: 'Datos Básicos', href: '/datos-basicos', icono: Database, requiereSuperAdmin: true },
      { nombre: 'Parámetros Generales', href: '/parametros-generales', icono: SlidersHorizontal, requiereFuncion: 'GEST_PARAM_GEN' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { esSuperAdmin, tieneFuncion } = useAuth()
  const [colapsado, setColapsado] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col h-full transition-all duration-300',
        'bg-sidebar text-sidebar-texto',
        colapsado ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo y botón colapsar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 min-h-[64px]">
        {!colapsado && (
          <Link href="/dashboard" className="flex items-center">
            <Image
              src={tema.logo.src}
              alt={tema.logo.alt}
              width={tema.logo.ancho}
              height={tema.logo.alto}
              className="object-contain"
              onError={(e) => {
                // Fallback si no existe el logo
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
            {/* Fallback texto si no hay logo */}
            <span className="text-white font-bold text-lg ml-2 hidden">{tema.app.nombreCorto}</span>
          </Link>
        )}
        <button
          onClick={() => setColapsado(!colapsado)}
          className="p-1.5 rounded-lg hover:bg-sidebar-hover text-sidebar-texto transition-colors ml-auto"
          title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
        >
          {colapsado ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-4 overflow-y-auto">
        {navegacion.map((grupo) => {
          const itemsVisibles = grupo.items.filter((item) => {
            if (item.requiereSuperAdmin && !esSuperAdmin()) return false
            if (item.requiereFuncion) {
              const fns = Array.isArray(item.requiereFuncion) ? item.requiereFuncion : [item.requiereFuncion]
              if (!fns.some((f) => tieneFuncion(f))) return false
            }
            return true
          })
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
        })}
      </nav>

      {/* Espacio inferior */}
      <div className="px-2 py-4 border-t border-white/10" />
    </aside>
  )
}
