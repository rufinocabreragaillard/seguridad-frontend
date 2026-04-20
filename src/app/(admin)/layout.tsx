'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuth } from '@/context/AuthContext'
import { useTranslations } from 'next-intl'
import { AvisoPagina } from '@/components/ui/aviso-pagina'
import { limpiarAvisos } from '@/lib/avisos-pagina'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('layout')
  const { usuario, cargando, tieneAccesoRuta } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!cargando && !usuario) {
      router.push('/login')
    }
  }, [usuario, cargando, router])

  // Limpiar avisos acumulados al cambiar de pantalla: cada ruta empieza en blanco
  // y solo muestra los problemas que surjan en ella.
  useEffect(() => {
    limpiarAvisos()
  }, [pathname])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fondo">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-4 border-primario border-t-transparent animate-spin" />
          <p className="text-sm text-texto-muted">{t('cargando')}</p>
        </div>
      </div>
    )
  }

  if (!usuario) return null

  const accesoPermitido = tieneAccesoRuta(pathname)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <AvisoPagina />
          {accesoPermitido ? children : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-texto-muted">
              <ShieldAlert className="h-16 w-16 text-red-400" />
              <h2 className="page-heading">{t('sinAcceso')}</h2>
              <p className="text-sm max-w-md text-center">{t('sinAccesoMsg')}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-2 px-4 py-2 text-sm bg-primario text-primario-texto rounded-md hover:bg-primario-hover transition-colors"
              >
                {t('volverAlInicio')}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
