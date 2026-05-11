'use client'

import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Boton } from './boton'

interface PaginadorProps {
  page: number
  limit: number
  total: number
  onChangePage: (page: number) => void
  onChangeLimit?: (limit: number) => void
  cargando?: boolean
  opcionesLimit?: number[]
}

/**
 * Barra de paginación reutilizable para listados grandes.
 *
 * Muestra "Mostrando X–Y de Z", botones primero/anterior/siguiente/último y
 * (opcional) un selector de tamaño de página.
 */
export function Paginador({
  page,
  limit,
  total,
  onChangePage,
  onChangeLimit,
  cargando,
  opcionesLimit = [25, 50, 100, 200],
}: PaginadorProps) {
  const tc = useTranslations('common')
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const desde = total === 0 ? 0 : (page - 1) * limit + 1
  const hasta = Math.min(page * limit, total)

  const ir = (p: number) => {
    const nuevo = Math.max(1, Math.min(totalPages, p))
    if (nuevo !== page) onChangePage(nuevo)
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap py-2">
      <div className="text-sm text-texto-muted">
        {total === 0 ? (
          tc('sinResultados')
        ) : (
          tc('mostrandoDeTotal', { desde, hasta, total })
        )}
      </div>

      <div className="flex items-center gap-2">
        {onChangeLimit && (
          <select
            value={limit}
            onChange={(e) => onChangeLimit(Number(e.target.value))}
            disabled={cargando}
            className="rounded-lg border border-borde bg-surface px-2 py-1 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
          >
            {opcionesLimit.map((n) => (
              <option key={n} value={n}>
                {tc('porPagina', { n })}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <Boton variante="contorno" tamano="sm" onClick={() => ir(1)} disabled={cargando || page === 1}>
            <ChevronsLeft size={14} />
          </Boton>
          <Boton variante="contorno" tamano="sm" onClick={() => ir(page - 1)} disabled={cargando || page === 1}>
            <ChevronLeft size={14} />
          </Boton>

          <span className="px-3 text-sm text-texto-muted">
            {tc('pagina', { pagina: page, total: totalPages })}
          </span>

          <Boton variante="contorno" tamano="sm" onClick={() => ir(page + 1)} disabled={cargando || page >= totalPages}>
            <ChevronRight size={14} />
          </Boton>
          <Boton variante="contorno" tamano="sm" onClick={() => ir(totalPages)} disabled={cargando || page >= totalPages}>
            <ChevronsRight size={14} />
          </Boton>
        </div>
      </div>
    </div>
  )
}
