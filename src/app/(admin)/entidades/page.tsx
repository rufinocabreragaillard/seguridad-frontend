'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Building2, MapPin } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { entidadesApi } from '@/lib/api'
import type { Entidad, Area } from '@/lib/tipos'

export default function PaginaEntidades() {
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [entidadSeleccionada, setEntidadSeleccionada] = useState<Entidad | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoAreas, setCargandoAreas] = useState(false)

  const [modalEntidad, setModalEntidad] = useState(false)
  const [modalArea, setModalArea] = useState(false)
  const [entidadEditando, setEntidadEditando] = useState<Entidad | null>(null)
  const [formEntidad, setFormEntidad] = useState({ codigo_entidad: '', nombre: '', descripcion: '' })
  const [formArea, setFormArea] = useState({ codigo_area: '', nombre: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const e = await entidadesApi.listar()
      setEntidades(e)
      if (e.length > 0 && !entidadSeleccionada) setEntidadSeleccionada(e[0])
    } finally {
      setCargando(false)
    }
  }, [entidadSeleccionada])

  const cargarAreas = useCallback(async (codigoEntidad: string) => {
    setCargandoAreas(true)
    try {
      const a = await entidadesApi.listarAreas(codigoEntidad)
      setAreas(a)
    } finally {
      setCargandoAreas(false)
    }
  }, [])

  useEffect(() => { cargar() }, []) // eslint-disable-line

  useEffect(() => {
    if (entidadSeleccionada) cargarAreas(entidadSeleccionada.codigo_entidad)
  }, [entidadSeleccionada, cargarAreas])

  const abrirNuevaEntidad = () => {
    setEntidadEditando(null)
    setFormEntidad({ codigo_entidad: '', nombre: '', descripcion: '' })
    setError('')
    setModalEntidad(true)
  }

  const abrirEditarEntidad = (e: Entidad) => {
    setEntidadEditando(e)
    setFormEntidad({ codigo_entidad: e.codigo_entidad, nombre: e.nombre, descripcion: e.descripcion || '' })
    setError('')
    setModalEntidad(true)
  }

  const guardarEntidad = async () => {
    if (!formEntidad.codigo_entidad || !formEntidad.nombre) { setError('Código y nombre son obligatorios'); return }
    setGuardando(true)
    try {
      if (entidadEditando) {
        await entidadesApi.actualizar(entidadEditando.codigo_entidad, { nombre: formEntidad.nombre, descripcion: formEntidad.descripcion })
      } else {
        await entidadesApi.crear(formEntidad)
      }
      setModalEntidad(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  const guardarArea = async () => {
    if (!entidadSeleccionada || !formArea.codigo_area || !formArea.nombre) { setError('Código y nombre son obligatorios'); return }
    setGuardando(true)
    try {
      await entidadesApi.crearArea(entidadSeleccionada.codigo_entidad, formArea)
      setModalArea(false)
      cargarAreas(entidadSeleccionada.codigo_entidad)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">Entidades y Áreas</h2>
          <p className="text-sm text-texto-muted mt-1">Gestión de organizaciones y sus áreas</p>
        </div>
        <Boton variante="primario" onClick={abrirNuevaEntidad}><Plus size={16} />Nueva entidad</Boton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de entidades */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-texto-muted uppercase tracking-wider px-1">Entidades</h3>
          {cargando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-surface border border-borde rounded-xl animate-pulse" />
              ))}
            </div>
          ) : entidades.map((e) => (
            <button
              key={e.codigo_entidad}
              onClick={() => setEntidadSeleccionada(e)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                entidadSeleccionada?.codigo_entidad === e.codigo_entidad
                  ? 'border-primario bg-primario-muy-claro'
                  : 'border-borde bg-surface hover:bg-fondo'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                entidadSeleccionada?.codigo_entidad === e.codigo_entidad
                  ? 'bg-primario text-white'
                  : 'bg-fondo text-texto-muted'
              }`}>
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-texto truncate">{e.nombre}</p>
                <p className="text-xs text-texto-muted">{e.codigo_entidad}</p>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); abrirEditarEntidad(e) }}
                className="ml-auto p-1 rounded hover:bg-white text-texto-muted hover:text-primario transition-colors"
              >
                <Pencil size={13} />
              </button>
            </button>
          ))}
        </div>

        {/* Áreas de la entidad seleccionada */}
        <div className="lg:col-span-2">
          {entidadSeleccionada ? (
            <Tarjeta>
              <div className="px-6 py-4 border-b border-borde flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-texto">
                    Áreas de {entidadSeleccionada.nombre}
                  </h3>
                  <p className="text-xs text-texto-muted mt-0.5">
                    {areas.length} área{areas.length !== 1 ? 's' : ''} configurada{areas.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => { setFormArea({ codigo_area: '', nombre: '', descripcion: '' }); setError(''); setModalArea(true) }}
                >
                  <Plus size={14} />
                  Nueva área
                </Boton>
              </div>
              <TarjetaContenido className="p-0">
                <Tabla>
                  <TablaCabecera>
                    <tr>
                      <TablaTh>Código</TablaTh>
                      <TablaTh>Nombre</TablaTh>
                      <TablaTh>Responsable</TablaTh>
                    </tr>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {cargandoAreas ? (
                      <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={3 as never}>Cargando áreas...</TablaTd></TablaFila>
                    ) : areas.length === 0 ? (
                      <TablaFila>
                        <TablaTd className="py-8 text-center" colSpan={3 as never}>
                          <div className="flex flex-col items-center gap-2 text-texto-muted">
                            <MapPin size={24} />
                            <p className="text-sm">No hay áreas configuradas</p>
                          </div>
                        </TablaTd>
                      </TablaFila>
                    ) : areas.map((a) => (
                      <TablaFila key={a.codigo_area}>
                        <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{a.codigo_area}</code></TablaTd>
                        <TablaTd className="font-medium">{a.nombre}</TablaTd>
                        <TablaTd className="text-texto-muted text-xs">{a.usuario_responsable || '—'}</TablaTd>
                      </TablaFila>
                    ))}
                  </TablaCuerpo>
                </Tabla>
              </TarjetaContenido>
            </Tarjeta>
          ) : (
            <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
              Selecciona una entidad para ver sus áreas
            </div>
          )}
        </div>
      </div>

      {/* Modal entidad */}
      <Modal abierto={modalEntidad} alCerrar={() => setModalEntidad(false)} titulo={entidadEditando ? 'Editar entidad' : 'Nueva entidad'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formEntidad.codigo_entidad} onChange={(e) => setFormEntidad({ ...formEntidad, codigo_entidad: e.target.value.toUpperCase() })} disabled={!!entidadEditando} placeholder="MUNI" />
          <Input etiqueta="Nombre *" value={formEntidad.nombre} onChange={(e) => setFormEntidad({ ...formEntidad, nombre: e.target.value })} placeholder="Municipalidad de..." />
          <Input etiqueta="Descripción" value={formEntidad.descripcion} onChange={(e) => setFormEntidad({ ...formEntidad, descripcion: e.target.value })} />
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalEntidad(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarEntidad} cargando={guardando}>{entidadEditando ? 'Guardar' : 'Crear entidad'}</Boton>
          </div>
        </div>
      </Modal>

      {/* Modal área */}
      <Modal abierto={modalArea} alCerrar={() => setModalArea(false)} titulo="Nueva área" descripcion={`Para entidad: ${entidadSeleccionada?.nombre}`}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formArea.codigo_area} onChange={(e) => setFormArea({ ...formArea, codigo_area: e.target.value.toUpperCase() })} placeholder="ADMIN" />
          <Input etiqueta="Nombre *" value={formArea.nombre} onChange={(e) => setFormArea({ ...formArea, nombre: e.target.value })} placeholder="Administración" />
          <Input etiqueta="Descripción" value={formArea.descripcion} onChange={(e) => setFormArea({ ...formArea, descripcion: e.target.value })} />
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalArea(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarArea} cargando={guardando}>Crear área</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
