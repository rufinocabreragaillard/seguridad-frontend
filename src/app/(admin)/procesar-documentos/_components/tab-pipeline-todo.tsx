'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { FolderOpen } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { CirculoProgreso } from '@/components/ui/circulo-progreso'
import { documentosApi, colaEstadosDocsApi, ubicacionesDocsApi } from '@/lib/api'
import { extraerTextoDeArchivo, abrirArchivoPorRuta } from '@/lib/extraer-texto'
import { getDirectoryHandle, setDirectoryHandle, ensureReadPermission } from '@/lib/file-handle-store'
import { useAuth } from '@/context/AuthContext'

const PASOS = [
  { key: 'EXTRAER',    nombre: 'EXTRAER',    estadoOrigen: 'CARGADO',   estadoDestino: 'METADATA',    colorDisco: '#EF4444', clienteSide: true },
  { key: 'ANALIZAR',   nombre: 'ANALIZAR',   estadoOrigen: 'METADATA',  estadoDestino: 'ESCANEADO',   colorDisco: '#F97316', clienteSide: false },
  { key: 'CHUNKEAR',   nombre: 'CHUNKEAR',   estadoOrigen: 'ESCANEADO', estadoDestino: 'CHUNKEADO',   colorDisco: '#84CC16', clienteSide: false },
  { key: 'VECTORIZAR', nombre: 'VECTORIZAR', estadoOrigen: 'CHUNKEADO', estadoDestino: 'VECTORIZADO', colorDisco: '#22C55E', clienteSide: false },
] as const

type EstadoPaso = 'esperando' | 'activo' | 'listo' | 'error'
interface ProgresoPaso { total: number; completados: number; estado: EstadoPaso; error?: string }

const progresosIniciales = (): Record<string, ProgresoPaso> =>
  Object.fromEntries(PASOS.map((p) => [p.key, { total: 0, completados: 0, estado: 'esperando' }]))

export function TabPipelineTodo() {
  const { grupoActivo } = useAuth()

  const [progresos, setProgresos] = useState<Record<string, ProgresoPaso>>(progresosIniciales)
  const [ejecutando, setEjecutando] = useState(false)
  const [dirHandle, setDirHandleState] = useState<FileSystemDirectoryHandle | null>(null)
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [mensajeError, setMensajeError] = useState('')
  const [carpetaRaiz, setCarpetaRaiz] = useState<string>('')

  const abortRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const seleccionarDirectorio = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
      setDirHandleState(handle)
      await setDirectoryHandle(handle)
    } catch { /* usuario canceló */ }
  }

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
    const docs = await documentosApi.listar({ codigo_estado_doc: estadoOrigen, activo: true })
    if (docs.length === 0) { setPaso(key, { estado: 'listo' }); return true }
    setPaso(key, { total: docs.length, completados: 0, estado: 'activo' })
    const items = docs.map((d) => ({ codigo_documento: d.codigo_documento, codigo_estado_doc_destino: estadoDestino }))
    await colaEstadosDocsApi.inicializar(items)
    await colaEstadosDocsApi.ejecutar(estadoDestino)
    const idsSet = new Set(docs.map((d) => d.codigo_documento))
    while (!abortRef.current) {
      await new Promise((r) => setTimeout(r, 3000))
      if (abortRef.current) return false
      try {
        const cola = await colaEstadosDocsApi.listar()
        const propios = cola.filter((c) => idsSet.has(c.codigo_documento) && c.codigo_estado_doc_destino === estadoDestino)
        const activos = propios.filter((c) => c.estado_cola === 'PENDIENTE' || c.estado_cola === 'EN_PROCESO').length
        const completados = propios.filter((c) => c.estado_cola === 'COMPLETADO').length
        setPaso(key, { completados })
        if (activos === 0) break
      } catch { /* reintentar */ }
    }
    if (abortRef.current) return false
    setPaso(key, { completados: docs.length, estado: 'listo' })
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
      setMensajeError('Sin permiso de lectura sobre el directorio seleccionado.')
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
      setMensajeError(e instanceof Error ? e.message : 'Error inesperado en el pipeline')
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

  return (
    <div className="flex flex-col gap-8">
      {/* Selector de directorio */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-texto-muted">
          Ejecuta el pipeline completo: Extraer → Resumir → Escanear → Chunkear → Vectorizar
        </p>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={seleccionarDirectorio}
            className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors"
          >
            <FolderOpen size={16} className={dirHandle ? 'text-primario' : 'text-texto-muted'} />
            {dirHandle ? dirHandle.name : 'Seleccionar directorio'}
          </button>
          {!dirHandle && carpetaRaiz && (
            <span className="text-xs text-texto-muted text-right">
              Al ejecutar se pedirá acceso. Selecciona: <strong className="text-texto">{carpetaRaiz}</strong> (no subcarpetas)
            </span>
          )}
        </div>
      </div>

      {mensajeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {/* Pipeline visual — círculos */}
      <div className="flex items-center justify-center gap-0 flex-wrap">
        {PASOS.map((paso, i) => {
          const prog = progresos[paso.key]
          return (
            <div key={paso.key} className="flex items-center">
              <CirculoProgreso
                nombre={paso.nombre}
                total={prog.total}
                completados={prog.completados}
                estado={prog.estado}
                colorDisco={paso.colorDisco}
                size={148}
              />
              {i < PASOS.length - 1 && (
                <div className="flex items-center px-2">
                  <svg width="40" height="16" viewBox="0 0 40 16">
                    <line x1="0" y1="8" x2="30" y2="8" stroke="#9CA3AF" strokeWidth="2" />
                    <polygon points="28,4 36,8 28,12" fill="#9CA3AF" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(ejecutando || todosListos) && (
        <p className="text-center text-sm text-texto-muted">
          {ejecutando
            ? `Tiempo transcurrido: ${formatTiempo(tiempoTranscurrido)}`
            : `Pipeline completado en ${formatTiempo(tiempoTranscurrido)}`}
        </p>
      )}

      <div className="flex gap-3 justify-center">
        {!ejecutando ? (
          <Boton variante="primario" onClick={ejecutarPipeline}>
            {todosListos ? 'Procesar de nuevo' : 'Procesar Todo'}
          </Boton>
        ) : (
          <Boton variante="peligro" onClick={detener}>Detener</Boton>
        )}
      </div>

      {!ejecutando && !todosListos && (
        <div className="rounded-lg border border-borde bg-fondo-tarjeta p-4">
          <p className="text-xs font-semibold text-texto-muted uppercase mb-3">Documentos por procesar</p>
          <div className="grid grid-cols-5 gap-2">
            {PASOS.map((paso) => {
              const total = progresos[paso.key]?.total ?? 0
              return (
                <div key={paso.key} className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold" style={{ color: total > 0 ? paso.colorDisco : '#9CA3AF' }}>
                    {total}
                  </span>
                  <span className="text-xs text-texto-muted text-center leading-tight">{paso.nombre}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
