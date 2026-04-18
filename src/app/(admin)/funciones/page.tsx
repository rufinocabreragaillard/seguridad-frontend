'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Download, Search, RefreshCw } from 'lucide-react'
import { SortableDndContext, SortableRow, SortableListItem } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { BotonChat } from '@/components/ui/boton-chat'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { aplicacionesApi, funcionesApi, procesosApi, registroLLMApi } from '@/lib/api'
import type { Proceso } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Aplicacion, Funcion, RegistroLLM } from '@/lib/tipos'
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
    tipo: TipoFuncion
    id_modelo: string
    system_prompt: string
    prompt: string
    perm_select: boolean
    perm_insert: boolean
    perm_update: boolean
    perm_delete: boolean
    traducir: boolean
  }>({
    codigo_funcion: '', nombre: '', descripcion: '', ayuda_de_funcion: '', url_funcion: '',
    alias_de_funcion: '', icono_de_funcion: '', codigo_aplicacion_origen: '',
    tipo: 'USUARIO', id_modelo: '', system_prompt: '', prompt: '',
    perm_select: true, perm_insert: true, perm_update: true, perm_delete: true,
    traducir: true,
  })
  const [tabModalFuncion, setTabModalFuncion] = useState<'datos' | 'otros' | 'aplicaciones' | 'procesos' | 'prompt' | 'system_prompt' | 'llm'>('datos')
  const [guardandoFuncion, setGuardandoFuncion] = useState(false)
  const [errorFuncion, setErrorFuncion] = useState('')

  // Aplicaciones de la funcion
  const [appsDeFuncion, setAppsDeFuncion] = useState<AppDeFuncion[]>([])
  const [cargandoAppsFuncion, setCargandoAppsFuncion] = useState(false)
  const [appNuevaFuncion, setAppNuevaFuncion] = useState('')
  const [asignandoAppFuncion, setAsignandoAppFuncion] = useState(false)

  // Procesos de la función
  const [procesosDeFuncion, setProcesosDeFuncion] = useState<Proceso[]>([])
  const [cargandoProcesos, setCargandoProcesos] = useState(false)

  // Confirmar eliminacion
  const [confirmacion, setConfirmacion] = useState<Funcion | null>(null)
  const [eliminando, setEliminando] = useState(false)

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
      setModelosLLM(llms.filter((m: RegistroLLM) => m.activo))
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
      tipo: 'USUARIO', id_modelo: '', system_prompt: '', prompt: '',
      perm_select: true, perm_insert: true, perm_update: true, perm_delete: true,
      traducir: true,
    })
    setErrorFuncion(''); setTabModalFuncion('datos'); setModalFuncion(true)
  }
  const cargarProcesosDeFuncion = useCallback(async (c: string) => {
    setCargandoProcesos(true)
    try { setProcesosDeFuncion(await procesosApi.listar('DOCUMENTOS', c)) } catch { setProcesosDeFuncion([]) }
    finally { setCargandoProcesos(false) }
  }, [])

  const reordenarProcesos = async (nuevos: Proceso[]) => {
    setProcesosDeFuncion(nuevos)
    try {
      await procesosApi.reordenar(nuevos.map((p) => ({ codigo_proceso: p.codigo_proceso, orden: p.orden ?? 0 })))
    } catch { cargarProcesosDeFuncion(funcionEditando!.codigo_funcion) }
  }

  const abrirEditarFuncion = (f: Funcion) => {
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
      tipo: normalizarTipo(f.tipo),
      id_modelo: f.id_modelo ? String(f.id_modelo) : '',
      system_prompt: (f as Funcion & { system_prompt?: string }).system_prompt || '',
      prompt: (f as Funcion & { prompt?: string }).prompt || '',
      perm_select: f.perm_select ?? true,
      perm_insert: f.perm_insert ?? true,
      perm_update: f.perm_update ?? true,
      perm_delete: f.perm_delete ?? true,
      traducir: f.traducir ?? true,
    })
    setErrorFuncion('')
    setTabModalFuncion('datos')
    cargarAppsDeFuncion(f.codigo_funcion)
    cargarProcesosDeFuncion(f.codigo_funcion)
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
        prompt: formFuncion.prompt || null,
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

  const TABS_MODAL = [
    { key: 'datos', label: 'Datos' },
    { key: 'otros', label: 'Otros Datos' },
    ...(funcionEditando ? [
      { key: 'aplicaciones', label: `Aplicaciones (${appsDeFuncion.length})` },
      { key: 'procesos', label: `Procesos de Función (${procesosDeFuncion.length})` },
      { key: 'prompt', label: 'Prompt' },
      { key: 'system_prompt', label: 'System Prompt' },
      { key: 'llm', label: 'LLM' },
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
          <TablaCabecera><tr><TablaTh className="w-8" /><TablaTh className="w-28">{t('colTipo')}</TablaTh><TablaTh className="w-32">{t('colAlias')}</TablaTh><TablaTh>{t('colNombre')}</TablaTh><TablaTh className="w-40">{t('colUrl')}</TablaTh><TablaTh className="w-40">{t('colCodigo')}</TablaTh><TablaTh className="text-right w-20">{tc('acciones')}</TablaTh></tr></TablaCabecera>
          <TablaCuerpo>
            {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>Cargando...</TablaTd></TablaFila>
            ) : funcionesFiltradas.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>No se encontraron funciones</TablaTd></TablaFila>
            ) : funcionesFiltradas.map((f) => (
              <SortableRow key={f.codigo_funcion} id={f.codigo_funcion}>
                <TablaTd>{badgeTipo(f.tipo)}</TablaTd>
                <TablaTd className="text-sm">{f.alias_de_funcion || '—'}</TablaTd>
                <TablaTd className="font-medium">{f.nombre}</TablaTd>
                <TablaTd className="text-xs">{f.url_funcion ? <a href={f.url_funcion} target="_blank" rel="noopener noreferrer" className="text-primario hover:underline">{f.url_funcion}</a> : <span className="text-texto-muted">—</span>}</TablaTd>
                <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{f.codigo_funcion}</code></TablaTd>
                <TablaTd>
                  <div className="flex items-center justify-end gap-1">
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
      <Modal abierto={modalFuncion} alCerrar={() => setModalFuncion(false)} titulo={funcionEditando ? `Editar: ${funcionEditando.nombre}` : 'Nueva función'} className="w-[700px] max-w-[95vw]">
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex border-b border-borde -mx-1 overflow-x-auto">
            {TABS_MODAL.map((tab) => (
              <button key={tab.key} onClick={() => setTabModalFuncion(tab.key)} className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${tabModalFuncion === tab.key ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>
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
                <select value={formFuncion.tipo} onChange={(e) => setFormFuncion({ ...formFuncion, tipo: e.target.value as TipoFuncion })} className={selectClass}>
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
            <div className="flex gap-3 justify-end pt-2"><Boton variante="primario" onClick={() => guardarFuncion(false)} cargando={guardandoFuncion}>{funcionEditando ? tc('grabar') : t('crearFuncion')}</Boton><Boton variante="secundario" onClick={() => guardarFuncion(true)} cargando={guardandoFuncion}>{tc('grabarYSalir')}</Boton><Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton></div>
          </>)}

          {/* Tab Otros Datos */}
          {tabModalFuncion === 'otros' && (<>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-texto">Aplicación origen</label>
                <select value={formFuncion.codigo_aplicacion_origen} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_aplicacion_origen: e.target.value })} className={selectClass}>
                  <option value="">— sin asignar —</option>
                  {[...aplicaciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((a) => (
                    <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-texto">Descripción</label>
                <textarea value={formFuncion.descripcion} onChange={(e) => setFormFuncion({ ...formFuncion, descripcion: e.target.value })} rows={2} className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario resize-none" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-texto">Ayuda para el usuario</label>
                <textarea value={formFuncion.ayuda_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, ayuda_de_funcion: e.target.value })} rows={2} placeholder="Texto descriptivo visible para el usuario final bajo el ícono de la función" className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario resize-none placeholder:text-texto-muted" />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formFuncion.traducir}
                    onChange={(e) => setFormFuncion({ ...formFuncion, traducir: e.target.checked })}
                    className="w-4 h-4 rounded accent-primario"
                  />
                  <span className="text-sm font-medium text-texto">Traducir</span>
                  <span className="text-xs text-texto-muted">— incluir en el sistema de traducción automática</span>
                </label>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-texto mb-2 block">Permisos de operación</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-fondo rounded-lg border border-borde">
                  {([
                    { key: 'perm_select', label: 'Consultar (SELECT)', disabled: false },
                    { key: 'perm_insert', label: 'Crear (INSERT)', disabled: false },
                    { key: 'perm_update', label: 'Modificar (UPDATE)', disabled: false },
                    { key: 'perm_delete', label: 'Eliminar (DELETE)', disabled: true },
                  ] as { key: 'perm_select' | 'perm_insert' | 'perm_update' | 'perm_delete'; label: string; disabled: boolean }[]).map(({ key, label, disabled }) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={formFuncion[key]}
                        disabled={disabled}
                        onChange={disabled ? undefined : (e) => setFormFuncion({ ...formFuncion, [key]: e.target.checked })}
                        className="w-4 h-4 rounded accent-primario disabled:cursor-not-allowed"
                      />
                      <span className={disabled ? 'text-texto-muted' : 'text-texto'}>{label}</span>
                      {disabled && <span className="text-xs text-texto-muted">(solo BD)</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
            <div className="flex gap-3 justify-end pt-2"><Boton variante="primario" onClick={() => guardarFuncion(false)} cargando={guardandoFuncion}>{funcionEditando ? tc('grabar') : t('crearFuncion')}</Boton><Boton variante="secundario" onClick={() => guardarFuncion(true)} cargando={guardandoFuncion}>{tc('grabarYSalir')}</Boton><Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton></div>
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

          {/* Tab Procesos de Función */}
          {tabModalFuncion === 'procesos' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">Procesos asociados a esta función, en el orden en que se ejecutan.</p>
              {cargandoProcesos ? (
                <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              ) : procesosDeFuncion.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-texto-muted">
                  <RefreshCw size={24} className="opacity-30" />
                  <p className="text-sm">No hay procesos asignados a esta función</p>
                  <p className="text-xs">Asigna procesos desde el mantenedor de Procesos</p>
                </div>
              ) : (
                <SortableDndContext items={procesosDeFuncion as unknown as Record<string, unknown>[]} getId={(p) => (p as Proceso).codigo_proceso} onReorder={(n) => reordenarProcesos(n as unknown as Proceso[])}>
                  <div className="flex flex-col gap-1">
                    {procesosDeFuncion.map((p) => (
                      <SortableListItem key={p.codigo_proceso} id={p.codigo_proceso} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-borde bg-surface">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-texto">{p.nombre_proceso}</span>
                          <span className="ml-2 text-xs text-texto-muted">{p.codigo_proceso}</span>
                        </div>
                        {p.pasos?.[0] && (
                          <span className="text-xs text-texto-muted shrink-0">
                            {p.pasos[0].estado_origen || '—'} → {p.pasos[0].estado_destino}
                          </span>
                        )}
                      </SortableListItem>
                    ))}
                  </div>
                </SortableDndContext>
              )}
              <div className="flex justify-end pt-2">
                <Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {/* Tab Prompt */}
          {tabModalFuncion === 'prompt' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">Texto que se inyecta como contexto del usuario al invocar esta función con un LLM.</p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Contexto específico para esta función..."
                value={formFuncion.prompt}
                onChange={(e) => setFormFuncion({ ...formFuncion, prompt: e.target.value })}
              />
              {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
              <div className="flex gap-3 justify-end pt-2"><Boton variante="primario" onClick={() => guardarFuncion(false)} cargando={guardandoFuncion}>{tc('grabar')}</Boton><Boton variante="secundario" onClick={() => guardarFuncion(true)} cargando={guardandoFuncion}>{tc('grabarYSalir')}</Boton><Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton></div>
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModalFuncion === 'system_prompt' && funcionEditando && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-texto-muted">Instrucciones de sistema para el LLM cuando se invoca esta función. Define el tono, restricciones y rol del asistente.</p>
              <textarea
                className="w-full h-48 p-3 text-sm border border-borde rounded-lg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primario/30"
                placeholder="Ej: Eres un asistente especializado en..."
                value={formFuncion.system_prompt}
                onChange={(e) => setFormFuncion({ ...formFuncion, system_prompt: e.target.value })}
              />
              {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
              <div className="flex gap-3 justify-end pt-2"><Boton variante="primario" onClick={() => guardarFuncion(false)} cargando={guardandoFuncion}>{tc('grabar')}</Boton><Boton variante="secundario" onClick={() => guardarFuncion(true)} cargando={guardandoFuncion}>{tc('grabarYSalir')}</Boton><Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton></div>
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
              <div className="flex gap-3 justify-end pt-2"><Boton variante="primario" onClick={() => guardarFuncion(false)} cargando={guardandoFuncion}>{tc('grabar')}</Boton><Boton variante="secundario" onClick={() => guardarFuncion(true)} cargando={guardandoFuncion}>{tc('grabarYSalir')}</Boton><Boton variante="contorno" onClick={() => setModalFuncion(false)}>{tc('salir')}</Boton></div>
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
