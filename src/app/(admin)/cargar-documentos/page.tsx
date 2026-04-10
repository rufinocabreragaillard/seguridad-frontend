'use client'

import { useEffect, useState, useCallback } from 'react'
import { Upload, FolderOpen, FileText, AlertTriangle, CheckCircle, Search, Folder, Loader2 } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { useAuth } from '@/context/AuthContext'
import { ubicacionesDocsApi, cargaDocumentosApi, parametrosApi } from '@/lib/api'
import { escanearArchivosDirectorio, soportaDirectoryPicker, type ArchivoEscaneado } from '@/lib/escanear-directorio'
import { getDirectoryHandle as idbGetHandle, setDirectoryHandle as idbSetHandle, ensureReadPermission } from '@/lib/file-handle-store'
import type { UbicacionDoc } from '@/lib/tipos'

export default function PaginaCargarDocumentos() {
  const { grupoActivo } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(true)
  const [nivelesDirectorio, setNivelesDirectorio] = useState(5)

  // Directorio
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [escaneando, setEscaneando] = useState(false)

  // Escaneo
  const [datosEscaneo, setDatosEscaneo] = useState<{
    nombreRaiz: string
    archivos: ArchivoEscaneado[]
    carpetasSinMatch: string[]
    archivosConMatch: ArchivoEscaneado[]
    archivosEnNoHabilitadas: ArchivoEscaneado[]
  } | null>(null)

  // Carga
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<{
    insertados: number
    actualizados: number
    total: number
  } | null>(null)

  // Filtro de preview
  const [busquedaArchivos, setBusquedaArchivos] = useState('')

  // ── Cargar ubicaciones, parámetro y dirHandle persistido ──────────────────
  const cargarUbicaciones = useCallback(async () => {
    setCargandoUbicaciones(true)
    try {
      setUbicaciones(await ubicacionesDocsApi.listar())
    } finally {
      setCargandoUbicaciones(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const [, nivelParam] = await Promise.all([
        cargarUbicaciones(),
        parametrosApi.obtenerValor('DOCUMENTOS', 'NIVELES_DIRECTORIO').catch(() => null),
      ])
      if (nivelParam?.valor != null) {
        const n = parseInt(nivelParam.valor, 10)
        if (!isNaN(n) && n >= 0 && n <= 5) setNivelesDirectorio(n)
      }

      // Restaurar dirHandle persistido
      const h = await idbGetHandle()
      if (!h) return
      try {
        const perm = await (h as unknown as { queryPermission: (opts: { mode: string }) => Promise<PermissionState> }).queryPermission({ mode: 'read' })
        if (perm === 'granted') setDirHandle(h)
      } catch { /* ignore */ }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Clasificar archivos del escaneo ───────────────────────────────────────
  const clasificarEscaneo = useCallback((
    scan: Awaited<ReturnType<typeof escanearArchivosDirectorio>> & object,
    ubicacionesActuales: UbicacionDoc[],
  ) => {
    const nombreRaiz = scan.nombreRaiz
    const rutaRaizFS = `/${nombreRaiz}`

    const ubicacionRaiz = ubicacionesActuales.find(
      (u) => u.ruta_completa?.endsWith(`/${nombreRaiz}`) || u.ruta_completa === `/${nombreRaiz}`
    )
    let prefijoRemap = ''
    if (ubicacionRaiz?.ruta_completa) {
      const rutaBD = ubicacionRaiz.ruta_completa
      prefijoRemap = rutaBD.slice(0, rutaBD.length - rutaRaizFS.length)
    }
    const remapear = (rutaFS: string) => prefijoRemap + rutaFS

    const rutasHabilitadas = new Set<string>()
    const rutasNoHabilitadas = new Set<string>()
    const todasRutasBD = new Set<string>()
    for (const u of ubicacionesActuales) {
      if (u.ruta_completa) {
        todasRutasBD.add(u.ruta_completa)
        if (u.ubicacion_habilitada && u.activo) rutasHabilitadas.add(u.ruta_completa)
        else rutasNoHabilitadas.add(u.ruta_completa)
      }
    }

    const archivosConMatch: ArchivoEscaneado[] = []
    const archivosEnNoHabilitadas: ArchivoEscaneado[] = []
    for (const archivo of scan.archivos) {
      const rutaBD = remapear(archivo.ruta_directorio)
      if (rutasHabilitadas.has(rutaBD)) {
        archivosConMatch.push({ ...archivo, ruta_directorio: rutaBD, ruta_completa: remapear(archivo.ruta_completa) })
      } else if (rutasNoHabilitadas.has(rutaBD)) {
        archivosEnNoHabilitadas.push(archivo)
      }
    }

    const carpetasSinMatch = scan.rutasEscaneadas
      .map(remapear)
      .filter((ruta) => !todasRutasBD.has(ruta))

    return { nombreRaiz: scan.nombreRaiz, archivos: scan.archivos, carpetasSinMatch, archivosConMatch, archivosEnNoHabilitadas }
  }, [])

  // ── Escanear usando handle dado (sin abrir picker) ────────────────────────
  const ejecutarEscaneo = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setEscaneando(true)
    setResultado(null)
    setDatosEscaneo(null)
    setBusquedaArchivos('')
    try {
      const scan = await escanearArchivosDirectorio(handle, nivelesDirectorio)
      if (!scan) return
      // ubicaciones puede haberse cargado después del init; leemos el estado fresco
      setUbicaciones((prev) => {
        setDatosEscaneo(clasificarEscaneo(scan, prev))
        return prev
      })
    } catch {
      alert('Error al escanear el directorio.')
    } finally {
      setEscaneando(false)
    }
  }, [nivelesDirectorio, clasificarEscaneo])

  // ── Seleccionar directorio (picker) ───────────────────────────────────────
  const seleccionarDirectorio = async () => {
    if (!soportaDirectoryPicker()) {
      alert('Su navegador no soporta la selección de directorios. Use Chrome, Edge o Safari.')
      return
    }
    try {
      const opts: Record<string, unknown> = { mode: 'read', id: 'cab-procesar-docs' }
      if (dirHandle) opts.startIn = dirHandle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showDirectoryPicker(opts)
      setDirHandle(handle)
      idbSetHandle(handle)
      await ejecutarEscaneo(handle)
    } catch { /* cancelado */ }
  }

  // ── Ejecutar carga ────────────────────────────────────────────────────────
  const ejecutarCarga = async () => {
    if (!datosEscaneo) return
    setCargando(true)
    try {
      const res = await cargaDocumentosApi.cargar({
        archivos: datosEscaneo.archivosConMatch.map((a) => ({
          nombre: a.nombre,
          ruta_completa: a.ruta_completa,
          ruta_directorio: a.ruta_directorio,
          tamano_kb: a.tamano_kb,
          fecha_modificacion: a.fecha_modificacion,
        })),
      })
      setResultado(res)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al cargar documentos.'
        : 'Error al cargar documentos.'
      alert(msg)
    } finally {
      setCargando(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetear = () => {
    setDatosEscaneo(null)
    setResultado(null)
    setBusquedaArchivos('')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const ubicacionesHabilitadas = ubicaciones.filter((u) => u.ubicacion_habilitada && u.activo)
  const carpetaRaiz = ubicaciones.length > 0
    ? ubicaciones.reduce((min, u) => (u.nivel ?? 99) < (min.nivel ?? 99) ? u : min, ubicaciones[0])
    : null

  const archivosFiltrados = datosEscaneo
    ? busquedaArchivos
      ? datosEscaneo.archivosConMatch.filter((a) =>
          a.nombre.toLowerCase().includes(busquedaArchivos.toLowerCase()) ||
          a.ruta_directorio.toLowerCase().includes(busquedaArchivos.toLowerCase())
        )
      : datosEscaneo.archivosConMatch
    : []

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-texto">Cargar Documentos</h2>
        <p className="text-sm text-texto-muted mt-1">
          Carga documentos desde un directorio local a las ubicaciones habilitadas en el sistema
        </p>
      </div>

      {/* Info ubicaciones */}
      <div className="border border-borde rounded-lg bg-fondo-tarjeta p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Folder size={20} className="text-primario shrink-0" />
          <div>
            <p className="text-sm font-medium text-texto">
              {cargandoUbicaciones ? 'Cargando...' : `${ubicacionesHabilitadas.length} ubicaciones habilitadas`}
            </p>
            <p className="text-xs text-texto-muted">
              {!cargandoUbicaciones && ubicaciones.length > 0
                ? `de ${ubicaciones.length} totales en el grupo`
                : 'Configure ubicaciones en Ubicaciones Docs'}
            </p>
          </div>
        </div>
        {!cargandoUbicaciones && ubicacionesHabilitadas.length > 0 && (
          <Insignia variante="exito">{ubicacionesHabilitadas.length} activas</Insignia>
        )}
      </div>

      {/* Selector de directorio */}
      {!datosEscaneo && !resultado && (
        <div className="border-2 border-dashed border-borde rounded-lg p-8 text-center flex flex-col items-center gap-4">
          <Upload size={48} className="text-texto-muted/50" />
          <div>
            <p className="text-texto mb-1">Seleccione el directorio raíz para escanear</p>
            <p className="text-sm text-texto-muted">
              Solo se cargarán archivos de directorios que coincidan con ubicaciones habilitadas
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Boton
              variante="primario"
              onClick={seleccionarDirectorio}
              disabled={ubicacionesHabilitadas.length === 0 || escaneando}
            >
              {escaneando
                ? <><Loader2 size={16} className="animate-spin" />Escaneando...</>
                : <><FolderOpen size={16} />{dirHandle ? `📂 ${dirHandle.name}` : 'Seleccionar directorio raíz'}</>
              }
            </Boton>
            {dirHandle && !escaneando && (
              <Boton variante="contorno" onClick={() => ejecutarEscaneo(dirHandle!)}>
                Re-escanear
              </Boton>
            )}
          </div>

          {/* Hint de carpeta raíz + niveles */}
          <p className="text-xs text-texto-muted">
            {carpetaRaiz?.ruta_completa
              ? <>Selecciona la carpeta raíz: <strong className="text-texto">{carpetaRaiz.ruta_completa.split('/').filter(Boolean)[0] ?? carpetaRaiz.ruta_completa}</strong> (no subcarpetas) · </>
              : null}
            {nivelesDirectorio === 0 ? 'Solo raíz' : `Hasta ${nivelesDirectorio} nivel${nivelesDirectorio !== 1 ? 'es' : ''}`}
            {' '}· configurable en Parámetros → DOCUMENTOS/NIVELES_DIRECTORIO
          </p>
        </div>
      )}

      {/* Preview */}
      {datosEscaneo && !resultado && (
        <div className="flex flex-col gap-4">
          {/* Resumen del escaneo */}
          <div className="bg-fondo rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderOpen size={24} className="text-primario shrink-0" />
              <div>
                <p className="font-medium text-texto">{datosEscaneo.nombreRaiz}</p>
                <p className="text-sm text-texto-muted">
                  {datosEscaneo.archivos.length} archivo{datosEscaneo.archivos.length !== 1 ? 's' : ''} encontrados
                  {' '}· {nivelesDirectorio === 0 ? 'Solo raíz' : `${nivelesDirectorio} nivel${nivelesDirectorio !== 1 ? 'es' : ''}`}
                </p>
              </div>
            </div>
            <Boton variante="contorno" tamano="sm" onClick={seleccionarDirectorio} disabled={escaneando}>
              <FolderOpen size={14} />Cambiar
            </Boton>
          </div>

          {/* Contadores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{datosEscaneo.archivosConMatch.length}</p>
              <p className="text-xs text-texto-muted">A cargar</p>
            </div>
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{datosEscaneo.archivosEnNoHabilitadas.length}</p>
              <p className="text-xs text-texto-muted">En inhabilitadas</p>
            </div>
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-texto-muted">
                {datosEscaneo.archivos.length - datosEscaneo.archivosConMatch.length - datosEscaneo.archivosEnNoHabilitadas.length}
              </p>
              <p className="text-xs text-texto-muted">Sin ubicación en BD</p>
            </div>
          </div>

          {/* Aviso carpetas sin match */}
          {datosEscaneo.carpetasSinMatch.length > 0 && (
            <details className="bg-amber-50 border border-amber-200 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span className="text-sm font-medium text-amber-800">
                  {datosEscaneo.carpetasSinMatch.length} carpeta{datosEscaneo.carpetasSinMatch.length !== 1 ? 's' : ''} sin ubicación en BD
                </span>
              </summary>
              <div className="px-4 pb-3 max-h-[150px] overflow-y-auto border-t border-amber-200 pt-2">
                {datosEscaneo.carpetasSinMatch.map((ruta) => (
                  <p key={ruta} className="text-xs text-amber-700 py-0.5">{ruta}</p>
                ))}
              </div>
            </details>
          )}

          {/* Preview archivos */}
          {datosEscaneo.archivosConMatch.length > 0 && (
            <div className="border border-borde rounded-lg">
              <div className="px-3 py-2 border-b border-borde bg-fondo rounded-t-lg">
                <Input
                  placeholder="Filtrar archivos por nombre o directorio..."
                  value={busquedaArchivos}
                  onChange={(e) => setBusquedaArchivos(e.target.value)}
                  icono={<Search size={14} />}
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <div className="py-1">
                  {archivosFiltrados.slice(0, 30).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-fondo">
                      <FileText size={14} className="text-texto-muted shrink-0" />
                      <span className="flex-1 truncate">{a.nombre}</span>
                      <span className="text-xs text-texto-muted shrink-0">
                        {a.tamano_kb < 1024
                          ? `${a.tamano_kb.toFixed(1)} KB`
                          : `${(a.tamano_kb / 1024).toFixed(1)} MB`}
                      </span>
                      <span className="text-xs text-texto-muted truncate max-w-[200px] hidden lg:block">
                        {a.ruta_directorio}
                      </span>
                    </div>
                  ))}
                  {archivosFiltrados.length > 30 && (
                    <p className="px-4 py-2 text-xs text-texto-muted text-center">
                      ...y {archivosFiltrados.length - 30} archivo(s) más
                    </p>
                  )}
                  {archivosFiltrados.length === 0 && busquedaArchivos && (
                    <p className="px-4 py-3 text-sm text-texto-muted text-center">
                      Sin resultados para &quot;{busquedaArchivos}&quot;
                    </p>
                  )}
                </div>
              </div>
              <div className="px-3 py-2 border-t border-borde bg-fondo rounded-b-lg text-xs text-texto-muted">
                {busquedaArchivos
                  ? `${archivosFiltrados.length} de ${datosEscaneo.archivosConMatch.length} archivos`
                  : `${datosEscaneo.archivosConMatch.length} archivos a cargar`}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={resetear}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              onClick={ejecutarCarga}
              cargando={cargando}
              disabled={datosEscaneo.archivosConMatch.length === 0}
            >
              <Upload size={15} />
              Cargar {datosEscaneo.archivosConMatch.length} documento{datosEscaneo.archivosConMatch.length !== 1 ? 's' : ''}
            </Boton>
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="flex flex-col gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
            <p className="text-lg font-medium text-green-800">Carga completada</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{resultado.insertados}</p>
              <p className="text-xs text-texto-muted">Nuevos</p>
            </div>
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primario">{resultado.actualizados}</p>
              <p className="text-xs text-texto-muted">Actualizados</p>
            </div>
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-texto-muted">{resultado.total}</p>
              <p className="text-xs text-texto-muted">Total procesados</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Boton variante="primario" onClick={resetear}>
              Nueva carga
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}
