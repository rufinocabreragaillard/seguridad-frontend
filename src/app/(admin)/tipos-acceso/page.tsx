'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { BarraHerramientas } from '@/components/ui/barra-herramientas'
import { tiposAccesoApi } from '@/lib/api'
import type { TipoAcceso } from '@/lib/tipos'
import { useCrudPage } from '@/hooks/useCrudPage'

const selectClass =
  'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-50'

type FormTipoAcceso = {
  codigo_tipo_acceso: string
  nombre_tipo_acceso: string
  tipo_acceso_superior: string
}

export default function PaginaTiposAcceso() {
  const crud = useCrudPage<TipoAcceso, FormTipoAcceso>({
    cargarFn: () => tiposAccesoApi.listar(),
    crearFn: (f) =>
      tiposAccesoApi.crear({
        codigo_tipo_acceso: f.codigo_tipo_acceso.trim() || undefined,
        nombre_tipo_acceso: f.nombre_tipo_acceso.trim(),
        tipo_acceso_superior: f.tipo_acceso_superior || undefined,
      }),
    actualizarFn: (id, f) =>
      tiposAccesoApi.actualizar(id, {
        nombre_tipo_acceso: f.nombre_tipo_acceso.trim(),
        tipo_acceso_superior: f.tipo_acceso_superior,
      }),
    eliminarFn: async (id) => { await tiposAccesoApi.eliminar(id) },
    getId: (t) => t.codigo_tipo_acceso,
    camposBusqueda: (t) => [t.codigo_tipo_acceso, t.nombre_tipo_acceso],
    formInicial: { codigo_tipo_acceso: '', nombre_tipo_acceso: '', tipo_acceso_superior: '' },
    itemToForm: (t) => ({
      codigo_tipo_acceso: t.codigo_tipo_acceso,
      nombre_tipo_acceso: t.nombre_tipo_acceso,
      tipo_acceso_superior: t.tipo_acceso_superior ?? '',
    }),
  })

  // ── Árbol ──────────────────────────────────────────────────────────────────
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const toggleExpandir = (codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const expandirTodos = () =>
    setExpandidos(new Set(crud.items.map((t) => t.codigo_tipo_acceso)))

  const colapsarTodos = () => setExpandidos(new Set())

  const tieneHijos = (codigo: string) =>
    crud.items.some((t) => t.tipo_acceso_superior === codigo)

  const opcionesPadre = (excluirCodigo?: string): TipoAcceso[] => {
    if (!excluirCodigo) return crud.items
    const desc = new Set<string>([excluirCodigo])
    const buscar = (cod: string) => {
      for (const t of crud.items) {
        if (t.tipo_acceso_superior === cod && !desc.has(t.codigo_tipo_acceso)) {
          desc.add(t.codigo_tipo_acceso)
          buscar(t.codigo_tipo_acceso)
        }
      }
    }
    buscar(excluirCodigo)
    return crud.items.filter((t) => !desc.has(t.codigo_tipo_acceso))
  }

  const renderNodo = (item: TipoAcceso, nivel: number) => {
    const hijos = tieneHijos(item.codigo_tipo_acceso)
    const expandido = expandidos.has(item.codigo_tipo_acceso)
    const indent = nivel * 24

    return (
      <div key={item.codigo_tipo_acceso}>
        <div
          className="flex items-center gap-2 px-3 py-1 bg-violet-50 hover:bg-violet-100 rounded group transition-colors"
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          <button
            onClick={() => toggleExpandir(item.codigo_tipo_acceso)}
            className={`p-0.5 rounded transition-colors ${hijos ? 'hover:bg-primario-muy-claro text-texto-muted hover:text-primario' : 'invisible'}`}
          >
            {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <ShieldCheck size={14} className="text-violet-500 shrink-0" />

          <div className="flex-1 min-w-0 truncate" title={`${item.nombre_tipo_acceso} (${item.codigo_tipo_acceso})`}>
            <span className="font-medium text-xs">{item.nombre_tipo_acceso}</span>
            <span className="text-xs text-texto-muted ml-2">({item.codigo_tipo_acceso})</span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => crud.abrirEditar(item)}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => crud.setConfirmacion(item)}
              className="p-1.5 rounded-lg hover:bg-orange-50 text-texto-muted hover:text-orange-500 transition-colors"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {expandido &&
          crud.items
            .filter((h) => h.tipo_acceso_superior === item.codigo_tipo_acceso)
            .sort((a, b) => a.nombre_tipo_acceso.localeCompare(b.nombre_tipo_acceso))
            .map((h) => renderNodo(h, nivel + 1))}
      </div>
    )
  }

  const filtradosOrdenados = [...crud.filtrados].sort((a, b) =>
    a.nombre_tipo_acceso.localeCompare(b.nombre_tipo_acceso),
  )
  const hayBusqueda = crud.busqueda.trim().length > 0
  const raices = hayBusqueda
    ? filtradosOrdenados
    : crud.items
        .filter((t) => !t.tipo_acceso_superior)
        .sort((a, b) => a.nombre_tipo_acceso.localeCompare(b.nombre_tipo_acceso))

  return (
    <div className="relative flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="page-heading">Tipos de Acceso</h2>
        <p className="text-sm text-texto-muted mt-1">
          Catálogo jerárquico de niveles de acceso. Define qué tipos puede ver cada nivel.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <BarraHerramientas
            busqueda={crud.busqueda}
            onBusqueda={crud.setBusqueda}
            placeholderBusqueda="Buscar tipo de acceso…"
            onNuevo={() => crud.abrirNuevo()}
            textoNuevo="Nuevo tipo"
            excelDatos={filtradosOrdenados as unknown as Record<string, unknown>[]}
            excelColumnas={[
              { titulo: 'Código', campo: 'codigo_tipo_acceso' },
              { titulo: 'Nombre', campo: 'nombre_tipo_acceso' },
              { titulo: 'Superior', campo: 'tipo_acceso_superior' },
            ]}
            excelNombreArchivo="tipos-acceso"
          />
        </div>
        <Boton variante="contorno" className="h-[38px]" onClick={expandirTodos} disabled={crud.items.length === 0}>
          Expandir todo
        </Boton>
        <Boton variante="contorno" className="h-[38px]" onClick={colapsarTodos} disabled={expandidos.size === 0}>
          Colapsar todo
        </Boton>
      </div>

      {/* Árbol */}
      <div className="bg-surface rounded-lg border border-borde p-2 flex flex-col gap-1 min-h-[180px]">
        {crud.cargando ? (
          <div className="text-center text-texto-muted py-8 text-sm">Cargando…</div>
        ) : raices.length === 0 ? (
          <div className="text-center text-texto-muted py-8 text-sm">Sin tipos de acceso.</div>
        ) : (
          raices.map((t) => renderNodo(t, 0))
        )}
      </div>

      {/* Modal crear / editar */}
      <Modal
        abierto={crud.modal}
        alCerrar={crud.cerrarModal}
        titulo={crud.editando ? `Editar: ${crud.editando.nombre_tipo_acceso}` : 'Nuevo tipo de acceso'}
        className="max-w-md"
      >
        <div className="flex flex-col gap-4 min-w-[360px]">
          {crud.editando && (
            <Input
              etiqueta="Código"
              value={crud.form.codigo_tipo_acceso}
              onChange={() => {}}
              disabled
            />
          )}

          <Input
            etiqueta="Nombre"
            value={crud.form.nombre_tipo_acceso}
            onChange={(e) => crud.updateForm('nombre_tipo_acceso', e.target.value)}
            placeholder="Ej: Supervisor"
            autoFocus
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-texto">Tipo superior</label>
            <select
              className={selectClass}
              value={crud.form.tipo_acceso_superior}
              onChange={(e) => crud.updateForm('tipo_acceso_superior', e.target.value)}
            >
              <option value="">— Sin superior (raíz) —</option>
              {opcionesPadre(crud.editando?.codigo_tipo_acceso)
                .sort((a, b) => a.nombre_tipo_acceso.localeCompare(b.nombre_tipo_acceso))
                .map((t) => (
                  <option key={t.codigo_tipo_acceso} value={t.codigo_tipo_acceso}>
                    {t.nombre_tipo_acceso} ({t.codigo_tipo_acceso})
                  </option>
                ))}
            </select>
            <p className="text-xs text-texto-muted">
              El tipo padre en la jerarquía. Vacío = nivel raíz (máximo privilegio).
            </p>
          </div>

          {crud.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{crud.error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!crud.editando}
            onGuardar={() => {
              if (!crud.form.nombre_tipo_acceso.trim()) {
                crud.setError('El nombre es obligatorio.')
                return
              }
              crud.guardar(undefined, undefined, { cerrar: false })
            }}
            onGuardarYSalir={() => {
              if (!crud.form.nombre_tipo_acceso.trim()) {
                crud.setError('El nombre es obligatorio.')
                return
              }
              crud.guardar(undefined, undefined, { cerrar: true })
            }}
            onCerrar={crud.cerrarModal}
            cargando={crud.guardando}
          />
        </div>
      </Modal>

      <ModalConfirmar
        abierto={!!crud.confirmacion}
        titulo="Eliminar tipo de acceso"
        mensaje={`¿Eliminar "${crud.confirmacion?.nombre_tipo_acceso}"? Esta acción no se puede deshacer.`}
        onConfirmar={crud.confirmarEliminar}
        onCancelar={() => crud.setConfirmacion(null)}
        cargando={crud.eliminando}
      />
    </div>
  )
}
