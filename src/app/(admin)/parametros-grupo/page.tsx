'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Eye, Save } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { datosBasicosApi, parametrosApi } from '@/lib/api'
import type { CategoriaParametro, TipoParametro } from '@/lib/tipos'
import { BotonChat } from '@/components/ui/boton-chat'

type TabId = 'categorias' | 'valores'

interface ValorGrupo {
  categoria_parametro: string
  tipo_parametro: string
  valor_parametro: string
  descripcion?: string
}

const selectCls = 'rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'

export default function PaginaParametrosGrupo() {
  const t = useTranslations('parametrosGrupo')
  const tc = useTranslations('common')
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Catálogo ───────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaParametro[]>([])
  const [tipos, setTipos] = useState<TipoParametro[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)

  // ── Valores del grupo ──────────────────────────────────────────────────────
  const [valores, setValores] = useState<ValorGrupo[]>([])
  const [cargandoVal, setCargandoVal] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  // Nuevo valor
  const [nuevoVal, setNuevoVal] = useState({ categoria_parametro: '', tipo_parametro: '', valor_parametro: '' })
  const [tiposPorCat, setTiposPorCat] = useState<TipoParametro[]>([])

  // Eliminar
  const [valAEliminar, setValAEliminar] = useState<ValorGrupo | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const mostrarExito = (msg: string) => { setMensajeExito(msg); setTimeout(() => setMensajeExito(''), 3000) }

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarCatalogo = useCallback(async () => {
    setCargandoCat(true)
    try {
      const [cats, tips] = await Promise.all([datosBasicosApi.listarCategorias(), datosBasicosApi.listarTipos()])
      setCategorias(cats)
      setTipos(tips)
    } finally { setCargandoCat(false) }
  }, [])

  const cargarValores = useCallback(async () => {
    setCargandoVal(true)
    try { setValores(await parametrosApi.listarGrupo()) }
    finally { setCargandoVal(false) }
  }, [])

  useEffect(() => { cargarCatalogo(); cargarValores() }, [cargarCatalogo, cargarValores])

  useEffect(() => {
    if (!nuevoVal.categoria_parametro) { setTiposPorCat([]); return }
    datosBasicosApi.listarTipos(nuevoVal.categoria_parametro).then(setTiposPorCat).catch(() => {})
  }, [nuevoVal.categoria_parametro])

  useEffect(() => {
    if (filtroCategoria) {
      setNuevoVal((prev) => ({ ...prev, categoria_parametro: filtroCategoria, tipo_parametro: '' }))
    }
  }, [filtroCategoria])

  // ── Guardar valor inline ───────────────────────────────────────────────────
  const guardarInline = async (cat: string, tipo: string, valor: string) => {
    const key = `${cat}/${tipo}`
    setGuardando(key); setError('')
    try {
      await parametrosApi.upsertGrupo({ categoria_parametro: cat, tipo_parametro: tipo, valor_parametro: valor })
      mostrarExito(t('parametroGuardado'))
      cargarValores()
    } catch (e) { setError(e instanceof Error ? e.message : tc('errorAlGuardar')) }
    finally { setGuardando(null) }
  }

  // ── Agregar nuevo valor ────────────────────────────────────────────────────
  const agregarNuevo = async () => {
    if (!nuevoVal.categoria_parametro || !nuevoVal.tipo_parametro || !nuevoVal.valor_parametro) {
      setError(t('errorCategoriaTipoValorObligatorios')); return
    }
    await guardarInline(nuevoVal.categoria_parametro, nuevoVal.tipo_parametro, nuevoVal.valor_parametro)
    setNuevoVal({ categoria_parametro: '', tipo_parametro: '', valor_parametro: '' })
  }

  // ── Eliminar valor ─────────────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    if (!valAEliminar) return
    setEliminando(true)
    try {
      await parametrosApi.eliminarGrupo(valAEliminar.categoria_parametro, valAEliminar.tipo_parametro)
      mostrarExito(t('parametroEliminado'))
      setValAEliminar(null)
      cargarValores()
    } catch (e) { setError(e instanceof Error ? e.message : tc('errorAlEliminar')) }
    finally { setEliminando(false) }
  }

  // ── Datos derivados ────────────────────────────────────────────────────────
  const valoresFiltrados = filtroCategoria ? valores.filter((v) => v.categoria_parametro === filtroCategoria) : valores

  // Categorías que tienen al menos un valor en el grupo (o todas del catálogo)
  const categoriasConInfo = categorias.map((c) => ({
    ...c,
    nValores: valores.filter((v) => v.categoria_parametro === c.categoria_parametro).length,
  }))

  const tiposDisponibles = tiposPorCat.filter(
    (t) => !valores.some((v) => v.categoria_parametro === t.categoria_parametro && v.tipo_parametro === t.tipo_parametro)
  )

  const tabs: { id: TabId; label: string }[] = [
    { id: 'categorias', label: t('tabCategorias') },
    { id: 'valores', label: t('tabValores') },
  ]

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat />
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {mensajeExito && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3"><p className="text-sm text-exito">{mensajeExito}</p></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{error}</p></div>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setTabActiva(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tabActiva === tab.id ? 'bg-surface text-primario-oscuro shadow-sm border border-borde' : 'text-texto-muted hover:text-texto'}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* ── Tab: Categorías ── */}
      {tabActiva === 'categorias' && (
        <>
          {cargandoCat ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <Tabla>
              <TablaCabecera><tr>
                <TablaTh>{t('colCodigo')}</TablaTh><TablaTh>{t('colNombre')}</TablaTh><TablaTh>{t('colDescripcion')}</TablaTh>
                <TablaTh>{t('colValoresConfig')}</TablaTh><TablaTh className="text-right">{tc('acciones')}</TablaTh>
              </tr></TablaCabecera>
              <TablaCuerpo>
                {categoriasConInfo.length === 0 ? (
                  <TablaFila><TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>{t('sinCategoriasCatalogo')}</TablaTd></TablaFila>
                ) : categoriasConInfo.map((c) => (
                  <TablaFila key={c.categoria_parametro}>
                    <TablaTd><code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">{c.categoria_parametro}</code></TablaTd>
                    <TablaTd className="font-medium">{c.nombre}</TablaTd>
                    <TablaTd className="text-texto-muted text-sm" onDoubleClick={() => { setFiltroCategoria(c.categoria_parametro); setTabActiva('valores') }}>{c.descripcion || <span className="text-texto-light">—</span>}</TablaTd>
                    <TablaTd>
                      {c.nValores > 0
                        ? <Insignia variante="exito">{t('configurados', { n: c.nValores })}</Insignia>
                        : <Insignia variante="neutro">{t('sinValores')}</Insignia>}
                    </TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setFiltroCategoria(c.categoria_parametro); setTabActiva('valores') }}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title={t('verValores')}>
                          <Eye size={14} />
                        </button>
                      </div>
                    </TablaTd>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* ── Tab: Valores ── */}
      {tabActiva === 'valores' && (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm text-texto-muted">{t('filtrarPorCategoria')}</p>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={selectCls}>
              <option value="">{t('todas')}</option>
              {categorias.map((c) => <option key={c.categoria_parametro} value={c.categoria_parametro}>{c.nombre}</option>)}
            </select>
          </div>

          {cargandoVal ? (
            <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
          ) : (
            <div className="flex flex-col gap-3">
              {valoresFiltrados.length === 0 ? (
                <p className="text-sm text-texto-muted text-center py-8">
                  {filtroCategoria ? t('sinValoresCategoria') : t('sinValoresGrupo')}
                </p>
              ) : valoresFiltrados.map((v) => {
                const key = `${v.categoria_parametro}/${v.tipo_parametro}`
                const tipo = tipos.find((t) => t.categoria_parametro === v.categoria_parametro && t.tipo_parametro === v.tipo_parametro)
                return (
                  <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde bg-surface">
                    <div className="shrink-0 w-72">
                      <p className="text-xs font-semibold text-texto-muted">
                        <code>{v.categoria_parametro}</code>
                        <span className="mx-1 text-texto-light">/</span>
                        <code>{v.tipo_parametro}</code>
                      </p>
                      {tipo && <p className="text-xs text-texto-muted mt-0.5">{tipo.nombre}</p>}
                    </div>
                    <input
                      type="text"
                      defaultValue={v.valor_parametro}
                      onBlur={(e) => { if (e.target.value !== v.valor_parametro) guardarInline(v.categoria_parametro, v.tipo_parametro, e.target.value) }}
                      className="flex-1 min-w-0 text-sm text-texto bg-transparent border-b border-transparent hover:border-borde focus:border-primario focus:outline-none py-0.5"
                    />
                    <button
                      onClick={(e) => { const inp = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement); if (inp) guardarInline(v.categoria_parametro, v.tipo_parametro, inp.value) }}
                      disabled={guardando === key}
                      className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors shrink-0" title={tc('guardar')}>
                      <Save size={14} />
                    </button>
                    <button onClick={() => setValAEliminar(v)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors shrink-0" title={tc('eliminar')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Agregar nuevo */}
          <div className="border-t border-borde pt-4 mt-2">
            <p className="text-xs font-semibold text-texto-muted uppercase tracking-wider mb-3">{t('agregarParametro')}</p>
            <div className="flex flex-col gap-2">
              <div className={`gap-2 ${filtroCategoria ? 'flex' : 'grid grid-cols-2'}`}>
                {!filtroCategoria && (
                  <select value={nuevoVal.categoria_parametro}
                    onChange={(e) => setNuevoVal({ categoria_parametro: e.target.value, tipo_parametro: '', valor_parametro: nuevoVal.valor_parametro })}
                    className={selectCls}>
                    <option value="">{t('seleccionaCategoria')}</option>
                    {categorias.map((c) => <option key={c.categoria_parametro} value={c.categoria_parametro}>{c.nombre}</option>)}
                  </select>
                )}
                <select value={nuevoVal.tipo_parametro}
                  onChange={(e) => setNuevoVal({ ...nuevoVal, tipo_parametro: e.target.value })}
                  disabled={!nuevoVal.categoria_parametro && !filtroCategoria} className={`${selectCls} flex-1`}>
                  <option value="">{t('seleccionaTipo')}</option>
                  {tiposDisponibles.map((tp) => <option key={tp.tipo_parametro} value={tp.tipo_parametro}>{tp.nombre}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder={t('placeholderValor')} value={nuevoVal.valor_parametro}
                  onChange={(e) => setNuevoVal({ ...nuevoVal, valor_parametro: e.target.value })}
                  className="flex-1 rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario" />
                <Boton variante="primario" tamano="sm" onClick={agregarNuevo}
                  disabled={!nuevoVal.categoria_parametro || !nuevoVal.tipo_parametro || !nuevoVal.valor_parametro}>
                  <Plus size={14} /> {t('agregar')}
                </Boton>
              </div>
            </div>
          </div>
        </>
      )}

      <ModalConfirmar
        abierto={!!valAEliminar}
        alCerrar={() => setValAEliminar(null)}
        alConfirmar={confirmarEliminar}
        titulo={t('eliminarTitulo')}
        mensaje={valAEliminar ? t('eliminarConfirm', { categoria: valAEliminar.categoria_parametro, tipo: valAEliminar.tipo_parametro }) : ''}
        textoConfirmar={tc('eliminar')}
        cargando={eliminando}
      />
    </div>
  )
}
