'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaContenido } from '@/components/ui/tarjeta'
import { rolesApi, funcionesApi } from '@/lib/api'
import type { Rol, Funcion } from '@/lib/tipos'

type FuncionAsignada = { codigo_funcion: string; funciones: { nombre_funcion: string; activo: boolean } }

export default function PaginaRoles() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [tabActiva, setTabActiva] = useState<'roles' | 'funciones'>('roles')

  // Modal rol
  const [modalRol, setModalRol] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [formRol, setFormRol] = useState({ codigo_rol: '', nombre: '', descripcion: '', url_inicio: '' })
  const [tabModalRol, setTabModalRol] = useState<'datos' | 'funciones'>('datos')

  // Funciones del rol en edición
  const [funcionesRol, setFuncionesRol] = useState<FuncionAsignada[]>([])
  const [cargandoFunciones, setCargandoFunciones] = useState(false)
  const [funcionNueva, setFuncionNueva] = useState('')
  const [asignandoFuncion, setAsignandoFuncion] = useState(false)

  // Modal función
  const [modalFuncion, setModalFuncion] = useState(false)
  const [funcionEditando, setFuncionEditando] = useState<Funcion | null>(null)
  const [formFuncion, setFormFuncion] = useState({ codigo_funcion: '', nombre: '', descripcion: '', url_default: '' })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [r, f] = await Promise.all([rolesApi.listar(), funcionesApi.listar()])
      setRoles(r)
      setFunciones(f)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const cargarFuncionesRol = useCallback(async (codigo: string) => {
    setCargandoFunciones(true)
    try {
      const f = await rolesApi.listarFunciones(codigo)
      setFuncionesRol(f)
    } catch {
      setFuncionesRol([])
    } finally {
      setCargandoFunciones(false)
    }
  }, [])

  const abrirNuevoRol = () => {
    setRolEditando(null)
    setFormRol({ codigo_rol: '', nombre: '', descripcion: '', url_inicio: '' })
    setError('')
    setTabModalRol('datos')
    setModalRol(true)
  }

  const abrirEditarRol = (r: Rol) => {
    setRolEditando(r)
    setFormRol({ codigo_rol: r.codigo_rol, nombre: r.nombre, descripcion: r.descripcion || '', url_inicio: r.url_inicio || '' })
    setError('')
    setTabModalRol('datos')
    setFuncionNueva('')
    cargarFuncionesRol(r.codigo_rol)
    setModalRol(true)
  }

  const guardarRol = async () => {
    if (!formRol.codigo_rol || !formRol.nombre) { setError('Código y nombre son obligatorios'); return }
    setGuardando(true)
    try {
      if (rolEditando) {
        await rolesApi.actualizar(rolEditando.codigo_rol, { nombre: formRol.nombre, descripcion: formRol.descripcion, url_inicio: formRol.url_inicio })
      } else {
        await rolesApi.crear(formRol)
      }
      setModalRol(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarRol = async (r: Rol) => {
    if (!confirm(`¿Eliminar el rol "${r.nombre}"?`)) return
    try { await rolesApi.eliminar(r.codigo_rol); cargar() }
    catch (e) { alert(e instanceof Error ? e.message : 'Error') }
  }

  const asignarFuncion = async () => {
    if (!funcionNueva || !rolEditando) return
    setAsignandoFuncion(true)
    try {
      await rolesApi.asignarFuncion(rolEditando.codigo_rol, funcionNueva)
      setFuncionNueva('')
      cargarFuncionesRol(rolEditando.codigo_rol)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar función')
    } finally {
      setAsignandoFuncion(false)
    }
  }

  const quitarFuncion = async (codigoFuncion: string) => {
    if (!rolEditando) return
    try {
      await rolesApi.quitarFuncion(rolEditando.codigo_rol, codigoFuncion)
      cargarFuncionesRol(rolEditando.codigo_rol)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar función')
    }
  }

  // Funciones disponibles para asignar (excluir las ya asignadas)
  const funcionesDisponibles = funciones.filter((f) =>
    f.activo &&
    !funcionesRol.some((fa) => fa.codigo_funcion === f.codigo_funcion)
  )

  const abrirNuevaFuncion = () => {
    setFuncionEditando(null)
    setFormFuncion({ codigo_funcion: '', nombre: '', descripcion: '', url_default: '' })
    setError('')
    setModalFuncion(true)
  }

  const abrirEditarFuncion = (f: Funcion) => {
    setFuncionEditando(f)
    setFormFuncion({ codigo_funcion: f.codigo_funcion, nombre: f.nombre, descripcion: f.descripcion || '', url_default: f.url_default || '' })
    setError('')
    setModalFuncion(true)
  }

  const guardarFuncion = async () => {
    if (!formFuncion.codigo_funcion || !formFuncion.nombre) { setError('Código y nombre son obligatorios'); return }
    setGuardando(true)
    try {
      if (funcionEditando) {
        await funcionesApi.actualizar(funcionEditando.codigo_funcion, { nombre: formFuncion.nombre, descripcion: formFuncion.descripcion, url_default: formFuncion.url_default })
      } else {
        await funcionesApi.crear(formFuncion)
      }
      setModalFuncion(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarFuncion = async (f: Funcion) => {
    if (!confirm(`¿Eliminar la función "${f.nombre}"?`)) return
    try { await funcionesApi.eliminar(f.codigo_funcion); cargar() }
    catch (e) { alert(e instanceof Error ? e.message : 'Error') }
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Roles y Funciones</h2>
        <p className="text-sm text-texto-muted mt-1">Configura los permisos y capacidades del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {(['roles', 'funciones'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              tabActiva === tab
                ? 'bg-surface text-primario shadow-sm border border-borde'
                : 'text-texto-muted hover:text-texto'
            }`}
          >
            {tab === 'roles' ? 'Roles' : 'Funciones'}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tabActiva === 'roles' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Boton variante="primario" onClick={abrirNuevoRol}><Plus size={16} />Nuevo rol</Boton>
          </div>
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>Código</TablaTh>
                <TablaTh>Nombre</TablaTh>
                <TablaTh>URL inicio</TablaTh>
                <TablaTh>Estado</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>Cargando...</TablaTd></TablaFila>
              ) : roles.map((r) => (
                <TablaFila key={r.codigo_rol}>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{r.codigo_rol}</code></TablaTd>
                  <TablaTd className="font-medium">{r.nombre}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{r.url_inicio || '—'}</TablaTd>
                  <TablaTd><Insignia variante={r.activo ? 'exito' : 'error'}>{r.activo ? 'Activo' : 'Inactivo'}</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarRol(r)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => eliminarRol(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {tabActiva === 'funciones' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Boton variante="primario" onClick={abrirNuevaFuncion}><Plus size={16} />Nueva función</Boton>
          </div>
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>Código</TablaTh>
                <TablaTh>Nombre</TablaTh>
                <TablaTh>URL por defecto</TablaTh>
                <TablaTh>Estado</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>Cargando...</TablaTd></TablaFila>
              ) : funciones.map((f) => (
                <TablaFila key={f.codigo_funcion}>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{f.codigo_funcion}</code></TablaTd>
                  <TablaTd className="font-medium">{f.nombre}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{f.url_default || '—'}</TablaTd>
                  <TablaTd><Insignia variante={f.activo ? 'exito' : 'error'}>{f.activo ? 'Activa' : 'Inactiva'}</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarFuncion(f)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => eliminarFuncion(f)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {/* Modal Rol */}
      <Modal abierto={modalRol} alCerrar={() => setModalRol(false)} titulo={rolEditando ? `Editar rol : ${rolEditando.codigo_rol}` : 'Nuevo rol'}>
        <div className="flex flex-col gap-4">
          {/* Pestañas (solo en edición) */}
          {rolEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button
                onClick={() => setTabModalRol('datos')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalRol === 'datos'
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                Datos
              </button>
              <button
                onClick={() => setTabModalRol('funciones')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tabModalRol === 'funciones'
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                Funciones asignadas
              </button>
            </div>
          )}

          {/* Tab Datos */}
          {tabModalRol === 'datos' && (
            <>
              <Input etiqueta="Código *" value={formRol.codigo_rol} onChange={(e) => setFormRol({ ...formRol, codigo_rol: e.target.value.toUpperCase() })} disabled={!!rolEditando} placeholder="ADMIN" />
              <Input etiqueta="Nombre *" value={formRol.nombre} onChange={(e) => setFormRol({ ...formRol, nombre: e.target.value })} placeholder="Administrador" />
              <Input etiqueta="Descripción" value={formRol.descripcion} onChange={(e) => setFormRol({ ...formRol, descripcion: e.target.value })} placeholder="Descripción del rol..." />
              <Input etiqueta="URL de inicio" value={formRol.url_inicio} onChange={(e) => setFormRol({ ...formRol, url_inicio: e.target.value })} placeholder="/admin/dashboard" />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalRol(false)}>Cancelar</Boton>
                <Boton variante="primario" onClick={guardarRol} cargando={guardando}>{rolEditando ? 'Guardar' : 'Crear rol'}</Boton>
              </div>
            </>
          )}

          {/* Tab Funciones asignadas */}
          {tabModalRol === 'funciones' && rolEditando && (
            <div className="flex flex-col gap-4">
              {/* Asignar nueva función */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    value={funcionNueva}
                    onChange={(e) => setFuncionNueva(e.target.value)}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  >
                    <option value="">Seleccionar función...</option>
                    {funcionesDisponibles.map((f) => (
                      <option key={f.codigo_funcion} value={f.codigo_funcion}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
                <Boton
                  variante="primario"
                  onClick={asignarFuncion}
                  cargando={asignandoFuncion}
                  disabled={!funcionNueva}
                >
                  <Plus size={14} />
                  Asignar
                </Boton>
              </div>

              {/* Lista de funciones asignadas */}
              {cargandoFunciones ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />
                  ))}
                </div>
              ) : funcionesRol.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">
                  No tiene funciones asignadas
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {funcionesRol.map((fa) => (
                    <div
                      key={fa.codigo_funcion}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"
                    >
                      <div>
                        <span className="text-sm font-medium text-texto">
                          {fa.funciones?.nombre_funcion || fa.codigo_funcion}
                        </span>
                        <span className="ml-2 text-xs text-texto-muted">{fa.codigo_funcion}</span>
                      </div>
                      <button
                        onClick={() => quitarFuncion(fa.codigo_funcion)}
                        className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                        title="Quitar función"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalRol(false)}>
                  Cerrar
                </Boton>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Función */}
      <Modal abierto={modalFuncion} alCerrar={() => setModalFuncion(false)} titulo={funcionEditando ? 'Editar función' : 'Nueva función'}>
        <div className="flex flex-col gap-4">
          <Input etiqueta="Código *" value={formFuncion.codigo_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_funcion: e.target.value.toUpperCase() })} disabled={!!funcionEditando} placeholder="GEST_USUARIOS" />
          <Input etiqueta="Nombre *" value={formFuncion.nombre} onChange={(e) => setFormFuncion({ ...formFuncion, nombre: e.target.value })} placeholder="Gestión de usuarios" />
          <Input etiqueta="Descripción" value={formFuncion.descripcion} onChange={(e) => setFormFuncion({ ...formFuncion, descripcion: e.target.value })} />
          <Input etiqueta="URL por defecto" value={formFuncion.url_default} onChange={(e) => setFormFuncion({ ...formFuncion, url_default: e.target.value })} placeholder="/usuarios" />
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalFuncion(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarFuncion} cargando={guardando}>{funcionEditando ? 'Guardar' : 'Crear función'}</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
