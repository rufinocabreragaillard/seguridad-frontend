'use client'

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
  return (
    <div className="flex items-center justify-between pt-2 gap-2">
      <div className="flex gap-2">{botonesIzquierda}</div>
      <div className="flex gap-3">
        <Boton variante="primario" onClick={onGuardar} cargando={cargando}>
          {editando ? 'Grabar' : 'Crear'}
        </Boton>
        <Boton variante="secundario" onClick={onGuardarYSalir} cargando={cargando}>
          {editando ? 'Grabar y Salir' : 'Crear y Salir'}
        </Boton>
        <Boton variante="contorno" onClick={onCerrar}>
          Salir
        </Boton>
      </div>
    </div>
  )
}
