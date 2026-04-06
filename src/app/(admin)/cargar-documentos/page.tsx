'use client'

import { useEffect, useState, useCallback } from 'react'
import { Upload, FolderOpen, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Insignia } from '@/components/ui/insignia'
import { useAuth } from '@/context/AuthContext'
import { ubicacionesDocsApi, cargaDocumentosApi } from '@/lib/api'
import { escanearArchivosDirectorio, soportaDirectoryPicker, type ArchivoEscaneado } from '@/lib/escanear-directorio'
import type { UbicacionDoc } from '@/lib/tipos'

export default function PaginaCargarDocumentos() {
  const { grupoActivo } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [ubicaciones, setUbicaciones] = useState<UbicacionDoc[]>([])
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(true)

  // Escaneo
  const [escaneando, setEscaneando] = useState(false)
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

  // ── Cargar ubicaciones de BD ──────────────────────────────────────────────
  const cargarUbicaciones = useCallback(async () => {
    setCargandoUbicaciones(true)
    try {
      setUbicaciones(await ubicacionesDocsApi.listar())
    } finally {
      setCargandoUbicaciones(false)
    }
  }, [])

  useEffect(() => { cargarUbicaciones() }, [cargarUbicaciones])

  // ── Escanear directorio ───────────────────────────────────────────────────
  const iniciarEscaneo = async () => {
    if (!soportaDirectoryPicker()) {
      alert('Su navegador no soporta la selección de directorios. Use Chrome, Edge o Safari.')
      return
    }
    setEscaneando(true)
    setResultado(null)
    setDatosEscaneo(null)
    try {
      const scan = await escanearArchivosDirectorio()
      if (!scan) {
        setEscaneando(false)
        return
      }

      // Mapas de ubicaciones BD
      const rutasHabilitadas = new Set<string>()
      const rutasNoHabilitadas = new Set<string>()
      const todasRutasBD = new Set<string>()

      for (const u of ubicaciones) {
        if (u.ruta_completa) {
          todasRutasBD.add(u.ruta_completa)
          if (u.ubicacion_habilitada && u.activo) {
            rutasHabilitadas.add(u.ruta_completa)
          } else {
            rutasNoHabilitadas.add(u.ruta_completa)
          }
        }
      }

      // Clasificar archivos
      const archivosConMatch: ArchivoEscaneado[] = []
      const archivosEnNoHabilitadas: ArchivoEscaneado[] = []

      for (const archivo of scan.archivos) {
        if (rutasHabilitadas.has(archivo.ruta_directorio)) {
          archivosConMatch.push(archivo)
        } else if (rutasNoHabilitadas.has(archivo.ruta_directorio)) {
          archivosEnNoHabilitadas.push(archivo)
        }
      }

      // Carpetas sin match en BD
      const carpetasSinMatch = scan.rutasEscaneadas.filter(
        (ruta) => !todasRutasBD.has(ruta)
      )

      setDatosEscaneo({
        nombreRaiz: scan.nombreRaiz,
        archivos: scan.archivos,
        carpetasSinMatch,
        archivosConMatch,
        archivosEnNoHabilitadas,
      })
    } catch {
      alert('Error al escanear el directorio.')
    } finally {
      setEscaneando(false)
    }
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
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const ubicacionesHabilitadas = ubicaciones.filter((u) => u.ubicacion_habilitada && u.activo)

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
      <div className="border border-borde rounded-lg bg-fondo-tarjeta p-4">
        <h3 className="text-sm font-medium text-texto mb-2">Ubicaciones habilitadas</h3>
        {cargandoUbicaciones ? (
          <p className="text-sm text-texto-muted">Cargando...</p>
        ) : ubicacionesHabilitadas.length === 0 ? (
          <p className="text-sm text-texto-muted">No hay ubicaciones habilitadas. Configure ubicaciones en la página de Ubicaciones Docs.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ubicacionesHabilitadas.map((u) => (
              <Insignia key={u.codigo_ubicacion} variante="primario">
                {u.ruta_completa || u.nombre_ubicacion}
              </Insignia>
            ))}
          </div>
        )}
      </div>

      {/* Botón escanear */}
      {!datosEscaneo && !resultado && (
        <div className="border-2 border-dashed border-borde rounded-lg p-8 text-center">
          <Upload size={48} className="mx-auto text-texto-muted/50 mb-4" />
          <p className="text-texto mb-2">Seleccione un directorio para escanear sus archivos</p>
          <p className="text-sm text-texto-muted mb-4">
            Solo se cargarán archivos de directorios que coincidan con ubicaciones habilitadas en el sistema
          </p>
          <Boton
            variante="primario"
            onClick={iniciarEscaneo}
            cargando={escaneando}
            disabled={ubicacionesHabilitadas.length === 0}
          >
            <FolderOpen size={16} />
            Seleccionar directorio
          </Boton>
        </div>
      )}

      {/* Preview */}
      {datosEscaneo && !resultado && (
        <div className="flex flex-col gap-4">
          {/* Resumen del escaneo */}
          <div className="bg-fondo rounded-lg p-4 flex items-center gap-3">
            <FolderOpen size={24} className="text-primario shrink-0" />
            <div>
              <p className="font-medium text-texto">{datosEscaneo.nombreRaiz}</p>
              <p className="text-sm text-texto-muted">
                {datosEscaneo.archivos.length} archivo{datosEscaneo.archivos.length !== 1 ? 's' : ''} encontrado{datosEscaneo.archivos.length !== 1 ? 's' : ''} en total
              </p>
            </div>
          </div>

          {/* Contadores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{datosEscaneo.archivosConMatch.length}</p>
              <p className="text-xs text-texto-muted">A cargar</p>
            </div>
            <div className="border border-borde rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{datosEscaneo.archivosEnNoHabilitadas.length}</p>
              <p className="text-xs text-texto-muted">En ubicaciones inhabilitadas</p>
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {datosEscaneo.carpetasSinMatch.length} carpeta{datosEscaneo.carpetasSinMatch.length !== 1 ? 's' : ''} sin ubicación en BD
                  </p>
                  <div className="mt-1 max-h-[120px] overflow-y-auto">
                    {datosEscaneo.carpetasSinMatch.slice(0, 20).map((ruta) => (
                      <p key={ruta} className="text-xs text-amber-700">{ruta}</p>
                    ))}
                    {datosEscaneo.carpetasSinMatch.length > 20 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ...y {datosEscaneo.carpetasSinMatch.length - 20} más
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview archivos (primeros 30) */}
          {datosEscaneo.archivosConMatch.length > 0 && (
            <div className="border border-borde rounded-lg max-h-[300px] overflow-y-auto">
              <div className="py-1">
                {datosEscaneo.archivosConMatch.slice(0, 30).map((a, i) => (
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
                {datosEscaneo.archivosConMatch.length > 30 && (
                  <p className="px-4 py-2 text-xs text-texto-muted text-center">
                    ...y {datosEscaneo.archivosConMatch.length - 30} archivo(s) más
                  </p>
                )}
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
