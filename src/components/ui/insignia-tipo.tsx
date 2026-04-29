'use client'

/**
 * InsigniaTipo — Badge traducido para el campo tipo_acceso.
 *
 * Encapsula la combinación varianteTipo() + etiquetaTipo() que antes
 * estaba hardcodeada en español en cada página. Usa useTranslations
 * internamente para que el texto cambie según el locale del usuario.
 *
 * Uso: <InsigniaTipo tipo={item.tipo_acceso} />
 */
import { useTranslations } from 'next-intl'
import { Insignia } from '@/components/ui/insignia'
import { varianteTipo, normalizarTipo } from '@/lib/tipo-elemento'

interface InsigniaTipoProps {
  tipo?: string | null
  className?: string
}

export function InsigniaTipo({ tipo, className }: InsigniaTipoProps) {
  const t = useTranslations('tipoElemento')
  const normalizado = normalizarTipo(tipo)
  return (
    <Insignia variante={varianteTipo(tipo)} className={className}>
      {t(normalizado)}
    </Insignia>
  )
}
