'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, ShieldCheck, Building2, ClipboardList, TrendingUp, Activity } from 'lucide-react'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { usuariosApi, rolesApi, entidadesApi, auditoriaApi } from '@/lib/api'
import type { RegistroAuditoria } from '@/lib/tipos'
import { BotonChat } from '@/components/ui/boton-chat'

interface Estadisticas {
  totalUsuarios: number
  totalRoles: number
  totalEntidades: number
  totalAuditoria: number
}

export default function PaginaDashboard() {
  const t = useTranslations('dashboard')
  const [stats, setStats] = useState<Estadisticas>({
    totalUsuarios: 0,
    totalRoles: 0,
    totalEntidades: 0,
    totalAuditoria: 0,
  })
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([])
  const [cargando, setCargando] = useState(true)

  const tarjetasEstadistica = [
    {
      titulo: t('tarjetaUsuarios'),
      valor: stats.totalUsuarios,
      icono: Users,
      color: 'bg-primario-muy-claro text-primario',
      tendencia: t('tendenciaUsuarios'),
    },
    {
      titulo: t('tarjetaRoles'),
      valor: stats.totalRoles,
      icono: ShieldCheck,
      color: 'bg-secundario-muy-claro text-secundario',
      tendencia: t('tendenciaRoles'),
    },
    {
      titulo: t('tarjetaEntidades'),
      valor: stats.totalEntidades,
      icono: Building2,
      color: 'bg-acento-muy-claro text-acento',
      tendencia: t('tendenciaEntidades'),
    },
    {
      titulo: t('tarjetaAuditoria'),
      valor: stats.totalAuditoria,
      icono: ClipboardList,
      color: 'bg-green-50 text-exito',
      tendencia: t('tendenciaAuditoria'),
    },
  ]

  useEffect(() => {
    const cargar = async () => {
      try {
        const [usuarios, roles, entidades, logs] = await Promise.allSettled([
          usuariosApi.listar(),
          rolesApi.listar(),
          entidadesApi.listar(),
          auditoriaApi.listar({ por_pagina: 8 }),
        ])

        setStats({
          totalUsuarios: usuarios.status === 'fulfilled' ? usuarios.value.length : 0,
          totalRoles: roles.status === 'fulfilled' ? roles.value.length : 0,
          totalEntidades: entidades.status === 'fulfilled' ? entidades.value.length : 0,
          totalAuditoria: logs.status === 'fulfilled' ? logs.value.length : 0,
        })

        if (logs.status === 'fulfilled') {
          setAuditoria(logs.value.slice(0, 8))
        }
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-texto-muted text-sm mt-1">{t('ayuda')}</p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tarjetasEstadistica.map((card) => {
          const Icono = card.icono
          return (
            <Tarjeta key={card.titulo}>
              <TarjetaContenido className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-texto-muted">{card.titulo}</span>
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icono size={16} />
                  </div>
                </div>
                <div>
                  {cargando ? (
                    <div className="h-8 w-16 bg-borde rounded animate-pulse" />
                  ) : (
                    <span className="stat-value text-texto">{card.valor}</span>
                  )}
                  <p className="text-xs text-texto-muted mt-1 flex items-center gap-1">
                    <TrendingUp size={12} />
                    {card.tendencia}
                  </p>
                </div>
              </TarjetaContenido>
            </Tarjeta>
          )
        })}
      </div>

      {/* Accesos rápidos + Auditoría reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Accesos rápidos */}
        <Tarjeta>
          <TarjetaContenido>
            <h3 className="text-sm font-semibold text-texto mb-3 flex items-center gap-2">
              <Activity size={15} className="text-primario" />
              {t('accesosRapidos')}
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { nombre: t('nuevoUsuario'), href: '/usuarios', icono: Users },
                { nombre: t('gestionarRoles'), href: '/roles', icono: ShieldCheck },
                { nombre: t('verEntidades'), href: '/entidades', icono: Building2 },
                { nombre: t('parametros'), href: '/parametros', icono: ClipboardList },
              ].map((acc) => {
                const Icono = acc.icono
                return (
                  <a
                    key={acc.href}
                    href={acc.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors text-sm font-medium"
                  >
                    <Icono size={15} />
                    {acc.nombre}
                  </a>
                )
              })}
            </div>
          </TarjetaContenido>
        </Tarjeta>

        {/* Actividad reciente */}
        <Tarjeta className="lg:col-span-2">
          <TarjetaContenido>
            <h3 className="text-sm font-semibold text-texto mb-3 flex items-center gap-2">
              <ClipboardList size={15} className="text-primario" />
              {t('actividadReciente')}
            </h3>
            {cargando ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-fondo rounded-lg animate-pulse" />
                ))}
              </div>
            ) : auditoria.length === 0 ? (
              <p className="text-sm text-texto-muted text-center py-6">
                {t('sinActividad')}
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-borde">
                {auditoria.map((reg) => (
                  <div key={reg.id_auditoria} className="flex items-center justify-between py-2.5 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Insignia
                        variante={
                          reg.operacion === 'INSERT' ? 'exito' :
                          reg.operacion === 'DELETE' ? 'error' : 'primario'
                        }
                      >
                        {reg.operacion}
                      </Insignia>
                      <div className="min-w-0">
                        <p className="text-sm text-texto font-medium truncate">{reg.tabla_afectada}</p>
                        <p className="text-xs text-texto-muted truncate">{reg.codigo_usuario}</p>
                      </div>
                    </div>
                    <span className="text-xs text-texto-muted shrink-0">
                      {new Date(reg.fecha_hora).toLocaleString('es-CL', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </div>
  )
}
