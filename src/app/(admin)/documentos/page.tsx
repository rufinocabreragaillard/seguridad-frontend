'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Download, Search, Eye, ExternalLink, FileText, XCircle } from 'lucide-react'
import { iconoTipoArchivo } from '@/lib/icono-tipo-archivo'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Paginador } from '@/components/ui/paginador'
import { usePaginacion } from '@/hooks/usePaginacion'
import { documentosApi, categoriasCaractDocsApi } from '@/lib/api'
import { getEstadosDocs } from '@/lib/catalogos'
import type { Documento, CategoriaConCaracteristicasDocs, CaracteristicaDocumento, TipoCaractDocs, EstadoDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { abrirArchivoPorRuta } from '@/lib/extraer-texto'
import { getDirectoryHandle, ensureReadPermission } from '@/lib/file-handle-store'
import { BotonChat } from '@/components/ui/boton-chat'

type TabModal = 'datos' | 'caracteristicas' | 'chunks'

// Estados en los que ya hay chunks disponibles
const ESTADOS_CON_CHUNKS = new Set(['CHUNKEADO', 'VECTORIZADO'])

export default function PaginaDocumentos() {
  const t = useTranslations('documentos')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [estados, setEstados] = useState<EstadoDoc[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')

  // ── Paginación server-side ────────────────────────────────────────────────
  const filtros = useMemo(() => ({
    q: busqueda.trim() || undefined,
    activo: true,
    codigo_estado_doc: estadoFiltro || undefined,
  }), [busqueda, estadoFiltro])
  const fetcher = useCallback(
    (params: { page: number; limit: number; q?: string; activo?: boolean }) =>
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
  } = usePaginacion<Documento, { q?: string; activo?: boolean }>({
    fetcher,
    filtros,
    limitInicial: 50,
  })

  // ── Modal CRUD ────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Documento | null>(null)
  const [tabModal, setTabModal] = useState<TabModal>('datos')
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

  // ── Modal Confirmar ───────────────────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<Documento | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Caracteristicas ───────────────────────────────────────────────────────
  const [categoriasConCaract, setCategoriasConCaract] = useState<CategoriaConCaracteristicasDocs[]>([])
  const [cargandoCaract, setCargandoCaract] = useState(false)
  const [tiposPorCat, setTiposPorCat] = useState<Record<string, TipoCaractDocs[]>>({})

  // ── Chunks ────────────────────────────────────────────────────────────────
  const [chunksData, setChunksData] = useState<Awaited<ReturnType<typeof documentosApi.listarChunks>> | null>(null)
  const [cargandoChunks, setCargandoChunks] = useState(false)
  const [busquedaChunk, setBusquedaChunk] = useState('')
  const [busquedaChunkInput, setBusquedaChunkInput] = useState('')
  const [paginaChunk, setPaginaChunk] = useState(1)

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

  // ── Formulario nueva caracteristica ───────────────────────────────────────
  const [formCaract, setFormCaract] = useState<{
    codigo_cat_docs: string
    codigo_tipo_docs: string
    valor_texto_docs: string
    valor_numerico_docs: string
    valor_fecha_docs: string
  }>({ codigo_cat_docs: '', codigo_tipo_docs: '', valor_texto_docs: '', valor_numerico_docs: '', valor_fecha_docs: '' })
  const [guardandoCaract, setGuardandoCaract] = useState(false)

  // ── Carga auxiliares (estados, usados en el selector del modal) ────────
  useEffect(() => {
    getEstadosDocs().then(setEstados).catch(() => setEstados([]))
  }, [])
  // Alias: después de crear/editar/eliminar, refrescar la página actual.
  const cargar = refetch

  // ── Cargar caracteristicas ────────────────────────────────────────────────
  const cargarCaracteristicas = useCallback(async (idDocumento: number) => {
    setCargandoCaract(true)
    try {
      const data = await documentosApi.listarCaracteristicas(idDocumento)
      setCategoriasConCaract(data)
      // Cargar tipos para cada categoria
      const tiposMap: Record<string, TipoCaractDocs[]> = {}
      for (const cc of data) {
        const cod = cc.categoria.codigo_cat_docs
        if (!tiposMap[cod]) {
          tiposMap[cod] = await categoriasCaractDocsApi.listarTipos(cod)
        }
      }
      setTiposPorCat(tiposMap)
    } finally {
      setCargandoCaract(false)
    }
  }, [])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre_documento: '', ubicacion_documento: '', resumen_documento: '', fecha_modificacion: '', tamano_kb: '', codigo_estado_doc: '' })
    setError('')
    setTabModal('datos')
    setCategoriasConCaract([])
    setModal(true)
  }

  const abrirEditar = (d: Documento) => {
    setEditando(d)
    setForm({
      nombre_documento: d.nombre_documento,
      ubicacion_documento: d.ubicacion_documento || '',
      resumen_documento: d.resumen_documento || '',
      fecha_modificacion: d.fecha_modificacion ? d.fecha_modificacion.slice(0, 16) : '',
      tamano_kb: d.tamano_kb != null ? String(d.tamano_kb) : '',
      codigo_estado_doc: d.codigo_estado_doc || '',
    })
    setError('')
    setTabModal('datos')
    setChunksData(null)
    setBusquedaChunk('')
    setBusquedaChunkInput('')
    setPaginaChunk(1)
    setModal(true)
    cargarCaracteristicas(d.codigo_documento)
  }

  const guardar = async (cerrar: boolean) => {
    if (!form.nombre_documento.trim()) {
      setError(t('errorNombreObligatorio'))
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await documentosApi.actualizar(editando.codigo_documento, {
          nombre_documento: form.nombre_documento,
          ubicacion_documento: form.ubicacion_documento || undefined,
          resumen_documento: form.resumen_documento || undefined,
          fecha_modificacion: form.fecha_modificacion || undefined,
          tamano_kb: form.tamano_kb ? parseFloat(form.tamano_kb) : undefined,
          codigo_estado_doc: form.codigo_estado_doc || undefined,
        })
        if (cerrar) setModal(false)
      } else {
        const nuevo = await documentosApi.crear({
          nombre_documento: form.nombre_documento,
          codigo_grupo: grupoActivo!,
          ubicacion_documento: form.ubicacion_documento || undefined,
          resumen_documento: form.resumen_documento || undefined,
          fecha_modificacion: form.fecha_modificacion || undefined,
          tamano_kb: form.tamano_kb ? parseFloat(form.tamano_kb) : undefined,
          codigo_estado_doc: form.codigo_estado_doc || undefined,
        })
        if (!cerrar) {
          setEditando(nuevo)
          setForm({
            nombre_documento: nuevo.nombre_documento,
            ubicacion_documento: nuevo.ubicacion_documento || '',
            resumen_documento: nuevo.resumen_documento || '',
            fecha_modificacion: nuevo.fecha_modificacion ? nuevo.fecha_modificacion.slice(0, 16) : '',
            tamano_kb: nuevo.tamano_kb != null ? String(nuevo.tamano_kb) : '',
            codigo_estado_doc: nuevo.codigo_estado_doc || '',
          })
          cargarCaracteristicas(nuevo.codigo_documento)
        } else {
          setModal(false)
        }
      }
      cargar()
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

  // ── CRUD Caracteristicas ──────────────────────────────────────────────────
  const agregarCaracteristica = async (codigoCat: string) => {
    if (!editando || !formCaract.codigo_tipo_docs) return
    setGuardandoCaract(true)
    try {
      await documentosApi.crearCaracteristica(editando.codigo_documento, {
        codigo_cat_docs: codigoCat,
        codigo_tipo_docs: formCaract.codigo_tipo_docs,
        valor_texto_docs: formCaract.valor_texto_docs || undefined,
        valor_numerico_docs: formCaract.valor_numerico_docs ? parseInt(formCaract.valor_numerico_docs) : undefined,
        valor_fecha_docs: formCaract.valor_fecha_docs || undefined,
      } as Partial<CaracteristicaDocumento>)
      setFormCaract({ codigo_cat_docs: '', codigo_tipo_docs: '', valor_texto_docs: '', valor_numerico_docs: '', valor_fecha_docs: '' })
      cargarCaracteristicas(editando.codigo_documento)
    } catch { /* error silencioso */ } finally {
      setGuardandoCaract(false)
    }
  }

  const eliminarCaracteristica = async (idCar: number) => {
    if (!editando) return
    await documentosApi.eliminarCaracteristica(editando.codigo_documento, idCar)
    cargarCaracteristicas(editando.codigo_documento)
  }

  // ── Abrir documento original desde el filesystem local ─────────────────
  // Usa el FileSystemDirectoryHandle persistido en IndexedDB cuando el usuario
  // pickeo la carpeta raiz en /procesar-documentos. NO replica los archivos
  // en ningun storage remoto: simplemente lee del disco del propio usuario.
  const abrirDocumentoLocal = async (d: Documento) => {
    if (!d.ubicacion_documento) {
      alert('Este documento no tiene ubicacion registrada.')
      return
    }
    const handle = await getDirectoryHandle()
    if (!handle) {
      alert(
        'No hay carpeta raiz seleccionada. Ve a "Procesar Documentos" y ' +
        'selecciona el directorio raiz una vez para habilitar esta funcion.'
      )
      return
    }
    const ok = await ensureReadPermission(handle)
    if (!ok) {
      alert('Permiso de lectura denegado para la carpeta seleccionada.')
      return
    }
    try {
      const fileHandle = await abrirArchivoPorRuta(handle, d.ubicacion_documento)
      if (!fileHandle) {
        alert(
          `No se encontro el archivo:\n${d.ubicacion_documento}\n\n` +
          'Verifica que el directorio raiz seleccionado sea el correcto.'
        )
        return
      }
      const file = await fileHandle.getFile()
      const url = URL.createObjectURL(file)
      window.open(url, '_blank', 'noopener,noreferrer')
      // Liberar el blob URL despues de un rato (el browser ya tiene el
      // archivo abierto en la pestania nueva, no lo necesita en memoria).
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      alert(`Error al abrir el documento: ${e instanceof Error ? e.message : e}`)
    }
  }

  // ── Filtro: backend hace la búsqueda y orden, dejamos la lista tal cual ──
  const filtrados = documentos

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
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="text-sm border border-borde rounded-md px-3 py-2 bg-surface text-texto focus:outline-none focus:ring-2 focus:ring-primario"
        >
          <option value="">Todos los estados</option>
          {estados.map((e) => (
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
                        onClick={() => abrirDocumentoLocal(d)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title={t('abrirDocumentoLocal')}
                      >
                        <FileText size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => abrirEditar(d)}
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

      {/* Modal CRUD */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={editando ? `Documento: ${editando.nombre_documento}` : t('nuevoDocumento')}
      >
        <div className="flex flex-col gap-4 w-[900px] max-w-full">
          {/* Tabs dentro del modal */}
          {editando && (
            <div className="flex gap-1 border-b border-borde -mt-2">
              {(['datos', 'caracteristicas'] as TabModal[]).map((tab) => (
                <button key={tab} onClick={() => setTabModal(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tabModal === tab ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                  }`}>
                  {tab === 'datos' ? t('tabDatos') : t('tabCaracteristicas')}
                </button>
              ))}
              {editando && ESTADOS_CON_CHUNKS.has(editando.codigo_estado_doc || '') && (
                <button
                  onClick={() => {
                    setTabModal('chunks')
                    if (!chunksData) cargarChunks(editando.codigo_documento)
                  }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tabModal === 'chunks' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                  }`}
                >
                  Chunks {chunksData ? `(${chunksData.stats.total_chunks})` : ''}
                </button>
              )}
            </div>
          )}

          {/* Tab Datos — 2 columnas con URL ancha */}
          {(tabModal === 'datos' || !editando) && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                {/* Nombre — 5 cols (3/4 del actual de 6) */}
                <div className="col-span-12 md:col-span-5">
                  <Input
                    etiqueta={t('etiquetaNombre')}
                    value={form.nombre_documento}
                    onChange={(e) => setForm({ ...form, nombre_documento: e.target.value })}
                    placeholder={t('placeholderNombre')}
                  />
                </div>
                {/* URL — 7 cols (más ancha) */}
                <div className="col-span-12 md:col-span-7">
                  <Input
                    etiqueta={t('etiquetaUbicacion')}
                    value={form.ubicacion_documento}
                    onChange={(e) => setForm({ ...form, ubicacion_documento: e.target.value })}
                    placeholder={t('placeholderUbicacion')}
                  />
                </div>

                {/* Fecha — 5 cols */}
                <div className="col-span-12 md:col-span-5">
                  <Input
                    etiqueta={t('etiquetaFechaModificacion')}
                    type="datetime-local"
                    value={form.fecha_modificacion}
                    onChange={(e) => setForm({ ...form, fecha_modificacion: e.target.value })}
                  />
                </div>
                {/* Tamaño — 3 cols */}
                <div className="col-span-6 md:col-span-3">
                  <Input
                    etiqueta={t('etiquetaTamano')}
                    type="number"
                    value={form.tamano_kb}
                    onChange={(e) => setForm({ ...form, tamano_kb: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                {/* Estado — 4 cols */}
                <div className="col-span-6 md:col-span-4">
                  <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaEstado')}</label>
                  <select
                    className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                    value={form.codigo_estado_doc}
                    onChange={(e) => setForm({ ...form, codigo_estado_doc: e.target.value })}
                  >
                    <option value="">{t('sinEstado')}</option>
                    {estados.filter((e) => e.activo).map((e) => (
                      <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>
                        {e.nombre_estado}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Detalle del estado — solo lectura, fila completa, oculto si vacio */}
                {editando && editando.detalle_estado && (
                  <div className="col-span-12">
                    <label className="block text-sm font-medium text-texto mb-1.5">{t('etiquetaDetalleEstado')}</label>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 whitespace-pre-wrap">
                      {editando.detalle_estado}
                    </div>
                  </div>
                )}

                {/* Resumen — fila completa */}
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
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModal(false)}
                cargando={guardando}
              />
            </div>
          )}

          {/* Tab Caracteristicas — formato compacto Tipo: Valor */}
          {tabModal === 'caracteristicas' && editando && (
            <div className="flex flex-col gap-3">
              {cargandoCaract ? (
                <p className="text-sm text-texto-muted py-4 text-center">{t('cargandoCaracteristicas')}</p>
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
                          const valor = c.valor_texto_docs || c.valor_numerico_docs || c.valor_fecha_docs
                          if (!valor) return null
                          return (
                            <div key={c.id_caracteristica_docs} className="text-sm flex items-center gap-2 group">
                              <span className="text-texto-muted">{tipoNombre}:</span>
                              <span className="text-texto">{valor}</span>
                              {cat.editable_en_detalle_docs && (
                                <button onClick={() => eliminarCaracteristica(c.id_caracteristica_docs)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-all">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
              <PieBotonesModal
                editando={!!editando}
                onGuardar={() => guardar(false)}
                onGuardarYSalir={() => guardar(true)}
                onCerrar={() => setModal(false)}
                cargando={guardando}
              />
            </div>
          )}

          {/* Tab Chunks */}
          {tabModal === 'chunks' && editando && (
            <div className="flex flex-col gap-3">
              {/* Buscador */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                  <input
                    className="w-full rounded-lg border border-borde bg-fondo-tarjeta pl-8 pr-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                    placeholder={t('buscarChunksPlaceholder')}
                    value={busquedaChunkInput}
                    onChange={(e) => setBusquedaChunkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setBusquedaChunk(busquedaChunkInput)
                        setPaginaChunk(1)
                        cargarChunks(editando.codigo_documento, busquedaChunkInput, 1)
                      }
                    }}
                  />
                </div>
                <Boton variante="contorno" onClick={() => {
                  setBusquedaChunk(busquedaChunkInput)
                  setPaginaChunk(1)
                  cargarChunks(editando.codigo_documento, busquedaChunkInput, 1)
                }}>
                  {tc('buscar').replace('...', '')}
                </Boton>
                {busquedaChunk && (
                  <Boton variante="contorno" onClick={() => {
                    setBusquedaChunk('')
                    setBusquedaChunkInput('')
                    setPaginaChunk(1)
                    cargarChunks(editando.codigo_documento, '', 1)
                  }}>
                    {t('limpiar')}
                  </Boton>
                )}
              </div>

              {/* Stats */}
              {chunksData && (
                <div className="flex gap-4 text-xs text-texto-muted bg-fondo px-3 py-2 rounded-lg">
                  <span><b className="text-texto">{chunksData.stats.total_chunks}</b> chunks</span>
                  <span><b className="text-texto">{chunksData.stats.avg_chars.toLocaleString()}</b> chars promedio</span>
                  <span><b className="text-texto">{(chunksData.stats.n_chars_total / 1000).toFixed(1)}k</b> chars total</span>
                  {chunksData.stats.vectorizado
                    ? <span className="text-green-600 font-medium">{t('vectorizado')}</span>
                    : <span className="text-amber-600">{t('sinVectorizar')}</span>
                  }
                </div>
              )}

              {/* Lista de chunks */}
              {cargandoChunks ? (
                <p className="text-sm text-texto-muted py-4 text-center">{t('cargandoChunks')}</p>
              ) : !chunksData ? (
                <p className="text-sm text-texto-muted py-4 text-center">{t('sinChunksData')}</p>
              ) : chunksData.chunks.length === 0 ? (
                <p className="text-sm text-texto-muted py-4 text-center">
                  {busquedaChunk ? t('sinResultadosBusqueda', { busqueda: busquedaChunk }) : t('sinChunksGenerados')}
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                  {chunksData.chunks.map((chunk) => {
                    const texto = chunk.texto
                    const mi = chunk.match_inicio
                    const mf = chunk.match_fin
                    const tieneMatch = mi >= 0 && mf > mi

                    return (
                      <div key={chunk.id_chunk} className="rounded-lg border border-borde bg-fondo px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-texto-muted">
                            Chunk {chunk.nro_chunk}
                          </span>
                          <span className="text-xs text-texto-muted">{chunk.n_chars.toLocaleString()} chars</span>
                        </div>
                        <p className="text-xs text-texto leading-relaxed whitespace-pre-wrap break-words">
                          {tieneMatch ? (
                            <>
                              {texto.slice(0, mi)}
                              <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">
                                {texto.slice(mi, mf)}
                              </mark>
                              {texto.slice(mf)}
                            </>
                          ) : (
                            texto.length > 400 ? texto.slice(0, 400) + '…' : texto
                          )}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Paginación chunks */}
              {chunksData && chunksData.busqueda.total_filtrado > 10 && (
                <div className="flex items-center justify-between text-xs text-texto-muted pt-1">
                  <span>
                    {((paginaChunk - 1) * 10) + 1}–{Math.min(paginaChunk * 10, chunksData.busqueda.total_filtrado)} de {chunksData.busqueda.total_filtrado}
                  </span>
                  <div className="flex gap-1">
                    <Boton variante="contorno" onClick={() => {
                      const p = paginaChunk - 1
                      setPaginaChunk(p)
                      cargarChunks(editando.codigo_documento, busquedaChunk, p)
                    }} deshabilitado={paginaChunk <= 1}>
                      ‹
                    </Boton>
                    <Boton variante="contorno" onClick={() => {
                      const p = paginaChunk + 1
                      setPaginaChunk(p)
                      cargarChunks(editando.codigo_documento, busquedaChunk, p)
                    }} deshabilitado={paginaChunk * 10 >= chunksData.busqueda.total_filtrado}>
                      ›
                    </Boton>
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="secundario" onClick={() => setModal(false)}>
                  Cerrar
                </Boton>
              </div>
            </div>
          )}

        </div>
      </Modal>

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
