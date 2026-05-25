'use client'

import { MantenedorSecretos } from '@/components/secretos/MantenedorSecretos'
import { secretosApi } from '@/lib/api'

export default function PaginaSecretos() {
  return (
    <MantenedorSecretos
      namespace="secrets"
      apiClient={secretosApi}
      excelNombre="secretos-grupo"
    />
  )
}
