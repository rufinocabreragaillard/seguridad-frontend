'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search, CheckCircle, XCircle } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { registroLLMApi } from '@/lib/api'
import type { RegistroLLM } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

export default function PaginaRegistroLLM() {
  const [modelos, setModelos] = useState<RegistroLLM[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<RegistroLLM | null>(null)
  const [form, setForm] = useState({
    proveedor: '', nombre_tecnico: '', nombre_visible: '', descripcion: '',
    estado_valido: false,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [confirmacion, setConfirmacion] = useState<RegistroLLM | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setModelos(await registroLLMApi.listar())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ proveedor: '', nombre_tecnico: '', nombre_visible: '', descripcion: '', estado_valido: false })
    setError('')
    setModal(true)
  }

  const abrirEditar = (m: RegistroLLM) => {
    setEditando(m)
    setForm({
      proveedor: m.proveedor,
      nombre_tecnico: m.nombre_tecnico,
      nombre_visible: m.nombre_visible,
      descripcion: m.descripcion || '',
      estado_valido: m.estado_valido,
    })
    setError('')
    setModal(true)
  }

  const guardar = async () => {
    if (!form.proveedor.trim() || !form.nombre_tecnico.trim() || !form.nombre_visible.trim()) {
      setError('Proveedor, nombre técnico y nombre visible son obligatorios')
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await registroLLMApi.actualizar(editando.id_modelo, {
          proveedor: form.proveedor,
          nombre_tecnico: form.nombre_tecnico,
          nombre_visible: form.nombre_visible,
          descripcion: form.descripcion || undefined,
          estado_valido: form.estado_valido,
        })
      } else {
        await registroLLMApi.crear({
          proveedor: form.proveedor,
          nombre_tecnico: form.nombre_tecnico,
          nombre_visible: form.nombre_visible,
          descripcion: form.descripcion || undefined,
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
      await registroLLMApi.desactivar(confirmacion.id_modelo)
      setConfirmacion(null)
      cargar()
    } finally {
      setEliminando(false)
    }
  }

  const filtrados = modelos
    .filter((m) =>
      m.proveedor.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.nombre_tecnico.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.nombre_visible.toLowerCase().includes(busqueda.toLowerCase())
    )
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor) || a.nombre_visible.localeCompare(b.nombre_visible))

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Registro de Modelos LLM</h2>
        <p className="text-sm text-texto-muted mt-1">Modelos de lenguaje disponibles en el sistema</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input placeholder="Buscar por proveedor, nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Boton variante="contorno" tamano="sm" disabled={filtrados.length === 0}
            onClick={() => exportarExcel(filtrados as unknown as Record<string, unknown>[], [
              { titulo: 'ID', campo: 'id_modelo' },
              { titulo: 'Proveedor', campo: 'proveedor' },
              { titulo: 'Nombre Técnico', campo: 'nombre_tecnico' },
              { titulo: 'Nombre Visible', campo: 'nombre_visible' },
              { titulo: 'Descripción', campo: 'descripcion' },
              { titulo: 'Validado', campo: 'estado_valido', formato: (v: unknown) => (v ? 'Sí' : 'No') },
              { titulo: 'Estado', campo: 'activo', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
            ], 'registro-llm')}>
            <Download size={15} />Excel
          </Boton>
          <Boton variante="primario" onClick={abrirNuevo}><Plus size={16} />Nuevo modelo</Boton>
        </div>
      </div>

      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>Proveedor</TablaTh>
            <TablaTh>Nombre Técnico</TablaTh>
            <TablaTh>Nombre Visible</TablaTh>
            <TablaTh>Descripción</TablaTh>
            <TablaTh>Validado</TablaTh>
            <TablaTh>Estado</TablaTh>
            <TablaTh className="text-right">Acciones</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Cargando...</TablaTd></TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Sin modelos registrados</TablaTd></TablaFila>
          ) : filtrados.map((m) => (
            <TablaFila key={m.id_modelo}>
              <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{m.proveedor}</code></TablaTd>
              <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{m.nombre_tecnico}</code></TablaTd>
              <TablaTd className="font-medium">{m.nombre_visible}</TablaTd>
              <TablaTd className="text-texto-muted text-sm max-w-[200px] truncate">{m.descripcion || '—'}</TablaTd>
              <TablaTd>
                {m.estado_valido
                  ? <span className="inline-flex items-center gap-1 text-exito text-sm"><CheckCircle size={14} />Sí</span>
                  : <span className="inline-flex items-center gap-1 text-texto-muted text-sm"><XCircle size={14} />No</span>
                }
              </TablaTd>
              <TablaTd><Insignia variante={m.activo ? 'exito' : 'error'}>{m.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
              <TablaTd>
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => abrirEditar(m)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => setConfirmacion(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Desactivar"><Trash2 size={14} /></button>
                </div>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      <Modal abierto={modal} alCerrar={() => setModal(false)} titulo={editando ? `Editar: ${editando.nombre_visible}` : 'Nuevo modelo LLM'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Proveedor *" value={form.proveedor}
            onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
            placeholder="Ej: anthropic, openai, google" />
          <Input etiqueta="Nombre técnico *" value={form.nombre_tecnico}
            onChange={(e) => setForm({ ...form, nombre_tecnico: e.target.value })}
            placeholder="Ej: claude-sonnet-4-6, gpt-4o, gemini-1.5-pro" />
          <Input etiqueta="Nombre visible *" value={form.nombre_visible}
            onChange={(e) => setForm({ ...form, nombre_visible: e.target.value })}
            placeholder="Ej: Claude Sonnet 4.6" />
          <Textarea etiqueta="Descripción" value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción del modelo, capacidades, uso recomendado..." rows={3} />
          {editando && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.estado_valido}
                onChange={(e) => setForm({ ...form, estado_valido: e.target.checked })}
                className="rounded border-borde" />
              Conexión validada
            </label>
          )}
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModal(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>{editando ? 'Guardar' : 'Crear'}</Boton>
          </div>
        </div>
      </Modal>

      <ModalConfirmar abierto={!!confirmacion} alCerrar={() => setConfirmacion(null)} alConfirmar={ejecutarEliminacion}
        titulo="Desactivar modelo" mensaje={confirmacion ? `¿Desactivar "${confirmacion.nombre_visible}"?` : ''} textoConfirmar="Desactivar" cargando={eliminando} />
    </div>
  )
}
