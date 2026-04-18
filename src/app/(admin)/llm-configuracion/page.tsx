'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Loader2, Pencil, Plus, Trash2, XCircle, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaFila,
  TablaTd,
  TablaTh,
} from '@/components/ui/tabla'
import {
  llmCredencialesApi,
  llmPreciosApi,
  type LLMCredencial,
  type LLMPrecio,
} from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

type Proveedor = 'anthropic' | 'google' | 'openai' | 'deepseek'

export default function PaginaLLMConfiguracion() {
  const t = useTranslations('llmConfiguracion')
  const tc = useTranslations('common')
  const { grupoActivo, esSuperAdmin: chkSuperAdmin } = useAuth()
  const esSuperAdmin = chkSuperAdmin()

  const [tab, setTab] = useState<'credenciales' | 'precios'>('credenciales')

  // ── Credenciales ──
  const [credenciales, setCredenciales] = useState<LLMCredencial[]>([])
  const [cargando, setCargando] = useState(true)

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<LLMCredencial | null>(null)
  const [form, setForm] = useState({
    proveedor: 'anthropic' as Proveedor,
    alias: 'default',
    api_key: '',
    limite_usd_mes: '' as string,
    activo: true,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [confirmacion, setConfirmacion] = useState<LLMCredencial | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [probandoKey, setProbandoKey] = useState<string | null>(null)
  const [resultadoPrueba, setResultadoPrueba] = useState<{
    key: string
    ok: boolean
    mensaje: string
    tiempo_ms: number
  } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setCredenciales(await llmCredencialesApi.listar())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar, grupoActivo])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      proveedor: 'anthropic',
      alias: 'default',
      api_key: '',
      limite_usd_mes: '',
      activo: true,
    })
    setError('')
    setModal(true)
  }

  const abrirEditar = (c: LLMCredencial) => {
    setEditando(c)
    setForm({
      proveedor: c.proveedor,
      alias: c.alias,
      api_key: '',
      limite_usd_mes: c.limite_usd_mes !== null ? String(c.limite_usd_mes) : '',
      activo: c.activo,
    })
    setError('')
    setModal(true)
  }

  const guardar = async (cerrar = true) => {
    setError('')
    setGuardando(true)
    try {
      const limite =
        form.limite_usd_mes.trim() === '' ? null : Number(form.limite_usd_mes)
      if (editando) {
        await llmCredencialesApi.actualizar(editando.proveedor, editando.alias, {
          api_key: form.api_key || undefined,
          limite_usd_mes: limite,
          activo: form.activo,
        })
      } else {
        if (!form.api_key) {
          setError(t('errorApiKeyObligatoria'))
          setGuardando(false)
          return
        }
        await llmCredencialesApi.crear({
          proveedor: form.proveedor,
          alias: form.alias || 'default',
          api_key: form.api_key,
          limite_usd_mes: limite,
          activo: form.activo,
        })
      }
      if (cerrar) setModal(false)
      cargar()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || t('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await llmCredencialesApi.eliminar(confirmacion.proveedor, confirmacion.alias)
      setConfirmacion(null)
      cargar()
    } finally {
      setEliminando(false)
    }
  }

  const probar = async (c: LLMCredencial) => {
    const key = `${c.proveedor}/${c.alias}`
    setProbandoKey(key)
    setResultadoPrueba(null)
    try {
      const r = await llmCredencialesApi.probar(c.proveedor, c.alias)
      setResultadoPrueba({ key, ...r })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setResultadoPrueba({
        key,
        ok: false,
        mensaje: err.response?.data?.detail || t('errorAlProbar'),
        tiempo_ms: 0,
      })
    } finally {
      setProbandoKey(null)
    }
  }

  // ── Precios ──
  const [precios, setPrecios] = useState<LLMPrecio[]>([])
  const [cargandoPrecios, setCargandoPrecios] = useState(false)
  const [editandoPrecio, setEditandoPrecio] = useState<LLMPrecio | null>(null)
  const [formPrecio, setFormPrecio] = useState({
    precio_input_1m: 0,
    precio_output_1m: 0,
    precio_cache_read_1m: 0,
    precio_cache_write_1m: 0,
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
    if (tab === 'precios') cargarPrecios()
  }, [tab, cargarPrecios])

  const guardarPrecio = async (cerrar = true) => {
    if (!editandoPrecio) return
    await llmPreciosApi.upsert(editandoPrecio.proveedor, editandoPrecio.nombre_tecnico, {
      ...formPrecio,
      vigente_desde: new Date().toISOString().slice(0, 10),
      activo: true,
    })
    if (cerrar) setEditandoPrecio(null)
    cargarPrecios()
  }

  return (
    <div className="relative p-6 space-y-6">
      <BotonChat className="top-0 right-0" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-heading">{t('titulo')}</h1>
          <p className="text-sm text-gray-600">
            {t('descripcion')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setTab('credenciales')}
            className={`pb-3 text-sm font-medium border-b-2 transition ${
              tab === 'credenciales'
                ? 'border-[#074B91] text-[#074B91]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tabCredenciales')}
          </button>
          {esSuperAdmin && (
            <button
              onClick={() => setTab('precios')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                tab === 'precios'
                  ? 'border-[#074B91] text-[#074B91]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabPrecios')}
            </button>
          )}
        </nav>
      </div>

      {tab === 'credenciales' && (
        <>
          <div className="flex justify-end">
            <Boton onClick={abrirNuevo}>
              <Plus className="w-4 h-4 mr-1" />
              {t('nuevaCredencial')}
            </Boton>
          </div>

          {cargando ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : credenciales.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
              {t('sinCredenciales')}
            </div>
          ) : (
            <Tabla>
              <TablaCabecera>
                <TablaFila>
                  <TablaTh>{t('colProveedor')}</TablaTh>
                  <TablaTh>{t('colAlias')}</TablaTh>
                  <TablaTh>{t('colApiKey')}</TablaTh>
                  <TablaTh>{t('colLimite')}</TablaTh>
                  <TablaTh>{t('colUltimoUso')}</TablaTh>
                  <TablaTh>{t('colEstado')}</TablaTh>
                  <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                </TablaFila>
              </TablaCabecera>
              <TablaCuerpo>
                {credenciales.map((c) => {
                  const keyId = `${c.proveedor}/${c.alias}`
                  const res = resultadoPrueba?.key === keyId ? resultadoPrueba : null
                  return (
                    <TablaFila key={keyId}>
                      <TablaTd className="capitalize font-medium">{c.proveedor}</TablaTd>
                      <TablaTd>{c.alias}</TablaTd>
                      <TablaTd className="font-mono text-xs">{c.api_key_preview}</TablaTd>
                      <TablaTd>
                        {c.limite_usd_mes !== null ? `$${c.limite_usd_mes}` : '—'}
                      </TablaTd>
                      <TablaTd className="text-xs text-gray-500">
                        {c.ultimo_uso_en
                          ? new Date(c.ultimo_uso_en).toLocaleString('es-CL')
                          : '—'}
                      </TablaTd>
                      <TablaTd>
                        {c.activo ? (
                          <Insignia variante="exito">{tc('activo')}</Insignia>
                        ) : (
                          <Insignia variante="neutro">{tc('inactivo')}</Insignia>
                        )}
                      </TablaTd>
                      <TablaTd className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          {res && (
                            <span
                              className={`text-xs flex items-center gap-1 ${
                                res.ok ? 'text-green-600' : 'text-red-600'
                              }`}
                              title={res.mensaje}
                            >
                              {res.ok ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              {res.tiempo_ms}ms
                            </span>
                          )}
                          <button
                            onClick={() => probar(c)}
                            disabled={probandoKey === keyId}
                            className="p-1 hover:bg-gray-100 rounded text-blue-600"
                            title={t('probarConexion')}
                          >
                            {probandoKey === keyId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => abrirEditar(c)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmacion(c)}
                            className="p-1 hover:bg-gray-100 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {tab === 'precios' && esSuperAdmin && (
        <>
          {cargandoPrecios ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <Tabla>
              <TablaCabecera>
                <TablaFila>
                  <TablaTh>{t('colProveedor')}</TablaTh>
                  <TablaTh>{t('colModelo')}</TablaTh>
                  <TablaTh>{t('colPrecioInput')}</TablaTh>
                  <TablaTh>{t('colPrecioOutput')}</TablaTh>
                  <TablaTh>{t('colCacheRead')}</TablaTh>
                  <TablaTh>{t('colCacheWrite')}</TablaTh>
                  <TablaTh>{t('colVigencia')}</TablaTh>
                  <TablaTh className="text-right">{tc('acciones')}</TablaTh>
                </TablaFila>
              </TablaCabecera>
              <TablaCuerpo>
                {precios.map((p) => (
                  <TablaFila key={`${p.proveedor}-${p.nombre_tecnico}-${p.vigente_desde}`}>
                    <TablaTd className="capitalize">{p.proveedor}</TablaTd>
                    <TablaTd className="font-mono text-xs">{p.nombre_tecnico}</TablaTd>
                    <TablaTd>${p.precio_input_1m}</TablaTd>
                    <TablaTd>${p.precio_output_1m}</TablaTd>
                    <TablaTd>${p.precio_cache_read_1m}</TablaTd>
                    <TablaTd>${p.precio_cache_write_1m}</TablaTd>
                    <TablaTd>{p.vigente_desde}</TablaTd>
                    <TablaTd className="text-right">
                      <button
                        onClick={() => {
                          setEditandoPrecio(p)
                          setFormPrecio({
                            precio_input_1m: p.precio_input_1m,
                            precio_output_1m: p.precio_output_1m,
                            precio_cache_read_1m: p.precio_cache_read_1m,
                            precio_cache_write_1m: p.precio_cache_write_1m,
                          })
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
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

      {/* Modal credencial */}
      {modal && (
        <Modal
          abierto={modal}
          alCerrar={() => setModal(false)}
          titulo={editando ? t('editarTitulo') : t('nuevoTitulo')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('etiquetaProveedor')}</label>
              <select
                disabled={!!editando}
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value as Proveedor })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
              >
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('etiquetaAlias')}</label>
              <Input
                value={form.alias}
                disabled={!!editando}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                placeholder={t('placeholderAlias')}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('descAlias')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('etiquetaApiKey', { nota: editando ? t('notaApiKey') : '' })}
              </label>
              <Input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder={editando ? '••••••••' : t('placeholderApiKey')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('etiquetaLimite')}
              </label>
              <Input
                type="number"
                step="0.01"
                value={form.limite_usd_mes}
                onChange={(e) => setForm({ ...form, limite_usd_mes: e.target.value })}
                placeholder={t('placeholderLimite')}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('descLimite')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="activo"
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              <label htmlFor="activo" className="text-sm text-gray-700">
                {t('etiquetaActiva')}
              </label>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setModal(false)}>
                {tc('salir')}
              </Boton>
              <Boton variante="secundario" onClick={() => guardar(true)} disabled={guardando}>
                {tc('grabarYSalir')}
              </Boton>
              <Boton onClick={() => guardar(false)} disabled={guardando}>
                {guardando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {tc('grabar')}
              </Boton>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal precio */}
      {editandoPrecio && (
        <Modal
          abierto={!!editandoPrecio}
          alCerrar={() => setEditandoPrecio(null)}
          titulo={t('precioTitulo', { proveedor: editandoPrecio.proveedor, modelo: editandoPrecio.nombre_tecnico })}
        >
          <div className="space-y-3">
            {(['precio_input_1m', 'precio_output_1m', 'precio_cache_read_1m', 'precio_cache_write_1m'] as const).map(
              (k) => (
                <div key={k}>
                  <label className="block text-sm text-gray-700 mb-1">{k}</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formPrecio[k]}
                    onChange={(e) =>
                      setFormPrecio({ ...formPrecio, [k]: Number(e.target.value) })
                    }
                  />
                </div>
              ),
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setEditandoPrecio(null)}>
                {tc('salir')}
              </Boton>
              <Boton variante="secundario" onClick={() => guardarPrecio(true)}>{tc('grabarYSalir')}</Boton>
              <Boton onClick={() => guardarPrecio(false)}>{tc('grabar')}</Boton>
            </div>
          </div>
        </Modal>
      )}

      <ModalConfirmar
        abierto={!!confirmacion}
        titulo={t('eliminarTitulo')}
        mensaje={
          confirmacion
            ? t('eliminarConfirm', { proveedor: confirmacion.proveedor, alias: confirmacion.alias })
            : ''
        }
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={eliminar}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
