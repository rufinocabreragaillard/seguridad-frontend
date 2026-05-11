'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ExternalLink, FileText, Download, Copy, Check } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Boton } from '@/components/ui/boton'
import { Insignia } from '@/components/ui/insignia'
import { TextoCifrado } from '@/components/ui/texto-cifrado'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { documentosApi, colaEstadosDocsApi } from '@/lib/api'
import { abrirDocumento, descargarDocumento, abrirVentanaLoading, asegurarHandleConPermiso } from '@/lib/abrir-documento'
import type { Documento, ColaEstadoDoc, CategoriaConCaracteristicasDocs } from '@/lib/tipos'

type TabDetalle = 'datos' | 'resumen' | 'md' | 'caracteristicas' | 'texto' | 'chunks'

const ESTADOS_CON_CHUNKS = new Set(['CHUNKEADO', 'VECTORIZADO'])
const ESTADOS_CON_TEXTO = new Set(['METADATA', 'ESCANEADO', 'CHUNKEADO', 'VECTORIZADO'])

function BotonCopiar({ texto }: { texto: string }) {
  const t = useTranslations('documentoDetalle')
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    })
  }
  return (
    <button onClick={copiar} className="shrink-0 p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={t('copiar')}>
      {copiado ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

interface DocumentoDetalleModalProps {
  documento: Documento | null
  abierto: boolean
  alCerrar: () => void
  userId: string | null
  grupoActivo: string | null
  /** Pestaña inicial al abrir (default 'datos'). */
  tabInicial?: TabDetalle
}

/**
 * Modal de detalle de un documento — solo lectura.
 *
 * Muestra: Datos, Resumen, Características, Texto y Chunks. Carga datos
 * relacionados (características, último item de cola, texto, chunks) bajo
 * demanda según la pestaña activa.
 *
 * Compartido entre `/documents` y `/process-documents` para mantener un único
 * punto de mantenimiento del visor.
 */
export function DocumentoDetalleModal({
  documento,
  abierto,
  alCerrar,
  userId,
  grupoActivo,
  tabInicial = 'datos',
}: DocumentoDetalleModalProps) {
  const t = useTranslations('documentoDetalle')
  const tc = useTranslations('common')
  const [tab, setTab] = useState<TabDetalle>(tabInicial)
  const [colaItem, setColaItem] = useState<ColaEstadoDoc | null>(null)
  const [categoriasConCaract, setCategoriasConCaract] = useState<CategoriaConCaracteristicasDocs[]>([])
  const [cargandoCaract, setCargandoCaract] = useState(false)
  const [textoData, setTextoData] = useState<Awaited<ReturnType<typeof documentosApi.obtenerTexto>> | null>(null)
  const [cargandoTexto, setCargandoTexto] = useState(false)
  const [chunksData, setChunksData] = useState<Awaited<ReturnType<typeof documentosApi.listarChunks>> | null>(null)
  const [cargandoChunks, setCargandoChunks] = useState(false)
  const [busquedaChunk, setBusquedaChunk] = useState('')
  const [busquedaChunkInput, setBusquedaChunkInput] = useState('')
  const [paginaChunk, setPaginaChunk] = useState(1)

  // Reset al abrir/cambiar de documento.
  useEffect(() => {
    if (!abierto || !documento) return
    setTab(tabInicial)
    setColaItem(null)
    setCategoriasConCaract([])
    setTextoData(null)
    setChunksData(null)
    setBusquedaChunk('')
    setBusquedaChunkInput('')
    setPaginaChunk(1)
    // Cargar características y último item de cola al abrir.
    setCargandoCaract(true)
    documentosApi
      .listarCaracteristicas(documento.codigo_documento)
      .then(setCategoriasConCaract)
      .catch(() => setCategoriasConCaract([]))
      .finally(() => setCargandoCaract(false))
    colaEstadosDocsApi
      .porDocumento(documento.codigo_documento)
      .then((items) => setColaItem(items[0] ?? null))
      .catch(() => setColaItem(null))
  }, [abierto, documento, tabInicial])

  const cargarTexto = useCallback(async (idDocumento: number) => {
    setCargandoTexto(true)
    try {
      const data = await documentosApi.obtenerTexto(idDocumento)
      setTextoData(data)
    } catch {
      setTextoData(null)
    } finally {
      setCargandoTexto(false)
    }
  }, [])

  const cargarChunks = useCallback(async (idDocumento: number, q?: string, page = 1) => {
    setCargandoChunks(true)
    try {
      const data = await documentosApi.listarChunks(idDocumento, { q: q || undefined, page, limit: 10 })
      setChunksData(data)
    } catch {
      setChunksData(null)
    } finally {
      setCargandoChunks(false)
    }
  }, [])

  if (!documento) return null

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={`Índice de Documento: ${documento.nombre_documento} - ${documento.codigo_documento}`}
      className="max-w-4xl"
    >
      <div className="flex flex-col gap-4 min-h-[500px]">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-borde -mt-2">
          <button onClick={() => setTab('datos')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'datos' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
            Datos
          </button>
          {documento.resumen_documento && (
            <button onClick={() => setTab('resumen')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'resumen' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
              Resumen
            </button>
          )}
          {documento.md && (
            <button onClick={() => setTab('md')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'md' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
              MD
            </button>
          )}
          <button onClick={() => setTab('caracteristicas')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'caracteristicas' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
            Características
          </button>
          {ESTADOS_CON_TEXTO.has(documento.codigo_estado_doc || '') && (
            <button
              onClick={() => {
                setTab('texto')
                if (!textoData || textoData.codigo_documento !== documento.codigo_documento) {
                  cargarTexto(documento.codigo_documento)
                }
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'texto' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
              Texto {textoData && textoData.codigo_documento === documento.codigo_documento ? `(${(textoData.caracteres || 0).toLocaleString()})` : ''}
            </button>
          )}
          {ESTADOS_CON_CHUNKS.has(documento.codigo_estado_doc || '') && (
            <button
              onClick={() => {
                setTab('chunks')
                if (!chunksData) cargarChunks(documento.codigo_documento)
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'chunks' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
              Chunks {chunksData ? `(${chunksData.stats.total_chunks})` : ''}
            </button>
          )}
        </div>

        {/* Tab Datos — solo lectura */}
        {tab === 'datos' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-12 gap-x-4 gap-y-3">
              <div className="col-span-12">
                <p className="text-xs text-texto-muted mb-1">Nombre</p>
                <div className="flex items-center gap-2">
                  {iconoTipoArchivo(documento.nombre_documento, 16)}
                  <p className="text-sm font-medium text-texto">{documento.nombre_documento}</p>
                  <BotonCopiar texto={documento.nombre_documento} />
                </div>
              </div>
              <div className="col-span-12">
                <p className="text-xs text-texto-muted mb-1">Ubicación</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-texto break-all">{documento.ubicacion_documento || '—'}</p>
                  {documento.ubicacion_documento && <BotonCopiar texto={documento.ubicacion_documento} />}
                  {documento.ubicacion_documento && /^https?:\/\//i.test(documento.ubicacion_documento) && (
                    <a href={documento.ubicacion_documento} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario" title="Abrir URL">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {documento.ubicacion_documento && !/^https?:\/\//i.test(documento.ubicacion_documento) && (
                    <button
                      onClick={async () => {
                        const { continuar, handle } = await asegurarHandleConPermiso(userId, grupoActivo)
                        if (!continuar) return
                        const win = abrirVentanaLoading()
                        abrirDocumento(documento.ubicacion_documento, win, userId, grupoActivo, handle)
                      }}
                      className="shrink-0 p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario" title="Abrir documento">
                      <FileText size={14} />
                    </button>
                  )}
                  {documento.ubicacion_documento && !/^https?:\/\//i.test(documento.ubicacion_documento) && (
                    <button onClick={() => descargarDocumento(documento.ubicacion_documento, documento.nombre_documento, userId, grupoActivo)}
                      className="shrink-0 p-1 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario" title="Descargar archivo">
                      <Download size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="col-span-4 md:col-span-3 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Estado</p>
                <div className="flex items-end flex-1">
                  {documento.codigo_estado_doc
                    ? <Insignia variante={['NO_ESCANEABLE', 'NO_ENCONTRADO'].includes(documento.codigo_estado_doc) ? 'error' : 'primario'}>{documento.codigo_estado_doc}</Insignia>
                    : <span className="text-sm text-texto-muted">—</span>}
                </div>
              </div>
              <div className="col-span-4 md:col-span-3 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Tamaño</p>
                <div className="flex items-end flex-1">
                  <p className="text-sm text-texto">{documento.tamano_kb != null ? `${documento.tamano_kb} KB` : '—'}</p>
                </div>
              </div>
              <div className="col-span-4 md:col-span-6 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Modificado</p>
                <div className="flex items-end flex-1">
                  <p className="text-sm text-texto">{documento.fecha_modificacion ? new Date(documento.fecha_modificacion).toLocaleString('es-CL') : '—'}</p>
                </div>
              </div>
              {documento.detalle_estado && (
                <div className="col-span-12">
                  <p className="text-xs text-texto-muted mb-1">Razón del estado</p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 whitespace-pre-wrap">{documento.detalle_estado}</div>
                </div>
              )}
              {!documento.detalle_estado && ['NO_ESCANEABLE', 'NO_ENCONTRADO', 'VACIO'].includes(documento.codigo_estado_doc || '') && (
                <div className="col-span-12">
                  <p className="text-xs text-texto-muted mb-1">Razón del estado</p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Sin detalle registrado. Restablece el documento y reprocésalo para obtener el motivo.</div>
                </div>
              )}
            </div>

            {/* Datos del último procesamiento en cola — siempre visible */}
            <div className="mt-2 rounded-lg border border-borde bg-fondo px-4 py-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-texto-muted uppercase tracking-wide">Último proceso</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <div>
                  <span className="text-xs text-texto-muted block">Proceso</span>
                  <span className="font-medium">{colaItem?.codigo_estado_doc_destino || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-texto-muted block">Resultado</span>
                  <span className={colaItem?.estado_cola === 'ERROR' ? 'text-error font-medium' : 'font-medium'}>{colaItem?.estado_cola || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-texto-muted block">Inicio</span>
                  <span>{colaItem?.fecha_inicio ? new Date(colaItem.fecha_inicio).toLocaleString('es-CL') : '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-texto-muted block">Término</span>
                  <span>{colaItem?.fecha_fin ? new Date(colaItem.fecha_fin).toLocaleString('es-CL') : '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-texto-muted block">Duración</span>
                  <span>
                    {colaItem?.fecha_inicio && colaItem?.fecha_fin
                      ? (() => { const ms = new Date(colaItem.fecha_fin).getTime() - new Date(colaItem.fecha_inicio).getTime(); return ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s` })()
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-texto-muted block">LLM</span>
                  <span className="font-mono text-xs">{colaItem?.modelo_usado || '—'}</span>
                </div>
              </div>
              {colaItem?.resultado && (
                <div>
                  <span className="text-xs text-texto-muted block mb-1">Detalle resultado</span>
                  <p className="text-xs text-texto-muted">{colaItem.resultado}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Resumen */}
        {tab === 'resumen' && (
          <div className="flex flex-col gap-3">
            {documento.resumen_documento ? (
              <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto whitespace-pre-wrap max-h-[60vh] overflow-y-auto">{documento.resumen_documento}</div>
            ) : (
              <p className="text-sm text-texto-muted py-4 text-center">Sin resumen registrado.</p>
            )}
          </div>
        )}

        {/* Tab MD — contenido de documentos.md (contexto que se embebe en los vectores) */}
        {tab === 'md' && (
          <div className="flex flex-col gap-3">
            {documento.md ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-texto-muted">Contexto que se embebe junto a cada chunk en los vectores</p>
                  <BotonCopiar texto={documento.md} />
                </div>
                <pre className="rounded-lg border border-borde bg-fondo px-3 py-3 text-xs text-texto whitespace-pre-wrap max-h-[60vh] overflow-y-auto font-mono leading-relaxed">{documento.md}</pre>
              </div>
            ) : (
              <p className="text-sm text-texto-muted py-4 text-center">{t('sinMdGenerado')}</p>
            )}
          </div>
        )}

        {/* Tab Texto — texto_fuente de documento_texto */}
        {tab === 'texto' && (
          <div className="flex flex-col gap-3">
            {cargandoTexto ? (
              <div className="text-sm text-texto-muted text-center py-8">{tc('cargandoTexto')}</div>
            ) : !textoData ? (
              <div className="text-sm text-texto-muted text-center py-8">{t('noSePudoCargarTexto')}</div>
            ) : !textoData.tiene_texto ? (
              <div className="text-sm text-texto-muted text-center py-8 border border-dashed border-borde rounded p-4">
                {t('sinTextoExtraido')} <b>{textoData.codigo_estado_doc}</b>
                {textoData.detalle_estado ? <><br /><span className="text-xs">{t('detalle')} {textoData.detalle_estado}</span></> : null}
              </div>
            ) : (
              <>
                <div className="flex gap-4 text-sm text-texto-muted pb-2 border-b border-borde">
                  <span><b className="text-texto">{(textoData.caracteres || 0).toLocaleString()}</b> {t('caracteres')}</span>
                  {textoData.paginas ? <span><b className="text-texto">{textoData.paginas}</b> {t('paginas')}</span> : null}
                  {textoData.fecha_extraccion ? (
                    <span>{t('extraido')} <b className="text-texto">{new Date(textoData.fecha_extraccion).toLocaleString('es-CL')}</b></span>
                  ) : null}
                </div>
                <TextoCifrado payload={textoData.texto_fuente} />
              </>
            )}
          </div>
        )}

        {/* Tab Características */}
        {tab === 'caracteristicas' && (
          <div className="flex flex-col gap-3">
            {cargandoCaract ? (
              <p className="text-sm text-texto-muted py-4 text-center">{tc('cargando2')}</p>
            ) : categoriasConCaract.filter((cc) => cc.caracteristicas.length > 0).length === 0 ? (
              <p className="text-sm text-texto-muted py-4 text-center">{t('sinCaracteristicas')}</p>
            ) : (
              categoriasConCaract.filter((cc) => cc.caracteristicas.length > 0).map((cc) => {
                const cat = cc.categoria
                return (
                  <div key={cat.codigo_cat_docs}>
                    <div className="text-xs font-semibold text-texto-muted uppercase mb-1">{cat.nombre_cat_docs}</div>
                    <div className="flex flex-col gap-1">
                      {cc.caracteristicas.map((c) => {
                        const tipoNombre = c.tipos_caract_docs?.nombre_tipo_docs || c.codigo_tipo_docs
                        const partes: string[] = []
                        if (c.valor_texto_docs) partes.push(c.valor_texto_docs)
                        if (c.valor_numerico_docs != null) partes.push(`#${c.valor_numerico_docs}`)
                        if (c.valor_fecha_docs) partes.push(c.valor_fecha_docs)
                        if (c.comentarios) partes.push(`— ${c.comentarios}`)
                        if (partes.length === 0) return null
                        return (
                          <div key={c.id_caracteristica_docs} className="text-sm flex items-start gap-2">
                            <span className="text-texto-muted shrink-0">{tipoNombre}:</span>
                            <span className="text-texto">{partes.join(' · ')}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Tab Chunks */}
        {tab === 'chunks' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                <input
                  className="w-full rounded-lg border border-borde bg-fondo-tarjeta pl-8 pr-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                  placeholder={t('buscarChunks')}
                  value={busquedaChunkInput}
                  onChange={(e) => setBusquedaChunkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setBusquedaChunk(busquedaChunkInput)
                      setPaginaChunk(1)
                      cargarChunks(documento.codigo_documento, busquedaChunkInput, 1)
                    }
                  }}
                />
              </div>
              <Boton variante="contorno" onClick={() => {
                setBusquedaChunk(busquedaChunkInput)
                setPaginaChunk(1)
                cargarChunks(documento.codigo_documento, busquedaChunkInput, 1)
              }}>{tc('buscar')}</Boton>
              {busquedaChunk && (
                <Boton variante="contorno" onClick={() => {
                  setBusquedaChunk(''); setBusquedaChunkInput(''); setPaginaChunk(1)
                  cargarChunks(documento.codigo_documento, '', 1)
                }}>{t('limpiar')}</Boton>
              )}
            </div>
            {chunksData && (
              <div className="flex gap-4 text-xs text-texto-muted bg-fondo px-3 py-2 rounded-lg">
                <span><b className="text-texto">{chunksData.stats.total_chunks}</b> {t('chunks')}</span>
                <span><b className="text-texto">{chunksData.stats.avg_chars.toLocaleString()}</b> {t('charsPromedio')}</span>
                <span><b className="text-texto">{(chunksData.stats.n_chars_total / 1000).toFixed(1)}k</b> {t('charsTotal')}</span>
                {chunksData.stats.vectorizado
                  ? <span className="text-green-600 font-medium">{t('vectorizado')}</span>
                  : <span className="text-amber-600">{t('sinVectorizar')}</span>}
              </div>
            )}
            {cargandoChunks ? (
              <p className="text-sm text-texto-muted py-4 text-center">{tc('cargandoChunks')}</p>
            ) : !chunksData ? (
              <p className="text-sm text-texto-muted py-4 text-center">{t('sinDatosChunks')}</p>
            ) : chunksData.chunks.length === 0 ? (
              <p className="text-sm text-texto-muted py-4 text-center">{busquedaChunk ? t('sinChunksPara', { busqueda: busquedaChunk }) : t('sinChunksGenerados')}</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                {chunksData.chunks.map((chunk) => {
                  const mi = chunk.match_inicio
                  const mf = chunk.match_fin
                  const tieneMatch = mi >= 0 && mf > mi
                  const renderTexto = (texto: string) => (
                    <p className="text-xs text-texto leading-relaxed whitespace-pre-wrap break-words">
                      {tieneMatch ? (
                        <>
                          {texto.slice(0, mi)}
                          <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{texto.slice(mi, mf)}</mark>
                          {texto.slice(mf)}
                        </>
                      ) : (texto.length > 400 ? texto.slice(0, 400) + '…' : texto)}
                    </p>
                  )
                  return (
                    <div key={chunk.id_chunk} className="rounded-lg border border-borde bg-fondo px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-texto-muted">{t('chunk', { nro: chunk.nro_chunk })}</span>
                        <span className="text-xs text-texto-muted">{chunk.n_chars.toLocaleString()} {t('chars')}</span>
                      </div>
                      <TextoCifrado payload={chunk.texto} render={renderTexto} />
                    </div>
                  )
                })}
              </div>
            )}
            {chunksData && chunksData.busqueda.total_filtrado > 10 && (
              <div className="flex items-center justify-between text-xs text-texto-muted pt-1">
                <span>{((paginaChunk - 1) * 10) + 1}–{Math.min(paginaChunk * 10, chunksData.busqueda.total_filtrado)} de {chunksData.busqueda.total_filtrado}</span>
                <div className="flex gap-1">
                  <Boton variante="contorno" disabled={paginaChunk <= 1} onClick={() => { const p = paginaChunk - 1; setPaginaChunk(p); cargarChunks(documento.codigo_documento, busquedaChunk, p) }}>‹</Boton>
                  <Boton variante="contorno" disabled={paginaChunk * 10 >= chunksData.busqueda.total_filtrado} onClick={() => { const p = paginaChunk + 1; setPaginaChunk(p); cargarChunks(documento.codigo_documento, busquedaChunk, p) }}>›</Boton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
