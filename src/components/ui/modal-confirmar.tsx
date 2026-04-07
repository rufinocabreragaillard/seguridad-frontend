'use client'

import { Modal } from './modal'
import { Boton } from './boton'
import { AlertTriangle } from 'lucide-react'

interface ModalConfirmarProps {
  abierto: boolean
  alCerrar: () => void
  alConfirmar: () => void
  titulo?: string
  mensaje: string
  textoConfirmar?: string
  textoCancelar?: string
  variante?: 'peligro' | 'primario'
  cargando?: boolean
}

export function ModalConfirmar({
  abierto,
  alCerrar,
  alConfirmar,
  titulo = 'Confirmar acción',
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  variante = 'peligro',
  cargando = false,
}: ModalConfirmarProps) {
  return (
    <Modal abierto={abierto} alCerrar={alCerrar} titulo={titulo}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 items-start">
          {variante === 'peligro' && (
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-error" />
            </div>
          )}
          <p className="text-sm text-texto-muted pt-2 whitespace-pre-line">{mensaje}</p>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Boton variante="contorno" onClick={alCerrar} disabled={cargando}>
            {textoCancelar}
          </Boton>
          <Boton variante={variante} onClick={alConfirmar} cargando={cargando}>
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
