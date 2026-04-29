'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
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
import { SortableDndContext, SortableListItem } from '@/components/ui/sortable'
import { cargosAdminApi, rolesApi, promptsApi } from '@/lib/api'
import type { Cargo, RolCargo, Rol } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'
import { BotonChat } from '@/components/ui/boton-chat'

type FormCargo = {
  codigo_cargo: string
  nombre_cargo: string
  alias: string
  descripcion: string
  prompt_insert: string
  prompt_update: string
  system_prompt: string
  python_insert: string
  python_update: string
  javascript: string
  python_editado_manual: boolean
  javascript_editado_manual: boolean
  md: string
}

type TabModal = 'datos' | 'roles' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'

export default function PaginaCargosAdmin() {
  const t = useTranslations('cargos')
  const tc = useTranslations('common')

  const [roles, setRoles] = useState<Rol[]>([])

  useEffect(() => {
    rolesApi.listar().then(setRoles).catch(() => {})
  }, [])

  const crud = useCrudPage<Cargo, FormCargo>({
    cargarFn: () => cargosAdminApi.listar(),
    crearFn: (f) =>
      cargosAdminApi.crear({
        codigo_cargo: f.codigo_cargo.trim() || undefined,
        nombre_cargo: f.nombre_cargo.trim(),
        alias: f.alias.trim() || undefined,
        descripcion: f.descripcion.trim() || undefined,
        prompt_insert: f.prompt_insert.trim() || undefined,
        prompt_update: f.prompt_update.trim() || undefined,
        system_prompt: f.system_prompt.trim() || undefined,
        python_insert: f.python_insert.trim() || undefined,
        python_update: f.python_update.trim() || undefined,
        javascript: f.javascript.trim() || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as Record<string, unknown>),
    actualizarFn: (id, f) =>
      cargosAdminApi.actualizar(id, {
        nombre_cargo: (f.nombre_cargo ?? '').trim(),
        alias: (f.alias ?? '').trim() || undefined,
        descripcion: (f.descripcion ?? '').trim() || undefined,
        prompt_insert: (f.prompt_insert ?? '').trim() || undefined,
        prompt_update: (f.prompt_update ?? '').trim() || undefined,
        system_prompt: (f.system_prompt ?? '').trim() || undefined,
        python_insert: (f.python_insert ?? '').trim() || undefined,
        python_update: (f.python_update ?? '').trim() || undefined,
        javascript: (f.javascript ?? '').trim() || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as Record<string, unknown>),
    eliminarFn: async (id: string) => { await cargosAdminApi.eliminar(id) },
    getId: (c) => c.codigo_cargo,
    camposBusqueda: (c) => [c.codigo_cargo, c.nombre_cargo, c.alias],
    formInicial: { codigo_cargo: '', nombre_cargo: '', alias: '', descripcion: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false, md: '' },
    itemToForm: (c) => {
      const c2 = c as unknown as Record<string, unknown>
      return {
        codigo_cargo: c.codigo_cargo,
        nombre_cargo: c.nombre_cargo,
        alias: c.alias ?? '',
        descripcion: c.descripcion ?? '',
        prompt_insert: c2.prompt_insert as string ?? '',
        prompt_update: c2.prompt_update as string ?? '',
        system_prompt: c.system_prompt ?? '',
        python_insert: c2.python_insert as string || '',
        python_update: c2.python_update as string || '',
        javascript: c2.javascript as string || '',
        python_editado_manual: c2.python_editado_manual as boolean || false,
        javascript_editado_manual: c2.javascript_editado_manual as boolean || false,
        md: (c2.md as string) || '',
      }
    },
  })

  const [tabActiva, setTabActiva] = useState<TabModal>('datos')

  const abrirNuevo = () => { setTabActiva('datos'); crud.abrirNuevo() }
  const abrirEditar = (c: Cargo) => {
    setTabActiva('datos')
    setRolesCargo([])
    setMensajeMd(null)
    crud.abrirEditar(c)
    cargarRolesCargo(c.codigo_cargo)
  }

  // ── Roles del cargo ─────────────────────────────────────────────────────────
  const [rolesCargo, setRolesCargo] = useState<RolCargo[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [busquedaRol, setBusquedaRol] = useState('')
  const [rolNuevo, setRolNuevo] = useState<number | null>(null)
  const [asignandoRol, setAsignandoRol] = useState(false)
  const [errorRol, setErrorRol] = useState('')

  // ── .md ─────────────────────────────────────────────────────────────────────
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargarRolesCargo = useCallback(async (codigo_cargo: string) => {
    setCargandoRoles(true)
    try { setRolesCargo(await cargosAdminApi.listarRoles(codigo_cargo)) }
    catch { setRolesCargo([]) }
    finally { setCargandoRoles(false) }
  }, [])

  const rolesDisponibles = roles
    .filter(
      (r) =>
        r.codigo_grupo == null &&
        !rolesCargo.some((rc) => rc.id_rol === r.id_rol),
    )
    .sort((a, b) => {
      const na = a.codigo_aplicacion_origen ?? '\uffff'
      const nb = b.codigo_aplicacion_origen ?? '\uffff'
      return na.localeCompare(nb) || a.nombre.localeCompare(b.nombre)
    })

  const rolesFiltrados = rolesDisponibles.filter(
    (r) =>
      busquedaRol.length === 0 ||
      r.nombre.toLowerCase().includes(busquedaRol.toLowerCase()) ||
      r.codigo_rol.toLowerCase().includes(busquedaRol.toLowerCase()),
  )

  const asignarRol = async () => {
    if (!rolNuevo || !crud.editando) return
    setAsignandoRol(true)
    setErrorRol('')
    try {
      await cargosAdminApi.asignarRol(crud.editando.codigo_cargo, rolNuevo)
      setRolNuevo(null)
      setBusquedaRol('')
      await cargarRolesCargo(crud.editando.codigo_cargo)
    } catch (e) { setErrorRol(e instanceof Error ? e.message : t('errorAlAsignarRol')) }
    finally { setAsignandoRol(false) }
  }

  const quitarRol = async (id_rol: number) => {
    if (!crud.editando) return
    setErrorRol('')
    try {
      await cargosAdminApi.quitarRol(crud.editando.codigo_cargo, id_rol)
      await cargarRolesCargo(crud.editando.codigo_cargo)
    } catch (e) { setErrorRol(e instanceof Error ? e.message : t('errorAlQuitarRol')) }
  }

  const reordenarRolesCargo = async (nuevos: typeof rolesCargo) => {
    setRolesCargo(nuevos)
    try { await cargosAdminApi.reordenarRoles(crud.editando!.codigo_cargo, nuevos.map(r => ({ id_rol: r.id_rol, orden: r.orden ?? 0 }))) }
    catch { if (crud.editando) cargarRolesCargo(crud.editando.codigo_cargo) }
  }

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_cargo.localeCompare(b.nombre_cargo),
  )

  const TABS_MODAL: { key: TabModal; label: string }[] = [
    { key: 'datos', label: t('tabDatos') },
    ...(crud.editando ? [
      { key: 'roles' as TabModal, label: `${t('tabRoles')} (${rolesCargo.length})` },
      { key: 'system_prompt' as TabModal, label: t('tabSystemPrompt') },
      { key: 'programacion_insert' as TabModal, label: 'Prog. Insert' },
      { key: 'programacion_update' as TabModal, label: 'Prog. Update' },
      { key: 'md' as TabModal, label: '.md' },
    ] : []),
  ]

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">Cargos ServerLM</h2>
        <p className="text-sm text-texto-muted mt-1">Cargos SISTEMA globales (sin grupo).</p>
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
          { titulo: t('colDescripcion'), campo: 'descripcion' },
        ]}
        excelNombreArchivo="cargos-admin"
      />

      <TablaCrud
        columnas={[
          columnaNombre<Cargo>(t('colNombre'), (c) => c.nombre_cargo),
          { titulo: t('colAlias'), render: (c: Cargo) => c.alias || '—' },
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

      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? t('editarTitulo', { nombre: crud.editando.nombre_cargo }) : t('nuevoTitulo')}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-0 min-w-[520px] min-h-[420px]">
          {/* Tabs */}
          <div className="flex border-b border-borde mb-4 -mx-1 overflow-x-auto">
            {TABS_MODAL.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTabActiva(tab.key)}
                className={`flex-1 text-center px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  tabActiva === tab.key
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab Datos ─────────────────────────────────────────────────── */}
          {tabActiva === 'datos' && (
            <div className="flex flex-col gap-4 min-h-[420px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {crud.editando && (
                  <div className="sm:col-span-2">
                    <Input etiqueta={t('etiquetaCodigo')} value={crud.form.codigo_cargo} onChange={() => {}} disabled />
                  </div>
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

                <div className="sm:col-span-2">
                  <Textarea
                    etiqueta={t('etiquetaDescripcion')}
                    value={crud.form.descripcion}
                    onChange={(e) => crud.updateForm('descripcion', e.target.value)}
                    placeholder={t('placeholderDescripcion')}
                    rows={3}
                  />
                </div>
              </div>

              {crud.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{crud.error}</p>
                </div>
              )}

              <div className="mt-auto mb-20">
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
            </div>
          )}

          {/* ── Tab System Prompt ─────────────────────────────────────────── */}
          {tabActiva === 'system_prompt' && (
            <div className="flex flex-col gap-4 min-h-[420px]">
              <TabPrompts
                tabla="cargos"
                pkColumna="codigo_cargo"
                pkValor={crud.editando?.codigo_cargo ?? null}
                campos={crud.form}
                onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormCargo, valor as string | boolean)}
                mostrarPromptInsert={false}
                mostrarPromptUpdate={false}
                mostrarSystemPrompt={true}
                mostrarPythonInsert={false}
                mostrarPythonUpdate={false}
                mostrarJavaScript={false}
              />
              <div className="mt-auto mb-20">
                <PieBotonesModal
                  editando={!!crud.editando}
                  onGuardar={() => crud.guardar(undefined, undefined, { cerrar: false })}
                  onGuardarYSalir={() => crud.guardar(undefined, undefined, { cerrar: true })}
                  onCerrar={crud.cerrarModal}
                  cargando={crud.guardando}
                />
              </div>
            </div>
          )}

          {/* ── Tab Programación Insert ──────────────────────────────────────────── */}
          {tabActiva === 'programacion_insert' && (
            <div className="flex flex-col gap-4 min-h-[420px]">
              <TabPrompts
                tabla="cargos"
                pkColumna="codigo_cargo"
                pkValor={crud.editando?.codigo_cargo ?? null}
                campos={crud.form}
                onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormCargo, valor as string | boolean)}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
              <div className="mt-auto mb-20">
                <PieBotonesModal
                  editando={!!crud.editando}
                  onGuardar={() => crud.guardar(undefined, undefined, { cerrar: false })}
                  onGuardarYSalir={() => crud.guardar(undefined, undefined, { cerrar: true })}
                  onCerrar={crud.cerrarModal}
                  cargando={crud.guardando}
                  botonesIzquierda={crud.editando ? (
                    <PieBotonesPrompts
                      tabla="cargos"
                      pkColumna="codigo_cargo"
                      pkValor={crud.editando.codigo_cargo}
                      promptInsert={crud.form.prompt_insert || undefined}
                      promptUpdate={crud.form.prompt_update || undefined}
                      mostrarSincronizar={false}
                    />
                  ) : undefined}
                />
              </div>
            </div>
          )}

          {/* ── Tab Programación Update ──────────────────────────────────────────── */}
          {tabActiva === 'programacion_update' && (
            <div className="flex flex-col gap-4 min-h-[420px]">
              <TabPrompts
                tabla="cargos"
                pkColumna="codigo_cargo"
                pkValor={crud.editando?.codigo_cargo ?? null}
                campos={crud.form}
                onCampoCambiado={(campo, valor) => crud.updateForm(campo as keyof FormCargo, valor as string | boolean)}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
              <div className="mt-auto mb-20">
                <PieBotonesModal
                  editando={!!crud.editando}
                  onGuardar={() => crud.guardar(undefined, undefined, { cerrar: false })}
                  onGuardarYSalir={() => crud.guardar(undefined, undefined, { cerrar: true })}
                  onCerrar={crud.cerrarModal}
                  cargando={crud.guardando}
                  botonesIzquierda={crud.editando ? (
                    <PieBotonesPrompts
                      tabla="cargos"
                      pkColumna="codigo_cargo"
                      pkValor={crud.editando.codigo_cargo}
                      promptInsert={crud.form.prompt_insert || undefined}
                      promptUpdate={crud.form.prompt_update || undefined}
                      mostrarSincronizar={false}
                    />
                  ) : undefined}
                />
              </div>
            </div>
          )}

          {/* ── Tab Roles (idéntico a /roles-generales) ─────────────────────────── */}
          {tabActiva === 'roles' && crud.editando && (
            <div className="flex flex-col gap-3 min-h-[420px]">
              {/* Asignar nuevo rol */}
              <div>
                <label className="text-sm font-medium text-texto">{t('agregarRol')}</label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 relative">
                    <Input
                      placeholder={t('buscarRolPlaceholder')}
                      value={busquedaRol}
                      onChange={(e) => { setBusquedaRol(e.target.value); setRolNuevo(null) }}
                      icono={<Search size={14} />}
                    />
                    {busquedaRol.length > 0 && !rolNuevo && (
                      <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-borde bg-surface shadow-lg">
                        {rolesFiltrados.length === 0 ? (
                          <div className="p-2 text-xs text-texto-muted">Sin resultados</div>
                        ) : (
                          rolesFiltrados.slice(0, 20).map((r) => (
                            <button
                              key={r.id_rol}
                              type="button"
                              onClick={() => {
                                setRolNuevo(r.id_rol)
                                setBusquedaRol(r.nombre)
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primario-muy-claro border-b border-borde/50 last:border-0"
                            >
                              <div className="font-medium">{r.nombre}</div>
                              <div className="text-xs text-texto-muted font-mono">{r.codigo_rol}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <Boton
                    variante="primario"
                    tamano="sm"
                    onClick={asignarRol}
                    disabled={!rolNuevo || asignandoRol}
                  >
                    <Plus size={14} />
                    Asignar
                  </Boton>
                </div>
              </div>

              {/* Listado actual */}
              <div className="border border-borde rounded-lg overflow-hidden">
                {cargandoRoles ? (
                  <div className="p-4 text-sm text-texto-muted text-center">{t('cargandoRoles')}</div>
                ) : rolesCargo.length === 0 ? (
                  <div className="p-4 text-sm text-texto-muted text-center">{t('sinRoles')}</div>
                ) : (
                  <SortableDndContext
                    items={[...rolesCargo].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)) as unknown as Record<string, unknown>[]}
                    getId={(r) => String((r as { id_rol: number }).id_rol)}
                    onReorder={(n) => reordenarRolesCargo(n as unknown as typeof rolesCargo)}
                  >
                    <ul className="divide-y divide-borde">
                      {[...rolesCargo]
                        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                        .map((rc) => (
                          <SortableListItem
                            key={rc.id_rol}
                            id={String(rc.id_rol)}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fondo"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {rc.roles?.nombre_rol ?? `Rol ${rc.id_rol}`}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => quitarRol(rc.id_rol)}
                              className="p-1 rounded text-texto-muted hover:text-error hover:bg-red-50"
                              title={t('quitar')}
                            >
                              <X size={16} />
                            </button>
                          </SortableListItem>
                        ))}
                    </ul>
                  </SortableDndContext>
                )}
              </div>

              {errorRol && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-error">{errorRol}</p>
                </div>
              )}

              <div className="mt-auto mb-20 flex justify-end">
                <Boton variante="contorno" onClick={crud.cerrarModal}>
                  {tc('cerrar')}
                </Boton>
              </div>
            </div>
          )}

          {/* ── Tab .md ────────────────────────────────────────────────────── */}
          {tabActiva === 'md' && crud.editando && (
            <div className="flex flex-col gap-3 min-h-[420px]">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={crud.form.md || ''}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMd && (
                <p className={`text-xs px-1 ${mensajeMd.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMd.texto}
                </p>
              )}
              <div className="mt-auto mb-20 flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      if (!crud.editando) return
                      setGenerandoMd(true); setMensajeMd(null)
                      try {
                        const r = await cargosAdminApi.generarMd(crud.editando.codigo_cargo)
                        crud.updateForm('md', r.md)
                        setMensajeMd({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMd(false) }
                    }}
                    cargando={generandoMd}
                    disabled={generandoMd || sincronizandoMd}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      if (!crud.editando) return
                      setSincronizandoMd(true); setMensajeMd(null)
                      try {
                        const r = await promptsApi.sincronizarFila('cargos', 'codigo_cargo', crud.editando.codigo_cargo)
                        setMensajeMd({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMd(false) }
                    }}
                    cargando={sincronizandoMd}
                    disabled={generandoMd || sincronizandoMd || !crud.form.md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={crud.cerrarModal}>{tc('cerrar')}</Boton>
              </div>
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
