'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Play, FileText, CheckCircle, XCircle, Loader2, FolderOpen, Clock, Square, Search, CheckSquare, SquareIcon } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { documentosApi, registroLLMApi, ubicacionesDocsApi, colaEstadosDocsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Documento, RegistroLLM } from '@/lib/tipos'
import { extraerTextoDeArchivo, abrirArchivoPorRuta } from '@/lib/extraer-texto'

type Proceso = 'resumir' | 'escanear'
type Alcance = 'pendientes' | 'ubicacion'

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  ruta_completa: string
  nivel: number
}

interface ItemCola {
  id_cola: number
  codigo_documento: number
  nombre_documento: string
  ubicacion_documento?: string
  estado_cola: string
  resultado?: string | null
  tiempo_ms?: number
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

  // Documentos candidatos
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Cola y ejecución
  const [cola, setCola] = useState<ItemCola[]>([])
  const [ejecutando, setEjecutando] = useState(false)
  const [procesados, setProcesados] = useState(0)
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
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

  // Cargar documentos candidatos
  const cargarDocumentos = useCallback(async () => {
    setCargando(true)
    try {
      const todos = await documentosApi.listar()
      const estadoFiltro = proceso === 'resumir' ? 'CARGADO' : 'RESUMIDO'
      let filtrados = todos.filter((d) => d.activo && d.codigo_estado_doc === estadoFiltro)

      if (alcance === 'ubicacion' && ubicacionSel) {
        const ubic = ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)
        if (ubic?.ruta_completa) {
          filtrados = filtrados.filter((d) => d.ubicacion_documento?.includes(ubic.ruta_completa))
        }
      }

      setDocumentos(filtrados)
      setSeleccionados(new Set(filtrados.map((d) => d.codigo_documento)))
      setCola([])
    } finally {
      setCargando(false)
    }
  }, [proceso, alcance, ubicacionSel, ubicaciones])

  useEffect(() => { cargarDocumentos() }, [cargarDocumentos])

  const toggleSeleccion = (id: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const docsFiltrados = documentos.filter((d) =>
    !busqueda || d.nombre_documento.toLowerCase().includes(busqueda.toLowerCase()) ||
    (d.ubicacion_documento || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const seleccionarTodos = () => setSeleccionados(new Set(docsFiltrados.map((d) => d.codigo_documento)))
  const deseleccionarTodos = () => setSeleccionados(new Set())

  const seleccionarDirectorio = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, string>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'read' })
      setDirHandle(handle)
    } catch { /* cancelado */ }
  }

  // Ejecutar: encolar + procesar
  const ejecutar = async () => {
    if (!modeloId || seleccionados.size === 0) return

    const estadoDestino = proceso === 'resumir' ? 'RESUMIDO' : 'ESCANEADO'

    // 1. Encolar en cola_estados_docs
    const items = Array.from(seleccionados).map((id) => ({
      codigo_documento: id,
      codigo_estado_doc_destino: estadoDestino,
    }))

    let encoladosRes
    try {
      encoladosRes = await colaEstadosDocsApi.inicializar(items)
    } catch {
      return
    }

    if (encoladosRes.encolados === 0) return

    // 2. Obtener ítems PENDIENTES de la cola
    const pendientes = await colaEstadosDocsApi.listar('PENDIENTE')
    const misCola = pendientes.filter((p) =>
      seleccionados.has(p.codigo_documento) && p.codigo_estado_doc_destino === estadoDestino
    )

    // Inicializar vista de cola
    const colaInicial: ItemCola[] = misCola.map((p) => {
      const doc = documentos.find((d) => d.codigo_documento === p.codigo_documento)
      return {
        id_cola: p.id_cola,
        codigo_documento: p.codigo_documento,
        nombre_documento: doc?.nombre_documento || `Doc #${p.codigo_documento}`,
        ubicacion_documento: doc?.ubicacion_documento || undefined,
        estado_cola: 'PENDIENTE',
      }
    })
    setCola(colaInicial)
    setEjecutando(true)
    setProcesados(0)
    abortRef.current = false

    // 3. Procesar uno por uno
    for (let i = 0; i < colaInicial.length; i++) {
      if (abortRef.current) break
      const item = colaInicial[i]

      // Marcar procesando en UI
      setCola((prev) => prev.map((c, idx) => idx === i ? { ...c, estado_cola: 'EN_PROCESO' } : c))

      try {
        let texto: string | undefined
        // Intentar extraer texto si hay directorio seleccionado (opcional)
        if (proceso === 'resumir' && dirHandle && item.ubicacion_documento) {
          try {
            const fileHandle = await abrirArchivoPorRuta(dirHandle, item.ubicacion_documento)
            if (fileHandle) {
              const contenido = await extraerTextoDeArchivo(fileHandle)
              if (contenido) texto = contenido
            }
          } catch { /* sin acceso al archivo, continúa solo con metadatos */ }
        }

        const res = await colaEstadosDocsApi.procesar(item.id_cola, modeloId, texto)

        setCola((prev) => prev.map((c, idx) => idx === i ? {
          ...c,
          estado_cola: res.estado_cola,
          resultado: res.resultado || undefined,
          tiempo_ms: res.tiempo_ms,
        } : c))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error'
        setCola((prev) => prev.map((c, idx) => idx === i ? {
          ...c, estado_cola: 'ERROR', resultado: msg,
        } : c))
      }

      setProcesados((p) => p + 1)
    }

    setEjecutando(false)
  }

  const detener = () => { abortRef.current = true }

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'
  const okCount = cola.filter((c) => c.estado_cola === 'COMPLETADO').length
  const errCount = cola.filter((c) => c.estado_cola === 'ERROR').length

  const iconoEstado = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return <Clock size={16} className="text-texto-muted" />
      case 'EN_PROCESO': return <Loader2 size={16} className="animate-spin text-primario" />
      case 'COMPLETADO': return <CheckCircle size={16} className="text-exito" />
      case 'ERROR': return <XCircle size={16} className="text-error" />
      default: return null
    }
  }

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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Proceso</label>
              <select value={proceso} onChange={(e) => setProceso(e.target.value as Proceso)} className={selectClass} disabled={ejecutando}>
                <option value="resumir">Resumir (CARGADO → RESUMIDO)</option>
                <option value="escanear">Escanear (RESUMIDO → ESCANEADO)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Alcance</label>
              <select value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)} className={selectClass} disabled={ejecutando}>
                <option value="pendientes">Todos los pendientes</option>
                <option value="ubicacion">Por ubicación</option>
              </select>
            </div>

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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-texto">Modelo LLM</label>
              <select value={modeloId} onChange={(e) => setModeloId(Number(e.target.value))} className={selectClass} disabled={ejecutando}>
                {modelos.map((m) => (
                  <option key={m.id_modelo} value={m.id_modelo}>{m.nombre_visible}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde">
            {proceso === 'resumir' && (
              <Boton variante="contorno" tamano="sm" onClick={seleccionarDirectorio} disabled={ejecutando}>
                <FolderOpen size={16} />
                {dirHandle ? `📂 ${dirHandle.name}` : 'Seleccionar directorio (opcional)'}
              </Boton>
            )}
            {proceso === 'resumir' && !dirHandle && (
              <span className="text-xs text-texto-muted">Sin directorio: resumen basado solo en metadatos</span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-texto-muted">
                {seleccionados.size}/{documentos.length} seleccionados
              </span>
              {ejecutando ? (
                <>
                  <Boton variante="primario" disabled>
                    <Loader2 size={16} className="animate-spin" />Procesando...
                  </Boton>
                  <Boton variante="contorno" tamano="sm" onClick={detener}>
                    <Square size={14} />Detener
                  </Boton>
                </>
              ) : (
                <Boton variante="primario" onClick={ejecutar}
                  disabled={seleccionados.size === 0 || !modeloId}>
                  <Play size={16} />Ejecutar
                </Boton>
              )}
            </div>
          </div>
        </TarjetaContenido>
      </Tarjeta>

      {/* Progreso */}
      {cola.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2 bg-fondo rounded-full overflow-hidden">
              <div className="h-full bg-primario transition-all duration-300"
                style={{ width: `${cola.length > 0 ? (procesados / cola.length) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-texto-muted mt-1">{procesados}/{cola.length} procesados</p>
          </div>
          <div className="flex gap-3 text-sm">
            {okCount > 0 && <span className="text-exito flex items-center gap-1"><CheckCircle size={14} />{okCount}</span>}
            {errCount > 0 && <span className="text-error flex items-center gap-1"><XCircle size={14} />{errCount}</span>}
          </div>
        </div>
      )}

      {/* Cola de procesamiento (visible durante/después de ejecución) */}
      {cola.length > 0 && (
        <Tabla>
          <TablaCabecera>
            <tr>
              <TablaTh className="w-10">Estado</TablaTh>
              <TablaTh>Documento</TablaTh>
              <TablaTh>Resultado</TablaTh>
              <TablaTh className="w-20">Tiempo</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {cola.map((c) => (
              <TablaFila key={c.id_cola} className={c.estado_cola === 'COMPLETADO' ? 'bg-green-50/50' : c.estado_cola === 'ERROR' ? 'bg-red-50/50' : ''}>
                <TablaTd>{iconoEstado(c.estado_cola)}</TablaTd>
                <TablaTd>
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-texto-muted shrink-0" />
                    <span className="font-medium text-sm">{c.nombre_documento}</span>
                  </div>
                </TablaTd>
                <TablaTd>
                  <span className={`text-xs max-w-[400px] truncate block ${c.estado_cola === 'ERROR' ? 'text-error' : 'text-texto-muted'}`}>
                    {c.resultado || '—'}
                  </span>
                </TablaTd>
                <TablaTd className="text-xs text-texto-muted">{c.tiempo_ms ? `${c.tiempo_ms}ms` : '—'}</TablaTd>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      {/* Lista de documentos candidatos (visible antes de ejecución) */}
      {cola.length === 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Boton variante="contorno" tamano="sm" onClick={seleccionarTodos} disabled={ejecutando || docsFiltrados.length === 0}>
                <CheckSquare size={14} />Todos
              </Boton>
              <Boton variante="contorno" tamano="sm" onClick={deseleccionarTodos} disabled={ejecutando || seleccionados.size === 0}>
                <SquareIcon size={14} />Ninguno
              </Boton>
            </div>
            <div className="max-w-sm flex-1">
              <Input placeholder="Buscar por nombre o ubicación..." value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
            </div>
          </div>
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh className="w-10" />
                <TablaTh>Documento</TablaTh>
                <TablaTh>Ubicación</TablaTh>
                <TablaTh>Estado</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>Cargando...</TablaTd></TablaFila>
              ) : docsFiltrados.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>
                  {documentos.length === 0
                    ? `No hay documentos en estado ${proceso === 'resumir' ? 'CARGADO' : 'RESUMIDO'}`
                    : 'Sin resultados para la búsqueda'}
                </TablaTd></TablaFila>
              ) : docsFiltrados.map((d) => (
                <TablaFila key={d.codigo_documento}>
                  <TablaTd>
                    <input type="checkbox" checked={seleccionados.has(d.codigo_documento)}
                      onChange={() => toggleSeleccion(d.codigo_documento)} className="rounded border-borde" />
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-texto-muted shrink-0" />
                      <span className="font-medium text-sm">{d.nombre_documento}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted max-w-[250px] truncate">{d.ubicacion_documento || '—'}</TablaTd>
                  <TablaTd><Insignia variante="advertencia">{d.codigo_estado_doc}</Insignia></TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </>
      )}
    </div>
  )
}
