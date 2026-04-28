'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { gruposApi, usuariosApi } from '@/lib/api'
import type { Grupo } from '@/lib/tipos'

export default function CambiarGrupoPage() {
  const t = useTranslations('cambiarGrupo')
  const tc = useTranslations('common')
  const router = useRouter()
  const { usuario } = useAuth()

  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  // Solo accesible para usuarios tipo SISTEMA
  useEffect(() => {
    if (usuario && usuario.tipo_acceso !== 'SISTEMA') {
      router.replace('/dashboard')
    }
  }, [usuario, router])

  useEffect(() => {
    gruposApi.listar()
      .then((data) => setGrupos(data))
      .catch(() => setError(t('errorCargarGrupos')))
      .finally(() => setCargando(false))
  }, [])

  const gruposFiltrados = grupos.filter((g) =>
    g.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    g.codigo_grupo.toLowerCase().includes(busqueda.toLowerCase())
  )

  const grupoActualNombre = grupos.find(
    (g) => g.codigo_grupo === usuario?.grupo_activo
  )?.nombre || usuario?.grupo_activo

  async function confirmar() {
    if (!seleccionado) return
    setGuardando(true)
    setError(null)
    try {
      await usuariosApi.cambiarGrupoPropio(seleccionado)
      router.push('/dashboard')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err?.response?.data?.detail || t('errorCambiarGrupo'))
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-texto-muted">{t('cargandoGrupos')}</div>
      </div>
    )
  }

  const grupoSeleccionadoNombre = grupos.find(
    (g) => g.codigo_grupo === seleccionado
  )?.nombre || seleccionado

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-surface rounded-xl border border-borde shadow-sm">
      <h1 className="page-heading mb-1">{t('titulo')}</h1>
      <p className="text-sm text-texto-muted mb-6">
        {t('grupoActual')}{' '}
        <span className="font-medium text-texto">{grupoActualNombre}</span>
      </p>

      {/* Selector buscable */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-texto mb-1">
          {t('seleccionarNuevoGrupo')}
        </label>

        {/* Campo de búsqueda */}
        <div className="relative">
          <input
            type="text"
            className="w-full border border-borde rounded-lg px-3 py-2 text-sm text-texto bg-fondo focus:outline-none focus:ring-2 focus:ring-primario/40"
            placeholder={t('buscarGrupoPlaceholder')}
            value={seleccionado
              ? (abierto ? busqueda : grupoSeleccionadoNombre || '')
              : busqueda}
            onFocus={() => {
              setAbierto(true)
              if (seleccionado) setBusqueda('')
            }}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            onChange={(e) => {
              setBusqueda(e.target.value)
              if (seleccionado) setSeleccionado(null)
              setAbierto(true)
            }}
          />

          {abierto && gruposFiltrados.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-surface border border-borde rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {gruposFiltrados.map((g) => (
                <li
                  key={g.codigo_grupo}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-primario-muy-claro ${
                    g.codigo_grupo === usuario?.grupo_activo
                      ? 'opacity-40 cursor-not-allowed'
                      : ''
                  } ${seleccionado === g.codigo_grupo ? 'bg-primario-muy-claro font-medium' : ''}`}
                  onMouseDown={() => {
                    if (g.codigo_grupo === usuario?.grupo_activo) return
                    setSeleccionado(g.codigo_grupo)
                    setBusqueda('')
                    setAbierto(false)
                  }}
                >
                  <span className="font-medium">{g.nombre}</span>
                  <span className="ml-2 text-xs text-texto-muted">{g.codigo_grupo}</span>
                  {g.codigo_grupo === usuario?.grupo_activo && (
                    <span className="ml-2 text-xs text-texto-muted">{t('marcaActual')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {abierto && gruposFiltrados.length === 0 && (
            <div className="absolute z-10 mt-1 w-full bg-surface border border-borde rounded-lg shadow-lg px-3 py-2 text-sm text-texto-muted">
              {tc('sinResultados')}
            </div>
          )}
        </div>
      </div>

      {/* Confirmación */}
      {seleccionado && seleccionado !== usuario?.grupo_activo && (
        <div className="mb-4 p-3 rounded-lg bg-primario-muy-claro border border-primario/20 text-sm text-texto">
          {t('cambiarA')} <span className="font-semibold">{grupoSeleccionadoNombre}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/30 text-sm text-error">
          {error}
        </div>
      )}

      <button
        onClick={confirmar}
        disabled={!seleccionado || seleccionado === usuario?.grupo_activo || guardando}
        className="w-full bg-primario text-primario-texto rounded-lg py-2 text-sm font-medium
          hover:bg-primario-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {guardando ? t('cambiando') : t('confirmarCambio')}
      </button>
    </div>
  )
}
