'use client'

import { useEffect, useState, useCallback } from 'react'
import Script from 'next/script'
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

const ESTADO_LABEL: Record<string, string> = {
  trial: 'Periodo de prueba',
  activa: 'Activa',
  pago_pendiente: 'Pago pendiente',
  morosa: 'Pago vencido',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
}

// ⚠️ COPIA MANUAL de las features del sitio comercial (serverlm-sitio:
// frontend/content/planes.mjs). Mientras no exista el puente sitio→app,
// esta lista debe mantenerse SINCRONIZADA A MANO con planes.mjs cada vez
// que cambien las features. Solo features cualitativas: los límites
// (tokens/documentos) ya salen de los campos numéricos de la BD.
const FEATURES_PLAN: Record<string, string[]> = {
  PERSONAL: [
    'Chat ilimitado con tus documentos',
    'Búsqueda semántica vectorial',
    'Procesamiento PDF, Word, Excel',
    'Historial de conversaciones',
  ],
  TEAM: [
    'Todo lo del plan Professional',
    'Control de acceso por área o cargo',
    'Cada miembro ve sólo su área',
    'Administrador del equipo',
    'Auditoría de accesos',
  ],
  BUSINESS: [
    'Todo lo del plan Team',
    'Client LM: la indexación no sale de tu red',
    'Elección de IA: Claude, GPT, Gemini, open source',
    'Permisos granulares por rol, función y cargo',
    'Branding propio (color, logo, nombre)',
    'API de integración con sistemas internos',
    'Soporte prioritario',
  ],
  ENTERPRISE: [
    'Todo lo del plan Business',
    'Multi-entidad para holdings',
    'Administración centralizada',
    'Espacio de BD propio (BYO infrastructure)',
    'Soporte dedicado y SLA garantizado',
  ],
  CORPORATE: [
    'Todo lo del plan Enterprise',
    'Arquitectura y despliegue a medida',
    'Integraciones y modelos a pedido',
    'Acuerdo comercial y SLA personalizados',
  ],
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
      toastError('No se pudo cargar el estado de la suscripción')
    } finally {
      setCargando(false)
    }
  }, [toastError])

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
        toastError('El checkout no está listo, intenta de nuevo en unos segundos')
        return
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: datos.price_id, quantity: 1 }],
        customData: datos.custom_data,
        settings: { displayMode: 'overlay', theme: 'light' },
      })
    } catch {
      toastError('No se pudo iniciar el checkout')
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
      toastError('No se pudo abrir el portal de gestión')
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
        <h2 className="page-heading">{funcion?.nombre ?? 'Mi Cuenta'}</h2>
        {(funcion?.ayuda || true) && (
          <p className="text-sm text-texto-muted mt-1">
            {funcion?.ayuda ?? 'Gestiona el plan y la suscripción de tu grupo.'}
          </p>
        )}
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
              <CreditCard size={18} /> Suscripción actual
            </h3>
            {sus ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-texto-muted">Plan:</span>{' '}
                  <span className="font-medium text-texto">{planActual ?? '—'}</span>
                </div>
                <div>
                  <span className="text-texto-muted">Estado:</span>{' '}
                  <span className="font-medium text-texto">{ESTADO_LABEL[sus.estado] ?? sus.estado}</span>
                </div>
                {sus.fecha_fin_periodo && (
                  <div>
                    <span className="text-texto-muted">Renueva:</span>{' '}
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
                    Gestionar suscripción
                  </Boton>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-texto-muted">
                Tu grupo aún no tiene una suscripción activa. Elige un plan para comenzar.
              </p>
            )}
          </section>

          {/* Planes disponibles */}
          <section className="flex flex-col gap-3">
            <h3 className="section-heading">Planes disponibles</h3>
            {!esAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 text-sm">
                Solo el administrador del grupo puede contratar o cambiar el plan.
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
                          <Check size={14} /> Actual
                        </span>
                      ) : destacado ? (
                        <span className="text-[10px] uppercase tracking-[0.15em] bg-white/20 text-white px-2 py-1 rounded-full">
                          Recomendado
                        </span>
                      ) : null}
                    </div>
                    <div className={`text-2xl font-bold ${destacado ? 'text-white' : 'text-texto'}`}>
                      ${plan.precio_mensual_usd}
                      <span
                        className={`text-sm font-normal ${destacado ? 'text-white/70' : 'text-texto-muted'}`}
                      >
                        {' '}
                        /mes
                      </span>
                    </div>
                    <ul
                      className={`text-sm flex flex-col gap-1 ${
                        destacado ? 'text-white/90' : 'text-texto-muted'
                      }`}
                    >
                      {plan.documentos_maximos != null && (
                        <li>{plan.documentos_maximos.toLocaleString()} documentos</li>
                      )}
                      {plan.tokens_mensuales != null && (
                        <li>{plan.tokens_mensuales.toLocaleString()} tokens/mes</li>
                      )}
                      {plan.usuarios_externos_maximos != null && (
                        <li>{plan.usuarios_externos_maximos.toLocaleString()} usuarios externos</li>
                      )}
                      {(FEATURES_PLAN[plan.codigo_plan] ?? []).map((f) => (
                        <li key={f} className="flex gap-2">
                          <Check
                            size={14}
                            className={`mt-0.5 flex-none ${destacado ? 'text-white' : 'text-primario'}`}
                          />
                          <span>{f}</span>
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
                      {esActual ? 'Plan actual' : 'Contratar'}
                    </Boton>
                  </div>
                )
              })}

              {/* Corporate — plan a medida (no self-service). Espejo del sitio
                  comercial: precio "A medida" + botón "Contactarnos". */}
              <div className="relative rounded-lg border border-borde bg-surface p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-texto">Corporate</h4>
                </div>
                <div className="text-2xl font-bold text-texto">A medida</div>
                <ul className="text-sm text-texto-muted flex flex-col gap-1">
                  <li>Tokens y capacidad a medida</li>
                  <li>Volumen de documentos sin límite definido</li>
                  {FEATURES_PLAN.CORPORATE.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check size={14} className="mt-0.5 flex-none text-primario" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:${CORREO_VENTAS}?subject=${encodeURIComponent('Consulta plan Corporate — Server LM')}`}
                  className="mt-auto inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors px-4 py-2 text-sm border border-borde bg-surface text-texto hover:bg-fondo"
                >
                  <ExternalLink size={15} /> Contactarnos
                </a>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
