'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search, ExternalLink } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { documentosApi } from '@/lib/api'
import type { Documento } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'

export default function PaginaDocumentos() {
  const { grupoActivo } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // ── Modal CRUD ────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Documento | null>(null)
  const [form, setForm] = useState({
    nombre_documento: '',
    ubicacion_documento: '',
    resumen_documento: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Modal Confirmar ───────────────────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<Documento | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setDocumentos(await documentosApi.listar())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre_documento: '', ubicacion_documento: '', resumen_documento: '' })
    setError('')
    setModal(true)
  }

  const abrirEditar = (d: Documento) => {
    setEditando(d)
    setForm({
      nombre_documento: d.nombre_documento,
      ubicacion_documento: d.ubicacion_documento || '',
      resumen_documento: d.resumen_documento || '',
    })
    setError('')
    setModal(true)
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
        })
      } else {
        await documentosApi.crear({
          nombre_documento: form.nombre_documento,
          codigo_grupo: grupoActivo,
          ubicacion_documento: form.ubicacion_documento || undefined,
          resumen_documento: form.resumen_documento || undefined,
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
        <p className="text-sm text-texto-muted mt-1">Gestión de documentos del grupo</p>
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
                  { titulo: 'Ubicación', campo: 'ubicacion_documento' },
                  { titulo: 'Resumen', campo: 'resumen_documento' },
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
            <TablaTh>Resumen</TablaTh>
            <TablaTh>Estado</TablaTh>
            <TablaTh className="text-right">Acciones</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>
                Cargando...
              </TablaTd>
            </TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={6 as never}>
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
                <TablaTd className="font-medium">{d.nombre_documento}</TablaTd>
                <TablaTd className="text-sm text-texto-muted max-w-[200px] truncate">
                  {d.ubicacion_documento ? (
                    <a
                      href={d.ubicacion_documento.startsWith('http') ? d.ubicacion_documento : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primario hover:underline"
                      title={d.ubicacion_documento}
                    >
                      <ExternalLink size={12} />
                      {d.ubicacion_documento.length > 40
                        ? d.ubicacion_documento.slice(0, 40) + '...'
                        : d.ubicacion_documento}
                    </a>
                  ) : (
                    '—'
                  )}
                </TablaTd>
                <TablaTd className="text-texto-muted text-sm max-w-[250px] truncate">
                  {d.resumen_documento || '—'}
                </TablaTd>
                <TablaTd>
                  <Insignia variante={d.activo ? 'exito' : 'error'}>
                    {d.activo ? 'Activo' : 'Inactivo'}
                  </Insignia>
                </TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => abrirEditar(d)}
                      className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
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
        titulo={editando ? `Editar documento: ${editando.nombre_documento}` : 'Nuevo documento'}
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Nombre del documento *"
            value={form.nombre_documento}
            onChange={(e) => setForm({ ...form, nombre_documento: e.target.value })}
            placeholder="Nombre del documento"
          />
          <Input
            etiqueta="Ubicación (URL o ruta)"
            value={form.ubicacion_documento}
            onChange={(e) => setForm({ ...form, ubicacion_documento: e.target.value })}
            placeholder="https://ejemplo.com/documento.pdf"
          />
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Resumen</label>
            <textarea
              className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[80px]"
              value={form.resumen_documento}
              onChange={(e) => setForm({ ...form, resumen_documento: e.target.value })}
              placeholder="Breve descripción del contenido del documento"
              maxLength={2000}
            />
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
      </Modal>

      {/* Modal Confirmar */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo="Desactivar documento"
        mensaje={
          confirmacion
            ? `¿Estás seguro de desactivar el documento "${confirmacion.nombre_documento}"?`
            : ''
        }
        textoConfirmar="Desactivar"
        cargando={eliminando}
      />
    </div>
  )
}
