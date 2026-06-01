'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Download, Search, Eye, ExternalLink, FileText, XCircle } from 'lucide-react'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Paginador } from '@/components/ui/paginador'
import { usePaginacion } from '@/hooks/usePaginacion'
import { documentosApi } from '@/lib/api'
import { getEstadosDocs } from '@/lib/catalogos'
import type { Documento, EstadoDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { abrirDocumento, descargarDocumento, abrirVentanaLoading, asegurarHandleConPermiso } from '@/lib/abrir-documento'
import { BotonChat } from '@/components/ui/boton-chat'
import { DocumentoDetalleModal } from '@/components/documentos/documento-detalle-modal'
import { PageHeader } from '@/components/layout/PageHeader'

export default function PaginaDocumentos() {
  const t = useTranslations('documents')
  const tc = useTranslations('common')
  const { grupoActivo, usuario } = useAuth()
  const userId = usuario?.codigo_usuario ?? null

  // ── State ─────────────────────────────────────────────────────────────────
  const [estados, setEstados] = useState<EstadoDoc[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  // Toggle de clase de estado: '' (todos) | 'VALIDO' | 'INVALIDO'.
  const [tipoEstadoFiltro, setTipoEstadoFiltro] = useState<'' | 'VALIDO' | 'INVALIDO'>('')

  // Estados ordenados: primero los válidos (ruta feliz), luego los inválidos
  // (NO_*, REVISAR, ELIMINADO). Dentro de cada grupo, por `orden`.
  // Clase del estado: usa el campo real `tipo_estado` de estados_procesos; si el
  // catálogo aún no lo trae, cae a la heurística histórica orden % 10 === 0.
  const estadosOrdenados = useMemo(() => {
    const esValido = (e: EstadoDoc) =>
      e.tipo_estado ? e.tipo_estado === 'VALIDO' : e.orden % 10 === 0
    return [...estados].sort((a, b) => {
      const va = esValido(a) ? 0 : 1
      const vb = esValido(b) ? 0 : 1
      if (va !== vb) return va - vb
      return a.orden - b.orden
    })
  }, [estados])

  // ── Paginación server-side ────────────────────────────────────────────────
  const filtros = useMemo(() => ({
    q: busqueda.trim() || undefined,
    codigo_estado_doc: estadoFiltro || undefined,
    tipo_estado: tipoEstadoFiltro || undefined,
  }), [busqueda, estadoFiltro, tipoEstadoFiltro])
  const fetcher = useCallback(
    (params: { page: number; limit: number; q?: string; codigo_estado_doc?: string; tipo_estado?: 'VALIDO' | 'INVALIDO' }) =>
      documentosApi.listarPaginado(params),
    [],
  )
  const {
    items: documentos,
    total,
    page,
    limit,
    cargando,
    setPage,
    setLimit,
    refetch,
  } = usePaginacion<Documento, { q?: string; codigo_estado_doc?: string; tipo_estado?: 'VALIDO' | 'INVALIDO' }>({
    fetcher,
    filtros,
    limitInicial: 50,
  })

  // ── Modal Crear (solo creación; el detalle/edición usa DocumentoDetalleModal) ──
  const [modalCrear, setModalCrear] = useState(false)
  const [form, setForm] = useState({
    nombre_documento: '',
    ubicacion_documento: '',
    resumen_documento: '',
    fecha_modificacion: '',
    tamano_kb: '',
    codigo_estado_doc: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Modal Detalle (solo lectura, compartido con /process-documents) ───────
  const [docDetalle, setDocDetalle] = useState<Documento | null>(null)
  const [tabInicialDetalle, setTabInicialDetalle] = useState<'datos' | 'chunks'>('datos')

  // ── Modal Confirmar eliminación ───────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<Documento | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga auxiliares (estados, usados en el selector del modal de creación) ──
  useEffect(() => {
    getEstadosDocs().then(setEstados).catch(() => setEstados([]))
  }, [])
  // Alias: después de crear/eliminar, refrescar la página actual.
  const cargar = refetch

  // ── Crear / Ver detalle ──────────────────────────────────────────────────
  const abrirNuevo = () => {
    setForm({ nombre_documento: '', ubicacion_documento: '', resumen_documento: '', fecha_modificacion: '', tamano_kb: '', codigo_estado_doc: '' })
    setError('')
    setModalCrear(true)
  }

  const abrirDetalle = (d: Documento, tabInicial: 'datos' | 'chunks' = 'datos') => {
    setTabInicialDetalle(tabInicial)
    setDocDetalle(d)
  }

  // Auto-abrir modal cuando viene ?codigo=N (links del chat). Si trae &pagina=N
  // además, se abre directo en la pestaña Chunks. Limpiamos los query params
  // luego de abrir para que un refresh no reabra el modal.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const autoAbiertoRef = useRef<string | null>(null)
  useEffect(() => {
    const codigo = searchParams.get('codigo')
    if (!codigo || autoAbiertoRef.current === codigo) return
    autoAbiertoRef.current = codigo
    if (Number.isNaN(parseInt(codigo, 10))) return
    const pagina = searchParams.get('pagina')
    documentosApi
      .obtener(codigo)
      .then((doc) => {
        abrirDetalle(doc, pagina ? 'chunks' : 'datos')
      })
      .catch(() => {})
      .finally(() => {
        router.replace(pathname, { scroll: false })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const crear = async (cerrar: boolean) => {
    if (!form.nombre_documento.trim()) {
      setError(t('errorNombreObligatorio'))
      return
    }
    setGuardando(true)
    try {
      const nuevo = await documentosApi.crear({
        nombre_documento: form.nombre_documento,
        codigo_grupo: grupoActivo!,
        ubicacion_documento: form.ubicacion_documento || undefined,
        resumen_documento: form.resumen_documento || undefined,
        fecha_modificacion: form.fecha_modificacion || undefined,
        tamano_kb: form.tamano_kb ? parseFloat(form.tamano_kb) : undefined,
        codigo_estado_doc: form.codigo_estado_doc || undefined,
      })
      cargar()
      setModalCrear(false)
      if (!cerrar) abrirDetalle(nuevo)
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEliminacion = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await documentosApi.desactivar(confirmacion.codigo_documento)
      setConfirmacion(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlEliminar'))
      setConfirmacion(null)
    } finally {
      setEliminando(false)
    }
  }

  const abrirDocumentoLocal = async (d: Documento) => {
    const { continuar, handle } = await asegurarHandleConPermiso(userId, grupoActivo)
    if (!continuar) return
    const win = abrirVentanaLoading()
    abrirDocumento(d.ubicacion_documento, win, userId, grupoActivo, handle)
  }

  // ── Filtro: backend hace la búsqueda y orden, dejamos la lista tal cual ──
  const filtrados = documentos

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      {/* Header */}
      <div className="pr-28">
        <PageHeader i18nNamespace="documents" />
      </div>

      {/* Toolbar */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="max-w-sm flex-1">
              <Input
                placeholder={t('buscarPlaceholder')}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                icono={<Search size={15} />}
              />
            </div>
            {/* Toggle segmentado: clase del estado (Válidos / Inválidos) */}
            <div className="inline-flex rounded-md border border-borde overflow-hidden">
              {([
                { val: '', label: tc('todos') },
                { val: 'VALIDO', label: t('estadoValidos') },
                { val: 'INVALIDO', label: t('estadoInvalidos') },
              ] as const).map((opt) => (
                <button
                  key={opt.val || 'todos'}
                  type="button"
                  onClick={() => setTipoEstadoFiltro(opt.val)}
                  className={`text-sm px-3 py-2 transition-colors ${
                    tipoEstadoFiltro === opt.val
                      ? 'bg-primario text-white'
                      : 'bg-surface text-texto hover:bg-primario-muy-claro'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="text-sm border border-borde rounded-md px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario"
            >
              <option value="">Todos los estados</option>
              {estadosOrdenados.map((e) => (
                <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>
                  {e.nombre_estado || e.codigo_estado_doc}
                </option>
              ))}
            </select>
            <div className="flex gap-2 ml-auto">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() =>
                  exportarExcel(
                    filtrados as unknown as Record<string, unknown>[],
                    [
                      { titulo: t('excelId'), campo: 'codigo_documento' },
                      { titulo: t('excelNombre'), campo: 'nombre_documento' },
                      { titulo: t('excelUbicacion'), campo: 'ubicacion_documento' },
                      { titulo: t('excelResumen'), campo: 'resumen_documento' },
                      { titulo: t('excelFechaModificacion'), campo: 'fecha_modificacion' },
                      { titulo: t('excelTamano'), campo: 'tamano_kb' },
                      { titulo: t('excelEstado'), campo: 'codigo_estado_doc' },
                    ],
                    'documentos'
                  )
                }
                disabled={filtrados.length === 0}
              >
                <Download size={15} />
                {tc('exportarExcel')}
              </Boton>
              <Boton variante="primario" onClick={abrirNuevo}>
                <Plus size={16} />
                {t('nuevoDocumento')}
              </Boton>
            </div>
          </div>
        </TarjetaContenido>
      </Tarjeta>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>{t('colId')}</TablaTh>
            <TablaTh>{t('colNombre')}</TablaTh>
            <TablaTh>{t('colUbicacion')}</TablaTh>
            <TablaTh>{t('colEstado')}</TablaTh>
            <TablaTh className="text-right">{tc('acciones')}</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                {tc('cargando')}
              </TablaTd>
            </TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                {t('sinDocumentos')}
              </TablaTd>
            </TablaFila>
          ) : (
            filtrados.map((d) => (
              <TablaFila key={d.codigo_documento}>
                <TablaTd>
                  <code className="text-xs bg-fondo px-2 py-1 rounded font-mono">
                    {d.codigo_documento}
                  </code>
                </TablaTd>
                <TablaTd className="max-w-[250px]">
                  <div className="flex items-center gap-2 min-w-0">
                    {iconoTipoArchivo(d.nombre_documento, 16)}
                    <span className="font-medium truncate" title={d.nombre_documento}>
                      {d.nombre_documento}
                    </span>
                  </div>
                </TablaTd>
                <TablaTd className="text-sm text-texto-muted max-w-[250px] truncate">
                  {d.ubicacion_documento ? (
                    <span title={d.ubicacion_documento}>
                      {d.ubicacion_documento.length > 50
                        ? '...' + d.ubicacion_documento.slice(-47)
                        : d.ubicacion_documento}
                    </span>
                  ) : '—'}
                </TablaTd>
                <TablaTd>
                  {d.codigo_estado_doc ? (
                    <div className="flex items-center gap-2">
                      <Insignia variante="primario">{d.codigo_estado_doc}</Insignia>
                      {d.detalle_estado && (
                        <span className="text-xs text-texto-muted italic" title={d.detalle_estado}>
                          {d.detalle_estado.length > 35 ? d.detalle_estado.slice(0, 35) + '…' : d.detalle_estado}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-texto-muted">—</span>
                  )}
                </TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    {d.ubicacion_documento && (
                      <button
                        onClick={() => descargarDocumento(d.ubicacion_documento, d.nombre_documento, userId, grupoActivo)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title="Descargar"
                      >
                        <Download size={16} />
                      </button>
                    )}
                    {d.ubicacion_documento && /^https?:\/\//i.test(d.ubicacion_documento) && (
                      <a
                        href={d.ubicacion_documento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title={t('abrirDocumentoUrl')}
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    {d.ubicacion_documento && !/^https?:\/\//i.test(d.ubicacion_documento) && (
                      <button
                        type="button"
                        onClick={() => abrirDocumentoLocal(d)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title={t('abrirDocumentoLocal')}
                      >
                        <FileText size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => abrirDetalle(d)}
                      className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                      title="Ver detalle"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmacion(d)}
                      className="p-1.5 rounded-lg hover:bg-orange-50 text-texto-muted hover:text-orange-500 transition-colors"
                      title="Quitar de la BD"
                    >
                      <XCircle size={14} />
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

      {/* Modal Crear (solo creación; el detalle/edición usa DocumentoDetalleModal) */}
      <Modal
        abierto={modalCrear}
        alCerrar={() => setModalCrear(false)}
        titulo={t('nuevoDocumento')}
      >
        <div className="flex flex-col gap-4 w-[900px] max-w-full">
          <div className="grid grid-cols-12 gap-x-4 gap-y-3">
            <div className="col-span-12 md:col-span-5">
              <Input
                etiqueta={t('etiquetaNombre')}
                value={form.nombre_documento}
                onChange={(e) => setForm({ ...form, nombre_documento: e.target.value })}
                placeholder={t('placeholderNombre')}
              />
            </div>
            <div className="col-span-12 md:col-span-7">
              <Input
                etiqueta={t('etiquetaUbicacion')}
                value={form.ubicacion_documento}
                onChange={(e) => setForm({ ...form, ubicacion_documento: e.target.value })}
                placeholder={t('placeholderUbicacion')}
              />
            </div>
            <div className="col-span-12 md:col-span-5">
              <Input
                etiqueta={t('etiquetaFechaModificacion')}
                type="datetime-local"
                value={form.fecha_modificacion}
                onChange={(e) => setForm({ ...form, fecha_modificacion: e.target.value })}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <Input
                etiqueta={t('etiquetaTamano')}
                type="number"
                value={form.tamano_kb}
                onChange={(e) => setForm({ ...form, tamano_kb: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="col-span-6 md:col-span-4">
              <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaEstado')}</label>
              <select
                className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                value={form.codigo_estado_doc}
                onChange={(e) => setForm({ ...form, codigo_estado_doc: e.target.value })}
              >
                <option value="">{t('sinEstado')}</option>
                {estadosOrdenados.map((e) => (
                  <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>
                    {e.nombre_estado}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12">
              <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaResumen')}</label>
              <textarea
                className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[100px]"
                value={form.resumen_documento}
                onChange={(e) => setForm({ ...form, resumen_documento: e.target.value })}
                placeholder={t('placeholderResumen')}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={false}
            onGuardar={() => crear(false)}
            onGuardarYSalir={() => crear(true)}
            onCerrar={() => setModalCrear(false)}
            cargando={guardando}
          />
        </div>
      </Modal>

      {/* Modal detalle de documento (componente compartido con /process-documents) */}
      <DocumentoDetalleModal
        documento={docDetalle}
        abierto={!!docDetalle}
        alCerrar={() => setDocDetalle(null)}
        userId={userId}
        grupoActivo={grupoActivo}
        tabInicial={tabInicialDetalle}
      />

      {/* Modal Confirmar */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo={t('desactivarTitulo')}
        mensaje={
          confirmacion
            ? t('desactivarConfirm', { nombre: confirmacion.nombre_documento })
            : ''
        }
        textoConfirmar={t('textoDesactivar')}
        cargando={eliminando}
      />
    </div>
  )
}
