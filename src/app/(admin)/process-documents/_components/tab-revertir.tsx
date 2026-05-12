'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Play, AlertTriangle, Loader2, ChevronDown, ChevronRight, X, CheckCircle, FolderOpen, Search, Square } from 'lucide-react'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { Boton } from '@/components/ui/boton'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { documentosApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import type { Documento, EstadoDoc } from '@/lib/tipos'

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  url: string
  nivel: number
  tipo_ubicacion?: 'AREA' | 'CONTENIDO'
  codigo_ubicacion_superior?: string
}

const DOCS_POR_PAGINA = 20

interface TabRevertirProps {
  procesos?: ProcesoCatalogo[]
  procesosCorregir?: ProcesoCatalogo[]
  ubicaciones?: UbicacionOption[]
  estadosDocs?: EstadoDoc[]
}

export function TabRevertir({ procesos: procesosProp = [], procesosCorregir: procesosCorregirProp = [], ubicaciones: ubicacionesProp = [], estadosDocs: estadosDocsProp = [] }: TabRevertirProps) {
  const tc = useTranslations('common')
  const tpdx = useTranslations('processDocumentsExtra')
  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([...procesosProp])
  const [procesosCorregir, setProcesosCorregir] = useState<ProcesoCatalogo[]>([...procesosCorregirProp])
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>(ubicacionesProp)
  const [estadosDocs, setEstadosDocs] = useState<EstadoDoc[]>([...estadosDocsProp])

  // Filtros
  const [procesoSel, setProcesoSel] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')   // override de estado (igual que Paso a Paso)
  const [filtroLibreInput, setFiltroLibreInput] = useState('')
  const [filtroLibre, setFiltroLibre] = useState('')
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicBusqueda, setUbicBusqueda] = useState('')
  const [ubicDropdownOpen, setUbicDropdownOpen] = useState(false)
  const [ubicExpandidos, setUbicExpandidos] = useState<Set<string>>(new Set())
  const [tope, setTope] = useState('')
  const ubicDropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownProcesoAbierto, setDropdownProcesoAbierto] = useState(false)
  const dropdownProcesoRef = useRef<HTMLDivElement>(null)

  // Documentos candidatos
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [yaCargado, setYaCargado] = useState(false)

  // Ejecución
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmEjecutar, setConfirmEjecutar] = useState(false)

  const pasoActual = useMemo(() => {
    if (!procesoSel) return null
    return (
      procesos.find((x) => String(x.id_transicion) === procesoSel) ??
      procesosCorregir.find((x) => String(x.id_transicion) === procesoSel) ??
      null
    )
  }, [procesos, procesosCorregir, procesoSel])

  const rutaUbicacion = useMemo(() => {
    if (!ubicacionSel) return undefined
    return ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)?.url
  }, [ubicacionSel, ubicaciones])

  // Sincronizar props cuando cambian (ej. cambio de grupo)
  useEffect(() => { if (procesosProp.length > 0) setProcesos([...procesosProp]) }, [procesosProp])
  useEffect(() => { if (procesosCorregirProp.length > 0) setProcesosCorregir([...procesosCorregirProp]) }, [procesosCorregirProp])
  useEffect(() => { if (ubicacionesProp.length > 0) setUbicaciones(ubicacionesProp) }, [ubicacionesProp])
  // Estados en orden inverso del pipeline
  useEffect(() => { if (estadosDocsProp.length > 0) setEstadosDocs([...estadosDocsProp]) }, [estadosDocsProp])

  // Click-outside dropdown ubicación
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ubicDropdownRef.current && !ubicDropdownRef.current.contains(e.target as Node)) {
        setUbicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Click-outside dropdown proceso
  useEffect(() => {
    if (!dropdownProcesoAbierto) return
    const handler = (e: MouseEvent) => {
      if (dropdownProcesoRef.current && !dropdownProcesoRef.current.contains(e.target as Node)) {
        setDropdownProcesoAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownProcesoAbierto])

  // Al abrir el dropdown de ubicaciones, expandir automáticamente las raíces
  // para que se vea desde el inicio el árbol (no quedar en blanco esperando filtro).
  useEffect(() => {
    if (!ubicDropdownOpen) return
    const raices = ubicaciones.filter(u => !u.codigo_ubicacion_superior).map(u => u.codigo_ubicacion)
    if (raices.length === 0) return
    setUbicExpandidos(prev => {
      const next = new Set(prev)
      let cambio = false
      for (const cod of raices) {
        if (!next.has(cod)) { next.add(cod); cambio = true }
      }
      return cambio ? next : prev
    })
  }, [ubicDropdownOpen, ubicaciones])

  const cargarDocumentos = useCallback(async (pagina: number = 1) => {
    const estadoOrigen = estadoFiltro || pasoActual?.estado_origen || undefined
    if (!estadoOrigen && !filtroLibre) return
    setCargando(true)
    setError(null)
    try {
      const data = await documentosApi.listarPaginado({
        page: pagina,
        limit: DOCS_POR_PAGINA,
        codigo_estado_doc: estadoOrigen,
        q: filtroLibre || undefined,
        ruta_prefijo: rutaUbicacion,
      })
      setDocumentos(data.items || [])
      setTotalDocs(data.total)
      setPaginaActual(pagina)
      setTotalPaginas(Math.max(1, Math.ceil(data.total / DOCS_POR_PAGINA)))
      setYaCargado(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la lista de documentos.')
    } finally {
      setCargando(false)
    }
  }, [pasoActual, estadoFiltro, filtroLibre, rutaUbicacion])

  // Carga automática al cambiar proceso/estado/ubicación/filtroLibre (igual que Paso a Paso)
  useEffect(() => {
    if (!procesoSel && !estadoFiltro && !filtroLibre) return
    setDocumentos([])
    setResultado(null)
    setYaCargado(false)
    cargarDocumentos(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoSel, estadoFiltro, ubicacionSel, filtroLibre])

  const ejecutar = async () => {
    const estadoOrigen = estadoFiltro || pasoActual?.estado_origen
    const estadoDestino = pasoActual?.estado_destino
    if (!estadoOrigen || !estadoDestino) return
    setEjecutando(true)
    setConfirmEjecutar(false)
    setError(null)
    try {
      const r = await documentosApi.revertir({
        estados_origen: [estadoOrigen],
        estado_destino: estadoDestino,
        q: filtroLibre || undefined,
        codigo_ubicacion: ubicacionSel || undefined,
        tope: tope ? parseInt(tope) : undefined,
        solo_contar: false,
      })
      setResultado(r.revertidos)
      setDocumentos([])
      setTotalDocs(0)
      setYaCargado(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al ejecutar el proceso de reversa.')
    } finally {
      setEjecutando(false)
    }
  }

  const esEliminacion = pasoActual?.estado_destino === 'ELIMINADO'

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  return (
    <div className="flex flex-col gap-6 w-full overflow-x-hidden">
      <Tarjeta>
        <TarjetaContenido>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Proceso */}
            <div className="flex flex-col gap-1.5 min-w-0" ref={dropdownProcesoRef}>
              <label className="text-sm font-medium text-texto">Proceso</label>
              <div className="relative">
                <button
                  type="button"
                  disabled={ejecutando}
                  onClick={() => setDropdownProcesoAbierto((v) => !v)}
                  className={`${selectClass} flex items-center justify-between gap-2 text-left`}
                >
                  <span className="truncate">
                    {(() => {
                      if (!procesoSel) return <span className="text-texto-muted">— Sin valor —</span>
                      const p = [...procesos, ...procesosCorregir].find((x) => String(x.id_transicion) === procesoSel)
                      if (!p) return procesoSel
                      const flecha = `${p.estado_origen || '—'} → ${p.estado_destino}`
                      return (
                        <span>
                          {p.nombre_proceso}<span className="text-xs text-texto-muted ml-1">({flecha})</span>
                        </span>
                      )
                    })()}
                  </span>
                  <ChevronDown size={14} className="shrink-0 text-texto-muted" />
                </button>
                {dropdownProcesoAbierto && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-fondo border border-borde rounded-md shadow-lg py-1 max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro text-texto-muted"
                      onClick={() => { setProcesoSel(''); setEstadoFiltro(''); setDropdownProcesoAbierto(false) }}
                    >
                      — Sin valor —
                    </button>
                    {procesos.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-texto-muted uppercase tracking-wide">{tpdx('reversaDeExito')}</div>
                        {procesos.map((p) => {
                          const flecha = `${p.estado_origen || '—'} → ${p.estado_destino}`
                          const selec = procesoSel === String(p.id_transicion)
                          return (
                            <button
                              key={p.id_transicion ?? p.codigo_proceso}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro flex items-baseline gap-1 ${selec ? 'bg-primario-muy-claro font-medium' : ''}`}
                              onClick={() => {
                                const val = String(p.id_transicion)
                                setProcesoSel(val)
                                if (p.estado_origen) setEstadoFiltro(p.estado_origen)
                                setDropdownProcesoAbierto(false)
                              }}
                            >
                              <span className="text-texto">{p.nombre_proceso}</span>
                              <span className="text-xs text-texto-muted">({flecha})</span>
                            </button>
                          )
                        })}
                      </>
                    )}
                    {procesosCorregir.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-texto-muted uppercase tracking-wide border-t border-borde mt-1">{tpdx('corregirInvalidos')}</div>
                        {procesosCorregir.map((p) => {
                          const flecha = `${p.estado_origen || '—'} → ${p.estado_destino}`
                          const selec = procesoSel === String(p.id_transicion)
                          return (
                            <button
                              key={p.id_transicion ?? p.codigo_proceso}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro flex items-baseline gap-1 ${selec ? 'bg-primario-muy-claro font-medium' : ''}`}
                              onClick={() => {
                                const val = String(p.id_transicion)
                                setProcesoSel(val)
                                if (p.estado_origen) setEstadoFiltro(p.estado_origen)
                                setDropdownProcesoAbierto(false)
                              }}
                            >
                              <span className="text-texto">{p.nombre_proceso}</span>
                              <span className="text-xs text-texto-muted">({flecha})</span>
                            </button>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Estado — filtro libre, independiente del proceso */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">Estado</label>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className={selectClass}
                disabled={ejecutando}
              >
                <option value="">— Todos —</option>
                {(() => {
                  const validos = estadosDocs.filter(e => !e.codigo_estado_doc.startsWith('NO_') && !['REVISAR','ELIMINADO'].includes(e.codigo_estado_doc))
                  const noValidos = estadosDocs.filter(e => e.codigo_estado_doc.startsWith('NO_') || ['REVISAR','ELIMINADO'].includes(e.codigo_estado_doc))
                  return (
                    <>
                      {validos.map((e) => <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>{e.nombre_estado || e.codigo_estado_doc}</option>)}
                      {noValidos.length > 0 && validos.length > 0 && <option disabled>──────────────</option>}
                      {noValidos.map((e) => <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>{e.nombre_estado || e.codigo_estado_doc}</option>)}
                    </>
                  )
                })()}
              </select>
            </div>

            {/* Ubicación */}
            <div className="flex flex-col gap-1.5 min-w-0" ref={ubicDropdownRef}>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-texto">Ubicación</label>
                <span className="text-xs text-texto-muted">Hasta 5 niveles</span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => !ejecutando && setUbicDropdownOpen(!ubicDropdownOpen)}
                  disabled={ejecutando}
                  className="flex items-center gap-2 rounded-lg border border-borde bg-fondo-tarjeta px-4 py-2 text-sm text-texto hover:border-primario transition-colors w-full disabled:opacity-50"
                >
                  <FolderOpen size={16} className={ubicacionSel ? 'text-primario shrink-0' : 'text-texto-muted shrink-0'} />
                  <span className="flex-1 text-left truncate">
                    {ubicacionSel
                      ? (ubicaciones.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion || tc('seleccionarUbicacion'))
                      : tc('seleccionarUbicacion')}
                  </span>
                  {ubicacionSel ? (
                    <X
                      size={13}
                      className="text-texto-muted hover:text-error shrink-0"
                      onClick={(e) => { e.stopPropagation(); setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                    />
                  ) : (
                    <ChevronDown size={13} className="text-texto-muted shrink-0" />
                  )}
                </button>
                {ubicDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-borde rounded-lg shadow-lg flex flex-col" style={{ maxHeight: '18rem' }}>
                    <div className="p-2 border-b border-borde shrink-0">
                      <input
                        type="text"
                        placeholder={tc('buscarUbicacion')}
                        value={ubicBusqueda}
                        onChange={(e) => setUbicBusqueda(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm border border-borde rounded px-2 py-1 bg-fondo text-texto focus:outline-none focus:ring-1 focus:ring-primario placeholder:text-texto-muted"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <div
                        className="px-3 py-2 hover:bg-fondo cursor-pointer text-sm text-texto-muted border-b border-borde"
                        onClick={() => { setUbicacionSel(''); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                      >
                        Todas
                      </div>
                      {(() => {
                        const tieneHijosUbic = (cod: string) => ubicaciones.some(u => u.codigo_ubicacion !== cod && u.codigo_ubicacion_superior === cod)
                        if (ubicBusqueda) {
                          const filtradas = ubicaciones.filter(u =>
                            u.nombre_ubicacion.toLowerCase().includes(ubicBusqueda.toLowerCase()) ||
                            (u.url || '').toLowerCase().includes(ubicBusqueda.toLowerCase())
                          )
                          if (filtradas.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">Sin coincidencias</div>
                          return filtradas.map(u => {
                            const esArea = u.tipo_ubicacion === 'AREA'
                            const selec = ubicacionSel === u.codigo_ubicacion
                            return (
                              <div
                                key={u.codigo_ubicacion}
                                className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer ${selec ? 'bg-primario-muy-claro' : ''}`}
                                style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }}
                                onClick={() => { setUbicacionSel(u.codigo_ubicacion); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                              >
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
                                <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? tc('area') : tpdx('contenido')}</span>
                              </div>
                            )
                          })
                        }
                        const toggleExpandirUbic = (e: React.MouseEvent, cod: string) => {
                          e.stopPropagation()
                          setUbicExpandidos(prev => { const next = new Set(prev); next.has(cod) ? next.delete(cod) : next.add(cod); return next })
                        }
                        const renderNodoUbic = (u: UbicacionOption): React.ReactNode => {
                          const tieneHijos = tieneHijosUbic(u.codigo_ubicacion)
                          const expandido = ubicExpandidos.has(u.codigo_ubicacion)
                          const esArea = u.tipo_ubicacion === 'AREA'
                          const selec = ubicacionSel === u.codigo_ubicacion
                          const hijos = tieneHijos
                            ? ubicaciones
                                .filter(h => h.codigo_ubicacion_superior === u.codigo_ubicacion)
                                .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
                            : []
                          return (
                            <div key={u.codigo_ubicacion}>
                              <div
                                className={`flex items-center gap-2 py-1.5 pr-3 hover:bg-fondo cursor-pointer select-none ${selec ? 'bg-primario-muy-claro' : ''}`}
                                style={{ paddingLeft: `${(u.nivel || 0) * 16 + 12}px` }}
                                onClick={() => { setUbicacionSel(u.codigo_ubicacion); setUbicBusqueda(''); setUbicDropdownOpen(false) }}
                              >
                                {tieneHijos
                                  ? <button onClick={(e) => toggleExpandirUbic(e, u.codigo_ubicacion)} className="shrink-0 hover:text-primario text-texto-muted p-0.5 -ml-0.5 rounded">
                                      {expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </button>
                                  : <span className="w-3 shrink-0" />
                                }
                                <FolderOpen size={13} className={`shrink-0 ${selec ? 'text-primario' : esArea ? 'text-sky-500' : 'text-amber-400'}`} />
                                <span className={`text-sm truncate flex-1 ${selec ? 'text-primario font-medium' : 'text-texto'}`}>{u.nombre_ubicacion}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? tc('area') : tpdx('contenido')}</span>
                              </div>
                              {expandido && hijos.map(h => renderNodoUbic(h))}
                            </div>
                          )
                        }
                        const raicesUbic = ubicaciones
                          .filter(u => !u.codigo_ubicacion_superior)
                          .sort((a, b) => a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
                        if (raicesUbic.length === 0) return <div className="px-3 py-4 text-sm text-texto-muted text-center">Sin ubicaciones</div>
                        return raicesUbic.map(u => renderNodoUbic(u))
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filtro libre + Tope */}
          <div className="flex items-end gap-3 mt-3 flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-texto">Filtro libre</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={tpdx('filtrarPlaceholder')}
                  value={filtroLibreInput}
                  onChange={(e) => setFiltroLibreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setFiltroLibre(filtroLibreInput)
                  }}
                  disabled={ejecutando}
                  className="flex-1 text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
                />
                {filtroLibreInput && (
                  <button
                    type="button"
                    onClick={() => { setFiltroLibreInput(''); setFiltroLibre('') }}
                    disabled={ejecutando}
                    className="px-2 rounded-lg border border-borde text-texto-muted hover:text-error hover:border-error transition-colors disabled:opacity-50"
                    title="Limpiar filtro"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-texto-muted">Tope:</span>
              <input
                type="number"
                min={1}
                placeholder="todos"
                value={tope}
                onChange={(e) => setTope(e.target.value)}
                disabled={ejecutando}
                className="w-20 text-xs border border-borde rounded px-1.5 py-2 text-center bg-surface text-texto focus:outline-none focus:ring-1 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
              />
            </div>
          </div>

          {/* Barra inferior: conteo + Ejecutar */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde flex-wrap">
            <span className="text-sm text-texto-muted">
              {cargando
                ? tc('cargando2')
                : yaCargado
                  ? `${totalDocs} documento${totalDocs !== 1 ? 's' : ''} en estado ${estadoFiltro || pasoActual?.estado_origen || '—'}`
                  : ''}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <Boton
                variante={esEliminacion ? 'peligro' : 'primario'}
                onClick={() => setConfirmEjecutar(true)}
                disabled={ejecutando || !pasoActual || totalDocs === 0 || cargando}
              >
                {ejecutando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {ejecutando
                  ? (esEliminacion ? tc('eliminando') : tc('ejecutando'))
                  : totalDocs > 0
                    ? (esEliminacion ? `Eliminar (${totalDocs})` : `Ejecutar (${totalDocs})`)
                    : (esEliminacion ? 'Eliminar' : 'Ejecutar')}
              </Boton>
              <Boton variante="contorno" onClick={() => {}} disabled={!ejecutando}>
                <Square size={14} />Detener
              </Boton>
            </div>
          </div>
        </TarjetaContenido>
      </Tarjeta>

      {/* Resultado exitoso */}
      {resultado !== null && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle size={18} className="text-exito shrink-0" />
          <div>
            <p className="font-medium text-texto">Proceso completado</p>
            <p className="text-sm text-texto-muted">
              {esEliminacion
                ? `${resultado} documento${resultado !== 1 ? 's' : ''} eliminado${resultado !== 1 ? 's' : ''} desde ${pasoActual?.estado_origen || '—'}.`
                : `${resultado} documento${resultado !== 1 ? 's' : ''} revertido${resultado !== 1 ? 's' : ''}${pasoActual ? ` de ${pasoActual.estado_origen || '—'} a ${pasoActual.estado_destino}` : ''}.`
              }
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-error">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}

      {/* Lista de documentos */}
      {(yaCargado || cargando) && (
        <>
          {yaCargado && totalDocs > 0 && (
            <div className="flex items-center">
              <span className="text-xs text-texto-muted">
                {totalDocs} documento{totalDocs !== 1 ? 's' : ''}
                {pasoActual ? (esEliminacion ? ` a eliminar desde ${pasoActual.estado_origen}` : ` de ${pasoActual.estado_origen} → ${pasoActual.estado_destino}`) : ''}
              </span>
            </div>
          )}
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>Documento</TablaTh>
                <TablaTh>Ubicación</TablaTh>
                <TablaTh>Estado actual</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila>
                  <TablaTd colSpan={3 as never} className="py-8 text-center text-texto-muted">
                    <Loader2 size={16} className="animate-spin inline mr-2" />{tc('cargando2')}
                  </TablaTd>
                </TablaFila>
              ) : documentos.length === 0 ? (
                <TablaFila>
                  <TablaTd colSpan={3 as never} className="py-8 text-center text-texto-muted">
                    No hay documentos en ese estado
                  </TablaTd>
                </TablaFila>
              ) : (
                documentos.map((d) => (
                  <TablaFila key={d.codigo_documento}>
                    <TablaTd className="max-w-0 w-[40%]">
                      <div className="flex items-center gap-2 min-w-0">
                        {iconoTipoArchivo(d.nombre_documento)}
                        <span className="font-medium text-sm truncate" title={d.nombre_documento}>{d.nombre_documento}</span>
                      </div>
                    </TablaTd>
                    <TablaTd className="text-xs text-texto-muted max-w-0 w-[35%] truncate" title={d.ubicacion_documento || ''}>
                      {d.ubicacion_documento || '—'}
                    </TablaTd>
                    <TablaTd>
                      <Insignia variante="advertencia">{d.codigo_estado_doc || '—'}</Insignia>
                    </TablaTd>
                  </TablaFila>
                ))
              )}
            </TablaCuerpo>
          </Tabla>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-xs text-texto-muted mt-1">
              <span>
                {(paginaActual - 1) * DOCS_POR_PAGINA + 1}–{Math.min(paginaActual * DOCS_POR_PAGINA, totalDocs)} de {totalDocs}
              </span>
              <div className="flex gap-1">
                <button disabled={paginaActual <= 1} onClick={() => cargarDocumentos(1)}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                <button disabled={paginaActual <= 1} onClick={() => cargarDocumentos(paginaActual - 1)}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                <span className="px-3 py-1">{paginaActual} / {totalPaginas}</span>
                <button disabled={paginaActual >= totalPaginas} onClick={() => cargarDocumentos(paginaActual + 1)}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                <button disabled={paginaActual >= totalPaginas} onClick={() => cargarDocumentos(totalPaginas)}
                  className="px-2 py-1 rounded border border-borde hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">»</button>
              </div>
            </div>
          )}
        </>
      )}

      <ModalConfirmar
        abierto={confirmEjecutar}
        titulo={esEliminacion ? tc('confirmarEliminacion') : tc('confirmarReversa')}
        mensaje={
          esEliminacion
            ? `¿ELIMINAR ${totalDocs} documento${totalDocs !== 1 ? 's' : ''} en estado "${estadoFiltro || pasoActual?.estado_origen}"? Se borrarán también su texto extraído, chunks, embeddings y características. Esta acción no se puede deshacer.`
            : `¿Revertir ${totalDocs} documento${totalDocs !== 1 ? 's' : ''}${pasoActual ? ` de "${estadoFiltro || pasoActual.estado_origen}" a "${pasoActual.estado_destino}"` : ''}? Esta acción no se puede deshacer.`
        }
        alConfirmar={ejecutar}
        alCerrar={() => setConfirmEjecutar(false)}
        cargando={ejecutando}
        variante="peligro"
      />
    </div>
  )
}
