'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { setMensajesAbrirDocumento } from '@/lib/abrir-documento'

/**
 * Sincroniza los mensajes de `lib/abrir-documento.ts` con las traducciones
 * activas del locale. Como esa librería no es componente React, no puede usar
 * `useTranslations` directamente — este hook le inyecta los strings traducidos.
 *
 * Montar una sola vez en el layout admin (o en cualquier provider raíz).
 */
export function useMensajesAbrirDocumento(): void {
  const t = useTranslations('abrirDocumento')

  useEffect(() => {
    setMensajesAbrirDocumento({
      selectCarpetaRaiz: t('selectCarpetaRaiz'),
      permisoCaducado: t('permisoCaducado'),
      noSeEncontroArchivo: t('noSeEncontroArchivo'),
      navegadorNoSoporta: t('navegadorNoSoporta'),
      permisoDenegado: t('permisoDenegado'),
      noSeEncontroArchivoEn: (ubicacion) => t('noSeEncontroArchivoEn', { ubicacion }),
      sinUbicacionRegistrada: t('sinUbicacionRegistrada'),
      errorAlAbrir: (error) => t('errorAlAbrir', { error }),
      errorAlDescargar: (error) => t('errorAlDescargar', { error }),
      noHayCarpetaRaiz: t('noHayCarpetaRaiz'),
      noSeEncontroPath: (ubicacion) => t('noSeEncontroPath', { ubicacion }),
      abriendo: t('abriendo'),
      cargandoDocumento: t('cargandoDocumento'),
      noPreviewBrowser: t('noPreviewBrowser'),
      descargarArchivo: t('descargarArchivo'),
    })
  }, [t])
}
