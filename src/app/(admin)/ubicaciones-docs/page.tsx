'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search, ChevronRight, ChevronDown, FolderTree, Folder, FolderOpen, FolderInput, RefreshCw } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { ubicacionesDocsApi } from '@/lib/api'
import type { UbicacionDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { escanearDirectorio, soportaDirectoryPicker, type DirectorioEscaneado } from '@/lib/escanear-directorio'

export default function PaginaUbicacionesDocs() {
  const { grupoActivo } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // ── Modal CRUD ────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<UbicacionDoc | null>(null)
  const [form, setForm] = useState({
    codigo_ubicacion: '',
    nombre_ubicacion: '',
    descripcion: '',
    codigo_ubicacion_superior: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Modal Confirmar ───────────────────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<UbicacionDoc | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // ── Cargar Ubicaciones (escaneo) ──────────────────────────────────────────
  const [modalCarga, setModalCarga] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [datosEscaneo, setDatosEscaneo] = useState<{
    nombreRaiz: string
    directorios: DirectorioEscaneado[]
  } | null>(null)
  const [resultadoSync, setResultadoSync] = useState<{
    insertadas: number
    eliminadas: number
    actualizadas: number
    total: number
  } | null>(null)

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setUbicaciones(await ubicacionesDocsApi.listar())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Expandir/Colapsar ─────────────────────────────────────────────────────
  const toggleExpandir = (codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const expandirTodos = () => {
    setExpandidos(new Set(ubicaciones.map((u) => u.codigo_ubicacion)))
  }

  const colapsarTodos = () => {
    setExpandidos(new Set())
  }

  // ── Helpers jerarquía ─────────────────────────────────────────────────────
  const tieneHijos = (codigo: string) =>
    ubicaciones.some((u) => u.codigo_ubicacion_superior === codigo)

  const opcionesPadre = (excluirCodigo?: string) => {
    if (!excluirCodigo) return ubicaciones
    const descendientes = new Set<string>()
    const buscarDesc = (cod: string) => {
      for (const u of ubicaciones) {
        if (u.codigo_ubicacion_superior === cod && !descendientes.has(u.codigo_ubicacion)) {
          descendientes.add(u.codigo_ubicacion)
          buscarDesc(u.codigo_ubicacion)
        }
      }
    }
    descendientes.add(excluirCodigo)
    buscarDesc(excluirCodigo)
    return ubicaciones.filter((u) => !descendientes.has(u.codigo_ubicacion))
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const abrirNuevo = (padre?: string) => {
    setEditando(null)
    setForm({
      codigo_ubicacion: '',
      nombre_ubicacion: '',
      descripcion: '',
      codigo_ubicacion_superior: padre || '',
    })
    setError('')
    setModal(true)
  }

  const abrirEditar = (u: UbicacionDoc) => {
    setEditando(u)
    setForm({
      codigo_ubicacion: u.codigo_ubicacion,
      nombre_ubicacion: u.nombre_ubicacion,
      descripcion: u.descripcion || '',
      codigo_ubicacion_superior: u.codigo_ubicacion_superior || '',
    })
    setError('')
    setModal(true)
  }

  const guardar = async () => {
    if (!form.codigo_ubicacion.trim()) {
      setError('El código es obligatorio')
      return
    }
    if (!form.nombre_ubicacion.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await ubicacionesDocsApi.actualizar(editando.codigo_ubicacion, {
          nombre_ubicacion: form.nombre_ubicacion,
          descripcion: form.descripcion || undefined,
          codigo_ubicacion_superior: form.codigo_ubicacion_superior || undefined,
        })
      } else {
        await ubicacionesDocsApi.crear({
          codigo_ubicacion: form.codigo_ubicacion.toUpperCase().replace(/\s+/g, '_'),
          codigo_grupo: grupoActivo!,
          nombre_ubicacion: form.nombre_ubicacion,
          descripcion: form.descripcion || undefined,
          codigo_ubicacion_superior: form.codigo_ubicacion_superior || undefined,
        })
      }
      setModal(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEliminacion = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await ubicacionesDocsApi.desactivar(confirmacion.codigo_ubicacion)
      setConfirmacion(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al desactivar')
      setConfirmacion(null)
    } finally {
      setEliminando(false)
    }
  }

  // ── Cargar Ubicaciones (escaneo + sincronización) ─────────────────────────
  const iniciarEscaneo = async () => {
    if (!soportaDirectoryPicker()) {
      alert('Su navegador no soporta la selección de directorios. Use Chrome, Edge o Safari.')
      return
    }
    setEscaneando(true)
    setResultadoSync(null)
    try {
      const resultado = await escanearDirectorio()
      if (!resultado) {
        setEscaneando(false)
        return // usuario canceló
      }
      setDatosEscaneo(resultado)
      setModalCarga(true)
    } catch {
      alert('Error al escanear el directorio.')
    } finally {
      setEscaneando(false)
    }
  }

  const ejecutarSincronizacion = async () => {
    if (!datosEscaneo) return
    setSincronizando(true)
    try {
      const res = await ubicacionesDocsApi.sincronizar({
        directorios: datosEscaneo.directorios,
      })
      setResultadoSync(res)
      cargar()
    } catch {
      alert('Error al sincronizar ubicaciones.')
    } finally {
      setSincronizando(false)
    }
  }

  const cerrarModalCarga = () => {
    setModalCarga(false)
    setDatosEscaneo(null)
    setResultadoSync(null)
  }

  // ── Preview: calcular diferencias ─────────────────────────────────────────
  const calcularDiferencias = () => {
    if (!datosEscaneo) return { nuevas: 0, aEliminar: 0, sinCambio: 0 }
    const codigosActuales = new Set(ubicaciones.map((u) => u.codigo_ubicacion))
    const codigosEscaneados = new Set(datosEscaneo.directorios.map((d) => d.codigo_ubicacion))
    const nuevas = datosEscaneo.directorios.filter((d) => !codigosActuales.has(d.codigo_ubicacion)).length
    const aEliminar = ubicaciones.filter((u) => !codigosEscaneados.has(u.codigo_ubicacion)).length
    const sinCambio = datosEscaneo.directorios.length - nuevas
    return { nuevas, aEliminar, sinCambio }
  }

  // ── Filtro ────────────────────────────────────────────────────────────────
  const filtrados = busqueda
    ? ubicaciones.filter(
        (u) =>
          u.nombre_ubicacion.toLowerCase().includes(busqueda.toLowerCase()) ||
          u.codigo_ubicacion.toLowerCase().includes(busqueda.toLowerCase()) ||
          (u.ruta_completa || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : ubicaciones

  // ── Render nodos jerárquicos ──────────────────────────────────────────────
  const renderNodo = (u: UbicacionDoc) => {
    const hijos = tieneHijos(u.codigo_ubicacion)
    const expandido = expandidos.has(u.codigo_ubicacion)
    const indent = u.nivel * 24

    return (
      <div key={u.codigo_ubicacion}>
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-fondo rounded-lg group transition-colors"
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          <button
            onClick={() => toggleExpandir(u.codigo_ubicacion)}
            className={`p-0.5 rounded transition-colors ${hijos ? 'hover:bg-primario-muy-claro text-texto-muted hover:text-primario' : 'invisible'}`}
          >
            {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandido && hijos ? (
            <FolderOpen size={16} className="text-primario shrink-0" />
          ) : (
            <Folder size={16} className="text-texto-muted shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{u.nombre_ubicacion}</span>
            <span className="text-xs text-texto-muted ml-2">({u.codigo_ubicacion})</span>
          </div>

          <span className="text-xs text-texto-muted truncate max-w-[300px] hidden lg:block">
            {u.ruta_completa || ''}
          </span>

          <Insignia variante={u.activo ? 'exito' : 'error'}>
            {u.activo ? 'Activo' : 'Inactivo'}
          </Insignia>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => abrirNuevo(u.codigo_ubicacion)}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title="Crear subdirectorio"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => abrirEditar(u)}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setConfirmacion(u)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
              title="Desactivar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {expandido &&
          ubicaciones
            .filter((h) => h.codigo_ubicacion_superior === u.codigo_ubicacion)
            .sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
            .map((h) => renderNodo(h))}
      </div>
    )
  }

  const raices = filtrados
    .filter((u) => !u.codigo_ubicacion_superior)
    .sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))

  const diff = datosEscaneo ? calcularDiferencias() : null

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-texto">Ubicaciones de Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">Directorios y subdirectorios para organizar documentos</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Buscar por nombre, código o ruta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icono={<Search size={15} />}
          />
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          <Boton variante="contorno" tamano="sm" onClick={expandirTodos} disabled={ubicaciones.length === 0}>
            Expandir todo
          </Boton>
          <Boton variante="contorno" tamano="sm" onClick={colapsarTodos} disabled={ubicaciones.length === 0}>
            Colapsar todo
          </Boton>
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={() =>
              exportarExcel(
                filtrados as unknown as Record<string, unknown>[],
                [
                  { titulo: 'Código', campo: 'codigo_ubicacion' },
                  { titulo: 'Nombre', campo: 'nombre_ubicacion' },
                  { titulo: 'Ruta', campo: 'ruta_completa' },
                  { titulo: 'Padre', campo: 'codigo_ubicacion_superior' },
                  { titulo: 'Nivel', campo: 'nivel' },
                  { titulo: 'Estado', campo: 'activo', formato: (v: unknown) => (v ? 'Activo' : 'Inactivo') },
                ],
                'ubicaciones-docs'
              )
            }
            disabled={filtrados.length === 0}
          >
            <Download size={15} />
            Excel
          </Boton>
          <Boton variante="contorno" onClick={iniciarEscaneo} cargando={escaneando}>
            <FolderInput size={16} />
            Cargar Ubicaciones
          </Boton>
          <Boton variante="primario" onClick={() => abrirNuevo()}>
            <Plus size={16} />
            Nueva ubicación
          </Boton>
        </div>
      </div>

      {/* Árbol jerárquico */}
      <div className="border border-borde rounded-lg bg-fondo-tarjeta">
        {cargando ? (
          <div className="py-8 text-center text-texto-muted">Cargando...</div>
        ) : raices.length === 0 ? (
          <div className="py-8 text-center text-texto-muted flex flex-col items-center gap-2">
            <FolderTree size={32} className="text-texto-muted/50" />
            <p>No se encontraron ubicaciones</p>
          </div>
        ) : (
          <div className="py-2">
            {raices.map((u) => renderNodo(u))}
          </div>
        )}
      </div>

      {/* Modal CRUD */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={editando ? `Ubicación: ${editando.nombre_ubicacion}` : 'Nueva ubicación'}
      >
        <div className="flex flex-col gap-4 min-w-[450px]">
          <Input
            etiqueta="Código *"
            value={form.codigo_ubicacion}
            onChange={(e) => setForm({ ...form, codigo_ubicacion: e.target.value })}
            placeholder="CONTRATOS_2024"
            disabled={!!editando}
          />
          <Input
            etiqueta="Nombre *"
            value={form.nombre_ubicacion}
            onChange={(e) => setForm({ ...form, nombre_ubicacion: e.target.value })}
            placeholder="Contratos 2024"
          />
          <Textarea
            etiqueta="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción de esta ubicación"
            rows={3}
          />

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Ubicación superior</label>
            <select
              className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
              value={form.codigo_ubicacion_superior}
              onChange={(e) => setForm({ ...form, codigo_ubicacion_superior: e.target.value })}
            >
              <option value="">— Raíz (sin padre) —</option>
              {opcionesPadre(editando?.codigo_ubicacion).map((u) => (
                <option key={u.codigo_ubicacion} value={u.codigo_ubicacion}>
                  {'  '.repeat(u.nivel)}{u.nombre_ubicacion} ({u.codigo_ubicacion})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModal(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>
              {editando ? 'Guardar' : 'Crear'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo="Desactivar ubicación"
        mensaje={
          confirmacion
            ? `¿Desactivar la ubicación "${confirmacion.nombre_ubicacion}"?${
                tieneHijos(confirmacion.codigo_ubicacion)
                  ? ' Esta ubicación tiene subdirectorios.'
                  : ''
              }`
            : ''
        }
        textoConfirmar="Desactivar"
        cargando={eliminando}
      />

      {/* Modal Cargar Ubicaciones */}
      <Modal
        abierto={modalCarga}
        alCerrar={cerrarModalCarga}
        titulo="Cargar Ubicaciones desde Directorio"
      >
        <div className="flex flex-col gap-4 min-w-[500px]">
          {/* Pre-sincronización: preview */}
          {!resultadoSync && datosEscaneo && (
            <>
              <div className="bg-fondo rounded-lg p-4 flex items-center gap-3">
                <FolderOpen size={24} className="text-primario shrink-0" />
                <div>
                  <p className="font-medium text-texto">{datosEscaneo.nombreRaiz}</p>
                  <p className="text-sm text-texto-muted">
                    {datosEscaneo.directorios.length} directorio{datosEscaneo.directorios.length !== 1 ? 's' : ''} encontrado{datosEscaneo.directorios.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Resumen de cambios */}
              {diff && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{diff.nuevas}</p>
                    <p className="text-xs text-texto-muted">Nuevas</p>
                  </div>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{diff.aEliminar}</p>
                    <p className="text-xs text-texto-muted">A eliminar</p>
                  </div>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-texto-muted">{diff.sinCambio}</p>
                    <p className="text-xs text-texto-muted">Sin cambio</p>
                  </div>
                </div>
              )}

              {/* Preview del árbol escaneado (max 20 items) */}
              <div className="border border-borde rounded-lg max-h-[300px] overflow-y-auto">
                <div className="py-1">
                  {datosEscaneo.directorios.slice(0, 30).map((d) => {
                    const esNueva = !ubicaciones.some((u) => u.codigo_ubicacion === d.codigo_ubicacion)
                    return (
                      <div
                        key={d.codigo_ubicacion}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm"
                        style={{ paddingLeft: `${d.nivel * 20 + 12}px` }}
                      >
                        <Folder size={14} className="text-texto-muted shrink-0" />
                        <span className={esNueva ? 'text-green-700 font-medium' : 'text-texto'}>
                          {d.nombre_ubicacion}
                        </span>
                        {esNueva && (
                          <Insignia variante="exito">Nueva</Insignia>
                        )}
                      </div>
                    )
                  })}
                  {datosEscaneo.directorios.length > 30 && (
                    <p className="px-4 py-2 text-xs text-texto-muted text-center">
                      ...y {datosEscaneo.directorios.length - 30} directorio(s) más
                    </p>
                  )}
                </div>
              </div>

              {diff && diff.aEliminar > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700">
                    Se eliminarán {diff.aEliminar} ubicación(es) que ya no existen en el directorio seleccionado.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={cerrarModalCarga}>
                  Cancelar
                </Boton>
                <Boton variante="primario" onClick={ejecutarSincronizacion} cargando={sincronizando}>
                  <RefreshCw size={15} />
                  Sincronizar
                </Boton>
              </div>
            </>
          )}

          {/* Post-sincronización: resultado */}
          {resultadoSync && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-lg font-medium text-green-800">Sincronización completada</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{resultadoSync.insertadas}</p>
                  <p className="text-xs text-texto-muted">Insertadas</p>
                </div>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{resultadoSync.eliminadas}</p>
                  <p className="text-xs text-texto-muted">Eliminadas</p>
                </div>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primario">{resultadoSync.actualizadas}</p>
                  <p className="text-xs text-texto-muted">Actualizadas</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Boton variante="primario" onClick={cerrarModalCarga}>
                  Cerrar
                </Boton>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
