'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Copy, ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { SelectorBuscable, type OpcionBuscable } from '@/components/ui/selector-buscable'
import { BotonChat } from '@/components/ui/boton-chat'
import { useToast } from '@/context/ToastContext'
import { clasificarApi, documentosApi } from '@/lib/api'
import type { PromptVivoClasificar, FuentePromptClasificar } from '@/lib/api'
import type { Documento } from '@/lib/tipos'
import { PageHeader } from '@/components/layout/PageHeader'

export default function PaginaClassifyPrompt() {
  const t = useTranslations('classifyPrompt')
  const tc = useTranslations('common')
  const toast = useToast()

  const [data, setData] = useState<PromptVivoClasificar | null>(null)
  const [cargando, setCargando] = useState(true)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [codigoDocumento, setCodigoDocumento] = useState<string>('')
  const [fuentesColapsado, setFuentesColapsado] = useState(false)
  const verConMarcas = !fuentesColapsado

  const cargar = useCallback(async (codDoc?: number) => {
    setCargando(true)
    try {
      const res = await clasificarApi.promptVivo(codDoc)
      setData(res)
    } catch (e) {
      toast.error(t('errorCargar'), e instanceof Error ? e.message : undefined)
    } finally {
      setCargando(false)
    }
  }, [toast, t])

  useEffect(() => {
    cargar()
    documentosApi.listar({ limit: 500 })
      .then((docs) => setDocumentos(docs))
      .catch(() => setDocumentos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const opcionesDocumento: OpcionBuscable[] = useMemo(
    () =>
      documentos.map((d) => ({
        valor: String(d.codigo_documento),
        etiqueta: d.nombre_documento,
        hint: `#${d.codigo_documento}${d.codigo_estado_doc ? ` · ${d.codigo_estado_doc}` : ''}`,
      })),
    [documentos],
  )

  const onSeleccionarDoc = (valor: string) => {
    setCodigoDocumento(valor)
    const cod = valor ? parseInt(valor, 10) : undefined
    cargar(cod && !isNaN(cod) ? cod : undefined)
  }

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success(t('copiado'))
    } catch {
      toast.error(t('errorCopiar'))
    }
  }

  const linkFuente = (f: FuentePromptClasificar): string | null => {
    if (f.tabla === 'habilidades') return `/abilities?codigo=${f.codigo}`
    if (f.tabla === 'categorias_caract_docs') return `/document-categories?codigo=${f.codigo}`
    if (f.tabla === 'tipos_caract_docs') {
      const [cat, tipo] = f.codigo.split('.')
      return `/document-categories?codigo=${cat}&tipo=${tipo}`
    }
    return null
  }

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat />

      <PageHeader />

      {/* Barra de filtros y acciones */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <SelectorBuscable
            etiqueta={t('codigoDocumento')}
            valor={codigoDocumento}
            opciones={opcionesDocumento}
            onSeleccionar={onSeleccionarDoc}
            placeholder={t('placeholderDocumento')}
          />
        </div>

        <div className="flex gap-2 ml-auto">
          <Boton
            variante="accion-sincronizar"
            tamano="sm"
            onClick={() => {
              const cod = codigoDocumento ? parseInt(codigoDocumento, 10) : undefined
              cargar(cod && !isNaN(cod) ? cod : undefined)
            }}
            disabled={cargando}
          >
            <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
            {tc('reintentar')}
          </Boton>
        </div>
      </div>

      {/* Resumen */}
      {data && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-texto-muted bg-fondo px-3 py-2 rounded-lg border border-borde">
          <span>{t('longitudTotal')}: <b className="text-texto">{data.longitud_total_limpio.toLocaleString()}</b> chars</span>
          <span>{t('fuentes')}: <b className="text-texto">{data.fuentes.filter(f => f.longitud > 0).length}</b> {t('activas')} / {data.fuentes.length} {t('totales')}</span>
        </div>
      )}

      <div className={`grid grid-cols-1 ${fuentesColapsado ? 'lg:grid-cols-[44px_1fr]' : 'lg:grid-cols-[280px_1fr]'} gap-4 transition-all`}>
        {/* Sidebar — lista de fuentes (colapsable como el sidebar global) */}
        <aside className="border border-borde rounded-lg bg-surface max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-2 py-2 border-b border-borde">
            {!fuentesColapsado && <div className="section-heading">{t('fuentes')}</div>}
            <button
              type="button"
              onClick={() => setFuentesColapsado((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors ml-auto"
              title={fuentesColapsado ? t('mostrarFuentes') : t('ocultarFuentes')}
              aria-label={fuentesColapsado ? t('mostrarFuentes') : t('ocultarFuentes')}
            >
              {fuentesColapsado ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
          {!fuentesColapsado && (
            <div className="p-3 overflow-y-auto">
              {data?.fuentes.filter((f) => f.longitud > 0).map((f, i) => {
                const href = linkFuente(f)
                return (
                  <div key={i} className="text-xs py-1.5 border-b border-borde/40 last:border-0 flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-texto truncate" title={`${f.tabla}.${f.codigo}.${f.campo}`}>
                        {f.tabla}
                      </div>
                      <div className="font-mono text-texto-muted truncate" title={f.codigo}>
                        {f.codigo}.{f.campo}
                      </div>
                      <div className="text-texto-muted">{f.longitud} chars</div>
                    </div>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors shrink-0"
                        title={t('editar')}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </aside>

        {/* Cuerpo — system + user */}
        <main className="flex flex-col gap-4">
          <section className="border border-borde rounded-lg bg-surface">
            <header className="flex items-center justify-between px-3 py-2 border-b border-borde bg-fondo rounded-t-lg">
              <h3 className="section-heading">{t('systemPrompt')}</h3>
              <Boton variante="contorno" tamano="sm" onClick={() => data && copiar(data.system_prompt_limpio)}>
                <Copy size={14} /> {t('copiarSinMarcas')}
              </Boton>
            </header>
            <pre className="text-xs text-texto whitespace-pre-wrap p-3 max-h-[40vh] overflow-y-auto font-mono">
              {data ? (verConMarcas ? data.system_prompt_marcado : data.system_prompt_limpio) || `(${t('vacio')})` : ''}
            </pre>
          </section>

          <section className="border border-borde rounded-lg bg-surface">
            <header className="flex items-center justify-between px-3 py-2 border-b border-borde bg-fondo rounded-t-lg">
              <h3 className="section-heading">{t('userPrompt')}</h3>
              <Boton variante="contorno" tamano="sm" onClick={() => data && copiar(data.user_prompt_limpio)}>
                <Copy size={14} /> {t('copiarSinMarcas')}
              </Boton>
            </header>
            <pre className="text-xs text-texto whitespace-pre-wrap p-3 max-h-[60vh] overflow-y-auto font-mono">
              {data ? (verConMarcas ? data.user_prompt_marcado : data.user_prompt_limpio) : ''}
            </pre>
          </section>
        </main>
      </div>
    </div>
  )
}
