'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen, CheckCircle, AlertTriangle, RefreshCw, Upload } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { BarraProgresoPipeline } from '@/components/ui/barra-progreso-pipeline'
import { documentosApi, colaEstadosDocsApi, ubicacionesDocsApi } from '@/lib/api'
import { extraerTextoDeArchivo, abrirArchivoPorRuta } from '@/lib/extraer-texto'
import { getDirectoryHandle, setDirectoryHandle, ensureReadPermission } from '@/lib/file-handle-store'
import { escanearDirectorio } from '@/lib/escanear-directorio'
import { useAuth } from '@/context/AuthContext'

// ── Pipeline ──────────────────────────────────────────────────────────────────

const PASOS = [
  { key: 'EXTRAER',    estadoOrigen: 'CARGADO',   estadoDestino: 'METADATA',    color: '#EF4444', clienteSide: true },
  { key: 'ANALIZAR',   estadoOrigen: 'METADATA',  estadoDestino: 'ESCANEADO',   color: '#F97316', clienteSide: false },
  { key: 'CHUNKEAR',   estadoOrigen: 'ESCANEADO', estadoDestino: 'CHUNKEADO',   color: '#84CC16', clienteSide: false },
  { key: 'VECTORIZAR', estadoOrigen: 'CHUNKEADO', estadoDestino: 'VECTORIZADO', color: '#22C55E', clienteSide: false },
] as const

type EstadoPaso = 'esperando' | 'activo' | 'listo' | 'error'
interface ProgresoPaso { total: number; completados: number; estado: EstadoPaso }

const progresosIniciales = (): Record<string, ProgresoPaso> =>
  Object.fromEntries(PASOS.map((p) => [p.key, { total: 0, completados: 0, estado: 'esperando' }]))

// ── Componente ────────────────────────────────────────────────────────────────

export default function PaginaCargaDocsUsuario() {
  const t = useTranslations('procesarPipeline')
  const { grupoActivo } = useAuth()
  const [tab, setTab] = useState<'ubicaciones' | 'documentos'>('ubicaciones')

  // ── Estado tab Ubicaciones ────────────────────────────────────────────────
  const [sincronizando, setSincronizando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [resultadoSync, setResultadoSync] = useState<{
    insertadas: number; actualizadas: number; eliminadas: number; excluidas: number
  } | null>(null)
  const [errorSync, setErrorSync] = useState('')

  // ── Estado tab Documentos ─────────────────────────────────────────────────
  const [progresos, setProgresos] = useState<Record<string, ProgresoPaso>>(progresosIniciales)
  const [ejecutando, setEjecutando] = useState(false)
  const [dirHandle, setDirHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [mensajeError, setMensajeError] = useState('')
  const [carpetaRaiz, setCarpetaRaiz] = useState<string>('')

  const abortRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ejecutando && tiempoInicio) {
      timerRef.current = setInterval(() => {
        setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [ejecutando, tiempoInicio])

  // ── Cargar handle persistido, conteos y carpeta raíz ─────────────────────
  useEffect(() => {
    getDirectoryHandle().then((h) => { if (h) setDirHandleState(h) })
    cargarConteos()
    ubicacionesDocsApi.listar().then((ubs) => {
      if (!ubs?.length) return
      const raiz = (ubs as { nivel: number; ruta_completa?: string }[])
        .reduce((min, u) => u.nivel < min.nivel ? u : min, ubs[0] as { nivel: number; ruta_completa?: string })
      const nombre = raiz?.ruta_completa?.split('/').filter(Boolean)[0] ?? ''
      if (nombre) setCarpetaRaiz(nombre)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  const cargarConteos = useCallback(async () => {
    try {
      const conteos = await documentosApi.contarPorEstado()
      setProgresos((prev) => {
        const next = { ...prev }
        for (const paso of PASOS) {
          next[paso.key] = { ...next[paso.key], total: conteos[paso.estadoOrigen] ?? 0, completados: 0, estado: 'esperando' }
        }
        return next
      })
    } catch { /* ignorar */ }
  }, [])

  // ── Sync de ubicaciones ───────────────────────────────────────────────────
  const sincronizarUbicaciones = async () => {
    setErrorSync('')
    setResultadoSync(null)
    setEscaneando(true)
    try {
      const datos = await escanearDirectorio()
      if (!datos) { setEscaneando(false); return }
      setEscaneando(false)
      setSincronizando(true)
      const res = await ubicacionesDocsApi.sincronizar({ directorios: datos.directorios })
      setResultadoSync(res as { insertadas: number; actualizadas: number; eliminadas: number; excluidas: number })
    } catch (e) {
      setEscaneando(false)
      setSincronizando(false)
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al sincronizar.'
        : 'Error al sincronizar.'
      setErrorSync(msg)
    } finally {
      setSincronizando(false)
    }
  }

  // ── Helpers pipeline ──────────────────────────────────────────────────────
  const setPaso = (key: string, patch: Partial<ProgresoPaso>) =>
    setProgresos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const ejecutarExtraer = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    const docs = await documentosApi.listar({ codigo_estado_doc: 'CARGADO', activo: true })
    if (docs.length === 0) { setPaso('EXTRAER', { estado: 'listo' }); return true }
    setPaso('EXTRAER', { total: docs.length, completados: 0, estado: 'activo' })
    let completados = 0
    for (const doc of docs) {
      if (abortRef.current) return false
      try {
        if (!doc.ubicacion_documento) {
          await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
        } else {
          const fileHandle = await abrirArchivoPorRuta(handle, doc.ubicacion_documento)
          if (!fileHandle) {
            await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', archivo_no_encontrado: true })
          } else {
            const ext = (doc.ubicacion_documento.split('.').pop() || '').toLowerCase()
            const contenido = await extraerTextoDeArchivo(fileHandle)
            if (contenido === null) {
              await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', formato_no_soportado: ext })
            } else if (!contenido.trim()) {
              await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: '', contenido_vacio: true })
            } else {
              await documentosApi.subirTexto(doc.codigo_documento, { texto_fuente: contenido, caracteres: contenido.length })
            }
          }
        }
      } catch { /* continuar */ }
      completados++
      setPaso('EXTRAER', { completados })
    }
    setPaso('EXTRAER', { completados: docs.length, estado: 'listo' })
    return true
  }

  const ejecutarPasoBackend = async (key: string, estadoOrigen: string, estadoDestino: string): Promise<boolean> => {
    // Usar inicializarPorEstado para evitar el límite de 1000 filas de Supabase.
    // Obtener total real desde endpoint paginado (no carga todos los docs en memoria).
    let totalDocs = 0
    try {
      const pag = await documentosApi.listarPaginado({ page: 1, limit: 1, codigo_estado_doc: estadoOrigen, activo: true })
      totalDocs = pag.total
    } catch { /* continuar con 0 */ }
    if (totalDocs === 0) { setPaso(key, { estado: 'listo' }); return true }
    setPaso(key, { total: totalDocs, completados: 0, estado: 'activo' })
    await colaEstadosDocsApi.inicializarPorEstado(estadoOrigen, estadoDestino)
    await colaEstadosDocsApi.ejecutar(estadoDestino)
    while (!abortRef.current) {
      await new Promise((r) => setTimeout(r, 3000))
      if (abortRef.current) return false
      try {
        const cola = await colaEstadosDocsApi.listar()
        const propios = cola.filter((c) => c.codigo_estado_doc_destino === estadoDestino)
        const activos = propios.filter((c) => c.estado_cola === 'PENDIENTE' || c.estado_cola === 'EN_PROCESO').length
        setPaso(key, { completados: propios.filter((c) => c.estado_cola === 'COMPLETADO').length })
        if (activos === 0) break
      } catch { /* reintentar */ }
    }
    if (abortRef.current) return false
    setPaso(key, { completados: totalDocs, estado: 'listo' })
    return true
  }

  const ejecutarPipeline = async () => {
    let handleEfectivo = dirHandle
    if (!handleEfectivo || !(await ensureReadPermission(handleEfectivo))) {
      const stored = await getDirectoryHandle()
      if (stored && (await ensureReadPermission(stored))) {
        handleEfectivo = stored
        setDirHandleState(stored)
        await setDirectoryHandle(stored)
      } else {
        try {
          handleEfectivo = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
          setDirHandleState(handleEfectivo)
          await setDirectoryHandle(handleEfectivo)
        } catch { return }
      }
    }
    if (!(await ensureReadPermission(handleEfectivo))) {
      setMensajeError(t('sinPermisoLectura'))
      return
    }
    setMensajeError('')
    abortRef.current = false
    setEjecutando(true)
    setTiempoInicio(Date.now())
    setTiempoTranscurrido(0)
    setProgresos(progresosIniciales())
    try {
      for (const paso of PASOS) {
        if (abortRef.current) break
        const ok = paso.clienteSide
          ? await ejecutarExtraer(handleEfectivo)
          : await ejecutarPasoBackend(paso.key, paso.estadoOrigen, paso.estadoDestino)
        if (!ok) break
      }
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setEjecutando(false)
      await cargarConteos()
    }
  }

  const detener = () => { abortRef.current = true }

  const formatTiempo = (seg: number) => {
    const m = Math.floor(seg / 60)
    const s = seg % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const todosListos = PASOS.every((p) => progresos[p.key]?.estado === 'listo')
  const hayPendientes = PASOS.some((p) => (progresos[p.key]?.total ?? 0) > 0)

  const segmentosBarra = PASOS.map((p) => ({
    color: p.color,
    total: progresos[p.key]?.total ?? 0,
    completados: progresos[p.key]?.completados ?? 0,
    estado: progresos[p.key]?.estado ?? 'esperando',
  }))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-borde">
        <button
          onClick={() => setTab('ubicaciones')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'ubicaciones' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          <FolderOpen size={15} />{t('tabUbicaciones')}
        </button>
        <button
          onClick={() => setTab('documentos')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'documentos' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'}`}
        >
          <Upload size={15} />{t('tabDocumentos')}
        </button>
      </div>

      {/* ── Tab: Ubicaciones ─────────────────────────────────────────────── */}
      {tab === 'ubicaciones' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-borde bg-fondo-tarjeta p-6 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-texto mb-1">{t('sincronizarTitulo')}</p>
              <p className="text-xs text-texto-muted">
                {t('sincronizarDesc')}
              </p>
            </div>

            <Boton
              variante="primario"
              onClick={sincronizarUbicaciones}
              disabled={sincronizando || escaneando}
            >
              {escaneando ? (
                <><RefreshCw size={16} className="animate-spin" />{t('leyendoCarpetas')}</>
              ) : sincronizando ? (
                <><RefreshCw size={16} className="animate-spin" />{t('sincronizando')}</>
              ) : (
                <><FolderOpen size={16} />{t('sincronizarCarpetas')}</>
              )}
            </Boton>

            {!resultadoSync && !errorSync && carpetaRaiz && (
              <p className="text-xs text-texto-muted">
                {t('pedirAcceso')}{' '}
                <strong className="text-texto">{carpetaRaiz}</strong> {t('noSubcarpetas')}
              </p>
            )}

            {errorSync && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {errorSync}
              </div>
            )}

            {resultadoSync && (
              <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle size={16} className="mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{t('sincronizacionCompletada')}</span>
                  <span>
                    {t('sincronizacionDetalle', { insertadas: resultadoSync.insertadas, actualizadas: resultadoSync.actualizadas, eliminadas: resultadoSync.eliminadas })}
                    {resultadoSync.excluidas > 0 && ` ${t('excluidas', { n: resultadoSync.excluidas })}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-texto-muted">
            {t('irADocumentos')} <strong>{t('tabDocumentosRef')}</strong> {t('irADocumentosParaProcesar')}
          </p>
        </div>
      )}

      {/* ── Tab: Documentos ──────────────────────────────────────────────── */}
      {tab === 'documentos' && (
        <div className="flex flex-col gap-6">
          {/* Directorio */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-texto">{t('directorioDocumentos')}</p>
              {!dirHandle && carpetaRaiz && (
                <p className="text-xs text-texto-muted">
                  {t('seleccionarCarpetaRaiz')} <strong className="text-texto">{carpetaRaiz}</strong>
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
                  setDirHandleState(handle)
                  await setDirectoryHandle(handle)
                } catch { /* cancelado */ }
              }}
              className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors"
            >
              <FolderOpen size={16} className={dirHandle ? 'text-primario' : 'text-texto-muted'} />
              {dirHandle ? dirHandle.name : t('seleccionarDirectorio')}
            </button>
          </div>

          {mensajeError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />{mensajeError}
            </div>
          )}

          {/* Barra de progreso horizontal segmentada */}
          <div className="flex flex-col gap-3">
            <BarraProgresoPipeline segmentos={segmentosBarra} altura={36} />

            {/* Conteos por paso */}
            {(ejecutando || hayPendientes) && (
              <div className="grid grid-cols-5 gap-2">
                {PASOS.map((paso) => {
                  const prog = progresos[paso.key]
                  const total = prog?.total ?? 0
                  const completados = prog?.completados ?? 0
                  const estado = prog?.estado ?? 'esperando'
                  return (
                    <div key={paso.key} className="flex flex-col items-center gap-0.5">
                      <span
                        className="text-lg font-bold"
                        style={{ color: estado === 'esperando' && total === 0 ? '#9CA3AF' : paso.color }}
                      >
                        {estado === 'listo' ? total : completados}
                        {total > 0 && estado !== 'listo' && (
                          <span className="text-xs font-normal text-texto-muted">/{total}</span>
                        )}
                      </span>
                      {estado === 'listo' && (
                        <CheckCircle size={12} style={{ color: paso.color }} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Timer */}
          {(ejecutando || todosListos) && (
            <p className="text-center text-sm text-texto-muted">
              {ejecutando
                ? t('procesando', { tiempo: formatTiempo(tiempoTranscurrido) })
                : t('completadoEn', { tiempo: formatTiempo(tiempoTranscurrido) })}
            </p>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            {!ejecutando ? (
              <Boton variante="primario" className="flex-1" onClick={ejecutarPipeline}>
                <Upload size={16} />
                {todosListos ? t('cargarDeNuevo') : t('cargarDocumentos')}
              </Boton>
            ) : (
              <Boton variante="peligro" className="flex-1" onClick={detener}>
                {t('detener')}
              </Boton>
            )}
          </div>

          {!ejecutando && !todosListos && hayPendientes && (
            <p className="text-xs text-texto-muted text-center">
              {t('procesarAutomatico')}
            </p>
          )}

          {!ejecutando && !hayPendientes && !todosListos && (
            <p className="text-xs text-texto-muted text-center">
              {t('sinDocumentosPendientes')} <strong>{t('sinDocumentosPendientesBtn')}</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
