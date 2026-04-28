'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Eye, RefreshCw } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Paginador } from '@/components/ui/paginador'
import { usePaginacion } from '@/hooks/usePaginacion'
import { sqlEjecutadosApi } from '@/lib/api'
import type { SqlEjecutado } from '@/lib/tipos'

function formatearFecha(fecha: string) {
  try {
    return new Date(fecha).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return fecha
  }
}

function varianteOperacion(op: string | null | undefined): 'exito' | 'error' | 'advertencia' | 'neutro' | 'primario' {
  switch ((op || '').toUpperCase()) {
    case 'SELECT':
      return 'neutro'
    case 'INSERT':
      return 'exito'
    case 'UPDATE':
      return 'advertencia'
    case 'DELETE':
      return 'error'
    case 'RPC':
      return 'primario'
    default:
      return 'neutro'
  }
}

export default function PaginaSqlEjecutados() {
  const t = useTranslations('sqlEjecutados')
  const tc = useTranslations('common')

  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState<SqlEjecutado | null>(null)

  const filtros = useMemo(() => ({ q: busqueda.trim() || undefined }), [busqueda])

  const fetcher = useCallback(
    (params: { page: number; limit: number; q?: string }) =>
      sqlEjecutadosApi.listarPaginado(params),
    [],
  )

  const {
    items,
    total,
    page,
    limit,
    cargando,
    setPage,
    setLimit,
    refetch,
  } = usePaginacion<SqlEjecutado, { q?: string }>({
    fetcher,
    filtros,
    limitInicial: 50,
  })

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">
          {t('subtitulo')}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="max-w-md flex-1">
          <Input
            placeholder={t('buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <Boton variante="contorno" tamano="sm" onClick={refetch} disabled={cargando}>
          <RefreshCw size={15} />
          {t('refrescar')}
        </Boton>
        <div className="ml-auto text-sm text-texto-muted">
          {total === 1
            ? t('totalSingular', { n: total.toLocaleString('es-CL') })
            : t('totalPlural', { n: total.toLocaleString('es-CL') })}
        </div>
      </div>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>{t('colFecha')}</TablaTh>
            <TablaTh>{t('colDuracion')}</TablaTh>
            <TablaTh>{t('colOperacion')}</TablaTh>
            <TablaTh>{t('colTabla')}</TablaTh>
            <TablaTh>{t('colEndpoint')}</TablaTh>
            <TablaTh>{t('colUsuario')}</TablaTh>
            <TablaTh>{t('colFuncion')}</TablaTh>
            <TablaTh>{t('colFilas')}</TablaTh>
            <TablaTh className="max-w-md">{t('colSql')}</TablaTh>
            <TablaTh className="text-right">{t('colVer')}</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={10 as never}>
                {tc('cargando')}
              </TablaTd>
            </TablaFila>
          ) : items.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={10 as never}>
                {t('sinRegistros')}
              </TablaTd>
            </TablaFila>
          ) : (
            items.map((s) => (
              <TablaFila key={s.id}>
                <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                  {formatearFecha(s.fecha_inicio)}
                </TablaTd>
                <TablaTd className="text-xs text-right whitespace-nowrap">
                  {t('msValor', { ms: s.duracion_ms })}
                </TablaTd>
                <TablaTd>
                  {s.operacion ? (
                    <Insignia variante={varianteOperacion(s.operacion)}>{s.operacion}</Insignia>
                  ) : (
                    <span className="text-texto-muted text-xs">—</span>
                  )}
                </TablaTd>
                <TablaTd className="text-xs font-mono">{s.tabla || '—'}</TablaTd>
                <TablaTd className="text-xs font-mono max-w-[200px] truncate" title={s.endpoint || ''}>
                  {s.endpoint || '—'}
                </TablaTd>
                <TablaTd className="text-xs max-w-[160px] truncate" title={s.codigo_usuario || ''}>
                  {s.codigo_usuario || '—'}
                </TablaTd>
                <TablaTd className="text-xs font-mono max-w-[140px] truncate" title={s.codigo_funcion || ''}>
                  {s.codigo_funcion || '—'}
                </TablaTd>
                <TablaTd className="text-xs text-right">
                  {s.filas_afectadas ?? '—'}
                </TablaTd>
                <TablaTd className="max-w-md">
                  <code className="text-xs font-mono block truncate" title={s.sql_text}>
                    {s.sql_text}
                  </code>
                  {s.error && (
                    <span className="text-xs text-error block truncate" title={s.error}>
                      ⚠ {s.error}
                    </span>
                  )}
                </TablaTd>
                <TablaTd>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setDetalle(s)}
                      className="p-1.5 rounded-lg hover:bg-fondo text-texto-muted hover:text-primario transition-colors"
                      title={t('verDetalle')}
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </TablaTd>
              </TablaFila>
            ))
          )}
        </TablaCuerpo>
      </Tabla>

      <Paginador
        page={page}
        limit={limit}
        total={total}
        onChangePage={setPage}
        onChangeLimit={setLimit}
        cargando={cargando}
      />

      {/* Modal detalle */}
      <Modal
        abierto={!!detalle}
        alCerrar={() => setDetalle(null)}
        titulo={detalle ? t('detalleTitulo', { id: detalle.id }) : ''}
      >
        {detalle && (
          <div className="flex flex-col gap-4 min-w-[640px] max-w-[900px]">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-texto-muted">{t('fechaInicio')}</div>
                <div className="font-mono text-xs">{formatearFecha(detalle.fecha_inicio)}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('fechaTermino')}</div>
                <div className="font-mono text-xs">{formatearFecha(detalle.fecha_termino)}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('duracion')}</div>
                <div className="font-mono">{t('msValor', { ms: detalle.duracion_ms })}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('filasAfectadas')}</div>
                <div className="font-mono">{detalle.filas_afectadas ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('colOperacion')}</div>
                <div>
                  {detalle.operacion ? (
                    <Insignia variante={varianteOperacion(detalle.operacion)}>{detalle.operacion}</Insignia>
                  ) : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('colTabla')}</div>
                <div className="font-mono text-xs">{detalle.tabla || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('colEndpoint')}</div>
                <div className="font-mono text-xs break-all">{detalle.endpoint || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('colUsuario')}</div>
                <div className="text-xs">{detalle.codigo_usuario || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('grupo')}</div>
                <div className="font-mono text-xs">{detalle.codigo_grupo || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('entidad')}</div>
                <div className="font-mono text-xs">{detalle.codigo_entidad || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('colFuncion')}</div>
                <div className="font-mono text-xs">{detalle.codigo_funcion || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-texto-muted">{t('hashTemplate')}</div>
                <div className="font-mono text-[10px] break-all">{detalle.sql_hash}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-texto-muted mb-1">{t('colSql')}</div>
              <pre className="bg-fondo border border-borde rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-[360px] overflow-auto">
                {detalle.sql_text}
              </pre>
            </div>

            {detalle.error && (
              <div>
                <div className="text-xs text-error mb-1">{t('error')}</div>
                <pre className="bg-red-50 border border-red-200 text-error rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all">
                  {detalle.error}
                </pre>
              </div>
            )}

            <div className="flex justify-end">
              <Boton variante="primario" onClick={() => setDetalle(null)}>
                {tc('cerrar')}
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
