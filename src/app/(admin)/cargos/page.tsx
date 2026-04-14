'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import {
  TablaCrud,
  columnaCodigo,
  columnaNombre,
  columnaDescripcion,
  columnaEstado,
} from '@/components/ui/tabla-crud'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { cargosApi, entidadesApi, rolesApi } from '@/lib/api'
import type { Cargo, RolCargo, Entidad, Rol } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { useAuth } from '@/context/AuthContext'

type FormCargo = {
  codigo_cargo: string
  nombre_cargo: string
  alias: string
  descripcion: string
  codigo_entidad: string
  prompt: string
  system_prompt: string
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
      }),
    actualizarFn: (id, f) =>
      cargosApi.actualizar(Number(id), {
        nombre_cargo: (f.nombre_cargo ?? '').trim(),
        alias: (f.alias ?? '').trim() || undefined,
        descripcion: (f.descripcion ?? '').trim() || undefined,
        codigo_entidad: f.codigo_entidad || undefined,
        prompt: (f.prompt ?? '').trim() || undefined,
        system_prompt: (f.system_prompt ?? '').trim() || undefined,
      }),
    eliminarFn: async (id: string) => { await cargosApi.eliminar(Number(id)) },
    getId: (c) => String(c.id_cargo),
    camposBusqueda: (c) => [c.codigo_cargo, c.nombre_cargo, c.alias],
    formInicial: { codigo_cargo: '', nombre_cargo: '', alias: '', descripcion: '', codigo_entidad: '', prompt: '', system_prompt: '' },
    itemToForm: (c) => ({
      codigo_cargo: c.codigo_cargo,
      nombre_cargo: c.nombre_cargo,
      alias: c.alias ?? '',
      descripcion: c.descripcion ?? '',
      codigo_entidad: c.codigo_entidad ?? '',
      prompt: c.prompt ?? '',
      system_prompt: c.system_prompt ?? '',
    }),
  })

  // ── Tab activa en el modal ──────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<'datos' | 'roles' | 'prompt' | 'system_prompt'>('datos')

  // Resetear tab al abrir modal
  const abrirNuevo = () => { setTabActiva('datos'); crud.abrirNuevo() }
  const abrirEditar = (c: Cargo) => {
    setTabActiva('datos')
    setRolesCargo([])
    crud.abrirEditar(c)
    cargarRolesCargo(c.id_cargo)
  }

  // ── Roles del cargo ─────────────────────────────────────────────────────────
  const [rolesCargo, setRolesCargo] = useState<RolCargo[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [busquedaRol, setBusquedaRol] = useState('')
  const [dropdownRolAbierto, setDropdownRolAbierto] = useState(false)
  const dropdownRolRef = useRef<HTMLDivElement>(null)
  const [asignandoRol, setAsignandoRol] = useState(false)
  const [errorRol, setErrorRol] = useState('')

  const cargarRolesCargo = useCallback(async (id: number) => {
    setCargandoRoles(true)
    try { setRolesCargo(await cargosApi.listarRoles(id)) }
    catch { setRolesCargo([]) }
    finally { setCargandoRoles(false) }
  }, [])

  // Click-outside dropdown rol
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRolRef.current && !dropdownRolRef.current.contains(e.target as Node))
        setDropdownRolAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Roles disponibles para asignar (del grupo activo + globales, excluyendo los ya asignados)
  const rolesDisponibles = roles
    .filter(
      (r) =>
        r.activo &&
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
      await cargosApi.asignarRol(crud.editando.id_cargo, id_rol)
      setBusquedaRol('')
      setDropdownRolAbierto(false)
      await cargarRolesCargo(crud.editando.id_cargo)
    } catch (e) { setErrorRol(e instanceof Error ? e.message : t('errorAlAsignarRol')) }
    finally { setAsignandoRol(false) }
  }

  const quitarRol = async (id_rol: number) => {
    if (!crud.editando) return
    setErrorRol('')
    try {
      await cargosApi.quitarRol(crud.editando.id_cargo, id_rol)
      await cargarRolesCargo(crud.editando.id_cargo)
    } catch (e) { setErrorRol(e instanceof Error ? e.message : t('errorAlQuitarRol')) }
  }

  const moverRol = async (idx: number, dir: 'arriba' | 'abajo') => {
    if (!crud.editando) return
    const lista = [...rolesCargo].sort((a, b) => a.orden - b.orden)
    const swapIdx = dir === 'arriba' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= lista.length) return
    const ordenA = lista[idx].orden
    const ordenB = lista[swapIdx].orden
    lista[idx].orden = ordenB
    lista[swapIdx].orden = ordenA
    ;[lista[idx], lista[swapIdx]] = [lista[swapIdx], lista[idx]]
    setRolesCargo(lista)
    try {
      await cargosApi.reordenarRoles(crud.editando.id_cargo, lista.map((r) => ({ id_rol: r.id_rol, orden: r.orden })))
    } catch {
      cargarRolesCargo(crud.editando.id_cargo)
    }
  }

  // ── Lista ordenada para la tabla principal ──────────────────────────────────
  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_cargo.localeCompare(b.nombre_cargo),
  )

  const nombreEntidad = (codigo: string | null | undefined) =>
    entidades.find((e) => e.codigo_entidad === codigo)?.nombre ?? codigo ?? '—'

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
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
          { titulo: tc('activo'), campo: 'activo', formato: (v: unknown) => (v ? tc('activo') : tc('inactivo')) },
        ]}
        excelNombreArchivo="cargos"
      />

      <TablaCrud
        columnas={[
          columnaNombre<Cargo>(t('colNombre'), (c) => c.nombre_cargo),
          { titulo: t('colAlias'), render: (c: Cargo) => c.alias || '—' },
          {
            titulo: t('colEntidad'),
            render: (c: Cargo) =>
              c.codigo_entidad ? (
                <span className="text-sm">{nombreEntidad(c.codigo_entidad)}</span>
              ) : (
                <Insignia variante="neutro">{t('todoElGrupo')}</Insignia>
              ),
          },
          columnaDescripcion<Cargo>(t('colDescripcion'), (c) => c.descripcion),
          columnaEstado<Cargo>((c) => c.activo),
          columnaCodigo<Cargo>(t('colCodigo'), (c) => c.codigo_cargo),
        ]}
        items={filtradosOrdenados}
        cargando={crud.cargando}
        getId={(c) => String(c.id_cargo)}
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
              ? (['datos', 'roles', 'prompt', 'system_prompt'] as const)
              : (['datos', 'prompt', 'system_prompt'] as const)
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
                {tab === 'datos' ? t('tabDatos') : tab === 'roles' ? t('tabRoles') : tab === 'prompt' ? 'Prompt' : 'System Prompt'}
              </button>
            ))}
          </div>

          {/* ── Tab Datos ─────────────────────────────────────────────────── */}
          {(tabActiva === 'datos' || !crud.editando) && (
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
                <p className="text-xs text-texto-muted">
                  {t('descEntidad')}
                </p>
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

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={crud.cerrarModal}>
                  {tc('cancelar')}
                </Boton>
                <Boton
                  variante="primario"
                  onClick={() => {
                    if (!crud.form.nombre_cargo.trim()) {
                      crud.setError(t('errorNombreObligatorio'))
                      return
                    }
                    crud.guardar()
                  }}
                  cargando={crud.guardando}
                >
                  {crud.editando ? tc('guardar') : tc('crear')}
                </Boton>
              </div>
            </div>
          )}

          {/* ── Tab Prompt ────────────────────────────────────────────────── */}
          {tabActiva === 'prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Texto que se inyecta en el prompt del LLM para dar contexto específico a este cargo. Se usa en clasificación de documentos y análisis.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Este cargo gestiona documentos de contratación pública..."
                value={crud.form.prompt}
                onChange={(e) => crud.updateForm('prompt', e.target.value)}
              />
            </div>
          )}

          {/* ── Tab System Prompt ─────────────────────────────────────────── */}
          {tabActiva === 'system_prompt' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">
                Instrucciones de sistema que se prependen a todas las conversaciones y análisis LLM en este contexto. Define el tono, restricciones y rol del asistente.
              </p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Eres un asistente especializado en gestión documental para este cargo..."
                value={crud.form.system_prompt}
                onChange={(e) => crud.updateForm('system_prompt', e.target.value)}
              />
            </div>
          )}

          {/* ── Tab Roles ─────────────────────────────────────────────────── */}
          {tabActiva === 'roles' && crud.editando && (
            <div className="flex flex-col gap-4">
              {/* Selector buscable de roles */}
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

              {/* Lista de roles asignados */}
              {cargandoRoles ? (
                <p className="text-sm text-texto-muted">{t('cargandoRoles')}</p>
              ) : rolesCargo.length === 0 ? (
                <p className="text-sm text-texto-muted italic">
                  {t('sinRoles')}
                </p>
              ) : (
                <Tabla>
                  <TablaCabecera>
                    <tr>
                      <TablaTh>{t('colRol')}</TablaTh>
                      <TablaTh></TablaTh>
                      <TablaTh alineacion="derecha">{t('colOrden')}</TablaTh>
                      <TablaTh alineacion="derecha">{t('colAccion')}</TablaTh>
                    </tr>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {[...rolesCargo]
                      .sort((a, b) => a.orden - b.orden)
                      .map((rc, idx, arr) => (
                        <TablaFila key={rc.id_rol}>
                          <TablaTd>
                            <span className="font-medium text-sm">
                              {rc.roles?.nombre ?? `Rol ${rc.id_rol}`}
                            </span>
                          </TablaTd>
                          <TablaTd>
                            {rc.roles?.codigo_grupo == null && (
                              <Insignia variante="secundario">{t('global')}</Insignia>
                            )}
                          </TablaTd>
                          <TablaTd alineacion="derecha">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => moverRol(idx, 'arriba')}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-primario/10 disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => moverRol(idx, 'abajo')}
                                disabled={idx === arr.length - 1}
                                className="p-1 rounded hover:bg-primario/10 disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                          </TablaTd>
                          <TablaTd alineacion="derecha">
                            <Boton
                              variante="peligro"
                              tamano="sm"
                              onClick={() => quitarRol(rc.id_rol)}
                            >
                              {t('quitar')}
                            </Boton>
                          </TablaTd>
                        </TablaFila>
                      ))}
                  </TablaCuerpo>
                </Tabla>
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
