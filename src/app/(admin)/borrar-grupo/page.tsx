'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Layers, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { gruposApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Grupo } from '@/lib/tipos'
import { etiquetaTipo, varianteTipo } from '@/lib/tipo-elemento'

const PAGE_SIZE = 10

export default function PaginaBorrarGrupo() {
  const { esSuperAdmin } = useAuth()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null)
  const [textoBorrar, setTextoBorrar] = useState('')
  const [borrandoGrupo, setBorrandoGrupo] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const todos = await gruposApi.listar()
      setGrupos(todos.filter((g: Grupo) => g.tipo !== 'SISTEMA' && g.codigo_grupo !== 'ADMIN'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Resetear página al cambiar búsqueda
  useEffect(() => { setPagina(1) }, [busqueda])

  const gruposFiltrados = grupos.filter((g) =>
    busqueda.length === 0 ||
    g.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    g.codigo_grupo.toLowerCase().includes(busqueda.toLowerCase())
  )

  const totalPaginas = Math.max(1, Math.ceil(gruposFiltrados.length / PAGE_SIZE))
  const gruposPagina = gruposFiltrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  const borrarGrupoCompleto = async () => {
    if (!grupoSeleccionado) return
    setBorrandoGrupo(true)
    setError('')
    try {
      await gruposApi.borrarCompleto(grupoSeleccionado.codigo_grupo)
      setExito(`El grupo "${grupoSeleccionado.nombre}" fue eliminado correctamente.`)
      setGrupoSeleccionado(null)
      setTextoBorrar('')
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al borrar grupo')
    } finally {
      setBorrandoGrupo(false)
    }
  }

  if (!esSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-48 text-texto-muted text-sm">
        No tienes permisos para acceder a esta sección.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="page-heading">Borrar Grupo Completo</h2>
        <p className="text-sm text-texto-muted mt-1">
          Elimina permanentemente un grupo junto con todas sus entidades, usuarios, documentos, roles y parámetros.
          Esta acción es irreversible.
        </p>
      </div>

      {exito && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-green-800">{exito}</p>
        </div>
      )}

      {/* Advertencia general */}
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
        <div className="text-sm text-red-800">
          <p className="font-semibold">Zona de peligro</p>
          <p className="mt-1">
            Al borrar un grupo se eliminan en cascada todas sus entidades, documentos vectorizados,
            parámetros de configuración, roles y usuarios asociados. Los grupos de tipo SISTEMA
            y el grupo ADMIN no pueden ser eliminados.
          </p>
        </div>
      </div>

      {/* Filtro + lista */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-texto-muted uppercase tracking-wider">
            Selecciona el grupo a eliminar
          </h3>
          {!cargando && (
            <span className="text-xs text-texto-muted">
              {gruposFiltrados.length} grupo{gruposFiltrados.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-borde bg-surface pl-9 pr-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
          />
        </div>

        {/* Lista */}
        {cargando ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-surface border border-borde rounded-xl animate-pulse" />
            ))}
          </div>
        ) : gruposFiltrados.length === 0 ? (
          <div className="text-sm text-texto-muted text-center py-8 border border-borde rounded-xl bg-surface">
            {busqueda ? 'No se encontraron grupos con ese criterio.' : 'No hay grupos disponibles para eliminar.'}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {gruposPagina.map((g) => (
                <button
                  key={g.codigo_grupo}
                  onClick={() => { setGrupoSeleccionado(g); setTextoBorrar(''); setError(''); setExito('') }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors border-borde bg-surface hover:border-red-300 hover:bg-red-50"
                >
                  <div className="p-2 rounded-lg bg-fondo text-texto-muted">
                    <Layers size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-texto truncate">{g.nombre}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-texto-muted">{g.codigo_grupo}</p>
                      <Insignia variante={varianteTipo(g.tipo)}>{etiquetaTipo(g.tipo)}</Insignia>
                    </div>
                  </div>
                  <Trash2 size={16} className="text-red-400 shrink-0" />
                </button>
              ))}
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-texto-muted">
                  Página {pagina} de {totalPaginas}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="p-1.5 rounded-lg border border-borde bg-surface hover:bg-fondo disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter((n) => n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1)
                    .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...')
                      acc.push(n)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`e${idx}`} className="px-1 text-xs text-texto-muted">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPagina(item as number)}
                          className={`min-w-[28px] h-7 rounded-lg border text-xs font-medium transition-colors ${
                            pagina === item
                              ? 'border-primario bg-primario text-primario-texto'
                              : 'border-borde bg-surface hover:bg-fondo text-texto'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    className="p-1.5 rounded-lg border border-borde bg-surface hover:bg-fondo disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal confirmación */}
      <Modal
        abierto={!!grupoSeleccionado}
        alCerrar={() => { setGrupoSeleccionado(null); setTextoBorrar(''); setError('') }}
        titulo="Borrar grupo completo"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">Esta acción es irreversible.</p>
              <p className="mt-1">
                Se eliminará permanentemente el grupo <strong>{grupoSeleccionado?.nombre}</strong> junto
                con todas sus entidades, usuarios, documentos, roles, parámetros y registros de auditoría.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1">
              Escriba exactamente:{' '}
              <span className="font-mono text-red-600">Borrar grupo {grupoSeleccionado?.nombre}</span>
            </label>
            <Input
              value={textoBorrar}
              onChange={(e) => setTextoBorrar(e.target.value)}
              placeholder={`Borrar grupo ${grupoSeleccionado?.nombre ?? ''}`}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Boton
              variante="contorno"
              onClick={() => { setGrupoSeleccionado(null); setTextoBorrar(''); setError('') }}
            >
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              onClick={borrarGrupoCompleto}
              disabled={textoBorrar !== `Borrar grupo ${grupoSeleccionado?.nombre}` || borrandoGrupo}
              cargando={borrandoGrupo}
            >
              Borrar definitivamente
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
