'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import {
  TablaCrud,
  columnaCodigo,
  columnaNombre,
  columnaDescripcion,
} from '@/components/ui/tabla-crud'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { cargosApi, entidadesApi, rolesApi } from '@/lib/api'
import type { Cargo, RolCargo, Entidad, Rol } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

type FormCargo = {
  codigo_cargo: string
  nombre_cargo: string
  alias: string
  descripcion: string
  codigo_entidad: string
  prompt: string
  system_prompt: string
  python: string
  javascript: string
  python_editado_manual: boolean
  javascript_editado_manual: boolean
}

const selectClass =
  'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

export default function PaginaCargos() {
  const t = useTranslations('cargos')
  const tc = useTranslations('common')
  const { usuario } = useAuth()
  const grupoActivo = usuario?.grupo_activo ?? ''

  // ── Catálogos ───────────────────────────────────────────────────────────────
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [roles, setRoles] = useState<Rol[]>([])

  useEffect(() => {
    Promise.all([entidadesApi.listar(), rolesApi.listar()])
      .then(([e, r]) => { setEntidades(e); setRoles(r) })
      .catch(() => {})
  }, [grupoActivo])

  // ── CRUD base ───────────────────────────────────────────────────────────────
  const crud = useCrudPage<Cargo, FormCargo>({
    cargarFn: () => cargosApi.listar(),
    crearFn: (f) =>
      cargosApi.crear({
        codigo_cargo: f.codigo_cargo.trim() || undefined,
        nombre_cargo: f.nombre_cargo.trim(),
        alias: f.alias.trim() || undefined,
        descripcion: f.descripcion.trim() || undefined,
        codigo_entidad: f.codigo_entidad || undefined,
        prompt: f.prompt.trim() || undefined,
        system_prompt: f.system_prompt.trim() || undefined,
        python: f.python.trim() || undefined,
        javascript: f.javascript.trim() || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as Record<string, unknown>),
    actualizarFn: (id, f) =>
      cargosApi.actualizar(id, {
        nombre_cargo: (f.nombre_cargo ?? '').trim(),
        alias: (f.alias ?? '').trim() || undefined,
        descripcion: (f.descripcion ?? '').trim() || undefined,
        codigo_entidad: f.codigo_entidad,
        prompt: (f.prompt ?? '').trim() || undefined,
        system_prompt: (f.system_prompt ?? '').trim() || undefined,
        python: (f.python ?? '').trim() || undefined,
        javascript: (f.javascript ?? '').trim() || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as Record<string, unknown>),
    eliminarFn: async (id: string) => { await cargosApi.eliminar(id) },
    getId: (c) => c.codigo_cargo,
    camposBusqueda: (c) => [c.codigo_cargo, c.nombre_cargo, c.alias],
    formInicial: { codigo_cargo: '', nombre_cargo: '', alias: '', descripcion: '', codigo_entidad: '', prompt: '', system_prompt: '', python: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false },
    itemToForm: (c) => {
      const c2 = c as unknown as Record<string, unknown>
      return {
        codigo_cargo: c.codigo_cargo,
        nombre_cargo: c.nombre_cargo,
        alias: c.alias ?? '',
        descripcion: c.descripcion ?? '',
        codigo_entidad: c.codigo_entidad ?? '',
        prompt: c.prompt ?? '',
        system_prompt: c.system_prompt ?? '',
        python: c2.python as string || '',
        javascript: c2.javascript as string || '',
        python_editado_manual: c2.python_editado_manual as boolean || false,
        javascript_editado_manual: c2.javascript_editado_manual as boolean || false,
      }
    },
  })

  // ── Tab activa en el modal ──────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<'datos' | 'roles' | 'prompts'>('datos')

  const abrirNuevo = () => { setTabActiva('datos'); crud.abrirNuevo() }
  const abrirEditar = (c: Cargo) => {
    setTabActiva('datos')
    setRolesCargo([])
    crud.abrirEditar(c)
    cargarRolesCargo(c.codigo_cargo)
  }

  // ── Roles del cargo ─────────────────────────────────────────────────────────
  const [rolesCargo, setRolesCargo] = useState<RolCargo[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [busquedaRol, setBusquedaRol] = useState('')
  const [dropdownRolAbierto, setDropdownRolAbierto] = useState(false)
  const dropdownRolRef = useRef<HTMLDivElement>(null)
  const [asignandoRol, setAsignandoRol] = useState(false)
  const [errorRol, setErrorRol] = useState('')

  const cargarRolesCargo = useCallback(async (codigo_cargo: string) => {
    setCargandoRoles(true)
    try { setRolesCargo(await cargosApi.listarRoles(codigo_cargo)) }
    catch { setRolesCargo([]) }
    finally { setCargandoRoles(false) }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRolRef.current && !dropdownRolRef.current.contains(e.target as Node))
        setDropdownRolAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const rolesDisponibles = roles
    .filter(
      (r) =>
        (r.codigo_grupo === grupoActivo || r.codigo_grupo == null) &&
        !rolesCargo.some((rc) => rc.id_rol === r.id_rol),
    )
    .sort((a, b) => {
      const na = a.codigo_aplicacion_origen ?? '\uffff'
      const nb = b.codigo_aplicacion_origen ?? '\uffff'
      return na.localeCompare(nb) || a.nombre.localeCompare(b.nombre)
    })

  const rolesFiltrados = rolesDisponibles.filter(
    (r) =>
      !busquedaRol ||
      r.nombre.toLowerCase().includes(busquedaRol.toLowerCase()) ||
      r.codigo_rol.toLowerCase().includes(busquedaRol.toLowerCase()),
  )

  const asignarRol = async (id_rol: number) => {
    if (!crud.editando) return
    setAsignandoRol(true)
    setErrorRol('')
    try {
      await cargosApi.asignarRol(crud.editando.codigo_cargo, id_rol)
      setBusquedaRol('')
      setDropdownRolAbierto(false)
      await cargarRolesCargo(crud.editando.codigo_cargo)
    } catch (e) { setErrorRol(e instanceof Error ? e.message : t('errorAlAsignarRol')) }
    finally { setAsignandoRol(false) }
  }

  const quitarRol = async (id_rol: number) => {
    if (!crud.editando) return
    setErrorRol('')
    try {
      await cargosApi.quitarRol(crud.editando.codigo_cargo, id_rol)
      await cargarRolesCargo(crud.editando.codigo_cargo)
    } catch (e) { setErrorRol(e instanceof Error ? e.message : t('errorAlQuitarRol')) }
  }

  const reordenarRolesCargo = async (nuevos: typeof rolesCargo) => {
    setRolesCargo(nuevos)
    try { await cargosApi.reordenarRoles(crud.editando!.codigo_cargo, nuevos.map(r => ({ id_rol: r.id_rol, orden: r.orden ?? 0 }))) }
    catch { if (crud.editando) cargarRolesCargo(crud.editando.codigo_cargo) }
  }

  // ── Lista ordenada ──────────────────────────────────────────────────────────
  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_cargo.localeCompare(b.nombre_cargo),
  )

  const nombreEntidad = (codigo: string | null | undefined) => {
    if (!codigo) return null
    return entidades.find((e) => e.codigo_entidad === codigo)?.nombre ?? codigo
  }

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      <BarraHerramientas
        busqueda={crud.busqueda}
        onBusqueda={crud.setBusqueda}
        placeholderBusqueda={t('buscarPlaceholder')}
        onNuevo={abrirNuevo}
        textoNuevo={t('nuevoCargo')}
        excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
        excelColumnas={[
          { titulo: t('colCodigo'), campo: 'codigo_cargo' },
          { titulo: t('colNombre'), campo: 'nombre_cargo' },
          { titulo: t('colAlias'), campo: 'alias' },
          { titulo: t('colEntidad'), campo: 'codigo_entidad' },
          { titulo: t('colDescripcion'), campo: 'descripcion' },
        ]}
        excelNombreArchivo="cargos"
      />

      <TablaCrud
        columnas={[
          columnaNombre<Cargo>(t('colNombre'), (c) => c.nombre_cargo),
          { titulo: t('colAlias'), render: (c: Cargo) => c.alias || '—' },
          {
            titulo: t('colEntidad'),
            render: (c: Cargo) => {
              const nombre = nombreEntidad(c.codigo_entidad)
              return nombre ? (
                <span className="text-sm">{nombre}</span>
              ) : (
                <Insignia variante="neutro">{t('todoElGrupo')}</Insignia>
              )
            },
          },
          columnaDescripcion<Cargo>(t('colDescripcion'), (c) => c.descripcion),
          columnaCodigo<Cargo>(t('colCodigo'), (c) => c.codigo_cargo),
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(c) => c.codigo_cargo}
        onEditar={abrirEditar}
        onEliminar={crud.setConfirmacion}
        textoVacio={t('sinCargos')}
      />

      {/* ── Modal crear/editar ─────────────────────────────────────────────── */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? t('editarTitulo', { nombre: crud.editando.nombre_cargo }) : t('nuevoTitulo')}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-0 min-w-[520px]">
          {/* Tabs */}
          <div className="flex border-b border-borde mb-4">
            {(crud.editando
              ? (['datos', 'roles', 'prompts'] as const)
              : (['datos', 'prompts'] as const)
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabActiva(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  tabActiva === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos' ? t('tabDatos') : tab === 'roles' ? t('tabRoles') : 'Prompts'}
              </button>
            ))}
          </div>

          {/* ── Tab Datos ─────────────────────────────────────────────────── */}
          {tabActiva === 'datos' && (
            <div className="flex flex-col gap-4">
              {crud.editando && (
                <Input etiqueta={t('etiquetaCodigo')} value={crud.form.codigo_cargo} onChange={() => {}} disabled />
              )}

              <Input
                etiqueta={t('etiquetaNombre')}
                value={crud.form.nombre_cargo}
                onChange={(e) => crud.updateForm('nombre_cargo', e.target.value)}
                placeholder={t('placeholderNombre')}
                autoFocus
              />

              <Input
                etiqueta={t('etiquetaAlias')}
                value={crud.form.alias}
                onChange={(e) => crud.updateForm('alias', e.target.value)}
                placeholder={t('placeholderAlias')}
              />

              {/* Selector de entidad */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">{t('etiquetaEntidad')}</label>
                <select
                  className={selectClass}
                  value={crud.form.codigo_entidad}
                  onChange={(e) => crud.updateForm('codigo_entidad', e.target.value)}
                >
                  <option value="">{t('todoElGrupoOpcion')}</option>
                  {entidades.map((e) => (
                    <option key={e.codigo_entidad} value={e.codigo_entidad}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-texto-muted">{t('descEntidad')}</p>
              </div>

              <Textarea
                etiqueta={t('etiquetaDescripcion')}
                value={crud.form.descripcion}
                onChange={(e) => crud.updateForm('descripcion', e.target.value)}
                placeholder={t('placeholderDescripcion')}
                rows={3}
              />

              {crud.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{crud.error}</p>
                </div>
              )}

              <PieBotonesModal
                editando={!!crud.editando}
                onGuardar={() => {
                  if (!crud.form.nombre_cargo.trim()) {
                    crud.setError(t('errorNombreObligatorio'))
                    return
                  }
                  crud.guardar(undefined, undefined, { cerrar: false })
                }}
                onGuardarYSalir={() => {
                  if (!crud.form.nombre_cargo.trim()) {
                    crud.setError(t('errorNombreObligatorio'))
                    return
                  }
                  crud.guardar(undefined, undefined, { cerrar: true })
                }}
                onCerrar={crud.cerrarModal}
                cargando={crud.guardando}
              />
            </div>
          )}

          {/* ── Tab Prompts ───────────────────────────────────────────────── */}
          {tabActiva === 'prompts' && (
            <div className="flex flex-col gap-4">
              <TabPrompts
                tabla="cargos"
                pkColumna="codigo_cargo"
                pkValor={crud.editando?.codigo_cargo ?? null}
                campos={crud.form}
                onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormCargo, valor as string | boolean)}
              />
              <PieBotonesModal
                editando={!!crud.editando}
                onGuardar={() => crud.guardar(undefined, undefined, { cerrar: false })}
                onGuardarYSalir={() => crud.guardar(undefined, undefined, { cerrar: true })}
                onCerrar={crud.cerrarModal}
                cargando={crud.guardando}
              />
            </div>
          )}

          {/* ── Tab Roles ─────────────────────────────────────────────────── */}
          {tabActiva === 'roles' && crud.editando && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">{t('agregarRol')}</label>
                <div className="relative" ref={dropdownRolRef}>
                  <div className="flex items-center border border-borde rounded-lg bg-surface px-3 py-2 gap-2">
                    <Search className="w-4 h-4 text-texto-muted shrink-0" />
                    <input
                      className="flex-1 bg-transparent text-sm text-texto outline-none placeholder:text-texto-muted"
                      placeholder={t('buscarRolPlaceholder')}
                      value={busquedaRol}
                      onChange={(e) => { setBusquedaRol(e.target.value); setDropdownRolAbierto(true) }}
                      onFocus={() => setDropdownRolAbierto(true)}
                    />
                  </div>
                  {dropdownRolAbierto && rolesFiltrados.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-surface border border-borde rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {rolesFiltrados.map((r) => (
                        <button
                          key={r.id_rol}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primario/10 transition-colors flex items-center justify-between gap-2"
                          onClick={() => asignarRol(r.id_rol)}
                          disabled={asignandoRol}
                        >
                          <span>{r.nombre}</span>
                          {r.codigo_grupo == null && (
                            <Insignia variante="secundario">{t('global')}</Insignia>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {cargandoRoles ? (
                <p className="text-sm text-texto-muted">{t('cargandoRoles')}</p>
              ) : rolesCargo.length === 0 ? (
                <p className="text-sm text-texto-muted italic">{t('sinRoles')}</p>
              ) : (
                <SortableDndContext
                  items={[...rolesCargo].sort((a, b) => a.orden - b.orden) as unknown as Record<string, unknown>[]}
                  getId={(r) => String((r as { id_rol: number }).id_rol)}
                  onReorder={(n) => reordenarRolesCargo(n as typeof rolesCargo)}
                >
                  <Tabla>
                    <TablaCabecera>
                      <tr>
                        <TablaTh className="w-8" />
                        <TablaTh>{t('colRol')}</TablaTh>
                        <TablaTh></TablaTh>
                        <TablaTh alineacion="derecha">{t('colAccion')}</TablaTh>
                      </tr>
                    </TablaCabecera>
                    <TablaCuerpo>
                      {[...rolesCargo]
                        .sort((a, b) => a.orden - b.orden)
                        .map((rc) => (
                          <SortableRow key={rc.id_rol} id={String(rc.id_rol)}>
                            <TablaTd>
                              <span className="font-medium text-sm">
                                {rc.roles?.nombre_rol ?? `Rol ${rc.id_rol}`}
                              </span>
                            </TablaTd>
                            <TablaTd>
                              {rc.roles?.codigo_grupo == null && (
                                <Insignia variante="secundario">{t('global')}</Insignia>
                              )}
                            </TablaTd>
                            <TablaTd alineacion="derecha">
                              <Boton variante="peligro" tamano="sm" onClick={() => quitarRol(rc.id_rol)}>
                                {t('quitar')}
                              </Boton>
                            </TablaTd>
                          </SortableRow>
                        ))}
                    </TablaCuerpo>
                  </Tabla>
                </SortableDndContext>
              )}

              {errorRol && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{errorRol}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        alCerrar={() => crud.setConfirmacion(null)}
        alConfirmar={crud.ejecutarEliminacion}
        titulo={t('eliminarTitulo')}
        mensaje={
          crud.confirmacion
            ? t('eliminarConfirm', { nombre: crud.confirmacion.nombre_cargo })
            : ''
        }
        textoConfirmar={tc('eliminar')}
        variante="peligro"
        cargando={crud.eliminando}
      />
    </div>
  )
}
