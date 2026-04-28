import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function Tabla({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-borde">
      <table className={cn('w-full text-sm text-left', className)}>{children}</table>
    </div>
  )
}

export function TablaCabecera({ children }: { children: ReactNode }) {
  return <thead className="bg-fondo border-b border-borde">{children}</thead>
}

export function TablaCuerpo({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-borde bg-surface">{children}</tbody>
}

export function TablaFila({ className, children, onClick, onDoubleClick }: {
  className?: string
  children: ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
}) {
  return (
    <tr
      className={cn('hover:bg-primario-muy-claro/40 transition-colors', (onClick || onDoubleClick) && 'cursor-pointer', className)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </tr>
  )
}

export function TablaTh({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <th className={cn('px-4 py-3 text-xs font-semibold text-texto-muted uppercase tracking-wider', className)}>
      {children}
    </th>
  )
}

export function TablaTd({ className, children, colSpan, title, onDoubleClick }: {
  className?: string
  children?: ReactNode
  colSpan?: number
  title?: string
  onDoubleClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
}) {
  return (
    <td
      colSpan={colSpan}
      title={title}
      onDoubleClick={onDoubleClick}
      className={cn('px-4 py-3 text-texto', onDoubleClick && 'cursor-pointer', className)}
    >
      {children}
    </td>
  )
}
