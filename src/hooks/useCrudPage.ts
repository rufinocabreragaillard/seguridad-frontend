'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { registrarTimeoutCarga } from '@/lib/avisos-pagina'

const TIMEOUT_CARGA_MS = 30000

interface UseCrudPageOptions<T, F> {
  /** Función para cargar los items desde la API */
  cargarFn: () => Promise<T[]>
  /** Función para crear item */
  crearFn?: (datos: F) => Promise<T>
  /** Función para actualizar item */
  actualizarFn?: (id: string, datos: Partial<F>) => Promise<T>
  /** Función para eliminar/desactivar item */
  eliminarFn?: (id: string) => Promise<void>
  /** Obtener el ID del item (para operaciones CRUD) */
  getId: (item: T) => string
  /** Campos a buscar en el filtro */
  camposBusqueda: (item: T) => string[]
  /** Form vacío inicial */
  formInicial: F
  /** Convertir item a form para edición */
  itemToForm: (item: T) => F
}

export function useCrudPage<T, F extends Record<string, any>>(opts: UseCrudPageOptions<T, F>) {
  const t = useTranslations('common')
  const [items, setItems] = useState<T[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<T | null>(null)
  const [form, setForm] = useState<F>(opts.formInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [confirmacion, setConfirmacion] = useState<T | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    // Safety net: si algo imprevisto hace que cargarFn nunca resuelva,
    // forzamos cargando=false y registramos un aviso rojo al usuario.
    const timeoutId = setTimeout(() => {
      setCargando(false)
      registrarTimeoutCarga(`La carga de datos superó ${TIMEOUT_CARGA_MS / 1000}s`)
    }, TIMEOUT_CARGA_MS)
    try {
      setItems(await opts.cargarFn())
    } catch (e) {
      console.error('[useCrudPage] Error en cargarFn:', e)
    } finally {
      clearTimeout(timeoutId)
      setCargando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm(opts.formInicial)
    setError('')
    setModal(true)
  }

  const abrirEditar = (item: T) => {
    setEditando(item)
    setForm(opts.itemToForm(item))
    setError('')
    setModal(true)
  }

  const cerrarModal = () => {
    setModal(false)
    setEditando(null)
  }

  const guardar = async (
    datosCrear?: any,
    datosActualizar?: any,
    opcionesGuardado?: { cerrar?: boolean }
  ) => {
    const cerrar = opcionesGuardado?.cerrar !== false
    setGuardando(true)
    setError('')
    try {
      if (editando) {
        if (opts.actualizarFn) {
          const actualizado = await opts.actualizarFn(opts.getId(editando), datosActualizar ?? form)
          if (!cerrar && actualizado) setEditando(actualizado)
        }
      } else {
        if (opts.crearFn) {
          const creado = await opts.crearFn(datosCrear ?? form)
          if (!cerrar && creado) {
            setEditando(creado)
            setForm(opts.itemToForm(creado))
          }
        }
      }
      if (cerrar) cerrarModal()
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEliminacion = async () => {
    if (!confirmacion || !opts.eliminarFn) return
    setEliminando(true)
    try {
      await opts.eliminarFn(opts.getId(confirmacion))
      setConfirmacion(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorAlEliminar'))
      setConfirmacion(null)
    } finally {
      setEliminando(false)
    }
  }

  const filtrados = items.filter((item) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return opts.camposBusqueda(item).some((campo) =>
      campo?.toLowerCase().includes(q)
    )
  })

  const updateForm = <K extends keyof F>(campo: K, valor: F[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  return {
    // Estado
    items, cargando, busqueda, filtrados,
    modal, editando, form, guardando, error,
    confirmacion, eliminando,
    // Acciones
    cargar, setBusqueda, setError,
    abrirNuevo, abrirEditar, cerrarModal,
    guardar, ejecutarEliminacion,
    setConfirmacion, setForm, updateForm,
  }
}
