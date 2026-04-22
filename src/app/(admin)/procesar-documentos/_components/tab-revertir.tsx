'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Play, AlertTriangle, Loader2, ChevronDown, ChevronRight, X, CheckCircle, FolderOpen, Search, Square } from 'lucide-react'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { Boton } from '@/components/ui/boton'
import { Insignia } from '@/components/ui/insignia'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { documentosApi, ubicacionesDocsApi, procesosApi } from '@/lib/api'
import type { Proceso as ProcesoCatalogo } from '@/lib/api'
import type { Documento } from '@/lib/tipos'

interface UbicacionOption {
  codigo_ubicacion: string
  nombre_ubicacion: string
  ruta_completa: string
  nivel: number
  tipo_ubicacion?: 'AREA' | 'CONTENIDO'
  codigo_ubicacion_superior?: string
}

const DOCS_POR_PAGINA = 20

export function TabRevertir() {
  // Catálogos
  const [procesos, setProcesos] = useState<ProcesoCatalogo[]>([])
  const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [errorCargaInicial, setErrorCargaInicial] = useState(false)

  // Filtros
  const [procesoSel, setProcesoSel] = useState('')
  const [filtroLibre, setFiltroLibre] = useState('')
  const [filtroLibreInput, setFiltroLibreInput] = useState('')
  const [ubicacionSel, setUbicacionSel] = useState('')
  const [ubicBusqueda, setUbicBusqueda] = useState('')
  const [ubicDropdownOpen, setUbicDropdownOpen] = useState(false)
  const [ubicExpandidos, setUbicExpandidos] = useState<Set<string>>(new Set())
  const [tope, setTope] = useState('')
  const ubicDropdownRef = useRef<HTMLDivElement>(null)

  // Documentos candidatos
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [conteo, setConteo] = useState<number | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [yaBuscado, setYaBuscado] = useState(false)

  // Ejecución
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmEjecutar, setConfirmEjecutar] = useState(false)

  const pasoActual = useMemo(() => {
    const p = procesos.find((x) => x.codigo_proceso === procesoSel)
    return p ?? null
  }, [procesos, procesoSel])

  const rutaUbicacion = useMemo(() => {
    if (!ubicacionSel) return undefined
    return ubicaciones.find((u) => u.codigo_ubicacion === ubicacionSel)?.ruta_completa
  }, [ubicacionSel, ubicaciones])

  const cargarDatosIniciales = useCallback(async () => {
    setCargandoInicial(true)
    setErrorCargaInicial(false)
    try {
      const [procsRaw, u] = await Promise.all([
        procesosApi.listar('REVERTIR_PROCESAR_DOCS'),
        ubicacionesDocsApi.listar().catch(() => []),
      ])
      const procs = (procsRaw || [])
        .filter((p: ProcesoCatalogo) => !!p.estado_destino && p.codigo_funcion === 'REVERT_PROC_DOCS')
        .sort((a: ProcesoCatalogo, b: ProcesoCatalogo) => (a.orden ?? 0) - (b.orden ?? 0))
      setProcesos(procs)
      setUbicaciones(
        (u as UbicacionOption[])
          .filter((x) => (x as UbicacionOption & { activo?: boolean }).activo !== false)
          .sort((a, b) => (a.ruta_completa || '').localeCompare(b.ruta_completa || ''))
      )
    } catch {
      setErrorCargaInicial(true)
    } finally {
      setCargandoInicial(false)
    }
  }, [])

  useEffect(() => { cargarDatosIniciales() }, [cargarDatosIniciales])

  // Click-outside para cerrar dropdown de ubicación
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ubicDropdownRef.current && !ubicDropdownRef.current.contains(e.target as Node)) {
        setUbicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Resetear al cambiar filtros
  useEffect(() => {
    setDocumentos([])
    setConteo(null)
    setResultado(null)
    setError(null)
    setYaBuscado(false)
    setPaginaActual(1)
  }, [procesoSel, filtroLibre, ubicacionSel, tope])

  const cargarDocumentos = useCallback(async (pagina: number) => {
    if (!pasoActual?.estado_origen && !filtroLibre) return
    setCargando(true)
    try {
      const data = await documentosApi.listarPaginado({
        page: pagina,
        limit: DOCS_POR_PAGINA,
        codigo_estado_doc: pasoActual?.estado_origen || undefined,
        activo: true,
        q: filtroLibre || undefined,
        ruta_prefijo: rutaUbicacion,
      })
      setDocumentos(data.items || [])
      setPaginaActual(pagina)
      setTotalPaginas(Math.max(1, Math.ceil(data.total / DOCS_POR_PAGINA)))
    } catch {
      setError('Error al cargar la lista de documentos.')
    } finally {
      setCargando(false)
    }
  }, [pasoActual, filtroLibre, rutaUbicacion])

  const buscar = async () => {
    if (!pasoActual?.estado_origen && !filtroLibre) return
    setCargando(true)
    setConteo(null)
    setResultado(null)
    setError(null)
    setDocumentos([])
    try {
      // Siempre cargar la lista de documentos (con o sin proceso)
      const docsRes = await documentosApi.listarPaginado({
        page: 1,
        limit: DOCS_POR_PAGINA,
        codigo_estado_doc: pasoActual?.estado_origen || undefined,
        activo: true,
        q: filtroLibre || undefined,
        ruta_prefijo: rutaUbicacion,
      })
      setDocumentos(docsRes.items || [])
      setPaginaActual(1)
      setTotalPaginas(Math.max(1, Math.ceil(docsRes.total / DOCS_POR_PAGINA)))
      setYaBuscado(true)

      // El conteo para revertir solo aplica cuando hay un proceso seleccionado
      if (pasoActual?.estado_origen) {
        const conteoRes = await documentosApi.revertir({
          estados_origen: [pasoActual.estado_origen],
          estado_destino: pasoActual.estado_destino || '',
          q: filtroLibre || undefined,
          codigo_ubicacion: ubicacionSel || undefined,
          tope: tope ? parseInt(tope) : undefined,
          solo_contar: true,
        })
        setConteo(conteoRes.conteo)
      }
    } catch {
      setError('Error al consultar los documentos candidatos.')
    } finally {
      setCargando(false)
    }
  }

  const ejecutar = async () => {
    if (!pasoActual || conteo === null || conteo === 0) return
    setEjecutando(true)
    setConfirmEjecutar(false)
    setError(null)
    try {
      const r = await documentosApi.revertir({
        estados_origen: pasoActual.estado_origen ? [pasoActual.estado_origen] : [],
        estado_destino: pasoActual.estado_destino || '',
        q: filtroLibre || undefined,
        codigo_ubicacion: ubicacionSel || undefined,
        tope: tope ? parseInt(tope) : undefined,
        solo_contar: false,
      })
      setResultado(r.revertidos)
      setDocumentos([])
      setConteo(null)
      setYaBuscado(false)
    } catch {
      setError('Error al ejecutar el proceso de reversa.')
    } finally {
      setEjecutando(false)
    }
  }

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  return (
    <div className="flex flex-col gap-6 w-full overflow-x-hidden">
      <p className="text-sm text-texto-muted">
        Revierte documentos a estados anteriores del pipeline. Selecciona el proceso de reversa,
        aplica filtros y presiona <strong>Buscar</strong> para previsualizar los documentos
        afectados, luego <strong>Ejecutar</strong> para aplicar el cambio.
      </p>

      {/* Error carga inicial */}
      {errorCargaInicial && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-error">
          <AlertTriangle size={16} className="shrink-0" />
          <span>No se pudieron cargar los procesos del sistema. El servidor puede estar iniciando.</span>
          <Boton variante="contorno" tamano="sm" onClick={cargarDatosIniciales} disabled={cargandoInicial}>
            {cargandoInicial ? <Loader2 size={14} className="animate-spin" /> : null}
            Reintentar
          </Boton>
        </div>
      )}

      {/* Configuración */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Proceso */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">Proceso</label>
              <select
                value={procesoSel}
                onChange={(e) => setProcesoSel(e.target.value)}
                className={selectClass}
                disabled={ejecutando || cargandoInicial}
              >
                <option value="">— Sin valor —</option>
                {procesos.map((p) => {
                  const flecha = p.estado_destino ? `${p.estado_origen || '—'} → ${p.estado_destino}` : ''
                  return (
                    <option key={p.codigo_proceso} value={p.codigo_proceso}>
                      {p.nombre_proceso} ({flecha})
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Estado (derivado del proceso, solo lectura) */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-sm font-medium text-texto">Estado</label>
              <div className={selectClass + ' cursor-default bg-fondo flex items-center gap-2 min-h-[38px]'}>
                {pasoActual?.estado_origen
                  ? <>
                      <Insignia variante="advertencia">{pasoActual.estado_origen}</Insignia>
                      <span className="text-texto-muted">→</span>
                      <Insignia variante="neutro">{pasoActual.estado_destino}</Insignia>
                    </>
                  : <span className="text-texto-muted italic text-sm">— según proceso —</span>
                }
              </div>
            </div>

            {/* Ubicación — árbol idéntico al de /procesar-documentos */}
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
                      ? (ubicaciones.find(u => u.codigo_ubicacion === ubicacionSel)?.nombre_ubicacion || 'Seleccionar ubicación')
                      : 'Seleccionar ubicación'}
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
                        placeholder="Buscar ubicación…"
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
                            (u.ruta_completa || '').toLowerCase().includes(ubicBusqueda.toLowerCase())
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
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
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
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${esArea ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>{esArea ? 'Área' : 'Contenido'}</span>
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

          {/* Filtro libre + Tope — misma línea */}
          <div className="flex items-end gap-3 mt-3 flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-texto">Filtro libre</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filtrar por nombre, directorio… (Enter para aplicar)"
                  value={filtroLibreInput}
                  onChange={(e) => setFiltroLibreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFiltroLibre(filtroLibreInput)
                      setYaBuscado(false)
                    }
                  }}
                  disabled={ejecutando}
                  className="flex-1 text-sm border border-borde rounded-lg px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50 placeholder:text-texto-muted"
                />
                {filtroLibreInput && (
                  <button
                    type="button"
                    onClick={() => { setFiltroLibreInput(''); setFiltroLibre(''); setYaBuscado(false) }}
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

          {/* Buscar + count + Ejecutar/Detener — misma línea */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-borde flex-wrap">
            <Boton variante="contorno" tamano="sm" onClick={buscar} disabled={ejecutando || cargando || (!procesoSel && !filtroLibre)}>
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </Boton>
            <span className="text-sm text-texto-muted">
              {conteo !== null
                ? `${conteo} documento${conteo !== 1 ? 's' : ''} a revertir`
                : ''}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <Boton
                variante="primario"
                onClick={ejecutar}
                disabled={ejecutando || !procesoSel || conteo === null || conteo === 0}
              >
                {ejecutando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {ejecutando ? 'Ejecutando…' : conteo !== null && conteo > 0 ? `Ejecutar (${conteo})` : 'Ejecutar'}
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
              {resultado} documento{resultado !== 1 ? 's' : ''} revertido{resultado !== 1 ? 's' : ''}
              {pasoActual ? ` de ${pasoActual.estado_origen || '—'} a ${pasoActual.estado_destino}` : ''}.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-error">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Lista de documentos candidatos (visible tras Buscar) */}
      {(yaBuscado || cargando) && (
        <>
          {documentos.length > 0 && (
            <div className="flex items-center">
              <span className="text-xs text-texto-muted">
                {conteo !== null
                  ? `${conteo} documento${conteo !== 1 ? 's' : ''} que se revertirán`
                  : `${documentos.length} documentos`}
                {pasoActual ? ` de ${pasoActual.estado_origen} → ${pasoActual.estado_destino}` : ''}
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
                    Cargando…
                  </TablaTd>
                </TablaFila>
              ) : documentos.length === 0 ? (
                <TablaFila>
                  <TablaTd colSpan={3 as never} className="py-8 text-center text-texto-muted">
                    No hay documentos que coincidan con los filtros
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
                    <TablaTd className="text-xs text-texto-muted max-w-0 w-[30%] truncate" title={d.ubicacion_documento || ''}>
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
          {/* Paginación */}
          {conteo !== null && conteo > DOCS_POR_PAGINA && (
            <div className="flex items-center justify-between text-xs text-texto-muted mt-1">
              <span>
                {(paginaActual - 1) * DOCS_POR_PAGINA + 1}–{Math.min(paginaActual * DOCS_POR_PAGINA, conteo)} de {conteo}
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
        titulo="Confirmar reversa"
        mensaje={`¿Revertir ${conteo ?? 0} documento${(conteo ?? 0) !== 1 ? 's' : ''}${pasoActual ? ` de "${pasoActual.estado_origen}" a "${pasoActual.estado_destino}"` : ''}? Esta acción no se puede deshacer.`}
        alConfirmar={ejecutar}
        alCerrar={() => setConfirmEjecutar(false)}
        cargando={ejecutando}
        variante="peligro"
      />
    </div>
  )
}
