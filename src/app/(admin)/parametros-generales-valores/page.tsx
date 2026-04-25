'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, Download } from 'lucide-react'
import { SortableDndContext, SortableRow } from '@/components/ui/sortable'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaTh, TablaTd } from '@/components/ui/tabla'
import { Paginador } from '@/components/ui/paginador'
import { exportarExcel } from '@/lib/exportar-excel'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BotonChat } from '@/components/ui/boton-chat'
import { parametrosApi } from '@/lib/api'
import { usePaginacion } from '@/hooks/usePaginacion'
import type { ParametroGeneral } from '@/lib/tipos'

const inputCls = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'

// Fetcher estable fuera del componente para evitar re-renders infinitos en usePaginacion
const fetcherParametros = (params: { page: number; limit: number; q: string; categoria: string }) =>
  parametrosApi.listarGeneralesPaginado({
    page: params.page,
    limit: params.limit,
    q: params.q || undefined,
    categoria: params.categoria || undefined,
  })

type FormData = {
  categoria_parametro: string
  tipo_parametro: string
  valor_parametro: string
  descripcion: string
}

const FORM_VACIO: FormData = {
  categoria_parametro: '',
  tipo_parametro: '',
  valor_parametro: '',
  descripcion: '',
}

export default function PaginaValoresParametrosGenerales() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<ParametroGeneral | null>(null)
  const [form, setForm] = useState<FormData>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [aEliminar, setAEliminar] = useState<ParametroGeneral | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [itemsLocales, setItemsLocales] = useState<ParametroGeneral[]>([])

  const { items, total, page, limit, cargando, setPage, setLimit, refetch } = usePaginacion<
    ParametroGeneral,
    { q: string; categoria: string }
  >({
    fetcher: fetcherParametros,
    filtros: { q: busqueda, categoria: filtroCategoria },
    limitInicial: 15,
  })

  // Carga las categorías disponibles (para el filtro) usando el endpoint existente sin paginar
  const cargarCategorias = useCallback(async () => {
    try {
      const todos = await parametrosApi.listarGenerales()
      const cats = Array.from(new Set(todos.map((p) => p.categoria_parametro))).sort()
      setCategorias(cats)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => { cargarCategorias() }, [cargarCategorias])

  // Sincronizar items locales cuando llegan del servidor
  useEffect(() => { setItemsLocales(items) }, [items])

  // Reordenar por drag & drop (solo dentro de la página actual)
  const reordenar = async (nuevos: ParametroGeneral[]) => {
    setItemsLocales(nuevos)
    const offset = (page - 1) * limit
    try {
      await parametrosApi.reordenarGenerales(
        nuevos.map((p, i) => ({
          categoria_parametro: p.categoria_parametro,
          tipo_parametro: p.tipo_parametro,
          orden: offset + i + 1,
        }))
      )
    } catch {
      setItemsLocales(items) // rollback
    }
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...FORM_VACIO, categoria_parametro: filtroCategoria })
    setError('')
    setModal(true)
  }

  const abrirEditar = (p: ParametroGeneral) => {
    setEditando(p)
    setForm({
      categoria_parametro: p.categoria_parametro,
      tipo_parametro: p.tipo_parametro,
      valor_parametro: p.valor_parametro || '',
      descripcion: p.descripcion || '',
    })
    setError('')
    setModal(true)
  }

  const guardar = async (cerrar: boolean) => {
    if (!form.categoria_parametro.trim() || !form.tipo_parametro.trim()) {
      setError('Categoría y tipo son obligatorios')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await parametrosApi.upsertGenerales({
        categoria_parametro: form.categoria_parametro.toUpperCase().trim(),
        tipo_parametro: form.tipo_parametro.toUpperCase().trim(),
        valor_parametro: form.valor_parametro,
        descripcion: form.descripcion || undefined,
      })
      if (cerrar) {
        setModal(false)
      } else if (!editando) {
        setEditando({
          categoria_parametro: form.categoria_parametro.toUpperCase().trim(),
          tipo_parametro: form.tipo_parametro.toUpperCase().trim(),
          valor_parametro: form.valor_parametro,
          descripcion: form.descripcion || undefined,
        })
      }
      refetch()
      cargarCategorias()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminar = async () => {
    if (!aEliminar) return
    setEliminando(true)
    try {
      await parametrosApi.eliminarGeneral(aEliminar.categoria_parametro, aEliminar.tipo_parametro)
      setAEliminar(null)
      refetch()
      cargarCategorias()
    } catch (e) {
      console.error(e)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-6">
      <BotonChat />
      <div>
        <h2 className="page-heading">Valores de Parámetros Generales</h2>
        <p className="text-sm text-texto-muted mt-1">
          Administra los valores de los parámetros globales que controlan el comportamiento del sistema
        </p>
      </div>

      {/* Filtros y acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder="Buscar parámetro..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="flex gap-2 ml-auto">
          <Boton
            variante="contorno"
            tamano="sm"
            disabled={items.length === 0}
            onClick={() =>
              exportarExcel(
                items as unknown as Record<string, unknown>[],
                [
                  { titulo: 'Categoría', campo: 'categoria_parametro' },
                  { titulo: 'Tipo', campo: 'tipo_parametro' },
                  { titulo: 'Valor', campo: 'valor_parametro' },
                  { titulo: 'Descripción', campo: 'descripcion' },
                ],
                'valores-parametros-generales'
              )
            }
          >
            <Download size={15} /> Excel
          </Boton>
          <Boton variante="primario" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo valor
          </Boton>
        </div>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
          ))}
        </div>
      ) : (
        <SortableDndContext
          items={itemsLocales as unknown as Record<string, unknown>[]}
          getId={(p) => `${(p as unknown as ParametroGeneral).categoria_parametro}/${(p as unknown as ParametroGeneral).tipo_parametro}`}
          onReorder={(n) => reordenar(n as unknown as ParametroGeneral[])}
        >
          <Tabla>
            <TablaCabecera>
              <tr>
                <TablaTh className="w-8" />
                <TablaTh>Categoría</TablaTh>
                <TablaTh>Tipo</TablaTh>
                <TablaTh>Valor</TablaTh>
                <TablaTh className="text-right">Acciones</TablaTh>
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {itemsLocales.length === 0 ? (
                <tr>
                  <TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>
                    {busqueda || filtroCategoria ? 'No se encontraron parámetros' : 'No hay parámetros registrados'}
                  </TablaTd>
                </tr>
              ) : (
                itemsLocales.map((p) => (
                  <SortableRow
                    key={`${p.categoria_parametro}/${p.tipo_parametro}`}
                    id={`${p.categoria_parametro}/${p.tipo_parametro}`}
                    onDoubleClick={() => abrirEditar(p)}
                  >
                    <TablaTd>
                      <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                        {p.categoria_parametro}
                      </code>
                    </TablaTd>
                    <TablaTd>
                      <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                        {p.tipo_parametro}
                      </code>
                    </TablaTd>
                    <TablaTd className="max-w-[280px]">
                      <span className="block truncate text-sm font-mono" title={p.valor_parametro}>
                        {p.valor_parametro || <span className="text-texto-light italic">sin valor</span>}
                      </span>
                    </TablaTd>
                    <TablaTd>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEditar(p)}
                          className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setAEliminar(p)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TablaTd>
                  </SortableRow>
                ))
              )}
            </TablaCuerpo>
          </Tabla>
        </SortableDndContext>
      )}

      {/* Paginador */}
      {!cargando && (
        <Paginador
          page={page}
          limit={limit}
          total={total}
          onChangePage={setPage}
          onChangeLimit={setLimit}
          cargando={cargando}
          opcionesLimit={[15, 25, 50, 100]}
        />
      )}

      {/* ── Modal crear/editar ── */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={editando
          ? `Editar: ${editando.categoria_parametro} / ${editando.tipo_parametro}`
          : 'Nuevo valor de parámetro general'}
        className="w-[620px] max-w-[95vw]"
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Categoría *</label>
              <input
                className={inputCls}
                placeholder="ej: SISTEMA"
                value={form.categoria_parametro}
                disabled={!!editando}
                onChange={(e) => setForm({ ...form, categoria_parametro: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Tipo *</label>
              <input
                className={inputCls}
                placeholder="ej: TIMEOUT"
                value={form.tipo_parametro}
                disabled={!!editando}
                onChange={(e) => setForm({ ...form, tipo_parametro: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1">Valor</label>
            <input
              className={inputCls}
              placeholder="Valor del parámetro"
              value={form.valor_parametro}
              onChange={(e) => setForm({ ...form, valor_parametro: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1">Descripción</label>
            <textarea
              className={inputCls}
              rows={2}
              placeholder="Descripción del parámetro"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <PieBotonesModal
            editando={!!editando}
            onGuardar={() => guardar(false)}
            onGuardarYSalir={() => guardar(true)}
            onCerrar={() => setModal(false)}
            cargando={guardando}
          />
        </div>
      </Modal>

      {/* ── Modal eliminar ── */}
      <ModalConfirmar
        abierto={!!aEliminar}
        alCerrar={() => setAEliminar(null)}
        alConfirmar={confirmarEliminar}
        titulo="Eliminar parámetro"
        mensaje={aEliminar
          ? `¿Eliminar el parámetro "${aEliminar.categoria_parametro} / ${aEliminar.tipo_parametro}"? Esta acción puede afectar el comportamiento del sistema.`
          : ''}
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </div>
  )
}
