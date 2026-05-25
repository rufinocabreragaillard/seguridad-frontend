'use client'

import { MantenedorSecretos } from '@/components/secretos/MantenedorSecretos'
import { secretosSistemaApi } from '@/lib/api'

export default function PaginaSecretosSistema() {
  return (
    <MantenedorSecretos
      namespace="secretsSystem"
      apiClient={secretosSistemaApi}
      excelNombre="secretos-producto"
    />
  )
}
