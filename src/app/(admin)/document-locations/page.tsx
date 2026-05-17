'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Pencil, Download, ChevronRight, ChevronDown, FolderTree, Folder, FolderOpen, FolderInput, FolderPlus, RefreshCw, ToggleLeft, ToggleRight, Shuffle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Boton } from '@/components/ui/boton'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta'
import { ubicacionesDocsApi, promptsApi } from '@/lib/api'
import type { UbicacionDoc } from '@/lib/tipos'
import { exportarExcel } from '@/lib/exportar-excel'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { escanearDirectorio, escanearDirectorioSinHijos, soportaDirectoryPicker, type DirectorioEscaneado } from '@/lib/escanear-directorio'
import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle, compararHandles } from '@/lib/file-handle-store'
import { useToast } from '@/context/ToastContext'
import { BotonChat } from '@/components/ui/boton-chat'
import { TabPrompts } from '@/components/ui/tab-prompts'
import { PieBotonesPrompts } from '@/components/ui/pie-botones-prompts'

// Extrae el detalle técnico de un error (status + URL + detail/message + code).
// Retorna string vacío si no se puede extraer nada útil.
function detalleError(e: unknown): string {
  const partes: string[] = []
  if (e && typeof e === 'object') {
    const errAny = e as {
      response?: { status?: number; statusText?: string; data?: unknown; config?: { url?: string } }
      config?: { url?: string }
      message?: string
      code?: string
    }
    const status = errAny.response?.status
    const statusText = errAny.response?.statusText
    const url = errAny.response?.config?.url || errAny.config?.url
    const data = errAny.response?.data
    let detalle: string | undefined
    if (typeof data === 'string') detalle = data
    else if (data && typeof data === 'object') {
      const d = data as { detail?: unknown; message?: unknown; error?: unknown }
      const v = d.detail ?? d.message ?? d.error
      detalle = typeof v === 'string' ? v : v != null ? JSON.stringify(v) : JSON.stringify(data)
    }
    if (detalle) partes.push(detalle)
    if (status) partes.push(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`)
    if (url) partes.push(`@ ${url}`)
    if (errAny.code) partes.push(`code=${errAny.code}`)
    if (errAny.message && !partes.includes(errAny.message)) partes.push(errAny.message)
  } else if (e instanceof Error) {
    partes.push(e.message)
  }
  return partes.join(' · ')
}

export default function PaginaUbicacionesDocs() {
  const { grupoActivo, usuario } = useAuth()
  const userId = usuario?.codigo_usuario ?? null
  const toast = useToast()
  const t = useTranslations('documentLocations')
  const tc = useTranslations('common')
  const tdlx = useTranslations('documentLocationsExtra')
  // ── State ─────────────────────────────────────────────────────────────────
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargando, setCargando] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // ── Modal CRUD ────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<UbicacionDoc | null>(null)
  const [tabModal, setTabModal] = useState<'datos' | 'system_prompt' | 'programacion_insert' | 'programacion_update' | 'md'>('datos')
  const [generandoMd, setGenerandoMd] = useState(false)
  const [sincronizandoMd, setSincronizandoMd] = useState(false)
  const [mensajeMd, setMensajeMd] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [md, setMd] = useState('')
  const [form, setForm] = useState({
    codigo_ubicacion: '',
    nombre_ubicacion: '',
    alias_ubicacion: '',
    descripcion: '',
    codigo_ubicacion_superior: '',
    ubicacion_habilitada: true,
    prompt_insert: '',
    prompt_update: '',
    system_prompt: '',
    python_insert: '',
    python_update: '',
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

  // ── Modal error árbol (directorio fuera del árbol) ────────────────────────
  const [modalErrorArbol, setModalErrorArbol] = useState<{ nombreNuevo: string; raices: string } | null>(null)

  // ── Indexar Ubicaciones (escaneo) ──────────────────────────────────────────
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
  // Carpetas expandidas en el preview del modal Sincronizar (parte cerrado).
  const [expandidosScan, setExpandidosScan] = useState<Set<string>>(new Set())
  // Snapshot completo del árbol de BD usado SOLO por el modal Sincronizar
  // para calcular diff. No se mezcla con `ubicaciones` (que mantiene su modo
  // lazy de raíces) para no alterar la vista del árbol principal.
  const [arbolCompletoCache, setArbolCompletoCache] = useState<UbicacionDoc[]>([])

  // ── Lazy loading ──────────────────────────────────────────────────────────
  // padresCargados: nodos cuyos hijos directos ya fueron traídos del server.
  const [padresCargados, setPadresCargados] = useState<Set<string>>(new Set())
  const [cargandoNodo, setCargandoNodo] = useState<Set<string>>(new Set())

  // Mezcla filas nuevas con el estado existente (deduplica por codigo).
  const mergeUbicaciones = (nuevas: UbicacionDoc[]) => {
    setUbicaciones((prev) => {
      const map = new Map(prev.map((u) => [u.codigo_ubicacion, u]))
      for (const n of nuevas) map.set(n.codigo_ubicacion, n)
      return Array.from(map.values())
    })
  }

  const cargarRaices = useCallback(async () => {
    setCargando(true)
    try {
      const raicesData = await ubicacionesDocsApi.listar({ solo_raices: true })
      setUbicaciones(raicesData)
      setPadresCargados(new Set())
      setExpandidos(new Set())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarRaices() }, [cargarRaices])

  const cargarHijos = useCallback(async (codigo: string) => {
    if (padresCargados.has(codigo)) return
    setCargandoNodo((prev) => new Set(prev).add(codigo))
    try {
      const hijos = await ubicacionesDocsApi.listar({ padre: codigo })
      mergeUbicaciones(hijos)
      setPadresCargados((prev) => new Set(prev).add(codigo))
    } finally {
      setCargandoNodo((prev) => {
        const next = new Set(prev)
        next.delete(codigo)
        return next
      })
    }
  }, [padresCargados])

  // ── Expandir/Colapsar ─────────────────────────────────────────────────────
  const toggleExpandir = (codigo: string, tiene: boolean) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        next.delete(codigo)
      } else {
        next.add(codigo)
        if (tiene && !padresCargados.has(codigo)) cargarHijos(codigo)
      }
      return next
    })
  }

  const expandirTodos = async () => {
    if (ubicaciones.length === 0) return
    setCargando(true)
    try {
      // Modo legacy (CTE recursiva con url incremental):
      // más eficiente que armar el subárbol vía grafo cuando hay miles de nodos.
      const todos = await ubicacionesDocsApi.listar()
      setUbicaciones(todos)
      setExpandidos(new Set(todos.map((u) => u.codigo_ubicacion)))
      // En modo legacy no viene tiene_hijos; lo derivamos del Map<padre,hijos[]>.
      const padres = new Set(todos.map((u) => u.codigo_ubicacion_superior).filter((c): c is string => !!c))
      setPadresCargados(padres)
    } finally {
      setCargando(false)
    }
  }

  const colapsarTodos = () => {
    setExpandidos(new Set())
  }

  // ── Helpers jerarquía ─────────────────────────────────────────────────────
  // Map padre → hijos[] pre-computado: O(N) una sola vez por render.
  const hijosPorPadre = useMemo(() => {
    const m = new Map<string, UbicacionDoc[]>()
    for (const u of ubicaciones) {
      const sup = u.codigo_ubicacion_superior || ''
      const arr = m.get(sup) ?? []
      arr.push(u)
      m.set(sup, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.orden - b.orden || a.nombre_ubicacion.localeCompare(b.nombre_ubicacion))
    }
    return m
  }, [ubicaciones])

  const tieneHijos = (u: UbicacionDoc) =>
    u.tiene_hijos === true || (hijosPorPadre.get(u.codigo_ubicacion)?.length ?? 0) > 0

  // Carga completa bajo demanda (sincronización / preview de impacto).
  // Guarda el snapshot en `arbolCompletoCache` (NO en `ubicaciones`) para que
  // la página principal mantenga su modo lazy de raíces y no se "expanda" al
  // abrir el modal de Sincronizar.
  const asegurarArbolCompleto = useCallback(async () => {
    const todas = await ubicacionesDocsApi.listar({ todo: true })
    setArbolCompletoCache(todas)
    return todas
  }, [])

  // Alias para que el resto del código siga funcionando (CRUD recarga raíces).
  const cargar = cargarRaices

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
      prompt_insert: (u as unknown as Record<string, unknown>).prompt_insert as string || '',
      prompt_update: (u as unknown as Record<string, unknown>).prompt_update as string || '',
      system_prompt: u.system_prompt || '',
      python_insert: (u as unknown as Record<string, unknown>).python_insert as string || '',
      python_update: (u as unknown as Record<string, unknown>).python_update as string || '',
      javascript: (u as unknown as Record<string, unknown>).javascript as string || '',
      python_editado_manual: ((u as unknown as Record<string, unknown>).python_editado_manual as boolean) ?? false,
      javascript_editado_manual: ((u as unknown as Record<string, unknown>).javascript_editado_manual as boolean) ?? false,
    })
    setTabModal('datos')
    setError('')
    setMd((u as unknown as Record<string, unknown>).md as string || '')
    setMensajeMd(null)
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
        prompt_insert: form.prompt_insert || undefined,
        prompt_update: form.prompt_update || undefined,
        system_prompt: form.system_prompt || undefined,
        python_insert: form.python_insert || undefined,
        python_update: form.python_update || undefined,
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
    const nuevoEstado = !u.ubicacion_habilitada
    try {
      await ubicacionesDocsApi.actualizar(u.codigo_ubicacion, {
        ubicacion_habilitada: nuevoEstado,
      })
      // Actualizar en memoria sin colapsar el árbol: propagar a todos los
      // descendientes ya cargados (el backend ya los inhabilitó en BD).
      if (!nuevoEstado) {
        // Al inhabilitar: marcar la ubicación y todos sus descendientes cargados.
        setUbicaciones((prev) => {
          // Recopilar todos los descendientes del nodo usando el árbol en memoria.
          const descendientes = new Set<string>()
          const queue = [u.codigo_ubicacion]
          while (queue.length > 0) {
            const cur = queue.shift()!
            for (const n of prev) {
              if (n.codigo_ubicacion_superior === cur) {
                descendientes.add(n.codigo_ubicacion)
                queue.push(n.codigo_ubicacion)
              }
            }
          }
          return prev.map((n) =>
            n.codigo_ubicacion === u.codigo_ubicacion || descendientes.has(n.codigo_ubicacion)
              ? { ...n, ubicacion_habilitada: false }
              : n
          )
        })
      } else {
        // Al habilitar: solo actualizar el nodo mismo (no propaga en cascada).
        setUbicaciones((prev) =>
          prev.map((n) =>
            n.codigo_ubicacion === u.codigo_ubicacion
              ? { ...n, ubicacion_habilitada: true }
              : n
          )
        )
      }
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

  // ── Validación: nuevo handle debe ser ancestro/descendiente/igual al persistido ──
  // Devuelve true si la carga puede proceder; false si fue rechazada.
  // Como efecto colateral: si es 'ancestro entrante' o re-vinculación
  // por nombre, actualiza el handle persistido al nuevo.
  const validarRelacionConArbol = async (
    nuevo: FileSystemDirectoryHandle,
    nombreNuevo: string,
  ): Promise<boolean> => {
    const raices = ubicaciones.filter((u) => !u.codigo_ubicacion_superior)
    if (raices.length === 0) return true // BD vacía: primera carga, todo permitido

    const persistido = await idbGetHandle(userId, grupoActivo)
    const nombresRoots = raices.map((r) => r.nombre_ubicacion)

    if (!persistido) {
      // Sin handle persistido en esta sesión (caché limpiada, nuevo navegador, etc.).
      // No podemos comparar directorios sin handle, así que aceptamos pero avisamos.
      // El backend rechazará si hay conflicto estructural. Guardamos el handle para
      // que cargas posteriores puedan validar parentesco correctamente.
      toast.warning(
        tdlx('errorVerificarRelacion'),
        tdlx('raicesActuales', { nombre: nombreNuevo }),
      )
      await idbSetHandle(nuevo, userId, grupoActivo)
      return true
    }

    const relacion = await compararHandles(persistido, nuevo)
    if (relacion === 'no-relacionados') {
      setModalErrorArbol({ nombreNuevo, raices: nombresRoots.join(', ') })
      return false
    }

    // Si el nuevo es ancestro del persistido, el nuevo pasa a ser el root del árbol.
    if (relacion === 'nuevo-es-ancestro') {
      await idbSetHandle(nuevo, userId, grupoActivo)
    }

    return true
  }

  // ── Indexar Ubicaciones (escaneo + sincronización) ─────────────────────────
  const iniciarEscaneo = async (forzarPicker = false) => {
    if (!soportaDirectoryPicker()) {
      toast.error(t('errorBrowserNoSoporta'))
      return
    }
    setEscaneando(true)
    setResultadoSync(null)
    try {
      // Si hay handle persistido y aún tenemos permiso, reusarlo sin abrir Finder.
      let handlePersistido: FileSystemDirectoryHandle | null = null
      if (!forzarPicker) {
        const h = await idbGetHandle(userId, grupoActivo)
        if (h) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const perm = await (h as any).queryPermission?.({ mode: 'read' })
          // Solo reusar el handle si ya tiene permiso concedido. 'prompt' requiere
          // un gesto de usuario directo — intentar requestPermission aquí (dentro
          // de un await anidado) cuelga en Chrome/Safari; dejamos que showDirectoryPicker
          // lo resuelva naturalmente.
          if (perm === 'granted') handlePersistido = h
        }
      }
      const resultado = await escanearDirectorio(handlePersistido)
      if (!resultado) {
        setEscaneando(false)
        return // usuario canceló
      }
      // Validar parentesco solo cuando vino del picker (handle nuevo).
      if (!handlePersistido) {
        const ok = await validarRelacionConArbol(resultado.dirHandle, resultado.nombreRaiz)
        if (!ok) { setEscaneando(false); return }
      }
      // Persistir el handle para que luego se puedan abrir documentos
      // sin volver a pedir la carpeta al usuario.
      idbSetHandle(resultado.dirHandle, userId, grupoActivo)
      // El preview/sincronización compara contra TODAS las ubicaciones del grupo.
      await asegurarArbolCompleto()
      setDatosEscaneo(resultado)
      setModalCarga(true)
    } catch (e: unknown) {
      toast.error('Error al escanear el directorio.', detalleError(e))
    } finally {
      setEscaneando(false)
    }
  }

  const ejecutarSincronizacion = async () => {
    if (!datosEscaneo) return
    setSincronizando(true)
    try {
      const raiz = datosEscaneo.directorios.find((d) => !d.codigo_ubicacion_superior)
      const res = await ubicacionesDocsApi.sincronizar({
        directorios: datosEscaneo.directorios,
        codigo_ubicacion_raiz: raiz?.codigo_ubicacion,
      })
      setResultadoSync(res)
      // Tras sync: recargar desde raíces (colapsado) para no abrumar con miles de nodos expandidos.
      try {
        await cargarRaices()
      } catch {
        cargar()
      }
    } catch (e: unknown) {
      toast.error('Error al sincronizar ubicaciones.', detalleError(e))
    } finally {
      setSincronizando(false)
    }
  }

  const cerrarModalCarga = () => {
    setModalCarga(false)
    setDatosEscaneo(null)
    setResultadoSync(null)
    setArbolCompletoCache([])
    setExpandidosScan(new Set())
  }

  // ── Cargar Ubicación individual (sin hijos) ──────────────────────────────
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false)

  const cargarUbicacionIndividual = async () => {
    if (!soportaDirectoryPicker()) {
      toast.error(t('errorBrowserNoSoporta'))
      return
    }
    setCargandoUbicacion(true)
    try {
      const resultado = await escanearDirectorioSinHijos()
      if (!resultado) {
        setCargandoUbicacion(false)
        return
      }
      const { directorio, dirHandle } = resultado
      // Validar parentesco antes de proceder.
      const ok = await validarRelacionConArbol(dirHandle, directorio.nombre_ubicacion)
      if (!ok) { setCargandoUbicacion(false); return }
      // Persistir el handle para que luego se puedan abrir documentos.
      idbSetHandle(dirHandle, userId, grupoActivo)
      await ubicacionesDocsApi.crear({
        codigo_ubicacion: directorio.codigo_ubicacion,
        codigo_grupo: grupoActivo!,
        nombre_ubicacion: directorio.nombre_ubicacion,
      })
      cargar()
    } catch (e: unknown) {
      toast.error(tdlx('errorCrearUbicacion'), detalleError(e))
    } finally {
      setCargandoUbicacion(false)
    }
  }

  // ── Preview: calcular diferencias ─────────────────────────────────────────
  // ── Filtrar directorios escaneados: excluir hijos de inhabilitadas ────────
  const filtrarPorInhabilitadas = (directorios: DirectorioEscaneado[]) => {
    const inhabilitadas = new Set(
      arbolCompletoCache.filter((u) => !u.ubicacion_habilitada).map((u) => u.codigo_ubicacion)
    )
    if (inhabilitadas.size === 0) return { filtrados: directorios, excluidos: 0 }

    const padres: Record<string, string | undefined> = {}
    for (const d of directorios) {
      padres[d.codigo_ubicacion] = d.codigo_ubicacion_superior || undefined
    }

    const esDescendienteInhabilitada = (codigo: string): boolean => {
      const visitados = new Set<string>()
      let actual = padres[codigo] || arbolCompletoCache.find((u) => u.codigo_ubicacion === codigo)?.codigo_ubicacion_superior
      while (actual) {
        if (inhabilitadas.has(actual)) return true
        if (visitados.has(actual)) break
        visitados.add(actual)
        actual = padres[actual] || arbolCompletoCache.find((u) => u.codigo_ubicacion === actual)?.codigo_ubicacion_superior || undefined
      }
      return false
    }

    const filtrados = directorios.filter((d) => !esDescendienteInhabilitada(d.codigo_ubicacion))
    return { filtrados, excluidos: directorios.length - filtrados.length }
  }

  const calcularDiferencias = () => {
    if (!datosEscaneo) return { nuevas: 0, aEliminar: 0, sinCambio: 0, excluidas: 0 }
    const { filtrados: dirsFiltrados, excluidos } = filtrarPorInhabilitadas(datosEscaneo.directorios)
    const codigosActuales = new Set(arbolCompletoCache.map((u) => u.codigo_ubicacion))
    const codigosEscaneados = new Set(dirsFiltrados.map((d) => d.codigo_ubicacion))
    const nuevas = dirsFiltrados.filter((d) => !codigosActuales.has(d.codigo_ubicacion)).length
    // Acotar "a eliminar" al subárbol de la raíz escaneada — coincide con la
    // lógica del backend (Opción A): sólo se borran descendientes (o la raíz
    // misma) que estén en BD pero no en el escaneo.
    const codigoRaiz = datosEscaneo.directorios.find((d) => !d.codigo_ubicacion_superior)?.codigo_ubicacion
    const enSubarbol = new Set<string>()
    if (codigoRaiz && codigosActuales.has(codigoRaiz)) {
      const hijosDe = new Map<string, string[]>()
      for (const u of arbolCompletoCache) {
        if (u.codigo_ubicacion_superior) {
          const arr = hijosDe.get(u.codigo_ubicacion_superior) ?? []
          arr.push(u.codigo_ubicacion)
          hijosDe.set(u.codigo_ubicacion_superior, arr)
        }
      }
      const pila: string[] = [codigoRaiz]
      enSubarbol.add(codigoRaiz)
      while (pila.length) {
        const cur = pila.pop()!
        for (const h of hijosDe.get(cur) ?? []) {
          if (!enSubarbol.has(h)) {
            enSubarbol.add(h)
            pila.push(h)
          }
        }
      }
    }
    const aEliminar = arbolCompletoCache.filter(
      (u) => enSubarbol.has(u.codigo_ubicacion) && !codigosEscaneados.has(u.codigo_ubicacion)
    ).length
    const sinCambio = dirsFiltrados.length - nuevas
    return { nuevas, aEliminar, sinCambio, excluidas: excluidos }
  }

  // La búsqueda es server-side (modo q en el endpoint). Aquí filtrados === ubicaciones.
  const filtrados = ubicaciones

  // ── Render nodos jerárquicos ──────────────────────────────────────────────
  const renderNodo = (u: UbicacionDoc) => {
    const hijos = tieneHijos(u)
    const expandido = expandidos.has(u.codigo_ubicacion)
    const cargandoEste = cargandoNodo.has(u.codigo_ubicacion)
    const indent = u.nivel * 24
    const esArea = u.tipo_ubicacion === 'AREA'
    const inhabilitada = !u.ubicacion_habilitada
    const rowBg = inhabilitada
      ? 'bg-red-50 hover:bg-red-100'
      : esArea ? 'bg-blue-50 hover:bg-blue-100' : 'bg-amber-50 hover:bg-amber-100'
    const folderColor = esArea ? 'text-blue-500' : 'text-amber-500'

    return (
      <div key={u.codigo_ubicacion}>
        <div
          className={`flex items-center gap-2 px-3 py-1 ${rowBg} rounded group transition-colors`}
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          <button
            onClick={() => toggleExpandir(u.codigo_ubicacion, hijos)}
            className={`p-0.5 rounded transition-colors ${hijos ? 'hover:bg-primario-muy-claro text-texto-muted hover:text-primario' : 'invisible'}`}
          >
            {cargandoEste ? <Loader2 size={14} className="animate-spin" /> : expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandido && hijos ? (
            <FolderOpen size={14} className={`${folderColor} shrink-0`} />
          ) : (
            <Folder size={14} className={`${folderColor} shrink-0`} />
          )}

          <div className="flex-1 min-w-0 truncate cursor-pointer" title={`${u.nombre_ubicacion} (${u.codigo_ubicacion})`} onDoubleClick={() => abrirEditar(u)}>
            <span className="font-medium text-xs">{u.nombre_ubicacion}</span>
            <span className="text-xs text-texto-muted ml-2">({u.codigo_ubicacion})</span>
          </div>

          <span className="text-xs text-texto-muted truncate max-w-[300px] shrink-0 hidden lg:block" title={u.url || ''}>
            {u.url || ''}
          </span>

          <Insignia variante={u.tipo_ubicacion === 'AREA' ? 'primario' : 'advertencia'}>
            {u.tipo_ubicacion}
          </Insignia>

          <Insignia variante={u.ubicacion_habilitada ? 'exito' : 'error'}>
            {u.ubicacion_habilitada ? t('habilitada') : t('inhabilitada')}
          </Insignia>

          <div className="flex items-center gap-0.5 shrink-0 transition-opacity">
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
          (hijosPorPadre.get(u.codigo_ubicacion) ?? []).map((h) => renderNodo(h))}
      </div>
    )
  }

  const raices = hijosPorPadre.get('') ?? []

  const diff = datosEscaneo ? calcularDiferencias() : null

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <PageHeader className="pr-28" i18nNamespace="documentLocations" />

      {/* Toolbar */}
      <Tarjeta>
        <TarjetaContenido>
          <div className="flex gap-2 flex-wrap items-start">
            <div className="flex flex-col items-center">
              <Boton variante="contorno" onClick={() => iniciarEscaneo(true)} cargando={escaneando}>
                <FolderInput size={16} />
                {t('cargarDesdeDirectorioTitulo')}
              </Boton>
              <span className="text-[11px] text-texto-muted mt-0.5">y todos los sub-directorios</span>
            </div>
            <div className="flex flex-col items-center">
              <Boton variante="contorno" onClick={cargarUbicacionIndividual} cargando={cargandoUbicacion}>
                <FolderPlus size={16} />
                {t('cargarUbicacion')}
              </Boton>
              <span className="text-[11px] text-texto-muted mt-0.5">solo un directorio</span>
            </div>
            <div className="flex flex-col items-center">
              <Boton variante="contorno" onClick={expandirTodos} disabled={ubicaciones.length === 0}>
                {t('expandirTodo')}
              </Boton>
              <span className="text-[11px] text-texto-muted mt-0.5 invisible">·</span>
            </div>
            <div className="flex flex-col items-center">
              <Boton variante="contorno" onClick={colapsarTodos} disabled={ubicaciones.length === 0}>
                {t('colapsarTodo')}
              </Boton>
              <span className="text-[11px] text-texto-muted mt-0.5 invisible">·</span>
            </div>
            <div className="flex flex-col items-center">
              <Boton
                variante="contorno"
                onClick={() =>
                  exportarExcel(
                    filtrados as unknown as Record<string, unknown>[],
                    [
                      { titulo: 'Código', campo: 'codigo_ubicacion' },
                      { titulo: 'Nombre', campo: 'nombre_ubicacion' },
                      { titulo: 'Ruta', campo: 'url' },
                      { titulo: 'Padre', campo: 'codigo_ubicacion_superior' },
                      { titulo: 'Nivel', campo: 'nivel' },
                      { titulo: 'Habilitada', campo: 'ubicacion_habilitada', formato: (v: unknown) => (v ? 'Sí' : 'No') },
                    ],
                    'ubicaciones-docs'
                  )
                }
                disabled={filtrados.length === 0}
              >
                <Download size={15} />
                Excel
              </Boton>
              <span className="text-[11px] text-texto-muted mt-0.5 invisible">·</span>
            </div>
          </div>
        </TarjetaContenido>
      </Tarjeta>

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
        titulo={editando ? tdlx('editarUbicacion', { nombre: editando.nombre_ubicacion, codigo: editando.codigo_ubicacion }) : tdlx('nuevaUbicacion')}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-4 min-h-[700px]">
          {/* Tabs — siempre en edición */}
          {editando && (
            <div className="flex border-b border-borde">
              {(['datos', 'system_prompt', 'programacion_insert', 'programacion_update', 'md'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabModal(tab)}
                  className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${
                    tabModal === tab
                      ? 'border-b-2 border-primario text-primario'
                      : 'text-texto-muted hover:text-texto'
                  }`}
                >
                  {tab === 'datos' ? 'Datos' : tab === 'system_prompt' ? 'System Prompt' : tab === 'programacion_insert' ? 'Prog. Insert' : tab === 'programacion_update' ? 'Prog. Update' : '.md'}
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
              {editando && (
                <div className="col-span-2">
                  <Input etiqueta="Ruta" value={editando.url || ''} disabled readOnly />
                </div>
              )}
            </div>
          )}

          {/* Tab System Prompt */}
          {tabModal === 'system_prompt' && editando && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editando.codigo_ubicacion}
              campos={{
                prompt_insert: form.prompt_insert,
                prompt_update: form.prompt_update,
                system_prompt: form.system_prompt,
                python_insert: form.python_insert,
                python_update: form.python_update,
                javascript: form.javascript,
                python_editado_manual: form.python_editado_manual,
                javascript_editado_manual: form.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
              mostrarPromptInsert={false}
              mostrarPromptUpdate={false}
              mostrarSystemPrompt={true}
              mostrarPythonInsert={false}
              mostrarPythonUpdate={false}
              mostrarJavaScript={false}
            />
          )}

          {/* Tab Programación Insert */}
          {tabModal === 'programacion_insert' && editando && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editando.codigo_ubicacion}
              campos={{
                prompt_insert: form.prompt_insert,
                prompt_update: form.prompt_update,
                system_prompt: form.system_prompt,
                python_insert: form.python_insert,
                python_update: form.python_update,
                javascript: form.javascript,
                python_editado_manual: form.python_editado_manual,
                javascript_editado_manual: form.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptUpdate={false}
              mostrarPythonUpdate={false}
            />
          )}
          {/* Tab Programación Update */}
          {tabModal === 'programacion_update' && editando && (
            <TabPrompts
              tabla="ubicaciones_docs"
              pkColumna="codigo_ubicacion"
              pkValor={editando.codigo_ubicacion}
              campos={{
                prompt_insert: form.prompt_insert,
                prompt_update: form.prompt_update,
                system_prompt: form.system_prompt,
                python_insert: form.python_insert,
                python_update: form.python_update,
                javascript: form.javascript,
                python_editado_manual: form.python_editado_manual,
                javascript_editado_manual: form.javascript_editado_manual,
              }}
              onCampoCambiado={(c, v) => setForm({ ...form, [c]: v })}
              mostrarSystemPrompt={false}
              mostrarJavaScript={false}
              mostrarPromptInsert={false}
              mostrarPythonInsert={false}
            />
          )}

          {/* Tab .md */}
          {editando && tabModal === 'md' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-texto">Markdown generado (solo lectura)</label>
                <textarea
                  value={md}
                  readOnly
                  rows={13}
                  placeholder="Sin contenido. Presiona Generar para crear el documento Markdown."
                  className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto font-mono focus:outline-none resize-none cursor-default"
                />
              </div>
              {mensajeMd && (
                <p className={`text-xs px-1 ${mensajeMd.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {mensajeMd.texto}
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Boton
                    className="bg-primario-hover hover:bg-primario text-white focus:ring-primario"
                    onClick={async () => {
                      setGenerandoMd(true); setMensajeMd(null)
                      try {
                        const r = await ubicacionesDocsApi.generarMd(editando.codigo_ubicacion)
                        setMd(r.md)
                        setMensajeMd({ tipo: 'ok', texto: 'Markdown generado correctamente.' })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al generar' })
                      } finally { setGenerandoMd(false) }
                    }}
                    cargando={generandoMd}
                    disabled={generandoMd || sincronizandoMd}
                  >
                    Generar
                  </Boton>
                  <Boton
                    variante="accion-sincronizar"
                    onClick={async () => {
                      setSincronizandoMd(true); setMensajeMd(null)
                      try {
                        const r = await promptsApi.sincronizarFila('ubicaciones_docs', 'codigo_ubicacion', editando.codigo_ubicacion)
                        setMensajeMd({ tipo: 'ok', texto: tc('documentoListoParaVectorizar', { accion: r.accion, codigo: r.codigo_documento }) })
                      } catch (e) {
                        setMensajeMd({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al sincronizar' })
                      } finally { setSincronizandoMd(false) }
                    }}
                    cargando={sincronizandoMd}
                    disabled={generandoMd || sincronizandoMd || !md}
                  >
                    Sincronizar
                  </Boton>
                </div>
                <Boton variante="contorno" onClick={() => setModal(false)}>{tc('salir')}</Boton>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {tabModal !== 'md' && (
          <PieBotonesModal
            editando={!!editando}
            onGuardar={() => guardar(false)}
            onGuardarYSalir={() => guardar(true)}
            onCerrar={() => setModal(false)}
            cargando={guardando}
            botonesIzquierda={(tabModal === 'system_prompt' || tabModal === 'programacion_insert' || tabModal === 'programacion_update') && editando ? (
              <PieBotonesPrompts
                tabla="ubicaciones_docs"
                pkColumna="codigo_ubicacion"
                pkValor={editando.codigo_ubicacion}
                promptInsert={form.prompt_insert || undefined}
                promptUpdate={form.prompt_update || undefined}
                modo={tabModal === 'programacion_update' ? 'update' : 'insert'}
              />
            ) : undefined}
          />
          )}
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
        className="min-h-[680px]"
      />

      {/* Modal Error — directorio fuera del árbol */}
      <Modal
        abierto={!!modalErrorArbol}
        alCerrar={() => setModalErrorArbol(null)}
        titulo="Directorio no permitido"
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-start">
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-error" />
            </div>
            <div className="text-sm text-texto-muted pt-1">
              <p className="font-medium text-texto mb-1">
                &ldquo;{modalErrorArbol?.nombreNuevo}&rdquo; no pertenece al árbol de ubicaciones.
              </p>
              <p>
                Solo se pueden agregar directorios que sean ancestros o descendientes del árbol existente.
              </p>
              {modalErrorArbol?.raices && (
                <p className="mt-2">
                  <span className="font-medium">Raíces actuales:</span> {modalErrorArbol.raices}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Boton variante="primario" onClick={() => setModalErrorArbol(null)}>
              Entendido
            </Boton>
          </div>
        </div>
      </Modal>

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

      {/* Modal Indexar Ubicaciones */}
      <Modal
        abierto={modalCarga}
        alCerrar={cerrarModalCarga}
        titulo={t('cargarDesdeDirectorioTitulo')}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4">
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

              {/* Preview del árbol escaneado — colapsable, parte cerrado */}
              <div className="border border-borde rounded-lg max-h-[300px] overflow-y-auto overflow-x-auto">
                <div className="py-1 w-max min-w-full">
                  {(() => {
                    const { filtrados: dirsFiltrados } = filtrarPorInhabilitadas(datosEscaneo.directorios)
                    const codsFiltrados = new Set(dirsFiltrados.map((d) => d.codigo_ubicacion))
                    const tieneHijos = new Set<string>()
                    for (const d of datosEscaneo.directorios) {
                      if (d.codigo_ubicacion_superior) tieneHijos.add(d.codigo_ubicacion_superior)
                    }
                    const visibles = datosEscaneo.directorios.filter((d) =>
                      !d.codigo_ubicacion_superior || expandidosScan.has(d.codigo_ubicacion_superior)
                    )
                    return visibles.map((d) => {
                      const esNueva = !arbolCompletoCache.some((u) => u.codigo_ubicacion === d.codigo_ubicacion)
                      const esExcluida = !codsFiltrados.has(d.codigo_ubicacion)
                      const expandible = tieneHijos.has(d.codigo_ubicacion)
                      const expandido = expandidosScan.has(d.codigo_ubicacion)
                      return (
                        <div
                          key={d.codigo_ubicacion}
                          className={`flex items-center gap-1 px-3 py-1.5 text-sm ${esExcluida ? 'opacity-40' : ''}`}
                          style={{ paddingLeft: `${d.nivel * 20 + 8}px` }}
                        >
                          {expandible ? (
                            <button
                              type="button"
                              onClick={() => {
                                setExpandidosScan((prev) => {
                                  const s = new Set(prev)
                                  if (s.has(d.codigo_ubicacion)) s.delete(d.codigo_ubicacion)
                                  else s.add(d.codigo_ubicacion)
                                  return s
                                })
                              }}
                              className="p-0.5 hover:bg-fondo rounded shrink-0"
                              aria-label={expandido ? 'Colapsar' : 'Expandir'}
                            >
                              {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          ) : (
                            <span className="w-[22px] shrink-0" />
                          )}
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

              <div className="sticky bottom-0 bg-surface flex gap-3 justify-end pt-3 pb-1 -mx-6 px-6 border-t border-borde">
                <Boton variante="contorno" onClick={cerrarModalCarga} disabled={sincronizando}>
                  {tc('salir')}
                </Boton>
                <Boton variante="accion-sincronizar" onClick={ejecutarSincronizacion} cargando={sincronizando}>
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
                <p className="text-lg font-medium text-green-800">{tdlx('sincronizacionCompletada')}</p>
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
                  {tc('salir')}
                </Boton>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
