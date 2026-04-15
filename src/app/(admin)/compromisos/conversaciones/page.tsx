'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search, UserPlus, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { compromisosApi, compromisosDatosBasicosApi, usuariosApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { exportarExcel } from '@/lib/exportar-excel'
import type {
  Conversacion,
  TipoConversacion,
  EstadoConversacion,
  ParticipanteConversacion,
  Usuario,
} from '@/lib/tipos'

const selectClass =
  'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

const formInicial = {
  codigo_tipo_conversacion: '',
  fecha_conversacion: new Date().toISOString().slice(0, 10),
  asunto: '',
  codigo_usuario_responsable: '',
  codigo_estado_conversacion: '',
  comentarios: '',
  esfuerzo_horas: '',
  costo_conversacion: '',
  // persona
  nombre_persona: '',
  tipo_id_persona: '',
  id_persona: '',
  verificador_persona: '',
  telefono_persona: '',
  correo_persona: '',
  direccion_persona: '',
  forma_alternativa_contacto: '',
  tipo_representacion: '',
}

const adjuntoInicial = { nombre: '', url: '', tipo_mime: '', tamano: 0 }

export default function PaginaConversaciones() {
  const { usuario: usuarioActual } = useAuth()
  const grupoActivo = usuarioActual?.grupo_activo ?? ''

  // ── Estado principal ─────────────────────────────────────────────────────────
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Conversacion | null>(null)
  const [tabModal, setTabModal] = useState<'datos' | 'persona' | 'adjunto' | 'participantes'>('datos')
  const [form, setForm] = useState({ ...formInicial })
  const [formAdjunto, setFormAdjunto] = useState({ ...adjuntoInicial })
  const [participantes, setParticipantes] = useState<ParticipanteConversacion[]>([])
  const [nuevoParticipante, setNuevoParticipante] = useState({ nombre_persona: '', tipo_id_persona: '', id_persona: '' })

  // ── Catálogos ────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoConversacion[]>([])
  const [estados, setEstados] = useState<EstadoConversacion[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmarEliminar, setConfirmarEliminar] = useState<number | null>(null)

  // ── Carga de datos ───────────────────────────────────────────────────────────

  const cargarConversaciones = useCallback(async () => {
    try {
      setCargando(true)
      const data = await compromisosApi.listarConversaciones()
      setConversaciones(data)
    } catch (e: unknown) {
      console.error('Error al cargar conversaciones', e)
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarCatalogos = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([
        compromisosDatosBasicosApi.listarTiposCnv(),
        usuariosApi.listar(),
      ])
      setTipos(t)
      setUsuarios(u)
    } catch (e: unknown) {
      console.error('Error al cargar catálogos', e)
    }
  }, [])

  const cargarEstados = useCallback(async (tipo: string) => {
    if (!tipo) {
      setEstados([])
      return
    }
    try {
      const data = await compromisosDatosBasicosApi.listarEstadosCnv(tipo)
      setEstados(data.filter((e) => e.activo))
    } catch (e: unknown) {
      console.error('Error al cargar estados', e)
      setEstados([])
    }
  }, [])

  const cargarParticipantes = useCallback(async (idConv: number) => {
    try {
      const data = await compromisosApi.listarParticipantes(idConv)
      setParticipantes(data)
    } catch (e: unknown) {
      console.error('Error al cargar participantes', e)
      setParticipantes([])
    }
  }, [])

  useEffect(() => {
    cargarConversaciones()
    cargarCatalogos()
  }, [cargarConversaciones, cargarCatalogos])

  // Cuando cambia el tipo en el formulario, cargar estados
  useEffect(() => {
    if (form.codigo_tipo_conversacion) {
      cargarEstados(form.codigo_tipo_conversacion)
    } else {
      setEstados([])
    }
  }, [form.codigo_tipo_conversacion, cargarEstados])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const nombreTipo = (codigo: string) => tipos.find((t) => t.codigo_tipo_conversacion === codigo)?.nombre ?? codigo
  const nombreUsuario = (codigo: string) => usuarios.find((u) => u.codigo_usuario === codigo)?.nombre ?? codigo

  // ── Abrir modal ──────────────────────────────────────────────────────────────

  const abrirCrear = () => {
    setEditando(null)
    setForm({ ...formInicial })
    setFormAdjunto({ ...adjuntoInicial })
    setParticipantes([])
    setNuevoParticipante({ nombre_persona: '', tipo_id_persona: '', id_persona: '' })
    setTabModal('datos')
    setError('')
    setModalAbierto(true)
  }

  const abrirEditar = async (conv: Conversacion) => {
    setEditando(conv)
    setForm({
      codigo_tipo_conversacion: conv.codigo_tipo_conversacion,
      fecha_conversacion: conv.fecha_conversacion?.slice(0, 10) ?? '',
      asunto: conv.asunto,
      codigo_usuario_responsable: conv.codigo_usuario_responsable,
      codigo_estado_conversacion: conv.codigo_estado_conversacion,
      comentarios: conv.comentarios ?? '',
      esfuerzo_horas: conv.esfuerzo_horas != null ? String(conv.esfuerzo_horas) : '',
      costo_conversacion: conv.costo_conversacion != null ? String(conv.costo_conversacion) : '',
      nombre_persona: conv.nombre_persona ?? '',
      tipo_id_persona: conv.tipo_id_persona ?? '',
      id_persona: conv.id_persona ?? '',
      verificador_persona: conv.verificador_persona ?? '',
      telefono_persona: conv.telefono_persona != null ? String(conv.telefono_persona) : '',
      correo_persona: conv.correo_persona ?? '',
      direccion_persona: conv.direccion_persona ?? '',
      forma_alternativa_contacto: conv.forma_alternativa_contacto ?? '',
      tipo_representacion: conv.tipo_representacion ?? '',
    })
    setFormAdjunto(
      conv.adjunto
        ? { nombre: conv.adjunto.nombre, url: conv.adjunto.url, tipo_mime: conv.adjunto.tipo_mime, tamano: conv.adjunto.tamano }
        : { ...adjuntoInicial }
    )
    setTabModal('datos')
    setError('')
    setModalAbierto(true)

    // Cargar participantes
    await cargarParticipantes(conv.id_conversacion)
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────

  const guardar = async (cerrar: boolean) => {
    if (!form.asunto.trim()) {
      setError('El asunto es obligatorio')
      return
    }
    if (!form.codigo_tipo_conversacion) {
      setError('Seleccione un tipo de conversación')
      return
    }
    if (!form.nombre_persona.trim()) {
      setError('El nombre de la persona es obligatorio')
      return
    }
    if (!form.codigo_usuario_responsable) {
      setError('Seleccione un responsable')
      return
    }
    if (!form.codigo_estado_conversacion) {
      setError('Seleccione un estado')
      return
    }

    setGuardando(true)
    setError('')

    try {
      const adjunto = formAdjunto.url.trim()
        ? { nombre: formAdjunto.nombre, url: formAdjunto.url, tipo_mime: formAdjunto.tipo_mime, tamano: formAdjunto.tamano }
        : undefined

      const datos: Partial<Conversacion> = {
        codigo_tipo_conversacion: form.codigo_tipo_conversacion,
        fecha_conversacion: form.fecha_conversacion,
        asunto: form.asunto.trim(),
        codigo_usuario_responsable: form.codigo_usuario_responsable,
        codigo_estado_conversacion: form.codigo_estado_conversacion,
        comentarios: form.comentarios.trim() || undefined,
        esfuerzo_horas: form.esfuerzo_horas ? Number(form.esfuerzo_horas) : undefined,
        costo_conversacion: form.costo_conversacion ? Number(form.costo_conversacion) : undefined,
        nombre_persona: form.nombre_persona.trim(),
        tipo_id_persona: form.tipo_id_persona.trim() || undefined,
        id_persona: form.id_persona.trim() || undefined,
        verificador_persona: form.verificador_persona.trim() || undefined,
        telefono_persona: form.telefono_persona ? Number(form.telefono_persona) : undefined,
        correo_persona: form.correo_persona.trim() || undefined,
        direccion_persona: form.direccion_persona.trim() || undefined,
        forma_alternativa_contacto: form.forma_alternativa_contacto.trim() || undefined,
        tipo_representacion: form.tipo_representacion.trim() || undefined,
        adjunto,
      }

      if (editando) {
        await compromisosApi.actualizarConversacion(editando.id_conversacion, datos)
      } else {
        const nuevo = await compromisosApi.crearConversacion(datos)
        if (!cerrar && nuevo) {
          setEditando(nuevo)
          await cargarParticipantes(nuevo.id_conversacion)
        }
      }

      if (cerrar) {
        setModalAbierto(false)
      }
      await cargarConversaciones()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────────

  const eliminar = async () => {
    if (confirmarEliminar == null) return
    try {
      await compromisosApi.eliminarConversacion(confirmarEliminar)
      setConfirmarEliminar(null)
      await cargarConversaciones()
    } catch (e: unknown) {
      console.error('Error al eliminar', e)
    }
  }

  // ── Participantes ────────────────────────────────────────────────────────────

  const agregarParticipante = async () => {
    if (!editando) return
    if (!nuevoParticipante.nombre_persona.trim()) return
    try {
      await compromisosApi.agregarParticipante(editando.id_conversacion, {
        nombre_persona: nuevoParticipante.nombre_persona.trim(),
        tipo_id_persona: nuevoParticipante.tipo_id_persona.trim() || undefined,
        id_persona: nuevoParticipante.id_persona.trim() || undefined,
      })
      setNuevoParticipante({ nombre_persona: '', tipo_id_persona: '', id_persona: '' })
      await cargarParticipantes(editando.id_conversacion)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al agregar participante')
    }
  }

  const eliminarParticipante = async (idPart: number) => {
    if (!editando) return
    try {
      await compromisosApi.eliminarParticipante(editando.id_conversacion, idPart)
      await cargarParticipantes(editando.id_conversacion)
    } catch (e: unknown) {
      console.error('Error al eliminar participante', e)
    }
  }

  // ── Exportar Excel ───────────────────────────────────────────────────────────

  const handleExportar = () => {
    exportarExcel(
      conversacionesFiltradas as unknown as Record<string, unknown>[],
      [
        { titulo: 'ID', campo: 'id_conversacion' },
        { titulo: 'Fecha', campo: 'fecha_conversacion', formato: (v) => (v ? String(v).slice(0, 10) : '') },
        { titulo: 'Tipo', campo: 'codigo_tipo_conversacion', formato: (v) => nombreTipo(String(v)) },
        { titulo: 'Persona', campo: 'nombre_persona' },
        { titulo: 'Asunto', campo: 'asunto' },
        { titulo: 'Responsable', campo: 'codigo_usuario_responsable', formato: (v) => nombreUsuario(String(v)) },
        { titulo: 'Estado', campo: 'codigo_estado_conversacion' },
      ],
      'conversaciones'
    )
  }

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  const conversacionesFiltradas = conversaciones.filter((c) => {
    const matchBusqueda =
      !busqueda ||
      c.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.nombre_persona && c.nombre_persona.toLowerCase().includes(busqueda.toLowerCase()))
    const matchTipo = !filtroTipo || c.codigo_tipo_conversacion === filtroTipo
    return matchBusqueda && matchTipo
  })

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!grupoActivo) return null

  return (
    <div className="space-y-6">
      {/* Título y acciones */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-texto">Conversaciones</h1>
        <Boton onClick={abrirCrear}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Conversación
        </Boton>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-muted" />
          <Input
            className="pl-9"
            placeholder="Buscar por asunto o persona..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select
          className={selectClass + ' max-w-[220px]'}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.codigo_tipo_conversacion} value={t.codigo_tipo_conversacion}>
              {t.nombre}
            </option>
          ))}
        </select>
        <Boton variante="contorno" tamano="sm" onClick={handleExportar}>
          <Download className="mr-2 h-4 w-4" />
          Excel
        </Boton>
      </div>

      {/* Tabla */}
      {cargando ? (
        <p className="text-texto-muted">Cargando...</p>
      ) : conversacionesFiltradas.length === 0 ? (
        <p className="text-texto-muted">No se encontraron conversaciones.</p>
      ) : (
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              <TablaTh>ID</TablaTh>
              <TablaTh>Fecha</TablaTh>
              <TablaTh>Tipo</TablaTh>
              <TablaTh>Persona</TablaTh>
              <TablaTh>Asunto</TablaTh>
              <TablaTh>Responsable</TablaTh>
              <TablaTh>Estado</TablaTh>
              <TablaTh className="text-right">Acciones</TablaTh>
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {conversacionesFiltradas.map((c) => (
              <TablaFila key={c.id_conversacion}>
                <TablaTd>{c.id_conversacion}</TablaTd>
                <TablaTd>{c.fecha_conversacion?.slice(0, 10)}</TablaTd>
                <TablaTd>
                  <Insignia variante="primario">{nombreTipo(c.codigo_tipo_conversacion)}</Insignia>
                </TablaTd>
                <TablaTd>{c.nombre_persona}</TablaTd>
                <TablaTd className="max-w-[250px] truncate">{c.asunto}</TablaTd>
                <TablaTd>{nombreUsuario(c.codigo_usuario_responsable)}</TablaTd>
                <TablaTd>
                  <Insignia>{c.codigo_estado_conversacion}</Insignia>
                </TablaTd>
                <TablaTd className="text-right">
                  <div className="flex justify-end gap-1">
                    <Boton variante="fantasma" tamano="sm" onClick={() => abrirEditar(c)}>
                      <Pencil className="h-4 w-4" />
                    </Boton>
                    <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmarEliminar(c.id_conversacion)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Boton>
                  </div>
                </TablaTd>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      {/* Modal crear/editar */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={editando ? 'Editar Conversación' : 'Nueva Conversación'}
        className="w-[min(95vw,56rem)] max-w-none"
      >
        {/* Tabs */}
        <div className="flex gap-2 border-b border-borde mb-4">
          {(['datos', 'persona', 'adjunto', 'participantes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTabModal(t)}
              className={`px-3 py-2 text-sm ${
                tabModal === t
                  ? 'border-b-2 border-primario text-primario font-semibold'
                  : 'text-texto-muted hover:text-texto'
              }`}
            >
              {t === 'datos' ? 'Datos' : t === 'persona' ? 'Persona' : t === 'adjunto' ? 'Adjunto' : 'Participantes'}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {/* Tab Datos */}
        {tabModal === 'datos' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tipo de conversación *</label>
                <select
                  className={selectClass}
                  value={form.codigo_tipo_conversacion}
                  onChange={(e) =>
                    setForm({ ...form, codigo_tipo_conversacion: e.target.value, codigo_estado_conversacion: '' })
                  }
                  disabled={guardando}
                >
                  <option value="">Seleccionar...</option>
                  {tipos.filter((t) => t.activo).map((t) => (
                    <option key={t.codigo_tipo_conversacion} value={t.codigo_tipo_conversacion}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Fecha *</label>
                <Input
                  type="date"
                  value={form.fecha_conversacion}
                  onChange={(e) => setForm({ ...form, fecha_conversacion: e.target.value })}
                  disabled={guardando}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Asunto *</label>
              <Input
                value={form.asunto}
                onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                placeholder="Asunto de la conversación"
                disabled={guardando}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Responsable *</label>
                <select
                  className={selectClass}
                  value={form.codigo_usuario_responsable}
                  onChange={(e) => setForm({ ...form, codigo_usuario_responsable: e.target.value })}
                  disabled={guardando}
                >
                  <option value="">Seleccionar...</option>
                  {usuarios.filter((u) => u.activo).map((u) => (
                    <option key={u.codigo_usuario} value={u.codigo_usuario}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Estado *</label>
                <select
                  className={selectClass}
                  value={form.codigo_estado_conversacion}
                  onChange={(e) => setForm({ ...form, codigo_estado_conversacion: e.target.value })}
                  disabled={guardando || !form.codigo_tipo_conversacion}
                >
                  <option value="">Seleccionar...</option>
                  {estados.map((e) => (
                    <option key={e.codigo_estado_conversacion} value={e.codigo_estado_conversacion}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Comentarios</label>
              <textarea
                className={selectClass + ' min-h-[80px]'}
                value={form.comentarios}
                onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
                placeholder="Comentarios adicionales"
                disabled={guardando}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Esfuerzo (horas)</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.esfuerzo_horas}
                  onChange={(e) => setForm({ ...form, esfuerzo_horas: e.target.value })}
                  placeholder="0"
                  disabled={guardando}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Costo</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costo_conversacion}
                  onChange={(e) => setForm({ ...form, costo_conversacion: e.target.value })}
                  placeholder="0"
                  disabled={guardando}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Persona */}
        {tabModal === 'persona' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Nombre de la persona *</label>
              <Input
                value={form.nombre_persona}
                onChange={(e) => setForm({ ...form, nombre_persona: e.target.value })}
                placeholder="Nombre completo"
                disabled={guardando}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tipo ID</label>
                <Input
                  value={form.tipo_id_persona}
                  onChange={(e) => setForm({ ...form, tipo_id_persona: e.target.value })}
                  placeholder="RUT, DNI, etc."
                  disabled={guardando}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">ID Persona</label>
                <Input
                  value={form.id_persona}
                  onChange={(e) => setForm({ ...form, id_persona: e.target.value })}
                  placeholder="Número de ID"
                  disabled={guardando}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Verificador</label>
                <Input
                  value={form.verificador_persona}
                  onChange={(e) => setForm({ ...form, verificador_persona: e.target.value })}
                  placeholder="Dígito verificador"
                  disabled={guardando}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Teléfono</label>
                <Input
                  type="number"
                  value={form.telefono_persona}
                  onChange={(e) => setForm({ ...form, telefono_persona: e.target.value })}
                  placeholder="Teléfono"
                  disabled={guardando}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Correo</label>
                <Input
                  type="email"
                  value={form.correo_persona}
                  onChange={(e) => setForm({ ...form, correo_persona: e.target.value })}
                  placeholder="correo@ejemplo.cl"
                  disabled={guardando}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Dirección</label>
              <Input
                value={form.direccion_persona}
                onChange={(e) => setForm({ ...form, direccion_persona: e.target.value })}
                placeholder="Dirección"
                disabled={guardando}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Forma alternativa de contacto</label>
                <Input
                  value={form.forma_alternativa_contacto}
                  onChange={(e) => setForm({ ...form, forma_alternativa_contacto: e.target.value })}
                  placeholder="WhatsApp, Telegram, etc."
                  disabled={guardando}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tipo de representación</label>
                <Input
                  value={form.tipo_representacion}
                  onChange={(e) => setForm({ ...form, tipo_representacion: e.target.value })}
                  placeholder="Personal, legal, etc."
                  disabled={guardando}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Adjunto */}
        {tabModal === 'adjunto' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Nombre del archivo</label>
              <Input
                value={formAdjunto.nombre}
                onChange={(e) => setFormAdjunto({ ...formAdjunto, nombre: e.target.value })}
                placeholder="documento.pdf"
                disabled={guardando}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">URL (Google Drive)</label>
              <Input
                value={formAdjunto.url}
                onChange={(e) => setFormAdjunto({ ...formAdjunto, url: e.target.value })}
                placeholder="https://drive.google.com/..."
                disabled={guardando}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tipo MIME</label>
                <select
                  className={selectClass}
                  value={formAdjunto.tipo_mime}
                  onChange={(e) => setFormAdjunto({ ...formAdjunto, tipo_mime: e.target.value })}
                  disabled={guardando}
                >
                  <option value="">Seleccionar...</option>
                  <option value="application/pdf">PDF</option>
                  <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word (DOCX)</option>
                  <option value="message/rfc822">Email (EML)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Tamaño (bytes)</label>
                <Input
                  type="number"
                  min="0"
                  value={formAdjunto.tamano || ''}
                  onChange={(e) => setFormAdjunto({ ...formAdjunto, tamano: Number(e.target.value) || 0 })}
                  placeholder="0"
                  disabled={guardando}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Participantes */}
        {tabModal === 'participantes' && (
          <div className="space-y-4">
            {!editando ? (
              <p className="text-texto-muted text-sm">
                Guarde la conversación primero para agregar participantes.
              </p>
            ) : (
              <>
                {/* Lista de participantes existentes */}
                {participantes.length > 0 ? (
                  <div className="border border-borde rounded-lg overflow-hidden">
                    <Tabla>
                      <TablaCabecera>
                        <TablaFila>
                          <TablaTh>Nombre</TablaTh>
                          <TablaTh>Tipo ID</TablaTh>
                          <TablaTh>ID</TablaTh>
                          <TablaTh className="text-right">Acción</TablaTh>
                        </TablaFila>
                      </TablaCabecera>
                      <TablaCuerpo>
                        {participantes.map((p) => (
                          <TablaFila key={p.id_participante}>
                            <TablaTd>{p.nombre_persona}</TablaTd>
                            <TablaTd>{p.tipo_id_persona || '-'}</TablaTd>
                            <TablaTd>{p.id_persona || '-'}</TablaTd>
                            <TablaTd className="text-right">
                              <Boton
                                variante="fantasma"
                                tamano="sm"
                                onClick={() => eliminarParticipante(p.id_participante)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Boton>
                            </TablaTd>
                          </TablaFila>
                        ))}
                      </TablaCuerpo>
                    </Tabla>
                  </div>
                ) : (
                  <p className="text-texto-muted text-sm">Sin participantes registrados.</p>
                )}

                {/* Formulario para agregar participante */}
                <div className="border border-borde rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-texto">Agregar participante</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-texto-muted mb-1">Nombre *</label>
                      <Input
                        value={nuevoParticipante.nombre_persona}
                        onChange={(e) =>
                          setNuevoParticipante({ ...nuevoParticipante, nombre_persona: e.target.value })
                        }
                        placeholder="Nombre"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-texto-muted mb-1">Tipo ID</label>
                      <Input
                        value={nuevoParticipante.tipo_id_persona}
                        onChange={(e) =>
                          setNuevoParticipante({ ...nuevoParticipante, tipo_id_persona: e.target.value })
                        }
                        placeholder="RUT, DNI..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-texto-muted mb-1">ID</label>
                      <Input
                        value={nuevoParticipante.id_persona}
                        onChange={(e) =>
                          setNuevoParticipante({ ...nuevoParticipante, id_persona: e.target.value })
                        }
                        placeholder="Número"
                      />
                    </div>
                  </div>
                  <Boton
                    tamano="sm"
                    onClick={agregarParticipante}
                    disabled={!nuevoParticipante.nombre_persona.trim()}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Agregar
                  </Boton>
                </div>
              </>
            )}
          </div>
        )}

        {/* Acciones del modal */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-borde">
          <Boton variante="contorno" onClick={() => guardar(true)} cargando={guardando}>
            Guardar y salir
          </Boton>
          <Boton variante="primario" onClick={() => guardar(false)} cargando={guardando}>
            Guardar
          </Boton>
        </div>
      </Modal>

      {/* Modal confirmar eliminación */}
      <ModalConfirmar
        abierto={confirmarEliminar !== null}
        alCerrar={() => setConfirmarEliminar(null)}
        alConfirmar={eliminar}
        titulo="Eliminar conversación"
        mensaje="¿Está seguro de eliminar esta conversación? Esta acción no se puede deshacer."
      />
    </div>
  )
}
