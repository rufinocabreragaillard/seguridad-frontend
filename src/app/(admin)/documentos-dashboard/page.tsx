'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { FileText, Cpu, Tags, FolderTree, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { documentosApi } from '@/lib/api'
import { getEstadosDocs } from '@/lib/catalogos'
import type { EstadoDoc } from '@/lib/tipos'
import { BotonChat } from '@/components/ui/boton-chat'

export default function PaginaDocumentosDashboard() {
  const t = useTranslations('documentosDashboard')
  const router = useRouter()
  const [conteoPorEstado, setConteoPorEstado] = useState<Record<string, number>>({})
  const [totalDocs, setTotalDocs] = useState(0)
  const [activosDocs, setActivosDocs] = useState(0)
  const [estados, setEstados] = useState<EstadoDoc[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const [conteos, ests, paginadoTotal, paginadoActivos] = await Promise.all([
          documentosApi.contarPorEstado(),
          getEstadosDocs(),
          documentosApi.listarPaginado({ page: 1, limit: 1 }),
          documentosApi.listarPaginado({ page: 1, limit: 1 }),
        ])
        setConteoPorEstado(conteos)
        setEstados(ests)
        setTotalDocs(paginadoTotal.total)
        setActivosDocs(paginadoActivos.total)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  // ── Estadísticas ──────────────────────────────────────────────────────────
  const total = totalDocs
  const activos = activosDocs
  // Documentos activos sin estado = activos menos la suma de todos los conteos
  const sinEstado = Math.max(0, activos - Object.values(conteoPorEstado).reduce((s, v) => s + v, 0))
  const estadosOrdenados = [...estados].sort((a, b) => a.orden - b.orden)

  // Estados del pipeline válido (orden termina en 0: 10, 20, 40, 50, 60…)
  const estadosValidos = estadosOrdenados.filter((e) => e.orden % 10 === 0)
  // Estados terminales / no válidos (NO_*, REVISAR, NO_ESTAN…)
  const estadosInvalidos = estadosOrdenados.filter((e) => e.orden % 10 !== 0)
  // Escala independiente por columna para que las barras sean comparables dentro de su grupo
  const maxConteoValidos = Math.max(1, ...estadosValidos.map((e) => conteoPorEstado[e.codigo_estado_doc] || 0))
  const maxConteoInvalidos = Math.max(1, ...estadosInvalidos.map((e) => conteoPorEstado[e.codigo_estado_doc] || 0))

  // Tarjetas resumen
  const tarjetas = [
    {
      titulo: t('totalDocumentos'),
      valor: total,
      icono: FileText,
      color: 'bg-primario-muy-claro text-primario',
    },
    {
      titulo: t('activos'),
      valor: activos,
      icono: CheckCircle,
      color: 'bg-green-50 text-exito',
    },
    {
      titulo: t('revisar'),
      valor: conteoPorEstado['REVISAR'] || 0,
      icono: Clock,
      color: 'bg-acento-muy-claro text-acento',
    },
    {
      titulo: t('sinEstado'),
      valor: sinEstado,
      icono: AlertTriangle,
      color: 'bg-yellow-50 text-yellow-700',
    },
  ]

  // Accesos rápidos
  const accesos = [
    { nombre: t('irProcesarDocumentos'), href: '/procesar-documentos', icono: Cpu },
    { nombre: t('irCargarDocumentos'), href: '/ubicaciones-docs', icono: FolderTree },
    { nombre: t('irCategorias'), href: '/categorias-caracteristica-docs', icono: Tags },
  ]

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-texto-muted text-sm mt-1">
          {t('subtitulo')}
        </p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tarjetas.map((t) => {
          const Icono = t.icono
          return (
            <Tarjeta key={t.titulo}>
              <TarjetaContenido className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-texto-muted">{t.titulo}</span>
                  <div className={`p-2 rounded-lg ${t.color}`}>
                    <Icono size={16} />
                  </div>
                </div>
                {cargando ? (
                  <div className="h-8 w-16 bg-borde rounded animate-pulse" />
                ) : (
                  <span className="stat-value text-texto">{t.valor}</span>
                )}
              </TarjetaContenido>
            </Tarjeta>
          )
        })}
      </div>

      {/* Distribución por estado + Accesos rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de barras por estado — dos columnas: válidos e inválidos */}
        <Tarjeta className="lg:col-span-2">
          <TarjetaContenido>
            <h3 className="text-sm font-semibold text-texto mb-4 flex items-center gap-2">
              <FileText size={15} className="text-primario" />
              {t('documentosPorEstado')}
            </h3>
            {cargando ? (
              <div className="grid grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, col) => (
                  <div key={col} className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-7 bg-fondo rounded animate-pulse" />
                    ))}
                  </div>
                ))}
              </div>
            ) : estadosOrdenados.length === 0 ? (
              <p className="text-sm text-texto-muted text-center py-6">{t('sinEstadosConfigurados')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">

                {/* ── Columna: Válidos (pipeline) ── */}
                <div>
                  <p className="text-xs font-semibold text-exito uppercase tracking-wide mb-3">
                    Válidos
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {estadosValidos.map((e) => {
                      const conteo = conteoPorEstado[e.codigo_estado_doc] || 0
                      const pct = (conteo / maxConteoValidos) * 100
                      const url = `/procesar-documentos?estado=${encodeURIComponent(e.codigo_estado_doc)}`
                      return (
                        <div
                          key={e.codigo_estado_doc}
                          className="flex items-center gap-2 group cursor-pointer rounded-lg px-1 -mx-1 hover:bg-primario-muy-claro transition-colors"
                          title={`Ir a Procesar — ${e.nombre_estado}`}
                          onClick={() => conteo > 0 && router.push(url)}
                        >
                          <span className="text-xs text-texto min-w-[82px] group-hover:text-primario transition-colors">
                            {e.nombre_estado}
                          </span>
                          <div className="flex-1 h-6 bg-fondo rounded-md overflow-hidden relative">
                            <div
                              className="h-full bg-primario transition-all"
                              style={{ width: `${pct}%` }}
                            />
                            <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-texto">
                              {conteo}
                            </span>
                          </div>
                          <ArrowRight
                            size={12}
                            className={`shrink-0 transition-opacity ${conteo > 0 ? 'opacity-0 group-hover:opacity-100 text-primario' : 'opacity-0'}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Columna: No válidos (terminales / error) ── */}
                <div>
                  <p className="text-xs font-semibold text-error uppercase tracking-wide mb-3">
                    No válidos
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {estadosInvalidos.map((e) => {
                      const conteo = conteoPorEstado[e.codigo_estado_doc] || 0
                      const pct = (conteo / maxConteoInvalidos) * 100
                      const url = `/procesar-documentos?estado=${encodeURIComponent(e.codigo_estado_doc)}`
                      return (
                        <div
                          key={e.codigo_estado_doc}
                          className="flex items-center gap-2 group cursor-pointer rounded-lg px-1 -mx-1 hover:bg-red-50 transition-colors"
                          title={`Ir a Procesar — ${e.nombre_estado}`}
                          onClick={() => conteo > 0 && router.push(url)}
                        >
                          <span className="text-xs text-texto min-w-[82px] group-hover:text-error transition-colors">
                            {e.nombre_estado}
                          </span>
                          <div className="flex-1 h-6 bg-fondo rounded-md overflow-hidden relative">
                            <div
                              className="h-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: 'rgba(220, 38, 38, 0.5)' }}
                            />
                            <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-texto">
                              {conteo}
                            </span>
                          </div>
                          <ArrowRight
                            size={12}
                            className={`shrink-0 transition-opacity ${conteo > 0 ? 'opacity-0 group-hover:opacity-100 text-error' : 'opacity-0'}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}
          </TarjetaContenido>
        </Tarjeta>

        {/* Accesos rápidos */}
        <Tarjeta>
          <TarjetaContenido>
            <h3 className="text-sm font-semibold text-texto mb-3 flex items-center gap-2">
              <Cpu size={15} className="text-primario" />
              {t('accesosRapidos')}
            </h3>
            <div className="flex flex-col gap-2">
              {accesos.map((acc) => {
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
      </div>
    </div>
  )
}
