'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Download, Search, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { rolesApi, funcionesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Rol, Funcion } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

type FuncionAsignada = { codigo_funcion: string; orden: number; funciones: { nombre_funcion: string } }

export default function PaginaRolesGrupo() {
  const { grupoActivo } = useAuth()

  const [roles, setRoles] = useState<Rol[]>([])
  const [allFunciones, setAllFunciones] = useState<Funcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [busquedaRoles, setBusquedaRoles] = useState('')
  const [modalRol, setModalRol] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [formRol, setFormRol] = useState({ codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '', funcion_por_defecto: '' })
  const [tabModalRol, setTabModalRol] = useState<'datos' | 'funciones'>('datos')
  const [guardandoRol, setGuardandoRol] = useState(false)
  const [errorRol, setErrorRol] = useState('')

  // Funciones del rol
  const [funcionesRol, setFuncionesRol] = useState<FuncionAsignada[]>([])
  const [cargandoFuncionesRol, setCargandoFuncionesRol] = useState(false)
  const [funcionNueva, setFuncionNueva] = useState('')
  const [busquedaFuncionEnt, setBusquedaFuncionEnt] = useState('')
  const [dropdownFuncionEntAbierto, setDropdownFuncionEntAbierto] = useState(false)
  const dropdownFuncionEntRef = useRef<HTMLDivElement>(null)
  const [asignandoFuncion, setAsignandoFuncion] = useState(false)

  // Confirmación eliminación rol
  const [rolAEliminar, setRolAEliminar] = useState<Rol | null>(null)
  const [eliminandoRol, setEliminandoRol] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [r, f] = await Promise.all([rolesApi.listar(), funcionesApi.listar(grupoActivo || undefined)])
      setRoles(r)
      setAllFunciones(f)
    } finally {
      setCargando(false)
    }
  }, [grupoActivo])

  useEffect(() => { cargar() }, []) // eslint-disable-line

  // Cerrar dropdown de función al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownFuncionEntRef.current && !dropdownFuncionEntRef.current.contains(e.target as Node)) {
        setDropdownFuncionEntAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const cargarFuncionesRol = useCallback(async (idRol: number) => {
    setCargandoFuncionesRol(true)
    try { setFuncionesRol(await rolesApi.listarFunciones(idRol)) } catch { setFuncionesRol([]) }
    finally { setCargandoFuncionesRol(false) }
  }, [])

  const abrirNuevoRol = () => {
    setRolEditando(null)
    setFormRol({ codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '', funcion_por_defecto: '' })
    setErrorRol(''); setTabModalRol('datos'); setModalRol(true)
  }
  const abrirEditarRol = (r: Rol) => {
    setRolEditando(r)
    setFormRol({ codigo_rol: r.codigo_rol, nombre: r.nombre, alias_de_rol: r.alias_de_rol || '', descripcion: r.descripcion || '', url_inicio: r.url_inicio || '', funcion_por_defecto: r.funcion_por_defecto || '' })
    setErrorRol(''); setTabModalRol('datos'); setFuncionNueva(''); cargarFuncionesRol(r.id_rol); setModalRol(true)
  }
  const guardarRol = async (cerrar: boolean) => {
    if (!formRol.codigo_rol || !formRol.nombre) { setErrorRol('Código y nombre son obligatorios'); return }
    setGuardandoRol(true)
    try {
      if (rolEditando) {
        await rolesApi.actualizar(rolEditando.id_rol, { nombre: formRol.nombre, alias_de_rol: formRol.alias_de_rol || undefined, descripcion: formRol.descripcion, url_inicio: formRol.url_inicio, funcion_por_defecto: formRol.funcion_por_defecto || undefined })
        if (cerrar) setModalRol(false)
      } else {
        const nuevo = await rolesApi.crear({ ...formRol, codigo_grupo: grupoActivo || 'ADMIN' })
        if (!cerrar) {
          setRolEditando(nuevo)
          setFormRol({ codigo_rol: nuevo.codigo_rol, nombre: nuevo.nombre, alias_de_rol: nuevo.alias_de_rol || '', descripcion: nuevo.descripcion || '', url_inicio: nuevo.url_inicio || '', funcion_por_defecto: nuevo.funcion_por_defecto || '' })
          cargarFuncionesRol(nuevo.id_rol)
        } else {
          setModalRol(false)
        }
      }
      cargar()
    } catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoRol(false) }
  }
  const ejecutarEliminarRol = async () => {
    if (!rolAEliminar) return; setEliminandoRol(true)
    try { await rolesApi.eliminar(rolAEliminar.id_rol); setRolAEliminar(null); cargar() }
    catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error'); setRolAEliminar(null) }
    finally { setEliminandoRol(false) }
  }

  const asignarFuncionRol = async () => {
    if (!funcionNueva || !rolEditando) return; setAsignandoFuncion(true)
    try { await rolesApi.asignarFuncion(rolEditando.id_rol, funcionNueva); setFuncionNueva(''); setBusquedaFuncionEnt(''); cargarFuncionesRol(rolEditando.id_rol) }
    catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error') } finally { setAsignandoFuncion(false) }
  }
  const quitarFuncionRol = async (c: string) => {
    if (!rolEditando) return
    try { await rolesApi.quitarFuncion(rolEditando.id_rol, c); cargarFuncionesRol(rolEditando.id_rol) }
    catch (e) { setErrorRol(e instanceof Error ? e.message : 'Error') }
  }
  const moverFuncionRol = async (index: number, dir: 'arriba' | 'abajo') => {
    if (!rolEditando) return
    const lista = [...funcionesRol]; const swap = dir === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const oA = lista[index].orden; const oB = lista[swap].orden
    lista[index].orden = oB; lista[swap].orden = oA
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setFuncionesRol(lista)
    try { await rolesApi.reordenarFunciones(rolEditando.id_rol, lista.map((f) => ({ codigo_funcion: f.codigo_funcion, orden: f.orden }))) }
    catch { cargarFuncionesRol(rolEditando.id_rol) }
  }

  const moverRol = async (index: number, dir: 'arriba' | 'abajo') => {
    const lista = [...roles]; const swap = dir === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const oA = lista[index].orden ?? index
    const oB = lista[swap].orden ?? swap
    lista[index] = { ...lista[index], orden: oB }
    lista[swap] = { ...lista[swap], orden: oA }
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setRoles(lista)
    try { await rolesApi.reordenar(lista.map((r, i) => ({ id_rol: r.id_rol, orden: r.orden ?? i }))) }
    catch { cargar() }
  }

  const funcionesDisponiblesRol = allFunciones.filter((f) => !funcionesRol.some((fa) => fa.codigo_funcion === f.codigo_funcion))
  const funcionesEntFiltradas = funcionesDisponiblesRol.filter((f) =>
    busquedaFuncionEnt.length === 0 ||
    f.nombre.toLowerCase().includes(busquedaFuncionEnt.toLowerCase()) ||
    f.codigo_funcion.toLowerCase().includes(busquedaFuncionEnt.toLowerCase())
  )
  const rolesFiltrados = roles.filter((r) =>
    r.nombre.toLowerCase().includes(busquedaRoles.toLowerCase()) ||
    r.codigo_rol.toLowerCase().includes(busquedaRoles.toLowerCase()) ||
    (r.alias_de_rol || '').toLowerCase().includes(busquedaRoles.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Roles del Grupo</h2>
        <p className="text-sm text-texto-muted mt-1">Gestión de roles y asignación de funciones del grupo activo</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="max-w-sm flex-1">
            <Input placeholder="Buscar por nombre, código o alias..." value={busquedaRoles} onChange={(e) => setBusquedaRoles(e.target.value)} icono={<Search size={15} />} />
          </div>
          <div className="flex gap-2 ml-auto">
            <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(rolesFiltrados as unknown as Record<string, unknown>[], [{ titulo: 'Orden', campo: 'orden' }, { titulo: 'Grupo', campo: 'codigo_grupo' }, { titulo: 'Código', campo: 'codigo_rol' }, { titulo: 'Alias', campo: 'alias_de_rol' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Descripción', campo: 'descripcion' }, { titulo: 'URL inicio', campo: 'url_inicio' }, { titulo: 'Fn. defecto', campo: 'funcion_por_defecto' }], `roles_${grupoActivo || 'todos'}`)} disabled={rolesFiltrados.length === 0}><Download size={15} />Excel</Boton>
            <Boton variante="primario" onClick={abrirNuevoRol}><Plus size={16} />Nuevo rol</Boton>
          </div>
        </div>
        <Tabla>
          <TablaCabecera>
            <tr>
              <TablaTh className="w-16">Orden</TablaTh>
              <TablaTh>Código</TablaTh>
              <TablaTh>Alias</TablaTh>
              <TablaTh>Nombre</TablaTh>
              <TablaTh>URL inicio</TablaTh>
              <TablaTh>Fn. defecto</TablaTh>
              <TablaTh className="text-right">Acciones</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {cargando ? (
              <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Cargando...</TablaTd></TablaFila>
            ) : rolesFiltrados.length === 0 ? (
              <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>No se encontraron roles</TablaTd></TablaFila>
            ) : rolesFiltrados.map((r, idx) => (
              <TablaFila key={r.codigo_rol}>
                <TablaTd>
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col">
                      <button onClick={() => moverRol(idx, 'arriba')} disabled={idx === 0 || !!busquedaRoles} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                      <button onClick={() => moverRol(idx, 'abajo')} disabled={idx === rolesFiltrados.length - 1 || !!busquedaRoles} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                    </div>
                    <span className="text-xs text-texto-muted w-5 text-center">{r.orden ?? idx}</span>
                  </div>
                </TablaTd>
                <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{r.codigo_rol}</code></TablaTd>
                <TablaTd className="text-sm">{r.alias_de_rol || '—'}</TablaTd>
                <TablaTd className="font-medium">{r.nombre}</TablaTd>
                <TablaTd className="text-texto-muted text-xs">{r.url_inicio || '—'}</TablaTd>
                <TablaTd className="text-texto-muted text-xs">{r.funcion_por_defecto || '—'}</TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => abrirEditarRol(r)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => setRolAEliminar(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                </TablaTd>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      </div>

      {/* Modal Rol */}
      <Modal abierto={modalRol} alCerrar={() => setModalRol(false)} titulo={rolEditando ? `Editar rol: ${rolEditando.nombre}` : 'Nuevo rol'} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {rolEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button onClick={() => setTabModalRol('datos')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalRol === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Datos</button>
              <button onClick={() => setTabModalRol('funciones')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalRol === 'funciones' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Funciones ({funcionesRol.length})</button>
            </div>
          )}
          {tabModalRol === 'datos' && (<>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Input etiqueta="Código *" value={formRol.codigo_rol} onChange={(e) => setFormRol({ ...formRol, codigo_rol: e.target.value.toUpperCase() })} disabled={!!rolEditando} placeholder="ADMIN" />
              <Input etiqueta="Alias" value={formRol.alias_de_rol} onChange={(e) => setFormRol({ ...formRol, alias_de_rol: e.target.value.substring(0, 40) })} placeholder="Admin" />
              <Input etiqueta="Nombre *" value={formRol.nombre} onChange={(e) => setFormRol({ ...formRol, nombre: e.target.value })} placeholder="Administrador" />
              <Input etiqueta="URL de inicio" value={formRol.url_inicio} onChange={(e) => setFormRol({ ...formRol, url_inicio: e.target.value })} placeholder="/admin/dashboard" />
              {rolEditando && (
                <div className="flex flex-col gap-1"><label className="text-sm font-medium text-texto">Función por defecto</label>
                  <select value={formRol.funcion_por_defecto} onChange={(e) => setFormRol({ ...formRol, funcion_por_defecto: e.target.value })} className={selectClass}>
                    <option value="">Sin función por defecto</option>
                    {funcionesRol.map((fa) => (<option key={fa.codigo_funcion} value={fa.codigo_funcion}>{fa.funciones?.nombre_funcion || fa.codigo_funcion}</option>))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <Textarea etiqueta="Descripción" value={formRol.descripcion} onChange={(e) => setFormRol({ ...formRol, descripcion: e.target.value })} rows={3} />
              </div>
            </div>
            {errorRol && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorRol}</p></div>}
            <div className="flex gap-3 justify-end pt-2"><Boton variante="secundario" onClick={() => setModalRol(false)}>Salir</Boton><Boton variante="primario" onClick={() => guardarRol(false)} cargando={guardandoRol}>Guardar</Boton></div>
          </>)}
          {tabModalRol === 'funciones' && rolEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={dropdownFuncionEntRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      type="text"
                      placeholder="Buscar función por nombre o código..."
                      value={busquedaFuncionEnt}
                      onChange={(e) => { setBusquedaFuncionEnt(e.target.value); setDropdownFuncionEntAbierto(true); setFuncionNueva('') }}
                      onFocus={() => setDropdownFuncionEntAbierto(true)}
                      className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                    />
                  </div>
                  {dropdownFuncionEntAbierto && (
                    <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {funcionesEntFiltradas.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-texto-muted">No se encontraron funciones</div>
                      ) : funcionesEntFiltradas.slice(0, 20).map((f) => (
                        <button
                          key={f.codigo_funcion}
                          onClick={() => {
                            setFuncionNueva(f.codigo_funcion)
                            setBusquedaFuncionEnt(`${f.nombre} (${f.codigo_funcion})`)
                            setDropdownFuncionEntAbierto(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro hover:text-primario transition-colors"
                        >
                          <span className="font-medium">{f.nombre}</span>
                          <span className="ml-2 text-texto-muted text-xs">{f.codigo_funcion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Boton variante="primario" onClick={asignarFuncionRol} cargando={asignandoFuncion} disabled={!funcionNueva}><Plus size={14} />Asignar</Boton>
              </div>
              {cargandoFuncionesRol ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : funcionesRol.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene funciones asignadas</p>
              : <div className="flex flex-col gap-2">{funcionesRol.map((fa, idx) => (
                <div key={fa.codigo_funcion} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde bg-surface">
                  <div className="flex flex-col"><button onClick={() => moverFuncionRol(idx, 'arriba')} disabled={idx === 0} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button><button onClick={() => moverFuncionRol(idx, 'abajo')} disabled={idx === funcionesRol.length - 1} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button></div>
                  <span className="text-xs text-texto-muted w-5 text-center">{fa.orden}</span>
                  <div className="flex-1 min-w-0"><span className="text-sm font-medium text-texto">{fa.funciones?.nombre_funcion || fa.codigo_funcion}</span><span className="ml-2 text-xs text-texto-muted">{fa.codigo_funcion}</span></div>
                  <button onClick={() => quitarFuncionRol(fa.codigo_funcion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button>
                </div>
              ))}</div>}
              {errorRol && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorRol}</p></div>}
              <div className="flex justify-end pt-2"><Boton variante="secundario" onClick={() => setModalRol(false)}>Cerrar</Boton></div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Confirmar eliminación rol */}
      <ModalConfirmar abierto={!!rolAEliminar} alCerrar={() => setRolAEliminar(null)} alConfirmar={ejecutarEliminarRol} titulo="Eliminar rol" mensaje={`¿Estás seguro de eliminar el rol "${rolAEliminar?.nombre}"? Esta acción no se puede deshacer.`} textoConfirmar="Eliminar" cargando={eliminandoRol} />
    </div>
  )
}
