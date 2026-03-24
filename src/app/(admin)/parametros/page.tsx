'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, SlidersHorizontal, User } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaDescripcion, TarjetaContenido } from '@/components/ui/tarjeta'
import { useAuth } from '@/context/AuthContext'
import { parametrosApi } from '@/lib/api'
import type { ParametroGeneral, ParametroUsuario } from '@/lib/tipos'

export default function PaginaParametros() {
  const { esAdmin } = useAuth()
  const [parametrosGenerales, setParametrosGenerales] = useState<ParametroGeneral[]>([])
  const [parametrosUsuario, setParametrosUsuario] = useState<ParametroUsuario[]>([])
  const [valoresGenerales, setValoresGenerales] = useState<Record<string, string>>({})
  const [valoresUsuario, setValoresUsuario] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [guardandoGeneral, setGuardandoGeneral] = useState<string | null>(null)
  const [guardandoUsuario, setGuardandoUsuario] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState('')
  const [tabActiva, setTabActiva] = useState<'generales' | 'usuario'>('generales')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [gen, usu] = await Promise.allSettled([
        parametrosApi.listarGenerales(),
        parametrosApi.listarUsuario(),
      ])
      if (gen.status === 'fulfilled') {
        setParametrosGenerales(gen.value)
        const vals: Record<string, string> = {}
        gen.value.forEach((p) => { vals[p.codigo_parametro] = p.valor })
        setValoresGenerales(vals)
      }
      if (usu.status === 'fulfilled') {
        setParametrosUsuario(usu.value)
        const vals: Record<string, string> = {}
        usu.value.forEach((p) => { vals[p.codigo_parametro] = p.valor })
        setValoresUsuario(vals)
      }
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const mostrarExito = (msg: string) => {
    setMensajeExito(msg)
    setTimeout(() => setMensajeExito(''), 3000)
  }

  const guardarGeneral = async (codigo: string) => {
    setGuardandoGeneral(codigo)
    try {
      await parametrosApi.actualizarGeneral(codigo, valoresGenerales[codigo])
      mostrarExito(`Parámetro "${codigo}" actualizado`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoGeneral(null)
    }
  }

  const guardarUsuario = async (codigo: string) => {
    setGuardandoUsuario(codigo)
    try {
      await parametrosApi.actualizarUsuario(codigo, valoresUsuario[codigo])
      mostrarExito('Preferencia guardada')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoUsuario(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Parámetros</h2>
        <p className="text-sm text-texto-muted mt-1">Configuración del sistema y preferencias de usuario</p>
      </div>

      {mensajeExito && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-exito font-medium">{mensajeExito}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-fondo rounded-lg border border-borde w-fit">
        {esAdmin() && (
          <button
            onClick={() => setTabActiva('generales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tabActiva === 'generales'
                ? 'bg-surface text-primario shadow-sm border border-borde'
                : 'text-texto-muted hover:text-texto'
            }`}
          >
            <SlidersHorizontal size={14} />
            Generales
          </button>
        )}
        <button
          onClick={() => setTabActiva('usuario')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tabActiva === 'usuario'
              ? 'bg-surface text-primario shadow-sm border border-borde'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          <User size={14} />
          Mis preferencias
        </button>
      </div>

      {/* Parámetros generales (solo admin) */}
      {tabActiva === 'generales' && esAdmin() && (
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Parámetros generales del sistema</TarjetaTitulo>
            <TarjetaDescripcion>Afectan a todos los usuarios del sistema</TarjetaDescripcion>
          </TarjetaCabecera>
          <TarjetaContenido>
            {cargando ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-fondo rounded-lg animate-pulse" />
                ))}
              </div>
            ) : parametrosGenerales.length === 0 ? (
              <p className="text-sm text-texto-muted text-center py-4">No hay parámetros disponibles</p>
            ) : (
              <div className="flex flex-col gap-4">
                {parametrosGenerales.map((p) => (
                  <div key={p.codigo_parametro} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Input
                        etiqueta={p.nombre}
                        value={valoresGenerales[p.codigo_parametro] ?? ''}
                        onChange={(e) =>
                          setValoresGenerales({ ...valoresGenerales, [p.codigo_parametro]: e.target.value })
                        }
                        disabled={!p.editable}
                        placeholder={p.descripcion}
                      />
                      {p.descripcion && (
                        <p className="text-xs text-texto-muted mt-1">{p.descripcion}</p>
                      )}
                    </div>
                    {p.editable && (
                      <Boton
                        variante="primario"
                        tamano="sm"
                        onClick={() => guardarGeneral(p.codigo_parametro)}
                        cargando={guardandoGeneral === p.codigo_parametro}
                        className="shrink-0 mb-[1px]"
                      >
                        <Save size={14} />
                        Guardar
                      </Boton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TarjetaContenido>
        </Tarjeta>
      )}

      {/* Parámetros de usuario */}
      {tabActiva === 'usuario' && (
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Mis preferencias</TarjetaTitulo>
            <TarjetaDescripcion>Solo afectan a tu cuenta personal</TarjetaDescripcion>
          </TarjetaCabecera>
          <TarjetaContenido>
            {cargando ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-fondo rounded-lg animate-pulse" />
                ))}
              </div>
            ) : parametrosUsuario.length === 0 ? (
              <p className="text-sm text-texto-muted text-center py-4">No hay preferencias configuradas</p>
            ) : (
              <div className="flex flex-col gap-4">
                {parametrosUsuario.map((p) => (
                  <div key={p.codigo_parametro} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Input
                        etiqueta={p.codigo_parametro}
                        value={valoresUsuario[p.codigo_parametro] ?? ''}
                        onChange={(e) =>
                          setValoresUsuario({ ...valoresUsuario, [p.codigo_parametro]: e.target.value })
                        }
                      />
                    </div>
                    <Boton
                      variante="primario"
                      tamano="sm"
                      onClick={() => guardarUsuario(p.codigo_parametro)}
                      cargando={guardandoUsuario === p.codigo_parametro}
                      className="shrink-0 mb-[1px]"
                    >
                      <Save size={14} />
                      Guardar
                    </Boton>
                  </div>
                ))}
              </div>
            )}
          </TarjetaContenido>
        </Tarjeta>
      )}
    </div>
  )
}
