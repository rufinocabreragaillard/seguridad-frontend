'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Languages, RefreshCw, Play, CheckCircle2, AlertCircle,
  Globe, Plus, Trash2, Loader2, XCircle,
} from 'lucide-react'
import { traduccionesApi } from '@/lib/api'
import { Boton } from '@/components/ui/boton'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Input } from '@/components/ui/input'
import type { LocaleSoportado, EstadoTraducciones } from '@/lib/tipos'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function BadgeBase({ esBase }: { esBase: boolean }) {
  if (esBase) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-primario-muy-claro text-primario border border-primario/30">Base</span>
  return null
}

// Barra de progreso de generación
function BarraProgreso({ estado, onCancelar }: { estado: EstadoTraducciones; onCancelar: () => void }) {
  const prog = estado.progreso
  if (!estado.generando && !prog?.idiomas_ok?.length) return null

  const total = prog?.total ?? (estado.idiomas?.length ?? 1)
  const ok = prog?.idiomas_ok?.length ?? 0
  const actual = prog?.idioma_actual
  const porcentaje = total > 0 ? Math.round((ok / total) * 100) : 0

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 size={14} className="text-blue-600 animate-spin shrink-0" />
        <p className="text-sm font-medium text-blue-800 flex-1">
          Generando traducciones…{actual ? ` procesando ${actual.toUpperCase()}` : ''}
        </p>
        <button
          onClick={onCancelar}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-red-600 transition-colors"
          title="Detener y resetear el estado de generación"
        >
          <XCircle size={14} /> Cancelar
        </button>
      </div>
      {/* Barra */}
      <div className="w-full bg-blue-100 rounded-full h-2 mb-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${estado.generando && porcentaje === 0 ? 5 : porcentaje}%` }}
        />
      </div>
      {/* Labels de idiomas */}
      <div className="flex gap-2 flex-wrap">
        {estado.idiomas?.map((id) => {
          const esOk = prog?.idiomas_ok?.includes(id)
          const esActual = id === actual
          return (
            <span
              key={id}
              className={`text-xs px-2 py-0.5 rounded border font-medium ${
                esOk
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : esActual
                    ? 'bg-blue-100 border-blue-300 text-blue-700 animate-pulse'
                    : 'bg-surface border-borde text-texto-muted'
              }`}
            >
              {esOk ? '✓ ' : esActual ? '⟳ ' : ''}{id.toUpperCase()}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TraduccionesPage() {
  const [estado, setEstado] = useState<EstadoTraducciones | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Resultado de la última operación
  const [resultadoGen, setResultadoGen] = useState<string | null>(null)
  const [errorGen, setErrorGen] = useState('')
  const [modalCompleto, setModalCompleto] = useState(false)

  // Agregar idioma
  const [modalAgregar, setModalAgregar] = useState(false)
  const [formNuevo, setFormNuevo] = useState({ codigo: '', nombre_nativo: '', nombre_es: '' })
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState('')

  // Eliminar idioma
  const [localEliminar, setLocalEliminar] = useState<LocaleSoportado | null>(null)

  // Polling
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargarEstado = useCallback(async () => {
    try {
      const data = await traduccionesApi.estado()
      setEstado(data)
      setError('')
      return data
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar estado')
      return null
    } finally {
      setCargando(false)
    }
  }, [])

  // Polling automático mientras generando=true
  const iniciarPolling = useCallback(() => {
    if (pollingRef.current) return // ya corriendo
    pollingRef.current = setInterval(async () => {
      const data = await cargarEstado()
      if (data && !data.generando) {
        // Generación terminó
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        const total = Object.values(data.conteos_por_locale ?? {}).reduce((a, b) => a + b, 0)
        if (total > 0) {
          setResultadoGen(`Generación completada. ${total.toLocaleString()} traducciones en BD.`)
        } else {
          setErrorGen('La generación terminó pero no se guardaron traducciones. Revisa los logs del servidor.')
        }
      }
    }, 2500)
  }, [cargarEstado])

  // Cancelar / resetear estado GENERANDO atascado
  const cancelarGeneracion = async () => {
    try {
      await traduccionesApi.cancelar()
      detenerPolling()
      await cargarEstado()
      setErrorGen('')
      setResultadoGen(null)
    } catch (e: unknown) {
      setErrorGen(e instanceof Error ? e.message : 'Error al cancelar')
    }
  }

  const detenerPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => {
    cargarEstado().then((data) => {
      if (data?.generando) iniciarPolling()
    })
    return () => detenerPolling()
  }, [cargarEstado, iniciarPolling, detenerPolling])

  const toggleActivo = async (locale: LocaleSoportado) => {
    if (locale.es_base) return
    try {
      await traduccionesApi.eliminarLocale(locale.codigo)
      await cargarEstado()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar idioma')
    }
  }

  // ── Disparar generación (fire & forget → polling) ─────────────────────────
  const dispararGeneracion = async (modo: 'completo' | 'incremental', idiomas?: string[]) => {
    setResultadoGen(null)
    setErrorGen('')
    try {
      await traduccionesApi.generar(modo, idiomas)
      // El backend devuelve 202 inmediatamente → iniciamos polling
      await cargarEstado()
      iniciarPolling()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al iniciar generación'
      // 409 = ya hay una generación en curso → solo arrancar polling
      if (msg.includes('409') || msg.includes('en curso')) {
        await cargarEstado()
        iniciarPolling()
      } else {
        setErrorGen(msg)
      }
    }
  }

  const generarCompleto = async () => {
    setModalCompleto(false)
    await dispararGeneracion('completo')
  }

  const generarIncremental = async () => {
    await dispararGeneracion('incremental')
  }

  const regenerarLocale = async (codigo: string) => {
    await dispararGeneracion('completo', [codigo])
  }

  // ── Agregar idioma ─────────────────────────────────────────────────────────
  const guardarNuevo = async () => {
    if (!formNuevo.codigo || !formNuevo.nombre_nativo || !formNuevo.nombre_es) {
      setErrorNuevo('Todos los campos son obligatorios')
      return
    }
    setGuardandoNuevo(true)
    setErrorNuevo('')
    try {
      await traduccionesApi.crearLocale({
        codigo: formNuevo.codigo.toLowerCase(),
        nombre_nativo: formNuevo.nombre_nativo,
        nombre_es: formNuevo.nombre_es,
      })
      setModalAgregar(false)
      setFormNuevo({ codigo: '', nombre_nativo: '', nombre_es: '' })
      await cargarEstado()
    } catch (e: unknown) {
      setErrorNuevo(e instanceof Error ? e.message : 'Error al crear idioma')
    } finally {
      setGuardandoNuevo(false)
    }
  }

  // ── Eliminar idioma ────────────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    if (!localEliminar) return
    try {
      await traduccionesApi.eliminarLocale(localEliminar.codigo)
      setLocalEliminar(null)
      await cargarEstado()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primario" />
      </div>
    )
  }

  if (error && !estado) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-error">{error}</div>
      </div>
    )
  }

  const locales = estado?.locales ?? []
  const conteos = estado?.conteos_por_locale ?? {}
  const totalTraducciones = Object.values(conteos).reduce((a, b) => a + b, 0)
  const enGeneracion = estado?.generando ?? false

  return (
    <div className="p-6 max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primario-muy-claro">
          <Languages size={20} className="text-primario" />
        </div>
        <div>
          <h1 className="page-heading">Traducciones</h1>
          <p className="text-sm text-texto-muted">Gestión de idiomas y generación automática de traducciones de catálogos</p>
        </div>
        <div className="ml-auto">
          <Boton variante="contorno" onClick={cargarEstado} className="gap-2" deshabilitado={enGeneracion}>
            <RefreshCw size={14} /> Actualizar
          </Boton>
        </div>
      </div>

      {/* ── Estado general ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-borde rounded-xl p-4">
          <p className="text-xs text-texto-muted mb-1">Última generación</p>
          <p className="text-sm font-medium text-texto">{formatFecha(estado?.ultima_generacion ?? null)}</p>
        </div>
        <div className="bg-surface border border-borde rounded-xl p-4">
          <p className="text-xs text-texto-muted mb-1">Traducciones en BD</p>
          <p className="text-sm font-medium text-texto">{totalTraducciones.toLocaleString()} claves</p>
        </div>
        <div className={`rounded-xl p-4 border ${estado?.pendiente ? 'bg-amber-50 border-amber-200' : 'bg-surface border-borde'}`}>
          <p className="text-xs text-texto-muted mb-1">Cambios pendientes</p>
          <div className="flex items-center gap-1.5">
            {estado?.pendiente
              ? <AlertCircle size={14} className="text-amber-600" />
              : <CheckCircle2 size={14} className="text-green-600" />}
            <p className="text-sm font-medium text-texto">
              {estado?.cambios_pendientes ?? 0} cambios sin traducir
            </p>
          </div>
        </div>
      </div>

      {/* ── Barra de progreso (cuando generando) ──────────────────────────── */}
      {estado && <BarraProgreso estado={estado} />}

      {/* ── Resultado última operación ─────────────────────────────────────── */}
      {resultadoGen && !enGeneracion && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700">{resultadoGen}</p>
        </div>
      )}
      {errorGen && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-error">{errorGen}</p>
        </div>
      )}

      {/* ── Acciones de generación ─────────────────────────────────────────── */}
      <div className="bg-surface border border-borde rounded-xl p-5">
        <h2 className="text-sm font-semibold text-texto mb-1">Generación de traducciones</h2>
        <p className="text-xs text-texto-muted mb-4">
          Las traducciones se generan automáticamente con IA (Gemini Flash) para todos los idiomas activos.
          La generación corre en background — puedes navegar libremente mientras avanza.
        </p>
        <div className="flex gap-3">
          <Boton
            variante="primario"
            onClick={() => setModalCompleto(true)}
            cargando={enGeneracion}
            deshabilitado={enGeneracion}
            className="gap-2"
          >
            <Play size={14} /> Regenerar TODO
          </Boton>
          <Boton
            variante="contorno"
            onClick={generarIncremental}
            cargando={enGeneracion}
            deshabilitado={enGeneracion || (estado?.cambios_pendientes ?? 0) === 0}
            className="gap-2"
          >
            <RefreshCw size={14} /> Solo cambios ({estado?.cambios_pendientes ?? 0})
          </Boton>
        </div>
      </div>

      {/* ── Idiomas soportados ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-borde rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-borde flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-texto">Idiomas soportados</h2>
            <p className="text-xs text-texto-muted mt-0.5">
              Solo los idiomas activos se muestran en el selector del sistema
            </p>
          </div>
          <Boton
            variante="contorno"
            onClick={() => { setFormNuevo({ codigo: '', nombre_nativo: '', nombre_es: '' }); setModalAgregar(true) }}
            className="gap-2"
            deshabilitado={enGeneracion}
          >
            <Plus size={14} /> Agregar idioma
          </Boton>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde bg-fondo">
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-muted uppercase tracking-wider">Idioma</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-muted uppercase tracking-wider">Código</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-muted uppercase tracking-wider">Traducciones</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-muted uppercase tracking-wider">Estado</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-texto-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {locales.map((loc) => {
              const count = conteos[loc.codigo] ?? 0
              const esProcesando = enGeneracion && estado?.progreso?.idioma_actual === loc.codigo
              return (
                <tr
                  key={loc.codigo}
                  className={`hover:bg-fondo/50 transition-colors ${esProcesando ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {esProcesando
                        ? <Loader2 size={14} className="text-blue-600 animate-spin shrink-0" />
                        : <Globe size={14} className="text-texto-muted shrink-0" />
                      }
                      <div>
                        <p className="font-medium text-texto">{loc.nombre_nativo}</p>
                        <p className="text-xs text-texto-muted">{loc.nombre_es}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <code className="text-xs bg-fondo border border-borde rounded px-1.5 py-0.5 text-texto-muted uppercase">{loc.codigo}</code>
                  </td>
                  <td className="px-5 py-3">
                    {loc.es_base
                      ? <span className="text-xs text-texto-muted">Original (no se traduce)</span>
                      : <span className="text-sm text-texto">{count.toLocaleString()} claves</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    <BadgeBase esBase={loc.es_base} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!loc.es_base && (
                        <button
                          onClick={() => toggleActivo(loc)}
                          disabled={enGeneracion}
                          className="text-xs px-2.5 py-1 rounded border border-borde text-texto-muted hover:border-error hover:text-error transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      )}
                      {!loc.es_base && (
                        <Boton
                          variante="contorno"
                          onClick={() => regenerarLocale(loc.codigo)}
                          deshabilitado={enGeneracion}
                          className="text-xs py-1 px-2.5 h-auto gap-1"
                        >
                          <RefreshCw size={11} /> Regenerar
                        </Boton>
                      )}
                      {!loc.es_base && (
                        <button
                          onClick={() => setLocalEliminar(loc)}
                          disabled={enGeneracion}
                          className="p-1.5 rounded text-texto-muted hover:text-error hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Eliminar idioma"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {locales.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-texto-muted">
            No hay idiomas configurados
          </div>
        )}
      </div>

      {/* ── Nota sobre agregar idiomas nuevos ─────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700">
          <strong>Nota:</strong> Para que un idioma nuevo funcione completamente en el sistema, además de registrarlo aquí
          es necesario crear el archivo de mensajes <code className="bg-amber-100 px-1 rounded">messages/xx.json</code> y
          agregarlo al array <code className="bg-amber-100 px-1 rounded">locales</code> en{' '}
          <code className="bg-amber-100 px-1 rounded">src/i18n/config.ts</code>, y luego hacer deploy.
          Los idiomas predefinidos (ES, EN, PT, FR, DE) ya tienen sus archivos de mensajes incluidos.
        </p>
      </div>

      {/* ── Modal confirmación Regenerar TODO ──────────────────────────────── */}
      <ModalConfirmar
        abierto={modalCompleto}
        titulo="Regenerar TODAS las traducciones"
        mensaje={`Se regenerarán las traducciones para todos los idiomas activos (${estado?.idiomas?.join(', ') ?? '…'}). La generación corre en background y puedes seguir navegando. ¿Continuar?`}
        textoConfirmar="Sí, regenerar todo"
        variante="primario"
        alConfirmar={generarCompleto}
        alCerrar={() => setModalCompleto(false)}
      />

      {/* ── Modal eliminar idioma ──────────────────────────────────────────── */}
      <ModalConfirmar
        abierto={!!localEliminar}
        titulo={`Eliminar idioma ${localEliminar?.nombre_es}`}
        mensaje={`Se eliminarán todas las traducciones generadas para ${localEliminar?.nombre_nativo} (${localEliminar?.codigo?.toUpperCase()}). Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar"
        variante="peligro"
        alConfirmar={confirmarEliminar}
        alCerrar={() => setLocalEliminar(null)}
      />

      {/* ── Modal agregar idioma ───────────────────────────────────────────── */}
      <Modal
        abierto={modalAgregar}
        alCerrar={() => setModalAgregar(false)}
        titulo="Agregar idioma"
        className="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Código ISO 639-1"
            value={formNuevo.codigo}
            onChange={(e) => setFormNuevo({ ...formNuevo, codigo: e.target.value.toLowerCase() })}
            placeholder="ej: it, zh, ar"
            maxLength={5}
          />
          <Input
            etiqueta="Nombre nativo"
            value={formNuevo.nombre_nativo}
            onChange={(e) => setFormNuevo({ ...formNuevo, nombre_nativo: e.target.value })}
            placeholder="ej: Italiano, 中文, العربية"
          />
          <Input
            etiqueta="Nombre en español"
            value={formNuevo.nombre_es}
            onChange={(e) => setFormNuevo({ ...formNuevo, nombre_es: e.target.value })}
            placeholder="ej: Italiano, Chino, Árabe"
          />
          {errorNuevo && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-sm text-error">{errorNuevo}</p>
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-700">
              El idioma se creará. Para usarlo en el sistema, primero deberás agregar su archivo de mensajes al proyecto y hacer deploy.
            </p>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Boton variante="contorno" onClick={() => setModalAgregar(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarNuevo} cargando={guardandoNuevo}>
              Agregar
            </Boton>
          </div>
        </div>
      </Modal>

    </div>
  )
}
