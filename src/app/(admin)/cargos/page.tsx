'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ChevronDown, ChevronRight, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { cargosAdminApi, cargosApi, entidadesApi, promptsApi, rolesApi } from '@/lib/api'
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
  codigo_cargo_superior: string
  prompt_insert: string
  prompt_update: string
  system_prompt: string
  python_insert: string
  python_update: string
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
        codigo_cargo_superior: f.codigo_cargo_superior || undefined,
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
      cargosApi.actualizar(id, {
        nombre_cargo: (f.nombre_cargo ?? '').trim(),
        alias: (f.alias ?? '').trim() || undefined,
        descripcion: (f.descripcion ?? '').trim() || undefined,
        codigo_entidad: f.codigo_entidad,
        codigo_cargo_superior: f.codigo_cargo_superior ?? '',
        prompt_insert: (f.prompt_insert ?? '').trim() || undefined,
        prompt_update: (f.prompt_update ?? '').trim() || undefined,
        system_prompt: (f.system_prompt ?? '').trim() || undefined,
        python_insert: (f.python_insert ?? '').trim() || undefined,
        python_update: (f.python_update ?? '').trim() || undefined,
        javascript: (f.javascript ?? '').trim() || undefined,
        python_editado_manual: f.python_editado_manual,
        javascript_editado_manual: f.javascript_editado_manual,
      } as Record<string, unknown>),
    eliminarFn: async (id: string) => { await cargosApi.eliminar(id) },
    getId: (c) => c.codigo_cargo,
    camposBusqueda: (c) => [c.codigo_cargo, c.nombre_cargo, c.alias],
    formInicial: { codigo_cargo: '', nombre_cargo: '', alias: '', descripcion: '', codigo_entidad: '', codigo_cargo_superior: '', prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false },
    itemToForm: (c) => {
      const c2 = c as unknown as Record<string, unknown>
      return {
        codigo_cargo: c.codigo_cargo,
        nombre_cargo: c.nombre_cargo,
        alias: c.alias ?? '',
        descripcion: c.descripcion ?? '',
        codigo_entidad: c.codigo_entidad ?? '',
        codigo_cargo_superior: c.codigo_cargo_superior ?? '',
        prompt_insert: c2.prompt_insert as string ?? '',
        prompt_update: c2.prompt_update as string ?? '',
        system_prompt: c.system_prompt ?? '',
        python_insert: c2.python_insert as string || '',
        python_update: c2.python_update as string || '',
        javascript: c2.javascript as string || '',
        python_editado_manual: c2.python_editado_manual as boolean || false,
        javascript_editado_manual: c2.javascript_editado_manual as boolean || false,
      }
    },
  })

  // ── Tab activa en el modal ──────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<'datos' | 'roles' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [md, setMd] = useState('')

  const abrirNuevo = () => { setTabActiva('datos'); setMensajeMd(null); setMd(''); crud.abrirNuevo() }
  const abrirEditar = (c: Cargo) => {
    setTabActiva('datos')
    setRolesCargo([])
    setMensajeMd(null)
    setMd((c as unknown as Record<string, unknown>).md as string || '')
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

  // ── Árbol jerárquico ───────────────────────────────────────────────────────
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const toggleExpandir = (codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const expandirTodos = () => {
    setExpandidos(new Set(crud.items.map((c) => c.codigo_cargo)))
  }

  const colapsarTodos = () => setExpandidos(new Set())

  const tieneHijos = (codigo: string) =>
    crud.items.some((c) => c.codigo_cargo_superior === codigo)

  // Cargos elegibles como superior (excluye descendientes del cargo en edición)
  const opcionesPadre = (excluirCodigo?: string): Cargo[] => {
    if (!excluirCodigo) return crud.items
    const descendientes = new Set<string>([excluirCodigo])
    const buscar = (cod: string) => {
      for (const c of crud.items) {
        if (c.codigo_cargo_superior === cod && !descendientes.has(c.codigo_cargo)) {
          descendientes.add(c.codigo_cargo)
          buscar(c.codigo_cargo)
        }
      }
    }
    buscar(excluirCodigo)
    return crud.items.filter((c) => !descendientes.has(c.codigo_cargo))
  }

  // ── Lista ordenada ──────────────────────────────────────────────────────────
  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_cargo.localeCompare(b.nombre_cargo),
  )

  const nombreEntidad = (codigo: string | null | undefined) => {
    if (!codigo) return null
    return entidades.find((e) => e.codigo_entidad === codigo)?.nombre ?? codigo
  }

  // ── Render de un nodo del árbol (estilo /ubicaciones-docs) ─────────────────
  const renderNodo = (c: Cargo, nivel: number) => {
    const hijos = tieneHijos(c.codigo_cargo)
    const expandido = expandidos.has(c.codigo_cargo)
    const indent = nivel * 24
    const nombreEnt = nombreEntidad(c.codigo_entidad)

    return (
      <div key={c.codigo_cargo}>
        <div
          className="flex items-center gap-2 px-3 py-1 bg-amber-50 hover:bg-amber-100 rounded group transition-colors"
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          <button
            onClick={() => toggleExpandir(c.codigo_cargo)}
            className={`p-0.5 rounded transition-colors ${hijos ? 'hover:bg-primario-muy-claro text-texto-muted hover:text-primario' : 'invisible'}`}
          >
            {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandido && hijos ? (
            <FolderOpen size={14} className="text-amber-500 shrink-0" />
          ) : (
            <Folder size={14} className="text-amber-500 shrink-0" />
          )}

          <div className="flex-1 min-w-0 truncate cursor-pointer" title={`${c.nombre_cargo} (${c.codigo_cargo})`} onDoubleClick={() => abrirEditar(c)}>
            <span className="font-medium text-xs">{c.nombre_cargo}</span>
            {c.alias && <span className="text-xs text-texto-muted ml-2">{c.alias}</span>}
            <span className="text-xs text-texto-muted ml-2">({c.codigo_cargo})</span>
          </div>

          {nombreEnt ? (
            <span className="text-xs text-texto-muted truncate max-w-[200px] shrink-0 hidden lg:block" title={nombreEnt}>
              {nombreEnt}
            </span>
          ) : (
            <Insignia variante="neutro">{t('todoElGrupo')}</Insignia>
          )}

          <div className="flex items-center gap-0.5 shrink-0 transition-opacity">
            <button
              onClick={() => abrirEditar(c)}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title={tc('editar')}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => crud.setConfirmacion(c)}
              className="p-1.5 rounded-lg hover:bg-orange-50 text-texto-muted hover:text-orange-500 transition-colors"
              title={tc('eliminar')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {expandido &&
          crud.items
            .filter((h) => h.codigo_cargo_superior === c.codigo_cargo)
            .sort((a, b) => a.nombre_cargo.localeCompare(b.nombre_cargo))
            .map((h) => renderNodo(h, nivel + 1))}
      </div>
    )
  }

  // Raíces respetando filtro de búsqueda. Si hay búsqueda, aplanar todo.
  const codigosFiltrados = new Set(filtradosOrdenados.map((c) => c.codigo_cargo))
  const hayBusqueda = crud.busqueda.trim().length > 0
  const raices = hayBusqueda
    ? filtradosOrdenados
    : crud.items
        .filter((c) => !c.codigo_cargo_superior && codigosFiltrados.has(c.codigo_cargo))
        .sort((a, b) => a.nombre_cargo.localeCompare(b.nombre_cargo))

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
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
        </div>
        <Boton variante="contorno" className="h-[38px]" onClick={expandirTodos} disabled={crud.items.length === 0}>
          Expandir todo
        </Boton>
        <Boton variante="contorno" className="h-[38px]" onClick={colapsarTodos} disabled={expandidos.size === 0}>
          Colapsar todo
        </Boton>
      </div>

      {/* Árbol jerárquico */}
      <div className="bg-surface rounded-lg border border-borde p-2 flex flex-col gap-1 min-h-[200px]">
        {crud.cargando ? (
          <div className="text-center text-texto-muted py-8 text-sm">{tc('cargando')}…</div>
        ) : raices.length === 0 ? (
          <div className="text-center text-texto-muted py-8 text-sm">{t('sinCargos')}</div>
        ) : hayBusqueda ? (
          // Vista plana cuando hay búsqueda
          raices.map((c) => renderNodo(c, 0))
        ) : (
          raices.map((c) => renderNodo(c, 0))
        )}
      </div>

      {/* ── Modal crear/editar ─────────────────────────────────────────────── */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? t('editarTitulo', { nombre: crud.editando.nombre_cargo }) : t('nuevoTitulo')}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-0 min-w-[520px] min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde mb-4">
            {(crud.editando
              ? (['datos', 'roles', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as const)
              : (['datos', 'system_prompt', 'programacion_insert', 'programacion_update'] as const)
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabActiva(tab)}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  tabActiva === tab
                    ? 'border-b-2 border-primario text-primario'
                    : 'text-texto-muted hover:text-texto'
                }`}
              >
                {tab === 'datos'
                  ? t('tabDatos')
                  : tab === 'roles'
                  ? t('tabRoles')
                  : tab === 'system_prompt'
                  ? t('tabSystemPrompt')
                  : tab === 'programacion_insert'
                  ? 'Prog. Insert'
                  : tab === 'programacion_update'
                  ? 'Prog. Update'
                  : '.md'}
              </button>
            ))}
          </div>

          {/* ── Tab Datos ─────────────────────────────────────────────────── */}
          {tabActiva === 'datos' && (
            <div className="flex flex-col gap-4 min-h-[500px]">
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

                {/* Selector de entidad */}
                <div className="flex flex-col gap-1 sm:col-span-2">
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

                {/* Selector de cargo superior */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-sm font-medium text-texto">Cargo superior</label>
                  <select
                    className={selectClass}
                    value={crud.form.codigo_cargo_superior}
                    onChange={(e) => crud.updateForm('codigo_cargo_superior', e.target.value)}
                  >
                    <option value="">— Sin superior (raíz) —</option>
                    {opcionesPadre(crud.editando?.codigo_cargo)
                      .sort((a, b) => a.nombre_cargo.localeCompare(b.nombre_cargo))
                      .map((c) => (
                        <option key={c.codigo_cargo} value={c.codigo_cargo}>
                          {c.nombre_cargo} ({c.codigo_cargo})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-texto-muted">Cargo padre en la jerarquía. Vacío = nivel raíz.</p>
                </div>

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

              <div className="mt-auto">
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
            <div className="flex flex-col gap-4 min-h-[500px]">
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
              <div className="mt-auto">
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
                    />
                  ) : undefined}
                />
              </div>
            </div>
          )}

          {/* ── Tab Programación Insert ──────────────────────────────────────────── */}
          {tabActiva === 'programacion_insert' && (
            <div className="flex flex-col gap-4 min-h-[500px]">
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
              <div className="mt-auto">
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
                    />
                  ) : undefined}
                />
              </div>
            </div>
          )}
          {/* ── Tab Programación Update ──────────────────────────────────────────── */}
          {tabActiva === 'programacion_update' && (
            <div className="flex flex-col gap-4 min-h-[500px]">
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
              <div className="mt-auto">
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
                    />
                  ) : undefined}
                />
              </div>
            </div>
          )}

          {/* ── Tab .md ──────────────────────────────────────────────────── */}
          {tabActiva === 'md' && crud.editando && (
            <div className="flex flex-col gap-4 min-h-[500px]">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={md}
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
              <div className="mt-auto flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMd(true); setMensajeMd(null)
                      try {
                        const r = await cargosAdminApi.generarMd(crud.editando!.codigo_cargo)
                        setMd(r.md)
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
                      setSincronizandoMd(true); setMensajeMd(null)
                      try {
                        const r = await promptsApi.sincronizarFila('cargos', 'codigo_cargo', crud.editando!.codigo_cargo)
                        setMensajeMd({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMd(false) }
                    }}
                    cargando={sincronizandoMd}
                    disabled={generandoMd || sincronizandoMd || !md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={crud.cerrarModal}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {/* ── Tab Roles ─────────────────────────────────────────────────── */}
          {tabActiva === 'roles' && crud.editando && (
            <div className="flex flex-col gap-4 min-h-[500px]">
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
