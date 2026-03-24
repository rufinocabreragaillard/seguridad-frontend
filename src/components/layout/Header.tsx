'use client'

import { useState } from 'react'
import { ChevronDown, Building2, Check, Bell } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Avatar from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

export function Header({ titulo }: { titulo?: string }) {
  const { usuario, cambiarEntidad } = useAuth()
  const [cambiando, setCambiando] = useState(false)

  const handleCambiarEntidad = async (codigoEntidad: string) => {
    if (codigoEntidad === usuario?.entidad_activa) return
    setCambiando(true)
    try {
      await cambiarEntidad(codigoEntidad)
    } finally {
      setCambiando(false)
    }
  }

  const entidadActual = usuario?.entidades?.find(
    (e) => e.codigo_entidad === usuario?.entidad_activa
  )

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="h-16 bg-surface border-b border-borde flex items-center justify-between px-6 shrink-0">
      {/* Título de sección */}
      <h1 className="text-base font-semibold text-texto">{titulo}</h1>

      <div className="flex items-center gap-3">
        {/* Selector de entidad */}
        {usuario && usuario.entidades && usuario.entidades.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borde bg-fondo',
                  'text-sm font-medium text-texto hover:bg-primario-muy-claro hover:border-primario/30',
                  'transition-colors focus:outline-none',
                  cambiando && 'opacity-50 cursor-wait'
                )}
                disabled={cambiando}
              >
                <Building2 size={15} className="text-primario shrink-0" />
                <span className="max-w-[160px] truncate">
                  {entidadActual?.nombre ?? usuario.entidad_activa}
                </span>
                <ChevronDown size={14} className="text-texto-muted shrink-0" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-[200px] bg-surface rounded-xl border border-borde shadow-lg p-1"
              >
                <p className="px-3 py-2 text-xs font-semibold text-texto-muted uppercase tracking-wider">
                  Mis entidades
                </p>
                {usuario.entidades.map((entidad) => (
                  <DropdownMenu.Item
                    key={entidad.codigo_entidad}
                    onSelect={() => handleCambiarEntidad(entidad.codigo_entidad)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer',
                      'hover:bg-primario-muy-claro hover:text-primario outline-none transition-colors',
                      entidad.codigo_entidad === usuario.entidad_activa
                        ? 'text-primario font-medium bg-primario-muy-claro'
                        : 'text-texto'
                    )}
                  >
                    <Check
                      size={14}
                      className={cn(
                        'shrink-0',
                        entidad.codigo_entidad === usuario.entidad_activa
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{entidad.nombre}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}

        {/* Notificaciones (placeholder) */}
        <button className="p-2 rounded-lg hover:bg-fondo text-texto-muted hover:text-texto transition-colors relative">
          <Bell size={18} />
        </button>

        {/* Avatar del usuario */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-fondo transition-colors focus:outline-none">
              <Avatar.Root className="h-8 w-8 rounded-full bg-secundario flex items-center justify-center shrink-0">
                <Avatar.Fallback className="text-white text-xs font-semibold">{iniciales}</Avatar.Fallback>
              </Avatar.Root>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-texto leading-none truncate max-w-[120px]">
                  {usuario?.nombre}
                </p>
                <p className="text-[11px] text-texto-muted truncate max-w-[120px]">
                  {usuario?.rol_principal}
                </p>
              </div>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-[180px] bg-surface rounded-xl border border-borde shadow-lg p-1"
            >
              <div className="px-3 py-2 border-b border-borde mb-1">
                <p className="text-sm font-medium text-texto truncate">{usuario?.nombre}</p>
                <p className="text-xs text-texto-muted truncate">{usuario?.codigo_usuario}</p>
              </div>
              <DropdownMenu.Item
                onSelect={() => window.location.href = '/parametros#mi-cuenta'}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-texto hover:bg-fondo cursor-pointer outline-none"
              >
                Mi cuenta
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
