'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Play, RefreshCw, AlertTriangle } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { limpiezaApi } from '@/lib/api'
import { formatFecha, formatNumero } from '@/lib/formatters'
import type { PoliticaLimpieza, ResultadoLimpieza } from '@/lib/tipos'

export default function PaginaLimpieza() {
  const t = useTranslations('limpieza')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()
  const toast = useToast()
  const esSuperAdmin = grupoActivo === 'ADMIN'

  function unidad(modo: 'TIEMPO' | 'CANTIDAD') {
    return modo === 'TIEMPO' ? t('unidadDias') : t('unidadFilas')
  }

  const [politicas, setPoliticas] = useState<PoliticaLimpieza[]>([])
  const [cargando, setCargando] = useState(true)

  // Modal ejecutar
  const [modalEjecutar, setModalEjecutar] = useState<PoliticaLimpieza | null>(null)
  const [formModo, setFormModo] = useState<'TIEMPO' | 'CANTIDAD'>('TIEMPO')
  const [formValor, setFormValor] = useState<number>(90)
  const [confirmando, setConfirmando] = useState(false)

  // Confirmar ejecucion
  const [confirmacion, setConfirmacion] = useState<{ codigo: string; modo: 'TIEMPO' | 'CANTIDAD'; valor: number } | null>(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoLimpieza | null>(null)

  // Ejecutar todas
  const [confirmarTodas, setConfirmarTodas] = useState(false)
  const [ejecutandoTodas, setEjecutandoTodas] = useState(false)
  const [resultadosTodas, setResultadosTodas] = useState<ResultadoLimpieza[] | null>(null)

  const cargar = useCallback(async () => {
    if (!esSuperAdmin) { setCargando(false); return }
    setCargando(true)
    try {
      setPoliticas(await limpiezaApi.listar())
    } catch (e) {
      toast.error(t('errorCargarPoliticas'), e instanceof Error ? e.message : undefined)
    } finally { setCargando(false) }
  }, [esSuperAdmin, toast, t])

  useEffect(() => { cargar() }, [cargar])

  const abrirEjecutar = (p: PoliticaLimpieza) => {
    setModalEjecutar(p)
    setFormModo(p.modo)
    setFormValor(p.valor)
    setUltimoResultado(null)
  }

  const lanzarConfirmacion = () => {
    if (!modalEjecutar) return
    setConfirmacion({ codigo: modalEjecutar.codigo_tabla, modo: formModo, valor: formValor })
  }

  const ejecutar = async () => {
    if (!confirmacion) return
    setEjecutando(true)
    try {
      const r = await limpiezaApi.ejecutar(confirmacion.codigo, confirmacion.modo, confirmacion.valor)
      setUltimoResultado(r)
      setConfirmacion(null)
      await limpiezaApi.actualizar(confirmacion.codigo, { modo: confirmacion.modo, valor: confirmacion.valor })
      toast.success(t('toastLimpiezaEjecutada'), t('toastFilasEliminadas', { filas: formatNumero(r.filas_eliminadas), tabla: r.codigo_tabla }))
      cargar()
    } catch (e) {
      toast.error(t('errorEjecutarLimpieza'), e instanceof Error ? e.message : undefined)
      setConfirmacion(null)
    } finally { setEjecutando(false) }
  }

  const ejecutarTodas = async () => {
    setEjecutandoTodas(true); setConfirmarTodas(false)
    try {
      const res = await limpiezaApi.ejecutarTodas()
      setResultadosTodas(res)
      const total = res.reduce((acc, r) => acc + Math.max(0, r.filas_eliminadas), 0)
      toast.success(t('toastLimpiezaCompletaEjecutada'), t('toastTotalFilasEliminadas', { filas: formatNumero(total) }))
      cargar()
    } catch (e) {
      toast.error(t('errorEjecutarTodas'), e instanceof Error ? e.message : undefined)
    } finally { setEjecutandoTodas(false) }
  }

  const togglePoliticaActiva = async (p: PoliticaLimpieza) => {
    try {
      await limpiezaApi.actualizar(p.codigo_tabla, { activa: !p.activa })
      toast.success(p.activa ? t('toastPoliticaDesactivada') : t('toastPoliticaActivada'))
      cargar()
    } catch (e) {
      toast.error(t('errorActualizarPolitica'), e instanceof Error ? e.message : undefined)
    }
  }

  if (!esSuperAdmin) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl">
        <h2 className="page-heading">{t('titulo')}</h2>
        <div className="flex items-start gap-3 p-4 rounded-lg border border-borde bg-fondo">
          <AlertTriangle size={20} className="text-error mt-0.5" />
          <div>
            <p className="text-sm font-medium text-texto">{t('accesoRestringidoTitulo')}</p>
            <p className="text-sm text-texto-muted mt-1">
              {t('accesoRestringidoMensaje')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">
          {t.rich('subtitulo', {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Boton variante="contorno" onClick={cargar} disabled={cargando}>
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
          {t('refrescar')}
        </Boton>
        <Boton variante="primario" onClick={() => setConfirmarTodas(true)} cargando={ejecutandoTodas} disabled={cargando || politicas.length === 0}>
          <Play size={15} />
          {t('ejecutarTodasActivas')}
        </Boton>
      </div>

      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>{t('colTabla')}</TablaTh>
            <TablaTh>{t('colDescripcion')}</TablaTh>
            <TablaTh className="w-32">{t('colModo')}</TablaTh>
            <TablaTh className="w-24">{t('colValor')}</TablaTh>
            <TablaTh className="w-32">{t('colActiva')}</TablaTh>
            <TablaTh className="w-44">{t('colUltimaEjecucion')}</TablaTh>
            <TablaTh className="w-32">{t('colFilasEliminadas')}</TablaTh>
            <TablaTh className="w-32 text-right">{tc('acciones')}</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>{t('cargandoPoliticas')}</TablaTd></TablaFila>
          ) : politicas.length === 0 ? (
            <TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>{t('sinPoliticas')}</TablaTd></TablaFila>
          ) : politicas.map((p) => (
            <TablaFila key={p.codigo_tabla}>
              <TablaTd className="font-mono text-xs">{p.codigo_tabla}</TablaTd>
              <TablaTd className="text-sm">
                {p.descripcion}
                {p.preserva_agregado && (
                  <span className="ml-2 text-xs text-texto-muted">{t('preservaResumenMensual')}</span>
                )}
              </TablaTd>
              <TablaTd>
                <Insignia variante={p.modo === 'TIEMPO' ? 'primario' : 'neutro'}>
                  {p.modo === 'TIEMPO' ? t('modoPorTiempo') : t('modoPorCantidad')}
                </Insignia>
              </TablaTd>
              <TablaTd className="text-sm">{formatNumero(p.valor)} {unidad(p.modo)}</TablaTd>
              <TablaTd>
                <button onClick={() => togglePoliticaActiva(p)} className="cursor-pointer">
                  <Insignia variante={p.activa ? 'exito' : 'neutro'}>
                    {p.activa ? t('activa') : t('inactiva')}
                  </Insignia>
                </button>
              </TablaTd>
              <TablaTd className="text-xs">{formatFecha(p.ultima_ejecucion)}</TablaTd>
              <TablaTd className="text-sm">
                {p.ultimas_filas_eliminadas != null
                  ? formatNumero(p.ultimas_filas_eliminadas)
                  : '—'}
              </TablaTd>
              <TablaTd className="text-right">
                <Boton variante="primario" tamano="sm" onClick={() => abrirEjecutar(p)}>
                  <Play size={13} />{t('ejecutar')}
                </Boton>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      {/* Modal: configurar y ejecutar limpieza puntual */}
      <Modal
        abierto={!!modalEjecutar}
        alCerrar={() => { setModalEjecutar(null); setUltimoResultado(null) }}
        titulo={modalEjecutar ? t('modalLimpiarTitulo', { tabla: modalEjecutar.codigo_tabla }) : ''}
      >
        {modalEjecutar && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-texto-muted">{modalEjecutar.descripcion}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-texto">{t('etiquetaModo')}</label>
                <select
                  value={formModo}
                  onChange={(e) => setFormModo(e.target.value as 'TIEMPO' | 'CANTIDAD')}
                  className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
                >
                  <option value="TIEMPO">{t('opcionPorTiempo')}</option>
                  <option value="CANTIDAD">{t('opcionPorCantidad')}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-texto">
                  {formModo === 'TIEMPO' ? t('etiquetaDiasConservar') : t('etiquetaFilasConservar')}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={formValor}
                  onChange={(e) => setFormValor(Math.max(1, parseInt(e.target.value || '0')))}
                />
              </div>
            </div>

            {modalEjecutar.preserva_agregado && (
              <div className="text-xs text-texto-muted bg-fondo border border-borde rounded p-3">
                {t('avisoPreservaResumen')}
              </div>
            )}

            {ultimoResultado && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                {t.rich('limpiezaEjecutadaResultado', {
                  filas: formatNumero(ultimoResultado.filas_eliminadas),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Boton variante="contorno" onClick={() => setModalEjecutar(null)}>{tc('cerrar')}</Boton>
              <Boton variante="peligro" onClick={lanzarConfirmacion} disabled={confirmando}>
                <Trash2 size={15} />
                {t('ejecutarLimpieza')}
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmacion ejecucion puntual */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutar}
        titulo={t('confirmarTitulo')}
        mensaje={confirmacion ? (
          confirmacion.modo === 'TIEMPO'
            ? t('confirmarMensajeTiempo', { tabla: confirmacion.codigo, valor: confirmacion.valor })
            : t('confirmarMensajeCantidad', { tabla: confirmacion.codigo, valor: formatNumero(confirmacion.valor) })
        ) : ''}
        textoConfirmar={t('siLimpiar')}
        cargando={ejecutando}
      />

      {/* Confirmacion ejecutar todas */}
      <ModalConfirmar
        abierto={confirmarTodas}
        alCerrar={() => setConfirmarTodas(false)}
        alConfirmar={ejecutarTodas}
        titulo={t('confirmarTodasTitulo')}
        mensaje={t('confirmarTodasMensaje', { count: politicas.filter((p) => p.activa).length })}
        textoConfirmar={t('siEjecutarTodas')}
        cargando={ejecutandoTodas}
      />

      {/* Resultados de ejecutar todas */}
      <Modal
        abierto={!!resultadosTodas}
        alCerrar={() => setResultadosTodas(null)}
        titulo={t('resultadosCompletaTitulo')}
      >
        {resultadosTodas && (
          <div className="flex flex-col gap-3">
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>{t('colTabla')}</TablaTh>
                  <TablaTh>{t('colModo')}</TablaTh>
                  <TablaTh>{t('colValor')}</TablaTh>
                  <TablaTh className="text-right">{t('colFilasEliminadasLargo')}</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {resultadosTodas.map((r) => (
                  <TablaFila key={r.codigo_tabla}>
                    <TablaTd className="font-mono text-xs">{r.codigo_tabla}</TablaTd>
                    <TablaTd className="text-sm">{r.modo}</TablaTd>
                    <TablaTd className="text-sm">{formatNumero(r.valor)}</TablaTd>
                    <TablaTd className="text-right text-sm">
                      {r.filas_eliminadas < 0
                        ? <span className="text-error">{tc('error')}</span>
                        : formatNumero(r.filas_eliminadas)}
                    </TablaTd>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>
            <div className="flex justify-end">
              <Boton variante="contorno" onClick={() => setResultadosTodas(null)}>{tc('cerrar')}</Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
