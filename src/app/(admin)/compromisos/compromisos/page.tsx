'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Download } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { compromisosApi, compromisosDatosBasicosApi, usuariosApi, entidadesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Compromiso, TipoCompromiso, EstadoCompromiso, Conversacion, Usuario, Area } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

const PRIORIDAD_VARIANTE: Record<string, 'error' | 'advertencia' | 'primario' | 'exito'> = {
  urgente: 'error',
  alto: 'advertencia',
  medio: 'primario',
  bajo: 'exito',
}

const PRIORIDADES = [
  { valor: 'urgente', etiqueta: 'Urgente' },
  { valor: 'alto', etiqueta: 'Alto' },
  { valor: 'medio', etiqueta: 'Medio' },
  { valor: 'bajo', etiqueta: 'Bajo' },
]

const TIPOS_MIME = [
  { valor: 'application/pdf', etiqueta: 'PDF' },
  { valor: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', etiqueta: 'Word (DOCX)' },
  { valor: 'message/rfc822', etiqueta: 'Correo (EML)' },
]

const formInicial = {
  codigo_tipo_compromiso: '',
  asunto: '',
  descripcion: '',
  prioridad: 'medio' as 'urgente' | 'alto' | 'medio' | 'bajo',
  codigo_estado_compromiso: '',
  fecha_esperada: '',
  id_conversacion: '' as string | number,
  comentarios: '',
  esfuerzo_horas: '' as string | number,
  costo_compromiso: '' as string | number,
  codigo_usuario_destinatario: '',
  codigo_area_asignada: '',
  codigo_usuario_asignado: '',
}

const adjuntoInicial = { nombre: '', url: '', tipo_mime: '', tamano: '' as string | number }

export default function PaginaCompromisos() {
  const { usuario: usuarioActual } = useAuth()
  const grupoActivo = usuarioActual?.grupo_activo ?? ''
  const entidadActiva = usuarioActual?.entidad_activa ?? ''

  // ── Estado principal ──────────────────────────────────────────────────────
  const [compromisos, setCompromisos] = useState<Compromiso[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Compromiso | null>(null)
  const [tabModal, setTabModal] = useState<'datos' | 'asignacion' | 'adjunto'>('datos')
  const [form, setForm] = useState({ ...formInicial })
  const [formAdjunto, setFormAdjunto] = useState({ ...adjuntoInicial })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Datos auxiliares ──────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoCompromiso[]>([])
  const [estados, setEstados] = useState<EstadoCompromiso[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const [confirmarEliminar, setConfirmarEliminar] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga inicial ─────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      const [cmps, tps, usrs] = await Promise.all([
        compromisosApi.listarCompromisos(),
        compromisosDatosBasicosApi.listarTiposCmp(),
        usuariosApi.listar(),
      ])
      setCompromisos(cmps)
      setTipos(tps)
      setUsuarios(usrs)

      // Cargar areas de la entidad activa
      if (entidadActiva) {
        try {
          const ars = await entidadesApi.listarAreas(entidadActiva)
          setAreas(ars)
        } catch {
          setAreas([])
        }
      }

      // Cargar conversaciones
      try {
        const cnvs = await compromisosApi.listarConversaciones()
        setConversaciones(cnvs)
      } catch {
        setConversaciones([])
      }
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error al cargar compromisos')
    } finally {
      setCargando(false)
    }
  }, [entidadActiva])

  useEffect(() => { cargar() }, [cargar])

  // ── Cargar estados cuando cambia tipo en el form ─────────────────────────
  useEffect(() => {
    if (!form.codigo_tipo_compromiso) {
      setEstados([])
      return
    }
    compromisosDatosBasicosApi.listarEstadosCmp(form.codigo_tipo_compromiso)
      .then(setEstados)
      .catch(() => setEstados([]))
  }, [form.codigo_tipo_compromiso])

  // ── Filtros ───────────────────────────────────────────────────────────────
  const compromisosFiltrados = compromisos.filter((c) => {
    const coincideBusqueda =
      !busqueda ||
      (c.asunto || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())

    const coincideTipo = !filtroTipo || c.codigo_tipo_compromiso === filtroTipo
    const coincidePrioridad = !filtroPrioridad || c.prioridad === filtroPrioridad

    return coincideBusqueda && coincideTipo && coincidePrioridad
  })

  // ── Helpers de nombres ────────────────────────────────────────────────────
  const nombreTipo = (codigo: string) =>
    tipos.find((t) => t.codigo_tipo_compromiso === codigo)?.nombre || codigo

  const nombreUsuario = (codigo?: string) => {
    if (!codigo) return ''
    const u = usuarios.find((u) => u.codigo_usuario === codigo)
    return u?.nombre || codigo
  }

  const nombreArea = (codigo?: string) => {
    if (!codigo) return ''
    const a = areas.find((a) => a.codigo_area === codigo)
    return a?.nombre || codigo
  }

  // ── Abrir modal ───────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...formInicial })
    setFormAdjunto({ ...adjuntoInicial })
    setError('')
    setGuardando(false)
    setTabModal('datos')
    setEstados([])
    setModalAbierto(true)
  }

  const abrirEditar = (c: Compromiso) => {
    setEditando(c)
    setForm({
      codigo_tipo_compromiso: c.codigo_tipo_compromiso,
      asunto: c.asunto,
      descripcion: c.descripcion || '',
      prioridad: c.prioridad,
      codigo_estado_compromiso: c.codigo_estado_compromiso,
      fecha_esperada: c.fecha_esperada ? c.fecha_esperada.substring(0, 10) : '',
      id_conversacion: c.id_conversacion ?? '',
      comentarios: c.comentarios || '',
      esfuerzo_horas: c.esfuerzo_horas ?? '',
      costo_compromiso: c.costo_compromiso ?? '',
      codigo_usuario_destinatario: c.codigo_usuario_destinatario || '',
      codigo_area_asignada: c.codigo_area_asignada || '',
      codigo_usuario_asignado: c.codigo_usuario_asignado || '',
    })
    setFormAdjunto(
      c.adjunto
        ? { nombre: c.adjunto.nombre, url: c.adjunto.url, tipo_mime: c.adjunto.tipo_mime, tamano: c.adjunto.tamano }
        : { ...adjuntoInicial }
    )
    setError('')
    setGuardando(false)
    setTabModal('datos')
    setModalAbierto(true)
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    setError('')
    if (!form.asunto.trim()) {
      setError('El asunto es obligatorio')
      return
    }
    if (!form.codigo_tipo_compromiso) {
      setError('El tipo de compromiso es obligatorio')
      return
    }
    if (!form.codigo_estado_compromiso) {
      setError('El estado es obligatorio')
      return
    }

    setGuardando(true)
    try {
      const adjunto = formAdjunto.url.trim()
        ? {
            nombre: formAdjunto.nombre.trim() || 'Sin nombre',
            url: formAdjunto.url.trim(),
            tipo_mime: formAdjunto.tipo_mime || 'application/pdf',
            tamano: Number(formAdjunto.tamano) || 0,
          }
        : undefined

      const datos: Partial<Compromiso> = {
        codigo_tipo_compromiso: form.codigo_tipo_compromiso,
        asunto: form.asunto.trim(),
        descripcion: form.descripcion.trim() || undefined,
        prioridad: form.prioridad,
        codigo_estado_compromiso: form.codigo_estado_compromiso,
        fecha_esperada: form.fecha_esperada || undefined,
        id_conversacion: form.id_conversacion ? Number(form.id_conversacion) : undefined,
        comentarios: form.comentarios.trim() || undefined,
        esfuerzo_horas: form.esfuerzo_horas !== '' ? Number(form.esfuerzo_horas) : undefined,
        costo_compromiso: form.costo_compromiso !== '' ? Number(form.costo_compromiso) : undefined,
        codigo_usuario_destinatario: form.codigo_usuario_destinatario || undefined,
        codigo_area_asignada: form.codigo_area_asignada || undefined,
        codigo_usuario_asignado: form.codigo_usuario_asignado || undefined,
        adjunto,
      }

      if (editando) {
        await compromisosApi.actualizarCompromiso(editando.id_compromiso, datos)
      } else {
        await compromisosApi.crearCompromiso(datos)
      }
      setModalAbierto(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const ejecutarEliminar = async () => {
    if (confirmarEliminar === null) return
    setEliminando(true)
    try {
      await compromisosApi.eliminarCompromiso(confirmarEliminar)
      setConfirmarEliminar(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
      setConfirmarEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  // ── Tabs del modal ────────────────────────────────────────────────────────
  const tabs: { key: typeof tabModal; label: string }[] = [
    { key: 'datos', label: 'Datos' },
    { key: 'asignacion', label: 'Asignación' },
    { key: 'adjunto', label: 'Adjunto' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">Compromisos</h2>
          <p className="text-sm text-texto-muted mt-1">Gestión de compromisos y tareas</p>
        </div>
        <Boton variante="primario" onClick={abrirNuevo}>
          <Plus size={16} />
          Nuevo compromiso
        </Boton>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Buscar por asunto o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <select
          className={selectClass + ' max-w-[200px]'}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.codigo_tipo_compromiso} value={t.codigo_tipo_compromiso}>
              {t.nombre}
            </option>
          ))}
        </select>
        <select
          className={selectClass + ' max-w-[160px]'}
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value)}
        >
          <option value="">Todas las prioridades</option>
          {PRIORIDADES.map((p) => (
            <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
          ))}
        </select>
        <Boton
          variante="contorno"
          tamano="sm"
          onClick={() => exportarExcel(compromisosFiltrados as Record<string, unknown>[], [
            { titulo: 'ID', campo: 'id_compromiso' },
            { titulo: 'Asunto', campo: 'asunto' },
            { titulo: 'Tipo', campo: 'codigo_tipo_compromiso', formato: (v) => nombreTipo(v as string) },
            { titulo: 'Prioridad', campo: 'prioridad', formato: (v) => {
              const p = PRIORIDADES.find((p) => p.valor === v)
              return p?.etiqueta || (v as string)
            }},
            { titulo: 'Destinatario', campo: 'codigo_usuario_destinatario', formato: (v) => nombreUsuario(v as string) },
            { titulo: 'Área', campo: 'codigo_area_asignada', formato: (v) => nombreArea(v as string) },
            { titulo: 'Asignado', campo: 'codigo_usuario_asignado', formato: (v) => nombreUsuario(v as string) },
            { titulo: 'Estado', campo: 'codigo_estado_compromiso' },
            { titulo: 'Fecha Esperada', campo: 'fecha_esperada', formato: (v) => v ? new Date(v as string).toLocaleDateString('es-CL') : '' },
            { titulo: 'Fecha Creación', campo: 'fecha_creacion', formato: (v) => v ? new Date(v as string).toLocaleString('es-CL') : '' },
          ], `compromisos_${grupoActivo || 'todos'}`)}
          disabled={compromisosFiltrados.length === 0}
        >
          <Download size={15} />
          Excel
        </Boton>
      </div>

      {errorCarga && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-error">{errorCarga}</p>
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
          ))}
        </div>
      ) : (
        <Tabla>
          <TablaCabecera>
            <tr>
              <TablaTh>ID</TablaTh>
              <TablaTh>Asunto</TablaTh>
              <TablaTh>Tipo</TablaTh>
              <TablaTh>Prioridad</TablaTh>
              <TablaTh>Asignado</TablaTh>
              <TablaTh>Estado</TablaTh>
              <TablaTh>Fecha Esperada</TablaTh>
              <TablaTh className="text-right">Acciones</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {compromisosFiltrados.length === 0 ? (
              <TablaFila>
                <TablaTd className="text-center text-texto-muted py-8" colSpan={8 as never}>
                  No se encontraron compromisos
                </TablaTd>
              </TablaFila>
            ) : (
              compromisosFiltrados.map((c) => (
                <TablaFila key={c.id_compromiso}>
                  <TablaTd className="text-texto-muted text-xs">{c.id_compromiso}</TablaTd>
                  <TablaTd>
                    <span className="font-medium">{c.asunto}</span>
                  </TablaTd>
                  <TablaTd className="text-texto-muted">{nombreTipo(c.codigo_tipo_compromiso)}</TablaTd>
                  <TablaTd>
                    <Insignia variante={PRIORIDAD_VARIANTE[c.prioridad] || 'neutro'}>
                      {PRIORIDADES.find((p) => p.valor === c.prioridad)?.etiqueta || c.prioridad}
                    </Insignia>
                  </TablaTd>
                  <TablaTd className="text-texto-muted">
                    {nombreUsuario(c.codigo_usuario_asignado) || <span className="text-texto-light">--</span>}
                  </TablaTd>
                  <TablaTd className="text-texto-muted">{c.codigo_estado_compromiso}</TablaTd>
                  <TablaTd className="text-texto-muted">
                    {c.fecha_esperada ? new Date(c.fecha_esperada).toLocaleDateString('es-CL') : <span className="text-texto-light">--</span>}
                  </TablaTd>
                  <TablaTd className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => abrirEditar(c)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmarEliminar(c.id_compromiso)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))
            )}
          </TablaCuerpo>
        </Tabla>
      )}

      {/* Modal crear/editar */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={editando ? 'Editar compromiso' : 'Nuevo compromiso'}
        className="max-w-2xl"
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-borde">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTabModal(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabModal === t.key
                  ? 'border-primario text-primario'
                  : 'border-transparent text-texto-muted hover:text-texto'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Tab Datos */}
        {tabModal === 'datos' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Tipo de compromiso *</label>
              <select
                className={selectClass}
                value={form.codigo_tipo_compromiso}
                onChange={(e) => setForm({ ...form, codigo_tipo_compromiso: e.target.value, codigo_estado_compromiso: '' })}
              >
                <option value="">Seleccionar tipo...</option>
                {tipos.filter((t) => t.activo).map((t) => (
                  <option key={t.codigo_tipo_compromiso} value={t.codigo_tipo_compromiso}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-texto mb-1">Asunto *</label>
              <Input
                value={form.asunto}
                onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                placeholder="Asunto del compromiso"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-texto mb-1">Descripción</label>
              <textarea
                className={selectClass + ' min-h-[80px] resize-y'}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripción detallada..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Prioridad *</label>
                <select
                  className={selectClass}
                  value={form.prioridad}
                  onChange={(e) => setForm({ ...form, prioridad: e.target.value as typeof form.prioridad })}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Estado *</label>
                <select
                  className={selectClass}
                  value={form.codigo_estado_compromiso}
                  onChange={(e) => setForm({ ...form, codigo_estado_compromiso: e.target.value })}
                  disabled={!form.codigo_tipo_compromiso}
                >
                  <option value="">Seleccionar estado...</option>
                  {estados.filter((e) => e.activo).map((e) => (
                    <option key={e.codigo_estado_compromiso} value={e.codigo_estado_compromiso}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Fecha esperada</label>
                <input
                  type="date"
                  className={selectClass}
                  value={form.fecha_esperada}
                  onChange={(e) => setForm({ ...form, fecha_esperada: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Conversación</label>
                <select
                  className={selectClass}
                  value={form.id_conversacion}
                  onChange={(e) => setForm({ ...form, id_conversacion: e.target.value })}
                >
                  <option value="">Sin conversación</option>
                  {conversaciones.map((cnv) => (
                    <option key={cnv.id_conversacion} value={cnv.id_conversacion}>
                      ({cnv.id_conversacion}) {cnv.asunto}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-texto mb-1">Comentarios</label>
              <textarea
                className={selectClass + ' min-h-[60px] resize-y'}
                value={form.comentarios}
                onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
                placeholder="Comentarios adicionales..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Esfuerzo (horas)</label>
                <input
                  type="number"
                  className={selectClass}
                  value={form.esfuerzo_horas}
                  onChange={(e) => setForm({ ...form, esfuerzo_horas: e.target.value })}
                  min={0}
                  step={0.5}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Costo</label>
                <input
                  type="number"
                  className={selectClass}
                  value={form.costo_compromiso}
                  onChange={(e) => setForm({ ...form, costo_compromiso: e.target.value })}
                  min={0}
                  step={1}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Asignación */}
        {tabModal === 'asignacion' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Destinatario</label>
              <select
                className={selectClass}
                value={form.codigo_usuario_destinatario}
                onChange={(e) => setForm({ ...form, codigo_usuario_destinatario: e.target.value })}
              >
                <option value="">Sin destinatario</option>
                {usuarios.filter((u) => u.activo).map((u) => (
                  <option key={u.codigo_usuario} value={u.codigo_usuario}>
                    {u.nombre} ({u.codigo_usuario})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-texto mb-1">Área asignada</label>
              <select
                className={selectClass}
                value={form.codigo_area_asignada}
                onChange={(e) => setForm({ ...form, codigo_area_asignada: e.target.value })}
              >
                <option value="">Sin área</option>
                {areas.filter((a) => a.activo).map((a) => (
                  <option key={a.codigo_area} value={a.codigo_area}>
                    {'  '.repeat(a.nivel || 0)}{a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-texto mb-1">Usuario asignado</label>
              <select
                className={selectClass}
                value={form.codigo_usuario_asignado}
                onChange={(e) => setForm({ ...form, codigo_usuario_asignado: e.target.value })}
              >
                <option value="">Sin asignar</option>
                {usuarios.filter((u) => u.activo).map((u) => (
                  <option key={u.codigo_usuario} value={u.codigo_usuario}>
                    {u.nombre} ({u.codigo_usuario})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab Adjunto */}
        {tabModal === 'adjunto' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-texto-muted">
              Adjunte un enlace de Google Drive u otra URL al compromiso.
            </p>

            <div>
              <label className="block text-sm font-medium text-texto mb-1">Nombre del archivo</label>
              <Input
                value={formAdjunto.nombre}
                onChange={(e) => setFormAdjunto({ ...formAdjunto, nombre: e.target.value })}
                placeholder="Ej: Informe final.pdf"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-texto mb-1">URL (Google Drive)</label>
              <Input
                value={formAdjunto.url}
                onChange={(e) => setFormAdjunto({ ...formAdjunto, url: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tipo de archivo</label>
                <select
                  className={selectClass}
                  value={formAdjunto.tipo_mime}
                  onChange={(e) => setFormAdjunto({ ...formAdjunto, tipo_mime: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS_MIME.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tamaño (bytes)</label>
                <input
                  type="number"
                  className={selectClass}
                  value={formAdjunto.tamano}
                  onChange={(e) => setFormAdjunto({ ...formAdjunto, tamano: e.target.value })}
                  min={0}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Botones del modal */}
        <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-borde">
          <Boton variante="contorno" onClick={() => setModalAbierto(false)} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} cargando={guardando}>
            {editando ? 'Guardar cambios' : 'Crear compromiso'}
          </Boton>
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <ModalConfirmar
        abierto={confirmarEliminar !== null}
        alCerrar={() => setConfirmarEliminar(null)}
        alConfirmar={ejecutarEliminar}
        titulo="Eliminar compromiso"
        mensaje={`¿Está seguro de que desea eliminar el compromiso #${confirmarEliminar}? Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={eliminando}
      />
    </div>
  )
}
