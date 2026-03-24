'use client'

import { useEffect, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { auditoriaApi } from '@/lib/api'
import type { RegistroAuditoria } from '@/lib/tipos'

export default function PaginaAuditoria() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const cargar = async () => {
    setCargando(true)
    try {
      const r = await auditoriaApi.listar({ por_pagina: 100 })
      setRegistros(r)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtrados = registros.filter((r) =>
    r.tabla_afectada.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.codigo_usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.operacion.toLowerCase().includes(busqueda.toLowerCase())
  )

  const varianteOperacion = (op: string) => {
    if (op === 'INSERT') return 'exito'
    if (op === 'DELETE') return 'error'
    if (op === 'UPDATE') return 'primario'
    return 'neutro'
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">Auditoría</h2>
          <p className="text-sm text-texto-muted mt-1">{registros.length} registros totales</p>
        </div>
        <Boton variante="contorno" onClick={cargar} cargando={cargando}>
          <RefreshCw size={15} />
          Actualizar
        </Boton>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Filtrar por tabla, usuario u operación..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          icono={<Search size={15} />}
        />
      </div>

      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>Fecha y hora</TablaTh>
            <TablaTh>Usuario</TablaTh>
            <TablaTh>Tabla</TablaTh>
            <TablaTh>Operación</TablaTh>
            <TablaTh>Registro ID</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                Cargando registros...
              </TablaTd>
            </TablaFila>
          ) : filtrados.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={5 as never}>
                No se encontraron registros
              </TablaTd>
            </TablaFila>
          ) : (
            filtrados.map((r) => (
              <TablaFila key={r.id}>
                <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                  {new Date(r.fecha_hora).toLocaleString('es-CL', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  })}
                </TablaTd>
                <TablaTd className="text-xs">{r.codigo_usuario}</TablaTd>
                <TablaTd>
                  <code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{r.tabla_afectada}</code>
                </TablaTd>
                <TablaTd>
                  <Insignia variante={varianteOperacion(r.operacion)}>{r.operacion}</Insignia>
                </TablaTd>
                <TablaTd className="text-xs text-texto-muted font-mono">{r.registro_id}</TablaTd>
              </TablaFila>
            ))
          )}
        </TablaCuerpo>
      </Tabla>
    </div>
  )
}
