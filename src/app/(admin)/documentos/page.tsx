'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Download, Search, Eye, ExternalLink } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { documentosApi, categoriasCaractDocsApi, estadosDocsApi } from '@/lib/api'
import type { Documento, CategoriaConCaracteristicasDocs, CaracteristicaDocumento, TipoCaractDocs, EstadoDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'

type TabModal = 'datos' | 'caracteristicas'

export default function PaginaDocumentos() {
  const { grupoActivo } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [estados, setEstados] = useState<EstadoDoc[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

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

  // ── Formulario nueva caracteristica ───────────────────────────────────────
  const [formCaract, setFormCaract] = useState<{
    codigo_cat_docs: string
    codigo_tipo_docs: string
    valor_texto_docs: string
    valor_numerico_docs: string
    valor_fecha_docs: string
  }>({ codigo_cat_docs: '', codigo_tipo_docs: '', valor_texto_docs: '', valor_numerico_docs: '', valor_fecha_docs: '' })
  const [guardandoCaract, setGuardandoCaract] = useState(false)

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [docs, ests] = await Promise.all([
        documentosApi.listar(),
        estadosDocsApi.listar(),
      ])
      setDocumentos(docs)
      setEstados(ests)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

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
    setModal(true)
    cargarCaracteristicas(d.codigo_documento)
  }

  const guardar = async () => {
    if (!form.nombre_documento.trim()) {
      setError('El nombre del documento es obligatorio')
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
      } else {
        await documentosApi.crear({
          nombre_documento: form.nombre_documento,
          codigo_grupo: grupoActivo!,
          ubicacion_documento: form.ubicacion_documento || undefined,
          resumen_documento: form.resumen_documento || undefined,
          fecha_modificacion: form.fecha_modificacion || undefined,
          tamano_kb: form.tamano_kb ? parseFloat(form.tamano_kb) : undefined,
          codigo_estado_doc: form.codigo_estado_doc || undefined,
        })
      }
      setModal(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
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
      setError(e instanceof Error ? e.message : 'Error al desactivar')
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

  // ── Filtro ────────────────────────────────────────────────────────────────
  const filtrados = documentos
    .filter(
      (d) =>
        d.nombre_documento.toLowerCase().includes(busqueda.toLowerCase()) ||
        (d.resumen_documento || '').toLowerCase().includes(busqueda.toLowerCase())
    )
    .sort((a, b) => a.nombre_documento.localeCompare(b.nombre_documento))

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-texto">Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">Gestion de documentos del grupo</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Buscar por nombre o resumen..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={() =>
              exportarExcel(
                filtrados as unknown as Record<string, unknown>[],
                [
                  { titulo: 'ID', campo: 'codigo_documento' },
                  { titulo: 'Nombre', campo: 'nombre_documento' },
                  { titulo: 'Ubicacion', campo: 'ubicacion_documento' },
                  { titulo: 'Resumen', campo: 'resumen_documento' },
                  { titulo: 'Fecha Modificación', campo: 'fecha_modificacion' },
                  { titulo: 'Tamaño KB', campo: 'tamano_kb' },
                  { titulo: 'Estado Doc', campo: 'codigo_estado_doc' },
                  { titulo: 'Estado', campo: 'activo', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
                ],
                'documentos'
              )
            }
            disabled={filtrados.length === 0}
          >
            <Download size={15} />
            Excel
          </Boton>
          <Boton variante="primario" onClick={abrirNuevo}>
            <Plus size={16} />
            Nuevo documento
          </Boton>
        </div>
      </div>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>ID</TablaTh>
            <TablaTh>Nombre</TablaTh>
            <TablaTh>Ubicación</TablaTh>
            <TablaTh>Estado</TablaTh>
            <TablaTh className="text-right">Acciones</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                Cargando...
              </TablaTd>
            </TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                No se encontraron documentos
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
                <TablaTd className="max-w-[200px]">
                  <span className="font-medium truncate block" title={d.nombre_documento}>
                    {d.nombre_documento}
                  </span>
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
                  <Insignia variante={d.activo ? 'exito' : 'error'}>
                    {d.activo ? 'Activo' : 'Inactivo'}
                  </Insignia>
                </TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    {d.ubicacion_documento && (
                      <a
                        href={d.ubicacion_documento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title="Abrir documento original"
                      >
                        <ExternalLink size={16} />
                      </a>
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
                      className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                      title="Desactivar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </TablaTd>
              </TablaFila>
            ))
          )}
        </TablaCuerpo>
      </Tabla>

      {/* Modal CRUD */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={editando ? `Documento: ${editando.nombre_documento}` : 'Nuevo documento'}
      >
        <div className="flex flex-col gap-4 w-[900px] max-w-full">
          {/* Tabs dentro del modal */}
          {editando && (
            <div className="flex gap-1 border-b border-borde -mt-2">
              {(['datos', 'caracteristicas'] as TabModal[]).map((t) => (
                <button key={t} onClick={() => setTabModal(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tabModal === t ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                  }`}>
                  {t === 'datos' ? 'Datos' : 'Características'}
                </button>
              ))}
            </div>
          )}

          {/* Tab Datos — 2 columnas con URL ancha */}
          {(tabModal === 'datos' || !editando) && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                {/* Nombre — 5 cols (3/4 del actual de 6) */}
                <div className="col-span-12 md:col-span-5">
                  <Input
                    etiqueta="Nombre del documento *"
                    value={form.nombre_documento}
                    onChange={(e) => setForm({ ...form, nombre_documento: e.target.value })}
                    placeholder="Nombre del documento"
                  />
                </div>
                {/* URL — 7 cols (más ancha) */}
                <div className="col-span-12 md:col-span-7">
                  <Input
                    etiqueta="Ubicación (URL o ruta)"
                    value={form.ubicacion_documento}
                    onChange={(e) => setForm({ ...form, ubicacion_documento: e.target.value })}
                    placeholder="https://ejemplo.com/documento.pdf"
                  />
                </div>

                {/* Fecha — 5 cols */}
                <div className="col-span-12 md:col-span-5">
                  <Input
                    etiqueta="Fecha de modificación"
                    type="datetime-local"
                    value={form.fecha_modificacion}
                    onChange={(e) => setForm({ ...form, fecha_modificacion: e.target.value })}
                  />
                </div>
                {/* Tamaño — 3 cols */}
                <div className="col-span-6 md:col-span-3">
                  <Input
                    etiqueta="Tamaño (KB)"
                    type="number"
                    value={form.tamano_kb}
                    onChange={(e) => setForm({ ...form, tamano_kb: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                {/* Estado — 4 cols */}
                <div className="col-span-6 md:col-span-4">
                  <label className="block text-sm font-medium text-texto mb-1.5">Estado</label>
                  <select
                    className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                    value={form.codigo_estado_doc}
                    onChange={(e) => setForm({ ...form, codigo_estado_doc: e.target.value })}
                  >
                    <option value="">— Sin estado —</option>
                    {estados.filter((e) => e.activo).map((e) => (
                      <option key={e.codigo_estado_doc} value={e.codigo_estado_doc}>
                        {e.nombre_estado}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resumen — fila completa */}
                <div className="col-span-12">
                  <label className="block text-sm font-medium text-texto mb-1.5">Resumen</label>
                  <textarea
                    className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[100px]"
                    value={form.resumen_documento}
                    onChange={(e) => setForm({ ...form, resumen_documento: e.target.value })}
                    placeholder="Breve descripcion del contenido del documento"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModal(false)}>
                  Cancelar
                </Boton>
                <Boton variante="primario" onClick={guardar} cargando={guardando}>
                  {editando ? 'Guardar' : 'Crear'}
                </Boton>
              </div>
            </div>
          )}

          {/* Tab Caracteristicas — formato compacto Tipo: Valor */}
          {tabModal === 'caracteristicas' && editando && (
            <div className="flex flex-col gap-3">
              {cargandoCaract ? (
                <p className="text-sm text-texto-muted py-4 text-center">Cargando características...</p>
              ) : categoriasConCaract.filter((cc) => cc.caracteristicas.length > 0).length === 0 ? (
                <p className="text-sm text-texto-muted py-4 text-center">Sin características.</p>
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
            </div>
          )}

        </div>
      </Modal>

      {/* Modal Confirmar */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo="Desactivar documento"
        mensaje={
          confirmacion
            ? `Desactivar el documento "${confirmacion.nombre_documento}"?`
            : ''
        }
        textoConfirmar="Desactivar"
        cargando={eliminando}
      />
    </div>
  )
}
