'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface ModalProps {
  abierto: boolean
  alCerrar: () => void
  titulo: string
  descripcion?: string
  children: ReactNode
  className?: string
}

export function Modal({ abierto, alCerrar, titulo, descripcion, children, className }: ModalProps) {
  return (
    <Dialog.Root open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'bg-surface rounded-xl shadow-xl border border-borde',
            'w-full max-w-lg max-h-[90vh] overflow-y-auto',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-borde">
            <div>
              <Dialog.Title className="text-base font-semibold text-texto">{titulo}</Dialog.Title>
              {descripcion && (
                <Dialog.Description className="text-sm text-texto-muted mt-0.5">
                  {descripcion}
                </Dialog.Description>
              )}
            </div>
            <button
              onClick={alCerrar}
              className="p-1.5 rounded-lg hover:bg-fondo text-texto-muted hover:text-texto transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
