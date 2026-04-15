'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Download, Search } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaContenido } from '@/components/ui/tarjeta'
import { rolesApi, funcionesApi, aplicacionesApi, registroLLMApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Rol, Funcion, Aplicacion, RegistroLLM } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { etiquetaTipo, varianteTipo, normalizarTipo, type TipoElemento } from '@/lib/tipo-elemento'

type FuncionAsignada = { codigo_funcion: string; orden: number; funciones: { nombre_funcion: string } }

export default function PaginaRoles() {
  const t = useTranslations('roles')
  const tc = useTranslations('common')
  const { grupoActivo, aplicacionActiva } = useAuth()
  const [roles, setRoles] = useState<Rol[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [tabActiva, setTabActiva] = useState<'roles' | 'funciones'>('roles')
  const [busquedaRoles, setBusquedaRoles] = useState('')
  const [busquedaFunciones, setBusquedaFunciones] = useState('')

  // Modal rol
  const [modalRol, setModalRol] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [formRol, setFormRol] = useState({ codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '', funcion_por_defecto: '', codigo_aplicacion_origen: '', tipo: 'USUARIO' as TipoElemento, prompt: '', system_prompt: '' })
  const [tabModalRol, setTabModalRol] = useState<'datos' | 'funciones' | 'prompt' | 'system_prompt'>('datos')

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
    id_modelo: '' as string,  // string para el <select>; '' = sin LLM
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
      setModelosLLM(llms.filter((m: RegistroLLM) => m.activo))
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
    setFormRol({ codigo_rol: '', nombre: '', alias_de_rol: '', descripcion: '', url_inicio: '', funcion_por_defecto: '', codigo_aplicacion_origen: aplicacionActiva || '', tipo: 'USUARIO', prompt: '', system_prompt: '' })
    setError('')
    setTabModalRol('datos')
    setModalRol(true)
  }

  const abrirEditarRol = (r: Rol) => {
    setRolEditando(r)
    setFormRol({ codigo_rol: r.codigo_rol, nombre: r.nombre, alias_de_rol: r.alias_de_rol || '', descripcion: r.descripcion || '', url_inicio: r.url_inicio || '', funcion_por_defecto: r.funcion_por_defecto || '', codigo_aplicacion_origen: r.codigo_aplicacion_origen || '', tipo: normalizarTipo(r.tipo), prompt: (r as Record<string, unknown>).prompt as string || '', system_prompt: (r as Record<string, unknown>).system_prompt as string || '' })
    setError('')
    setTabModalRol('datos')
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
        await rolesApi.actualizar(rolEditando.id_rol, { nombre: formRol.nombre, alias_de_rol: formRol.alias_de_rol || undefined, descripcion: formRol.descripcion, url_inicio: formRol.url_inicio, funcion_por_defecto: formRol.funcion_por_defecto || undefined, codigo_aplicacion_origen: origen, prompt: formRol.prompt || undefined, system_prompt: formRol.system_prompt || undefined })
      } else {
        const payload: Record<string, unknown> = { nombre: formRol.nombre, alias_de_rol: formRol.alias_de_rol || undefined, descripcion: formRol.descripcion, url_inicio: formRol.url_inicio, funcion_por_defecto: formRol.funcion_por_defecto || undefined, codigo_aplicacion_origen: origen, codigo_grupo: grupoActivo || 'ADMIN' }
        if (esGlobalCreate && formRol.codigo_rol) payload.codigo_rol = formRol.codigo_rol
        const nuevo = await rolesApi.crear(payload as Parameters<typeof rolesApi.crear>[0])
        if (!cerrar && nuevo) {
          setRolEditando(nuevo as Rol)
          setFormRol({ codigo_rol: (nuevo as Rol).codigo_rol, nombre: (nuevo as Rol).nombre, alias_de_rol: (nuevo as Rol).alias_de_rol || '', descripcion: (nuevo as Rol).descripcion || '', url_inicio: (nuevo as Rol).url_inicio || '', funcion_por_defecto: (nuevo as Rol).funcion_por_defecto || '', codigo_aplicacion_origen: (nuevo as Rol).codigo_aplicacion_origen || '', tipo: normalizarTipo((nuevo as Rol).tipo), prompt: ((nuevo as Record<string, unknown>).prompt as string) || '', system_prompt: ((nuevo as Record<string, unknown>).system_prompt as string) || '' })
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

  const moverFuncion = async (index: number, direccion: 'arriba' | 'abajo') => {
    if (!rolEditando) return
    const lista = [...funcionesRol]
    const swapIndex = direccion === 'arriba' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= lista.length) return
    const ordenA = lista[index].orden
    const ordenB = lista[swapIndex].orden
    lista[index].orden = ordenB
    lista[swapIndex].orden = ordenA
    ;[lista[index], lista[swapIndex]] = [lista[swapIndex], lista[index]]
    setFuncionesRol(lista)
    try {
      await rolesApi.reordenarFunciones(rolEditando.id_rol, lista.map((f) => ({
        codigo_funcion: f.codigo_funcion,
        orden: f.orden,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reordenar')
      cargarFuncionesRol(rolEditando.id_rol)
    }
  }

  // Mapa codigo_aplicacion → nombre, para mostrar y ordenar por aplicación origen
  const mapaAppNombre = Object.fromEntries(todasApps.map((a) => [a.codigo_aplicacion, a.nombre]))
  const nombreApp = (codigo?: string | null) => (codigo ? (mapaAppNombre[codigo] || codigo) : '')
  const compararPorAppYNombre = <T extends { codigo_aplicacion_origen?: string | null; nombre: string }>(a: T, b: T) => {
    const na = nombreApp(a.codigo_aplicacion_origen); const nb = nombreApp(b.codigo_aplicacion_origen)
    const sa = na ? 0 : 1; const sb = nb ? 0 : 1
    if (sa !== sb) return sa - sb
    if (na !== nb) return na.localeCompare(nb)
    return a.nombre.localeCompare(b.nombre)
  }

  // ── Reordenar roles ───────────────────────────────────────────────────────
  const moverRol = async (index: number, direccion: 'arriba' | 'abajo') => {
    const lista = [...roles].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    const swap = direccion === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const ordenA = lista[index].orden ?? 0
    const ordenB = lista[swap].orden ?? 0
    lista[index] = { ...lista[index], orden: ordenB }
    lista[swap] = { ...lista[swap], orden: ordenA }
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setRoles(lista)
    try {
      await rolesApi.reordenar(lista.map((r) => ({ id_rol: r.id_rol, orden: r.orden ?? 0 })))
    } catch {
      cargar()
    }
  }

  // Listas filtradas: por orden cuando no hay búsqueda, por app+nombre cuando hay búsqueda
  const rolesFiltrados = roles
    .filter((r) => r.nombre.toLowerCase().includes(busquedaRoles.toLowerCase()) || r.codigo_rol.toLowerCase().includes(busquedaRoles.toLowerCase()) || (r.alias_de_rol || '').toLowerCase().includes(busquedaRoles.toLowerCase()))
    .sort(busquedaRoles ? compararPorAppYNombre : (a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  const funcionesFiltradas = funciones
    .filter((f) => f.nombre.toLowerCase().includes(busquedaFunciones.toLowerCase()) || f.codigo_funcion.toLowerCase().includes(busquedaFunciones.toLowerCase()) || (f.alias_de_funcion || '').toLowerCase().includes(busquedaFunciones.toLowerCase()))
    .sort(compararPorAppYNombre)

  // Funciones disponibles para asignar (excluir las ya asignadas)
  const funcionesDisponibles = funciones.filter((f) =>
    !funcionesRol.some((fa) => fa.codigo_funcion === f.codigo_funcion)
  )

  // Filtro de búsqueda para el selector de funciones del rol
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
    a.activo && !appsFuncion.some((af) => af.codigo_aplicacion === a.codigo_aplicacion)
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
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">{t('titulo')}</h2>
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
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh className="w-16">{t('colOrden')}</TablaTh>
                <TablaTh>{t('colAppOrigen')}</TablaTh>
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
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={9 as never}>{tc('cargando')}</TablaTd></TablaFila>
              ) : rolesFiltrados.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={9 as never}>{tc('sinResultados')}</TablaTd></TablaFila>
              ) : rolesFiltrados.map((r, idx) => (
                <TablaFila key={r.id_rol}>
                  <TablaTd>
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col">
                        <button onClick={() => moverRol(idx, 'arriba')} disabled={idx === 0 || !!busquedaRoles} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Subir"><ChevronUp size={14} /></button>
                        <button onClick={() => moverRol(idx, 'abajo')} disabled={idx === rolesFiltrados.length - 1 || !!busquedaRoles} className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Bajar"><ChevronDown size={14} /></button>
                      </div>
                      <span className="text-xs text-texto-muted w-4 text-center">{r.orden}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-xs text-texto-muted">{nombreApp(r.codigo_aplicacion_origen) || '—'}</TablaTd>
                  <TablaTd><Insignia variante={varianteTipo(r.tipo)}>{etiquetaTipo(r.tipo)}</Insignia></TablaTd>
                  <TablaTd className="text-sm">{r.alias_de_rol || '—'}</TablaTd>
                  <TablaTd className="font-medium">{r.nombre}</TablaTd>
                  <TablaTd className="text-texto-muted text-xs">{r.url_inicio || '—'}</TablaTd>
                  <TablaTd>
                    <code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{r.codigo_rol}</code>
                    {r.codigo_grupo == null && <span className="ml-2 text-xs bg-primario/10 text-primario px-1.5 py-0.5 rounded">Global</span>}
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarRol(r)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => confirmarEliminarRol(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
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
                  <TablaTd><Insignia variante={varianteTipo(f.tipo)}>{etiquetaTipo(f.tipo)}</Insignia></TablaTd>
                  <TablaTd className="text-sm">{f.alias_de_funcion || '—'}</TablaTd>
                  <TablaTd className="font-medium">{f.nombre}</TablaTd>
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
      <Modal abierto={modalRol} alCerrar={() => setModalRol(false)} titulo={rolEditando ? t('editarRolTitulo', { nombre: rolEditando.nombre }) : t('nuevoRolTitulo')} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {/* Pestañas (solo en edición) */}
          {rolEditando && (
            <div className="flex border-b border-borde -mx-1 overflow-x-auto">
              {([
                { key: 'datos', label: t('tabDatos') },
                { key: 'funciones', label: t('tabFuncionesAsignadas') },
                { key: 'prompt', label: 'Prompt' },
                { key: 'system_prompt', label: 'System Prompt' },
              ] as { key: typeof tabModalRol; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTabModalRol(tab.key)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${tabModalRol === tab.key ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab Datos — grid de 2 columnas */}
          {tabModalRol === 'datos' && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Input etiqueta={t('etiquetaNombre')} value={formRol.nombre} onChange={(e) => setFormRol({ ...formRol, nombre: e.target.value })} placeholder={t('placeholderNombreRol')} />
                <Input etiqueta={t('etiquetaAlias')} value={formRol.alias_de_rol} onChange={(e) => setFormRol({ ...formRol, alias_de_rol: e.target.value.substring(0, 40) })} placeholder={t('placeholderAliasRol')} />
                {/* Código: visible en edición (disabled) o cuando super-admin crea global */}
                {rolEditando ? (
                  <Input etiqueta={t('colCodigo')} value={formRol.codigo_rol} disabled readOnly />
                ) : grupoActivo === 'ADMIN' ? (
                  <Input etiqueta={t('etiquetaCodigo')} value={formRol.codigo_rol} onChange={(e) => setFormRol({ ...formRol, codigo_rol: e.target.value.toUpperCase() })} placeholder={t('placeholderCodigoRol')} />
                ) : null}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-texto">Aplicación origen</label>
                  <select value={formRol.codigo_aplicacion_origen} onChange={(e) => setFormRol({ ...formRol, codigo_aplicacion_origen: e.target.value })} className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario">
                    <option value="">— sin asignar —</option>
                    {[...todasApps].sort((a, b) => {
                      const peso = (t?: string | null) => { const n = normalizarTipo(t); return n === 'USUARIO' ? 0 : n === 'PRUEBAS' ? 1 : n === 'ADMINISTRADOR' ? 2 : 3 }
                      const ta = peso(a.tipo)
                      const tb = peso(b.tipo)
                      if (ta !== tb) return ta - tb
                      return a.nombre.localeCompare(b.nombre, 'es')
                    }).map((a) => (
                      <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-texto">Tipo</label>
                  <div className="flex items-center gap-2 py-1">
                    <Insignia variante={varianteTipo(formRol.tipo)}>{etiquetaTipo(formRol.tipo)}</Insignia>
                    <span className="text-xs text-texto-muted">Solo modificable desde la base de datos</span>
                  </div>
                </div>
                <Input etiqueta={t('etiquetaDescripcion')} value={formRol.descripcion} onChange={(e) => setFormRol({ ...formRol, descripcion: e.target.value })} placeholder={t('placeholderDescripcion')} />
                <Input etiqueta={t('etiquetaUrlInicio')} value={formRol.url_inicio} onChange={(e) => setFormRol({ ...formRol, url_inicio: e.target.value })} placeholder={t('placeholderUrlInicio')} />
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
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalRol(false)}>{tc('cancelar')}</Boton>
                <Boton variante="contorno" onClick={() => guardarRol(true)} cargando={guardando}>Guardar y salir</Boton>
                <Boton variante="primario" onClick={() => guardarRol(false)} cargando={guardando}>{rolEditando ? tc('guardar') : t('crearRol')}</Boton>
              </div>
            </>
          )}

          {/* Tab Funciones asignadas */}
          {tabModalRol === 'funciones' && rolEditando && (
            <div className="flex flex-col gap-4">
              {/* Asignar nueva función */}
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
                <Boton
                  variante="primario"
                  onClick={asignarFuncion}
                  cargando={asignandoFuncion}
                  disabled={!funcionNueva}
                >
                  <Plus size={14} />
                  {t('asignar')}
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
                  {funcionesRol.map((fa, idx) => (
                    <div
                      key={fa.codigo_funcion}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde bg-surface"
                    >
                      <div className="flex flex-col">
                        <button
                          onClick={() => moverFuncion(idx, 'arriba')}
                          disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Subir"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moverFuncion(idx, 'abajo')}
                          disabled={idx === funcionesRol.length - 1}
                          className="p-0.5 rounded hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Bajar"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <span className="text-xs text-texto-muted w-5 text-center">{fa.orden}</span>
                      <div className="flex-1 min-w-0">
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
                  Guardar y salir
                </Boton>
              </div>
            </div>
          )}

          {/* Tab Prompt — rol */}
          {tabModalRol === 'prompt' && rolEditando && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">Texto de contexto que se inyecta al LLM cuando los usuarios de este rol interactúan con funciones LLM.</p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: El usuario es un responsable de área con acceso a documentos e informes de gestión..."
                value={formRol.prompt}
                onChange={(e) => setFormRol({ ...formRol, prompt: e.target.value })}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex gap-3 justify-end pt-2"><Boton variante="contorno" onClick={() => setModalRol(false)}>{tc('cancelar')}</Boton><Boton variante="contorno" onClick={() => guardarRol(true)} cargando={guardando}>Guardar y salir</Boton><Boton variante="primario" onClick={() => guardarRol(false)} cargando={guardando}>{tc('guardar')}</Boton></div>
            </div>
          )}

          {/* Tab System Prompt — rol */}
          {tabModalRol === 'system_prompt' && rolEditando && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">Instrucciones de sistema que se aplican a todos los usuarios de este rol al interactuar con LLM.</p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Responde siempre de forma formal y concisa..."
                value={formRol.system_prompt}
                onChange={(e) => setFormRol({ ...formRol, system_prompt: e.target.value })}
              />
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex gap-3 justify-end pt-2"><Boton variante="contorno" onClick={() => setModalRol(false)}>{tc('cancelar')}</Boton><Boton variante="contorno" onClick={() => guardarRol(true)} cargando={guardando}>Guardar y salir</Boton><Boton variante="primario" onClick={() => guardarRol(false)} cargando={guardando}>{tc('guardar')}</Boton></div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Función */}
      <Modal abierto={modalFuncion} alCerrar={() => setModalFuncion(false)} titulo={funcionEditando ? t('editarFuncionTitulo', { nombre: funcionEditando.nombre }) : t('nuevaFuncionTitulo')} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {/* Tabs (solo en edición) */}
          {funcionEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button onClick={() => setTabModalFuncion('datos')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabDatos')}</button>
              <button onClick={() => setTabModalFuncion('aplicaciones')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'aplicaciones' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabApps')} ({appsFuncion.length})</button>
              <button onClick={() => setTabModalFuncion('llm')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'llm' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabLlm')}</button>
            </div>
          )}

          {/* Tab Datos */}
          {tabModalFuncion === 'datos' && (
            <>
              <Input etiqueta={t('etiquetaNombre')} value={formFuncion.nombre} onChange={(e) => setFormFuncion({ ...formFuncion, nombre: e.target.value })} placeholder={t('placeholderNombreFuncion')} />
              <Input etiqueta={t('etiquetaAlias')} value={formFuncion.alias_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, alias_de_funcion: e.target.value.substring(0, 40) })} placeholder={t('placeholderAliasFuncion')} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-texto">Aplicación origen</label>
                <select value={formFuncion.codigo_aplicacion_origen} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_aplicacion_origen: e.target.value })} className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario">
                  <option value="">— sin asignar —</option>
                  {[...todasApps].sort((a, b) => {
                      const ta = a.tipo === 'NORMAL' ? 0 : 1
                      const tb = b.tipo === 'NORMAL' ? 0 : 1
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
              {funcionEditando && (
                <Input etiqueta="Código" value={formFuncion.codigo_funcion} disabled readOnly />
              )}
              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('cancelar')}</Boton>
                <Boton variante="contorno" onClick={() => guardarFuncion(true)} cargando={guardando}>Guardar y salir</Boton>
                <Boton variante="primario" onClick={() => guardarFuncion(false)} cargando={guardando}>{funcionEditando ? tc('guardar') : t('crearFuncion')}</Boton>
              </div>
            </>
          )}

          {/* Tab Aplicaciones */}
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
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalFuncion(false)}>Guardar y salir</Boton></div>
            </div>
          )}

          {/* Tab LLM (configuración del modelo de IA para esta función) */}
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
                  <p className="text-xs text-texto-muted">No hay modelos LLM activos. Configura modelos en Registro LLM.</p>
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
              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('cancelar')}</Boton>
                <Boton variante="contorno" onClick={() => guardarFuncion(true)} cargando={guardando}>Guardar y salir</Boton>
                <Boton variante="primario" onClick={() => guardarFuncion(false)} cargando={guardando}>{tc('guardar')}</Boton>
              </div>
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
