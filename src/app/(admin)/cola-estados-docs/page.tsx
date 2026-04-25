'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Download, Search, Play, XCircle, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Paginador } from '@/components/ui/paginador'
import { usePaginacion } from '@/hooks/usePaginacion'
import { colaEstadosDocsApi, documentosApi } from '@/lib/api'
import { getEstadosDocs } from '@/lib/catalogos'
import type { ColaEstadoDoc, Documento, EstadoDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

const ESTADO_CONFIG: Record<string, { variante: 'exito' | 'error' | 'advertencia' | 'neutro'; icono: typeof Clock }> = {
  PENDIENTE: { variante: 'neutro', icono: Clock },
  EN_PROCESO: { variante: 'advertencia', icono: Play },
  COMPLETADO: { variante: 'exito', icono: CheckCircle },
  ERROR: { variante: 'error', icono: AlertTriangle },
}

export default function PaginaColaEstadosDocs() {
  const t = useTranslations('colaEstadosDocs')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [estados, setEstados] = useState<EstadoDoc[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  // Paginación server-side de la cola.
  const filtrosCola = useMemo(
    () => ({ q: busqueda.trim() || undefined, estado_cola: filtroEstado || undefined }),
    [busqueda, filtroEstado],
  )
  const fetcherCola = useCallback(
    (params: { page: number; limit: number; q?: string; estado_cola?: string }) =>
      colaEstadosDocsApi.listarPaginado(params),
    [],
  )
  const {
    items: cola,
    total,
    page,
    limit,
    cargando,
    setPage,
    setLimit,
    refetch: refetchCola,
  } = usePaginacion<ColaEstadoDoc, { q?: string; estado_cola?: string }>({
    fetcher: fetcherCola,
    filtros: filtrosCola,
    limitInicial: 50,
  })

  // ── Modal Inicializar ─────────────────────────────────────────────────────
  const [modalInit, setModalInit] = useState(false)
  const [docsSeleccionados, setDocsSeleccionados] = useState<Set<number>>(new Set())
  const [estadoDestino, setEstadoDestino] = useState('')
  const [inicializando, setInicializando] = useState(false)
  const [resultadoInit, setResultadoInit] = useState<{ encolados: number; omitidos: number } | null>(null)

  // ── Modal Cerrar ──────────────────────────────────────────────────────────
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  // ── Modal Eliminar item ───────────────────────────────────────────────────
  const [confirmEliminar, setConfirmEliminar] = useState<ColaEstadoDoc | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga auxiliares (la cola es paginada server-side) ───────────────────
  useEffect(() => {
    Promise.all([documentosApi.listar(), getEstadosDocs()])
      .then(([d, e]) => { setDocumentos(d); setEstados(e) })
      .catch(() => { /* noop */ })
  }, [])
  const cargar = refetchCola

  // ── Helpers ───────────────────────────────────────────────────────────────
  const estadosActivos = useMemo(() => estados, [estados])
  const nombreEstado = (codigo: string | null | undefined) =>
    codigo ? (estados.find((e) => e.codigo_estado_doc === codigo)?.nombre_estado || codigo) : '—'

  const completados = useMemo(() => cola.filter((c) => c.estado_cola === 'COMPLETADO').length, [cola])

  // ── Inicializar ───────────────────────────────────────────────────────────
  const abrirInicializar = () => {
    setDocsSeleccionados(new Set())
    setEstadoDestino('')
    setResultadoInit(null)
    setModalInit(true)
  }

  const toggleDoc = (id: number) => {
    setDocsSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const seleccionarTodos = () => {
    if (docsSeleccionados.size === docsFiltrados.length) {
      setDocsSeleccionados(new Set())
    } else {
      setDocsSeleccionados(new Set(docsFiltrados.map((d) => d.codigo_documento)))
    }
  }

  const ejecutarInicializar = async () => {
    if (!estadoDestino || docsSeleccionados.size === 0) return
    setInicializando(true)
    try {
      const res = await colaEstadosDocsApi.inicializar(
        Array.from(docsSeleccionados).map((id) => ({
          codigo_documento: id,
          codigo_estado_doc_destino: estadoDestino,
        }))
      )
      setResultadoInit(res)
      cargar()
    } catch {
      alert('Error al inicializar la cola.')
    } finally {
      setInicializando(false)
    }
  }

  // ── Cerrar ────────────────────────────────────────────────────────────────
  const ejecutarCerrar = async () => {
    setCerrando(true)
    try {
      const res = await colaEstadosDocsApi.cerrar()
      setConfirmCerrar(false)
      cargar()
      if (res.eliminados === 0) {
        alert('No hay ítems completados para eliminar.')
      }
    } finally {
      setCerrando(false)
    }
  }

  // ── Eliminar item ─────────────────────────────────────────────────────────
  const ejecutarEliminar = async () => {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await colaEstadosDocsApi.eliminar(confirmEliminar.id_cola)
      setConfirmEliminar(null)
      cargar()
    } finally {
      setEliminando(false)
    }
  }

  // ── Búsqueda en modal de inicialización ───────────────────────────────────
  const [busquedaDocs, setBusquedaDocs] = useState('')
  const docsFiltrados = useMemo(() =>
    documentos
      
      .filter((d) =>
        d.nombre_documento.toLowerCase().includes(busquedaDocs.toLowerCase()) ||
        String(d.codigo_documento).includes(busquedaDocs)
      )
      .sort((a, b) => a.nombre_documento.localeCompare(b.nombre_documento)),
    [documentos, busquedaDocs]
  )

  // Backend paginado hace el filtrado — el listado llega ya filtrado.
  const filtrados = cola

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      {/* Header */}
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="max-w-sm flex-1">
          <Input
            placeholder={t('buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>

        {/* Filtro por estado de cola */}
        <select
          className="rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario outline-none"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">{t('todosEstados')}</option>
          <option value="PENDIENTE">{t('pendiente')}</option>
          <option value="EN_PROCESO">{t('enProceso')}</option>
          <option value="COMPLETADO">{t('completado')}</option>
          <option value="ERROR">{t('error')}</option>
        </select>

        <div className="flex gap-2 ml-auto flex-wrap">
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={() =>
              exportarExcel(
                filtrados.map((c) => ({
                  ...c,
                  nombre_documento: c.documentos?.nombre_documento || '',
                })) as unknown as Record<string, unknown>[],
                [
                  { titulo: t('excelId'), campo: 'id_cola' },
                  { titulo: t('excelDocumento'), campo: 'nombre_documento' },
                  { titulo: t('excelEstadoOrigen'), campo: 'codigo_estado_doc_origen' },
                  { titulo: t('excelEstadoDestino'), campo: 'codigo_estado_doc_destino' },
                  { titulo: t('colEstadoCola'), campo: 'estado_cola' },
                  { titulo: t('colFecha'), campo: 'fecha_cola' },
                  { titulo: t('colIntentos'), campo: 'intentos' },
                  { titulo: t('excelResultado'), campo: 'resultado' },
                ],
                'cola-estados-docs'
              )
            }
            disabled={filtrados.length === 0}
          >
            <Download size={15} />
            Excel
          </Boton>
          <Boton
            variante="contorno"
            onClick={() => setConfirmCerrar(true)}
            disabled={completados === 0}
          >
            <XCircle size={16} />
            {t('cerrarCola', { n: completados })}
          </Boton>
          <Boton variante="primario" onClick={abrirInicializar}>
            <Plus size={16} />
            {t('inicializarCola')}
          </Boton>
        </div>
      </div>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>{t('colId')}</TablaTh>
            <TablaTh>{t('colDocumento')}</TablaTh>
            <TablaTh>{t('colEstadoOrigen')}</TablaTh>
            <TablaTh>{t('colEstadoDestino')}</TablaTh>
            <TablaTh>{t('colEstadoCola')}</TablaTh>
            <TablaTh>{t('colFecha')}</TablaTh>
            <TablaTh>{t('colIntentos')}</TablaTh>
            <TablaTh className="text-right">{tc('acciones')}</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>
                {tc('cargando')}
              </TablaTd>
            </TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>
                {t('colaVacia')}
              </TablaTd>
            </TablaFila>
          ) : (
            filtrados.map((c) => {
              const config = ESTADO_CONFIG[c.estado_cola] || ESTADO_CONFIG.PENDIENTE
              const Icono = config.icono
              return (
                <TablaFila key={c.id_cola}>
                  <TablaTd>
                    <code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{c.id_cola}</code>
                  </TablaTd>
                  <TablaTd className="font-medium text-sm">
                    {c.documentos?.nombre_documento || `Doc #${c.codigo_documento}`}
                  </TablaTd>
                  <TablaTd className="text-sm text-texto-muted">
                    {nombreEstado(c.codigo_estado_doc_origen)}
                  </TablaTd>
                  <TablaTd className="text-sm font-medium">
                    {nombreEstado(c.codigo_estado_doc_destino)}
                  </TablaTd>
                  <TablaTd>
                    <Insignia variante={config.variante}>
                      <Icono size={12} className="mr-1" />
                      {c.estado_cola}
                    </Insignia>
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                    {new Date(c.fecha_cola).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TablaTd>
                  <TablaTd className="text-sm text-center">
                    {c.intentos}/{c.max_intentos}
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setConfirmEliminar(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                        title={tc('eliminar')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TablaTd>
                </TablaFila>
              )
            })
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

      {/* Modal Inicializar Cola */}
      <Modal
        abierto={modalInit}
        alCerrar={() => setModalInit(false)}
        titulo={t('inicializarTitulo')}
      >
        <div className="flex flex-col gap-4 min-w-[550px]">
          {!resultadoInit ? (
            <>
              {/* Selector de estado destino */}
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaEstadoDestino')}</label>
                <select
                  className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                  value={estadoDestino}
                  onChange={(e) => setEstadoDestino(e.target.value)}
                >
                  <option value="">{t('seleccionarEstado')}</option>
                  {estadosActivos.map((e) => (
                    <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>
                      {e.nombre_estado}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de documentos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-texto">
                    {t('etiquetaDocumentos', { n: docsSeleccionados.size })}
                  </label>
                  <button onClick={seleccionarTodos} className="text-xs text-primario hover:underline">
                    {docsSeleccionados.size === docsFiltrados.length ? t('deseleccionarTodos') : t('seleccionarTodos')}
                  </button>
                </div>
                <Input
                  placeholder={t('buscarDocumentosPlaceholder')}
                  value={busquedaDocs}
                  onChange={(e) => setBusquedaDocs(e.target.value)}
                  icono={<Search size={14} />}
                />
                <div className="border border-borde rounded-lg mt-2 max-h-[300px] overflow-y-auto">
                  {docsFiltrados.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-texto-muted text-center">{t('sinDocumentos')}</p>
                  ) : (
                    docsFiltrados.map((d) => (
                      <label
                        key={d.codigo_documento}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-fondo cursor-pointer text-sm border-b border-borde last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={docsSeleccionados.has(d.codigo_documento)}
                          onChange={() => toggleDoc(d.codigo_documento)}
                          className="rounded border-borde"
                        />
                        <span className="flex-1">{d.nombre_documento}</span>
                        <span className="text-xs text-texto-muted">
                          {d.codigo_estado_doc ? nombreEstado(d.codigo_estado_doc) : t('sinEstado')}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalInit(false)}>
                  {tc('cancelar')}
                </Boton>
                <Boton
                  variante="primario"
                  onClick={ejecutarInicializar}
                  cargando={inicializando}
                  disabled={!estadoDestino || docsSeleccionados.size === 0}
                >
                  <RefreshCw size={15} />
                  {t('encolar', { n: docsSeleccionados.size })}
                </Boton>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-lg font-medium text-green-800">{t('colaInicializada')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-green-600">{resultadoInit.encolados}</p>
                  <p className="text-xs text-texto-muted">{t('encolados')}</p>
                </div>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-texto-muted">{resultadoInit.omitidos}</p>
                  <p className="text-xs text-texto-muted">{t('omitidos')}</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Boton variante="primario" onClick={() => setModalInit(false)}>
                  {tc('cerrar')}
                </Boton>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal Confirmar Cerrar */}
      <ModalConfirmar
        abierto={confirmCerrar}
        alCerrar={() => setConfirmCerrar(false)}
        alConfirmar={ejecutarCerrar}
        titulo={t('cerrarColaTitulo')}
        mensaje={t('cerrarColaConfirm', { n: completados })}
        textoConfirmar={t('eliminarCompletados')}
        cargando={cerrando}
      />

      {/* Modal Confirmar Eliminar item */}
      <ModalConfirmar
        abierto={!!confirmEliminar}
        alCerrar={() => setConfirmEliminar(null)}
        alConfirmar={ejecutarEliminar}
        titulo={t('eliminarItemTitulo')}
        mensaje={confirmEliminar ? t('eliminarItemConfirm', { id: confirmEliminar.id_cola, nombre: confirmEliminar.documentos?.nombre_documento || `Doc #${confirmEliminar.codigo_documento}` }) : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
