'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, X, Download, Search, Brain } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaTh, TablaTd } from '@/components/ui/tabla'
import { SortableDndContext, SortableRow, SortableListItem } from '@/components/ui/sortable'
import { rolesApi, funcionesApi, aplicacionesApi, registroLLMApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Rol, Funcion, Aplicacion, RegistroLLM } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { etiquetaTipo, varianteTipo, normalizarTipo, type TipoElemento } from '@/lib/tipo-elemento'
import { useTipoAccesoGrafo } from '@/hooks/useTipoAccesoGrafo'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'

type FuncionAsignada = { codigo_funcion: string; orden: number; funciones: { nombre_funcion: string } }

export default function PaginaRoles() {
  const t = useTranslations('roles')
  const tc = useTranslations('common')
  const { grupoActivo, aplicacionActiva, usuario } = useAuth()
  const { esDescendiente, tiposVisibles } = useTipoAccesoGrafo()
  const [roles, setRoles] = useState<Rol[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [tabActiva, setTabActiva] = useState<'roles' | 'funciones'>('roles')
  const [busquedaRoles, setBusquedaRoles] = useState('')
  const [busquedaFunciones, setBusquedaFunciones] = useState('')

  // Modal rol
  const [modalRol, setModalRol] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [formRol, setFormRol] = useState({
    codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '',
    funcion_por_defecto: '', codigo_aplicacion_origen: '', tipo_acceso: 'USUARIO' as TipoElemento,
    prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '',
    javascript: '', python_editado_manual: false, javascript_editado_manual: false,
    inicial: false, inicial_admin_grupo: false, inicial_admin_general: false,
    md: '',
  })
  const [tabModalRol, setTabModalRol] = useState<'datos' | 'funciones' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')

  // Funciones del rol en edición
  const [funcionesRol, setFuncionesRol] = useState<FuncionAsignada[]>([])
  const [cargandoFunciones, setCargandoFunciones] = useState(false)
  const [funcionNueva, setFuncionNueva] = useState('')
  const [asignandoFuncion, setAsignandoFuncion] = useState(false)
  const [busquedaFuncionRol, setBusquedaFuncionRol] = useState('')
  const [dropdownFuncionRolAbierto, setDropdownFuncionRolAbierto] = useState(false)
  const dropdownFuncionRolRef = useRef<HTMLDivElement>(null)

  // Modal función
  const [modalFuncion, setModalFuncion] = useState(false)
  const [funcionEditando, setFuncionEditando] = useState<Funcion | null>(null)
  const [formFuncion, setFormFuncion] = useState({
    codigo_funcion: '', nombre: '', descripcion: '', url_funcion: '',
    alias_de_funcion: '', icono_de_funcion: '',
    id_modelo: '' as string,
    system_prompt: '',
    codigo_aplicacion_origen: '',
  })
  const [tabModalFuncion, setTabModalFuncion] = useState<'datos' | 'aplicaciones' | 'llm'>('datos')
  const [modelosLLM, setModelosLLM] = useState<RegistroLLM[]>([])

  // Aplicaciones de la función en edición
  const [todasApps, setTodasApps] = useState<Aplicacion[]>([])
  const [appsFuncion, setAppsFuncion] = useState<{ codigo_aplicacion: string }[]>([])
  const [cargandoApps, setCargandoApps] = useState(false)
  const [appNueva, setAppNueva] = useState('')
  const [asignandoApp, setAsignandoApp] = useState(false)

  // Modal confirmar eliminación
  const [confirmacion, setConfirmacion] = useState<{ tipo: 'rol' | 'funcion'; item: Rol | Funcion } | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [r, f, a, llms] = await Promise.all([
        rolesApi.listar(),
        funcionesApi.listar(grupoActivo || undefined),
        aplicacionesApi.listar(),
        registroLLMApi.listar().catch(() => [] as RegistroLLM[]),
      ])
      setRoles(r)
      setFunciones(f)
      setTodasApps(a)
      setModelosLLM(llms)
    } finally {
      setCargando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  useEffect(() => { cargar() }, [cargar])

  // Cerrar dropdown de función al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownFuncionRolRef.current && !dropdownFuncionRolRef.current.contains(e.target as Node)) {
        setDropdownFuncionRolAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const cargarFuncionesRol = useCallback(async (idRol: number) => {
    setCargandoFunciones(true)
    try {
      const f = await rolesApi.listarFunciones(idRol)
      setFuncionesRol(f)
    } catch {
      setFuncionesRol([])
    } finally {
      setCargandoFunciones(false)
    }
  }, [])

  const abrirNuevoRol = () => {
    setRolEditando(null)
    setFormRol({
      codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '',
      funcion_por_defecto: '', codigo_aplicacion_origen: aplicacionActiva || '', tipo_acceso: 'USUARIO',
      prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '',
      javascript: '', python_editado_manual: false, javascript_editado_manual: false,
      inicial: false, inicial_admin_grupo: false, inicial_admin_general: false,
      md: '',
    })
    setError('')
    setTabModalRol('datos')
    setModalRol(true)
  }

  const abrirEditarRol = (r: Rol, tabInicial: typeof tabModalRol = 'datos') => {
    setRolEditando(r)
    const r2 = r as unknown as Record<string, unknown>
    setFormRol({
      codigo_rol: r.codigo_rol,
      nombre: r.nombre,
      alias_de_rol: r.alias_de_rol || '',
      descripcion: r.descripcion || '',
      url_inicio: r.url_inicio || '',
      funcion_por_defecto: r.funcion_por_defecto || '',
      codigo_aplicacion_origen: r.codigo_aplicacion_origen || '',
      tipo_acceso: normalizarTipo(r.tipo_acceso),
      prompt_insert: r2.prompt_insert as string || '',
      prompt_update: r2.prompt_update as string || '',
      system_prompt: r2.system_prompt as string || '',
      python_insert: r2.python_insert as string || '',
      python_update: r2.python_update as string || '',
      javascript: r2.javascript as string || '',
      python_editado_manual: (r2.python_editado_manual as boolean) ?? false,
      javascript_editado_manual: (r2.javascript_editado_manual as boolean) ?? false,
      inicial: r.inicial ?? false,
      inicial_admin_grupo: (r2.inicial_admin_grupo as boolean) ?? false,
      inicial_admin_general: (r2.inicial_admin_general as boolean) ?? false,
      md: r2.md as string || '',
    })
    setError('')
    setTabModalRol(tabInicial)
    setFuncionNueva('')
    setBusquedaFuncionRol('')
    cargarFuncionesRol(r.id_rol)
    setModalRol(true)
  }

  const guardarRol = async (cerrar: boolean) => {
    const esGlobalCreate = !rolEditando && grupoActivo === 'ADMIN'
    if (!formRol.nombre || (esGlobalCreate && !formRol.codigo_rol)) {
      setError(esGlobalCreate ? 'Código y nombre son obligatorios para roles globales' : 'El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      const origen = formRol.codigo_aplicacion_origen || null
      if (rolEditando) {
        await rolesApi.actualizar(rolEditando.id_rol, {
          nombre: formRol.nombre,
          alias_de_rol: formRol.alias_de_rol || undefined,
          descripcion: formRol.descripcion,
          url_inicio: formRol.url_inicio,
          funcion_por_defecto: formRol.funcion_por_defecto || undefined,
          codigo_aplicacion_origen: origen,
          prompt_insert: formRol.prompt_insert || undefined,
          prompt_update: formRol.prompt_update || undefined,
          system_prompt: formRol.system_prompt || undefined,
          python_insert: formRol.python_insert || undefined,
          python_update: formRol.python_update || undefined,
          javascript: formRol.javascript || undefined,
          python_editado_manual: formRol.python_editado_manual,
          javascript_editado_manual: formRol.javascript_editado_manual,
          inicial: formRol.inicial,
          inicial_admin_grupo: formRol.inicial_admin_grupo,
          inicial_admin_general: formRol.inicial_admin_general,
          md: formRol.md || undefined,
        } as Record<string, unknown>)
      } else {
        const payload: Record<string, unknown> = {
          nombre: formRol.nombre,
          alias_de_rol: formRol.alias_de_rol || undefined,
          descripcion: formRol.descripcion,
          url_inicio: formRol.url_inicio,
          funcion_por_defecto: formRol.funcion_por_defecto || undefined,
          codigo_aplicacion_origen: origen,
          codigo_grupo: grupoActivo || 'ADMIN',
          inicial: formRol.inicial,
          inicial_admin_grupo: formRol.inicial_admin_grupo,
          inicial_admin_general: formRol.inicial_admin_general,
          tipo_acceso: formRol.tipo_acceso,
        }
        if (esGlobalCreate && formRol.codigo_rol) payload.codigo_rol = formRol.codigo_rol
        const nuevo = await rolesApi.crear(payload as Parameters<typeof rolesApi.crear>[0])
        if (!cerrar && nuevo) {
          setRolEditando(nuevo as Rol)
          const r2 = nuevo as unknown as Record<string, unknown>
          setFormRol({
            codigo_rol: (nuevo as Rol).codigo_rol,
            nombre: (nuevo as Rol).nombre,
            alias_de_rol: (nuevo as Rol).alias_de_rol || '',
            descripcion: (nuevo as Rol).descripcion || '',
            url_inicio: (nuevo as Rol).url_inicio || '',
            funcion_por_defecto: (nuevo as Rol).funcion_por_defecto || '',
            codigo_aplicacion_origen: (nuevo as Rol).codigo_aplicacion_origen || '',
            tipo_acceso: normalizarTipo((nuevo as Rol).tipo_acceso),
            prompt_insert: r2.prompt_insert as string || '',
            prompt_update: r2.prompt_update as string || '',
            system_prompt: r2.system_prompt as string || '',
            python_insert: r2.python_insert as string || '',
            python_update: r2.python_update as string || '',
            javascript: r2.javascript as string || '',
            python_editado_manual: (r2.python_editado_manual as boolean) ?? false,
            javascript_editado_manual: (r2.javascript_editado_manual as boolean) ?? false,
            inicial: (nuevo as Rol).inicial ?? false,
            inicial_admin_grupo: (r2.inicial_admin_grupo as boolean) ?? false,
            inicial_admin_general: (r2.inicial_admin_general as boolean) ?? false,
            md: r2.md as string || '',
          })
          cargarFuncionesRol((nuevo as Rol).id_rol)
        }
      }
      if (cerrar || rolEditando) {
        if (cerrar) setModalRol(false)
      }
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminarRol = (r: Rol) => setConfirmacion({ tipo: 'rol', item: r })

  const ejecutarEliminacion = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      if (confirmacion.tipo === 'rol') {
        await rolesApi.eliminar((confirmacion.item as Rol).id_rol)
      } else {
        await funcionesApi.eliminar((confirmacion.item as Funcion).codigo_funcion)
      }
      setConfirmacion(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
      setConfirmacion(null)
    } finally {
      setEliminando(false)
    }
  }

  const asignarFuncion = async () => {
    if (!funcionNueva || !rolEditando) return
    setAsignandoFuncion(true)
    try {
      await rolesApi.asignarFuncion(rolEditando.id_rol, funcionNueva)
      setFuncionNueva('')
      setBusquedaFuncionRol('')
      cargarFuncionesRol(rolEditando.id_rol)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar función')
    } finally {
      setAsignandoFuncion(false)
    }
  }

  const quitarFuncion = async (codigoFuncion: string) => {
    if (!rolEditando) return
    try {
      await rolesApi.quitarFuncion(rolEditando.id_rol, codigoFuncion)
      cargarFuncionesRol(rolEditando.id_rol)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar función')
    }
  }

  const reordenarFuncionesRol = async (nuevas: FuncionAsignada[]) => {
    setFuncionesRol(nuevas)
    try {
      await rolesApi.reordenarFunciones(rolEditando!.id_rol, nuevas.map((f) => ({
        codigo_funcion: f.codigo_funcion,
        orden: f.orden,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reordenar')
      cargarFuncionesRol(rolEditando!.id_rol)
    }
  }

  // Mapa codigo_aplicacion → nombre
  const mapaAppNombre = Object.fromEntries(todasApps.map((a) => [a.codigo_aplicacion, a.nombre]))
  const nombreApp = (codigo?: string | null) => (codigo ? (mapaAppNombre[codigo] || codigo) : '')
  const compararPorAppYNombre = <T extends { codigo_aplicacion_origen?: string | null; nombre: string }>(a: T, b: T) => {
    const na = nombreApp(a.codigo_aplicacion_origen); const nb = nombreApp(b.codigo_aplicacion_origen)
    const sa = na ? 0 : 1; const sb = nb ? 0 : 1
    if (sa !== sb) return sa - sb
    if (na !== nb) return na.localeCompare(nb)
    return a.nombre.localeCompare(b.nombre)
  }

  const reordenarRoles = async (nuevos: Rol[]) => {
    setRoles(nuevos)
    try {
      await rolesApi.reordenar(nuevos.map((r) => ({ id_rol: r.id_rol, orden: r.orden ?? 0 })))
    } catch {
      cargar()
    }
  }

  const rolesFiltrados = roles
    .filter((r) =>
      r.nombre.toLowerCase().includes(busquedaRoles.toLowerCase()) ||
      r.codigo_rol.toLowerCase().includes(busquedaRoles.toLowerCase()) ||
      (r.alias_de_rol || '').toLowerCase().includes(busquedaRoles.toLowerCase())
    )
    .sort(busquedaRoles ? compararPorAppYNombre : (a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  const funcionesFiltradas = funciones
    .filter((f) =>
      f.nombre.toLowerCase().includes(busquedaFunciones.toLowerCase()) ||
      f.codigo_funcion.toLowerCase().includes(busquedaFunciones.toLowerCase()) ||
      (f.alias_de_funcion || '').toLowerCase().includes(busquedaFunciones.toLowerCase())
    )
    .sort(compararPorAppYNombre)

  const funcionesDisponibles = (() => {
    const sinAsignar = funciones.filter((f) => !funcionesRol.some((fa) => fa.codigo_funcion === f.codigo_funcion))
    if (!rolEditando) return sinAsignar
    const tipoRol = normalizarTipo(rolEditando.tipo_acceso)
    return sinAsignar.filter((f) => esDescendiente(tipoRol, normalizarTipo(f.tipo_acceso)))
  })()

  const funcionesRolFiltradas = funcionesDisponibles.filter((f) =>
    busquedaFuncionRol.length === 0 ||
    f.nombre.toLowerCase().includes(busquedaFuncionRol.toLowerCase()) ||
    f.codigo_funcion.toLowerCase().includes(busquedaFuncionRol.toLowerCase())
  )

  const cargarAppsFuncion = useCallback(async (codigo: string) => {
    setCargandoApps(true)
    try {
      setAppsFuncion(await funcionesApi.listarAplicaciones(codigo))
    } catch { setAppsFuncion([]) }
    finally { setCargandoApps(false) }
  }, [])

  const asignarAppAFuncion = async () => {
    if (!appNueva || !funcionEditando) return
    setAsignandoApp(true)
    try {
      await funcionesApi.asignarAplicacion(funcionEditando.codigo_funcion, appNueva)
      setAppNueva('')
      cargarAppsFuncion(funcionEditando.codigo_funcion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar aplicación')
    } finally {
      setAsignandoApp(false)
    }
  }

  const quitarAppDeFuncion = async (codigoApp: string) => {
    if (!funcionEditando) return
    try {
      await funcionesApi.quitarAplicacion(funcionEditando.codigo_funcion, codigoApp)
      cargarAppsFuncion(funcionEditando.codigo_funcion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar aplicación')
    }
  }

  const appsDisponiblesFuncion = todasApps.filter((a) =>
    !appsFuncion.some((af) => af.codigo_aplicacion === a.codigo_aplicacion)
  )

  const abrirNuevaFuncion = () => {
    setFuncionEditando(null)
    setFormFuncion({ codigo_funcion: '', nombre: '', descripcion: '', url_funcion: '', alias_de_funcion: '', icono_de_funcion: '', id_modelo: '', system_prompt: '', codigo_aplicacion_origen: aplicacionActiva || '' })
    setError('')
    setTabModalFuncion('datos')
    setModalFuncion(true)
  }

  const abrirEditarFuncion = (f: Funcion) => {
    setFuncionEditando(f)
    setFormFuncion({
      codigo_funcion: f.codigo_funcion,
      nombre: f.nombre,
      descripcion: f.descripcion || '',
      url_funcion: f.url_funcion || '',
      alias_de_funcion: f.alias_de_funcion || '',
      icono_de_funcion: f.icono_de_funcion || '',
      id_modelo: f.id_modelo != null ? String(f.id_modelo) : '',
      system_prompt: f.system_prompt || '',
      codigo_aplicacion_origen: f.codigo_aplicacion_origen || '',
    })
    setError('')
    setTabModalFuncion('datos')
    cargarAppsFuncion(f.codigo_funcion)
    setModalFuncion(true)
  }

  const guardarFuncion = async (cerrar: boolean) => {
    if (!formFuncion.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      const payload: Partial<Funcion> = {
        nombre: formFuncion.nombre,
        descripcion: formFuncion.descripcion,
        url_funcion: formFuncion.url_funcion,
        alias_de_funcion: formFuncion.alias_de_funcion,
        icono_de_funcion: formFuncion.icono_de_funcion || undefined,
        id_modelo: formFuncion.id_modelo ? Number(formFuncion.id_modelo) : null,
        system_prompt: formFuncion.system_prompt || null,
        codigo_aplicacion_origen: formFuncion.codigo_aplicacion_origen || null,
      }
      if (funcionEditando) {
        await funcionesApi.actualizar(funcionEditando.codigo_funcion, payload)
      } else {
        const nueva = await funcionesApi.crear({ ...(formFuncion.codigo_funcion ? { codigo_funcion: formFuncion.codigo_funcion } : {}), ...payload })
        if (!cerrar && nueva) {
          const f = nueva as Funcion
          setFuncionEditando(f)
          setFormFuncion({
            codigo_funcion: f.codigo_funcion,
            nombre: f.nombre,
            descripcion: f.descripcion || '',
            url_funcion: f.url_funcion || '',
            alias_de_funcion: f.alias_de_funcion || '',
            icono_de_funcion: f.icono_de_funcion || '',
            id_modelo: f.id_modelo != null ? String(f.id_modelo) : '',
            system_prompt: f.system_prompt || '',
            codigo_aplicacion_origen: f.codigo_aplicacion_origen || '',
          })
          cargarAppsFuncion(f.codigo_funcion)
        }
      }
      if (cerrar || funcionEditando) {
        if (cerrar) setModalFuncion(false)
      }
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminarFuncion = (f: Funcion) => setConfirmacion({ tipo: 'funcion', item: f })

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat />
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {(['roles', 'funciones'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              tabActiva === tab
                ? 'bg-surface text-primario-oscuro shadow-sm border border-borde'
                : 'text-texto-muted hover:text-texto'
            }`}
          >
            {tab === 'roles' ? t('tabRoles') : t('tabFunciones')}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tabActiva === 'roles' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input
                placeholder={t('buscarPlaceholder')}
                value={busquedaRoles}
                onChange={(e) => setBusquedaRoles(e.target.value)}
                icono={<Search size={15} />}
              />
            </div>
            <div className="flex gap-2 ml-auto">
            <Boton
              variante="contorno"
              tamano="sm"
              onClick={() => exportarExcel(rolesFiltrados as unknown as Record<string, unknown>[], [
                { titulo: 'Grupo', campo: 'codigo_grupo' },
                { titulo: 'Código', campo: 'codigo_rol' },
                { titulo: 'Alias', campo: 'alias_de_rol' },
                { titulo: 'Nombre', campo: 'nombre' },
                { titulo: 'Descripción', campo: 'descripcion' },
                { titulo: 'URL inicio', campo: 'url_inicio' },
                { titulo: 'Fn. por defecto', campo: 'funcion_por_defecto' },
                { titulo: 'Tipo', campo: 'tipo' },
              ], `roles_${grupoActivo || 'todos'}`)}
              disabled={rolesFiltrados.length === 0}
            >
              <Download size={15} />
              Excel
            </Boton>
            <Boton variante="primario" onClick={abrirNuevoRol}><Plus size={16} />{t('nuevoRol')}</Boton>
            </div>
          </div>
          {!busquedaRoles && (
            <p className="text-xs text-texto-muted">Arrastra con el mouse para reordenar</p>
          )}
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh className="w-8"></TablaTh>
                <TablaTh>{t('colTipo')}</TablaTh>
                <TablaTh>{t('colAlias')}</TablaTh>
                <TablaTh>{t('colNombre')}</TablaTh>
                <TablaTh>{t('colUrlInicio')}</TablaTh>
                <TablaTh>{t('colCodigo')}</TablaTh>
                <TablaTh className="text-right">{tc('acciones')}</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <tr><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{tc('cargando')}</TablaTd></tr>
              ) : rolesFiltrados.length === 0 ? (
                <tr><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{tc('sinResultados')}</TablaTd></tr>
              ) : (
                <SortableDndContext
                  items={rolesFiltrados as unknown as Record<string, unknown>[]}
                  getId={(r) => String((r as unknown as Rol).id_rol)}
                  onReorder={(newItems) => reordenarRoles(newItems as unknown as Rol[])}
                  disabled={!!busquedaRoles}
                >
                  {rolesFiltrados.map((r) => (
                    <SortableRow key={r.id_rol} id={r.id_rol}>
                      <TablaTd><Insignia variante={varianteTipo(r.tipo_acceso)}>{etiquetaTipo(r.tipo_acceso)}</Insignia></TablaTd>
                      <TablaTd className="text-sm">{r.alias_de_rol || '—'}</TablaTd>
                      <TablaTd className="font-medium" onDoubleClick={() => abrirEditarRol(r)}>{r.nombre}</TablaTd>
                      <TablaTd className="text-xs">
                        {r.url_inicio ? (
                          <a href={r.url_inicio} className="text-primario hover:underline font-mono" title={r.url_inicio}>{r.url_inicio}</a>
                        ) : <span className="text-texto-muted">—</span>}
                      </TablaTd>
                      <TablaTd>
                        <code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{r.codigo_rol}</code>
                        {r.codigo_grupo == null && <span className="ml-2 text-xs bg-primario/10 text-primario px-1.5 py-0.5 rounded">Global</span>}
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarRol(r, 'programacion_insert')} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editor de contexto"><Brain size={14} /></button>
                          <button onClick={() => abrirEditarRol(r)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => confirmarEliminarRol(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </TablaTd>
                    </SortableRow>
                  ))}
                </SortableDndContext>
              )}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {tabActiva === 'funciones' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input
                placeholder={t('buscarPlaceholder')}
                value={busquedaFunciones}
                onChange={(e) => setBusquedaFunciones(e.target.value)}
                icono={<Search size={15} />}
              />
            </div>
            <div className="flex gap-2 ml-auto">
            <Boton
              variante="contorno"
              tamano="sm"
              onClick={() => exportarExcel(funcionesFiltradas as unknown as Record<string, unknown>[], [
                { titulo: 'Código', campo: 'codigo_funcion' },
                { titulo: 'Alias', campo: 'alias_de_funcion' },
                { titulo: 'Nombre', campo: 'nombre' },
                { titulo: 'Descripción', campo: 'descripcion' },
                { titulo: 'Icono', campo: 'icono_de_funcion' },
                { titulo: 'URL función', campo: 'url_funcion' },
                { titulo: 'Tipo', campo: 'tipo' },
              ], `funciones_${grupoActivo || 'todos'}`)}
              disabled={funcionesFiltradas.length === 0}
            >
              <Download size={15} />
              Excel
            </Boton>
            <Boton variante="primario" onClick={abrirNuevaFuncion}><Plus size={16} />{t('nuevaFuncion')}</Boton>
            </div>
          </div>
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>{t('colAppOrigen')}</TablaTh>
                <TablaTh>{t('colTipo')}</TablaTh>
                <TablaTh>{t('colAlias')}</TablaTh>
                <TablaTh>{t('colNombre')}</TablaTh>
                <TablaTh>{t('colIcono')}</TablaTh>
                <TablaTh>{t('colUrl')}</TablaTh>
                <TablaTh>{t('colCodigo')}</TablaTh>
                <TablaTh className="text-right">{tc('acciones')}</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargando ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>{tc('cargando')}</TablaTd></TablaFila>
              ) : funcionesFiltradas.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>{tc('sinResultados')}</TablaTd></TablaFila>
              ) : funcionesFiltradas.map((f) => (
                <TablaFila key={f.codigo_funcion}>
                  <TablaTd className="text-xs text-texto-muted">{nombreApp(f.codigo_aplicacion_origen) || '—'}</TablaTd>
                  <TablaTd><Insignia variante={varianteTipo(f.tipo_acceso)}>{etiquetaTipo(f.tipo_acceso)}</Insignia></TablaTd>
                  <TablaTd className="text-sm">{f.alias_de_funcion || '—'}</TablaTd>
                  <TablaTd className="font-medium" onDoubleClick={() => abrirEditarFuncion(f)}>{f.nombre}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{f.icono_de_funcion || '—'}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{f.url_funcion || '—'}</TablaTd>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{f.codigo_funcion}</code></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarFuncion(f)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => confirmarEliminarFuncion(f)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      {/* Modal Rol */}
      <Modal abierto={modalRol} alCerrar={() => setModalRol(false)} titulo={rolEditando ? t('editarRolTitulo', { nombre: rolEditando.nombre }) : t('nuevoRolTitulo')} className="w-[900px] max-w-[95vw]">
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Pestañas (solo en edición) */}
          {rolEditando && (
            <div className="flex border-b border-borde -mx-1 overflow-x-auto">
              {([
                { key: 'datos', label: t('tabDatos') },
                { key: 'funciones', label: t('tabFuncionesAsignadas') },
                { key: 'system_prompt', label: 'System Prompt' },
                { key: 'programacion_insert', label: 'Prog. Insert' },
                { key: 'programacion_update', label: 'Prog. Update' },
                { key: 'md', label: '.md' },
              ] as { key: typeof tabModalRol; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTabModalRol(tab.key)}
                  className={`flex-1 text-center px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${tabModalRol === tab.key ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab Datos */}
          {tabModalRol === 'datos' && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Input etiqueta={t('etiquetaNombre')} value={formRol.nombre} onChange={(e) => setFormRol({ ...formRol, nombre: e.target.value })} placeholder={t('placeholderNombreRol')} />
                <Input etiqueta={t('etiquetaAlias')} value={formRol.alias_de_rol} onChange={(e) => setFormRol({ ...formRol, alias_de_rol: e.target.value.substring(0, 40) })} placeholder={t('placeholderAliasRol')} />
                {rolEditando ? (
                  <Input etiqueta={t('colCodigo')} value={formRol.codigo_rol} disabled readOnly />
                ) : grupoActivo === 'ADMIN' ? (
                  <Input etiqueta={t('etiquetaCodigo')} value={formRol.codigo_rol} onChange={(e) => setFormRol({ ...formRol, codigo_rol: e.target.value.toUpperCase() })} placeholder={t('placeholderCodigoRol')} />
                ) : null}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-texto">Tipo</label>
                  {rolEditando ? (
                    <div className="flex items-center gap-2 py-1">
                      <Insignia variante={varianteTipo(formRol.tipo_acceso)}>{etiquetaTipo(formRol.tipo_acceso)}</Insignia>
                      <span className="text-xs text-texto-muted">Solo modificable desde la base de datos</span>
                    </div>
                  ) : (
                    <select
                      value={formRol.tipo_acceso}
                      onChange={(e) => setFormRol({ ...formRol, tipo_acceso: e.target.value as TipoElemento })}
                      className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                    >
                      <option value="SISTEMA">Sistema</option>
                      <option value="USUARIO">Usuario</option>
                      <option value="ADMINISTRACION">Administración</option>
                    </select>
                  )}
                </div>
                <Input etiqueta={t('etiquetaDescripcion')} value={formRol.descripcion} onChange={(e) => setFormRol({ ...formRol, descripcion: e.target.value })} placeholder={t('placeholderDescripcion')} />
                <Input etiqueta={t('etiquetaUrlInicio')} value={formRol.url_inicio} onChange={(e) => setFormRol({ ...formRol, url_inicio: e.target.value })} placeholder={t('placeholderUrlInicio')} />
              </div>
              {/* Tres checkboxes en una sola línea */}
              <div className="flex items-center gap-6 py-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formRol.inicial}
                    onChange={(e) => setFormRol({ ...formRol, inicial: e.target.checked })}
                    className="w-4 h-4 rounded border-borde text-primario focus:ring-primario cursor-pointer"
                  />
                  <span className="text-sm text-texto">Rol inicial</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formRol.inicial_admin_grupo}
                    onChange={(e) => setFormRol({ ...formRol, inicial_admin_grupo: e.target.checked })}
                    className="w-4 h-4 rounded border-borde text-primario focus:ring-primario cursor-pointer"
                  />
                  <span className="text-sm text-texto">Ini. Admin Grupo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formRol.inicial_admin_general}
                    onChange={(e) => setFormRol({ ...formRol, inicial_admin_general: e.target.checked })}
                    className="w-4 h-4 rounded border-borde text-primario focus:ring-primario cursor-pointer"
                  />
                  <span className="text-sm text-texto">Ini. Admin General</span>
                </label>
              </div>
              {rolEditando && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-texto">Función por defecto</label>
                  <select
                    value={formRol.funcion_por_defecto}
                    onChange={(e) => setFormRol({ ...formRol, funcion_por_defecto: e.target.value })}
                    className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                  >
                    <option value="">Sin función por defecto</option>
                    {funcionesRol.map((fa) => (
                      <option key={fa.codigo_funcion} value={fa.codigo_funcion}>
                        {fa.funciones?.nombre_funcion || fa.codigo_funcion}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-texto-muted">Selecciona la función que se mostrará por defecto para este rol</p>
                </div>
              )}
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal editando={!!rolEditando} onGuardar={() => guardarRol(false)} onGuardarYSalir={() => guardarRol(true)} onCerrar={() => setModalRol(false)} cargando={guardando} />
            </>
          )}

          {/* Tab Funciones asignadas */}
          {tabModalRol === 'funciones' && rolEditando && (
            <div className="flex flex-col gap-4">
              {(() => {
                const tipoRol = normalizarTipo(rolEditando.tipo_acceso)
                const visibles = tiposVisibles(tipoRol)
                if (!visibles.length) return null
                if (visibles.length > 2) return <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-700">Este rol puede recibir funciones de cualquier tipo: <strong>{visibles.join(', ')}</strong>.</div>
                return <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">Solo se pueden asignar funciones de tipo: <strong>{visibles.join(', ')}</strong>.</div>
              })()}
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={dropdownFuncionRolRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
                    <input
                      type="text"
                      placeholder={t('buscarFuncionPlaceholder')}
                      value={busquedaFuncionRol}
                      onChange={(e) => { setBusquedaFuncionRol(e.target.value); setDropdownFuncionRolAbierto(true); setFuncionNueva('') }}
                      onFocus={() => setDropdownFuncionRolAbierto(true)}
                      className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                    />
                  </div>
                  {dropdownFuncionRolAbierto && (
                    <div className="absolute z-50 w-full mt-1 bg-surface border border-borde rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {funcionesRolFiltradas.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-texto-muted">No se encontraron funciones</div>
                      ) : funcionesRolFiltradas.slice(0, 20).map((f) => (
                        <button
                          key={f.codigo_funcion}
                          onClick={() => {
                            setFuncionNueva(f.codigo_funcion)
                            setBusquedaFuncionRol(`${f.nombre} (${f.codigo_funcion})`)
                            setDropdownFuncionRolAbierto(false)
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
                <Boton variante="primario" onClick={asignarFuncion} cargando={asignandoFuncion} disabled={!funcionNueva}>
                  <Plus size={14} />
                  {t('asignar')}
                </Boton>
              </div>

              {cargandoFunciones ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}
                </div>
              ) : funcionesRol.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tiene funciones asignadas</p>
              ) : (
                <>
                  <p className="text-xs text-texto-muted">Arrastra con el mouse para reordenar</p>
                  <SortableDndContext
                    items={funcionesRol as unknown as Record<string, unknown>[]}
                    getId={(f) => (f as unknown as FuncionAsignada).codigo_funcion}
                    onReorder={(newItems) => reordenarFuncionesRol(newItems as unknown as FuncionAsignada[])}
                  >
                    <div className="flex flex-col gap-2">
                      {funcionesRol.map((fa) => (
                        <SortableListItem
                          key={fa.codigo_funcion}
                          id={fa.codigo_funcion}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde bg-surface"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-texto">{fa.funciones?.nombre_funcion || fa.codigo_funcion}</span>
                            <span className="ml-2 text-xs text-texto-muted">{fa.codigo_funcion}</span>
                          </div>
                          <button onClick={() => quitarFuncion(fa.codigo_funcion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar función"><X size={14} /></button>
                        </SortableListItem>
                      ))}
                    </div>
                  </SortableDndContext>
                </>
              )}

              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalRol(false)}>Salir</Boton>
              </div>
            </div>
          )}

          {/* Tab System Prompt — sin botones Generar ni Sincronizar */}
          {tabModalRol === 'system_prompt' && rolEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="roles"
                pkColumna="id_rol"
                pkValor={String(rolEditando.id_rol)}
                campos={{
                  prompt_insert: formRol.prompt_insert,
                  prompt_update: formRol.prompt_update,
                  system_prompt: formRol.system_prompt,
                  python_insert: formRol.python_insert,
                  python_update: formRol.python_update,
                  javascript: formRol.javascript,
                  python_editado_manual: formRol.python_editado_manual,
                  javascript_editado_manual: formRol.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormRol({ ...formRol, [c]: v })}
                mostrarPromptInsert={false}
                mostrarPromptUpdate={false}
                mostrarSystemPrompt={true}
                mostrarPythonInsert={false}
                mostrarPythonUpdate={false}
                mostrarJavaScript={false}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!rolEditando}
                onGuardar={() => guardarRol(false)}
                onGuardarYSalir={() => guardarRol(true)}
                onCerrar={() => setModalRol(false)}
                cargando={guardando}
              />
            </div>
          )}

          {/* Tab Programación Insert — solo Sincronizar, sin Generar */}
          {tabModalRol === 'programacion_insert' && rolEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="roles"
                pkColumna="id_rol"
                pkValor={String(rolEditando.id_rol)}
                campos={{
                  prompt_insert: formRol.prompt_insert,
                  prompt_update: formRol.prompt_update,
                  system_prompt: formRol.system_prompt,
                  python_insert: formRol.python_insert,
                  python_update: formRol.python_update,
                  javascript: formRol.javascript,
                  python_editado_manual: formRol.python_editado_manual,
                  javascript_editado_manual: formRol.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormRol({ ...formRol, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!rolEditando}
                onGuardar={() => guardarRol(false)}
                onGuardarYSalir={() => guardarRol(true)}
                onCerrar={() => setModalRol(false)}
                cargando={guardando}
                botonesIzquierda={rolEditando ? (
                  <PieBotonesPrompts
                    tabla="roles"
                    pkColumna="id_rol"
                    pkValor={String(rolEditando.id_rol)}
                    promptInsert={formRol.prompt_insert ?? undefined}
                    promptUpdate={formRol.prompt_update ?? undefined}
                    mostrarGenerar={false}
                    mostrarSincronizar={true}
                  />
                ) : undefined}
              />
            </div>
          )}

          {/* Tab Programación Update — solo Sincronizar, sin Generar */}
          {tabModalRol === 'programacion_update' && rolEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="roles"
                pkColumna="id_rol"
                pkValor={String(rolEditando.id_rol)}
                campos={{
                  prompt_insert: formRol.prompt_insert,
                  prompt_update: formRol.prompt_update,
                  system_prompt: formRol.system_prompt,
                  python_insert: formRol.python_insert,
                  python_update: formRol.python_update,
                  javascript: formRol.javascript,
                  python_editado_manual: formRol.python_editado_manual,
                  javascript_editado_manual: formRol.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormRol({ ...formRol, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!rolEditando}
                onGuardar={() => guardarRol(false)}
                onGuardarYSalir={() => guardarRol(true)}
                onCerrar={() => setModalRol(false)}
                cargando={guardando}
                botonesIzquierda={rolEditando ? (
                  <PieBotonesPrompts
                    tabla="roles"
                    pkColumna="id_rol"
                    pkValor={String(rolEditando.id_rol)}
                    promptInsert={formRol.prompt_insert ?? undefined}
                    promptUpdate={formRol.prompt_update ?? undefined}
                    mostrarGenerar={false}
                    mostrarSincronizar={true}
                  />
                ) : undefined}
              />
            </div>
          )}

          {/* Tab .md — con Generar y Sincronizar */}
          {tabModalRol === 'md' && rolEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Documento Markdown</label>
                <textarea
                  value={formRol.md}
                  onChange={(e) => setFormRol({ ...formRol, md: e.target.value })}
                  rows={16}
                  placeholder="Documentación del rol en formato Markdown..."
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal
                editando={!!rolEditando}
                onGuardar={() => guardarRol(false)}
                onGuardarYSalir={() => guardarRol(true)}
                onCerrar={() => setModalRol(false)}
                cargando={guardando}
                botonesIzquierda={
                  <PieBotonesPrompts
                    tabla="roles"
                    pkColumna="id_rol"
                    pkValor={String(rolEditando.id_rol)}
                    promptInsert={formRol.prompt_insert ?? undefined}
                    promptUpdate={formRol.prompt_update ?? undefined}
                    mostrarGenerar={true}
                    mostrarSincronizar={true}
                  />
                }
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Función */}
      <Modal abierto={modalFuncion} alCerrar={() => setModalFuncion(false)} titulo={funcionEditando ? t('editarFuncionTitulo', { nombre: funcionEditando.nombre }) : t('nuevaFuncionTitulo')} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {funcionEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button onClick={() => setTabModalFuncion('datos')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabDatos')}</button>
              <button onClick={() => setTabModalFuncion('aplicaciones')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'aplicaciones' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabApps')} ({appsFuncion.length})</button>
              <button onClick={() => setTabModalFuncion('llm')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'llm' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabLlm')}</button>
            </div>
          )}

          {tabModalFuncion === 'datos' && (
            <>
              <Input etiqueta={t('etiquetaNombre')} value={formFuncion.nombre} onChange={(e) => setFormFuncion({ ...formFuncion, nombre: e.target.value })} placeholder={t('placeholderNombreFuncion')} />
              <Input etiqueta={t('etiquetaAlias')} value={formFuncion.alias_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, alias_de_funcion: e.target.value.substring(0, 40) })} placeholder={t('placeholderAliasFuncion')} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Aplicación origen</label>
                <select value={formFuncion.codigo_aplicacion_origen} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_aplicacion_origen: e.target.value })} className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario">
                  <option value="">— sin asignar —</option>
                  {[...todasApps].sort((a, b) => {
                      const ta = a.tipo_acceso === 'USUARIO' ? 0 : 1
                      const tb = b.tipo_acceso === 'USUARIO' ? 0 : 1
                      if (ta !== tb) return ta - tb
                      return a.nombre.localeCompare(b.nombre, 'es')
                    }).map((a) => (
                    <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>
                  ))}
                </select>
              </div>
              <Input etiqueta={t('etiquetaIcono')} value={formFuncion.icono_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, icono_de_funcion: e.target.value })} placeholder={t('placeholderIcono')} />
              <Input etiqueta={t('etiquetaDescripcion')} value={formFuncion.descripcion} onChange={(e) => setFormFuncion({ ...formFuncion, descripcion: e.target.value })} />
              <Input etiqueta={t('etiquetaUrlFuncion')} value={formFuncion.url_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, url_funcion: e.target.value })} placeholder={t('placeholderUrlFuncion')} />
              {funcionEditando && <Input etiqueta="Código" value={formFuncion.codigo_funcion} disabled readOnly />}
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal editando={!!funcionEditando} onGuardar={() => guardarFuncion(false)} onGuardarYSalir={() => guardarFuncion(true)} onCerrar={() => setModalFuncion(false)} cargando={guardando} />
            </>
          )}

          {tabModalFuncion === 'aplicaciones' && funcionEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <select value={appNueva} onChange={(e) => setAppNueva(e.target.value)} className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario">
                    <option value="">Seleccionar aplicación...</option>
                    {appsDisponiblesFuncion.map((a) => (
                      <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>
                    ))}
                  </select>
                </div>
                <Boton variante="primario" onClick={asignarAppAFuncion} cargando={asignandoApp} disabled={!appNueva}><Plus size={14} />{t('asignar')}</Boton>
              </div>
              {cargandoApps ? (
                <div className="flex flex-col gap-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              ) : appsFuncion.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-4">No tiene aplicaciones asignadas</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {appsFuncion.map((af) => (
                    <div key={af.codigo_aplicacion} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface">
                      <div>
                        <span className="text-sm font-medium text-texto">{(af as Record<string, unknown>).aplicaciones ? ((af as Record<string, unknown>).aplicaciones as Record<string, string>).nombre_aplicacion : af.codigo_aplicacion}</span>
                        <span className="ml-2 text-xs text-texto-muted">{af.codigo_aplicacion}</span>
                      </div>
                      <button onClick={() => quitarAppDeFuncion(af.codigo_aplicacion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalFuncion(false)}>Salir</Boton></div>
            </div>
          )}

          {tabModalFuncion === 'llm' && funcionEditando && (
            <div className="flex flex-col gap-4">
              <div className="bg-primario/5 border border-primario/20 rounded-lg p-3 text-xs text-texto-muted">
                Configura el modelo de IA que usará esta función cuando invoque al chat o procesamiento LLM.
                Si la función no maneja chat, déjalo sin asignar.
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Modelo LLM</label>
                <select
                  value={formFuncion.id_modelo}
                  onChange={(e) => setFormFuncion({ ...formFuncion, id_modelo: e.target.value })}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                >
                  <option value="">— Sin modelo asignado —</option>
                  {modelosLLM.map((m) => (
                    <option key={m.id_modelo} value={String(m.id_modelo)}>
                      {m.nombre_visible} ({m.proveedor})
                    </option>
                  ))}
                </select>
                {modelosLLM.length === 0 && (
                  <p className="text-xs text-texto-muted">No hay modelos LLM configurados. Configura modelos en Registro LLM.</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">System prompt (instrucciones extras)</label>
                <textarea
                  value={formFuncion.system_prompt}
                  onChange={(e) => setFormFuncion({ ...formFuncion, system_prompt: e.target.value })}
                  rows={5}
                  placeholder="Ej: Eres un asistente legal. Responde con precisión técnica y cita los artículos relevantes."
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto resize-y focus:outline-none focus:ring-2 focus:ring-primario"
                />
                <p className="text-xs text-texto-muted">
                  Opcional. El backend siempre antepone un contexto automático con datos del usuario, grupo y entidad.
                  Lo que escribas aquí se agrega como instrucciones adicionales.
                </p>
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <PieBotonesModal editando={!!funcionEditando} onGuardar={() => guardarFuncion(false)} onGuardarYSalir={() => guardarFuncion(true)} onCerrar={() => setModalFuncion(false)} cargando={guardando} />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo={confirmacion?.tipo === 'rol' ? t('eliminarRol') : t('eliminarFuncion')}
        mensaje={
          confirmacion?.tipo === 'rol'
            ? `¿Estás seguro de eliminar el rol "${confirmacion.item.nombre}"? Esta acción no se puede deshacer.`
            : `¿Estás seguro de eliminar la función "${confirmacion?.item.nombre}"? Se eliminarán todas las asignaciones a roles.`
        }
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
