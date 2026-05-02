'use client'

import { useTranslations } from 'next-intl'
import { Search, RefreshCw, Download } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { auditoriaApi } from '@/lib/api'
import type { RegistroAuditoria } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { BotonChat } from '@/components/ui/boton-chat'
import { useListadoSimple } from '@/hooks/useListadoSimple'

export default function PaginaAuditoriaUsuarios() {
  const t = useTranslations('auditoriaUsuarios')
  const tc = useTranslations('common')

  const { items: registros, filtrados, cargando, busqueda, setBusqueda, recargar } =
    useListadoSimple<RegistroAuditoria>({
      cargarFn: () => auditoriaApi.listar({ tipo: 'usuarios', por_pagina: 100 }),
      camposBusqueda: r => [r.codigo_usuario, r.operacion, r.codigo_registro],
    })

  const varianteOperacion = (op: string) => {
    if (op === 'INSERT') return 'exito'
    if (op === 'DELETE') return 'error'
    if (op === 'UPDATE') return 'primario'
    return 'neutro'
  }

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-heading">{t('titulo')}</h2>
          <p className="text-sm text-texto-muted mt-1">{registros.length} registros totales</p>
        </div>
        <div className="flex gap-2">
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={() => exportarExcel(filtrados as unknown as Record<string, unknown>[], [
              { titulo: 'Fecha y hora', campo: 'fecha_hora', formato: (v) => v ? new Date(v as string).toLocaleString('es-CL') : '' },
              { titulo: 'Usuario que realizó el cambio', campo: 'codigo_usuario' },
              { titulo: 'Operación', campo: 'operacion' },
              { titulo: 'Usuario afectado', campo: 'codigo_registro' },
            ], 'auditoria-usuarios')}
            disabled={filtrados.length === 0}
          >
            <Download size={15} />
            {tc('exportarExcel')}
          </Boton>
          <Boton variante="contorno" onClick={recargar} cargando={cargando}>
            <RefreshCw size={15} />
            {tc('actualizar')}
          </Boton>
        </div>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder={t('filtrarPlaceholder')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          icono={<Search size={15} />}
        />
      </div>

      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>{t('colFecha')}</TablaTh>
            <TablaTh>{t('colUsuario')}</TablaTh>
            <TablaTh>{t('colOperacion')}</TablaTh>
            <TablaTh>{t('colAfectado')}</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>
                Cargando registros...
              </TablaTd>
            </TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={4 as never}>
                No se encontraron registros
              </TablaTd>
            </TablaFila>
          ) : (
            filtrados.map((r) => (
              <TablaFila key={r.id_auditoria}>
                <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                  {new Date(r.fecha_hora).toLocaleString('es-CL', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  })}
                </TablaTd>
                <TablaTd className="text-xs">{r.codigo_usuario}</TablaTd>
                <TablaTd>
                  <Insignia variante={varianteOperacion(r.operacion)}>{r.operacion}</Insignia>
                </TablaTd>
                <TablaTd className="text-xs text-texto-muted font-mono">{r.codigo_registro}</TablaTd>
              </TablaFila>
            ))
          )}
        </TablaCuerpo>
      </Tabla>
    </div>
  )
}
