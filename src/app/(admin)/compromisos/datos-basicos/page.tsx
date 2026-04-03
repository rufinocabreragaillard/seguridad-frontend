'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { compromisosDatosBasicosApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { exportarExcel } from '@/lib/exportar-excel'
import type {
  TipoConversacion,
  TipoCompromiso,
  EstadoConversacion,
  EstadoCompromiso,
  EstadoCanonicoConversacion,
  EstadoCanonicoCompromiso,
} from '@/lib/tipos'

type TabId =
  | 'tipos-conversacion'
  | 'estados-conversacion'
  | 'tipos-compromiso'
  | 'estados-compromiso'
  | 'canonicos-conversacion'
  | 'canonicos-compromiso'

export default function DatosBasicosCompromisosPage() {
  const { grupoActivo } = useAuth()
  const [tabActiva, setTabActiva] = useState<TabId>('tipos-conversacion')

  // ── Tipos Conversacion ─────────────────────────────────────────────────────
  const [tiposCnv, setTiposCnv] = useState<TipoConversacion[]>([])
  const [cargandoTiposCnv, setCargandoTiposCnv] = useState(true)
  const [modalTipoCnv, setModalTipoCnv] = useState(false)
  const [tipoCnvEditando, setTipoCnvEditando] = useState<TipoConversacion | null>(null)
  const [formTipoCnv, setFormTipoCnv] = useState({ codigo_tipo_conversacion: '', nombre: '', descripcion: '' })
  const [guardandoTipoCnv, setGuardandoTipoCnv] = useState(false)
  const [errorTipoCnv, setErrorTipoCnv] = useState('')

  // ── Estados Conversacion ───────────────────────────────────────────────────
  const [estadosCnv, setEstadosCnv] = useState<EstadoConversacion[]>([])
  const [cargandoEstadosCnv, setCargandoEstadosCnv] = useState(true)
  const [modalEstadoCnv, setModalEstadoCnv] = useState(false)
  const [estadoCnvEditando, setEstadoCnvEditando] = useState<EstadoConversacion | null>(null)
  const [formEstadoCnv, setFormEstadoCnv] = useState({ codigo_tipo_conversacion: '', codigo_estado_conversacion: '', nombre: '', codigo_estado_canonico: '', orden: 0 })
  const [guardandoEstadoCnv, setGuardandoEstadoCnv] = useState(false)
  const [errorEstadoCnv, setErrorEstadoCnv] = useState('')
  const [filtroTipoCnv, setFiltroTipoCnv] = useState('')

  // ── Tipos Compromiso ───────────────────────────────────────────────────────
  const [tiposCmp, setTiposCmp] = useState<TipoCompromiso[]>([])
  const [cargandoTiposCmp, setCargandoTiposCmp] = useState(true)
  const [modalTipoCmp, setModalTipoCmp] = useState(false)
  const [tipoCmpEditando, setTipoCmpEditando] = useState<TipoCompromiso | null>(null)
  const [formTipoCmp, setFormTipoCmp] = useState({ codigo_tipo_compromiso: '', nombre: '', descripcion: '' })
  const [guardandoTipoCmp, setGuardandoTipoCmp] = useState(false)
  const [errorTipoCmp, setErrorTipoCmp] = useState('')

  // ── Estados Compromiso ─────────────────────────────────────────────────────
  const [estadosCmp, setEstadosCmp] = useState<EstadoCompromiso[]>([])
  const [cargandoEstadosCmp, setCargandoEstadosCmp] = useState(true)
  const [modalEstadoCmp, setModalEstadoCmp] = useState(false)
  const [estadoCmpEditando, setEstadoCmpEditando] = useState<EstadoCompromiso | null>(null)
  const [formEstadoCmp, setFormEstadoCmp] = useState({ codigo_tipo_compromiso: '', codigo_estado_compromiso: '', nombre: '', codigo_estado_canonico: '', orden: 0 })
  const [guardandoEstadoCmp, setGuardandoEstadoCmp] = useState(false)
  const [errorEstadoCmp, setErrorEstadoCmp] = useState('')
  const [filtroTipoCmp, setFiltroTipoCmp] = useState('')

  // ── Canonicos Conversacion ─────────────────────────────────────────────────
  const [canonicosCnv, setCanonicosCnv] = useState<EstadoCanonicoConversacion[]>([])
  const [cargandoCanonicosCnv, setCargandoCanonicosCnv] = useState(true)
  const [modalCanCnv, setModalCanCnv] = useState(false)
  const [canCnvEditando, setCanCnvEditando] = useState<EstadoCanonicoConversacion | null>(null)
  const [formCanCnv, setFormCanCnv] = useState({ codigo_estado_canonico: '', nombre: '' })
  const [guardandoCanCnv, setGuardandoCanCnv] = useState(false)
  const [errorCanCnv, setErrorCanCnv] = useState('')

  // ── Canonicos Compromiso ───────────────────────────────────────────────────
  const [canonicosCmp, setCanonicosCmp] = useState<EstadoCanonicoCompromiso[]>([])
  const [cargandoCanonicosCmp, setCargandoCanonicosCmp] = useState(true)
  const [modalCanCmp, setModalCanCmp] = useState(false)
  const [canCmpEditando, setCanCmpEditando] = useState<EstadoCanonicoCompromiso | null>(null)
  const [formCanCmp, setFormCanCmp] = useState({ codigo_estado_canonico: '', nombre: '' })
  const [guardandoCanCmp, setGuardandoCanCmp] = useState(false)
  const [errorCanCmp, setErrorCanCmp] = useState('')

  // ── Eliminacion ────────────────────────────────────────────────────────────
  const [itemAEliminar, setItemAEliminar] = useState<{ tipo: string; item: Record<string, unknown> } | null>(null)
  const [eliminandoItem, setEliminandoItem] = useState(false)

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargarTiposCnv = useCallback(async () => {
    setCargandoTiposCnv(true)
    try { setTiposCnv(await compromisosDatosBasicosApi.listarTiposCnv()) } finally { setCargandoTiposCnv(false) }
  }, [])

  const cargarEstadosCnv = useCallback(async () => {
    setCargandoEstadosCnv(true)
    try { setEstadosCnv(await compromisosDatosBasicosApi.listarEstadosCnv(filtroTipoCnv || undefined)) } finally { setCargandoEstadosCnv(false) }
  }, [filtroTipoCnv])

  const cargarTiposCmp = useCallback(async () => {
    setCargandoTiposCmp(true)
    try { setTiposCmp(await compromisosDatosBasicosApi.listarTiposCmp()) } finally { setCargandoTiposCmp(false) }
  }, [])

  const cargarEstadosCmp = useCallback(async () => {
    setCargandoEstadosCmp(true)
    try { setEstadosCmp(await compromisosDatosBasicosApi.listarEstadosCmp(filtroTipoCmp || undefined)) } finally { setCargandoEstadosCmp(false) }
  }, [filtroTipoCmp])

  const cargarCanonicosCnv = useCallback(async () => {
    setCargandoCanonicosCnv(true)
    try { setCanonicosCnv(await compromisosDatosBasicosApi.listarCanonicosCnv()) } finally { setCargandoCanonicosCnv(false) }
  }, [])

  const cargarCanonicosCmp = useCallback(async () => {
    setCargandoCanonicosCmp(true)
    try { setCanonicosCmp(await compromisosDatosBasicosApi.listarCanonicosCmp()) } finally { setCargandoCanonicosCmp(false) }
  }, [])

  useEffect(() => { cargarTiposCnv() }, [cargarTiposCnv, grupoActivo])
  useEffect(() => { cargarEstadosCnv() }, [cargarEstadosCnv, grupoActivo])
  useEffect(() => { cargarTiposCmp() }, [cargarTiposCmp, grupoActivo])
  useEffect(() => { cargarEstadosCmp() }, [cargarEstadosCmp, grupoActivo])
  useEffect(() => { cargarCanonicosCnv() }, [cargarCanonicosCnv])
  useEffect(() => { cargarCanonicosCmp() }, [cargarCanonicosCmp])

  // ── CRUD Tipos Conversacion ────────────────────────────────────────────────
  const abrirNuevoTipoCnv = () => {
    setTipoCnvEditando(null)
    setFormTipoCnv({ codigo_tipo_conversacion: '', nombre: '', descripcion: '' })
    setErrorTipoCnv('')
    setModalTipoCnv(true)
  }

  const abrirEditarTipoCnv = (t: TipoConversacion) => {
    setTipoCnvEditando(t)
    setFormTipoCnv({ codigo_tipo_conversacion: t.codigo_tipo_conversacion, nombre: t.nombre, descripcion: t.descripcion || '' })
    setErrorTipoCnv('')
    setModalTipoCnv(true)
  }

  const guardarTipoCnv = async () => {
    if (!formTipoCnv.codigo_tipo_conversacion || !formTipoCnv.nombre) {
      setErrorTipoCnv('El codigo y el nombre son obligatorios')
      return
    }
    setGuardandoTipoCnv(true)
    setErrorTipoCnv('')
    try {
      if (tipoCnvEditando) {
        await compromisosDatosBasicosApi.actualizarTipoCnv(tipoCnvEditando.codigo_tipo_conversacion, {
          nombre: formTipoCnv.nombre,
          descripcion: formTipoCnv.descripcion || undefined,
        })
      } else {
        await compromisosDatosBasicosApi.crearTipoCnv({
          codigo_tipo_conversacion: formTipoCnv.codigo_tipo_conversacion.toUpperCase(),
          nombre: formTipoCnv.nombre,
          descripcion: formTipoCnv.descripcion || undefined,
        })
      }
      setModalTipoCnv(false)
      cargarTiposCnv()
    } catch (e) {
      setErrorTipoCnv(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoTipoCnv(false)
    }
  }

  const toggleActivoTipoCnv = async (t: TipoConversacion) => {
    try {
      await compromisosDatosBasicosApi.actualizarTipoCnv(t.codigo_tipo_conversacion, { activo: !t.activo })
      cargarTiposCnv()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Estados Conversacion ──────────────────────────────────────────────
  const abrirNuevoEstadoCnv = () => {
    setEstadoCnvEditando(null)
    setFormEstadoCnv({ codigo_tipo_conversacion: filtroTipoCnv, codigo_estado_conversacion: '', nombre: '', codigo_estado_canonico: '', orden: 0 })
    setErrorEstadoCnv('')
    setModalEstadoCnv(true)
  }

  const abrirEditarEstadoCnv = (e: EstadoConversacion) => {
    setEstadoCnvEditando(e)
    setFormEstadoCnv({
      codigo_tipo_conversacion: e.codigo_tipo_conversacion,
      codigo_estado_conversacion: e.codigo_estado_conversacion,
      nombre: e.nombre,
      codigo_estado_canonico: e.codigo_estado_canonico,
      orden: e.orden,
    })
    setErrorEstadoCnv('')
    setModalEstadoCnv(true)
  }

  const guardarEstadoCnv = async () => {
    if (!formEstadoCnv.codigo_tipo_conversacion || !formEstadoCnv.codigo_estado_conversacion || !formEstadoCnv.nombre || !formEstadoCnv.codigo_estado_canonico) {
      setErrorEstadoCnv('Tipo, codigo, nombre y estado canonico son obligatorios')
      return
    }
    setGuardandoEstadoCnv(true)
    setErrorEstadoCnv('')
    try {
      if (estadoCnvEditando) {
        await compromisosDatosBasicosApi.actualizarEstadoCnv(
          estadoCnvEditando.codigo_tipo_conversacion,
          estadoCnvEditando.codigo_estado_conversacion,
          {
            nombre: formEstadoCnv.nombre,
            codigo_estado_canonico: formEstadoCnv.codigo_estado_canonico,
            orden: formEstadoCnv.orden,
          }
        )
      } else {
        await compromisosDatosBasicosApi.crearEstadoCnv({
          codigo_tipo_conversacion: formEstadoCnv.codigo_tipo_conversacion,
          codigo_estado_conversacion: formEstadoCnv.codigo_estado_conversacion.toUpperCase(),
          nombre: formEstadoCnv.nombre,
          codigo_estado_canonico: formEstadoCnv.codigo_estado_canonico,
          orden: formEstadoCnv.orden,
        })
      }
      setModalEstadoCnv(false)
      cargarEstadosCnv()
    } catch (e) {
      setErrorEstadoCnv(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoEstadoCnv(false)
    }
  }

  const toggleActivoEstadoCnv = async (e: EstadoConversacion) => {
    try {
      await compromisosDatosBasicosApi.actualizarEstadoCnv(e.codigo_tipo_conversacion, e.codigo_estado_conversacion, { activo: !e.activo })
      cargarEstadosCnv()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Tipos Compromiso ──────────────────────────────────────────────────
  const abrirNuevoTipoCmp = () => {
    setTipoCmpEditando(null)
    setFormTipoCmp({ codigo_tipo_compromiso: '', nombre: '', descripcion: '' })
    setErrorTipoCmp('')
    setModalTipoCmp(true)
  }

  const abrirEditarTipoCmp = (t: TipoCompromiso) => {
    setTipoCmpEditando(t)
    setFormTipoCmp({ codigo_tipo_compromiso: t.codigo_tipo_compromiso, nombre: t.nombre, descripcion: t.descripcion || '' })
    setErrorTipoCmp('')
    setModalTipoCmp(true)
  }

  const guardarTipoCmp = async () => {
    if (!formTipoCmp.codigo_tipo_compromiso || !formTipoCmp.nombre) {
      setErrorTipoCmp('El codigo y el nombre son obligatorios')
      return
    }
    setGuardandoTipoCmp(true)
    setErrorTipoCmp('')
    try {
      if (tipoCmpEditando) {
        await compromisosDatosBasicosApi.actualizarTipoCmp(tipoCmpEditando.codigo_tipo_compromiso, {
          nombre: formTipoCmp.nombre,
          descripcion: formTipoCmp.descripcion || undefined,
        })
      } else {
        await compromisosDatosBasicosApi.crearTipoCmp({
          codigo_tipo_compromiso: formTipoCmp.codigo_tipo_compromiso.toUpperCase(),
          nombre: formTipoCmp.nombre,
          descripcion: formTipoCmp.descripcion || undefined,
        })
      }
      setModalTipoCmp(false)
      cargarTiposCmp()
    } catch (e) {
      setErrorTipoCmp(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoTipoCmp(false)
    }
  }

  const toggleActivoTipoCmp = async (t: TipoCompromiso) => {
    try {
      await compromisosDatosBasicosApi.actualizarTipoCmp(t.codigo_tipo_compromiso, { activo: !t.activo })
      cargarTiposCmp()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Estados Compromiso ────────────────────────────────────────────────
  const abrirNuevoEstadoCmp = () => {
    setEstadoCmpEditando(null)
    setFormEstadoCmp({ codigo_tipo_compromiso: filtroTipoCmp, codigo_estado_compromiso: '', nombre: '', codigo_estado_canonico: '', orden: 0 })
    setErrorEstadoCmp('')
    setModalEstadoCmp(true)
  }

  const abrirEditarEstadoCmp = (e: EstadoCompromiso) => {
    setEstadoCmpEditando(e)
    setFormEstadoCmp({
      codigo_tipo_compromiso: e.codigo_tipo_compromiso,
      codigo_estado_compromiso: e.codigo_estado_compromiso,
      nombre: e.nombre,
      codigo_estado_canonico: e.codigo_estado_canonico,
      orden: e.orden,
    })
    setErrorEstadoCmp('')
    setModalEstadoCmp(true)
  }

  const guardarEstadoCmp = async () => {
    if (!formEstadoCmp.codigo_tipo_compromiso || !formEstadoCmp.codigo_estado_compromiso || !formEstadoCmp.nombre || !formEstadoCmp.codigo_estado_canonico) {
      setErrorEstadoCmp('Tipo, codigo, nombre y estado canonico son obligatorios')
      return
    }
    setGuardandoEstadoCmp(true)
    setErrorEstadoCmp('')
    try {
      if (estadoCmpEditando) {
        await compromisosDatosBasicosApi.actualizarEstadoCmp(
          estadoCmpEditando.codigo_tipo_compromiso,
          estadoCmpEditando.codigo_estado_compromiso,
          {
            nombre: formEstadoCmp.nombre,
            codigo_estado_canonico: formEstadoCmp.codigo_estado_canonico,
            orden: formEstadoCmp.orden,
          }
        )
      } else {
        await compromisosDatosBasicosApi.crearEstadoCmp({
          codigo_tipo_compromiso: formEstadoCmp.codigo_tipo_compromiso,
          codigo_estado_compromiso: formEstadoCmp.codigo_estado_compromiso.toUpperCase(),
          nombre: formEstadoCmp.nombre,
          codigo_estado_canonico: formEstadoCmp.codigo_estado_canonico,
          orden: formEstadoCmp.orden,
        })
      }
      setModalEstadoCmp(false)
      cargarEstadosCmp()
    } catch (e) {
      setErrorEstadoCmp(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoEstadoCmp(false)
    }
  }

  const toggleActivoEstadoCmp = async (e: EstadoCompromiso) => {
    try {
      await compromisosDatosBasicosApi.actualizarEstadoCmp(e.codigo_tipo_compromiso, e.codigo_estado_compromiso, { activo: !e.activo })
      cargarEstadosCmp()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Canonicos Conversacion ────────────────────────────────────────────
  const abrirNuevoCanCnv = () => {
    setCanCnvEditando(null)
    setFormCanCnv({ codigo_estado_canonico: '', nombre: '' })
    setErrorCanCnv('')
    setModalCanCnv(true)
  }

  const abrirEditarCanCnv = (c: EstadoCanonicoConversacion) => {
    setCanCnvEditando(c)
    setFormCanCnv({ codigo_estado_canonico: c.codigo_estado_canonico, nombre: c.nombre })
    setErrorCanCnv('')
    setModalCanCnv(true)
  }

  const guardarCanCnv = async () => {
    if (!formCanCnv.codigo_estado_canonico || !formCanCnv.nombre) {
      setErrorCanCnv('El codigo y el nombre son obligatorios')
      return
    }
    setGuardandoCanCnv(true)
    setErrorCanCnv('')
    try {
      if (canCnvEditando) {
        await compromisosDatosBasicosApi.actualizarCanonicosCnv(canCnvEditando.codigo_estado_canonico, { nombre: formCanCnv.nombre })
      } else {
        await compromisosDatosBasicosApi.crearCanonicosCnv({
          codigo_estado_canonico: formCanCnv.codigo_estado_canonico.toUpperCase(),
          nombre: formCanCnv.nombre,
        })
      }
      setModalCanCnv(false)
      cargarCanonicosCnv()
    } catch (e) {
      setErrorCanCnv(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoCanCnv(false)
    }
  }

  const toggleActivoCanCnv = async (c: EstadoCanonicoConversacion) => {
    try {
      await compromisosDatosBasicosApi.actualizarCanonicosCnv(c.codigo_estado_canonico, { activo: !c.activo })
      cargarCanonicosCnv()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── CRUD Canonicos Compromiso ──────────────────────────────────────────────
  const abrirNuevoCanCmp = () => {
    setCanCmpEditando(null)
    setFormCanCmp({ codigo_estado_canonico: '', nombre: '' })
    setErrorCanCmp('')
    setModalCanCmp(true)
  }

  const abrirEditarCanCmp = (c: EstadoCanonicoCompromiso) => {
    setCanCmpEditando(c)
    setFormCanCmp({ codigo_estado_canonico: c.codigo_estado_canonico, nombre: c.nombre })
    setErrorCanCmp('')
    setModalCanCmp(true)
  }

  const guardarCanCmp = async () => {
    if (!formCanCmp.codigo_estado_canonico || !formCanCmp.nombre) {
      setErrorCanCmp('El codigo y el nombre son obligatorios')
      return
    }
    setGuardandoCanCmp(true)
    setErrorCanCmp('')
    try {
      if (canCmpEditando) {
        await compromisosDatosBasicosApi.actualizarCanonicosCmp(canCmpEditando.codigo_estado_canonico, { nombre: formCanCmp.nombre })
      } else {
        await compromisosDatosBasicosApi.crearCanonicosCmp({
          codigo_estado_canonico: formCanCmp.codigo_estado_canonico.toUpperCase(),
          nombre: formCanCmp.nombre,
        })
      }
      setModalCanCmp(false)
      cargarCanonicosCmp()
    } catch (e) {
      setErrorCanCmp(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardandoCanCmp(false)
    }
  }

  const toggleActivoCanCmp = async (c: EstadoCanonicoCompromiso) => {
    try {
      await compromisosDatosBasicosApi.actualizarCanonicosCmp(c.codigo_estado_canonico, { activo: !c.activo })
      cargarCanonicosCmp()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  // ── Eliminacion centralizada ───────────────────────────────────────────────
  const ejecutarEliminacion = async () => {
    if (!itemAEliminar) return
    setEliminandoItem(true)
    try {
      switch (itemAEliminar.tipo) {
        case 'tipo-cnv':
          await compromisosDatosBasicosApi.eliminarTipoCnv(itemAEliminar.item.codigo_tipo_conversacion as string)
          cargarTiposCnv()
          break
        case 'estado-cnv':
          await compromisosDatosBasicosApi.eliminarEstadoCnv(
            itemAEliminar.item.codigo_tipo_conversacion as string,
            itemAEliminar.item.codigo_estado_conversacion as string
          )
          cargarEstadosCnv()
          break
        case 'tipo-cmp':
          await compromisosDatosBasicosApi.eliminarTipoCmp(itemAEliminar.item.codigo_tipo_compromiso as string)
          cargarTiposCmp()
          break
        case 'estado-cmp':
          await compromisosDatosBasicosApi.eliminarEstadoCmp(
            itemAEliminar.item.codigo_tipo_compromiso as string,
            itemAEliminar.item.codigo_estado_compromiso as string
          )
          cargarEstadosCmp()
          break
        case 'can-cnv':
          await compromisosDatosBasicosApi.eliminarCanonicosCnv(itemAEliminar.item.codigo_estado_canonico as string)
          cargarCanonicosCnv()
          break
        case 'can-cmp':
          await compromisosDatosBasicosApi.eliminarCanonicosCmp(itemAEliminar.item.codigo_estado_canonico as string)
          cargarCanonicosCmp()
          break
      }
      setItemAEliminar(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
      setItemAEliminar(null)
    } finally {
      setEliminandoItem(false)
    }
  }

  // ── Skeleton ───────────────────────────────────────────────────────────────
  const skeleton = (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
      ))}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold text-texto">Datos Basicos - Compromisos</h2>
        <p className="text-sm text-texto-muted mt-1">Configuracion de tipos, estados y estados canonicos para conversaciones y compromisos</p>
      </div>

      {/* Pestanas */}
      <div className="flex border-b border-borde gap-1 flex-wrap">
        {([
          { id: 'tipos-conversacion' as TabId, label: 'Tipos Conversacion' },
          { id: 'estados-conversacion' as TabId, label: 'Estados Conversacion' },
          { id: 'tipos-compromiso' as TabId, label: 'Tipos Compromiso' },
          { id: 'estados-compromiso' as TabId, label: 'Estados Compromiso' },
          { id: 'canonicos-conversacion' as TabId, label: 'Canonicos Conversacion' },
          { id: 'canonicos-compromiso' as TabId, label: 'Canonicos Compromiso' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tabActiva === tab.id
                ? 'border-b-2 border-primario text-primario font-semibold'
                : 'text-texto-muted hover:text-texto'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Tipos Conversacion ── */}
      {tabActiva === 'tipos-conversacion' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">
              Define los tipos de conversacion disponibles en el modulo de compromisos
            </p>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(tiposCnv as Record<string, unknown>[], [
                  { titulo: 'Codigo', campo: 'codigo_tipo_conversacion' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Descripcion', campo: 'descripcion' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], 'tipos_conversacion')}
                disabled={tiposCnv.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoTipoCnv}>
                <Plus size={16} />
                Nuevo tipo
              </Boton>
            </div>
          </div>

          {cargandoTiposCnv ? skeleton : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Codigo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Descripcion</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {tiposCnv.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>
                      No hay tipos de conversacion registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  tiposCnv.map((t) => (
                    <TablaFila key={t.codigo_tipo_conversacion}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {t.codigo_tipo_conversacion}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{t.nombre}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">
                        {t.descripcion || <span className="text-texto-light">-</span>}
                      </TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoTipoCnv(t)} title="Cambiar estado">
                          <Insignia variante={t.activo ? 'exito' : 'error'}>
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarTipoCnv(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setItemAEliminar({ tipo: 'tipo-cnv', item: t as unknown as Record<string, unknown> })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar">
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

      {/* ── Tab: Estados Conversacion ── */}
      {tabActiva === 'estados-conversacion' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-texto-muted">Filtrar por tipo:</p>
              <select
                value={filtroTipoCnv}
                onChange={(e) => setFiltroTipoCnv(e.target.value)}
                className="rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
              >
                <option value="">Todos</option>
                {tiposCnv.filter((t) => t.activo).map((t) => (
                  <option key={t.codigo_tipo_conversacion} value={t.codigo_tipo_conversacion}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(estadosCnv as Record<string, unknown>[], [
                  { titulo: 'Tipo', campo: 'codigo_tipo_conversacion' },
                  { titulo: 'Codigo', campo: 'codigo_estado_conversacion' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Canonico', campo: 'codigo_estado_canonico' },
                  { titulo: 'Orden', campo: 'orden' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], `estados_conversacion${filtroTipoCnv ? '_' + filtroTipoCnv : ''}`)}
                disabled={estadosCnv.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoEstadoCnv}>
                <Plus size={16} />
                Nuevo estado
              </Boton>
            </div>
          </div>

          {cargandoEstadosCnv ? skeleton : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Tipo</TablaTh>
                  <TablaTh>Codigo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Canonico</TablaTh>
                  <TablaTh>Orden</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {estadosCnv.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={7 as never}>
                      No hay estados de conversacion registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  estadosCnv.map((e) => (
                    <TablaFila key={`${e.codigo_tipo_conversacion}/${e.codigo_estado_conversacion}`}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {e.codigo_tipo_conversacion}
                        </code>
                      </TablaTd>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {e.codigo_estado_conversacion}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{e.nombre}</TablaTd>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {e.codigo_estado_canonico}
                        </code>
                      </TablaTd>
                      <TablaTd>{e.orden}</TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoEstadoCnv(e)} title="Cambiar estado">
                          <Insignia variante={e.activo ? 'exito' : 'error'}>
                            {e.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarEstadoCnv(e)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setItemAEliminar({ tipo: 'estado-cnv', item: e as unknown as Record<string, unknown> })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar">
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

      {/* ── Tab: Tipos Compromiso ── */}
      {tabActiva === 'tipos-compromiso' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">
              Define los tipos de compromiso disponibles en el modulo
            </p>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(tiposCmp as Record<string, unknown>[], [
                  { titulo: 'Codigo', campo: 'codigo_tipo_compromiso' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Descripcion', campo: 'descripcion' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], 'tipos_compromiso')}
                disabled={tiposCmp.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoTipoCmp}>
                <Plus size={16} />
                Nuevo tipo
              </Boton>
            </div>
          </div>

          {cargandoTiposCmp ? skeleton : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Codigo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Descripcion</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {tiposCmp.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={5 as never}>
                      No hay tipos de compromiso registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  tiposCmp.map((t) => (
                    <TablaFila key={t.codigo_tipo_compromiso}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {t.codigo_tipo_compromiso}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{t.nombre}</TablaTd>
                      <TablaTd className="text-texto-muted text-sm">
                        {t.descripcion || <span className="text-texto-light">-</span>}
                      </TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoTipoCmp(t)} title="Cambiar estado">
                          <Insignia variante={t.activo ? 'exito' : 'error'}>
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarTipoCmp(t)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setItemAEliminar({ tipo: 'tipo-cmp', item: t as unknown as Record<string, unknown> })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar">
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

      {/* ── Tab: Estados Compromiso ── */}
      {tabActiva === 'estados-compromiso' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-texto-muted">Filtrar por tipo:</p>
              <select
                value={filtroTipoCmp}
                onChange={(e) => setFiltroTipoCmp(e.target.value)}
                className="rounded-lg border border-borde bg-surface px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
              >
                <option value="">Todos</option>
                {tiposCmp.filter((t) => t.activo).map((t) => (
                  <option key={t.codigo_tipo_compromiso} value={t.codigo_tipo_compromiso}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(estadosCmp as Record<string, unknown>[], [
                  { titulo: 'Tipo', campo: 'codigo_tipo_compromiso' },
                  { titulo: 'Codigo', campo: 'codigo_estado_compromiso' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Canonico', campo: 'codigo_estado_canonico' },
                  { titulo: 'Orden', campo: 'orden' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], `estados_compromiso${filtroTipoCmp ? '_' + filtroTipoCmp : ''}`)}
                disabled={estadosCmp.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoEstadoCmp}>
                <Plus size={16} />
                Nuevo estado
              </Boton>
            </div>
          </div>

          {cargandoEstadosCmp ? skeleton : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Tipo</TablaTh>
                  <TablaTh>Codigo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Canonico</TablaTh>
                  <TablaTh>Orden</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {estadosCmp.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={7 as never}>
                      No hay estados de compromiso registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  estadosCmp.map((e) => (
                    <TablaFila key={`${e.codigo_tipo_compromiso}/${e.codigo_estado_compromiso}`}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {e.codigo_tipo_compromiso}
                        </code>
                      </TablaTd>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {e.codigo_estado_compromiso}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{e.nombre}</TablaTd>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {e.codigo_estado_canonico}
                        </code>
                      </TablaTd>
                      <TablaTd>{e.orden}</TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoEstadoCmp(e)} title="Cambiar estado">
                          <Insignia variante={e.activo ? 'exito' : 'error'}>
                            {e.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarEstadoCmp(e)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setItemAEliminar({ tipo: 'estado-cmp', item: e as unknown as Record<string, unknown> })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar">
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

      {/* ── Tab: Canonicos Conversacion ── */}
      {tabActiva === 'canonicos-conversacion' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">
              Estados canonicos globales para conversaciones (no dependen de grupo)
            </p>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(canonicosCnv as Record<string, unknown>[], [
                  { titulo: 'Codigo', campo: 'codigo_estado_canonico' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], 'canonicos_conversacion')}
                disabled={canonicosCnv.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoCanCnv}>
                <Plus size={16} />
                Nuevo canonico
              </Boton>
            </div>
          </div>

          {cargandoCanonicosCnv ? skeleton : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Codigo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {canonicosCnv.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={4 as never}>
                      No hay estados canonicos de conversacion registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  canonicosCnv.map((c) => (
                    <TablaFila key={c.codigo_estado_canonico}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {c.codigo_estado_canonico}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{c.nombre}</TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoCanCnv(c)} title="Cambiar estado">
                          <Insignia variante={c.activo ? 'exito' : 'error'}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarCanCnv(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setItemAEliminar({ tipo: 'can-cnv', item: c as unknown as Record<string, unknown> })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar">
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

      {/* ── Tab: Canonicos Compromiso ── */}
      {tabActiva === 'canonicos-compromiso' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-muted">
              Estados canonicos globales para compromisos (no dependen de grupo)
            </p>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => exportarExcel(canonicosCmp as Record<string, unknown>[], [
                  { titulo: 'Codigo', campo: 'codigo_estado_canonico' },
                  { titulo: 'Nombre', campo: 'nombre' },
                  { titulo: 'Estado', campo: 'activo', formato: (v) => v ? 'Activo' : 'Inactivo' },
                ], 'canonicos_compromiso')}
                disabled={canonicosCmp.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <Boton variante="primario" onClick={abrirNuevoCanCmp}>
                <Plus size={16} />
                Nuevo canonico
              </Boton>
            </div>
          </div>

          {cargandoCanonicosCmp ? skeleton : (
            <Tabla>
              <TablaCabecera>
                <tr>
                  <TablaTh>Codigo</TablaTh>
                  <TablaTh>Nombre</TablaTh>
                  <TablaTh>Estado</TablaTh>
                  <TablaTh className="text-right">Acciones</TablaTh>
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {canonicosCmp.length === 0 ? (
                  <TablaFila>
                    <TablaTd className="text-center text-texto-muted py-8" colSpan={4 as never}>
                      No hay estados canonicos de compromiso registrados
                    </TablaTd>
                  </TablaFila>
                ) : (
                  canonicosCmp.map((c) => (
                    <TablaFila key={c.codigo_estado_canonico}>
                      <TablaTd>
                        <code className="text-xs bg-surface border border-borde rounded px-1.5 py-0.5">
                          {c.codigo_estado_canonico}
                        </code>
                      </TablaTd>
                      <TablaTd className="font-medium">{c.nombre}</TablaTd>
                      <TablaTd>
                        <button onClick={() => toggleActivoCanCmp(c)} title="Cambiar estado">
                          <Insignia variante={c.activo ? 'exito' : 'error'}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </Insignia>
                        </button>
                      </TablaTd>
                      <TablaTd>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditarCanCmp(c)} className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setItemAEliminar({ tipo: 'can-cmp', item: c as unknown as Record<string, unknown> })} className="p-1.5 rounded-lg hover:bg-red-50 text-texto-muted hover:text-error transition-colors" title="Eliminar">
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

      {/* ── Modal: Tipo Conversacion ── */}
      <Modal
        abierto={modalTipoCnv}
        alCerrar={() => setModalTipoCnv(false)}
        titulo={tipoCnvEditando ? 'Editar tipo de conversacion' : 'Nuevo tipo de conversacion'}
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Codigo *"
            value={formTipoCnv.codigo_tipo_conversacion}
            onChange={(e) => setFormTipoCnv({ ...formTipoCnv, codigo_tipo_conversacion: e.target.value })}
            disabled={!!tipoCnvEditando}
            placeholder="REUNION"
          />
          <Input
            etiqueta="Nombre *"
            value={formTipoCnv.nombre}
            onChange={(e) => setFormTipoCnv({ ...formTipoCnv, nombre: e.target.value })}
            placeholder="Reunion"
          />
          <Input
            etiqueta="Descripcion"
            value={formTipoCnv.descripcion}
            onChange={(e) => setFormTipoCnv({ ...formTipoCnv, descripcion: e.target.value })}
            placeholder="Descripcion opcional"
          />
          {errorTipoCnv && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorTipoCnv}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalTipoCnv(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarTipoCnv} cargando={guardandoTipoCnv}>
              {tipoCnvEditando ? 'Guardar cambios' : 'Crear tipo'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Estado Conversacion ── */}
      <Modal
        abierto={modalEstadoCnv}
        alCerrar={() => setModalEstadoCnv(false)}
        titulo={estadoCnvEditando ? 'Editar estado de conversacion' : 'Nuevo estado de conversacion'}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Tipo de conversacion *</label>
            <select
              value={formEstadoCnv.codigo_tipo_conversacion}
              onChange={(e) => setFormEstadoCnv({ ...formEstadoCnv, codigo_tipo_conversacion: e.target.value })}
              disabled={!!estadoCnvEditando}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
            >
              <option value="">Seleccionar tipo...</option>
              {tiposCnv.filter((t) => t.activo).map((t) => (
                <option key={t.codigo_tipo_conversacion} value={t.codigo_tipo_conversacion}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <Input
            etiqueta="Codigo *"
            value={formEstadoCnv.codigo_estado_conversacion}
            onChange={(e) => setFormEstadoCnv({ ...formEstadoCnv, codigo_estado_conversacion: e.target.value })}
            disabled={!!estadoCnvEditando}
            placeholder="PENDIENTE"
          />
          <Input
            etiqueta="Nombre *"
            value={formEstadoCnv.nombre}
            onChange={(e) => setFormEstadoCnv({ ...formEstadoCnv, nombre: e.target.value })}
            placeholder="Pendiente"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Estado canonico *</label>
            <select
              value={formEstadoCnv.codigo_estado_canonico}
              onChange={(e) => setFormEstadoCnv({ ...formEstadoCnv, codigo_estado_canonico: e.target.value })}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
            >
              <option value="">Seleccionar canonico...</option>
              {canonicosCnv.filter((c) => c.activo).map((c) => (
                <option key={c.codigo_estado_canonico} value={c.codigo_estado_canonico}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <Input
            etiqueta="Orden"
            type="number"
            value={String(formEstadoCnv.orden)}
            onChange={(e) => setFormEstadoCnv({ ...formEstadoCnv, orden: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />
          {errorEstadoCnv && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorEstadoCnv}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalEstadoCnv(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarEstadoCnv} cargando={guardandoEstadoCnv}>
              {estadoCnvEditando ? 'Guardar cambios' : 'Crear estado'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Tipo Compromiso ── */}
      <Modal
        abierto={modalTipoCmp}
        alCerrar={() => setModalTipoCmp(false)}
        titulo={tipoCmpEditando ? 'Editar tipo de compromiso' : 'Nuevo tipo de compromiso'}
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Codigo *"
            value={formTipoCmp.codigo_tipo_compromiso}
            onChange={(e) => setFormTipoCmp({ ...formTipoCmp, codigo_tipo_compromiso: e.target.value })}
            disabled={!!tipoCmpEditando}
            placeholder="TAREA"
          />
          <Input
            etiqueta="Nombre *"
            value={formTipoCmp.nombre}
            onChange={(e) => setFormTipoCmp({ ...formTipoCmp, nombre: e.target.value })}
            placeholder="Tarea"
          />
          <Input
            etiqueta="Descripcion"
            value={formTipoCmp.descripcion}
            onChange={(e) => setFormTipoCmp({ ...formTipoCmp, descripcion: e.target.value })}
            placeholder="Descripcion opcional"
          />
          {errorTipoCmp && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorTipoCmp}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalTipoCmp(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarTipoCmp} cargando={guardandoTipoCmp}>
              {tipoCmpEditando ? 'Guardar cambios' : 'Crear tipo'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Estado Compromiso ── */}
      <Modal
        abierto={modalEstadoCmp}
        alCerrar={() => setModalEstadoCmp(false)}
        titulo={estadoCmpEditando ? 'Editar estado de compromiso' : 'Nuevo estado de compromiso'}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Tipo de compromiso *</label>
            <select
              value={formEstadoCmp.codigo_tipo_compromiso}
              onChange={(e) => setFormEstadoCmp({ ...formEstadoCmp, codigo_tipo_compromiso: e.target.value })}
              disabled={!!estadoCmpEditando}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario disabled:opacity-60"
            >
              <option value="">Seleccionar tipo...</option>
              {tiposCmp.filter((t) => t.activo).map((t) => (
                <option key={t.codigo_tipo_compromiso} value={t.codigo_tipo_compromiso}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <Input
            etiqueta="Codigo *"
            value={formEstadoCmp.codigo_estado_compromiso}
            onChange={(e) => setFormEstadoCmp({ ...formEstadoCmp, codigo_estado_compromiso: e.target.value })}
            disabled={!!estadoCmpEditando}
            placeholder="PENDIENTE"
          />
          <Input
            etiqueta="Nombre *"
            value={formEstadoCmp.nombre}
            onChange={(e) => setFormEstadoCmp({ ...formEstadoCmp, nombre: e.target.value })}
            placeholder="Pendiente"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Estado canonico *</label>
            <select
              value={formEstadoCmp.codigo_estado_canonico}
              onChange={(e) => setFormEstadoCmp({ ...formEstadoCmp, codigo_estado_canonico: e.target.value })}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
            >
              <option value="">Seleccionar canonico...</option>
              {canonicosCmp.filter((c) => c.activo).map((c) => (
                <option key={c.codigo_estado_canonico} value={c.codigo_estado_canonico}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <Input
            etiqueta="Orden"
            type="number"
            value={String(formEstadoCmp.orden)}
            onChange={(e) => setFormEstadoCmp({ ...formEstadoCmp, orden: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />
          {errorEstadoCmp && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorEstadoCmp}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalEstadoCmp(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarEstadoCmp} cargando={guardandoEstadoCmp}>
              {estadoCmpEditando ? 'Guardar cambios' : 'Crear estado'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Canonico Conversacion ── */}
      <Modal
        abierto={modalCanCnv}
        alCerrar={() => setModalCanCnv(false)}
        titulo={canCnvEditando ? 'Editar estado canonico de conversacion' : 'Nuevo estado canonico de conversacion'}
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Codigo *"
            value={formCanCnv.codigo_estado_canonico}
            onChange={(e) => setFormCanCnv({ ...formCanCnv, codigo_estado_canonico: e.target.value })}
            disabled={!!canCnvEditando}
            placeholder="ABIERTA"
          />
          <Input
            etiqueta="Nombre *"
            value={formCanCnv.nombre}
            onChange={(e) => setFormCanCnv({ ...formCanCnv, nombre: e.target.value })}
            placeholder="Abierta"
          />
          {errorCanCnv && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorCanCnv}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalCanCnv(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarCanCnv} cargando={guardandoCanCnv}>
              {canCnvEditando ? 'Guardar cambios' : 'Crear canonico'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Canonico Compromiso ── */}
      <Modal
        abierto={modalCanCmp}
        alCerrar={() => setModalCanCmp(false)}
        titulo={canCmpEditando ? 'Editar estado canonico de compromiso' : 'Nuevo estado canonico de compromiso'}
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Codigo *"
            value={formCanCmp.codigo_estado_canonico}
            onChange={(e) => setFormCanCmp({ ...formCanCmp, codigo_estado_canonico: e.target.value })}
            disabled={!!canCmpEditando}
            placeholder="PENDIENTE"
          />
          <Input
            etiqueta="Nombre *"
            value={formCanCmp.nombre}
            onChange={(e) => setFormCanCmp({ ...formCanCmp, nombre: e.target.value })}
            placeholder="Pendiente"
          />
          {errorCanCmp && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{errorCanCmp}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalCanCmp(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarCanCmp} cargando={guardandoCanCmp}>
              {canCmpEditando ? 'Guardar cambios' : 'Crear canonico'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ── Modal Confirmar Eliminacion ── */}
      <ModalConfirmar
        abierto={!!itemAEliminar}
        alCerrar={() => setItemAEliminar(null)}
        alConfirmar={ejecutarEliminacion}
        titulo="Eliminar registro"
        mensaje={`Estas seguro de eliminar "${(itemAEliminar?.item as Record<string, unknown>)?.nombre || ''}"? Esta accion no se puede deshacer.`}
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={eliminandoItem}
      />
    </div>
  )
}
