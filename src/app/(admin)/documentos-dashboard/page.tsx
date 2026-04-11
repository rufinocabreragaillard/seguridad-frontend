'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { FileText, Cpu, Tags, FolderTree, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { documentosApi, estadosDocsApi } from '@/lib/api'
import type { Documento, EstadoDoc } from '@/lib/tipos'

export default function PaginaDocumentosDashboard() {
  const t = useTranslations('documentosDashboard')
  const tc = useTranslations('common')
  const router = useRouter()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [estados, setEstados] = useState<EstadoDoc[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const [docs, ests] = await Promise.all([
          documentosApi.listar(),
          estadosDocsApi.listar(),
        ])
        setDocumentos(docs)
        setEstados(ests)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  // ── Estadísticas ──────────────────────────────────────────────────────────
  const total = documentos.length
  const activos = documentos.filter((d) => d.activo).length
  const sinEstado = documentos.filter((d) => d.activo && !d.codigo_estado_doc).length

  // Conteo por estado
  const conteoPorEstado: Record<string, number> = {}
  for (const d of documentos.filter((d) => d.activo)) {
    if (d.codigo_estado_doc) {
      conteoPorEstado[d.codigo_estado_doc] = (conteoPorEstado[d.codigo_estado_doc] || 0) + 1
    }
  }
  const estadosOrdenados = [...estados].filter((e) => e.activo).sort((a, b) => a.orden - b.orden)
  const maxConteo = Math.max(1, ...Object.values(conteoPorEstado))

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
    { nombre: t('irCargarDocumentos'), href: '/cargar-documentos', icono: FolderTree },
    { nombre: t('irCategorias'), href: '/categorias-caracteristica-docs', icono: Tags },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
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
                  <span className="text-3xl font-bold text-texto">{t.valor}</span>
                )}
              </TarjetaContenido>
            </Tarjeta>
          )
        })}
      </div>

      {/* Distribución por estado + Accesos rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de barras por estado */}
        <Tarjeta className="lg:col-span-2">
          <TarjetaContenido>
            <h3 className="text-sm font-semibold text-texto mb-4 flex items-center gap-2">
              <FileText size={15} className="text-primario" />
              {t('documentosPorEstado')}
            </h3>
            {cargando ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-fondo rounded animate-pulse" />
                ))}
              </div>
            ) : estadosOrdenados.length === 0 ? (
              <p className="text-sm text-texto-muted text-center py-6">{t('sinEstadosConfigurados')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {estadosOrdenados.map((e) => {
                  const conteo = conteoPorEstado[e.codigo_estado_doc] || 0
                  const pct = (conteo / maxConteo) * 100
                  const url = `/procesar-documentos?estado=${encodeURIComponent(e.codigo_estado_doc)}`
                  return (
                    <div
                      key={e.codigo_estado_doc}
                      className="flex items-center gap-3 group cursor-pointer rounded-lg px-1 -mx-1 hover:bg-primario-muy-claro transition-colors"
                      title={`Ir a Procesar — ${e.nombre_estado}`}
                      onClick={() => conteo > 0 && router.push(url)}
                    >
                      <span className="text-sm text-texto min-w-[110px] group-hover:text-primario transition-colors">{e.nombre_estado}</span>
                      <div className="flex-1 h-7 bg-fondo rounded-md overflow-hidden relative">
                        <div
                          className="h-full bg-primario transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-texto">
                          {conteo}
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        className={`shrink-0 transition-opacity ${conteo > 0 ? 'opacity-0 group-hover:opacity-100 text-primario' : 'opacity-0'}`}
                      />
                    </div>
                  )
                })}
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
