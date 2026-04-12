'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Download, Search, ArrowUp, ArrowDown } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { aplicacionesApi, funcionesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Aplicacion, Funcion } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'

type AppDeFuncion = { codigo_aplicacion: string; aplicaciones?: { nombre_aplicacion: string } }

export default function PaginaFunciones() {
  const { grupoActivo, aplicacionActiva } = useAuth()
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // ── Modal Funcion ─────────────────────────────────────────────────────────
  const [modalFuncion, setModalFuncion] = useState(false)
  const [funcionEditando, setFuncionEditando] = useState<Funcion | null>(null)
  const [formFuncion, setFormFuncion] = useState<{ codigo_funcion: string; nombre: string; descripcion: string; url_funcion: string; alias_de_funcion: string; icono_de_funcion: string; codigo_aplicacion_origen: string }>({ codigo_funcion: '', nombre: '', descripcion: '', url_funcion: '', alias_de_funcion: '', icono_de_funcion: '', codigo_aplicacion_origen: '' })
  const [tabModalFuncion, setTabModalFuncion] = useState<'datos' | 'aplicaciones'>('datos')
  const [guardandoFuncion, setGuardandoFuncion] = useState(false)
  const [errorFuncion, setErrorFuncion] = useState('')

  // Aplicaciones de la funcion
  const [appsDeFuncion, setAppsDeFuncion] = useState<AppDeFuncion[]>([])
  const [cargandoAppsFuncion, setCargandoAppsFuncion] = useState(false)
  const [appNuevaFuncion, setAppNuevaFuncion] = useState('')
  const [asignandoAppFuncion, setAsignandoAppFuncion] = useState(false)

  // Confirmar eliminacion
  const [confirmacion, setConfirmacion] = useState<Funcion | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const selectClass = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario'

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [a, f] = await Promise.all([aplicacionesApi.listar(), funcionesApi.listar()])
      setAplicaciones(a)
      setFunciones(f)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Funcion: CRUD ─────────────────────────────────────────────────────────
  const abrirNuevaFuncion = () => {
    setFuncionEditando(null); setFormFuncion({ codigo_funcion: '', nombre: '', descripcion: '', url_funcion: '', alias_de_funcion: '', icono_de_funcion: '', codigo_aplicacion_origen: aplicacionActiva || '' })
    setErrorFuncion(''); setTabModalFuncion('datos'); setModalFuncion(true)
  }
  const abrirEditarFuncion = (f: Funcion) => {
    setFuncionEditando(f); setFormFuncion({ codigo_funcion: f.codigo_funcion, nombre: f.nombre, descripcion: f.descripcion || '', url_funcion: f.url_funcion || '', alias_de_funcion: f.alias_de_funcion || '', icono_de_funcion: f.icono_de_funcion || '', codigo_aplicacion_origen: f.codigo_aplicacion_origen || '' })
    setErrorFuncion(''); setTabModalFuncion('datos'); cargarAppsDeFuncion(f.codigo_funcion); setModalFuncion(true)
  }
  const guardarFuncion = async () => {
    if (!formFuncion.nombre) { setErrorFuncion('El nombre es obligatorio'); return }
    setGuardandoFuncion(true)
    try {
      const payloadOrigen = formFuncion.codigo_aplicacion_origen || null
      if (funcionEditando) {
        await funcionesApi.actualizar(funcionEditando.codigo_funcion, { nombre: formFuncion.nombre, descripcion: formFuncion.descripcion, url_funcion: formFuncion.url_funcion, alias_de_funcion: formFuncion.alias_de_funcion, icono_de_funcion: formFuncion.icono_de_funcion || undefined, codigo_aplicacion_origen: payloadOrigen })
      } else {
        const { codigo_funcion: cf, ...rest } = formFuncion
        await funcionesApi.crear({ ...(cf ? { codigo_funcion: cf } : {}), ...rest, codigo_aplicacion_origen: payloadOrigen })
      }
      setModalFuncion(false); cargar()
    } catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') }
    finally { setGuardandoFuncion(false) }
  }

  // ── Funcion: aplicaciones ─────────────────────────────────────────────────
  const cargarAppsDeFuncion = useCallback(async (c: string) => {
    setCargandoAppsFuncion(true)
    try { setAppsDeFuncion(await funcionesApi.listarAplicaciones(c)) } catch { setAppsDeFuncion([]) }
    finally { setCargandoAppsFuncion(false) }
  }, [])

  const asignarAppAFuncion = async () => {
    if (!appNuevaFuncion || !funcionEditando) return; setAsignandoAppFuncion(true)
    try { await funcionesApi.asignarAplicacion(funcionEditando.codigo_funcion, appNuevaFuncion); setAppNuevaFuncion(''); cargarAppsDeFuncion(funcionEditando.codigo_funcion) }
    catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') } finally { setAsignandoAppFuncion(false) }
  }
  const quitarAppDeFuncion = async (c: string) => {
    if (!funcionEditando) return
    try { await funcionesApi.quitarAplicacion(funcionEditando.codigo_funcion, c); cargarAppsDeFuncion(funcionEditando.codigo_funcion) }
    catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error') }
  }

  // ── Eliminacion ───────────────────────────────────────────────────────────
  const ejecutarEliminacion = async () => {
    if (!confirmacion) return; setEliminando(true)
    try {
      await funcionesApi.eliminar(confirmacion.codigo_funcion)
      setConfirmacion(null); cargar()
    } catch (e) { setErrorFuncion(e instanceof Error ? e.message : 'Error'); setConfirmacion(null) }
    finally { setEliminando(false) }
  }

  // ── Mover función (reordenar) ──────────────────────────────────────────────
  const moverFuncionGlobal = async (index: number, direccion: 'arriba' | 'abajo') => {
    const lista = [...funciones]
    const swap = direccion === 'arriba' ? index - 1 : index + 1
    if (swap < 0 || swap >= lista.length) return
    const a = lista[index].orden ?? 0
    const b = lista[swap].orden ?? 0
    lista[index] = { ...lista[index], orden: b }
    lista[swap] = { ...lista[swap], orden: a }
    ;[lista[index], lista[swap]] = [lista[swap], lista[index]]
    setFunciones(lista)
    try {
      await funcionesApi.reordenar(
        lista.map((f) => ({ codigo_funcion: f.codigo_funcion, orden: f.orden ?? 0 })),
      )
    } catch {
      cargar()
    }
  }

  // ── Listas derivadas ──────────────────────────────────────────────────────
  const appsDisponiblesFuncion = aplicaciones.filter((a) => !appsDeFuncion.some((af) => af.codigo_aplicacion === a.codigo_aplicacion))
  const mapaAppNombre = Object.fromEntries(aplicaciones.map((a) => [a.codigo_aplicacion, a.nombre]))
  const nombreApp = (codigo?: string | null) => (codigo ? (mapaAppNombre[codigo] || codigo) : '')

  // Funciones ya vienen ordenadas por `orden` del backend; solo filtrar por búsqueda
  const funcionesFiltradas = busqueda
    ? funciones.filter((f) => f.nombre.toLowerCase().includes(busqueda.toLowerCase()) || f.codigo_funcion.toLowerCase().includes(busqueda.toLowerCase()) || (f.alias_de_funcion || '').toLowerCase().includes(busqueda.toLowerCase()))
    : funciones

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-texto">Funciones</h2>
        <p className="text-sm text-texto-muted mt-1">Gestiona las funciones del sistema y sus relaciones con aplicaciones</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input placeholder="Buscar por nombre, codigo o alias..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} icono={<Search size={15} />} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Boton variante="contorno" tamano="sm" onClick={() => exportarExcel(funcionesFiltradas as unknown as Record<string, unknown>[], [{ titulo: 'Codigo', campo: 'codigo_funcion' }, { titulo: 'Alias', campo: 'alias_de_funcion' }, { titulo: 'Nombre', campo: 'nombre' }, { titulo: 'Tipo', campo: 'tipo' }, { titulo: 'Icono', campo: 'icono_de_funcion' }, { titulo: 'URL', campo: 'url_funcion' }], `funciones_${grupoActivo || 'todos'}`)} disabled={funcionesFiltradas.length === 0}><Download size={15} />Excel</Boton>
          <Boton variante="primario" onClick={abrirNuevaFuncion}><Plus size={16} />Nueva funcion</Boton>
        </div>
      </div>

      <Tabla>
        <TablaCabecera><tr><TablaTh className="w-14">Orden</TablaTh><TablaTh className="w-28">Tipo</TablaTh><TablaTh className="w-32">Alias</TablaTh><TablaTh>Nombre</TablaTh><TablaTh className="w-28">Icono</TablaTh><TablaTh className="w-40">URL</TablaTh><TablaTh className="w-40">Codigo</TablaTh><TablaTh className="text-right w-20">Acciones</TablaTh></tr></TablaCabecera>
        <TablaCuerpo>
          {cargando ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>Cargando...</TablaTd></TablaFila>
          ) : funcionesFiltradas.length === 0 ? (<TablaFila><TablaTd className="py-8 text-center text-texto-muted" colSpan={8 as never}>No se encontraron funciones</TablaTd></TablaFila>
          ) : funcionesFiltradas.map((f, idx) => (
            <TablaFila key={f.codigo_funcion}>
              <TablaTd>
                <div className="flex flex-col gap-0.5 items-center">
                  <button
                    type="button"
                    onClick={() => moverFuncionGlobal(idx, 'arriba')}
                    disabled={idx === 0 || !!busqueda}
                    className="text-texto-muted hover:text-primario disabled:opacity-30"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moverFuncionGlobal(idx, 'abajo')}
                    disabled={idx === funcionesFiltradas.length - 1 || !!busqueda}
                    className="text-texto-muted hover:text-primario disabled:opacity-30"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </TablaTd>
              <TablaTd>{f.tipo === 'RESTRINGIDA' ? <Insignia variante="error">Restringida</Insignia> : <Insignia variante="exito">Normal</Insignia>}</TablaTd>
              <TablaTd className="text-sm">{f.alias_de_funcion || '—'}</TablaTd>
              <TablaTd className="font-medium">{f.nombre}</TablaTd>
              <TablaTd className="text-texto-muted text-xs">{f.icono_de_funcion || '—'}</TablaTd>
              <TablaTd className="text-texto-muted text-xs">{f.url_funcion || '—'}</TablaTd>
              <TablaTd><code className="text-xs bg-fondo px-2 py-1 rounded font-mono">{f.codigo_funcion}</code></TablaTd>
              <TablaTd>
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => abrirEditarFuncion(f)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => setConfirmacion(f)} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      {/* ── MODAL FUNCION ── */}
      <Modal abierto={modalFuncion} alCerrar={() => setModalFuncion(false)} titulo={funcionEditando ? `Editar funcion: ${funcionEditando.nombre}` : 'Nueva funcion'} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {funcionEditando && (
            <div className="flex border-b border-borde -mx-1">
              <button onClick={() => setTabModalFuncion('datos')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'datos' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Datos</button>
              <button onClick={() => setTabModalFuncion('aplicaciones')} className={`px-4 py-2 text-sm font-medium transition-colors ${tabModalFuncion === 'aplicaciones' ? 'border-b-2 border-primario text-primario' : 'text-texto-muted hover:text-texto'}`}>Aplicaciones ({appsDeFuncion.length})</button>
            </div>
          )}
          {tabModalFuncion === 'datos' && (<>
            <Input etiqueta="Nombre *" value={formFuncion.nombre} onChange={(e) => setFormFuncion({ ...formFuncion, nombre: e.target.value })} placeholder="Gestion de usuarios" />
            <Input etiqueta="Alias *" value={formFuncion.alias_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, alias_de_funcion: e.target.value.substring(0, 40) })} placeholder="Usuarios" />
            <div>
              <label className="block text-sm font-medium text-texto mb-1">Aplicacion origen</label>
              <select value={formFuncion.codigo_aplicacion_origen} onChange={(e) => setFormFuncion({ ...formFuncion, codigo_aplicacion_origen: e.target.value })} className={selectClass}>
                <option value="">— sin asignar —</option>
                {[...aplicaciones].sort((a, b) => {
                  const ta = a.tipo === 'NORMAL' ? 0 : 1
                  const tb = b.tipo === 'NORMAL' ? 0 : 1
                  if (ta !== tb) return ta - tb
                  return a.nombre.localeCompare(b.nombre, 'es')
                }).map((a) => (
                  <option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>
                ))}
              </select>
            </div>
            <Input etiqueta="Icono" value={formFuncion.icono_de_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, icono_de_funcion: e.target.value })} placeholder="Users, Shield, Settings..." />
            <Textarea etiqueta="Descripcion" value={formFuncion.descripcion} onChange={(e) => setFormFuncion({ ...formFuncion, descripcion: e.target.value })} rows={3} />
            <Input etiqueta="URL funcion" value={formFuncion.url_funcion} onChange={(e) => setFormFuncion({ ...formFuncion, url_funcion: e.target.value })} placeholder="/usuarios" />
            {funcionEditando && (
              <Input etiqueta="Codigo" value={formFuncion.codigo_funcion} disabled readOnly />
            )}
            {errorFuncion && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-error">{errorFuncion}</p></div>}
            <div className="flex gap-3 justify-end pt-2"><Boton variante="contorno" onClick={() => setModalFuncion(false)}>Cancelar</Boton><Boton variante="primario" onClick={guardarFuncion} cargando={guardandoFuncion}>{funcionEditando ? 'Guardar' : 'Crear funcion'}</Boton></div>
          </>)}
          {tabModalFuncion === 'aplicaciones' && funcionEditando && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2"><div className="flex-1"><select value={appNuevaFuncion} onChange={(e) => setAppNuevaFuncion(e.target.value)} className={selectClass}><option value="">Seleccionar aplicacion...</option>{appsDisponiblesFuncion.map((a) => (<option key={a.codigo_aplicacion} value={a.codigo_aplicacion}>{a.nombre} ({a.codigo_aplicacion})</option>))}</select></div><Boton variante="primario" onClick={asignarAppAFuncion} cargando={asignandoAppFuncion} disabled={!appNuevaFuncion}><Plus size={14} />Asignar</Boton></div>
              {cargandoAppsFuncion ? <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-10 bg-surface rounded-lg border border-borde animate-pulse" />)}</div>
              : appsDeFuncion.length === 0 ? <p className="text-sm text-texto-muted text-center py-4">No tiene aplicaciones asignadas</p>
              : <div className="flex flex-col gap-2">{appsDeFuncion.map((af) => (<div key={af.codigo_aplicacion} className="flex items-center justify-between px-3 py-2 rounded-lg border border-borde bg-surface"><div><span className="text-sm font-medium text-texto">{af.aplicaciones?.nombre_aplicacion || af.codigo_aplicacion}</span><span className="ml-2 text-xs text-texto-muted">{af.codigo_aplicacion}</span></div><button onClick={() => quitarAppDeFuncion(af.codigo_aplicacion)} className="p-1 rounded hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Quitar"><X size={14} /></button></div>))}</div>}
              <div className="flex justify-end pt-2"><Boton variante="contorno" onClick={() => setModalFuncion(false)}>Cerrar</Boton></div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL CONFIRMAR ── */}
      <ModalConfirmar
        abierto={!!confirmacion}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={ejecutarEliminacion}
        titulo="Eliminar funcion"
        mensaje={confirmacion ? `¿Estas seguro de eliminar la funcion "${confirmacion.nombre}"? Se eliminaran todas las asignaciones.` : ''}
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </div>
  )
}
