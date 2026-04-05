'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { tiposDocumentoPersonaApi } from '@/lib/api'
import type { TipoDocumentoPersona } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'

export default function PaginaTiposDocumentoPersona() {
  const { grupoActivo } = useAuth()

  const [tipos, setTipos] = useState<TipoDocumentoPersona[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<TipoDocumentoPersona | null>(null)
  const [form, setForm] = useState({ codigo_tipo_doc: '', nombre: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [confirmacion, setConfirmacion] = useState<TipoDocumentoPersona | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setTipos(await tiposDocumentoPersonaApi.listar())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ codigo_tipo_doc: '', nombre: '', descripcion: '' })
    setError('')
    setModal(true)
  }

  const abrirEditar = (t: TipoDocumentoPersona) => {
    setEditando(t)
    setForm({
      codigo_tipo_doc: t.codigo_tipo_doc,
      nombre: t.nombre,
      descripcion: t.descripcion || '',
    })
    setError('')
    setModal(true)
  }

  const guardar = async () => {
    if (!form.codigo_tipo_doc.trim() || !form.nombre.trim()) {
      setError('Código y nombre son obligatorios')
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await tiposDocumentoPersonaApi.actualizar(editando.codigo_tipo_doc, {
          nombre: form.nombre,
          descripcion: form.descripcion || undefined,
        })
      } else {
        await tiposDocumentoPersonaApi.crear({
          codigo_tipo_doc: form.codigo_tipo_doc.toUpperCase(),
          codigo_grupo: grupoActivo,
          nombre: form.nombre,
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
      await tiposDocumentoPersonaApi.desactivar(confirmacion.codigo_tipo_doc)
      setConfirmacion(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al desactivar')
      setConfirmacion(null)
    } finally {
      setEliminando(false)
    }
  }

  const filtrados = tipos
    .filter(
      (t) =>
        t.codigo_tipo_doc.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.nombre.toLowerCase().includes(busqueda.toLowerCase())
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Tipos de Documento de Persona</h2>
        <p className="text-sm text-texto-muted mt-1">Tipos de documento de identificación</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Buscar por código o nombre..."
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
                  { titulo: 'Código', campo: 'codigo_tipo_doc' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Descripción', campo: 'descripcion' },
                  { titulo: 'Estado', campo: 'activo', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
                ],
                'tipos-documento-persona'
              )
            }
            disabled={filtrados.length === 0}
          >
            <Download size={15} />
            Excel
          </Boton>
          <Boton variante="primario" onClick={abrirNuevo}>
            <Plus size={16} />
            Nuevo tipo
          </Boton>
        </div>
      </div>

      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>Código</TablaTh>
            <TablaTh>Nombre</TablaTh>
            <TablaTh>Descripción</TablaTh>
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
                No se encontraron tipos de documento
              </TablaTd>
            </TablaFila>
          ) : (
            filtrados.map((t) => (
              <TablaFila key={t.codigo_tipo_doc}>
                <TablaTd>
                  <code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{t.codigo_tipo_doc}</code>
                </TablaTd>
                <TablaTd className="font-medium">{t.nombre}</TablaTd>
                <TablaTd className="text-texto-muted text-sm max-w-[300px] truncate">
                  {t.descripcion || '—'}
                </TablaTd>
                <TablaTd>
                  <Insignia variante={t.activo ? 'exito' : 'error'}>
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </Insignia>
                </TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => abrirEditar(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setConfirmacion(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Desactivar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </TablaTd>
              </TablaFila>
            ))
          )}
        </TablaCuerpo>
      </Tabla>

      <Modal abierto={modal} alCerrar={() => setModal(false)} titulo={editando ? `Editar tipo: ${editando.nombre}` : 'Nuevo tipo de documento'}>
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Código *"
            value={form.codigo_tipo_doc}
            onChange={(e) => setForm({ ...form, codigo_tipo_doc: e.target.value.toUpperCase() })}
            placeholder="Ej: RUT, PASAPORTE"
            disabled={!!editando}
          />
          <Input
            etiqueta="Nombre *"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre del tipo de documento"
          />
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Descripción</label>
            <textarea
              className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto placeholder:text-texto-muted focus:border-primario focus:ring-1 focus:ring-primario outline-none resize-y min-h-[60px]"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción opcional"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModal(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>
              {editando ? 'Guardar' : 'Crear'}
            </Boton>
          </div>
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo="Desactivar tipo de documento"
        mensaje={confirmacion ? `¿Desactivar "${confirmacion.nombre}"?` : ''}
        textoConfirmar="Desactivar"
        cargando={eliminando}
      />
    </div>
  )
}
