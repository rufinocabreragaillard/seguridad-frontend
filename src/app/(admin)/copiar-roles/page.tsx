'use client'

import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Tarjeta, TarjetaCabecera, TarjetaTitulo, TarjetaContenido } from '@/components/ui/tarjeta'
import { rolesApi, gruposApi } from '@/lib/api'
import type { Rol, Grupo } from '@/lib/tipos'

export default function PaginaCopiarRoles() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoOrigen, setGrupoOrigen] = useState('')
  const [rolesOrigen, setRolesOrigen] = useState<Rol[]>([])
  const [rolCopiar, setRolCopiar] = useState('')  // id_rol como string
  const [grupoDestino, setGrupoDestino] = useState('')
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    gruposApi.listar().then(setGrupos).catch(() => setGrupos([]))
  }, [])

  const cargarRoles = async (codigoGrupo: string) => {
    setGrupoOrigen(codigoGrupo)
    setRolCopiar('')
    setRolesOrigen([])
    setMensaje(null)
    if (!codigoGrupo) return
    setCargandoRoles(true)
    try {
      // Solo roles per-grupo (no globales) — los globales no se copian
      setRolesOrigen(await rolesApi.listarPorGrupo(codigoGrupo, false))
    } catch {
      setRolesOrigen([])
    } finally {
      setCargandoRoles(false)
    }
  }

  const ejecutarCopia = async () => {
    if (!grupoOrigen || !rolCopiar || !grupoDestino) return
    setCopiando(true)
    setMensaje(null)
    try {
      await rolesApi.copiar({
        id_rol_origen: Number(rolCopiar),
        codigo_grupo_destino: grupoDestino,
      })
      const rolNombre = rolesOrigen.find(r => String(r.id_rol) === rolCopiar)?.nombre || rolCopiar
      setMensaje({ tipo: 'exito', texto: `Rol "${rolNombre}" copiado exitosamente al grupo "${grupoDestino}".` })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al copiar rol' })
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Copiar Roles entre Grupos</h2>
        <p className="text-sm text-texto-muted mt-1">Copia un rol y sus funciones asignadas de un grupo a otro</p>
      </div>

      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>Seleccionar origen y destino</TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-texto">Grupo de origen *</label>
              <select
                value={grupoOrigen}
                onChange={(e) => cargarRoles(e.target.value)}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
              >
                <option value="">Seleccionar grupo...</option>
                {grupos.map((g) => (
                  <option key={g.codigo_grupo} value={g.codigo_grupo}>{g.nombre} ({g.codigo_grupo})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-texto">Rol a copiar *</label>
              <select
                value={rolCopiar}
                onChange={(e) => { setRolCopiar(e.target.value); setMensaje(null) }}
                disabled={!grupoOrigen || cargandoRoles}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50"
              >
                <option value="">{cargandoRoles ? 'Cargando...' : 'Seleccionar rol...'}</option>
                {rolesOrigen.map((r) => (
                  <option key={r.id_rol} value={String(r.id_rol)}>{r.nombre} ({r.codigo_rol})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-texto">Grupo de destino *</label>
              <select
                value={grupoDestino}
                onChange={(e) => { setGrupoDestino(e.target.value); setMensaje(null) }}
                disabled={!grupoOrigen}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50"
              >
                <option value="">Seleccionar grupo...</option>
                {grupos.filter((g) => g.codigo_grupo !== grupoOrigen).map((g) => (
                  <option key={g.codigo_grupo} value={g.codigo_grupo}>{g.nombre} ({g.codigo_grupo})</option>
                ))}
              </select>
            </div>

            {mensaje && (
              <div className={`border rounded-lg px-4 py-3 ${mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-sm ${mensaje.tipo === 'exito' ? 'text-green-700' : 'text-error'}`}>{mensaje.texto}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Boton
                variante="primario"
                onClick={ejecutarCopia}
                cargando={copiando}
                disabled={!grupoOrigen || !rolCopiar || !grupoDestino}
              >
                <Copy size={16} />
                Copiar rol
              </Boton>
            </div>
          </div>
        </TarjetaContenido>
      </Tarjeta>
    </div>
  )
}
