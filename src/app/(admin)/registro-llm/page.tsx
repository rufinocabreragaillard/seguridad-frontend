'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Download, Loader2, Pencil, Plus, RefreshCw, Search, Send, Trash2, XCircle, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { registroLLMApi, llmCredencialesApi, llmPreciosApi, llmUsoApi, promptsApi } from '@/lib/api'
import type { LLMCredencial, LLMPrecio, LLMUsoFila, LLMUsoResumen } from '@/lib/api'
import type { RegistroLLM } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'
import { BotonChat } from '@/components/ui/boton-chat'
import { useAuth } from '@/context/AuthContext'

type Proveedor = 'anthropic' | 'google' | 'openai' | 'deepseek'

function fmtUsd(n: number | undefined | null) {
  return `$${(Number(n) || 0).toFixed(4)}`
}

function fmtInt(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString('es-CL')
}

export default function PaginaRegistroLLM() {
  const t = useTranslations('registroLlm')
  const tc = useTranslations('common')
  const tConfig = useTranslations('llmConfiguracion')
  const tUso = useTranslations('llmUso')
  const { grupoActivo, esSuperAdmin: chkSuperAdmin } = useAuth()
  const esSuperAdmin = chkSuperAdmin()

  const [tabPagina, setTabPagina] = useState<'modelos' | 'configuracion' | 'uso'>('modelos')

  const tabStyle = (activo: boolean) =>
    `pb-3 text-sm font-medium border-b-2 transition ${
      activo
        ? 'border-primario text-primario'
        : 'border-transparent text-texto-muted hover:text-texto'
    }`

  // ══════════════════════════════════════════
  // TAB 1 — Modelos LLM
  // ══════════════════════════════════════════
  const [modelos, setModelos] = useState<RegistroLLM[]>([])
  const [cargandoModelos, setCargandoModelos] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalModelo, setModalModelo] = useState(false)
  const [editandoModelo, setEditandoModelo] = useState<RegistroLLM | null>(null)
  const [tabModal, setTabModal] = useState<'datos' | 'probar' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [md, setMd] = useState('')
  const [formModelo, setFormModelo] = useState({
    proveedor: '', nombre_tecnico: '', nombre_visible: '', descripcion: '', estado_valido: false,
    prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false,
  })
  const [guardandoModelo, setGuardandoModelo] = useState(false)
  const [errorModelo, setErrorModelo] = useState('')
  const [mensajePrueba, setMensajePrueba] = useState('')
  const [respuestaPrueba, setRespuestaPrueba] = useState<{ respuesta: string; tiempo_ms: number; modelo: string } | null>(null)
  const [errorPrueba, setErrorPrueba] = useState('')
  const [probando, setProbando] = useState(false)
  const [confirmacionModelo, setConfirmacionModelo] = useState<RegistroLLM | null>(null)
  const [eliminandoModelo, setEliminandoModelo] = useState(false)

  const cargarModelos = useCallback(async () => {
    setCargandoModelos(true)
    try {
      setModelos(await registroLLMApi.listar())
    } finally {
      setCargandoModelos(false)
    }
  }, [])

  useEffect(() => { cargarModelos() }, [cargarModelos])

  const abrirNuevoModelo = () => {
    setEditandoModelo(null)
    setFormModelo({ proveedor: '', nombre_tecnico: '', nombre_visible: '', descripcion: '', estado_valido: false, prompt_insert: '', prompt_update: '', system_prompt: '', python_insert: '', python_update: '', javascript: '', python_editado_manual: false, javascript_editado_manual: false })
    setErrorModelo('')
    setModalModelo(true)
  }

  const abrirEditarModelo = (m: RegistroLLM) => {
    setEditandoModelo(m)
    const m2 = m as unknown as Record<string, unknown>
    setFormModelo({
      proveedor: m.proveedor,
      nombre_tecnico: m.nombre_tecnico,
      nombre_visible: m.nombre_visible,
      descripcion: m.descripcion || '',
      estado_valido: m.estado_valido,
      prompt_insert: m2.prompt_insert as string || '',
      prompt_update: m2.prompt_update as string || '',
      system_prompt: m2.system_prompt as string || '',
      python_insert: m2.python_insert as string || '',
      python_update: m2.python_update as string || '',
      javascript: m2.javascript as string || '',
      python_editado_manual: m2.python_editado_manual as boolean || false,
      javascript_editado_manual: m2.javascript_editado_manual as boolean || false,
    })
    setErrorModelo('')
    setTabModal('datos')
    setMensajePrueba('')
    setRespuestaPrueba(null)
    setErrorPrueba('')
    setMd((m as unknown as Record<string, unknown>).md as string || '')
    setMensajeMd(null)
    setModalModelo(true)
  }

  const probarConexion = async () => {
    if (!editandoModelo || !mensajePrueba.trim()) return
    setProbando(true)
    setRespuestaPrueba(null)
    setErrorPrueba('')
    try {
      const res = await registroLLMApi.probar(editandoModelo.id_modelo, mensajePrueba)
      setRespuestaPrueba(res)
    } catch (e) {
      setErrorPrueba(e instanceof Error ? e.message : t('errorAlProbar'))
    } finally {
      setProbando(false)
    }
  }

  const guardarModelo = async (cerrar: boolean) => {
    if (!formModelo.proveedor.trim() || !formModelo.nombre_tecnico.trim() || !formModelo.nombre_visible.trim()) {
      setErrorModelo(t('errorCamposObligatorios'))
      return
    }
    setGuardandoModelo(true)
    try {
      if (editandoModelo) {
        await registroLLMApi.actualizar(editandoModelo.id_modelo, {
          proveedor: formModelo.proveedor,
          nombre_tecnico: formModelo.nombre_tecnico,
          nombre_visible: formModelo.nombre_visible,
          descripcion: formModelo.descripcion || undefined,
          estado_valido: formModelo.estado_valido,
          prompt_insert: formModelo.prompt_insert || undefined,
          prompt_update: formModelo.prompt_update || undefined,
          system_prompt: formModelo.system_prompt || undefined,
          python_insert: formModelo.python_insert || undefined,
          python_update: formModelo.python_update || undefined,
          javascript: formModelo.javascript || undefined,
          python_editado_manual: formModelo.python_editado_manual,
          javascript_editado_manual: formModelo.javascript_editado_manual,
        } as Record<string, unknown>)
      } else {
        const nuevo = await registroLLMApi.crear({
          proveedor: formModelo.proveedor,
          nombre_tecnico: formModelo.nombre_tecnico,
          nombre_visible: formModelo.nombre_visible,
          descripcion: formModelo.descripcion || undefined,
        })
        if (!cerrar && nuevo) setEditandoModelo(nuevo)
      }
      if (cerrar) setModalModelo(false)
      cargarModelos()
    } catch (e) {
      setErrorModelo(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardandoModelo(false)
    }
  }

  const ejecutarEliminacionModelo = async () => {
    if (!confirmacionModelo) return
    setEliminandoModelo(true)
    try {
      await registroLLMApi.desactivar(confirmacionModelo.id_modelo)
      setConfirmacionModelo(null)
      cargarModelos()
    } finally {
      setEliminandoModelo(false)
    }
  }

  const filtrados = modelos
    .filter((m) =>
      m.proveedor.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.nombre_tecnico.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.nombre_visible.toLowerCase().includes(busqueda.toLowerCase())
    )
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor) || a.nombre_visible.localeCompare(b.nombre_visible))

  // ══════════════════════════════════════════
  // TAB 2 — Configuración
  // ══════════════════════════════════════════
  const [tabConfig, setTabConfig] = useState<'credenciales' | 'precios'>('credenciales')
  const [credenciales, setCredenciales] = useState<LLMCredencial[]>([])
  const [cargandoCredenciales, setCargandoCredenciales] = useState(true)
  const [modalCredencial, setModalCredencial] = useState(false)
  const [editandoCredencial, setEditandoCredencial] = useState<LLMCredencial | null>(null)
  const [formCredencial, setFormCredencial] = useState({
    proveedor: 'anthropic' as Proveedor,
    alias: 'default',
    api_key: '',
    limite_usd_mes: '' as string,
  })
  const [guardandoCredencial, setGuardandoCredencial] = useState(false)
  const [errorCredencial, setErrorCredencial] = useState('')
  const [confirmacionCredencial, setConfirmacionCredencial] = useState<LLMCredencial | null>(null)
  const [eliminandoCredencial, setEliminandoCredencial] = useState(false)
  const [probandoKey, setProbandoKey] = useState<string | null>(null)
  const [resultadoPrueba, setResultadoPrueba] = useState<{
    key: string; ok: boolean; mensaje: string; tiempo_ms: number
  } | null>(null)

  const cargarCredenciales = useCallback(async () => {
    setCargandoCredenciales(true)
    try {
      setCredenciales(await llmCredencialesApi.listar())
    } finally {
      setCargandoCredenciales(false)
    }
  }, [])

  useEffect(() => {
    if (tabPagina === 'configuracion') cargarCredenciales()
  }, [tabPagina, cargarCredenciales, grupoActivo])

  const abrirNuevaCredencial = () => {
    setEditandoCredencial(null)
    setFormCredencial({ proveedor: 'anthropic', alias: 'default', api_key: '', limite_usd_mes: '' })
    setErrorCredencial('')
    setModalCredencial(true)
  }

  const abrirEditarCredencial = (c: LLMCredencial) => {
    setEditandoCredencial(c)
    setFormCredencial({
      proveedor: c.proveedor,
      alias: c.alias,
      api_key: '',
      limite_usd_mes: c.limite_usd_mes !== null ? String(c.limite_usd_mes) : '',
    })
    setErrorCredencial('')
    setModalCredencial(true)
  }

  const guardarCredencial = async (cerrar = true) => {
    setErrorCredencial('')
    setGuardandoCredencial(true)
    try {
      const limite = formCredencial.limite_usd_mes.trim() === '' ? null : Number(formCredencial.limite_usd_mes)
      if (editandoCredencial) {
        await llmCredencialesApi.actualizar(editandoCredencial.proveedor, editandoCredencial.alias, {
          api_key: formCredencial.api_key || undefined,
          limite_usd_mes: limite,
        })
      } else {
        if (!formCredencial.api_key) {
          setErrorCredencial(tConfig('errorApiKeyObligatoria'))
          setGuardandoCredencial(false)
          return
        }
        await llmCredencialesApi.crear({
          proveedor: formCredencial.proveedor,
          alias: formCredencial.alias || 'default',
          api_key: formCredencial.api_key,
          limite_usd_mes: limite,
        })
      }
      if (cerrar) setModalCredencial(false)
      cargarCredenciales()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setErrorCredencial(err.response?.data?.detail || err.message || tConfig('errorAlGuardar'))
    } finally {
      setGuardandoCredencial(false)
    }
  }

  const eliminarCredencial = async () => {
    if (!confirmacionCredencial) return
    setEliminandoCredencial(true)
    try {
      await llmCredencialesApi.eliminar(confirmacionCredencial.proveedor, confirmacionCredencial.alias)
      setConfirmacionCredencial(null)
      cargarCredenciales()
    } finally {
      setEliminandoCredencial(false)
    }
  }

  const probarCredencial = async (c: LLMCredencial) => {
    const key = `${c.proveedor}/${c.alias}`
    setProbandoKey(key)
    setResultadoPrueba(null)
    try {
      const r = await llmCredencialesApi.probar(c.proveedor, c.alias)
      setResultadoPrueba({ key, ...r })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setResultadoPrueba({ key, ok: false, mensaje: err.response?.data?.detail || tConfig('errorAlProbar'), tiempo_ms: 0 })
    } finally {
      setProbandoKey(null)
    }
  }

  const [precios, setPrecios] = useState<LLMPrecio[]>([])
  const [cargandoPrecios, setCargandoPrecios] = useState(false)
  const [editandoPrecio, setEditandoPrecio] = useState<LLMPrecio | null>(null)
  const [formPrecio, setFormPrecio] = useState({
    precio_input_1m: 0, precio_output_1m: 0, precio_cache_read_1m: 0, precio_cache_write_1m: 0,
  })

  const cargarPrecios = useCallback(async () => {
    setCargandoPrecios(true)
    try {
      setPrecios(await llmPreciosApi.listar())
    } finally {
      setCargandoPrecios(false)
    }
  }, [])

  useEffect(() => {
    if (tabPagina === 'configuracion' && tabConfig === 'precios') cargarPrecios()
  }, [tabPagina, tabConfig, cargarPrecios])

  const guardarPrecio = async (cerrar = true) => {
    if (!editandoPrecio) return
    await llmPreciosApi.upsert(editandoPrecio.proveedor, editandoPrecio.nombre_tecnico, {
      ...formPrecio,
      vigente_desde: new Date().toISOString().slice(0, 10),
    })
    if (cerrar) setEditandoPrecio(null)
    cargarPrecios()
  }

  // ══════════════════════════════════════════
  // TAB 3 — Uso
  // ══════════════════════════════════════════
  const [resumen, setResumen] = useState<LLMUsoResumen | null>(null)
  const [filas, setFilas] = useState<LLMUsoFila[]>([])
  const [cargandoUso, setCargandoUso] = useState(true)
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', proveedor: '', modelo: '', codigo_usuario: '' })

  const cargarUso = useCallback(async () => {
    setCargandoUso(true)
    try {
      const [r, f] = await Promise.all([
        llmUsoApi.resumen(),
        llmUsoApi.listar({
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
          proveedor: filtros.proveedor || undefined,
          modelo: filtros.modelo || undefined,
          codigo_usuario: filtros.codigo_usuario || undefined,
          limit: 500,
        }),
      ])
      setResumen(r)
      setFilas(f)
    } finally {
      setCargandoUso(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo])

  useEffect(() => {
    if (tabPagina === 'uso') cargarUso()
  }, [tabPagina, cargarUso])

  const exportarUso = () => {
    exportarExcel(
      filas as unknown as Record<string, unknown>[],
      [
        { titulo: 'Fecha', campo: 'created_at' },
        { titulo: 'Proveedor', campo: 'proveedor' },
        { titulo: 'Modelo', campo: 'modelo' },
        { titulo: 'Alias', campo: 'alias_credencial' },
        { titulo: 'Key casa', campo: 'uso_key_casa', formato: (v) => (v ? 'SI' : 'NO') },
        { titulo: 'Usuario', campo: 'codigo_usuario' },
        { titulo: 'Función', campo: 'codigo_funcion' },
        { titulo: 'Operación', campo: 'operacion' },
        { titulo: 'Tokens in', campo: 'tokens_input' },
        { titulo: 'Tokens out', campo: 'tokens_output' },
        { titulo: 'Costo USD', campo: 'costo_estimado_usd' },
        { titulo: 'Éxito', campo: 'exito', formato: (v) => (v ? 'SI' : 'NO') },
      ],
      `uso-llm-${grupoActivo}-${new Date().toISOString().slice(0, 10)}`,
    )
  }

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════
  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Lenguetas principales */}
      <div className="border-b border-borde">
        <nav className="flex gap-6">
          <button onClick={() => setTabPagina('modelos')} className={tabStyle(tabPagina === 'modelos')}>
            {t('titulo')}
          </button>
          <button onClick={() => setTabPagina('configuracion')} className={tabStyle(tabPagina === 'configuracion')}>
            {tConfig('titulo')}
          </button>
          <button onClick={() => setTabPagina('uso')} className={tabStyle(tabPagina === 'uso')}>
            {tUso('titulo')}
          </button>
        </nav>
      </div>

      {/* ── TAB 1: Modelos ── */}
      {tabPagina === 'modelos' && (
        <>
          <div className="flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input placeholder={t('buscarPlaceholder')} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
            </div>
            <div className="flex gap-2 ml-auto">
              <Boton variante="contorno" tamano="sm" disabled={filtrados.length === 0}
                onClick={() => exportarExcel(filtrados as unknown as Record<string, unknown>[], [
                  { titulo: 'ID', campo: 'id_modelo' },
                  { titulo: 'Proveedor', campo: 'proveedor' },
                  { titulo: 'Nombre Técnico', campo: 'nombre_tecnico' },
                  { titulo: 'Nombre Visible', campo: 'nombre_visible' },
                  { titulo: 'Descripción', campo: 'descripcion' },
                  { titulo: 'Validado', campo: 'estado_valido', formato: (v: unknown) => (v ? 'Sí' : 'No') },
                  { titulo: 'Estado', campo: 'estado_valido', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
                ], 'registro-llm')}>
                <Download size={15} />{tc('exportarExcel')}
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoModelo}><Plus size={16} />{t('nuevoModelo')}</Boton>
            </div>
          </div>

          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh>{t('colProveedor')}</TablaTh>
                <TablaTh>{t('colNombreTecnico')}</TablaTh>
                <TablaTh>{t('colNombreVisible')}</TablaTh>
                <TablaTh>{t('colDescripcion')}</TablaTh>
                <TablaTh>{t('colValidado')}</TablaTh>
                <TablaTh>{t('colEstado')}</TablaTh>
                <TablaTh className="text-right">{tc('acciones')}</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {cargandoModelos ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{tc('cargando')}</TablaTd></TablaFila>
              ) : filtrados.length === 0 ? (
                <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>{t('sinModelos')}</TablaTd></TablaFila>
              ) : filtrados.map((m) => (
                <TablaFila key={m.id_modelo}>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{m.proveedor}</code></TablaTd>
                  <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{m.nombre_tecnico}</code></TablaTd>
                  <TablaTd className="font-medium" onDoubleClick={() => abrirEditarModelo(m)}>{m.nombre_visible}</TablaTd>
                  <TablaTd className="text-texto-muted text-sm max-w-[200px] truncate">{m.descripcion || '—'}</TablaTd>
                  <TablaTd>
                    {m.estado_valido
                      ? <span className="inline-flex items-center gap-1 text-exito text-sm"><CheckCircle size={14} />{tc('si')}</span>
                      : <span className="inline-flex items-center gap-1 text-texto-muted text-sm"><XCircle size={14} />{tc('no')}</span>
                    }
                  </TablaTd>
                  <TablaTd><Insignia variante='exito'>Válido</Insignia></TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditarModelo(m)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmacionModelo(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Desactivar"><Trash2 size={14} /></button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>

          <Modal abierto={modalModelo} alCerrar={() => setModalModelo(false)} titulo={editandoModelo ? t('editarTitulo', { nombre: editandoModelo.nombre_visible }) : t('nuevoTitulo')} className="max-w-2xl">
            <div className="flex flex-col gap-4 min-h-[500px]">
              {editandoModelo && (
                <div className="flex border-b border-borde -mx-1">
                  <button onClick={() => setTabModal('datos')} className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${tabModal === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabDatos')}</button>
                  <button onClick={() => setTabModal('probar')} className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${tabModal === 'probar' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>{t('tabProbarConexion')}</button>
                  <button onClick={() => setTabModal('system_prompt')} className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${tabModal === 'system_prompt' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>System Prompt</button>
                  <button onClick={() => setTabModal('programacion_insert')} className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${tabModal === 'programacion_insert' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Prog. Insert</button>
                  <button onClick={() => setTabModal('programacion_update')} className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${tabModal === 'programacion_update' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Prog. Update</button>
                  <button onClick={() => setTabModal('md')} className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${tabModal === 'md' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>.md</button>
                </div>
              )}

              {tabModal === 'datos' && (<>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Input etiqueta={t('etiquetaProveedor')} value={formModelo.proveedor} onChange={(e) => setFormModelo({ ...formModelo, proveedor: e.target.value })} placeholder={t('placeholderProveedor')} />
                  <Input etiqueta={t('etiquetaNombreVisible')} value={formModelo.nombre_visible} onChange={(e) => setFormModelo({ ...formModelo, nombre_visible: e.target.value })} placeholder={t('placeholderNombreVisible')} />
                  <div className="col-span-2">
                    <Input etiqueta={t('etiquetaNombreTecnico')} value={formModelo.nombre_tecnico} onChange={(e) => setFormModelo({ ...formModelo, nombre_tecnico: e.target.value })} placeholder={t('placeholderNombreTecnico')} />
                  </div>
                  <div className="col-span-2">
                    <Textarea etiqueta={t('etiquetaDescripcion')} value={formModelo.descripcion} onChange={(e) => setFormModelo({ ...formModelo, descripcion: e.target.value })} placeholder={t('placeholderDescripcion')} rows={3} />
                  </div>
                </div>
                {editandoModelo && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formModelo.estado_valido} onChange={(e) => setFormModelo({ ...formModelo, estado_valido: e.target.checked })} className="rounded border-borde" />
                    {t('conexionValidada')}
                  </label>
                )}
                {errorModelo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorModelo}</p></div>}
                <PieBotonesModal editando={!!editandoModelo} onGuardar={() => guardarModelo(false)} onGuardarYSalir={() => guardarModelo(true)} onCerrar={() => setModalModelo(false)} cargando={guardandoModelo} />
              </>)}

              {tabModal === 'system_prompt' && editandoModelo && (
                <div className="flex flex-col gap-3">
                  <TabPrompts
                    tabla="registro_llm"
                    pkColumna="id_modelo"
                    pkValor={editandoModelo.id_modelo}
                    campos={formModelo}
                    onCampoCambiado={(campo, valor) => setFormModelo({ ...formModelo, [campo]: valor })}
                    mostrarPromptInsert={false}
                    mostrarPromptUpdate={false}
                    mostrarSystemPrompt={true}
                    mostrarPythonInsert={false}
                    mostrarPythonUpdate={false}
                    mostrarJavaScript={false}
                  />
                  {errorModelo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorModelo}</p></div>}
                  <PieBotonesModal
                    editando={!!editandoModelo}
                    onGuardar={() => guardarModelo(false)}
                    onGuardarYSalir={() => guardarModelo(true)}
                    onCerrar={() => setModalModelo(false)}
                    cargando={guardandoModelo}
                    botonesIzquierda={
                      <PieBotonesPrompts
                        tabla="registro_llm"
                        pkColumna="id_modelo"
                        pkValor={editandoModelo.id_modelo}
                        promptInsert={formModelo.prompt_insert || undefined}
                        promptUpdate={formModelo.prompt_update || undefined}
                      />
                    }
                  />
                </div>
              )}

              {tabModal === 'programacion_insert' && editandoModelo && (
                <div className="flex flex-col gap-3">
                  <TabPrompts
                    tabla="registro_llm"
                    pkColumna="id_modelo"
                    pkValor={editandoModelo.id_modelo}
                    campos={formModelo}
                    onCampoCambiado={(campo, valor) => setFormModelo({ ...formModelo, [campo]: valor })}
                    mostrarSystemPrompt={false}
                    mostrarJavaScript={false}
                    mostrarPromptUpdate={false}
                    mostrarPythonUpdate={false}
                  />
                  {errorModelo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorModelo}</p></div>}
                  <PieBotonesModal
                    editando={!!editandoModelo}
                    onGuardar={() => guardarModelo(false)}
                    onGuardarYSalir={() => guardarModelo(true)}
                    onCerrar={() => setModalModelo(false)}
                    cargando={guardandoModelo}
                    botonesIzquierda={
                      <PieBotonesPrompts
                        tabla="registro_llm"
                        pkColumna="id_modelo"
                        pkValor={editandoModelo.id_modelo}
                        promptInsert={formModelo.prompt_insert || undefined}
                        promptUpdate={formModelo.prompt_update || undefined}
                      />
                    }
                  />
                </div>
              )}
              {tabModal === 'programacion_update' && editandoModelo && (
                <div className="flex flex-col gap-3">
                  <TabPrompts
                    tabla="registro_llm"
                    pkColumna="id_modelo"
                    pkValor={editandoModelo.id_modelo}
                    campos={formModelo}
                    onCampoCambiado={(campo, valor) => setFormModelo({ ...formModelo, [campo]: valor })}
                    mostrarSystemPrompt={false}
                    mostrarJavaScript={false}
                    mostrarPromptInsert={false}
                    mostrarPythonInsert={false}
                  />
                  {errorModelo && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorModelo}</p></div>}
                  <PieBotonesModal
                    editando={!!editandoModelo}
                    onGuardar={() => guardarModelo(false)}
                    onGuardarYSalir={() => guardarModelo(true)}
                    onCerrar={() => setModalModelo(false)}
                    cargando={guardandoModelo}
                    botonesIzquierda={
                      <PieBotonesPrompts
                        tabla="registro_llm"
                        pkColumna="id_modelo"
                        pkValor={editandoModelo.id_modelo}
                        promptInsert={formModelo.prompt_insert || undefined}
                        promptUpdate={formModelo.prompt_update || undefined}
                      />
                    }
                  />
                </div>
              )}

              {tabModal === 'md' && editandoModelo && (
                <div className="flex flex-col gap-3">
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
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-2">
                      <Boton
                        className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                        onClick={async () => {
                          setGenerandoMd(true); setMensajeMd(null)
                          try {
                            const r = await registroLLMApi.generarMd(editandoModelo.id_modelo)
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
                            const r = await promptsApi.sincronizarFila('registro_llm', 'id_modelo', String(editandoModelo.id_modelo))
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
                    <Boton variante="contorno" onClick={() => setModalModelo(false)}>{tc('salir')}</Boton>
                  </div>
                </div>
              )}

              {tabModal === 'probar' && editandoModelo && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-texto-muted">
                    Envía un mensaje de prueba a <span className="font-medium text-texto">{editandoModelo.nombre_visible}</span> ({editandoModelo.proveedor})
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input placeholder={t('placeholderMensaje')} value={mensajePrueba} onChange={(e) => setMensajePrueba(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !probando) probarConexion() }} />
                    </div>
                    <Boton variante="primario" onClick={probarConexion} cargando={probando} disabled={!mensajePrueba.trim()}>
                      {probando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </Boton>
                  </div>
                  {respuestaPrueba && (
                    <div className="bg-fondo rounded-lg p-4 flex flex-col gap-2">
                      <p className="text-sm text-texto whitespace-pre-wrap">{respuestaPrueba.respuesta}</p>
                      <div className="flex gap-3 text-xs text-texto-muted pt-1 border-t border-borde">
                        <span>{t('resultadoModelo', { modelo: respuestaPrueba.modelo })}</span>
                        <span>{t('resultadoTiempo', { tiempo: respuestaPrueba.tiempo_ms })}</span>
                      </div>
                    </div>
                  )}
                  {errorPrueba && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorPrueba}</p></div>}
                  <div className="flex justify-end pt-2">
                    <Boton variante="contorno" onClick={() => setModalModelo(false)}>{tc('salir')}</Boton>
                  </div>
                </div>
              )}
            </div>
          </Modal>

          <ModalConfirmar abierto={!!confirmacionModelo} alCerrar={() => setConfirmacionModelo(null)} alConfirmar={ejecutarEliminacionModelo}
            titulo={t('desactivarTitulo')} mensaje={confirmacionModelo ? t('desactivarConfirm', { nombre: confirmacionModelo.nombre_visible }) : ''} textoConfirmar={t('desactivarTitulo')} cargando={eliminandoModelo} />
        </>
      )}

      {/* ── TAB 2: Configuración ── */}
      {tabPagina === 'configuracion' && (
        <>
          <div className="border-b border-gray-200">
            <nav className="flex gap-6">
              <button onClick={() => setTabConfig('credenciales')} className={tabStyle(tabConfig === 'credenciales')}>
                {tConfig('tabCredenciales')}
              </button>
              {esSuperAdmin && (
                <button onClick={() => setTabConfig('precios')} className={tabStyle(tabConfig === 'precios')}>
                  {tConfig('tabPrecios')}
                </button>
              )}
            </nav>
          </div>

          {tabConfig === 'credenciales' && (
            <>
              <div className="flex justify-end">
                <Boton onClick={abrirNuevaCredencial}><Plus className="w-4 h-4 mr-1" />{tConfig('nuevaCredencial')}</Boton>
              </div>
              {cargandoCredenciales ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : credenciales.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">{tConfig('sinCredenciales')}</div>
              ) : (
                <Tabla>
                  <TablaCabecera>
                    <TablaFila>
                      <TablaTh>{tConfig('colProveedor')}</TablaTh>
                      <TablaTh>{tConfig('colAlias')}</TablaTh>
                      <TablaTh>{tConfig('colApiKey')}</TablaTh>
                      <TablaTh>{tConfig('colLimite')}</TablaTh>
                      <TablaTh>{tConfig('colUltimoUso')}</TablaTh>
                      <TablaTh>{tConfig('colEstado')}</TablaTh>
                      <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                    </TablaFila>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {credenciales.map((c) => {
                      const keyId = `${c.proveedor}/${c.alias}`
                      const res = resultadoPrueba?.key === keyId ? resultadoPrueba : null
                      return (
                        <TablaFila key={keyId}>
                          <TablaTd className="capitalize font-medium" onDoubleClick={() => abrirEditarCredencial(c)}>{c.proveedor}</TablaTd>
                          <TablaTd>{c.alias}</TablaTd>
                          <TablaTd className="font-mono text-xs">{c.api_key_preview}</TablaTd>
                          <TablaTd>{c.limite_usd_mes !== null ? `$${c.limite_usd_mes}` : '—'}</TablaTd>
                          <TablaTd className="text-xs text-gray-500">{c.ultimo_uso_en ? new Date(c.ultimo_uso_en).toLocaleString('es-CL') : '—'}</TablaTd>
                          <TablaTd></TablaTd>
                          <TablaTd className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              {res && (
                                <span className={`text-xs flex items-center gap-1 ${res.ok ? 'text-green-600' : 'text-red-600'}`} title={res.mensaje}>
                                  {res.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  {res.tiempo_ms}ms
                                </span>
                              )}
                              <button onClick={() => probarCredencial(c)} disabled={probandoKey === keyId} className="p-1 hover:bg-gray-100 rounded text-blue-600" title={tConfig('probarConexion')}>
                                {probandoKey === keyId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                              </button>
                              <button onClick={() => abrirEditarCredencial(c)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => setConfirmacionCredencial(c)} className="p-1 hover:bg-gray-100 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </TablaTd>
                        </TablaFila>
                      )
                    })}
                  </TablaCuerpo>
                </Tabla>
              )}
            </>
          )}

          {tabConfig === 'precios' && esSuperAdmin && (
            <>
              {cargandoPrecios ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : (
                <Tabla>
                  <TablaCabecera>
                    <TablaFila>
                      <TablaTh>{tConfig('colProveedor')}</TablaTh>
                      <TablaTh>{tConfig('colModelo')}</TablaTh>
                      <TablaTh>{tConfig('colPrecioInput')}</TablaTh>
                      <TablaTh>{tConfig('colPrecioOutput')}</TablaTh>
                      <TablaTh>{tConfig('colCacheRead')}</TablaTh>
                      <TablaTh>{tConfig('colCacheWrite')}</TablaTh>
                      <TablaTh>{tConfig('colVigencia')}</TablaTh>
                      <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                    </TablaFila>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {precios.map((p) => (
                      <TablaFila key={`${p.proveedor}-${p.nombre_tecnico}-${p.vigente_desde}`}>
                        <TablaTd className="capitalize" onDoubleClick={() => { setEditandoPrecio(p); setFormPrecio({ precio_input_1m: p.precio_input_1m, precio_output_1m: p.precio_output_1m, precio_cache_read_1m: p.precio_cache_read_1m, precio_cache_write_1m: p.precio_cache_write_1m }) }}>{p.proveedor}</TablaTd>
                        <TablaTd className="font-mono text-xs">{p.nombre_tecnico}</TablaTd>
                        <TablaTd>${p.precio_input_1m}</TablaTd>
                        <TablaTd>${p.precio_output_1m}</TablaTd>
                        <TablaTd>${p.precio_cache_read_1m}</TablaTd>
                        <TablaTd>${p.precio_cache_write_1m}</TablaTd>
                        <TablaTd>{p.vigente_desde}</TablaTd>
                        <TablaTd className="text-right">
                          <button onClick={() => { setEditandoPrecio(p); setFormPrecio({ precio_input_1m: p.precio_input_1m, precio_output_1m: p.precio_output_1m, precio_cache_read_1m: p.precio_cache_read_1m, precio_cache_write_1m: p.precio_cache_write_1m }) }} className="p-1 hover:bg-gray-100 rounded">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </TablaTd>
                      </TablaFila>
                    ))}
                  </TablaCuerpo>
                </Tabla>
              )}
            </>
          )}

          {modalCredencial && (
            <Modal abierto={modalCredencial} alCerrar={() => setModalCredencial(false)} titulo={editandoCredencial ? tConfig('editarTitulo') : tConfig('nuevoTitulo')}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tConfig('etiquetaProveedor')}</label>
                  <select disabled={!!editandoCredencial} value={formCredencial.proveedor} onChange={(e) => setFormCredencial({ ...formCredencial, proveedor: e.target.value as Proveedor })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100">
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tConfig('etiquetaAlias')}</label>
                  <Input value={formCredencial.alias} disabled={!!editandoCredencial} onChange={(e) => setFormCredencial({ ...formCredencial, alias: e.target.value })} placeholder={tConfig('placeholderAlias')} />
                  <p className="text-xs text-gray-500 mt-1">{tConfig('descAlias')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tConfig('etiquetaApiKey', { nota: editandoCredencial ? tConfig('notaApiKey') : '' })}</label>
                  <Input type="password" value={formCredencial.api_key} onChange={(e) => setFormCredencial({ ...formCredencial, api_key: e.target.value })} placeholder={editandoCredencial ? '••••••••' : tConfig('placeholderApiKey')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tConfig('etiquetaLimite')}</label>
                  <Input type="number" step="0.01" value={formCredencial.limite_usd_mes} onChange={(e) => setFormCredencial({ ...formCredencial, limite_usd_mes: e.target.value })} placeholder={tConfig('placeholderLimite')} />
                  <p className="text-xs text-gray-500 mt-1">{tConfig('descLimite')}</p>
                </div>
                {errorCredencial && <div className="text-sm text-red-600">{errorCredencial}</div>}
                <PieBotonesModal editando={!!editandoCredencial} onGuardar={() => guardarCredencial(false)} onGuardarYSalir={() => guardarCredencial(true)} onCerrar={() => setModalCredencial(false)} cargando={guardandoCredencial} />
              </div>
            </Modal>
          )}

          {editandoPrecio && (
            <Modal abierto={!!editandoPrecio} alCerrar={() => setEditandoPrecio(null)} titulo={tConfig('precioTitulo', { proveedor: editandoPrecio.proveedor, modelo: editandoPrecio.nombre_tecnico })}>
              <div className="space-y-3">
                {(['precio_input_1m', 'precio_output_1m', 'precio_cache_read_1m', 'precio_cache_write_1m'] as const).map((k) => (
                  <div key={k}>
                    <label className="block text-sm text-gray-700 mb-1">{k}</label>
                    <Input type="number" step="0.0001" value={formPrecio[k]} onChange={(e) => setFormPrecio({ ...formPrecio, [k]: Number(e.target.value) })} />
                  </div>
                ))}
                <PieBotonesModal editando={!!editandoPrecio} onGuardar={() => guardarPrecio(false)} onGuardarYSalir={() => guardarPrecio(true)} onCerrar={() => setEditandoPrecio(null)} />
              </div>
            </Modal>
          )}

          <ModalConfirmar abierto={!!confirmacionCredencial} titulo={tConfig('eliminarTitulo')}
            mensaje={confirmacionCredencial ? tConfig('eliminarConfirm', { proveedor: confirmacionCredencial.proveedor, alias: confirmacionCredencial.alias }) : ''}
            alCerrar={() => setConfirmacionCredencial(null)} alConfirmar={eliminarCredencial} textoConfirmar={tc('eliminar')} cargando={eliminandoCredencial} />
        </>
      )}

      {/* ── TAB 3: Uso ── */}
      {tabPagina === 'uso' && (
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
            <Boton variante="contorno" onClick={cargarUso}><RefreshCw className="w-4 h-4 mr-1" />{tUso('refrescar')}</Boton>
            <Boton variante="contorno" onClick={exportarUso}><Download className="w-4 h-4 mr-1" />{tUso('exportar')}</Boton>
          </div>

          {resumen && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 uppercase">{tUso('mesActual')}</div>
                <div className="stat-number text-[#074B91] mt-1">{resumen.mes}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 uppercase">{tUso('llamadas')}</div>
                <div className="stat-number text-gray-900 mt-1">{fmtInt(resumen.total_llamadas)}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 uppercase">{tUso('costoTotal')}</div>
                <div className="stat-number text-gray-900 mt-1">{fmtUsd(resumen.total_costo_usd)}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 uppercase">{tUso('keyCasaGrupo')}</div>
                <div className="text-sm font-medium text-gray-900 mt-2">
                  <span className="text-amber-600">{fmtUsd(resumen.costo_key_casa_usd)}</span>{' '}/{' '}
                  <span className="text-green-600">{fmtUsd(resumen.costo_key_grupo_usd)}</span>
                </div>
              </div>
            </div>
          )}

          {resumen && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{tUso('porModelo')}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b">
                      <th className="text-left py-1">{tUso('colModelo')}</th>
                      <th className="text-right py-1">{tUso('colLlamadas')}</th>
                      <th className="text-right py-1">{tUso('colTokenIn')}</th>
                      <th className="text-right py-1">{tUso('colTokenOut')}</th>
                      <th className="text-right py-1">{tUso('colCosto')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.por_modelo.map((m) => (
                      <tr key={m.clave} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{m.clave}</td>
                        <td className="text-right">{fmtInt(m.llamadas)}</td>
                        <td className="text-right">{fmtInt(m.tokens_input)}</td>
                        <td className="text-right">{fmtInt(m.tokens_output)}</td>
                        <td className="text-right font-medium">{fmtUsd(m.costo_usd)}</td>
                      </tr>
                    ))}
                    {resumen.por_modelo.length === 0 && (
                      <tr><td colSpan={5} className="py-4 text-center text-gray-400">{tUso('sinDatosMes')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{tUso('porUsuario')}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b">
                      <th className="text-left py-1">{tUso('colNombre')}</th>
                      <th className="text-right py-1">{tUso('colLlamadas')}</th>
                      <th className="text-right py-1">{tUso('colCosto')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.por_usuario.map((u) => (
                      <tr key={u.clave} className="border-b last:border-0">
                        <td className="py-2 text-xs">{u.clave}</td>
                        <td className="text-right">{fmtInt(u.llamadas)}</td>
                        <td className="text-right font-medium">{fmtUsd(u.costo_usd)}</td>
                      </tr>
                    ))}
                    {resumen.por_usuario.length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-400">{tUso('sinDatosMes')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{tUso('detalleLlamadas')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
              <Input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} placeholder={tUso('filterDesde')} />
              <Input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} placeholder={tUso('filterHasta')} />
              <select value={filtros.proveedor} onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
                <option value="">{tUso('filterTodosProveedores')}</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
              <Input placeholder={tUso('filterModelo')} value={filtros.modelo} onChange={(e) => setFiltros({ ...filtros, modelo: e.target.value })} />
              <Input placeholder={tUso('filterUsuario')} value={filtros.codigo_usuario} onChange={(e) => setFiltros({ ...filtros, codigo_usuario: e.target.value })} />
              <Boton onClick={cargarUso}>{tUso('aplicar')}</Boton>
            </div>
            {cargandoUso ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : (
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaTh>{tUso('colFecha')}</TablaTh>
                    <TablaTh>{tUso('colProveedor')}</TablaTh>
                    <TablaTh>{tUso('colModelo')}</TablaTh>
                    <TablaTh>{tUso('colKey')}</TablaTh>
                    <TablaTh>{tUso('colUsuario')}</TablaTh>
                    <TablaTh>{tUso('colFuncion')}</TablaTh>
                    <TablaTh className="text-right">{tUso('colTokIn')}</TablaTh>
                    <TablaTh className="text-right">{tUso('colTokOut')}</TablaTh>
                    <TablaTh className="text-right">{tUso('colCosto')}</TablaTh>
                    <TablaTh>{tUso('colEstado')}</TablaTh>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {filas.map((f) => (
                    <TablaFila key={f.id}>
                      <TablaTd className="text-xs">{new Date(f.created_at).toLocaleString('es-CL')}</TablaTd>
                      <TablaTd className="capitalize">{f.proveedor}</TablaTd>
                      <TablaTd className="font-mono text-xs">{f.modelo}</TablaTd>
                      <TablaTd>{f.uso_key_casa ? <Insignia variante="advertencia">Casa</Insignia> : <Insignia variante="exito">{f.alias_credencial}</Insignia>}</TablaTd>
                      <TablaTd className="text-xs">{f.codigo_usuario}</TablaTd>
                      <TablaTd className="text-xs">{f.codigo_funcion ?? '—'}</TablaTd>
                      <TablaTd className="text-right">{fmtInt(f.tokens_input)}</TablaTd>
                      <TablaTd className="text-right">{fmtInt(f.tokens_output)}</TablaTd>
                      <TablaTd className="text-right">{fmtUsd(f.costo_estimado_usd)}</TablaTd>
                      <TablaTd>{f.exito ? <Insignia variante="exito">OK</Insignia> : <Insignia variante="error">Error</Insignia>}</TablaTd>
                    </TablaFila>
                  ))}
                  {filas.length === 0 && (
                    <TablaFila><TablaTd colSpan={10} className="text-center text-gray-400 py-6">{tUso('sinLlamadas')}</TablaTd></TablaFila>
                  )}
                </TablaCuerpo>
              </Tabla>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
