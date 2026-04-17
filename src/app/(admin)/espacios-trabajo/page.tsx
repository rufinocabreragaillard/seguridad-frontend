'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { espaciosTrabajoApi } from '@/lib/api'
import type { EspacioTrabajo, DocumentoEspacio } from '@/lib/tipos'
import { usePaginacion } from '@/hooks/usePaginacion'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Insignia } from '@/components/ui/insignia'
import { Paginador } from '@/components/ui/paginador'
import {
  Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd,
} from '@/components/ui/tabla'
import {
  FolderOpen, Plus, Pencil, Trash2, Search, X, FileText,
  BookOpen, FolderPlus, CheckCircle2, Circle,
} from 'lucide-react'

// ─── Tipos de filtros (debe extender Record<string,unknown> para usePaginacion) ─
interface Filtros extends Record<string, unknown> {
  q: string
  tipo_espacio: string
  solo_propios: boolean
}

type TabModal = 'datos' | 'documentos'

// ─── Formulario vacío ────────────────────────────────────────────────────────
const FORM_VACIO = {
  nombre_espacio: '',
  descripcion: '',
  tipo_espacio: 'TEMPORAL' as 'TEMPORAL' | 'GUARDADO',
  fecha_termino: '',
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function EspaciosTrabajoPage() {
  useAuth()

  // ── Paginación ──────────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState<Filtros>({ q: '', tipo_espacio: '', solo_propios: false })
  const [inputQ, setInputQ] = useState('')

  const fetcher = useCallback(
    (params: { page: number; limit: number }) =>
      espaciosTrabajoApi.listarPaginado({
        ...params,
        q: filtros.q as string || undefined,
        tipo_espacio: filtros.tipo_espacio as string || undefined,
        solo_propios: (filtros.solo_propios as boolean) || undefined,
      }),
    [filtros],
  )
  const { items, total, page, limit, cargando, setPage, setLimit, refetch } =
    usePaginacion<EspacioTrabajo, Filtros>({ fetcher, filtros, limitInicial: 20 })

  // ── Estado modal CRUD ───────────────────────────────────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<EspacioTrabajo | null>(null)
  const [tabModal, setTabModal] = useState<TabModal>('datos')
  const [form, setForm] = useState({ ...FORM_VACIO })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Confirmación eliminar ───────────────────────────────────────────────────
  const [confirmEliminar, setConfirmEliminar] = useState<EspacioTrabajo | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Documentos del espacio ──────────────────────────────────────────────────
  const [docsEspacio, setDocsEspacio] = useState<DocumentoEspacio[]>([])
  const [cargandoDocs, setCargandoDocs] = useState(false)
  const [qDocs, setQDocs] = useState('')

  // ── Buscar documentos para agregar ─────────────────────────────────────────
  const [modalAgregarDocs, setModalAgregarDocs] = useState(false)
  const [docsDisponibles, setDocsDisponibles] = useState<DocumentoEspacio[]>([])
  const [cargandoDisp, setCargandoDisp] = useState(false)
  const [qDisp, setQDisp] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [agregando, setAgregando] = useState(false)

  // ─── Abrir modal crear ───────────────────────────────────────────────────────
  const abrirCrear = () => {
    setEditando(null)
    setForm({ ...FORM_VACIO })
    setTabModal('datos')
    setDocsEspacio([])
    setError('')
    setModalAbierto(true)
  }

  // ─── Abrir modal editar ──────────────────────────────────────────────────────
  const abrirEditar = (e: EspacioTrabajo) => {
    setEditando(e)
    setForm({
      nombre_espacio: e.nombre_espacio,
      descripcion: e.descripcion || '',
      tipo_espacio: e.tipo_espacio,
      fecha_termino: e.fecha_termino ? e.fecha_termino.slice(0, 10) : '',
    })
    setTabModal('datos')
    setQDocs('')
    setError('')
    setModalAbierto(true)
    cargarDocumentosEspacio(e.id_espacio, '')
  }

  // ─── Cargar docs del espacio ─────────────────────────────────────────────────
  const cargarDocumentosEspacio = async (id: number, q?: string) => {
    setCargandoDocs(true)
    try {
      const docs = await espaciosTrabajoApi.listarDocumentos(id, q)
      setDocsEspacio(docs)
    } catch { /* silencioso */ } finally {
      setCargandoDocs(false)
    }
  }

  // ─── Cambiar tab ────────────────────────────────────────────────────────────
  const cambiarTab = (tab: TabModal) => {
    setTabModal(tab)
    if (tab === 'documentos' && editando) {
      cargarDocumentosEspacio(editando.id_espacio, qDocs)
    }
  }

  // ─── Guardar ────────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.nombre_espacio.trim()) { setError('El nombre es requerido'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        nombre_espacio: form.nombre_espacio.trim(),
        descripcion: form.descripcion.trim() || undefined,
        tipo_espacio: form.tipo_espacio,
        fecha_termino: form.fecha_termino || undefined,
      }
      if (editando) {
        await espaciosTrabajoApi.actualizar(editando.id_espacio, payload)
      } else {
        await espaciosTrabajoApi.crear(payload)
      }
      setModalAbierto(false)
      refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ─── Eliminar ────────────────────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await espaciosTrabajoApi.eliminar(confirmEliminar.id_espacio)
      setConfirmEliminar(null)
      refetch()
    } catch { /* silencioso */ } finally {
      setEliminando(false)
    }
  }

  // ─── Quitar documento del espacio ────────────────────────────────────────────
  const quitarDocumento = async (codDoc: number) => {
    if (!editando) return
    await espaciosTrabajoApi.quitarDocumento(editando.id_espacio, codDoc)
    cargarDocumentosEspacio(editando.id_espacio, qDocs)
    refetch()
  }

  // ─── Modal agregar documentos ─────────────────────────────────────────────────
  const abrirAgregarDocs = async () => {
    if (!editando) return
    setSeleccionados(new Set())
    setQDisp('')
    setModalAgregarDocs(true)
    await cargarDisponibles(editando.id_espacio, '')
  }

  const cargarDisponibles = async (id: number, q: string) => {
    setCargandoDisp(true)
    try {
      const docs = await espaciosTrabajoApi.listarDocumentosDisponibles(id, { q: q || undefined, limit: 100 })
      setDocsDisponibles(docs)
    } catch { /* silencioso */ } finally {
      setCargandoDisp(false)
    }
  }

  const toggleSeleccion = (cod: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(cod)) next.delete(cod); else next.add(cod)
      return next
    })
  }

  const agregarSeleccionados = async () => {
    if (!editando || seleccionados.size === 0) return
    setAgregando(true)
    try {
      await espaciosTrabajoApi.agregarDocumentos(editando.id_espacio, [...seleccionados])
      setModalAgregarDocs(false)
      cargarDocumentosEspacio(editando.id_espacio, qDocs)
      refetch()
    } catch { /* silencioso */ } finally {
      setAgregando(false)
    }
  }

  // ─── Buscar en la lista principal ────────────────────────────────────────────
  const buscar = () => setFiltros(f => ({ ...f, q: inputQ }))

  const tipoBadge = (tipo: string) =>
    tipo === 'GUARDADO'
      ? <Insignia variante="exito">Guardado</Insignia>
      : <Insignia variante="neutro">Temporal</Insignia>

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="text-primario" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-texto">Espacios de Trabajo</h1>
            <p className="text-sm text-texto-muted">
              Agrupa documentos en espacios temporales o guardados
            </p>
          </div>
        </div>
        <Boton variante="primario" onClick={abrirCrear}>
          <Plus size={16} />
          Nuevo espacio
        </Boton>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end bg-surface border border-borde rounded-lg p-4">
        <div className="flex gap-2 flex-1 min-w-48">
          <Input
            placeholder="Buscar por nombre…"
            value={inputQ}
            onChange={e => setInputQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
          />
          <Boton variante="contorno" onClick={buscar}>
            <Search size={16} />
            Buscar
          </Boton>
        </div>
        <select
          className="border border-borde rounded-lg px-3 py-2 text-sm text-texto bg-fondo"
          value={filtros.tipo_espacio as string}
          onChange={e => setFiltros(f => ({ ...f, tipo_espacio: e.target.value }))}
        >
          <option value="">Todos los tipos</option>
          <option value="TEMPORAL">Temporal</option>
          <option value="GUARDADO">Guardado</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-texto cursor-pointer">
          <input
            type="checkbox"
            checked={filtros.solo_propios as boolean}
            onChange={e => setFiltros(f => ({ ...f, solo_propios: e.target.checked }))}
            className="rounded"
          />
          Solo mis espacios
        </label>
      </div>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaTh>Nombre</TablaTh>
            <TablaTh>Tipo</TablaTh>
            <TablaTh>Docs</TablaTh>
            <TablaTh>Creado</TablaTh>
            <TablaTh>Fecha término</TablaTh>
            <TablaTh>Acciones</TablaTh>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd colSpan={6} className="text-center text-texto-muted py-8">
                Cargando…
              </TablaTd>
            </TablaFila>
          ) : items.length === 0 ? (
            <TablaFila>
              <TablaTd colSpan={6} className="text-center text-texto-muted py-8">
                No hay espacios de trabajo
              </TablaTd>
            </TablaFila>
          ) : items.map(esp => (
            <TablaFila key={esp.id_espacio}>
              <TablaTd>
                <div className="font-medium text-texto">{esp.nombre_espacio}</div>
                {esp.descripcion && (
                  <div className="text-xs text-texto-muted truncate max-w-xs">{esp.descripcion}</div>
                )}
              </TablaTd>
              <TablaTd>{tipoBadge(esp.tipo_espacio)}</TablaTd>
              <TablaTd>
                <span className="flex items-center gap-1 text-sm text-texto-muted">
                  <FileText size={14} />
                  {esp.total_documentos ?? 0}
                </span>
              </TablaTd>
              <TablaTd className="text-sm text-texto-muted whitespace-nowrap">
                {new Date(esp.fecha_creacion).toLocaleDateString('es-CL')}
              </TablaTd>
              <TablaTd className="text-sm text-texto-muted whitespace-nowrap">
                {esp.fecha_termino
                  ? new Date(esp.fecha_termino).toLocaleDateString('es-CL')
                  : <span className="text-texto-muted/50">—</span>}
              </TablaTd>
              <TablaTd>
                <div className="flex gap-1">
                  <button
                    onClick={() => abrirEditar(esp)}
                    className="p-1.5 rounded hover:bg-fondo text-texto-muted hover:text-texto transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmEliminar(esp)}
                    className="p-1.5 rounded hover:bg-fondo text-texto-muted hover:text-error transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      <Paginador
        page={page}
        limit={limit}
        total={total}
        onChangePage={setPage}
        onChangeLimit={setLimit}
      />

      {/* ── Modal crear/editar ─────────────────────────────────────────── */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={editando ? `Editar: ${editando.nombre_espacio}` : 'Nuevo Espacio de Trabajo'}
      >
        {/* Tabs */}
        <div className="flex border-b border-borde mb-4">
          {(['datos', 'documentos'] as TabModal[]).map(tab => (
            <button
              key={tab}
              onClick={() => cambiarTab(tab)}
              disabled={tab === 'documentos' && !editando}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tabModal === tab
                  ? 'border-b-2 border-primario text-primario'
                  : 'text-texto-muted hover:text-texto'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {tab === 'datos' ? (
                <span className="flex items-center gap-1.5"><BookOpen size={14} />Datos</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <FileText size={14} />Documentos
                  {editando && (
                    <span className="ml-1 text-xs bg-primario/10 text-primario px-1.5 rounded-full">
                      {docsEspacio.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Datos */}
        {tabModal === 'datos' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-texto mb-1 block">Nombre</label>
              <Input
                placeholder="Nombre del espacio de trabajo"
                value={form.nombre_espacio}
                onChange={e => setForm(f => ({ ...f, nombre_espacio: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-texto mb-1 block">Descripción</label>
              <textarea
                className="w-full border border-borde rounded-lg px-3 py-2 text-sm text-texto bg-fondo resize-none focus:outline-none focus:ring-2 focus:ring-primario/30"
                rows={3}
                placeholder="Descripción opcional…"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-texto mb-1 block">Tipo</label>
                <select
                  className="w-full border border-borde rounded-lg px-3 py-2 text-sm text-texto bg-fondo focus:outline-none focus:ring-2 focus:ring-primario/30"
                  value={form.tipo_espacio}
                  onChange={e => setForm(f => ({ ...f, tipo_espacio: e.target.value as 'TEMPORAL' | 'GUARDADO' }))}
                >
                  <option value="TEMPORAL">Temporal</option>
                  <option value="GUARDADO">Guardado</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-texto mb-1 block">Fecha término</label>
                <Input
                  type="date"
                  value={form.fecha_termino}
                  onChange={e => setForm(f => ({ ...f, fecha_termino: e.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Salir</Boton>
              <Boton variante="primario" onClick={guardar} cargando={guardando}>
                {editando ? 'Guardar cambios' : 'Crear espacio'}
              </Boton>
            </div>
          </div>
        )}

        {/* Tab: Documentos */}
        {tabModal === 'documentos' && editando && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <div className="flex gap-2 flex-1">
                <Input
                  placeholder="Filtrar documentos…"
                  value={qDocs}
                  onChange={e => setQDocs(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') cargarDocumentosEspacio(editando.id_espacio, qDocs)
                  }}
                />
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => cargarDocumentosEspacio(editando.id_espacio, qDocs)}
                >
                  <Search size={14} />
                  Filtrar
                </Boton>
              </div>
              <Boton
                variante="primario"
                tamano="sm"
                onClick={abrirAgregarDocs}
              >
                <FolderPlus size={14} />
                Agregar docs
              </Boton>
            </div>

            {cargandoDocs ? (
              <p className="text-sm text-texto-muted text-center py-4">Cargando…</p>
            ) : docsEspacio.length === 0 ? (
              <div className="text-center py-8 text-texto-muted">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin documentos en este espacio</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {docsEspacio.map(doc => (
                  <div
                    key={doc.codigo_documento}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-fondo border border-transparent hover:border-borde transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText size={14} className="text-texto-muted flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-texto truncate">{doc.nombre_documento}</p>
                        {doc.ubicacion_documento && (
                          <p className="text-xs text-texto-muted truncate">{doc.ubicacion_documento}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {doc.codigo_estado_doc && (
                        <Insignia variante="neutro">{doc.codigo_estado_doc}</Insignia>
                      )}
                      <button
                        onClick={() => quitarDocumento(doc.codigo_documento)}
                        className="p-1 rounded hover:bg-fondo text-texto-muted hover:text-error transition-colors"
                        title="Quitar del espacio"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal agregar documentos ──────────────────────────────────── */}
      <Modal
        abierto={modalAgregarDocs}
        alCerrar={() => setModalAgregarDocs(false)}
        titulo="Agregar documentos al espacio"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar documentos…"
              value={qDisp}
              onChange={e => setQDisp(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && editando) cargarDisponibles(editando.id_espacio, qDisp)
              }}
            />
            <Boton
              variante="contorno"
              tamano="sm"
              onClick={() => editando && cargarDisponibles(editando.id_espacio, qDisp)}
            >
              <Search size={14} />
              Buscar
            </Boton>
          </div>

          {seleccionados.size > 0 && (
            <p className="text-xs text-primario font-medium">
              {seleccionados.size} documento{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}
            </p>
          )}

          {cargandoDisp ? (
            <p className="text-sm text-texto-muted text-center py-4">Cargando…</p>
          ) : docsDisponibles.length === 0 ? (
            <div className="text-center py-6 text-texto-muted">
              <FileText size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay documentos disponibles para agregar</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {docsDisponibles.map(doc => {
                const sel = seleccionados.has(doc.codigo_documento)
                return (
                  <div
                    key={doc.codigo_documento}
                    onClick={() => toggleSeleccion(doc.codigo_documento)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
                      sel
                        ? 'border-primario bg-primario/5'
                        : 'border-transparent hover:bg-fondo hover:border-borde'
                    }`}
                  >
                    {sel
                      ? <CheckCircle2 size={16} className="text-primario flex-shrink-0" />
                      : <Circle size={16} className="text-texto-muted flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-texto truncate">{doc.nombre_documento}</p>
                      {doc.ubicacion_documento && (
                        <p className="text-xs text-texto-muted truncate">{doc.ubicacion_documento}</p>
                      )}
                    </div>
                    {doc.codigo_estado_doc && (
                      <Insignia variante="neutro">{doc.codigo_estado_doc}</Insignia>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-borde">
            <Boton variante="contorno" onClick={() => setModalAgregarDocs(false)}>Cancelar</Boton>
            <Boton
              variante="primario"
              onClick={agregarSeleccionados}
              cargando={agregando}
              disabled={seleccionados.size === 0}
            >
              <FolderPlus size={14} />
              Agregar {seleccionados.size > 0 ? `(${seleccionados.size})` : ''}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Modal confirmar eliminar ──────────────────────────────────── */}
      <ModalConfirmar
        abierto={!!confirmEliminar}
        titulo="Eliminar espacio de trabajo"
        mensaje={`¿Eliminar el espacio "${confirmEliminar?.nombre_espacio}"? Esta acción no se puede deshacer. Los documentos no se eliminarán.`}
        alConfirmar={confirmarEliminar}
        alCerrar={() => setConfirmEliminar(null)}
        cargando={eliminando}
        variante="peligro"
      />
    </div>
  )
}
