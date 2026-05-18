'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, Edit3, Eye, Trash2, RefreshCw, Download } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import {
  Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd,
} from '@/components/ui/tabla'
import { PageHeader } from '@/components/layout/PageHeader'
import { propuestasCatalogoApi } from '@/lib/api'
import type {
  PropuestaCatalogo, PropuestaAmbito, PropuestaEstado, PropuestaFuente,
} from '@/lib/tipos'
import { exportarExcel, type ColumnaExport } from '@/lib/exportar-excel'

const AMBITOS: PropuestaAmbito[] = ['tipo_documento', 'tipo_caract', 'categoria_caract', 'rel_tipo_caract']
const ESTADOS: PropuestaEstado[] = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'MODIFICADA']
const FUENTES: PropuestaFuente[] = ['LLM', 'HUMANO', 'CURACION']

const VARIANTE_ESTADO: Record<PropuestaEstado, 'neutro' | 'exito' | 'error' | 'advertencia'> = {
  PENDIENTE: 'neutro',
  APROBADA: 'exito',
  RECHAZADA: 'error',
  MODIFICADA: 'advertencia',
}

const COLUMNAS_EXPORT: ColumnaExport[] = [
  { titulo: '#', campo: 'id_propuesta' },
  { titulo: 'Código', campo: 'codigo_propuesto' },
  { titulo: 'Nombre', campo: 'nombre_propuesto' },
  { titulo: 'Ámbito', campo: 'ambito' },
  { titulo: 'Frecuencia', campo: 'frecuencia_observada' },
  { titulo: 'Fuente', campo: 'fuente' },
  { titulo: 'Estado', campo: 'estado' },
  { titulo: 'Grupo', campo: 'codigo_grupo' },
  { titulo: 'Habilidad origen', campo: 'codigo_habilidad_origen' },
  { titulo: 'Decidido por', campo: 'decidido_por' },
  { titulo: 'Decidido en', campo: 'decidido_en' },
]

export default function PaginaCatalogProposals() {
  const t = useTranslations('catalogProposals')
  const tc = useTranslations('common')

  // ── State ────────────────────────────────────────────────────────────────
  const [propuestas, setPropuestas] = useState<PropuestaCatalogo[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<PropuestaEstado | ''>('PENDIENTE')
  const [filtroAmbito, setFiltroAmbito] = useState<PropuestaAmbito | ''>('')
  const [filtroFuente, setFiltroFuente] = useState<PropuestaFuente | ''>('')
  const [incluirDecididas, setIncluirDecididas] = useState(false)

  // Detalle / decidir / eliminar
  const [verDetalle, setVerDetalle] = useState<PropuestaCatalogo | null>(null)
  const [decidir, setDecidir] = useState<PropuestaCatalogo | null>(null)
  const [decisionTipo, setDecisionTipo] = useState<'APROBADA' | 'RECHAZADA' | 'MODIFICADA'>('APROBADA')
  const [decisionAdmin, setDecisionAdmin] = useState('')
  const [overrideCodigo, setOverrideCodigo] = useState('')
  const [overrideNombre, setOverrideNombre] = useState('')
  const [overrideDescripcion, setOverrideDescripcion] = useState('')
  const [decidiendo, setDecidiendo] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<PropuestaCatalogo | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const data = await propuestasCatalogoApi.listar({
        estado: filtroEstado || undefined,
        ambito: filtroAmbito || undefined,
        fuente: filtroFuente || undefined,
        incluir_decididas: incluirDecididas,
      })
      setPropuestas(data)
    } finally {
      setCargando(false)
    }
  }, [filtroEstado, filtroAmbito, filtroFuente, incluirDecididas])

  useEffect(() => {
    cargar()
  }, [cargar])

  // ── Abrir modal decidir ──────────────────────────────────────────────────
  const abrirDecidir = (p: PropuestaCatalogo, tipo: 'APROBADA' | 'RECHAZADA' | 'MODIFICADA') => {
    setDecidir(p)
    setDecisionTipo(tipo)
    setDecisionAdmin('')
    setOverrideCodigo(p.codigo_propuesto || '')
    setOverrideNombre(p.nombre_propuesto || '')
    setOverrideDescripcion(p.descripcion_propuesta || '')
  }

  const confirmarDecision = async () => {
    if (!decidir) return
    setDecidiendo(true)
    try {
      const body: Parameters<typeof propuestasCatalogoApi.decidir>[1] = {
        estado: decisionTipo,
      }
      if (decisionAdmin.trim()) body.decision_admin = decisionAdmin.trim()
      if (decisionTipo === 'MODIFICADA' || decisionTipo === 'APROBADA') {
        if (overrideCodigo.trim() && overrideCodigo.trim() !== decidir.codigo_propuesto) {
          body.codigo_propuesto = overrideCodigo.trim()
        }
        if (overrideNombre.trim() && overrideNombre.trim() !== decidir.nombre_propuesto) {
          body.nombre_propuesto = overrideNombre.trim()
        }
        if (overrideDescripcion.trim() && overrideDescripcion.trim() !== (decidir.descripcion_propuesta || '')) {
          body.descripcion_propuesta = overrideDescripcion.trim()
        }
      }
      await propuestasCatalogoApi.decidir(decidir.id_propuesta, body)
      setDecidir(null)
      await cargar()
    } finally {
      setDecidiendo(false)
    }
  }

  const ejecutarEliminar = async () => {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await propuestasCatalogoApi.eliminar(confirmEliminar.id_propuesta)
      setConfirmEliminar(null)
      await cargar()
    } finally {
      setEliminando(false)
    }
  }

  const exportar = () => {
    exportarExcel(propuestas as unknown as Record<string, unknown>[], COLUMNAS_EXPORT, 'propuestas_catalogo')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const filasFiltradas = useMemo(() => propuestas, [propuestas])

  return (
    <div className="space-y-4 p-4">
      <PageHeader titulo={t('titulo')} subtitulo={t('subtitulo')} i18nNamespace="catalogProposals" />

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('filtroEstado')}</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as PropuestaEstado | '')}
          >
            <option value="">{t('todos')}</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('filtroAmbito')}</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filtroAmbito}
            onChange={(e) => setFiltroAmbito(e.target.value as PropuestaAmbito | '')}
          >
            <option value="">{t('todos')}</option>
            {AMBITOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('filtroFuente')}</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filtroFuente}
            onChange={(e) => setFiltroFuente(e.target.value as PropuestaFuente | '')}
          >
            <option value="">{t('todos')}</option>
            {FUENTES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={incluirDecididas}
            onChange={(e) => setIncluirDecididas(e.target.checked)}
          />
          {t('incluirDecididas')}
        </label>
        <Boton variante="secundario" tamano="sm" onClick={cargar} cargando={cargando}>
          <RefreshCw size={14} />
        </Boton>
        <Boton variante="secundario" tamano="sm" onClick={exportar} disabled={propuestas.length === 0}>
          <Download size={14} /> {t('exportar')}
        </Boton>
      </div>

      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaTh>#</TablaTh>
            <TablaTh>{t('colCodigo')}</TablaTh>
            <TablaTh>{t('colNombre')}</TablaTh>
            <TablaTh>{t('colAmbito')}</TablaTh>
            <TablaTh>{t('colFrecuencia')}</TablaTh>
            <TablaTh>{t('colFuente')}</TablaTh>
            <TablaTh>{t('colEstado')}</TablaTh>
            <TablaTh>{t('colDecididoEn')}</TablaTh>
            <TablaTh className="text-right">{t('colAcciones')}</TablaTh>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {filasFiltradas.length === 0 ? (
            <TablaFila>
              <TablaTd colSpan={9} className="text-center text-gray-500 py-6">
                {cargando ? '…' : t('sinPropuestas')}
              </TablaTd>
            </TablaFila>
          ) : filasFiltradas.map((p) => (
            <TablaFila key={p.id_propuesta}>
              <TablaTd className="font-mono text-xs">{p.id_propuesta}</TablaTd>
              <TablaTd className="font-mono text-xs">{p.codigo_propuesto || '—'}</TablaTd>
              <TablaTd>{p.nombre_propuesto}</TablaTd>
              <TablaTd className="text-xs">{p.ambito}</TablaTd>
              <TablaTd className="text-center">{p.frecuencia_observada}</TablaTd>
              <TablaTd className="text-xs">{p.fuente}</TablaTd>
              <TablaTd>
                <Insignia variante={VARIANTE_ESTADO[p.estado]}>{p.estado}</Insignia>
              </TablaTd>
              <TablaTd className="text-xs">{p.decidido_en ? new Date(p.decidido_en).toLocaleString() : '—'}</TablaTd>
              <TablaTd className="text-right">
                <div className="flex justify-end gap-1">
                  <Boton variante="secundario" tamano="sm" onClick={() => setVerDetalle(p)} title={t('ver')}>
                    <Eye size={14} />
                  </Boton>
                  {p.estado === 'PENDIENTE' && (
                    <>
                      <Boton variante="primario" tamano="sm" onClick={() => abrirDecidir(p, 'APROBADA')} title={t('aprobar')}>
                        <Check size={14} />
                      </Boton>
                      <Boton variante="secundario" tamano="sm" onClick={() => abrirDecidir(p, 'MODIFICADA')} title={t('modificar')}>
                        <Edit3 size={14} />
                      </Boton>
                      <Boton variante="peligro" tamano="sm" onClick={() => abrirDecidir(p, 'RECHAZADA')} title={t('rechazar')}>
                        <X size={14} />
                      </Boton>
                    </>
                  )}
                  <Boton variante="secundario" tamano="sm" onClick={() => setConfirmEliminar(p)} title={t('eliminar')}>
                    <Trash2 size={14} />
                  </Boton>
                </div>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      {/* Modal ver detalle */}
      {verDetalle && (
        <Modal
          abierto={true}
          alCerrar={() => setVerDetalle(null)}
          titulo={t('modalDetalleTitulo', { id: verDetalle.id_propuesta })}
        >
          <div className="space-y-3 text-sm p-4">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">{t('colCodigo')}:</span> <span className="font-mono">{verDetalle.codigo_propuesto || '—'}</span></div>
              <div><span className="text-gray-500">{t('colAmbito')}:</span> {verDetalle.ambito}</div>
              <div><span className="text-gray-500">{t('colNombre')}:</span> {verDetalle.nombre_propuesto}</div>
              <div><span className="text-gray-500">{t('colFrecuencia')}:</span> {verDetalle.frecuencia_observada}</div>
              <div><span className="text-gray-500">{t('colFuente')}:</span> {verDetalle.fuente}</div>
              <div><span className="text-gray-500">{t('colEstado')}:</span> {verDetalle.estado}</div>
              <div><span className="text-gray-500">Grupo:</span> {verDetalle.codigo_grupo || '— (global)'}</div>
              <div><span className="text-gray-500">{t('etiquetaHabilidadOrigen')}:</span> {verDetalle.codigo_habilidad_origen || '—'}</div>
            </div>
            {verDetalle.descripcion_propuesta && (
              <div>
                <div className="text-gray-500">{t('etiquetaDescripcion')}:</div>
                <div className="bg-gray-50 p-2 rounded whitespace-pre-wrap">{verDetalle.descripcion_propuesta}</div>
              </div>
            )}
            {verDetalle.evidencia && Object.keys(verDetalle.evidencia).length > 0 && (
              <div>
                <div className="text-gray-500">{t('etiquetaEvidencia')}:</div>
                <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(verDetalle.evidencia, null, 2)}
                </pre>
              </div>
            )}
            {verDetalle.decision_admin && (
              <div>
                <div className="text-gray-500">{t('etiquetaDecisionAdmin')}:</div>
                <div className="bg-gray-50 p-2 rounded">{verDetalle.decision_admin}</div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal decidir */}
      {decidir && (
        <Modal
          abierto={true}
          alCerrar={() => setDecidir(null)}
          titulo={t('modalDecidirTitulo', { id: decidir.id_propuesta })}
        >
          <div className="space-y-3 text-sm p-4">
            <div className="flex gap-2 items-center">
              <Insignia variante={
                decisionTipo === 'APROBADA' ? 'exito'
                : decisionTipo === 'RECHAZADA' ? 'error'
                : 'advertencia'
              }>
                {decisionTipo}
              </Insignia>
              <span className="text-gray-600">{decidir.ambito} · {decidir.nombre_propuesto}</span>
            </div>
            {(decisionTipo === 'APROBADA' || decisionTipo === 'MODIFICADA') && (
              <>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{t('etiquetaCodigo')}</label>
                  <Input value={overrideCodigo} onChange={(e) => setOverrideCodigo(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{t('etiquetaNombre')}</label>
                  <Input value={overrideNombre} onChange={(e) => setOverrideNombre(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{t('etiquetaDescripcion')}</label>
                  <textarea
                    className="w-full border rounded px-2 py-1 text-sm"
                    rows={3}
                    value={overrideDescripcion}
                    onChange={(e) => setOverrideDescripcion(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-gray-600 mb-1">{t('etiquetaDecisionAdmin')}</label>
              <textarea
                className="w-full border rounded px-2 py-1 text-sm"
                rows={2}
                value={decisionAdmin}
                onChange={(e) => setDecisionAdmin(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setDecidir(null)} disabled={decidiendo}>
                {tc('cancelar')}
              </Boton>
              <Boton
                variante={decisionTipo === 'RECHAZADA' ? 'peligro' : 'primario'}
                onClick={confirmarDecision}
                cargando={decidiendo}
              >
                {decisionTipo === 'APROBADA' ? t('aprobar')
                  : decisionTipo === 'RECHAZADA' ? t('rechazar')
                  : t('modificar')}
              </Boton>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmar eliminar */}
      <ModalConfirmar
        abierto={!!confirmEliminar}
        titulo={t('confirmarEliminarTitulo')}
        mensaje={confirmEliminar ? t('confirmarEliminarMsg', { id: confirmEliminar.id_propuesta, nombre: confirmEliminar.nombre_propuesto }) : ''}
        alConfirmar={ejecutarEliminar}
        alCerrar={() => setConfirmEliminar(null)}
        cargando={eliminando}
        variante="peligro"
      />
    </div>
  )
}
