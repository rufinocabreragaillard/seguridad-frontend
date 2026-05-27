'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, Save, Lock, EyeClosed, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabla, TablaCabecera, TablaCuerpo, TablaTd, TablaTh } from '@/components/ui/tabla'
import { datosBasicosApi, parametrosApi } from '@/lib/api'
import type { TipoParametro } from '@/lib/tipos'
import { BotonChat } from '@/components/ui/boton-chat'
import { PageHeader } from '@/components/layout/PageHeader'

interface ValorGrupo {
  categoria_parametro: string
  tipo_parametro: string
  valor_parametro: string
  descripcion?: string
  es_privado?: boolean
}

const selectCls = 'rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'

export default function PaginaParametrosGrupo() {
  const t = useTranslations('groupParameters')
  const tc = useTranslations('common')

  // ── Catálogo de tipos (para mostrar nombre y widget) ─────────────────────────
  const [tipos, setTipos] = useState<TipoParametro[]>([])

  // ── Valores del grupo ──────────────────────────────────────────────────────
  const [valores, setValores] = useState<ValorGrupo[]>([])
  const [cargandoVal, setCargandoVal] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  // Revelar valores privados
  const [valoresRevelados, setValoresRevelados] = useState<Record<string, string>>({})
  const [revelando, setRevelando] = useState<string | null>(null)

  const mostrarExito = (msg: string) => { setMensajeExito(msg); setTimeout(() => setMensajeExito(''), 3000) }

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarTipos = useCallback(async () => {
    try {
      const tips = await datosBasicosApi.listarTipos()
      setTipos(tips)
    } catch { /* silencioso */ }
  }, [])

  const cargarValores = useCallback(async () => {
    setCargandoVal(true)
    setValoresRevelados({})
    try {
      const data = await parametrosApi.listarGrupo()
      setValores(data.map((p: ValorGrupo & { es_privado?: boolean }) => ({ ...p, es_privado: p.es_privado ?? false })))
    }
    finally { setCargandoVal(false) }
  }, [])

  useEffect(() => { cargarTipos(); cargarValores() }, [cargarTipos, cargarValores])

  // ── Revelar valor privado ──────────────────────────────────────────────────
  const revelarValor = async (v: ValorGrupo) => {
    const key = `${v.categoria_parametro}/${v.tipo_parametro}`
    if (valoresRevelados[key] !== undefined) {
      setValoresRevelados((prev) => { const n = { ...prev }; delete n[key]; return n })
      return
    }
    setRevelando(key)
    try {
      const res = await parametrosApi.revelarGrupo(v.categoria_parametro, v.tipo_parametro)
      setValoresRevelados((prev) => ({ ...prev, [key]: res.valor }))
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al revelar') }
    finally { setRevelando(null) }
  }

  // ── Guardar valor inline ───────────────────────────────────────────────────
  const guardarInline = async (cat: string, tipo: string, valor: string) => {
    const key = `${cat}/${tipo}`
    setGuardando(key); setError('')
    try {
      await parametrosApi.upsertGrupo({ categoria_parametro: cat, tipo_parametro: tipo, valor_parametro: valor })
      setValoresRevelados((prev) => { const n = { ...prev }; delete n[key]; return n })
      mostrarExito(t('parametroGuardado'))
      cargarValores()
    } catch (e) { setError(e instanceof Error ? e.message : tc('errorAlGuardar')) }
    finally { setGuardando(null) }
  }

  // ── Datos derivados ────────────────────────────────────────────────────────
  const categoriasDisponibles = Array.from(new Set(valores.map((v) => v.categoria_parametro))).sort()

  const q = busqueda.trim().toLowerCase()
  const valoresFiltrados = valores.filter((v) => {
    if (filtroCategoria && v.categoria_parametro !== filtroCategoria) return false
    if (!q) return true
    return (
      v.categoria_parametro.toLowerCase().includes(q) ||
      v.tipo_parametro.toLowerCase().includes(q) ||
      (v.valor_parametro || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat />
      <div>
        <PageHeader i18nNamespace="groupParameters" />
      </div>

      {mensajeExito && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3"><p className="text-sm text-exito">{mensajeExito}</p></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder={tc('buscar')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={selectCls}>
          <option value="">{t('todas')}</option>
          {categoriasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {cargandoVal ? (
        <div className="flex flex-col gap-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
      ) : (
        <Tabla>
          <TablaCabecera>
            <tr>
              <TablaTh>{t('colCodigo')}</TablaTh>
              <TablaTh>{t('colNombre')}</TablaTh>
              <TablaTh>{t('placeholderValor')}</TablaTh>
              <TablaTh className="text-right">{tc('guardar')}</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {valoresFiltrados.length === 0 ? (
              <tr>
                <TablaTd className="text-center text-texto-muted py-8" colSpan={4 as never}>
                  {busqueda || filtroCategoria ? t('sinValoresCategoria') : t('sinValoresGrupo')}
                </TablaTd>
              </tr>
            ) : valoresFiltrados.map((v) => {
              const key = `${v.categoria_parametro}/${v.tipo_parametro}`
              const tipo = tipos.find((tp) => tp.categoria_parametro === v.categoria_parametro && tp.tipo_parametro === v.tipo_parametro)
              const esPrivado = v.es_privado === true
              const valorRevelado = valoresRevelados[key]
              const estaRevelado = valorRevelado !== undefined

              return (
                <tr key={key} className="border-b border-borde last:border-0 hover:bg-fondo/50">
                  <TablaTd>
                    <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{v.categoria_parametro}</code>
                    <span className="mx-1 text-texto-light">/</span>
                    <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{v.tipo_parametro}</code>
                    {esPrivado && <Lock size={10} className="text-amber-500 ml-1 inline" />}
                  </TablaTd>
                  <TablaTd className="text-texto-muted text-sm">{tipo?.nombre || <span className="text-texto-light">—</span>}</TablaTd>
                  <TablaTd className="max-w-[360px]">
                    {esPrivado ? (
                      <div className="flex items-center gap-2">
                        <input
                          type={estaRevelado ? 'text' : 'password'}
                          defaultValue={estaRevelado ? valorRevelado : ''}
                          key={estaRevelado ? `rev-${key}` : `hid-${key}`}
                          placeholder="Ingresar nuevo valor para reemplazar"
                          onBlur={(e) => {
                            const val = e.target.value.trim()
                            if (val && val !== valorRevelado) guardarInline(v.categoria_parametro, v.tipo_parametro, val)
                          }}
                          className="flex-1 min-w-0 text-sm text-texto bg-transparent border-b border-transparent hover:border-borde focus:border-primario focus:outline-none py-0.5 font-mono"
                        />
                        <button
                          onClick={() => revelarValor(v)}
                          disabled={revelando === key}
                          className="p-1.5 rounded-lg text-texto-muted hover:text-amber-600 transition-colors shrink-0"
                          title={estaRevelado ? 'Ocultar' : 'Revelar valor actual'}
                        >
                          {revelando === key
                            ? <span className="text-xs">...</span>
                            : estaRevelado ? <EyeClosed size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    ) : tipo?.tipo_widget === 'BOOLEAN' ? (
                      <select
                        defaultValue={(v.valor_parametro || '').trim().toLowerCase() === 'true' ? 'true' : 'false'}
                        onChange={(e) => { if (e.target.value !== v.valor_parametro) guardarInline(v.categoria_parametro, v.tipo_parametro, e.target.value) }}
                        className="w-full text-sm text-texto bg-transparent border-b border-transparent hover:border-borde focus:border-primario focus:outline-none py-0.5"
                      >
                        <option value="true">Sí (true)</option>
                        <option value="false">No (false)</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        defaultValue={v.valor_parametro}
                        onBlur={(e) => { if (e.target.value !== v.valor_parametro) guardarInline(v.categoria_parametro, v.tipo_parametro, e.target.value) }}
                        className="w-full text-sm text-texto bg-transparent border-b border-transparent hover:border-borde focus:border-primario focus:outline-none py-0.5"
                      />
                    )}
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      {!esPrivado && tipo?.tipo_widget !== 'BOOLEAN' && (
                        <button
                          onClick={(e) => { const inp = (e.currentTarget.closest('tr')?.querySelector('input') as HTMLInputElement); if (inp) guardarInline(v.categoria_parametro, v.tipo_parametro, inp.value) }}
                          disabled={guardando === key}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors shrink-0" title={tc('guardar')}>
                          <Save size={14} />
                        </button>
                      )}
                    </div>
                  </TablaTd>
                </tr>
              )
            })}
          </TablaCuerpo>
        </Tabla>
      )}
    </div>
  )
}
