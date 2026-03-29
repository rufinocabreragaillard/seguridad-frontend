'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { datosBasicosApi } from '@/lib/api'
import type { CategoriaParametro, TipoParametro } from '@/lib/tipos'

type TabId = 'categorias' | 'tipos'

export default function PaginaDatosBasicos() {
  const [tabActiva, setTabActiva] = useState<TabId>('categorias')

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaParametro[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [modalCat, setModalCat] = useState(false)
  const [catEditando, setCatEditando] = useState<CategoriaParametro | null>(null)
  const [formCat, setFormCat] = useState({ categoria_parametro: '', nombre: '', descripcion: '' })
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  // ── Tipos ──────────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoParametro[]>([])
  const [cargandoTipo, setCargandoTipo] = useState(true)
  const [modalTipo, setModalTipo] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoParametro | null>(null)
  const [formTipo, setFormTipo] = useState({ categoria_parametro: '', tipo_parametro: '', nombre: '', descripcion: '' })
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')
  const [filtroCat, setFiltroCat] = useState('')

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarCategorias = useCallback(async () => {
    setCargandoCat(true)
    try {
      setCategorias(await datosBasicosApi.listarCategorias())
    } finally {
      setCargandoCat(false)
    }
  }, [])

  const cargarTipos = useCallback(async () => {
    setCargandoTipo(true)
    try {
      setTipos(await datosBasicosApi.listarTipos())
    } finally {
      setCargandoTipo(false)
    }
  }, [])

  useEffect(() => { cargarCategorias() }, [cargarCategorias])
  useEffect(() => { cargarTipos() }, [cargarTipos])

  // ── CRUD Categorías ────────────────────────────────────────────────────────
  const abrirNuevaCat = () => {
    setCatEditando(null)
    setFormCat({ categoria_parametro: '', nombre: '', descripcion: '' })
    setErrorCat('')
    setModalCat(true)
  }

  const abrirEditarCat = (c: CategoriaParametro) => {
    setCatEditando(c)
    setFormCat({ categoria_parametro: c.categoria_parametro, nombre: c.nombre, descripcion: c.descripcion || '' })
    setErrorCat('')
    setModalCat(true)
  }

  const guardarCategoria = async () => {
    if (!formCat.categoria_parametro || !formCat.nombre) {
      setErrorCat('El código y el nombre son obligatorios')
      return
    }
    setGuardandoCat(true)
    setErrorCat('')
    try {
      if (catEditando) {
        await datosBasicosApi.actualizarCategoria(catEditando.categoria_parametro, {
          nombre: formCat.nombre,
          descripcion: formCat.descripcion || undefined,
        })
      } else {
        await datosBasicosApi.crearCategoria({
          categoria_parametro: formCat.categoria_parametro.toUpperCase(),
          nombre: formCat.nombre,
          descripcion: formCat.descripcion || undefined,
        })
      }
      setModalCat(false)
      cargarCategorias()
    } catch (e) {
      setErrorCat(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoCat(false)
    }
  }

  const eliminarCategoria = async (c: CategoriaParametro) => {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?\nSolo es posible si no tiene tipos asociados.`)) return
    try {
      await datosBasicosApi.eliminarCategoria(c.categoria_parametro)
      cargarCategorias()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const toggleActivoCat = async (c: CategoriaParametro) => {
    try {
      await datosBasicosApi.actualizarCategoria(c.categoria_parametro, { activo: !c.activo })
      cargarCategorias()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Tipos ─────────────────────────────────────────────────────────────
  const abrirNuevoTipo = () => {
    setTipoEditando(null)
    setFormTipo({ categoria_parametro: '', tipo_parametro: '', nombre: '', descripcion: '' })
    setErrorTipo('')
    setModalTipo(true)
  }

  const abrirEditarTipo = (t: TipoParametro) => {
    setTipoEditando(t)
    setFormTipo({ categoria_parametro: t.categoria_parametro, tipo_parametro: t.tipo_parametro, nombre: t.nombre, descripcion: t.descripcion || '' })
    setErrorTipo('')
    setModalTipo(true)
  }

  const guardarTipo = async () => {
    if (!formTipo.categoria_parametro || !formTipo.tipo_parametro || !formTipo.nombre) {
      setErrorTipo('La categoría, el código y el nombre son obligatorios')
      return
    }
    setGuardandoTipo(true)
    setErrorTipo('')
    try {
      if (tipoEditando) {
        await datosBasicosApi.actualizarTipo(
          tipoEditando.categoria_parametro,
          tipoEditando.tipo_parametro,
          { nombre: formTipo.nombre, descripcion: formTipo.descripcion || undefined }
        )
      } else {
        await datosBasicosApi.crearTipo({
          categoria_parametro: formTipo.categoria_parametro,
          tipo_parametro: formTipo.tipo_parametro.toUpperCase(),
          nombre: formTipo.nombre,
          descripcion: formTipo.descripcion || undefined,
        })
      }
      setModalTipo(false)
      cargarTipos()
    } catch (e) {
      setErrorTipo(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoTipo(false)
    }
  }

  const eliminarTipo = async (t: TipoParametro) => {
    if (!confirm(`¿Eliminar el tipo "${t.nombre}"?`)) return
    try {
      await datosBasicosApi.eliminarTipo(t.categoria_parametro, t.tipo_parametro)
      cargarTipos()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const toggleActivoTipo = async (t: TipoParametro) => {
    try {
      await datosBasicosApi.actualizarTipo(t.categoria_parametro, t.tipo_parametro, { activo: !t.activo })
      cargarTipos()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── Filtro tipos ───────────────────────────────────────────────────────────
  const tiposFiltrados = filtroCat
    ? tipos.filter((t) => t.categoria_parametro === filtroCat)
    : tipos

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold text-texto">Datos Básicos</h2>
        <p className="text-sm text-texto-muted mt-1">Configuración de categorías y tipos de parámetros del sistema</p>
      </div>

      {/* Pestañas principales */}
      <div className="flex border-b border-borde gap-1">
        <button
          onClick={() => setTabActiva('categorias')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'categorias'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          Categorías de Parámetros
        </button>
        <button
          onClick={() => setTabActiva('tipos')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tabActiva === 'tipos'
              ? 'border-b-2 border-primario text-primario'
              : 'text-texto-muted hover:text-texto'
          }`}
        >
          Tipos de Parámetros
        </button>
      </div>

      {/* ── Tab: Categorías ── */}
      {tabActiva === 'categorias' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">
              Define las categorías que agrupan los parámetros (ej: MENSAJERIA_EMAIL, SEGURIDAD, etc.)
            </p>
            <Boton variante="primario" onClick={abrirNuevaCat}>
              <Plus size={16} />
              Nueva categoría
            </Boton>
          </div>

          {cargandoCat ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
              ))}
            </div>
          ) : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Código</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Descripción</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {categorias.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>
                      No hay categorías registradas
                    </TablaTd>
                  </TablaFila>
                ) : (
                  categorias.map((c) => (
                    <TablaFila key={c.categoria_parametro}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {c.categoria_parametro}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{c.nombre}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">
                        {c.descripcion || <span className="text-texto-light">—</span>}
                      </TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoCat(c)} title="Cambiar estado">
                          <Insignia variante={c.activo ? 'exito' : 'error'}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirEditarCat(c)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => eliminarCategoria(c)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))
                )}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* ── Tab: Tipos ── */}
      {tabActiva === 'tipos' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-texto-muted">Filtrar por categoría:</p>
              <select
                value={filtroCat}
                onChange={(e) => setFiltroCat(e.target.value)}
                className="rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.categoria_parametro} value={c.categoria_parametro}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Boton variante="primario" onClick={abrirNuevoTipo}>
              <Plus size={16} />
              Nuevo tipo
            </Boton>
          </div>

          {cargandoTipo ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
              ))}
            </div>
          ) : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Categoría</TablaTh>
                  <TablaTh>Código tipo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Descripción</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {tiposFiltrados.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={6 as never}>
                      No hay tipos registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  tiposFiltrados.map((t) => (
                    <TablaFila key={`${t.categoria_parametro}/${t.tipo_parametro}`}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {t.categoria_parametro}
                        </code>
                      </TablaTd>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {t.tipo_parametro}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{t.nombre}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">
                        {t.descripcion || <span className="text-texto-light">—</span>}
                      </TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoTipo(t)} title="Cambiar estado">
                          <Insignia variante={t.activo ? 'exito' : 'error'}>
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirEditarTipo(t)}
                            className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => eliminarTipo(t)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TablaTd>
                    </TablaFila>
                  ))
                )}
              </TablaCuerpo>
            </Tabla>
          )}
        </>
      )}

      {/* Modal Categoría */}
      <Modal
        abierto={modalCat}
        alCerrar={() => setModalCat(false)}
        titulo={catEditando ? 'Editar categoría' : 'Nueva categoría'}
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Código *"
            value={formCat.categoria_parametro}
            onChange={(e) => setFormCat({ ...formCat, categoria_parametro: e.target.value })}
            disabled={!!catEditando}
            placeholder="MENSAJERIA_EMAIL"
          />
          <Input
            etiqueta="Nombre *"
            value={formCat.nombre}
            onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })}
            placeholder="Mensajería por Email"
          />
          <Input
            etiqueta="Descripción"
            value={formCat.descripcion}
            onChange={(e) => setFormCat({ ...formCat, descripcion: e.target.value })}
            placeholder="Descripción opcional"
          />

          {errorCat && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorCat}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalCat(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardarCategoria} cargando={guardandoCat}>
              {catEditando ? 'Guardar cambios' : 'Crear categoría'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal Tipo */}
      <Modal
        abierto={modalTipo}
        alCerrar={() => setModalTipo(false)}
        titulo={tipoEditando ? 'Editar tipo' : 'Nuevo tipo de parámetro'}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Categoría *</label>
            <select
              value={formTipo.categoria_parametro}
              onChange={(e) => setFormTipo({ ...formTipo, categoria_parametro: e.target.value })}
              disabled={!!tipoEditando}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
            >
              <option value="">Seleccionar categoría...</option>
              {categorias.filter((c) => c.activo).map((c) => (
                <option key={c.categoria_parametro} value={c.categoria_parametro}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <Input
            etiqueta="Código tipo *"
            value={formTipo.tipo_parametro}
            onChange={(e) => setFormTipo({ ...formTipo, tipo_parametro: e.target.value })}
            disabled={!!tipoEditando}
            placeholder="SMTP_HOST"
          />
          <Input
            etiqueta="Nombre *"
            value={formTipo.nombre}
            onChange={(e) => setFormTipo({ ...formTipo, nombre: e.target.value })}
            placeholder="Servidor SMTP"
          />
          <Input
            etiqueta="Descripción"
            value={formTipo.descripcion}
            onChange={(e) => setFormTipo({ ...formTipo, descripcion: e.target.value })}
            placeholder="Descripción opcional"
          />

          {errorTipo && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorTipo}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalTipo(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardarTipo} cargando={guardandoTipo}>
              {tipoEditando ? 'Guardar cambios' : 'Crear tipo'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
