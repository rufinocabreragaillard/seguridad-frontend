'use client'

import { useTranslations } from 'next-intl'
import { Boton } from '@/components/ui/boton'

interface PieBotonesModalProps {
  editando: boolean
  onGuardar: () => void
  onGuardarYSalir: () => void
  onCerrar: () => void
  cargando?: boolean
  botonesIzquierda?: React.ReactNode
}

export function PieBotonesModal({
  editando,
  onGuardar,
  onGuardarYSalir,
  onCerrar,
  cargando,
  botonesIzquierda,
}: PieBotonesModalProps) {
  const tc = useTranslations('common')
  return (
    <div className="flex items-center justify-between pt-2 gap-2">
      <div className="flex gap-2">{botonesIzquierda}</div>
      <div className="flex gap-3">
        <Boton variante="primario" onClick={onGuardar} cargando={cargando}>
          {editando ? tc('grabar') : tc('crear')}
        </Boton>
        <Boton variante="secundario" onClick={onGuardarYSalir} cargando={cargando}>
          {editando ? tc('grabarYSalir') : tc('crearYSalir')}
        </Boton>
        <Boton variante="contorno" onClick={onCerrar}>
          {tc('salir')}
        </Boton>
      </div>
    </div>
  )
}
