'use client'

import { useTranslations } from 'next-intl'
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
  className?: string
}

export function ModalConfirmar({
  abierto,
  alCerrar,
  alConfirmar,
  titulo,
  mensaje,
  textoConfirmar,
  textoCancelar,
  variante = 'peligro',
  cargando = false,
  className,
}: ModalConfirmarProps) {
  const tc = useTranslations('common')
  const tituloFinal = titulo ?? tc('confirmarAccion')
  const textoConfirmarFinal = textoConfirmar ?? tc('confirmar')
  const textoCancelarFinal = textoCancelar ?? tc('cancelar')
  return (
    <Modal abierto={abierto} alCerrar={alCerrar} titulo={tituloFinal} className={className}>
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
          <Boton variante="contorno" onClick={alCerrar}>
            {textoCancelarFinal}
          </Boton>
          <Boton variante={variante} onClick={alConfirmar} cargando={cargando}>
            {textoConfirmarFinal}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
