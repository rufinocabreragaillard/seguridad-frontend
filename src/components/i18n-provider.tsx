'use client'

import { NextIntlClientProvider, IntlErrorCode } from 'next-intl'
import type { AbstractIntlMessages } from 'next-intl'
import { registrarI18nFaltante } from '@/lib/avisos-pagina'

/**
 * Wrapper client-side de `NextIntlClientProvider` que registra en el store
 * de avisos cada traducción estática faltante. El componente `<AvisoPagina />`
 * (incluido en AdminLayout) lee ese store y muestra un banner rojo al usuario.
 *
 * Se envuelve aquí (y no directo en RootLayout) porque `onError` y
 * `getMessageFallback` son funciones cliente, incompatibles con un server
 * component.
 */
export function I18nProvider({
  messages,
  locale,
  children,
}: {
  messages: AbstractIntlMessages
  locale: string
  children: React.ReactNode
}) {
  return (
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
      onError={(error) => {
        // MISSING_MESSAGE lo gestiona getMessageFallback (tiene namespace+key limpios).
        // Otros errores solo se loguean.
        if (error.code !== IntlErrorCode.MISSING_MESSAGE) {
          console.error('[i18n]', error)
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        const ns = namespace ?? '(raíz)'
        registrarI18nFaltante(ns, key, locale)
        // Fallback visible: muestra identificador técnico para que el admin vea
        // exactamente qué clave falta. El banner rojo lo refuerza.
        return `${ns}.${key}`
      }}
    >
      {children}
    </NextIntlClientProvider>
  )
}
