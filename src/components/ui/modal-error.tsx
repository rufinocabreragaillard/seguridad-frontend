'use client'

import { AlertTriangle } from 'lucide-react'
import { Modal } from './modal'
import { Boton } from './boton'

interface ModalErrorProps {
  abierto: boolean
  alCerrar: () => void
  titulo?: string
  mensaje: string
  /** Texto técnico opcional (stack, request id, payload). Se muestra colapsado. */
  detalle?: string | null
  textoBoton?: string
}

/**
 * Modal estándar para mostrar errores al usuario. Reemplaza `window.alert(...)`
 * en flujos donde el error necesita más contexto que un banner global.
 *
 * El interceptor de axios (`src/lib/api.ts`) ya entrega un `Error` con mensaje
 * rico (mensaje_usuario + sugerencia + referencia). Pasar `mensaje = e.message`
 * suele bastar; usar `detalle` solo para info técnica adicional (stack, raw).
 */
export function ModalError({
  abierto,
  alCerrar,
  titulo = 'Ocurrió un error',
  mensaje,
  detalle,
  textoBoton = 'Aceptar',
}: ModalErrorProps) {
  return (
    <Modal abierto={abierto} alCerrar={alCerrar} titulo={titulo}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 mt-0.5 flex-shrink-0 text-red-600" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-texto whitespace-pre-line break-words">
            {mensaje}
          </p>
          {detalle && (
            <details className="mt-3">
              <summary className="text-xs text-texto-muted cursor-pointer hover:text-texto">
                Detalle técnico
              </summary>
              <pre className="mt-2 text-[11px] font-mono text-texto-muted bg-fondo rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                {detalle}
              </pre>
            </details>
          )}
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Boton variante="primario" onClick={alCerrar}>
          {textoBoton}
        </Boton>
      </div>
    </Modal>
  )
}
