'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Search, RefreshCw, ArrowUp, Pencil, Trash2, Plus, FolderOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { Paginador } from '@/components/ui/paginador'
import { espaciosTrabajoApi, ubicacionesDocsApi } from '@/lib/api'
import type {
  EspacioTrabajo,
  TipoEspacio,
  AlcanceEspacio,
  UbicacionDoc,
} from '@/lib/tipos'
import { useAuth } from '@/context/AuthContext'

type FormEspacio = {
  nombre_espacio: string
  tipo_espacio: TipoEspacio
  alcance: AlcanceEspacio
  codigo_ubicacion_area: string
  criterio_texto: string
}

const FORM_INICIAL: FormEspacio = {
  nombre_espacio: '',
  tipo_espacio: 'AREA',
  alcance: 'USUARIO',
  codigo_ubicacion_area: '',
  criterio_texto: '',
}

const selectClass =
  'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

function diasRestantes(fechaTermino?: string | null): number | null {
  if (!fechaTermino) return null
  const ms = new Date(fechaTermino).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}

export default function PaginaEspaciosTrabajo() {
  const t = useTranslations('espaciosTrabajo')
  const tc = useTranslations('common')
  const { usuario } = useAuth()
  const codigoUsuario = usuario?.codigo_usuario ?? ''

  // ── Estado de listado ─────────────────────────────────────────────────────
  const [items, setItems] = useState<EspacioTrabajo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [q, setQ] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Catálogo: áreas (para selector cuando alcance=AREA) ───────────────────
  const [areas, setAreas] = useState<UbicacionDoc[]>([])

  // ── Estado de modal ───────────────────────────────────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<EspacioTrabajo | null>(null)
  const [form, setForm] = useState<FormEspacio>(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  // ── Confirmación de eliminar / refrescar / promover ───────────────────────
  const [confirmEliminar, setConfirmEliminar] = useState<EspacioTrabajo | null>(null)
  const [accionando, setAccionando] = useState<number | null>(null)

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await espaciosTrabajoApi.listarPaginado({ page, limit, q: q.trim() || undefined })
      setItems(r.items)
      setTotal(r.total)
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || tc('errorAlGuardar') || 'Error al cargar.')
    } finally {
      setCargando(false)
    }
  }, [page, limit, q, tc])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    ubicacionesDocsApi.listar({ tipo: 'AREA' })
      .then(setAreas)
      .catch(() => setAreas([]))
  }, [])

  // ── Visibilidad agrupada por sección (Mios / Área / Entidad) ──────────────
  const itemsAgrupados = useMemo(() => {
    const mios: EspacioTrabajo[] = []
    const porArea: EspacioTrabajo[] = []
    const porEntidad: EspacioTrabajo[] = []
    for (const e of items) {
      if (e.codigo_usuario === codigoUsuario && e.alcance === 'USUARIO') mios.push(e)
      else if (e.alcance === 'AREA') porArea.push(e)
      else if (e.alcance === 'ENTIDAD') porEntidad.push(e)
      else mios.push(e)  // fallback
    }
    return { mios, porArea, porEntidad }
  }, [items, codigoUsuario])

  // ── Handlers de modal ─────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm(FORM_INICIAL)
    setErrorModal(null)
    setModalAbierto(true)
  }

  const abrirEditar = (e: EspacioTrabajo) => {
    setEditando(e)
    setForm({
      nombre_espacio: e.nombre_espacio ?? '',
      tipo_espacio: e.tipo_espacio,
      alcance: e.alcance,
      codigo_ubicacion_area: e.codigo_ubicacion_area ?? '',
      criterio_texto: e.criterio_texto ?? '',
    })
    setErrorModal(null)
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setEditando(null)
    setErrorModal(null)
  }

  const esCreador = (e: EspacioTrabajo) => e.codigo_usuario === codigoUsuario

  const guardar = async () => {
    setErrorModal(null)
    if (!form.nombre_espacio.trim() && !editando) {
      // permitido (BD autogenera nombre); no es error
    }
    if (form.alcance === 'AREA' && !form.codigo_ubicacion_area) {
      setErrorModal(t('errorAreaRequerida'))
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        // Solo creador puede renombrar/cambiar fecha; cualquiera del alcance puede cambiar criterio
        if (esCreador(editando) && form.nombre_espacio.trim() !== editando.nombre_espacio) {
          await espaciosTrabajoApi.actualizar(editando.id_espacio, {
            nombre_espacio: form.nombre_espacio.trim(),
          })
        }
        if ((form.criterio_texto || '') !== (editando.criterio_texto || '')) {
          await espaciosTrabajoApi.actualizarCriterio(editando.id_espacio, form.criterio_texto.trim())
        }
      } else {
        await espaciosTrabajoApi.crear({
          nombre_espacio: form.nombre_espacio.trim() || undefined,
          tipo_espacio: form.tipo_espacio,
          alcance: form.alcance,
          codigo_ubicacion_area: form.alcance === 'AREA' ? form.codigo_ubicacion_area : null,
          criterio_texto: form.criterio_texto.trim() || undefined,
          ids_documentos: [],
        })
      }
      cerrarModal()
      await cargar()
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorModal(msg || tc('errorAlGuardar') || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const refrescar = async (e: EspacioTrabajo) => {
    setAccionando(e.id_espacio)
    try {
      const r = await espaciosTrabajoApi.refrescar(e.id_espacio)
      // Actualiza el item en memoria
      setItems(prev =>
        prev.map(x =>
          x.id_espacio === e.id_espacio
            ? { ...x, total_documentos: r.documentos, fecha_ultimo_refresco: r.fecha_ultimo_refresco }
            : x,
        ),
      )
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || tc('error') || 'Error al refrescar.')
    } finally {
      setAccionando(null)
    }
  }

  const promover = async (e: EspacioTrabajo) => {
    setAccionando(e.id_espacio)
    try {
      const r = await espaciosTrabajoApi.promover(e.id_espacio)
      setItems(prev =>
        prev.map(x =>
          x.id_espacio === e.id_espacio
            ? { ...x, tipo_espacio: r.tipo_espacio, fecha_termino: r.fecha_termino ?? null }
            : x,
        ),
      )
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || tc('error') || 'Error al promover.')
    } finally {
      setAccionando(null)
    }
  }

  const eliminarConfirmado = async () => {
    if (!confirmEliminar) return
    try {
      await espaciosTrabajoApi.eliminar(confirmEliminar.id_espacio)
      setConfirmEliminar(null)
      await cargar()
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || tc('errorAlEliminar') || 'Error al eliminar.')
      setConfirmEliminar(null)
    }
  }

  // ── Renders auxiliares ────────────────────────────────────────────────────
  const renderFila = (e: EspacioTrabajo) => {
    const dias = diasRestantes(e.fecha_termino)
    const esArea = e.tipo_espacio === 'AREA'
    const puedeEditarCreador = esCreador(e)
    return (
      <TablaFila key={e.id_espacio}>
        <TablaTd onDoubleClick={() => abrirEditar(e)}>
          <button
            onClick={() => abrirEditar(e)}
            className="text-primario hover:underline text-sm font-medium"
          >
            {e.nombre_espacio}
          </button>
        </TablaTd>
        <TablaTd>
          <Insignia variante={esArea ? 'advertencia' : 'exito'}>
            {e.tipo_espacio}
          </Insignia>
        </TablaTd>
        <TablaTd>
          <Insignia variante="neutro">{e.alcance}</Insignia>
        </TablaTd>
        <TablaTd className="text-sm text-texto-muted">
          {esArea && dias !== null
            ? (dias === 0 ? t('vencido') : `${dias} ${t('diasRestantes')}`)
            : '—'}
        </TablaTd>
        <TablaTd className="text-sm text-center">{e.total_documentos ?? 0}</TablaTd>
        <TablaTd className="text-xs text-texto-muted">{e.codigo_usuario}</TablaTd>
        <TablaTd>
          <div className="flex gap-1 justify-end">
            <button
              type="button"
              title={t('refrescar')}
              onClick={() => refrescar(e)}
              disabled={accionando === e.id_espacio}
              className="p-1.5 rounded hover:bg-primario-muy-claro text-primario disabled:opacity-40"
            >
              <RefreshCw size={16} className={accionando === e.id_espacio ? 'animate-spin' : ''} />
            </button>
            {esArea && puedeEditarCreador && (
              <button
                type="button"
                title={t('promover')}
                onClick={() => promover(e)}
                disabled={accionando === e.id_espacio}
                className="p-1.5 rounded hover:bg-primario-muy-claro text-primario disabled:opacity-40"
              >
                <ArrowUp size={16} />
              </button>
            )}
            <button
              type="button"
              title={tc('editar')}
              onClick={() => abrirEditar(e)}
              className="p-1.5 rounded hover:bg-primario-muy-claro text-primario"
            >
              <Pencil size={16} />
            </button>
            {puedeEditarCreador && (
              <button
                type="button"
                title={tc('eliminar')}
                onClick={() => setConfirmEliminar(e)}
                className="p-1.5 rounded hover:bg-error/10 text-error"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </TablaTd>
      </TablaFila>
    )
  }

  const renderSeccion = (titulo: string, lista: EspacioTrabajo[]) => {
    if (lista.length === 0) return null
    return (
      <>
        <TablaFila>
          <TablaTd colSpan={7} className="bg-primario-muy-claro/40 text-xs font-semibold text-texto-muted uppercase tracking-wide py-1.5">
            ─ {titulo} ({lista.length})
          </TablaTd>
        </TablaFila>
        {lista.map(renderFila)}
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-heading flex items-center gap-2">
            <FolderOpen size={24} />
            {t('titulo')}
          </h2>
          <p className="text-sm text-texto-muted mt-1">{t('descripcion')}</p>
        </div>
        <Boton onClick={abrirNuevo} variante="primario">
          <Plus size={16} className="mr-1" />
          {t('nuevo')}
        </Boton>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
          <Input
            placeholder={t('buscarPlaceholder')}
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value) }}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaTh>{t('nombre')}</TablaTh>
            <TablaTh>{t('tipo')}</TablaTh>
            <TablaTh>{t('alcance')}</TablaTh>
            <TablaTh>{t('vencimiento')}</TablaTh>
            <TablaTh className="text-center">{t('docs')}</TablaTh>
            <TablaTh>{t('creador')}</TablaTh>
            <TablaTh className="text-right">{tc('acciones')}</TablaTh>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando && items.length === 0 ? (
            <TablaFila>
              <TablaTd colSpan={7} className="text-center py-8 text-texto-muted">
                {tc('cargando')}
              </TablaTd>
            </TablaFila>
          ) : items.length === 0 ? (
            <TablaFila>
              <TablaTd colSpan={7} className="text-center py-8 text-texto-muted">
                {t('sinResultados')}
              </TablaTd>
            </TablaFila>
          ) : (
            <>
              {renderSeccion(t('seccionMios'), itemsAgrupados.mios)}
              {renderSeccion(t('seccionArea'), itemsAgrupados.porArea)}
              {renderSeccion(t('seccionEntidad'), itemsAgrupados.porEntidad)}
            </>
          )}
        </TablaCuerpo>
      </Tabla>

      <Paginador
        page={page}
        limit={limit}
        total={total}
        onChangePage={setPage}
      />

      {/* ── Modal crear/editar ─────────────────────────────────────────── */}
      <Modal
        abierto={modalAbierto}
        alCerrar={cerrarModal}
        titulo={editando ? t('editar') : t('nuevo')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto mb-1">{t('nombre')}</label>
            <Input
              value={form.nombre_espacio}
              onChange={(e) => setForm({ ...form, nombre_espacio: e.target.value })}
              placeholder={t('nombrePlaceholder')}
              disabled={!!editando && !esCreador(editando)}
            />
            {editando && !esCreador(editando) && (
              <p className="text-xs text-texto-muted mt-1">{t('soloCreadorRenombra')}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">{t('tipo')}</label>
              <select
                className={selectClass}
                value={form.tipo_espacio}
                onChange={(e) => setForm({ ...form, tipo_espacio: e.target.value as TipoEspacio })}
                disabled={!!editando}
              >
                <option value="AREA">AREA — {t('tipoArea')}</option>
                <option value="ESPACIO">ESPACIO — {t('tipoEspacio')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">{t('alcance')}</label>
              <select
                className={selectClass}
                value={form.alcance}
                onChange={(e) => setForm({
                  ...form,
                  alcance: e.target.value as AlcanceEspacio,
                  codigo_ubicacion_area: e.target.value === 'AREA' ? form.codigo_ubicacion_area : '',
                })}
                disabled={!!editando}
              >
                <option value="USUARIO">USUARIO — {t('alcanceUsuario')}</option>
                <option value="AREA">AREA — {t('alcanceArea')}</option>
                <option value="ENTIDAD">ENTIDAD — {t('alcanceEntidad')}</option>
              </select>
            </div>
          </div>

          {form.alcance === 'AREA' && (
            <div>
              <label className="block text-sm font-medium text-texto mb-1">{t('areaDestino')}</label>
              <select
                className={selectClass}
                value={form.codigo_ubicacion_area}
                onChange={(e) => setForm({ ...form, codigo_ubicacion_area: e.target.value })}
                disabled={!!editando}
              >
                <option value="">{t('seleccionarArea')}</option>
                {areas.map((a) => (
                  <option key={a.codigo_ubicacion} value={a.codigo_ubicacion}>
                    {a.alias_ubicacion || a.nombre_ubicacion}
                  </option>
                ))}
              </select>
              <p className="text-xs text-texto-muted mt-1">{t('ayudaArea')}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-texto mb-1">{t('criterioPrompt')}</label>
            <Textarea
              value={form.criterio_texto}
              onChange={(e) => setForm({ ...form, criterio_texto: e.target.value })}
              placeholder={t('criterioPlaceholder')}
              rows={4}
            />
            <p className="text-xs text-texto-muted mt-1">{t('ayudaCriterio')}</p>
          </div>

          {errorModal && (
            <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
              {errorModal}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-borde pt-4">
          <Boton variante="contorno" onClick={cerrarModal}>{tc('cancelar')}</Boton>
          <Boton variante="primario" onClick={guardar} cargando={guardando}>
            {editando ? tc('guardar') : tc('crear')}
          </Boton>
        </div>
      </Modal>

      {/* ── Confirmación de eliminar ──────────────────────────────────── */}
      <ModalConfirmar
        abierto={confirmEliminar !== null}
        alCerrar={() => setConfirmEliminar(null)}
        alConfirmar={eliminarConfirmado}
        titulo={t('eliminarTitulo')}
        mensaje={confirmEliminar ? t('eliminarMensaje', { nombre: confirmEliminar.nombre_espacio }) : ''}
        textoConfirmar={tc('eliminar')}
        variante="peligro"
      />
    </div>
  )
}
