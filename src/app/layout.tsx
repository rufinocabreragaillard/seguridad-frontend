import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Source_Serif_4, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import { tema } from '@/config/tema.config'
import { I18nProvider } from '@/components/i18n-provider'
import { getLocale, getMessages } from 'next-intl/server'

const jakartaSans = Plus_Jakarta_Sans({ variable: '--font-sans', subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] })
const sourceSerif = Source_Serif_4({ variable: '--font-serif', subsets: ['latin'], weight: ['300', '400', '600', '700'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: tema.app.nombre,
  description: `Panel de administración - ${tema.app.nombre}`,
  icons: { icon: '/logo_serverlm_A.png' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${jakartaSans.variable} ${sourceSerif.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full font-sans">
        <I18nProvider messages={messages} locale={locale}>
          <ToastProvider>
            <AuthProvider>
              <ThemeProvider>{children}</ThemeProvider>
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
