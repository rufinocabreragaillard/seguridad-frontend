'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Layers, Users, Building2 } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { gruposApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Grupo, Entidad } from '@/lib/tipos'

export default function PaginaGrupos() {
  const { esSuperAdmin } = useAuth()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null)
  const [entidadesGrupo, setEntidadesGrupo] = useState<Entidad[]>([])
  const [usuariosGrupo, setUsuariosGrupo] = useState<{ codigo_usuario: string; usuarios?: { nombre: string; activo: boolean } }[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [tabActivo, setTabActivo] = useState<'entidades' | 'usuarios'>('entidades')

  const [modalGrupo, setModalGrupo] = useState(false)
  const [grupoEditando, setGrupoEditando] = useState<Grupo | null>(null)
  const [formGrupo, setFormGrupo] = useState({ codigo_grupo: '', nombre: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const g = await gruposApi.listar()
      setGrupos(g)
      if (g.length > 0 && !grupoSeleccionado) setGrupoSeleccionado(g[0])
    } finally {
      setCargando(false)
    }
  }, [grupoSeleccionado])

  const cargarDetalle = useCallback(async (codigoGrupo: string) => {
    setCargandoDetalle(true)
    try {
      const [ents, usrs] = await Promise.all([
        gruposApi.listarEntidades(codigoGrupo),
        gruposApi.listarUsuarios(codigoGrupo),
      ])
      setEntidadesGrupo(ents)
      setUsuariosGrupo(usrs)
    } finally {
      setCargandoDetalle(false)
    }
  }, [])

  useEffect(() => { cargar() }, []) // eslint-disable-line

  useEffect(() => {
    if (grupoSeleccionado) cargarDetalle(grupoSeleccionado.codigo_grupo)
  }, [grupoSeleccionado, cargarDetalle])

  const abrirNuevoGrupo = () => {
    setGrupoEditando(null)
    setFormGrupo({ codigo_grupo: '', nombre: '' })
    setError('')
    setModalGrupo(true)
  }

  const abrirEditarGrupo = (g: Grupo) => {
    setGrupoEditando(g)
    setFormGrupo({ codigo_grupo: g.codigo_grupo, nombre: g.nombre })
    setError('')
    setModalGrupo(true)
  }

  const guardarGrupo = async () => {
    if (!formGrupo.codigo_grupo || !formGrupo.nombre) { setError('Codigo y nombre son obligatorios'); return }
    setGuardando(true)
    try {
      if (grupoEditando) {
        await gruposApi.actualizar(grupoEditando.codigo_grupo, { nombre: formGrupo.nombre })
      } else {
        await gruposApi.crear({ codigo_grupo: formGrupo.codigo_grupo, nombre: formGrupo.nombre })
      }
      setModalGrupo(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  if (!esSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
        No tienes permisos para acceder a esta seccion.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">Grupos de Entidades</h2>
          <p className="text-sm text-texto-muted mt-1">Gestion de grupos de organizaciones</p>
        </div>
        <Boton variante="primario" onClick={abrirNuevoGrupo}><Plus size={16} />Nuevo grupo</Boton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de grupos */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-texto-muted uppercase tracking-wider px-1">Grupos</h3>
          {cargando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-surface border border-borde rounded-xl animate-pulse" />
              ))}
            </div>
          ) : grupos.map((g) => (
            <button
              key={g.codigo_grupo}
              onClick={() => setGrupoSeleccionado(g)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                grupoSeleccionado?.codigo_grupo === g.codigo_grupo
                  ? 'border-primario bg-primario-muy-claro'
                  : 'border-borde bg-surface hover:bg-fondo'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                grupoSeleccionado?.codigo_grupo === g.codigo_grupo
                  ? 'bg-primario text-white'
                  : 'bg-fondo text-texto-muted'
              }`}>
                <Layers size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-texto truncate">{g.nombre}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-texto-muted">{g.codigo_grupo}</p>
                  {g.codigo_grupo === 'ADMIN' && <Insignia variante="secundario">Sistema</Insignia>}
                </div>
              </div>
              {g.codigo_grupo !== 'ADMIN' && (
                <button
                  onClick={(ev) => { ev.stopPropagation(); abrirEditarGrupo(g) }}
                  className="ml-auto p-1 rounded hover:bg-white text-texto-muted hover:text-primario transition-colors"
                >
                  <Pencil size={13} />
                </button>
              )}
            </button>
          ))}
        </div>

        {/* Detalle del grupo seleccionado */}
        <div className="lg:col-span-2">
          {grupoSeleccionado ? (
            <Tarjeta>
              <div className="px-6 py-4 border-b border-borde">
                <h3 className="text-sm font-semibold text-texto">{grupoSeleccionado.nombre}</h3>
                <p className="text-xs text-texto-muted mt-0.5">Codigo: {grupoSeleccionado.codigo_grupo}</p>
                {/* Tabs */}
                <div className="flex gap-4 mt-3">
                  <button
                    onClick={() => setTabActivo('entidades')}
                    className={`flex items-center gap-1.5 pb-1 text-sm font-medium border-b-2 transition-colors ${
                      tabActivo === 'entidades' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                    }`}
                  >
                    <Building2 size={14} /> Entidades ({entidadesGrupo.length})
                  </button>
                  <button
                    onClick={() => setTabActivo('usuarios')}
                    className={`flex items-center gap-1.5 pb-1 text-sm font-medium border-b-2 transition-colors ${
                      tabActivo === 'usuarios' ? 'border-primario text-primario' : 'border-transparent text-texto-muted hover:text-texto'
                    }`}
                  >
                    <Users size={14} /> Usuarios ({usuariosGrupo.length})
                  </button>
                </div>
              </div>
              <TarjetaContenido className="p-0">
                <Tabla>
                  <TablaCabecera>
                    {tabActivo === 'entidades' ? (
                      <tr><TablaTh>Codigo</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Estado</TablaTh></tr>
                    ) : (
                      <tr><TablaTh>Usuario</TablaTh><TablaTh>Nombre</TablaTh><TablaTh>Estado</TablaTh></tr>
                    )}
                  </TablaCabecera>
                  <TablaCuerpo>
                    {cargandoDetalle ? (
                      <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={3 as never}>Cargando...</TablaTd></TablaFila>
                    ) : tabActivo === 'entidades' ? (
                      entidadesGrupo.length === 0 ? (
                        <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={3 as never}>No hay entidades en este grupo</TablaTd></TablaFila>
                      ) : entidadesGrupo.map((e) => (
                        <TablaFila key={e.codigo_entidad}>
                          <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{e.codigo_entidad}</code></TablaTd>
                          <TablaTd className="font-medium">{e.nombre}</TablaTd>
                          <TablaTd><Insignia variante={e.activo ? 'exito' : 'advertencia'}>{e.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                        </TablaFila>
                      ))
                    ) : (
                      usuariosGrupo.length === 0 ? (
                        <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={3 as never}>No hay usuarios en este grupo</TablaTd></TablaFila>
                      ) : usuariosGrupo.map((u) => (
                        <TablaFila key={u.codigo_usuario}>
                          <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{u.codigo_usuario}</code></TablaTd>
                          <TablaTd className="font-medium">{u.usuarios?.nombre ?? '—'}</TablaTd>
                          <TablaTd><Insignia variante={u.usuarios?.activo ? 'exito' : 'advertencia'}>{u.usuarios?.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                        </TablaFila>
                      ))
                    )}
                  </TablaCuerpo>
                </Tabla>
              </TarjetaContenido>
            </Tarjeta>
          ) : (
            <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
              Selecciona un grupo para ver su detalle
            </div>
          )}
        </div>
      </div>

      {/* Modal grupo */}
      <Modal abierto={modalGrupo} alCerrar={() => setModalGrupo(false)} titulo={grupoEditando ? 'Editar grupo' : 'Nuevo grupo'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Codigo *" value={formGrupo.codigo_grupo} onChange={(e) => setFormGrupo({ ...formGrupo, codigo_grupo: e.target.value.toUpperCase() })} disabled={!!grupoEditando} placeholder="CORP" />
          <Input etiqueta="Nombre *" value={formGrupo.nombre} onChange={(e) => setFormGrupo({ ...formGrupo, nombre: e.target.value })} placeholder="Corporacion Municipal" />
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalGrupo(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarGrupo} cargando={guardando}>{grupoEditando ? 'Guardar' : 'Crear grupo'}</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
