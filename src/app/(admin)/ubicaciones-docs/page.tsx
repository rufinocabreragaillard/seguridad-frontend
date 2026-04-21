'use client'

import { useEffect, useState, useCallback } from 'react'
import { Pencil, Trash2, Download, ChevronRight, ChevronDown, FolderTree, Folder, FolderOpen, FolderInput, FolderPlus, RefreshCw, ToggleLeft, ToggleRight, Shuffle, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { ubicacionesDocsApi } from '@/lib/api'
import type { UbicacionDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { escanearDirectorio, escanearDirectorioSinHijos, soportaDirectoryPicker, type DirectorioEscaneado } from '@/lib/escanear-directorio'
import { BotonChat } from '@/components/ui/boton-chat'
import { TabPrompts } from '@/components/ui/tab-prompts'

export default function PaginaUbicacionesDocs() {
  const { grupoActivo } = useAuth()
  const t = useTranslations('ubicacionesDocs')
  const tc = useTranslations('common')

  // ── State ─────────────────────────────────────────────────────────────────
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargando, setCargando] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // ── Modal CRUD ────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<UbicacionDoc | null>(null)
  const [tabModal, setTabModal] = useState<'datos' | 'prompts'>('datos')
  const [form, setForm] = useState({
    codigo_ubicacion: '',
    nombre_ubicacion: '',
    alias_ubicacion: '',
    descripcion: '',
    codigo_ubicacion_superior: '',
    ubicacion_habilitada: true,
    prompt: '',
    system_prompt: '',
    python: '',
    javascript: '',
    python_editado_manual: false,
    javascript_editado_manual: false,
  })
  const [confirmarTipo, setConfirmarTipo] = useState<{ u: UbicacionDoc; nuevoTipo: 'AREA' | 'CONTENIDO' } | null>(null)
  const [cambiandoTipo, setCambiandoTipo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Modal Confirmar ───────────────────────────────────────────────────────
  const [confirmacion, setConfirmacion] = useState<UbicacionDoc | null>(null)
  const [previewEliminar, setPreviewEliminar] = useState<{
    ubicaciones: number
    documentos_afectados: number
    documentos_a_eliminar: number
  } | null>(null)
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
    excluidas: number
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
  const abrirEditar = (u: UbicacionDoc) => {
    setEditando(u)
    setForm({
      codigo_ubicacion: u.codigo_ubicacion,
      nombre_ubicacion: u.nombre_ubicacion,
      alias_ubicacion: u.alias_ubicacion || '',
      descripcion: u.descripcion || '',
      codigo_ubicacion_superior: u.codigo_ubicacion_superior || '',
      ubicacion_habilitada: u.ubicacion_habilitada,
      prompt: u.prompt || '',
      system_prompt: u.system_prompt || '',
      python: (u as unknown as Record<string, unknown>).python as string || '',
      javascript: (u as unknown as Record<string, unknown>).javascript as string || '',
      python_editado_manual: ((u as unknown as Record<string, unknown>).python_editado_manual as boolean) ?? false,
      javascript_editado_manual: ((u as unknown as Record<string, unknown>).javascript_editado_manual as boolean) ?? false,
    })
    setTabModal('datos')
    setError('')
    setModal(true)
  }

  const guardar = async (cerrar: boolean) => {
    if (!editando || !form.nombre_ubicacion.trim()) {
      setError(t('errorNombreObligatorio'))
      return
    }
    setGuardando(true)
    try {
      await ubicacionesDocsApi.actualizar(editando.codigo_ubicacion, {
        nombre_ubicacion: form.nombre_ubicacion,
        alias_ubicacion: form.alias_ubicacion || undefined,
        descripcion: form.descripcion || undefined,
        codigo_ubicacion_superior: form.codigo_ubicacion_superior || undefined,
        ubicacion_habilitada: form.ubicacion_habilitada,
        prompt: form.prompt || undefined,
        system_prompt: form.system_prompt || undefined,
        python: form.python || undefined,
        javascript: form.javascript || undefined,
        python_editado_manual: form.python_editado_manual,
        javascript_editado_manual: form.javascript_editado_manual,
      } as Record<string, unknown>)
      if (cerrar) setModal(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarCambioTipo = async () => {
    if (!confirmarTipo) return
    setCambiandoTipo(true)
    try {
      await ubicacionesDocsApi.cambiarTipo(confirmarTipo.u.codigo_ubicacion, confirmarTipo.nuevoTipo)
      setConfirmarTipo(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
      setConfirmarTipo(null)
    } finally {
      setCambiandoTipo(false)
    }
  }

  const toggleHabilitada = async (u: UbicacionDoc) => {
    try {
      await ubicacionesDocsApi.actualizar(u.codigo_ubicacion, {
        ubicacion_habilitada: !u.ubicacion_habilitada,
      })
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    }
  }

  const abrirConfirmacionEliminar = async (u: UbicacionDoc) => {
    setConfirmacion(u)
    setPreviewEliminar(null)
    try {
      const p = await ubicacionesDocsApi.previewEliminar(u.codigo_ubicacion)
      setPreviewEliminar(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('error'))
    }
  }

  const ejecutarEliminacion = async () => {
    if (!confirmacion) return
    setEliminando(true)
    try {
      await ubicacionesDocsApi.eliminar(confirmacion.codigo_ubicacion)
      setConfirmacion(null)
      setPreviewEliminar(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlEliminar'))
      setConfirmacion(null)
      setPreviewEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  // ── Cargar Ubicaciones (escaneo + sincronización) ─────────────────────────
  const iniciarEscaneo = async () => {
    if (!soportaDirectoryPicker()) {
      alert(t('errorBrowserNoSoporta'))
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
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al sincronizar ubicaciones.'
        : 'Error al sincronizar ubicaciones.'
      alert(msg)
    } finally {
      setSincronizando(false)
    }
  }

  const cerrarModalCarga = () => {
    setModalCarga(false)
    setDatosEscaneo(null)
    setResultadoSync(null)
  }

  // ── Cargar Ubicación individual (sin hijos) ──────────────────────────────
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false)

  const cargarUbicacionIndividual = async () => {
    if (!soportaDirectoryPicker()) {
      alert(t('errorBrowserNoSoporta'))
      return
    }
    setCargandoUbicacion(true)
    try {
      const resultado = await escanearDirectorioSinHijos()
      if (!resultado) {
        setCargandoUbicacion(false)
        return
      }
      const { directorio } = resultado
      await ubicacionesDocsApi.crear({
        codigo_ubicacion: directorio.codigo_ubicacion,
        codigo_grupo: grupoActivo!,
        nombre_ubicacion: directorio.nombre_ubicacion,
      })
      cargar()
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al crear ubicación.'
        : e instanceof Error ? e.message : 'Error al crear ubicación.'
      alert(msg)
    } finally {
      setCargandoUbicacion(false)
    }
  }

  // ── Preview: calcular diferencias ─────────────────────────────────────────
  // ── Filtrar directorios escaneados: excluir hijos de inhabilitadas ────────
  const filtrarPorInhabilitadas = (directorios: DirectorioEscaneado[]) => {
    const inhabilitadas = new Set(
      ubicaciones.filter((u) => !u.ubicacion_habilitada).map((u) => u.codigo_ubicacion)
    )
    if (inhabilitadas.size === 0) return { filtrados: directorios, excluidos: 0 }

    const padres: Record<string, string | undefined> = {}
    for (const d of directorios) {
      padres[d.codigo_ubicacion] = d.codigo_ubicacion_superior || undefined
    }

    const esDescendienteInhabilitada = (codigo: string): boolean => {
      const visitados = new Set<string>()
      let actual = padres[codigo] || ubicaciones.find((u) => u.codigo_ubicacion === codigo)?.codigo_ubicacion_superior
      while (actual) {
        if (inhabilitadas.has(actual)) return true
        if (visitados.has(actual)) break
        visitados.add(actual)
        actual = padres[actual] || ubicaciones.find((u) => u.codigo_ubicacion === actual)?.codigo_ubicacion_superior || undefined
      }
      return false
    }

    const filtrados = directorios.filter((d) => !esDescendienteInhabilitada(d.codigo_ubicacion))
    return { filtrados, excluidos: directorios.length - filtrados.length }
  }

  const calcularDiferencias = () => {
    if (!datosEscaneo) return { nuevas: 0, aEliminar: 0, sinCambio: 0, excluidas: 0 }
    const { filtrados: dirsFiltrados, excluidos } = filtrarPorInhabilitadas(datosEscaneo.directorios)
    const codigosActuales = new Set(ubicaciones.map((u) => u.codigo_ubicacion))
    const codigosEscaneados = new Set(dirsFiltrados.map((d) => d.codigo_ubicacion))
    const nuevas = dirsFiltrados.filter((d) => !codigosActuales.has(d.codigo_ubicacion)).length
    const aEliminar = ubicaciones.filter((u) => !codigosEscaneados.has(u.codigo_ubicacion)).length
    const sinCambio = dirsFiltrados.length - nuevas
    return { nuevas, aEliminar, sinCambio, excluidas: excluidos }
  }

  const filtrados = ubicaciones

  // ── Render nodos jerárquicos ──────────────────────────────────────────────
  const renderNodo = (u: UbicacionDoc) => {
    const hijos = tieneHijos(u.codigo_ubicacion)
    const expandido = expandidos.has(u.codigo_ubicacion)
    const indent = u.nivel * 24
    const esArea = u.tipo_ubicacion === 'AREA'
    const rowBg = esArea ? 'bg-blue-50 hover:bg-blue-100' : 'bg-amber-50 hover:bg-amber-100'
    const folderColor = esArea ? 'text-blue-500' : 'text-amber-500'

    return (
      <div key={u.codigo_ubicacion}>
        <div
          className={`flex items-center gap-2 px-3 py-2 ${rowBg} rounded-lg group transition-colors`}
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          <button
            onClick={() => toggleExpandir(u.codigo_ubicacion)}
            className={`p-0.5 rounded transition-colors ${hijos ? 'hover:bg-primario-muy-claro text-texto-muted hover:text-primario' : 'invisible'}`}
          >
            {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandido && hijos ? (
            <FolderOpen size={16} className={`${folderColor} shrink-0`} />
          ) : (
            <Folder size={16} className={`${folderColor} shrink-0`} />
          )}

          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{u.nombre_ubicacion}</span>
            <span className="text-xs text-texto-muted ml-2">({u.codigo_ubicacion})</span>
          </div>

          <span className="text-xs text-texto-muted truncate max-w-[300px] hidden lg:block">
            {u.ruta_completa || ''}
          </span>

          <Insignia variante={u.tipo_ubicacion === 'AREA' ? 'primario' : 'advertencia'}>
            {u.tipo_ubicacion}
          </Insignia>

          <Insignia variante={u.ubicacion_habilitada ? 'exito' : 'advertencia'}>
            {u.ubicacion_habilitada ? t('habilitada') : t('inhabilitada')}
          </Insignia>

          <Insignia variante={u.activo ? 'exito' : 'error'}>
            {u.activo ? tc('activo') : tc('inactivo')}
          </Insignia>

          <div className="flex items-center gap-0.5 transition-opacity">
            <button
              onClick={() => toggleHabilitada(u)}
              className={`p-1.5 rounded-lg transition-colors ${
                u.ubicacion_habilitada
                  ? 'hover:bg-amber-50 text-texto-muted hover:text-amber-600'
                  : 'hover:bg-green-50 text-texto-muted hover:text-green-600'
              }`}
              title={u.ubicacion_habilitada ? 'Inhabilitar (incluye hijos)' : 'Habilitar (incluye hijos)'}
            >
              {u.ubicacion_habilitada ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            </button>
            <button
              onClick={() => setConfirmarTipo({ u, nuevoTipo: u.tipo_ubicacion === 'AREA' ? 'CONTENIDO' : 'AREA' })}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title={`Cambiar a ${u.tipo_ubicacion === 'AREA' ? 'CONTENIDO' : 'AREA'}`}
            >
              <Shuffle size={14} />
            </button>
            <button
              onClick={() => abrirEditar(u)}
              className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => abrirConfirmacionEliminar(u)}
              className="p-1.5 rounded-lg hover:bg-orange-50 text-texto-muted hover:text-orange-500 transition-colors"
              title="Quitar de la BD"
            >
              <XCircle size={14} />
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
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      {/* Header */}
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">{t('subtitulo')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap items-start">
          <div className="flex flex-col items-center">
            <Boton variante="contorno" onClick={cargarUbicacionIndividual} cargando={cargandoUbicacion}>
              <FolderPlus size={16} />
              {t('cargarUbicacion')}
            </Boton>
            <span className="text-[11px] text-texto-muted mt-0.5">solo un directorio</span>
          </div>
          <div className="flex flex-col items-center">
            <Boton variante="contorno" onClick={iniciarEscaneo} cargando={escaneando}>
              <FolderInput size={16} />
              {t('cargarDesdeDirectorioTitulo')}
            </Boton>
            <span className="text-[11px] text-texto-muted mt-0.5">y todos los sub-directorios</span>
          </div>
          <Boton variante="contorno" className="h-[38px]" onClick={expandirTodos} disabled={ubicaciones.length === 0}>
            {t('expandirTodo')}
          </Boton>
          <Boton variante="contorno" className="h-[38px]" onClick={colapsarTodos} disabled={ubicaciones.length === 0}>
            {t('colapsarTodo')}
          </Boton>
          <Boton
            variante="contorno"
            className="h-[38px]"
            onClick={() =>
              exportarExcel(
                filtrados as unknown as Record<string, unknown>[],
                [
                  { titulo: 'Código', campo: 'codigo_ubicacion' },
                  { titulo: 'Nombre', campo: 'nombre_ubicacion' },
                  { titulo: 'Ruta', campo: 'ruta_completa' },
                  { titulo: 'Padre', campo: 'codigo_ubicacion_superior' },
                  { titulo: 'Nivel', campo: 'nivel' },
                  { titulo: 'Habilitada', campo: 'ubicacion_habilitada', formato: (v: unknown) => (v ? 'Sí' : 'No') },
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
        </div>
      </div>

      {/* Árbol jerárquico */}
      <div className="border border-borde rounded-lg bg-fondo-tarjeta">
        {cargando ? (
          <div className="py-8 text-center text-texto-muted">{tc('cargando')}</div>
        ) : raices.length === 0 ? (
          <div className="py-8 text-center text-texto-muted flex flex-col items-center gap-2">
            <FolderTree size={32} className="text-texto-muted/50" />
            <p>{t('sinUbicaciones')}</p>
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
        titulo={editando ? t('editarTitulo', { nombre: editando.nombre_ubicacion }) : ''}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-4">
          {/* Tabs — siempre en edición */}
          {editando && (
            <div className="flex border-b border-borde">
              {(['datos', 'prompts'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabModal(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    tabModal === tab
                      ? 'border-b-2 border-primario text-primario'
                      : 'text-texto-muted hover:text-texto'
                  }`}
                >
                  {tab === 'datos' ? 'Datos' : 'Prompts'}
                </button>
              ))}
            </div>
          )}

          {/* Tab Datos */}
          {tabModal === 'datos' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                etiqueta={t('etiquetaAlias')}
                value={form.alias_ubicacion}
                onChange={(e) => setForm({ ...form, alias_ubicacion: e.target.value })}
                placeholder={t('placeholderAlias')}
              />

              {editando && (
                <div>
                  <label className="block text-sm font-medium text-texto mb-1.5">Tipo</label>
                  <select
                    className="w-full rounded-lg border border-borde bg-fondo-tarjeta px-3 py-2 text-sm text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                    value={editando.tipo_ubicacion}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value as 'AREA' | 'CONTENIDO'
                      if (nuevoTipo !== editando.tipo_ubicacion) {
                        setConfirmarTipo({ u: editando, nuevoTipo })
                      }
                    }}
                  >
                    <option value="AREA">AREA</option>
                    <option value="CONTENIDO">CONTENIDO</option>
                  </select>
                </div>
              )}

              <div className="col-span-2">
                <Textarea
                  etiqueta={t('etiquetaDescripcion')}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder={t('placeholderDescripcion')}
                  rows={2}
                />
              </div>

              {editando && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ubicacion_habilitada}
                    onChange={(e) => setForm({ ...form, ubicacion_habilitada: e.target.checked })}
                    className="w-4 h-4 rounded border-borde text-primario focus:ring-primario"
                  />
                  <span className="text-sm font-medium text-texto">{t('etiquetaHabilitada')}</span>
                  <span className="text-xs text-texto-muted">{t('habilitadaHint')}</span>
                </label>
              )}
              {editando && (
                <Input etiqueta={t('etiquetaCodigo')} value={form.codigo_ubicacion} disabled readOnly />
              )}
            </div>
          )}

          {/* Tab Prompts */}
          {tabModal === 'prompts' && editando && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editando.codigo_ubicacion}
              campos={{
                prompt: form.prompt,
                system_prompt: form.system_prompt,
                python: form.python,
                javascript: form.javascript,
                python_editado_manual: form.python_editado_manual,
                javascript_editado_manual: form.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!editando}
            onGuardar={() => guardar(false)}
            onGuardarYSalir={() => guardar(true)}
            onCerrar={() => setModal(false)}
            cargando={guardando}
          />
        </div>
      </Modal>

      {/* Modal Confirmar — Hard delete cascade */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => { setConfirmacion(null); setPreviewEliminar(null) }}
        alConfirmar={ejecutarEliminacion}
        titulo={t('eliminarTitulo')}
        mensaje={
          confirmacion
            ? (previewEliminar
                ? t('eliminarConfirm', {
                    nombre: confirmacion.nombre_ubicacion,
                    ubicaciones: previewEliminar.ubicaciones,
                    documentosAfectados: previewEliminar.documentos_afectados,
                    documentosEliminar: previewEliminar.documentos_a_eliminar,
                  })
                : t('calculandoImpacto', { nombre: confirmacion.nombre_ubicacion }))
            : ''
        }
        textoConfirmar={tc('eliminar')}
        cargando={eliminando || !previewEliminar}
      />

      {/* Modal Confirmar Cambio de Tipo */}
      <ModalConfirmar
        abierto={!!confirmarTipo}
        alCerrar={() => setConfirmarTipo(null)}
        alConfirmar={ejecutarCambioTipo}
        titulo={confirmarTipo ? t('cambiarTipoTitulo', { tipo: confirmarTipo.nuevoTipo }) : ''}
        mensaje={
          confirmarTipo
            ? t('cambiarTipoConfirm', { nombre: confirmarTipo.u.nombre_ubicacion, nuevoTipo: confirmarTipo.nuevoTipo })
            : ''
        }
        textoConfirmar={tc('guardar')}
        cargando={cambiandoTipo}
      />

      {/* Modal Cargar Ubicaciones */}
      <Modal
        abierto={modalCarga}
        alCerrar={cerrarModalCarga}
        titulo={t('cargarDesdeDirectorioTitulo')}
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
                <div className={`grid ${diff.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="stat-number text-green-600">{diff.nuevas}</p>
                    <p className="text-xs text-texto-muted">Nuevas</p>
                  </div>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="stat-number text-red-600">{diff.aEliminar}</p>
                    <p className="text-xs text-texto-muted">A eliminar</p>
                  </div>
                  <div className="border border-borde rounded-lg p-3 text-center">
                    <p className="stat-number text-texto-muted">{diff.sinCambio}</p>
                    <p className="text-xs text-texto-muted">Sin cambio</p>
                  </div>
                  {diff.excluidas > 0 && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center">
                      <p className="stat-number text-amber-600">{diff.excluidas}</p>
                      <p className="text-xs text-amber-700">Excluidas</p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview del árbol escaneado */}
              <div className="border border-borde rounded-lg max-h-[300px] overflow-y-auto">
                <div className="py-1">
                  {(() => {
                    const { filtrados: dirsFiltrados } = filtrarPorInhabilitadas(datosEscaneo.directorios)
                    const codsFiltrados = new Set(dirsFiltrados.map((d) => d.codigo_ubicacion))
                    return datosEscaneo.directorios.slice(0, 30).map((d) => {
                      const esNueva = !ubicaciones.some((u) => u.codigo_ubicacion === d.codigo_ubicacion)
                      const esExcluida = !codsFiltrados.has(d.codigo_ubicacion)
                      return (
                        <div
                          key={d.codigo_ubicacion}
                          className={`flex items-center gap-2 px-3 py-1.5 text-sm ${esExcluida ? 'opacity-40' : ''}`}
                          style={{ paddingLeft: `${d.nivel * 20 + 12}px` }}
                        >
                          <Folder size={14} className="text-texto-muted shrink-0" />
                          <span className={esExcluida ? 'text-texto-muted line-through' : esNueva ? 'text-green-700 font-medium' : 'text-texto'}>
                            {d.nombre_ubicacion}
                          </span>
                          {esExcluida && (
                            <Insignia variante="advertencia">Excluida</Insignia>
                          )}
                          {!esExcluida && esNueva && (
                            <Insignia variante="exito">Nueva</Insignia>
                          )}
                        </div>
                      )
                    })
                  })()}
                  {datosEscaneo.directorios.length > 30 && (
                    <p className="px-4 py-2 text-xs text-texto-muted text-center">
                      ...y {datosEscaneo.directorios.length - 30} directorio(s) más
                    </p>
                  )}
                </div>
              </div>

              {diff && diff.excluidas > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-700">
                    {diff.excluidas} directorio(s) excluido(s) por estar bajo una ubicación inhabilitada.
                  </p>
                </div>
              )}

              {diff && diff.aEliminar > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700">
                    Se eliminarán {diff.aEliminar} ubicación(es) que ya no existen en el directorio seleccionado.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Boton variante="contorno" onClick={cerrarModalCarga}>
                  {tc('cancelar')}
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

              <div className={`grid ${resultadoSync.excluidas > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-green-600">{resultadoSync.insertadas}</p>
                  <p className="text-xs text-texto-muted">Insertadas</p>
                </div>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-red-600">{resultadoSync.eliminadas}</p>
                  <p className="text-xs text-texto-muted">Eliminadas</p>
                </div>
                <div className="border border-borde rounded-lg p-3 text-center">
                  <p className="stat-number text-primario">{resultadoSync.actualizadas}</p>
                  <p className="text-xs text-texto-muted">Actualizadas</p>
                </div>
                {resultadoSync.excluidas > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center">
                    <p className="stat-number text-amber-600">{resultadoSync.excluidas}</p>
                    <p className="text-xs text-amber-700">Excluidas</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Boton variante="primario" onClick={cerrarModalCarga}>
                  {tc('cerrar')}
                </Boton>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
