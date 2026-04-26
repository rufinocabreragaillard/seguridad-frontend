'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Download, Search, RefreshCw, Languages, Brain } from 'lucide-react'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BotonChat } from '@/components/ui/boton-chat'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { aplicacionesApi, funcionesApi, registroLLMApi, promptsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Aplicacion, ApiEndpoint, Funcion, RegistroLLM } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useTranslations } from 'next-intl'
import { TIPOS_ELEMENTO, ETIQUETA_TIPO, etiquetaTipo, varianteTipo, normalizarTipo, type TipoElemento } from '@/lib/tipo-elemento'

type AppDeFuncion = { codigo_aplicacion: string; aplicaciones?: { nombre_aplicacion: string } }

type TipoFuncion = TipoElemento

function badgeTipo(tipo?: string) {
  return <Insignia variante={varianteTipo(tipo)}>{etiquetaTipo(tipo)}</Insignia>
}

export default function PaginaFunciones() {
  const t = useTranslations('funciones')
  const tc = useTranslations('common')
  const { grupoActivo, aplicacionActiva } = useAuth()
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [modelosLLM, setModelosLLM] = useState<RegistroLLM[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // ── Modal Funcion ─────────────────────────────────────────────────────────
  const [modalFuncion, setModalFuncion] = useState(false)
  const [funcionEditando, setFuncionEditando] = useState<Funcion | null>(null)
  const [formFuncion, setFormFuncion] = useState<{
    codigo_funcion: string
    nombre: string
    descripcion: string
    ayuda_de_funcion: string
    url_funcion: string
    alias_de_funcion: string
    icono_de_funcion: string
    codigo_aplicacion_origen: string
    tipo_acceso: TipoFuncion
    id_modelo: string
    system_prompt: string
    prompt_view: string
    sql_view: string
    md: string
    prompt_insert: string
    prompt_update: string
    python_insert: string
    python_update: string
    javascript: string
    python_editado_manual: boolean
    javascript_editado_manual: boolean
    perm_select: boolean
    perm_insert: boolean
    perm_update: boolean
    perm_delete: boolean
    traducir: boolean
  }>({
    codigo_funcion: '', nombre: '', descripcion: '', ayuda_de_funcion: '', url_funcion: '',
    alias_de_funcion: '', icono_de_funcion: '', codigo_aplicacion_origen: '',
    tipo_acceso: 'USUARIO', id_modelo: '', system_prompt: '', prompt_view: '', sql_view: '', md: '', prompt_insert: '', prompt_update: '',
    python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
    perm_select: true, perm_insert: true, perm_update: true, perm_delete: true,
    traducir: true,
  })
  const [tabModalFuncion, setTabModalFuncion] = useState<'datos' | 'otros' | 'aplicaciones' | 'apis' | 'system_prompt' | 'vista' | 'md' | 'programacion_insert' | 'programacion_update' | 'llm'>('datos')
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [generandoVista, setGenerandoVista] = useState(false)
  const [sincronizandoVista, setSincronizandoVista] = useState(false)
  const [mensajeVista, setMensajeVista] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [guardandoFuncion, setGuardandoFuncion] = useState(false)
  const [errorFuncion, setErrorFuncion] = useState('')

  // Aplicaciones de la funcion
  const [appsDeFuncion, setAppsDeFuncion] = useState<AppDeFuncion[]>([])
  const [cargandoAppsFuncion, setCargandoAppsFuncion] = useState(false)
  const [appNuevaFuncion, setAppNuevaFuncion] = useState('')
  const [asignandoAppFuncion, setAsignandoAppFuncion] = useState(false)

  // APIs de la funcion
  const [apisDeFuncion, setApisDeFuncion] = useState<ApiEndpoint[]>([])
  const [cargandoApisFuncion, setCargandoApisFuncion] = useState(false)

  // Confirmar eliminacion
  const [confirmacion, setConfirmacion] = useState<Funcion | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Traducción individual
  const [traduciendo, setTraduciendo] = useState<string | null>(null)

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [a, f, llms] = await Promise.all([
        aplicacionesApi.listar(),
        funcionesApi.listar(),
        registroLLMApi.listar().catch(() => [] as RegistroLLM[]),
      ])
      setAplicaciones(a)
      setFunciones(f)
      setModelosLLM(llms)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Funcion: CRUD ─────────────────────────────────────────────────────────
  const abrirNuevaFuncion = () => {
    setFuncionEditando(null)
    setFormFuncion({
      codigo_funcion: '', nombre: '', descripcion: '', ayuda_de_funcion: '', url_funcion: '',
      alias_de_funcion: '', icono_de_funcion: '',
      codigo_aplicacion_origen: aplicacionActiva || '',
      tipo_acceso: 'USUARIO', id_modelo: '', system_prompt: '', prompt_view: '', sql_view: '', md: '', prompt_insert: '', prompt_update: '',
      python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
      perm_select: true, perm_insert: true, perm_update: true, perm_delete: true,
      traducir: true,
    })
    setErrorFuncion(''); setTabModalFuncion('datos'); setModalFuncion(true)
  }
  const abrirEditarFuncion = (f: Funcion, tabInicial: 'datos' | 'otros' | 'aplicaciones' | 'apis' | 'system_prompt' | 'vista' | 'md' | 'programacion_insert' | 'programacion_update' | 'llm' = 'datos') => {
    setFuncionEditando(f)
    setFormFuncion({
      codigo_funcion: f.codigo_funcion,
      nombre: f.nombre,
      descripcion: f.descripcion || '',
      ayuda_de_funcion: f.ayuda_de_funcion || '',
      url_funcion: f.url_funcion || '',
      alias_de_funcion: f.alias_de_funcion || '',
      icono_de_funcion: f.icono_de_funcion || '',
      codigo_aplicacion_origen: f.codigo_aplicacion_origen || '',
      tipo_acceso: normalizarTipo(f.tipo_acceso),
      id_modelo: f.id_modelo ? String(f.id_modelo) : '',
      system_prompt: (f as Funcion & { system_prompt?: string }).system_prompt || '',
      prompt_view: (f as Funcion & { prompt_view?: string }).prompt_view || '',
      sql_view: (f as Funcion & { sql_view?: string }).sql_view || '',
      md: (f as Funcion & { md?: string }).md || '',
      prompt_insert: (f as Funcion & { prompt_insert?: string }).prompt_insert || '',
      prompt_update: (f as Funcion & { prompt_update?: string }).prompt_update || '',
      python_insert: (f as Funcion & { python_insert?: string }).python_insert || '',
      python_update: (f as Funcion & { python_update?: string }).python_update || '',
      javascript: (f as Funcion & { javascript?: string }).javascript || '',
      python_editado_manual: (f as Funcion & { python_editado_manual?: boolean }).python_editado_manual ?? false,
      javascript_editado_manual: (f as Funcion & { javascript_editado_manual?: boolean }).javascript_editado_manual ?? false,
      perm_select: f.perm_select ?? true,
      perm_insert: f.perm_insert ?? true,
      perm_update: f.perm_update ?? true,
      perm_delete: f.perm_delete ?? true,
      traducir: f.traducir ?? true,
    })
    setErrorFuncion('')
    setMensajeMd(null)
    setTabModalFuncion(tabInicial)
    cargarAppsDeFuncion(f.codigo_funcion)
    cargarApisDeFuncion(f.codigo_funcion)
    setModalFuncion(true)
  }
  const guardarFuncion = async (cerrar: boolean) => {
    if (!formFuncion.nombre) { setErrorFuncion('El nombre es obligatorio'); return }
    setGuardandoFuncion(true)
    try {
      const payload: Record<string, unknown> = {
        nombre: formFuncion.nombre,
        descripcion: formFuncion.descripcion || undefined,
        ayuda_de_funcion: formFuncion.ayuda_de_funcion || undefined,
        url_funcion: formFuncion.url_funcion || undefined,
        alias_de_funcion: formFuncion.alias_de_funcion || undefined,
        icono_de_funcion: formFuncion.icono_de_funcion || undefined,
        codigo_aplicacion_origen: formFuncion.codigo_aplicacion_origen || null,
        id_modelo: formFuncion.id_modelo ? parseInt(formFuncion.id_modelo) : null,
        system_prompt: formFuncion.system_prompt || null,
        prompt_view: formFuncion.prompt_view || null,
        sql_view: formFuncion.sql_view || null,
        prompt_insert: formFuncion.prompt_insert || null,
        prompt_update: formFuncion.prompt_update || null,
        python_insert: formFuncion.python_insert || null,
        python_update: formFuncion.python_update || null,
        javascript: formFuncion.javascript || null,
        python_editado_manual: formFuncion.python_editado_manual,
        javascript_editado_manual: formFuncion.javascript_editado_manual,
        perm_select: formFuncion.perm_select,
        perm_insert: formFuncion.perm_insert,
        perm_update: formFuncion.perm_update,
        // perm_delete se excluye: solo modificable directamente en la BD
        traducir: formFuncion.traducir,
      }
      if (funcionEditando) {
        await funcionesApi.actualizar(funcionEditando.codigo_funcion, payload)
      } else {
        if (formFuncion.codigo_funcion) payload.codigo_funcion = formFuncion.codigo_funcion
        const nuevo = await funcionesApi.crear(payload as Parameters<typeof funcionesApi.crear>[0])
        if (!cerrar) {
          setFuncionEditando(nuevo)
          cargarAppsDeFuncion(nuevo.codigo_funcion)
        }
      }
      if (cerrar) { setModalFuncion(false) }
      cargar()
    } catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoFuncion(false) }
  }

  // ── Funcion: aplicaciones ─────────────────────────────────────────────────
  const cargarAppsDeFuncion = useCallback(async (c: string) => {
    setCargandoAppsFuncion(true)
    try { setAppsDeFuncion(await funcionesApi.listarAplicaciones(c)) } catch { setAppsDeFuncion([]) }
    finally { setCargandoAppsFuncion(false) }
  }, [])

  const cargarApisDeFuncion = useCallback(async (c: string) => {
    setCargandoApisFuncion(true)
    try { setApisDeFuncion(await funcionesApi.listarApis(c)) } catch { setApisDeFuncion([]) }
    finally { setCargandoApisFuncion(false) }
  }, [])

  const asignarAppAFuncion = async () => {
    if (!appNuevaFuncion || !funcionEditando) return; setAsignandoAppFuncion(true)
    try { await funcionesApi.asignarAplicacion(funcionEditando.codigo_funcion, appNuevaFuncion); setAppNuevaFuncion(''); cargarAppsDeFuncion(funcionEditando.codigo_funcion) }
    catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') } finally { setAsignandoAppFuncion(false) }
  }
  const quitarAppDeFuncion = async (c: string) => {
    if (!funcionEditando) return
    try { await funcionesApi.quitarAplicacion(funcionEditando.codigo_funcion, c); cargarAppsDeFuncion(funcionEditando.codigo_funcion) }
    catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') }
  }

  // ── Eliminacion ───────────────────────────────────────────────────────────
  const ejecutarEliminacion = async () => {
    if (!confirmacion) return; setEliminando(true)
    try {
      await funcionesApi.eliminar(confirmacion.codigo_funcion)
      setConfirmacion(null); cargar()
    } catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error'); setConfirmacion(null) }
    finally { setEliminando(false) }
  }

  // ── Traducir fila individual ───────────────────────────────────────────────
  const [sincronizando, setSincronizando] = useState<string | null>(null)
  const sincronizarFuncion = async (f: Funcion) => {
    if (sincronizando) return
    setSincronizando(f.codigo_funcion)
    try {
      const res = await funcionesApi.sincronizar(f.codigo_funcion)
      alert(res.mensaje)
    } catch (e) {
      alert(`Error sincronizando: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setSincronizando(null)
    }
  }

  const traducirFuncion = async (f: Funcion) => {
    if (traduciendo) return
    if (f.traducir === false) {
      alert(`La función "${f.nombre}" tiene desactivada la traducción (campo "traducir" = false).`)
      return
    }
    setTraduciendo(f.codigo_funcion)
    try {
      const res = await funcionesApi.traducir(f.codigo_funcion)
      const idiomas = res.idiomas?.join(', ') || '—'
      const campos = res.campos_traducidos?.join(', ') || '—'
      alert(`Traducción generada para "${f.nombre}".\nIdiomas: ${idiomas}\nCampos: ${campos}\nRegistros guardados: ${res.generadas}`)
    } catch (e) {
      alert(`Error traduciendo: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setTraduciendo(null)
    }
  }

  // ── Mover función (reordenar) ──────────────────────────────────────────────
  const reordenarFunciones = async (nuevas: Funcion[]) => {
    setFunciones(nuevas)
    try {
      await funcionesApi.reordenar(nuevas.map((f) => ({ codigo_funcion: f.codigo_funcion, orden: f.orden ?? 0 })))
    } catch { cargar() }
  }

  // ── Listas derivadas ──────────────────────────────────────────────────────
  const appsDisponiblesFuncion = aplicaciones.filter((a) => !appsDeFuncion.some((af) => af.codigo_aplicacion === a.codigo_aplicacion))
  const mapaAppNombre = Object.fromEntries(aplicaciones.map((a) => [a.codigo_aplicacion, a.nombre]))
  const funcionesFiltradas = busqueda
    ? funciones.filter((f) => f.nombre.toLowerCase().includes(busqueda.toLowerCase()) || f.codigo_funcion.toLowerCase().includes(busqueda.toLowerCase()) || (f.alias_de_funcion || '').toLowerCase().includes(busqueda.toLowerCase()))
    : funciones

  const esAdmin = grupoActivo === 'ADMIN'
  const TABS_MODAL = [
    { key: 'datos', label: 'Datos' },
    { key: 'otros', label: 'Otros Datos' },
    ...(funcionEditando ? [
      { key: 'aplicaciones', label: `Aplicaciones (${appsDeFuncion.length})` },
      ...(esAdmin ? [
        { key: 'system_prompt', label: 'System Prompt' },
        { key: 'vista', label: 'Vista' },
        { key: 'programacion_insert', label: 'Prog. Insert' },
        { key: 'programacion_update', label: 'Prog. Update' },
        { key: 'md', label: '.md' },
        { key: 'llm', label: 'LLM' },
      ] : []),
    ] : []),
  ] as { key: typeof tabModalFuncion; label: string }[]

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat />
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">Gestiona las funciones del sistema y sus relaciones con aplicaciones</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input placeholder={t('buscarPlaceholder')} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(funcionesFiltradas as unknown as Record<string, unknown>[], [{ titulo: 'Codigo', campo: 'codigo_funcion' }, { titulo: 'Alias', campo: 'alias_de_funcion' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Tipo', campo: 'tipo' }, { titulo: 'Icono', campo: 'icono_de_funcion' }, { titulo: 'URL', campo: 'url_funcion' }], `funciones_${grupoActivo || 'todos'}`)} disabled={funcionesFiltradas.length === 0}><Download size={15} />Excel</Boton>
          <Boton variante="primario" onClick={abrirNuevaFuncion}><Plus size={16} />{t('nuevaFuncion')}</Boton>
        </div>
      </div>

      <SortableDndContext items={funcionesFiltradas as unknown as Record<string, unknown>[]} getId={(f) => (f as Funcion).codigo_funcion} onReorder={(n) => reordenarFunciones(n as unknown as Funcion[])} disabled={!!busqueda}>
        <Tabla>
          <TablaCabecera><tr><TablaTh className="w-8" /><TablaTh className="w-28">{t('colTipo')}</TablaTh><TablaTh className="w-32">{t('colAlias')}</TablaTh><TablaTh>{t('colNombre')}</TablaTh><TablaTh className="w-40">{t('colUrl')}</TablaTh><TablaTh className="w-40">{t('colCodigo')}</TablaTh><TablaTh className="text-right w-28">{tc('acciones')}</TablaTh></tr></TablaCabecera>
          <TablaCuerpo>
            {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Cargando...</TablaTd></TablaFila>
            ) : funcionesFiltradas.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>No se encontraron funciones</TablaTd></TablaFila>
            ) : funcionesFiltradas.map((f) => (
              <SortableRow key={f.codigo_funcion} id={f.codigo_funcion} onDoubleClick={() => abrirEditarFuncion(f)}>
                <TablaTd>{badgeTipo(f.tipo_acceso)}</TablaTd>
                <TablaTd className="text-sm">{f.alias_de_funcion || '—'}</TablaTd>
                <TablaTd className="font-medium">{f.nombre}</TablaTd>
                <TablaTd className="text-xs">{f.url_funcion ? <a href={f.url_funcion} target="_blank" rel="noopener noreferrer" className="text-primario hover:underline">{f.url_funcion}</a> : <span className="text-texto-muted">—</span>}</TablaTd>
                <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{f.codigo_funcion}</code></TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => traducirFuncion(f)}
                      disabled={traduciendo === f.codigo_funcion || f.traducir === false}
                      className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={f.traducir === false ? 'Traducción desactivada para esta función' : 'Traducir esta función a todos los idiomas destino'}
                    >
                      {traduciendo === f.codigo_funcion ? <RefreshCw size={14} className="animate-spin" /> : <Languages size={14} />}
                    </button>
                    {grupoActivo === 'ADMIN' && (
                      <button onClick={() => abrirEditarFuncion(f, 'programacion_insert')} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editor de contexto"><Brain size={14} /></button>
                    )}
                    {grupoActivo === 'ADMIN' && (
                      <button
                        onClick={() => sincronizarFuncion(f)}
                        disabled={sincronizando === f.codigo_funcion}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Sincronizar (refrescar grafo de dependencias + doc virtual + APIs)"
                      >
                        {sincronizando === f.codigo_funcion ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      </button>
                    )}
                    <button onClick={() => abrirEditarFuncion(f)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => setConfirmacion(f)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                </TablaTd>
              </SortableRow>
            ))}
          </TablaCuerpo>
        </Tabla>
      </SortableDndContext>

      {/* ── MODAL FUNCION ── */}
      <Modal abierto={modalFuncion} alCerrar={() => setModalFuncion(false)} titulo={funcionEditando ? `Editar función: ${funcionEditando.nombre}` : 'Nueva función'} className="w-[960px] max-w-[95vw]">
        <div className="flex flex-col gap-4 min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-borde -mx-1 overflow-x-auto">
            {TABS_MODAL.map((tab) => (
              <button key={tab.key} onClick={() => setTabModalFuncion(tab.key)} className={`flex-1 text-center px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${tabModalFuncion === tab.key ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Datos */}
          {tabModalFuncion === 'datos' && (<>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-texto">{t('etiquetaNombre')}</label>
                <Input value={formFuncion.nombre} onChange={(e) => setFormFuncion({ ...formFuncion, nombre: e.target.value })} placeholder={t('placeholderNombre')} />
              </div>
              <div>
                <label className="text-sm font-medium text-texto">{t('etiquetaAlias')}</label>
                <Input value={formFuncion.alias_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, alias_de_funcion: e.target.value.substring(0, 40) })} placeholder={t('placeholderAlias')} maxLength={40} />
              </div>
              <div>
                <label className="text-sm font-medium text-texto">{t('etiquetaUrl')}</label>
                <Input value={formFuncion.url_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, url_funcion: e.target.value })} placeholder={t('placeholderUrl')} />
              </div>
              <div>
                <label className="text-sm font-medium text-texto">{t('etiquetaIcono')}</label>
                <Input value={formFuncion.icono_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, icono_de_funcion: e.target.value })} placeholder={t('placeholderIcono')} />
              </div>
              <div>
                <label className="text-sm font-medium text-texto">Tipo</label>
                <select value={formFuncion.tipo_acceso} onChange={(e) => setFormFuncion({ ...formFuncion, tipo_acceso: e.target.value as TipoFuncion })} className={selectClass}>
                  {TIPOS_ELEMENTO.map((t) => (
                    <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>
                  ))}
                </select>
              </div>
              {funcionEditando && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-texto">Código</label>
                  <Input value={formFuncion.codigo_funcion} disabled readOnly />
                </div>
              )}
              {!funcionEditando && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-texto">Código <span className="text-texto-muted">(opcional, autogenerado)</span></label>
                  <Input value={formFuncion.codigo_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_funcion: e.target.value.toUpperCase() })} placeholder="Dejar vacío para autogenerar" />
                </div>
              )}
            </div>
            {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
            <PieBotonesModal
              editando={!!funcionEditando}
              onGuardar={() => guardarFuncion(false)}
              onGuardarYSalir={() => guardarFuncion(true)}
              onCerrar={() => setModalFuncion(false)}
              cargando={guardandoFuncion}
            />
          </>)}

          {/* Tab Otros Datos */}
          {tabModalFuncion === 'otros' && (<>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Columna izquierda */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-sm font-medium text-texto">Aplicación origen</label>
                  <select value={formFuncion.codigo_aplicacion_origen} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_aplicacion_origen: e.target.value })} className={selectClass}>
                    <option value="">— sin asignar —</option>
                    {[...aplicaciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((a) => (
                      <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-texto">Descripción</label>
                  <textarea value={formFuncion.descripcion} onChange={(e) => setFormFuncion({ ...formFuncion, descripcion: e.target.value })} rows={3} className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario resize-none" />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formFuncion.traducir}
                      onChange={(e) => setFormFuncion({ ...formFuncion, traducir: e.target.checked })}
                      className="w-4 h-4 rounded accent-primario"
                    />
                    <span className="text-sm font-medium text-texto">Traducir</span>
                    <span className="text-xs text-texto-muted">— sistema de traducción automática</span>
                  </label>
                </div>
              </div>
              {/* Columna derecha */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-sm font-medium text-texto">Ayuda para el usuario</label>
                  <textarea value={formFuncion.ayuda_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, ayuda_de_funcion: e.target.value })} rows={3} placeholder="Texto descriptivo visible para el usuario final bajo el ícono de la función" className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario resize-none placeholder:text-texto-muted" />
                </div>
                <div>
                  <label className="text-sm font-medium text-texto mb-2 block">Permisos de operación</label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-fondo rounded-lg border border-borde">
                    {([
                      { key: 'perm_select', label: 'Consultar (SELECT)', disabled: false },
                      { key: 'perm_insert', label: 'Crear (INSERT)', disabled: false },
                      { key: 'perm_update', label: 'Modificar (UPDATE)', disabled: false },
                      { key: 'perm_delete', label: 'Eliminar (DELETE)', disabled: true },
                    ] as { key: 'perm_select' | 'perm_insert' | 'perm_update' | 'perm_delete'; label: string; disabled: boolean }[]).map(({ key, label, disabled }) => (
                      <label key={key} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={formFuncion[key]} disabled={disabled}
                          onChange={disabled ? undefined : (e) => setFormFuncion({ ...formFuncion, [key]: e.target.checked })}
                          className="w-4 h-4 rounded accent-primario disabled:cursor-not-allowed" />
                        <span className={disabled ? 'text-texto-muted' : 'text-texto'}>{label}</span>
                        {disabled && <span className="text-xs text-texto-muted">(solo BD)</span>}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
            <PieBotonesModal
              editando={!!funcionEditando}
              onGuardar={() => guardarFuncion(false)}
              onGuardarYSalir={() => guardarFuncion(true)}
              onCerrar={() => setModalFuncion(false)}
              cargando={guardandoFuncion}
            />
          </>)}

          {/* Tab Aplicaciones */}
          {tabModalFuncion === 'aplicaciones' && funcionEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2"><div className="flex-1"><select value={appNuevaFuncion} onChange={(e) => setAppNuevaFuncion(e.target.value)} className={selectClass}><option value="">Seleccionar aplicación...</option>{appsDisponiblesFuncion.map((a) => (<option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre}</option>))}</select></div><Boton variante="primario" onClick={asignarAppAFuncion} cargando={asignandoAppFuncion} disabled={!appNuevaFuncion}><Plus size={14} />Asignar</Boton></div>
              {cargandoAppsFuncion ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : appsDeFuncion.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene aplicaciones asignadas</p>
              : <div className="flex flex-col gap-2">{appsDeFuncion.map((af) => (<div key={af.codigo_aplicacion} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"><div><span className="text-sm font-medium text-texto">{af.aplicaciones?.nombre_aplicacion || af.codigo_aplicacion}</span><span className="ml-2 text-xs text-texto-muted">{af.codigo_aplicacion}</span></div><button onClick={() => quitarAppDeFuncion(af.codigo_aplicacion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button></div>))}</div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton></div>
            </div>
          )}

          {/* Tab APIs */}
          {tabModalFuncion === 'apis' && funcionEditando && (
            <div className="flex flex-col gap-3">
              {cargandoApisFuncion ? (
                <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              ) : apisDeFuncion.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-8">No hay endpoints API asociados a esta función</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-borde">
                        <th className="text-left px-3 py-2 text-xs font-medium text-texto-muted w-20">Método</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-texto-muted w-24">Tipo</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-texto-muted">Ruta</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-texto-muted">Nombre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apisDeFuncion.map((api) => {
                        const colorMetodo: Record<string, string> = {
                          GET: 'bg-blue-100 text-blue-700',
                          POST: 'bg-green-100 text-green-700',
                          PUT: 'bg-yellow-100 text-yellow-700',
                          PATCH: 'bg-orange-100 text-orange-700',
                          DELETE: 'bg-red-100 text-red-700',
                        }
                        const colorTipo: Record<string, string> = {
                          USUARIO: 'bg-green-50 text-green-700',
                          ADMINISTRADOR: 'bg-yellow-50 text-yellow-700',
                          SISTEMA: 'bg-red-50 text-red-700',
                        }
                        return (
                          <tr key={api.id_api} className="border-b border-borde/50 hover:bg-fondo transition-colors">
                            <td className="px-3 py-2">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${colorMetodo[api.metodo_http] || 'bg-surface text-texto'}`}>
                                {api.metodo_http}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorTipo[api.tipo_acceso] || 'bg-surface text-texto'}`}>
                                {api.tipo_acceso}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <code className="text-xs text-texto font-mono">{api.ruta_api}</code>
                            </td>
                            <td className="px-3 py-2 text-xs text-texto-muted">{api.nombre_api}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalFuncion === 'system_prompt' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">System Prompt (instrucción base para el LLM)</label>
                <textarea
                  value={formFuncion.system_prompt || ''}
                  onChange={(e) => setFormFuncion({ ...formFuncion, system_prompt: e.target.value })}
                  rows={13}
                  placeholder="Instrucción base al LLM (se inyecta en system_prompt del chat)."
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto font-mono focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>
              {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
              <PieBotonesModal
                editando={!!funcionEditando}
                onGuardar={() => guardarFuncion(false)}
                onGuardarYSalir={() => guardarFuncion(true)}
                onCerrar={() => setModalFuncion(false)}
                cargando={guardandoFuncion}
              />
            </div>
          )}

          {/* Tab Programación Insert */}
          {tabModalFuncion === 'programacion_insert' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="funciones"
                pkColumna="codigo_funcion"
                pkValor={funcionEditando.codigo_funcion}
                campos={{
                  prompt_insert: formFuncion.prompt_insert,
                  prompt_update: formFuncion.prompt_update,
                  system_prompt: formFuncion.system_prompt,
                  python_insert: formFuncion.python_insert,
                  python_update: formFuncion.python_update,
                  javascript: formFuncion.javascript,
                  python_editado_manual: formFuncion.python_editado_manual,
                  javascript_editado_manual: formFuncion.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormFuncion({ ...formFuncion, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptUpdate={false}
                mostrarPythonUpdate={false}
              />
              {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
              <PieBotonesModal
                editando={!!funcionEditando}
                onGuardar={() => guardarFuncion(false)}
                onGuardarYSalir={() => guardarFuncion(true)}
                onCerrar={() => setModalFuncion(false)}
                cargando={guardandoFuncion}
                botonesIzquierda={funcionEditando ? (
                  <PieBotonesPrompts
                    tabla="funciones"
                    pkColumna="codigo_funcion"
                    pkValor={funcionEditando.codigo_funcion}
                    promptInsert={formFuncion.prompt_insert ?? undefined}
                    promptUpdate={formFuncion.prompt_update ?? undefined}
                    modo="insert"
                    mostrarSincronizar={false}
                  />
                ) : undefined}
              />
            </div>
          )}
          {/* Tab Programación Update */}
          {tabModalFuncion === 'programacion_update' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <TabPrompts
                tabla="funciones"
                pkColumna="codigo_funcion"
                pkValor={funcionEditando.codigo_funcion}
                campos={{
                  prompt_insert: formFuncion.prompt_insert,
                  prompt_update: formFuncion.prompt_update,
                  system_prompt: formFuncion.system_prompt,
                  python_insert: formFuncion.python_insert,
                  python_update: formFuncion.python_update,
                  javascript: formFuncion.javascript,
                  python_editado_manual: formFuncion.python_editado_manual,
                  javascript_editado_manual: formFuncion.javascript_editado_manual,
                }}
                onCampoCambiado={(c, v) => setFormFuncion({ ...formFuncion, [c]: v })}
                mostrarSystemPrompt={false}
                mostrarJavaScript={false}
                mostrarPromptInsert={false}
                mostrarPythonInsert={false}
              />
              {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
              <PieBotonesModal
                editando={!!funcionEditando}
                onGuardar={() => guardarFuncion(false)}
                onGuardarYSalir={() => guardarFuncion(true)}
                onCerrar={() => setModalFuncion(false)}
                cargando={guardandoFuncion}
                botonesIzquierda={funcionEditando ? (
                  <PieBotonesPrompts
                    tabla="funciones"
                    pkColumna="codigo_funcion"
                    pkValor={funcionEditando.codigo_funcion}
                    promptInsert={formFuncion.prompt_insert ?? undefined}
                    promptUpdate={formFuncion.prompt_update ?? undefined}
                    modo="update"
                    mostrarSincronizar={false}
                  />
                ) : undefined}
              />
            </div>
          )}

          {/* Tab Vista */}
          {tabModalFuncion === 'vista' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Prompt Vista (instrucción al LLM)</label>
                <textarea
                  value={formFuncion.prompt_view || ''}
                  onChange={(e) => setFormFuncion({ ...formFuncion, prompt_view: e.target.value })}
                  rows={8}
                  placeholder="Instrucción al LLM para generar la vista SQL del chat. Usa {codigo_funcion}, {codigo_funcion_snake}, {nombre_funcion} como placeholders."
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto font-mono focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">SQL Vista (generado por el LLM)</label>
                <textarea
                  value={formFuncion.sql_view || ''}
                  onChange={(e) => setFormFuncion({ ...formFuncion, sql_view: e.target.value })}
                  rows={12}
                  placeholder="Aquí aparecerá el CREATE OR REPLACE VIEW generado. También se puede editar manualmente antes de Sincronizar."
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto font-mono focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>
              {mensajeVista && (
                <p className={`text-xs px-1 ${mensajeVista.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeVista.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoVista(true); setMensajeVista(null)
                      try {
                        const r = await funcionesApi.generarVista(funcionEditando.codigo_funcion)
                        setFormFuncion((prev) => ({ ...prev, sql_view: r.sql_view }))
                        setMensajeVista({ tipo: 'ok', texto: 'SQL de vista generado correctamente. Revisa antes de Sincronizar.' })
                      } catch (e) {
                        setMensajeVista({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoVista(false) }
                    }}
                    cargando={generandoVista}
                    disabled={generandoVista || sincronizandoVista || !formFuncion.prompt_view}
                  >
                    Generar
                  </Boton>
                  <Boton
                    className="bg-primario-light hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setSincronizandoVista(true); setMensajeVista(null)
                      try {
                        // Primero guardar la función para persistir cambios manuales en sql_view
                        await funcionesApi.actualizar(funcionEditando.codigo_funcion, {
                          sql_view: formFuncion.sql_view,
                          prompt_view: formFuncion.prompt_view,
                        } as Partial<Funcion>)
                        const r = await funcionesApi.sincronizarVista(funcionEditando.codigo_funcion)
                        setMensajeVista({ tipo: 'ok', texto: r.mensaje || 'Vista sincronizada correctamente en la BD.' })
                      } catch (e) {
                        setMensajeVista({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoVista(false) }
                    }}
                    cargando={sincronizandoVista}
                    disabled={generandoVista || sincronizandoVista || !formFuncion.sql_view}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {/* Tab .md */}
          {tabModalFuncion === 'md' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={formFuncion.md || ''}
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
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMd(true); setMensajeMd(null)
                      try {
                        const r = await funcionesApi.generarMd(funcionEditando.codigo_funcion)
                        setFormFuncion((prev) => ({ ...prev, md: r.md }))
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
                        const r = await promptsApi.sincronizarFila('funciones', 'codigo_funcion', funcionEditando.codigo_funcion)
                        setMensajeMd({ tipo: 'ok', texto: `Documento ${r.accion} (código ${r.codigo_documento}). Listo para CHUNKEAR + VECTORIZAR.` })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMd(false) }
                    }}
                    cargando={sincronizandoMd}
                    disabled={generandoMd || sincronizandoMd || !formFuncion.md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {/* Tab LLM */}
          {tabModalFuncion === 'llm' && funcionEditando && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-texto-muted">Modelo LLM a usar cuando se invoca esta función. Si está vacío, la función no usa LLM directamente.</p>
              <div>
                <label className="text-sm font-medium text-texto">Modelo LLM</label>
                <select
                  value={formFuncion.id_modelo}
                  onChange={(e) => setFormFuncion({ ...formFuncion, id_modelo: e.target.value })}
                  className={selectClass}
                >
                  <option value="">— Sin LLM —</option>
                  {modelosLLM.map((m) => (
                    <option key={m.id_modelo} value={String(m.id_modelo)}>
                      {m.nombre_visible} ({m.proveedor})
                    </option>
                  ))}
                </select>
              </div>
              {!formFuncion.id_modelo && (
                <p className="text-xs text-texto-muted">Sin modelo seleccionado. El chat fallará si esta función se usa para conversaciones LLM.</p>
              )}
              {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
              <PieBotonesModal
                editando={!!funcionEditando}
                onGuardar={() => guardarFuncion(false)}
                onGuardarYSalir={() => guardarFuncion(true)}
                onCerrar={() => setModalFuncion(false)}
                cargando={guardandoFuncion}
              />
            </div>
          )}

        </div>
      </Modal>

      {/* ── MODAL CONFIRMAR ── */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo={t('eliminarFuncion')}
        mensaje={confirmacion ? `¿Estás seguro de eliminar la función "${confirmacion.nombre}"? Se eliminarán todas las asignaciones.` : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
