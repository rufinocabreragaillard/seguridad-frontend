'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Copy, ExternalLink } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { clasificarApi } from '@/lib/api'
import type { PromptVivoClasificar, FuentePromptClasificar } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'

export default function PaginaClassifyPrompt() {
  const t = useTranslations('classifyPrompt')
  const tc = useTranslations('common')
  const { grupoActivo } = useAuth()
  const toast = useToast()

  const [data, setData] = useState<PromptVivoClasificar | null>(null)
  const [cargando, setCargando] = useState(true)
  const [codigoDocumentoInput, setCodigoDocumentoInput] = useState<string>('')
  const [verConMarcas, setVerConMarcas] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const codDoc = codigoDocumentoInput.trim() ? parseInt(codigoDocumentoInput, 10) : undefined
      const res = await clasificarApi.promptVivo(codDoc && !isNaN(codDoc) ? codDoc : undefined)
      setData(res)
    } catch (e) {
      toast.error(t('errorCargar'), e instanceof Error ? e.message : undefined)
    } finally {
      setCargando(false)
    }
  }, [codigoDocumentoInput, toast, t])

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    <div className="flex flex-col gap-4 p-6">
      <PageHeader titulo={t('titulo')} descripcion={t('descripcion')} />

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-texto-muted">{t('grupoActivo')}</label>
          <div className="text-sm font-medium text-texto">{grupoActivo || '—'}</div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-texto-muted">{t('codigoDocumento')}</label>
          <Input
            value={codigoDocumentoInput}
            onChange={(e) => setCodigoDocumentoInput(e.target.value)}
            placeholder={t('placeholderDocumento')}
            className="w-40"
          />
        </div>
        <Boton variante="primaria" onClick={cargar} disabled={cargando}>
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          {tc('reintentar')}
        </Boton>
        <label className="flex items-center gap-2 text-sm ml-auto">
          <input
            type="checkbox"
            checked={verConMarcas}
            onChange={(e) => setVerConMarcas(e.target.checked)}
          />
          {t('verConMarcas')}
        </label>
      </div>

      {data && (
        <div className="flex gap-4 text-xs text-texto-muted bg-fondo px-3 py-2 rounded-lg">
          <span>{t('longitudTotal')}: <b className="text-texto">{data.longitud_total_limpio.toLocaleString()}</b> chars</span>
          <span>{t('fuentes')}: <b className="text-texto">{data.fuentes.filter(f => f.longitud > 0).length}</b> activas / {data.fuentes.length} totales</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar — lista de fuentes */}
        <aside className="border border-borde rounded-lg p-3 max-h-[80vh] overflow-y-auto">
          <div className="text-sm font-semibold text-texto mb-2">{t('fuentes')}</div>
          {data?.fuentes.filter((f) => f.longitud > 0).map((f, i) => {
            const href = linkFuente(f)
            return (
              <div key={i} className="text-xs py-1 border-b border-borde/40 last:border-0 flex items-center gap-1">
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
                  <a href={href} target="_blank" rel="noopener noreferrer"
                     className="text-primario hover:underline shrink-0" title={t('editar')}>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )
          })}
        </aside>

        {/* Cuerpo — system + user */}
        <main className="flex flex-col gap-4">
          <section className="border border-borde rounded-lg">
            <header className="flex items-center justify-between px-3 py-2 border-b border-borde bg-fondo">
              <h3 className="text-sm font-semibold text-texto">{t('systemPrompt')}</h3>
              <Boton variante="contorno" onClick={() => data && copiar(data.system_prompt_limpio)}>
                <Copy size={12} /> {t('copiarSinMarcas')}
              </Boton>
            </header>
            <pre className="text-xs text-texto whitespace-pre-wrap p-3 max-h-[40vh] overflow-y-auto font-mono">
              {data ? (verConMarcas ? data.system_prompt_marcado : data.system_prompt_limpio) || `(${t('vacio')})` : ''}
            </pre>
          </section>

          <section className="border border-borde rounded-lg">
            <header className="flex items-center justify-between px-3 py-2 border-b border-borde bg-fondo">
              <h3 className="text-sm font-semibold text-texto">{t('userPrompt')}</h3>
              <Boton variante="contorno" onClick={() => data && copiar(data.user_prompt_limpio)}>
                <Copy size={12} /> {t('copiarSinMarcas')}
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
