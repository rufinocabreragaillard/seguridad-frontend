'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ExternalLink, FileText, Download, Copy, Check, Lock, Unlock } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Boton } from '@/components/ui/boton'
import { Insignia } from '@/components/ui/insignia'
import { TextoCifrado } from '@/components/ui/texto-cifrado'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { documentosApi, colaEstadosDocsApi } from '@/lib/api'
import { abrirDocumento, descargarDocumento, abrirVentanaLoading, asegurarHandleConPermiso } from '@/lib/abrir-documento'
import type { Documento, ColaEstadoDoc, CategoriaConCaracteristicasDocs } from '@/lib/tipos'
import { descifrarPayload, getClaveSesion, setClaveSesion, suscribirClaveSesion, type PayloadCifrado } from '@/lib/descifrar'

/** Heurística: distingue un payload cifrado-para-usuario de un string plano. */
function esPayload(v: unknown): v is PayloadCifrado {
  return !!v && typeof v === 'object' && 'cifrado' in (v as object) && 'texto_cifrado' in (v as object)
}

/** Renderiza un valor que puede llegar como string plano o payload cifrado. */
function ValorCampo({
  valor,
  render,
  vacioLabel,
  inline,
}: {
  valor: string | number | PayloadCifrado | null | undefined
  render?: (texto: string) => React.ReactNode
  vacioLabel?: string
  inline?: boolean
}) {
  if (valor == null || valor === '') {
    return <span className="text-sm text-texto-muted italic">{vacioLabel ?? '—'}</span>
  }
  if (esPayload(valor)) {
    return <TextoCifrado payload={valor} render={render} vacioLabel={vacioLabel} inline={inline} />
  }
  const texto = String(valor)
  return <>{render ? render(texto) : <span className="text-sm text-texto whitespace-pre-wrap">{texto}</span>}</>
}

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
  // Detalle completo recargado del backend (incluye payloads cifrados-para-usuario
  // de resumen y md, + nombre_tipo_documento / formato_archivo).
  const [detalle, setDetalle] = useState<Documento | null>(null)

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
    setDetalle(null)
    setPidiendoClaveCaract(false)
    setClaveInputCaract('')
    setErrorClaveCaract(null)
    // Recargar el documento desde GET /documentos/{id} para tener los campos
    // cifrados como payload (resumen, md) + nombre_tipo_documento.
    documentosApi
      .obtener(documento.codigo_documento)
      .then(setDetalle)
      .catch(() => setDetalle(null))
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

  // Vista efectiva: prefiere el detalle recargado; cae al prop si aún no llegó.
  const vista = detalle ?? documento
  const resumenValor = vista?.resumen_documento
  const mdValor = vista?.md
  const tieneResumen = resumenValor != null && (esPayload(resumenValor) ? resumenValor.cifrado : !!resumenValor)
  const tieneMd = mdValor != null && (esPayload(mdValor) ? mdValor.cifrado : !!mdValor)

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

  // ── Descifrado global de Características ───────────────────────────────
  // Un solo botón en el encabezado pide la clave una vez y desbloquea todos
  // los valores cifrados de la pestaña.
  const [claveDisponible, setClaveDisponible] = useState<boolean>(() => !!getClaveSesion())
  const [pidiendoClaveCaract, setPidiendoClaveCaract] = useState(false)
  const [claveInputCaract, setClaveInputCaract] = useState('')
  const [errorClaveCaract, setErrorClaveCaract] = useState<string | null>(null)

  useEffect(() => {
    const unsub = suscribirClaveSesion((c) => setClaveDisponible(!!c))
    return unsub
  }, [])

  // ¿Existe al menos un valor cifrado entre las características cargadas?
  const hayCaractCifradas = useMemo(() => {
    for (const cc of categoriasConCaract) {
      for (const c of cc.caracteristicas) {
        for (const v of [c.valor_texto_docs, c.valor_numerico_docs, c.valor_fecha_docs, c.comentarios]) {
          if (esPayload(v)) return true
        }
      }
    }
    return false
  }, [categoriasConCaract])

  // Toma cualquier payload cifrado de la lista para validar la clave.
  const payloadMuestra = useMemo<PayloadCifrado | null>(() => {
    for (const cc of categoriasConCaract) {
      for (const c of cc.caracteristicas) {
        for (const v of [c.valor_texto_docs, c.valor_numerico_docs, c.valor_fecha_docs, c.comentarios]) {
          if (esPayload(v)) return v
        }
      }
    }
    return null
  }, [categoriasConCaract])

  const descifrarCaractGlobal = async () => {
    setErrorClaveCaract(null)
    if (!claveInputCaract) {
      setErrorClaveCaract(tc('ingresaUnaClave'))
      return
    }
    if (!payloadMuestra) {
      setClaveSesion(claveInputCaract)
      setPidiendoClaveCaract(false)
      setClaveInputCaract('')
      return
    }
    try {
      await descifrarPayload(payloadMuestra, claveInputCaract)
      setClaveSesion(claveInputCaract)
      setPidiendoClaveCaract(false)
      setClaveInputCaract('')
    } catch (e) {
      const msg = (e as Error).message
      setErrorClaveCaract(msg === 'clave-incorrecta' ? tc('claveIncorrecta') : tc('ingresaUnaClave'))
    }
  }

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
          {tieneResumen && (
            <button onClick={() => setTab('resumen')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'resumen' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}>
              Resumen
            </button>
          )}
          {tieneMd && (
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
              <div className="col-span-6 md:col-span-4 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Tipo de documento</p>
                <div className="flex items-end flex-1">
                  {vista?.nombre_tipo_documento || vista?.codigo_tipo_documento
                    ? <Insignia variante="primario">{vista?.nombre_tipo_documento || vista?.codigo_tipo_documento}</Insignia>
                    : <span className="text-sm text-texto-muted">—</span>}
                </div>
              </div>
              <div className="col-span-6 md:col-span-2 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Formato</p>
                <div className="flex items-end flex-1">
                  <p className="text-sm text-texto uppercase">{vista?.formato_archivo || '—'}</p>
                </div>
              </div>
              <div className="col-span-4 md:col-span-2 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Estado</p>
                <div className="flex items-end flex-1">
                  {documento.codigo_estado_doc
                    ? <Insignia variante={['NO_ESCANEABLE', 'NO_ENCONTRADO'].includes(documento.codigo_estado_doc) ? 'error' : 'primario'}>{documento.codigo_estado_doc}</Insignia>
                    : <span className="text-sm text-texto-muted">—</span>}
                </div>
              </div>
              <div className="col-span-4 md:col-span-2 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Tamaño</p>
                <div className="flex items-end flex-1">
                  <p className="text-sm text-texto">{documento.tamano_kb != null ? `${documento.tamano_kb} KB` : '—'}</p>
                </div>
              </div>
              <div className="col-span-4 md:col-span-2 flex flex-col">
                <p className="text-xs text-texto-muted mb-1">Modificado</p>
                <div className="flex items-end flex-1">
                  <p className="text-sm text-texto">{documento.fecha_modificacion ? new Date(documento.fecha_modificacion).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) : '—'}</p>
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
                  <span>{colaItem?.fecha_inicio ? new Date(colaItem.fecha_inicio).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) : '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-texto-muted block">Término</span>
                  <span>{colaItem?.fecha_fin ? new Date(colaItem.fecha_fin).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) : '—'}</span>
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
              {colaItem?.resultado && colaItem?.estado_cola !== 'ERROR' && (
                <div>
                  <span className="text-xs text-texto-muted block mb-1">Detalle resultado</span>
                  <p className="text-xs text-texto-muted">{colaItem.resultado}</p>
                </div>
              )}
              {colaItem?.estado_cola === 'ERROR' && (colaItem?.mensaje_error || colaItem?.resultado) && (
                <div className="mt-1 rounded border border-error/30 bg-red-50 px-3 py-2">
                  <span className="text-xs font-semibold text-error block mb-1">Mensaje de error</span>
                  <pre className="text-xs text-error/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono">{colaItem.mensaje_error || colaItem.resultado}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Resumen — texto cifrado en BD, el usuario lo descifra con su clave */}
        {tab === 'resumen' && (
          <div className="flex flex-col gap-3">
            {tieneResumen ? (
              <ValorCampo
                valor={resumenValor}
                render={(texto) => (
                  <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto whitespace-pre-wrap max-h-[60vh] overflow-y-auto">{texto}</div>
                )}
                vacioLabel="Sin resumen registrado."
              />
            ) : (
              <p className="text-sm text-texto-muted py-4 text-center">Sin resumen registrado.</p>
            )}
          </div>
        )}

        {/* Tab MD — contenido de documentos.md (contexto que se embebe en los vectores).
            Cifrado en reposo desde mig 435; se descifra con la clave de sesión. */}
        {tab === 'md' && (
          <div className="flex flex-col gap-3">
            {tieneMd ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-texto-muted">Contexto que se embebe junto a cada chunk en los vectores</p>
                <ValorCampo
                  valor={mdValor}
                  render={(texto) => (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-end">
                        <BotonCopiar texto={texto} />
                      </div>
                      <pre className="rounded-lg border border-borde bg-fondo px-3 py-3 text-xs text-texto whitespace-pre-wrap max-h-[60vh] overflow-y-auto font-mono leading-relaxed">{texto}</pre>
                    </div>
                  )}
                />
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
                    <span>{t('extraido')} <b className="text-texto">{new Date(textoData.fecha_extraccion).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</b></span>
                  ) : null}
                </div>
                <TextoCifrado payload={textoData.texto_fuente} />
              </>
            )}
          </div>
        )}

        {/* Tab Características — valores cifrados en BD (mig 435). El encabezado
            muestra un único botón "Descifrar" que pide la clave una sola vez y
            desbloquea todos los valores (cada TextoCifrado escucha la clave de
            sesión). En modo inline los valores se ven como ••• hasta descifrar. */}
        {tab === 'caracteristicas' && (
          <div className="flex flex-col gap-3">
            {hayCaractCifradas && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-texto-muted border border-dashed border-borde rounded p-3 bg-fondo">
                  <Lock size={16} />
                  <span className="flex-1">
                    {claveDisponible
                      ? 'Características descifradas con la clave de la sesión.'
                      : 'Las características están cifradas. Ingresa la clave para verlas.'}
                  </span>
                  {!claveDisponible && !pidiendoClaveCaract && (
                    <Boton variante="contorno" onClick={() => setPidiendoClaveCaract(true)}>
                      <Unlock size={14} className="mr-1" /> {tc('descifrar')}
                    </Boton>
                  )}
                </div>
                {pidiendoClaveCaract && !claveDisponible && (
                  <div className="flex flex-col gap-2 border border-borde rounded p-3 bg-fondo-tarjeta">
                    <label className="text-xs text-texto-muted">{tc('claveDescifrado')}</label>
                    <input
                      type="password"
                      autoFocus
                      value={claveInputCaract}
                      onChange={(e) => setClaveInputCaract(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') descifrarCaractGlobal() }}
                      className="w-full rounded border border-borde bg-fondo px-3 py-2 text-sm focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                      placeholder={tc('ingresarPlaceholder')}
                    />
                    {errorClaveCaract && <span className="text-xs text-red-600">{errorClaveCaract}</span>}
                    <div className="flex gap-2 justify-end">
                      <Boton variante="contorno" onClick={() => { setPidiendoClaveCaract(false); setClaveInputCaract(''); setErrorClaveCaract(null) }}>
                        {tc('cancelar')}
                      </Boton>
                      <Boton variante="primario" onClick={descifrarCaractGlobal}>{tc('descifrar')}</Boton>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                    <div className="flex flex-col gap-2">
                      {cc.caracteristicas.map((c) => {
                        const tipoNombre = c.tipos_caract_docs?.nombre_tipo_docs || c.codigo_tipo_docs
                        type ValorCampoTipo = string | number | PayloadCifrado | null | undefined
                        const campos: { label?: string; valor: ValorCampoTipo }[] = []
                        if (c.valor_texto_docs != null) campos.push({ valor: c.valor_texto_docs })
                        if (c.valor_numerico_docs != null) campos.push({ label: '#', valor: c.valor_numerico_docs })
                        if (c.valor_fecha_docs != null) campos.push({ valor: c.valor_fecha_docs })
                        if (c.comentarios != null) campos.push({ label: '—', valor: c.comentarios })
                        if (campos.length === 0) return null
                        const inlineRender = (texto: string) => <span className="text-texto">{texto}</span>
                        return (
                          <div key={c.id_caracteristica_docs} className="text-sm flex items-start gap-2 flex-wrap">
                            <span className="text-texto-muted shrink-0">{tipoNombre}:</span>
                            {campos.map((campo, idx) => (
                              <span key={idx} className="flex items-center gap-1">
                                {campo.label && <span className="text-texto-muted text-xs">{campo.label}</span>}
                                <ValorCampo valor={campo.valor as never} render={inlineRender} inline />
                                {idx < campos.length - 1 && <span className="text-texto-muted">·</span>}
                              </span>
                            ))}
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
