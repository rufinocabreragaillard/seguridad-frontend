'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Play, FileText, Search as SearchIcon, CheckCircle, XCircle, Loader2, FolderOpen } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { documentosApi, registroLLMApi, ubicacionesDocsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, RegistroLLM } from '@/lib/tipos'
import { extraerTextoDeArchivo, abrirArchivoPorRuta } from '@/lib/extraer-texto'

type Proceso = 'resumir' | 'escanear'
type Alcance = 'pendientes' | 'ubicacion' | 'manual'
type EstadoDoc = 'pendiente' | 'procesando' | 'ok' | 'error'

interface DocProceso {
  doc: Documento
  estado: EstadoDoc
  mensaje?: string
  tiempo?: number
  seleccionado: boolean
}

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  ruta_completa: string
  nivel: number
}

export default function PaginaProcesarDocumentos() {
  const { grupoActivo } = useAuth()

  // Config
  const [proceso, setProceso] = useState<Proceso>('resumir')
  const [alcance, setAlcance] = useState<Alcance>('pendientes')
  const [modelos, setModelos] = useState<RegistroLLM[]>([])
  const [modeloId, setModeloId] = useState<number>(0)
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
  const [ubicacionSel, setUbicacionSel] = useState('')

  // Documentos
  const [documentos, setDocumentos] = useState<DocProceso[]>([])
  const [cargando, setCargando] = useState(false)
  const [ejecutando, setEjecutando] = useState(false)
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)

  // Progreso
  const [procesados, setProcesados] = useState(0)
  const [total, setTotal] = useState(0)
  const abortRef = useRef(false)

  // Cargar modelos y ubicaciones
  useEffect(() => {
    const init = async () => {
      const [m, u] = await Promise.all([
        registroLLMApi.listar(),
        ubicacionesDocsApi.listar().catch(() => []),
      ])
      const activos = m.filter((x) => x.activo && x.estado_valido)
      setModelos(activos)
      if (activos.length > 0) setModeloId(activos[0].id_modelo)
      setUbicaciones(
        (u as UbicacionOption[])
          .filter((x: UbicacionOption) => (x as UbicacionOption & { activo?: boolean }).activo !== false)
          .sort((a: UbicacionOption, b: UbicacionOption) => (a.ruta_completa || '').localeCompare(b.ruta_completa || ''))
      )
    }
    init()
  }, [])

  // Cargar documentos según proceso + alcance
  const cargarDocumentos = useCallback(async () => {
    setCargando(true)
    try {
      const todos = await documentosApi.listar()
      const estadoFiltro = proceso === 'resumir' ? 'CARGADO' : 'RESUMIDO'

      let filtrados = todos.filter((d) => d.activo && d.codigo_estado_doc === estadoFiltro)

      if (alcance === 'ubicacion' && ubicacionSel) {
        // Filtrar por ubicación (match parcial en ubicacion_documento)
        const ubic = ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)
        if (ubic?.ruta_completa) {
          filtrados = filtrados.filter((d) => d.ubicacion_documento?.includes(ubic.ruta_completa))
        }
      }

      setDocumentos(filtrados.map((d) => ({ doc: d, estado: 'pendiente' as EstadoDoc, seleccionado: true })))
    } finally {
      setCargando(false)
    }
  }, [proceso, alcance, ubicacionSel, ubicaciones])

  useEffect(() => { cargarDocumentos() }, [cargarDocumentos])

  const toggleSeleccion = (idx: number) => {
    setDocumentos((prev) => prev.map((d, i) => i === idx ? { ...d, seleccionado: !d.seleccionado } : d))
  }

  const toggleTodos = () => {
    const todosSeleccionados = documentos.every((d) => d.seleccionado)
    setDocumentos((prev) => prev.map((d) => ({ ...d, seleccionado: !todosSeleccionados })))
  }

  // Seleccionar directorio raíz para leer archivos
  const seleccionarDirectorio = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, string>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'read' })
      setDirHandle(handle)
    } catch {
      // Usuario canceló
    }
  }

  // Ejecutar proceso
  const ejecutar = async () => {
    if (!modeloId) return
    const seleccionados = documentos.filter((d) => d.seleccionado && d.estado === 'pendiente')
    if (seleccionados.length === 0) return

    if (proceso === 'resumir' && !dirHandle) {
      // Necesita acceso al filesystem
      try {
        const handle = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, string>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'read' })
        setDirHandle(handle)
      } catch {
        return
      }
    }

    setEjecutando(true)
    setProcesados(0)
    setTotal(seleccionados.length)
    abortRef.current = false

    for (let i = 0; i < documentos.length; i++) {
      if (abortRef.current) break
      if (!documentos[i].seleccionado || documentos[i].estado !== 'pendiente') continue

      // Marcar como procesando
      setDocumentos((prev) => prev.map((d, idx) => idx === i ? { ...d, estado: 'procesando' } : d))

      try {
        if (proceso === 'resumir') {
          // Extraer texto del archivo
          const ruta = documentos[i].doc.ubicacion_documento
          if (!ruta || !dirHandle) throw new Error('Sin ubicación o directorio')

          const fileHandle = await abrirArchivoPorRuta(dirHandle, ruta)
          if (!fileHandle) throw new Error(`Archivo no encontrado: ${ruta}`)

          const texto = await extraerTextoDeArchivo(fileHandle)
          if (!texto) throw new Error('Formato no soportado para extracción de texto')

          const res = await documentosApi.resumir(documentos[i].doc.codigo_documento, texto, modeloId)
          setDocumentos((prev) => prev.map((d, idx) => idx === i ? {
            ...d, estado: 'ok', mensaje: res.resumen.substring(0, 100) + '...', tiempo: res.tiempo_ms,
          } : d))
        } else {
          // Escanear
          const res = await documentosApi.escanear(documentos[i].doc.codigo_documento, modeloId)
          const tags = res.clasificaciones.map((c) => `${c.categoria}:${c.valor}`).join(', ')
          setDocumentos((prev) => prev.map((d, idx) => idx === i ? {
            ...d, estado: 'ok', mensaje: tags || 'Sin clasificaciones', tiempo: res.tiempo_ms,
          } : d))
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        setDocumentos((prev) => prev.map((d, idx) => idx === i ? { ...d, estado: 'error', mensaje: msg } : d))
      }

      setProcesados((p) => p + 1)
    }

    setEjecutando(false)
  }

  const detener = () => { abortRef.current = true }

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'
  const okCount = documentos.filter((d) => d.estado === 'ok').length
  const errCount = documentos.filter((d) => d.estado === 'error').length
  const selCount = documentos.filter((d) => d.seleccionado && d.estado === 'pendiente').length

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Procesamiento de Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">Ejecuta procesos LLM sobre documentos del grupo</p>
      </div>

      {/* Configuración */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Proceso */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Proceso</label>
              <select value={proceso} onChange={(e) => setProceso(e.target.value as Proceso)} className={selectClass} disabled={ejecutando}>
                <option value="resumir">Resumir (CARGADO → RESUMIDO)</option>
                <option value="escanear">Escanear (RESUMIDO → ESCANEADO)</option>
              </select>
            </div>

            {/* Alcance */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Alcance</label>
              <select value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)} className={selectClass} disabled={ejecutando}>
                <option value="pendientes">Todos los pendientes</option>
                <option value="ubicacion">Por ubicación</option>
                <option value="manual">Selección manual</option>
              </select>
            </div>

            {/* Ubicación (condicional) */}
            {alcance === 'ubicacion' ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Ubicación</label>
                <select value={ubicacionSel} onChange={(e) => setUbicacionSel(e.target.value)} className={selectClass} disabled={ejecutando}>
                  <option value="">Todas</option>
                  {ubicaciones.map((u) => (
                    <option key={u.codigo_ubicacion} value={u.codigo_ubicacion}>
                      {'—'.repeat(u.nivel || 0)} {u.nombre_ubicacion}
                    </option>
                  ))}
                </select>
              </div>
            ) : <div />}

            {/* Modelo LLM */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Modelo LLM</label>
              <select value={modeloId} onChange={(e) => setModeloId(Number(e.target.value))} className={selectClass} disabled={ejecutando}>
                {modelos.map((m) => (
                  <option key={m.id_modelo} value={m.id_modelo}>{m.nombre_visible}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde">
            {proceso === 'resumir' && (
              <Boton variante="contorno" tamano="sm" onClick={seleccionarDirectorio} disabled={ejecutando}>
                <FolderOpen size={16} />
                {dirHandle ? `📂 ${dirHandle.name}` : 'Seleccionar directorio'}
              </Boton>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-texto-muted">
                {selCount} documento{selCount !== 1 ? 's' : ''} por procesar
              </span>
              {ejecutando ? (
                <Boton variante="contorno" tamano="sm" onClick={detener}>Detener</Boton>
              ) : (
                <Boton variante="primario" onClick={ejecutar} disabled={selCount === 0 || !modeloId || (proceso === 'resumir' && !dirHandle)}>
                  <Play size={16} />Ejecutar
                </Boton>
              )}
            </div>
          </div>
        </TarjetaContenido>
      </Tarjeta>

      {/* Progreso */}
      {(ejecutando || okCount > 0 || errCount > 0) && (
        <div className="flex items-center gap-4">
          {ejecutando && (
            <div className="flex-1">
              <div className="h-2 bg-fondo rounded-full overflow-hidden">
                <div
                  className="h-full bg-primario transition-all duration-300"
                  style={{ width: `${total > 0 ? (procesados / total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-texto-muted mt-1">{procesados}/{total} procesados</p>
            </div>
          )}
          <div className="flex gap-3 text-sm">
            {okCount > 0 && <span className="text-exito flex items-center gap-1"><CheckCircle size={14} />{okCount} exitosos</span>}
            {errCount > 0 && <span className="text-error flex items-center gap-1"><XCircle size={14} />{errCount} con error</span>}
          </div>
        </div>
      )}

      {/* Lista de documentos */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh className="w-10">
              <input type="checkbox" checked={documentos.length > 0 && documentos.every((d) => d.seleccionado)}
                onChange={toggleTodos} disabled={ejecutando} className="rounded border-borde" />
            </TablaTh>
            <TablaTh>Documento</TablaTh>
            <TablaTh>Ubicación</TablaTh>
            <TablaTh>Estado Doc</TablaTh>
            <TablaTh>Proceso</TablaTh>
            <TablaTh>Resultado</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>Cargando documentos...</TablaTd></TablaFila>
          ) : documentos.length === 0 ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>
              No hay documentos en estado {proceso === 'resumir' ? 'CARGADO' : 'RESUMIDO'}
            </TablaTd></TablaFila>
          ) : documentos.map((d, idx) => (
            <TablaFila key={d.doc.codigo_documento} className={d.estado === 'ok' ? 'bg-green-50/50' : d.estado === 'error' ? 'bg-red-50/50' : ''}>
              <TablaTd>
                <input type="checkbox" checked={d.seleccionado} onChange={() => toggleSeleccion(idx)}
                  disabled={ejecutando || d.estado !== 'pendiente'} className="rounded border-borde" />
              </TablaTd>
              <TablaTd>
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-texto-muted shrink-0" />
                  <span className="font-medium text-sm">{d.doc.nombre_documento}</span>
                </div>
              </TablaTd>
              <TablaTd className="text-xs text-texto-muted max-w-[200px] truncate">{d.doc.ubicacion_documento || '—'}</TablaTd>
              <TablaTd><Insignia variante={d.doc.codigo_estado_doc === 'CARGADO' ? 'advertencia' : 'neutro'}>{d.doc.codigo_estado_doc}</Insignia></TablaTd>
              <TablaTd>
                {d.estado === 'procesando' && <Loader2 size={16} className="animate-spin text-primario" />}
                {d.estado === 'ok' && <CheckCircle size={16} className="text-exito" />}
                {d.estado === 'error' && <XCircle size={16} className="text-error" />}
                {d.estado === 'pendiente' && <span className="text-texto-muted text-xs">—</span>}
              </TablaTd>
              <TablaTd>
                {d.mensaje && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs max-w-[300px] truncate ${d.estado === 'error' ? 'text-error' : 'text-texto-muted'}`}>
                      {d.mensaje}
                    </span>
                    {d.tiempo && <span className="text-xs text-texto-muted shrink-0">{d.tiempo}ms</span>}
                  </div>
                )}
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>
    </div>
  )
}
