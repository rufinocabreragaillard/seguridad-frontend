'use client'

import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Mail, MessageSquare, Smartphone, Send, Plus, Pencil, Trash2, Play, RefreshCw } from 'lucide-react'

import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Paginador } from '@/components/ui/paginador'
import {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaFila,
  TablaTh,
  TablaTd,
} from '@/components/ui/tabla'
import { Insignia } from '@/components/ui/insignia'
import { useToast } from '@/context/ToastContext'
import { usePaginacion } from '@/hooks/usePaginacion'
import {
  mensajeriaApi,
  type CanalMensajeria,
  type LogMensaje,
  type LogMensajePaginadoResp,
  type PlantillaMensaje,
  type PlantillaProbarResp,
} from '@/lib/api'

type Tab = 'plantillas' | 'canales' | 'historial'

const TIPOS_DISPARO = ['', 'PRIMER_LOGIN', 'CONDICION_SQL', 'EVENTO', 'FECHA_RELATIVA'] as const
const FRECUENCIAS = ['', 'UNA_VEZ', 'CADA_LOGIN_HASTA_VISTO', 'DIARIA_HASTA_VISTO'] as const
const ESTADOS = [
  '', 'PENDIENTE', 'ENVIADO', 'ENTREGADO', 'VISTO', 'ACEPTADO', 'RECHAZADO', 'ERROR',
] as const

function iconoCanal(codigo: string) {
  if (codigo === 'EMAIL') return <Mail size={14} />
  if (codigo === 'SMS' || codigo === 'WHATSAPP' || codigo === 'TELEGRAM') return <Smartphone size={14} />
  return <MessageSquare size={14} />
}

export default function PaginaMensajeria() {
  const [tab, setTab] = useState<Tab>('plantillas')

  return (
    <div className="space-y-4">
      <h2 className="page-heading">Mensajería</h2>

      <div className="flex gap-1 border-b border-borde">
        {(['plantillas', 'canales', 'historial'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-primario text-primario'
                : 'text-texto-muted hover:text-texto'
            }`}
          >
            {t === 'plantillas' ? 'Plantillas' : t === 'canales' ? 'Canales' : 'Historial'}
          </button>
        ))}
      </div>

      {tab === 'plantillas' && <TabPlantillas />}
      {tab === 'canales' && <TabCanales />}
      {tab === 'historial' && <TabHistorial />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB PLANTILLAS
// ════════════════════════════════════════════════════════════════════════════

function TabPlantillas() {
  const toast = useToast()
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([])
  const [canales, setCanales] = useState<CanalMensajeria[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroCanal, setFiltroCanal] = useState('')
  const [filtroDisparo, setFiltroDisparo] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [editando, setEditando] = useState<Partial<PlantillaMensaje> | null>(null)
  const [modoCrear, setModoCrear] = useState(false)
  const [aEliminar, setAEliminar] = useState<PlantillaMensaje | null>(null)
  const [previsualizacion, setPrevisualizacion] = useState<PlantillaProbarResp | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [pls, chs] = await Promise.all([
        mensajeriaApi.listarPlantillas({
          codigo_canal: filtroCanal || undefined,
          tipo_disparo: filtroDisparo || undefined,
          q: busqueda || undefined,
        }),
        mensajeriaApi.listarCanales(),
      ])
      setPlantillas(pls)
      setCanales(chs)
    } catch (e) {
      toast.error('Error al cargar', e instanceof Error ? e.message : undefined)
    } finally {
      setCargando(false)
    }
  }, [filtroCanal, filtroDisparo, busqueda, toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  const abrirCrear = () => {
    setModoCrear(true)
    setEditando({
      codigo_plantilla: '',
      codigo_canal: 'CHAT',
      tipo_evento: '',
      cuerpo: '',
      tipo_disparo: 'PRIMER_LOGIN',
      frecuencia: 'UNA_VEZ',
      prioridad: 100,
      requiere_accion: false,
    })
    setPrevisualizacion(null)
  }

  const abrirEditar = (p: PlantillaMensaje) => {
    setModoCrear(false)
    setEditando({ ...p })
    setPrevisualizacion(null)
  }

  const guardar = async () => {
    if (!editando) return
    setEnviando(true)
    try {
      if (modoCrear) {
        if (!editando.codigo_plantilla || !editando.codigo_canal || !editando.tipo_evento || !editando.cuerpo) {
          toast.error('Faltan campos', 'Código, canal, tipo de evento y cuerpo son requeridos.')
          setEnviando(false)
          return
        }
        await mensajeriaApi.crearPlantilla(editando)
        toast.success('Plantilla creada')
      } else if (editando.codigo_plantilla) {
        const { codigo_plantilla, ...datos } = editando
        await mensajeriaApi.actualizarPlantilla(codigo_plantilla, datos)
        toast.success('Plantilla actualizada')
      }
      setEditando(null)
      cargar()
    } catch (e) {
      toast.error('Error al guardar', e instanceof Error ? e.message : undefined)
    } finally {
      setEnviando(false)
    }
  }

  const eliminar = async () => {
    if (!aEliminar) return
    try {
      await mensajeriaApi.eliminarPlantilla(aEliminar.codigo_plantilla)
      toast.success('Plantilla eliminada')
      setAEliminar(null)
      cargar()
    } catch (e) {
      toast.error('Error al eliminar', e instanceof Error ? e.message : undefined)
    }
  }

  const probar = async () => {
    if (!editando?.codigo_plantilla || modoCrear) {
      toast.error('Guarda la plantilla primero', 'No se puede probar una plantilla aún no creada.')
      return
    }
    setEnviando(true)
    try {
      const r = await mensajeriaApi.probarPlantilla(editando.codigo_plantilla)
      setPrevisualizacion(r)
    } catch (e) {
      toast.error('Error al probar', e instanceof Error ? e.message : undefined)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar por código, evento o asunto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={filtroCanal}
          onChange={(e) => setFiltroCanal(e.target.value)}
          className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm"
        >
          <option value="">Todos los canales</option>
          {canales.map((c) => (
            <option key={c.codigo_canal} value={c.codigo_canal}>{c.nombre_canal}</option>
          ))}
        </select>
        <select
          value={filtroDisparo}
          onChange={(e) => setFiltroDisparo(e.target.value)}
          className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm"
        >
          {TIPOS_DISPARO.map((t) => (
            <option key={t} value={t}>{t || 'Todos los disparadores'}</option>
          ))}
        </select>

        <div className="flex-1" />
        <Boton variante="primario" onClick={abrirCrear}>
          <Plus size={14} className="mr-1" /> Nueva plantilla
        </Boton>
      </div>

      {/* Tabla */}
      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaTh>Código</TablaTh>
            <TablaTh>Canal</TablaTh>
            <TablaTh>Evento</TablaTh>
            <TablaTh>Asunto</TablaTh>
            <TablaTh>Disparo</TablaTh>
            <TablaTh>Frecuencia</TablaTh>
            <TablaTh>Prioridad</TablaTh>
            <TablaTh>Acciones</TablaTh>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila><TablaTd colSpan={8} className="text-center text-texto-muted">Cargando...</TablaTd></TablaFila>
          ) : plantillas.length === 0 ? (
            <TablaFila><TablaTd colSpan={8} className="text-center text-texto-muted">Sin plantillas</TablaTd></TablaFila>
          ) : plantillas.map((p) => (
            <TablaFila key={p.codigo_plantilla}>
              <TablaTd className="font-medium">{p.codigo_plantilla}</TablaTd>
              <TablaTd>
                <span className="inline-flex items-center gap-1">
                  {iconoCanal(p.codigo_canal)} {p.codigo_canal}
                </span>
              </TablaTd>
              <TablaTd>{p.tipo_evento}</TablaTd>
              <TablaTd className="max-w-xs truncate">{p.asunto || '—'}</TablaTd>
              <TablaTd>{p.tipo_disparo || '—'}</TablaTd>
              <TablaTd>{p.frecuencia || '—'}</TablaTd>
              <TablaTd>{p.prioridad}</TablaTd>
              <TablaTd>
                <div className="flex gap-1">
                  <Boton variante="contorno" tamano="sm" onClick={() => abrirEditar(p)}>
                    <Pencil size={14} />
                  </Boton>
                  <Boton variante="contorno" tamano="sm" onClick={() => setAEliminar(p)}>
                    <Trash2 size={14} />
                  </Boton>
                </div>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      {/* Modal edicion / creacion */}
      {editando && (
        <Modal
          abierto={true}
          alCerrar={() => setEditando(null)}
          titulo={modoCrear ? 'Nueva plantilla' : `Editar: ${editando.codigo_plantilla}`}
          className="max-w-3xl"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-texto-muted">Código</label>
              <Input
                value={editando.codigo_plantilla || ''}
                onChange={(e) => setEditando({ ...editando, codigo_plantilla: e.target.value.toUpperCase() })}
                disabled={!modoCrear}
              />
            </div>
            <div>
              <label className="text-xs text-texto-muted">Canal</label>
              <select
                value={editando.codigo_canal || ''}
                onChange={(e) => setEditando({ ...editando, codigo_canal: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm"
              >
                {canales.map((c) => (
                  <option key={c.codigo_canal} value={c.codigo_canal}>{c.nombre_canal}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-texto-muted">Tipo de evento</label>
              <Input
                value={editando.tipo_evento || ''}
                onChange={(e) => setEditando({ ...editando, tipo_evento: e.target.value.toUpperCase() })}
                placeholder="BIENVENIDA, VENCE_PRUEBA..."
              />
            </div>
            <div>
              <label className="text-xs text-texto-muted">Asunto</label>
              <Input
                value={editando.asunto || ''}
                onChange={(e) => setEditando({ ...editando, asunto: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-texto-muted">Cuerpo (texto fijo, soporta markdown y placeholders {`{nombre_usuario}`}, {`{codigo_grupo}`}...)</label>
              <textarea
                value={editando.cuerpo || ''}
                onChange={(e) => setEditando({ ...editando, cuerpo: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm font-mono"
                rows={5}
              />
            </div>

            <div>
              <label className="text-xs text-texto-muted">Tipo de disparo</label>
              <select
                value={editando.tipo_disparo || ''}
                onChange={(e) => setEditando({ ...editando, tipo_disparo: e.target.value || null })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm"
              >
                {TIPOS_DISPARO.map((t) => (
                  <option key={t} value={t}>{t || '— sin definir —'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-texto-muted">Frecuencia</label>
              <select
                value={editando.frecuencia || ''}
                onChange={(e) => setEditando({ ...editando, frecuencia: e.target.value || null })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm"
              >
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>{f || '— sin definir —'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-texto-muted">Prioridad (menor = primero)</label>
              <Input
                type="number"
                value={editando.prioridad ?? 100}
                onChange={(e) => setEditando({ ...editando, prioridad: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editando.requiere_accion ?? false}
                  onChange={(e) => setEditando({ ...editando, requiere_accion: e.target.checked })}
                />
                <span className="text-sm">Requiere acción del usuario</span>
              </label>
            </div>

            <div className="col-span-2 border-t border-borde pt-3 mt-2">
              <p className="text-xs text-texto-muted mb-2">
                <strong>Generación via LLM (opcional):</strong> si llenas <code>system_prompt</code> + <code>prompt_insert</code> + un modelo,
                el motor genera el cuerpo con LLM al disparar.
              </p>
              <label className="text-xs text-texto-muted">System prompt</label>
              <textarea
                value={editando.system_prompt || ''}
                onChange={(e) => setEditando({ ...editando, system_prompt: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm font-mono"
                rows={3}
              />
              <label className="text-xs text-texto-muted mt-2 block">Prompt insert</label>
              <textarea
                value={editando.prompt_insert || ''}
                onChange={(e) => setEditando({ ...editando, prompt_insert: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm font-mono"
                rows={3}
              />
              <label className="text-xs text-texto-muted mt-2 block">id_modelo (registro_llm)</label>
              <Input
                type="number"
                value={editando.id_modelo ?? ''}
                onChange={(e) => setEditando({ ...editando, id_modelo: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          {/* Probador */}
          {!modoCrear && (
            <div className="border-t border-borde mt-4 pt-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold">Probar</h3>
                <Boton variante="contorno" tamano="sm" onClick={probar} disabled={enviando}>
                  <Play size={14} className="mr-1" /> Generar preview
                </Boton>
              </div>
              {previsualizacion && (
                <div className="bg-fondo rounded-lg p-3 border border-borde">
                  {previsualizacion.asunto && (
                    <div className="text-xs text-texto-muted mb-1">
                      Asunto: <span className="text-texto font-medium">{previsualizacion.asunto}</span>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none text-texto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{previsualizacion.cuerpo}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-borde">
            <Boton variante="secundario" onClick={() => setEditando(null)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardar} disabled={enviando}>
              <Send size={14} className="mr-1" /> {modoCrear ? 'Crear' : 'Guardar'}
            </Boton>
          </div>
        </Modal>
      )}

      {/* Confirmar eliminacion */}
      {aEliminar && (
        <ModalConfirmar
          abierto={true}
          alCerrar={() => setAEliminar(null)}
          alConfirmar={eliminar}
          titulo="Eliminar plantilla"
          mensaje={`¿Eliminar plantilla "${aEliminar.codigo_plantilla}"? El historial de envíos quedará huérfano.`}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB CANALES
// ════════════════════════════════════════════════════════════════════════════

function TabCanales() {
  const toast = useToast()
  const [canales, setCanales] = useState<CanalMensajeria[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<CanalMensajeria | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setCanales(await mensajeriaApi.listarCanales())
    } catch (e) {
      toast.error('Error al cargar', e instanceof Error ? e.message : undefined)
    } finally {
      setCargando(false)
    }
  }, [toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = async () => {
    if (!editando) return
    setEnviando(true)
    try {
      await mensajeriaApi.actualizarCanal(editando.codigo_canal, {
        nombre_canal: editando.nombre_canal,
        soporta_salida: editando.soporta_salida,
        soporta_entrada: editando.soporta_entrada,
        prompt_insert: editando.prompt_insert,
        system_prompt: editando.system_prompt,
      })
      toast.success('Canal actualizado')
      setEditando(null)
      cargar()
    } catch (e) {
      toast.error('Error al guardar', e instanceof Error ? e.message : undefined)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3">
      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaTh>Código</TablaTh>
            <TablaTh>Nombre</TablaTh>
            <TablaTh>Soporta salida</TablaTh>
            <TablaTh>Soporta entrada</TablaTh>
            <TablaTh>Acciones</TablaTh>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila><TablaTd colSpan={5} className="text-center text-texto-muted">Cargando...</TablaTd></TablaFila>
          ) : canales.map((c) => (
            <TablaFila key={c.codigo_canal}>
              <TablaTd className="font-medium">
                <span className="inline-flex items-center gap-1">{iconoCanal(c.codigo_canal)} {c.codigo_canal}</span>
              </TablaTd>
              <TablaTd>{c.nombre_canal}</TablaTd>
              <TablaTd>
                <Insignia variante={c.soporta_salida ? 'exito' : 'neutro'}>
                  {c.soporta_salida ? 'Sí' : 'No'}
                </Insignia>
              </TablaTd>
              <TablaTd>
                <Insignia variante={c.soporta_entrada ? 'exito' : 'neutro'}>
                  {c.soporta_entrada ? 'Sí' : 'No'}
                </Insignia>
              </TablaTd>
              <TablaTd>
                <Boton variante="contorno" tamano="sm" onClick={() => setEditando({ ...c })}>
                  <Pencil size={14} />
                </Boton>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      {editando && (
        <Modal
          abierto={true}
          alCerrar={() => setEditando(null)}
          titulo={`Editar canal: ${editando.codigo_canal}`}
          className="max-w-2xl"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-texto-muted">Nombre</label>
              <Input
                value={editando.nombre_canal}
                onChange={(e) => setEditando({ ...editando, nombre_canal: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editando.soporta_salida}
                onChange={(e) => setEditando({ ...editando, soporta_salida: e.target.checked })}
              />
              <span className="text-sm">Soporta envío (salida)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editando.soporta_entrada}
                onChange={(e) => setEditando({ ...editando, soporta_entrada: e.target.checked })}
              />
              <span className="text-sm">Soporta recepción (entrada)</span>
            </label>
            <div className="col-span-2">
              <label className="text-xs text-texto-muted">System prompt común al canal</label>
              <textarea
                value={editando.system_prompt || ''}
                onChange={(e) => setEditando({ ...editando, system_prompt: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm font-mono"
                rows={3}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-texto-muted">Prompt insert común al canal</label>
              <textarea
                value={editando.prompt_insert || ''}
                onChange={(e) => setEditando({ ...editando, prompt_insert: e.target.value })}
                className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm font-mono"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-borde">
            <Boton variante="secundario" onClick={() => setEditando(null)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardar} disabled={enviando}>
              Guardar
            </Boton>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB HISTORIAL
// ════════════════════════════════════════════════════════════════════════════

function TabHistorial() {
  const toast = useToast()
  const [filtroCanal, setFiltroCanal] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<LogMensaje | null>(null)
  const [canales, setCanales] = useState<CanalMensajeria[]>([])

  useEffect(() => {
    mensajeriaApi.listarCanales().then(setCanales).catch(() => {})
  }, [])

  const filtros = {
    codigo_canal: filtroCanal || undefined,
    estado: filtroEstado || undefined,
    codigo_usuario: filtroUsuario || undefined,
    q: busqueda || undefined,
  }

  const fetcher = useCallback(
    async (p: { page: number; limit: number } & typeof filtros): Promise<LogMensajePaginadoResp> => {
      try {
        return await mensajeriaApi.listarLogPaginado(p)
      } catch (e) {
        toast.error('Error al cargar historial', e instanceof Error ? e.message : undefined)
        throw e
      }
    },
    [toast],
  )

  const {
    items, total, page, limit, cargando, setPage, setLimit, refetch,
  } = usePaginacion<LogMensaje, typeof filtros>({
    fetcher,
    filtros,
    limitInicial: 15,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar en asunto, cuerpo o destino..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={filtroCanal}
          onChange={(e) => setFiltroCanal(e.target.value)}
          className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm"
        >
          <option value="">Todos los canales</option>
          {canales.map((c) => (
            <option key={c.codigo_canal} value={c.codigo_canal}>{c.nombre_canal}</option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-borde bg-surface px-3 py-2 text-sm"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e || 'Todos los estados'}</option>
          ))}
        </select>
        <Input
          placeholder="Usuario..."
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="max-w-xs"
        />
        <Boton variante="contorno" tamano="sm" onClick={refetch} disabled={cargando}>
          <RefreshCw size={14} />
        </Boton>
      </div>

      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaTh>Fecha</TablaTh>
            <TablaTh>Canal</TablaTh>
            <TablaTh>Plantilla</TablaTh>
            <TablaTh>Usuario</TablaTh>
            <TablaTh>Asunto</TablaTh>
            <TablaTh>Estado</TablaTh>
            <TablaTh>Ver</TablaTh>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila><TablaTd colSpan={7} className="text-center text-texto-muted">Cargando...</TablaTd></TablaFila>
          ) : items.length === 0 ? (
            <TablaFila><TablaTd colSpan={7} className="text-center text-texto-muted">Sin envíos</TablaTd></TablaFila>
          ) : items.map((m) => (
            <TablaFila key={m.id_mensaje}>
              <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                {new Date(m.fecha_hora).toLocaleString('es-CL')}
              </TablaTd>
              <TablaTd>
                <span className="inline-flex items-center gap-1">{iconoCanal(m.codigo_canal)} {m.codigo_canal}</span>
              </TablaTd>
              <TablaTd>{m.codigo_plantilla || '—'}</TablaTd>
              <TablaTd className="text-xs">{m.codigo_usuario || m.origen_destino || '—'}</TablaTd>
              <TablaTd className="max-w-xs truncate">{m.asunto || '—'}</TablaTd>
              <TablaTd>
                <Insignia variante={
                  m.estado === 'ERROR' ? 'error'
                  : m.estado === 'VISTO' || m.estado === 'ACEPTADO' || m.estado === 'ENTREGADO' ? 'exito'
                  : m.estado === 'RECHAZADO' ? 'advertencia'
                  : 'neutro'
                }>
                  {m.estado}
                </Insignia>
              </TablaTd>
              <TablaTd>
                <Boton variante="contorno" tamano="sm" onClick={() => setSeleccionado(m)}>
                  Detalle
                </Boton>
              </TablaTd>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>

      <Paginador
        page={page}
        limit={limit}
        total={total}
        onChangePage={setPage}
        onChangeLimit={setLimit}
        cargando={cargando}
        opcionesLimit={[15, 30, 50, 100]}
      />

      {seleccionado && (
        <Modal
          abierto={true}
          alCerrar={() => setSeleccionado(null)}
          titulo={`Mensaje #${seleccionado.id_mensaje} — ${seleccionado.estado}`}
          className="max-w-3xl"
        >
          <div className="space-y-2 text-sm">
            <div><strong>Canal:</strong> {seleccionado.codigo_canal}</div>
            <div><strong>Plantilla:</strong> {seleccionado.codigo_plantilla || '—'}</div>
            <div><strong>Usuario:</strong> {seleccionado.codigo_usuario || '—'}</div>
            <div><strong>Destino:</strong> {seleccionado.origen_destino || '—'}</div>
            <div><strong>Fecha:</strong> {new Date(seleccionado.fecha_hora).toLocaleString('es-CL')}</div>
            {seleccionado.asunto && <div><strong>Asunto:</strong> {seleccionado.asunto}</div>}
            {seleccionado.mensaje_error && (
              <div className="bg-red-50 text-red-700 rounded-lg p-3">
                <strong>Error:</strong> {seleccionado.mensaje_error}
              </div>
            )}
            <div className="border-t border-borde pt-2 mt-2">
              <strong>Cuerpo:</strong>
              <div className="bg-fondo rounded-lg p-3 mt-1 prose prose-sm max-w-none text-texto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {seleccionado.cuerpo || ''}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
