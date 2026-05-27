'use client'

import { useEffect, useState, useCallback } from 'react'
import Script from 'next/script'
import { useTranslations } from 'next-intl'
import { CreditCard, Check, ExternalLink, Loader2 } from 'lucide-react'

import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { useFuncionActual } from '@/hooks/useFuncionActual'
import { useToast } from '@/context/ToastContext'
import { pagosApi, type EstadoPagos, type PlanVendible } from '@/lib/api'

// Paddle.js se carga vía <Script>; el tipo global mínimo que usamos.
declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void }
      Initialize: (opts: { token: string }) => void
      Checkout: { open: (opts: Record<string, unknown>) => void }
    }
  }
}

const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV ?? 'sandbox'

// Mapeo estado de suscripción → clave i18n.
const ESTADO_KEY: Record<string, string> = {
  trial: 'estadoTrial',
  activa: 'estadoActiva',
  pago_pendiente: 'estadoPagoPendiente',
  morosa: 'estadoMorosa',
  cancelada: 'estadoCancelada',
  expirada: 'estadoExpirada',
}

// ⚠️ COPIA MANUAL de las features del sitio comercial (serverlm-sitio:
// frontend/content/planes.mjs). Mientras no exista el puente sitio→app,
// esta lista debe mantenerse SINCRONIZADA A MANO con planes.mjs cada vez
// que cambien las features. Solo features cualitativas: los límites
// (tokens/documentos) ya salen de los campos numéricos de la BD.
// Las entradas son claves i18n del namespace myAccount.
const FEATURES_PLAN: Record<string, string[]> = {
  PERSONAL: ['featPersonalChat', 'featPersonalBusqueda', 'featPersonalFormatos', 'featPersonalHistorial'],
  TEAM: ['featTeamTodoProfessional', 'featTeamControlAcceso', 'featTeamCadaMiembro', 'featTeamAdmin', 'featTeamAuditoria'],
  BUSINESS: [
    'featBusinessTodoTeam',
    'featBusinessClientLm',
    'featBusinessEleccionIa',
    'featBusinessPermisos',
    'featBusinessBranding',
    'featBusinessApi',
    'featBusinessSoporte',
  ],
  ENTERPRISE: [
    'featEnterpriseTodoBusiness',
    'featEnterpriseMultiEntidad',
    'featEnterpriseAdminCentral',
    'featEnterpriseBdPropia',
    'featEnterpriseSoporteSla',
  ],
  CORPORATE: ['featCorporateTodoEnterprise', 'featCorporateArquitectura', 'featCorporateIntegraciones', 'featCorporateAcuerdo'],
}

// Plan recomendado: se resalta con la tarjeta oscura (espejo del sitio
// comercial serverlm.ai, donde Business lleva el badge "Recomendado").
const PLAN_RESALTADO = 'BUSINESS'

// Corporate NO es self-service: el backend lo excluye del catálogo (no tiene
// price_id en Paddle). Se renderiza como tarjeta estática "a medida" con
// botón "Contactarnos", igual que en el sitio comercial.
const CORREO_VENTAS = 'rufinocabreragaillard@gmail.com'

export default function PaginaMiCuenta() {
  const funcion = useFuncionActual()
  const t = useTranslations('myAccount')
  const { error: toastError } = useToast()

  const [estado, setEstado] = useState<EstadoPagos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [paddleListo, setPaddleListo] = useState(false)
  const [procesando, setProcesando] = useState<string | null>(null)

  // ¿El usuario puede contratar? El backend lo decide por tipo_acceso del grupo (§8.b).
  const esAdmin = estado?.es_admin ?? false

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setEstado(await pagosApi.estado())
    } catch {
      toastError(t('errorCargarEstado'))
    } finally {
      setCargando(false)
    }
  }, [toastError, t])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Inicializa Paddle.js una vez cargado el script.
  const initPaddle = useCallback(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    if (!window.Paddle || !token) return
    window.Paddle.Environment.set(PADDLE_ENV)
    window.Paddle.Initialize({ token })
    setPaddleListo(true)
  }, [])

  const contratar = async (plan: PlanVendible) => {
    if (!esAdmin) return
    setProcesando(plan.codigo_plan)
    try {
      const datos = await pagosApi.crearCheckout(plan.codigo_plan)
      if (datos.estilo === 'redirect' && datos.url) {
        window.location.href = datos.url
        return
      }
      // Paddle overlay
      if (!window.Paddle || !paddleListo || !datos.price_id) {
        toastError(t('errorCheckoutNoListo'))
        return
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: datos.price_id, quantity: 1 }],
        customData: datos.custom_data,
        settings: { displayMode: 'overlay', theme: 'light' },
      })
    } catch {
      toastError(t('errorIniciarCheckout'))
    } finally {
      setProcesando(null)
    }
  }

  const gestionar = async () => {
    setProcesando('__portal__')
    try {
      const { url } = await pagosApi.abrirPortal()
      window.open(url, '_blank')
    } catch {
      toastError(t('errorAbrirPortal'))
    } finally {
      setProcesando(null)
    }
  }

  const sus = estado?.suscripcion
  const planActual = sus?.codigo_plan

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat />

      {/* Paddle.js */}
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={initPaddle}
      />

      <div>
        <h2 className="page-heading">{funcion?.nombre ?? t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{funcion?.ayuda ?? t('subtitulo')}</p>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-lg border border-borde animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Suscripción actual */}
          <section className="rounded-lg border border-borde bg-surface p-5">
            <h3 className="section-heading flex items-center gap-2">
              <CreditCard size={18} /> {t('suscripcionActual')}
            </h3>
            {sus ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-texto-muted">{t('labelPlan')}</span>{' '}
                  <span className="font-medium text-texto">{planActual ?? '—'}</span>
                </div>
                <div>
                  <span className="text-texto-muted">{t('labelEstado')}</span>{' '}
                  <span className="font-medium text-texto">
                    {ESTADO_KEY[sus.estado] ? t(ESTADO_KEY[sus.estado]) : sus.estado}
                  </span>
                </div>
                {sus.fecha_fin_periodo && (
                  <div>
                    <span className="text-texto-muted">{t('labelRenueva')}</span>{' '}
                    <span className="font-medium text-texto">
                      {new Date(sus.fecha_fin_periodo).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {esAdmin && (
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={gestionar}
                    disabled={procesando === '__portal__'}
                    className="ml-auto"
                  >
                    {procesando === '__portal__' ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                    {t('gestionarSuscripcion')}
                  </Boton>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-texto-muted">{t('sinSuscripcion')}</p>
            )}
          </section>

          {/* Planes disponibles */}
          <section className="flex flex-col gap-3">
            <h3 className="section-heading">{t('planesDisponibles')}</h3>
            {!esAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 text-sm">
                {t('soloAdminContrata')}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {estado?.planes.map((plan) => {
                const esActual = plan.codigo_plan === planActual
                const destacado = plan.codigo_plan === PLAN_RESALTADO
                return (
                  <div
                    key={plan.codigo_plan}
                    className={`relative rounded-lg border p-5 flex flex-col gap-3 ${
                      destacado
                        ? 'border-primario bg-primario text-white shadow-lg lg:scale-[1.03]'
                        : esActual
                          ? 'border-primario bg-primario-muy-claro/40'
                          : 'border-borde bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className={`font-semibold ${destacado ? 'text-white' : 'text-texto'}`}>
                        {plan.nombre}
                      </h4>
                      {esActual ? (
                        <span
                          className={`text-xs flex items-center gap-1 font-medium ${
                            destacado ? 'text-white' : 'text-primario'
                          }`}
                        >
                          <Check size={14} /> {t('badgeActual')}
                        </span>
                      ) : destacado ? (
                        <span className="text-[10px] uppercase tracking-[0.15em] bg-white/20 text-white px-2 py-1 rounded-full">
                          {t('badgeRecomendado')}
                        </span>
                      ) : null}
                    </div>
                    <div className={`text-2xl font-bold ${destacado ? 'text-white' : 'text-texto'}`}>
                      ${plan.precio_mensual_usd}
                      <span
                        className={`text-sm font-normal ${destacado ? 'text-white/70' : 'text-texto-muted'}`}
                      >
                        {' '}
                        {t('porMes')}
                      </span>
                    </div>
                    <ul
                      className={`text-sm flex flex-col gap-1 ${
                        destacado ? 'text-white/90' : 'text-texto-muted'
                      }`}
                    >
                      {plan.documentos_maximos != null && (
                        <li>{t('unidadDocumentos', { n: plan.documentos_maximos.toLocaleString() })}</li>
                      )}
                      {plan.tokens_mensuales != null && (
                        <li>{t('unidadTokens', { n: plan.tokens_mensuales.toLocaleString() })}</li>
                      )}
                      {plan.usuarios_externos_maximos != null && (
                        <li>{t('unidadUsuariosExternos', { n: plan.usuarios_externos_maximos.toLocaleString() })}</li>
                      )}
                      {(FEATURES_PLAN[plan.codigo_plan] ?? []).map((clave) => (
                        <li key={clave} className="flex gap-2">
                          <Check
                            size={14}
                            className={`mt-0.5 flex-none ${destacado ? 'text-white' : 'text-primario'}`}
                          />
                          <span>{t(clave)}</span>
                        </li>
                      ))}
                    </ul>
                    <Boton
                      variante={destacado ? 'contorno' : esActual ? 'contorno' : 'primario'}
                      onClick={() => contratar(plan)}
                      disabled={!esAdmin || esActual || procesando === plan.codigo_plan}
                      className={`mt-auto ${
                        destacado && !esActual
                          ? 'bg-white text-primario border-white hover:bg-white/90'
                          : ''
                      }`}
                    >
                      {procesando === plan.codigo_plan ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : null}
                      {esActual ? t('planActual') : t('contratar')}
                    </Boton>
                  </div>
                )
              })}

              {/* Corporate — plan a medida (no self-service). Espejo del sitio
                  comercial: precio "A medida" + botón "Contactarnos". */}
              <div className="relative rounded-lg border border-borde bg-surface p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-texto">{t('corporateTitulo')}</h4>
                </div>
                <div className="text-2xl font-bold text-texto">{t('corporatePrecio')}</div>
                <ul className="text-sm text-texto-muted flex flex-col gap-1">
                  <li>{t('corporateTokens')}</li>
                  <li>{t('corporateDocumentos')}</li>
                  {FEATURES_PLAN.CORPORATE.map((clave) => (
                    <li key={clave} className="flex gap-2">
                      <Check size={14} className="mt-0.5 flex-none text-primario" />
                      <span>{t(clave)}</span>
                    </li>
                  ))}
                </ul>
                <Boton
                  variante="contorno"
                  className="mt-auto"
                  onClick={() =>
                    window.open(
                      `mailto:${CORREO_VENTAS}?subject=${encodeURIComponent(t('corporateAsunto'))}`,
                      '_self'
                    )
                  }
                >
                  <ExternalLink size={15} /> {t('contactarnos')}
                </Boton>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
