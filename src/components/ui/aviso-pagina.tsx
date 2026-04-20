'use client'

import { useSyncExternalStore } from 'react'
import { AlertTriangle } from 'lucide-react'
import { obtenerAvisos, suscribir, type Aviso } from '@/lib/avisos-pagina'

/**
 * Banner rojo que se muestra cuando hay problemas detectados en la pantalla:
 *  - Traducciones estáticas faltantes (bug de deploy / idioma nuevo incompleto)
 *  - Timeouts de carga
 *  - Avisos genéricos registrados por servicios
 *
 * Se renderiza una sola vez en AdminLayout (arriba del contenido). Como lee
 * del store global, aparece automáticamente en cualquier página admin sin
 * tocar cada página. Se limpia al cambiar de ruta (ver AdminLayout).
 *
 * Textos hardcoded en español a propósito: si la librería de traducción está
 * rota, el banner igual tiene que mostrarse coherente.
 */
export function AvisoPagina() {
  const avisos = useSyncExternalStore(suscribir, obtenerAvisos, () => [])

  if (avisos.length === 0) return null

  const porTipo = {
    i18n: avisos.filter((a) => a.tipo === 'i18n'),
    timeout: avisos.filter((a) => a.tipo === 'timeout'),
    generico: avisos.filter((a) => a.tipo === 'generico'),
  }

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
      <div className="flex-1 space-y-2">
        <p className="font-semibold">Hay un problema en esta pantalla</p>

        {porTipo.i18n.length > 0 && (
          <BloqueAvisos
            titulo={`Traducciones faltantes (${porTipo.i18n.length})`}
            descripcion="La pantalla puede mostrar identificadores técnicos en lugar de los textos traducidos. Contacta al administrador para regenerar las traducciones desde el mantenedor de Idiomas."
            items={porTipo.i18n}
          />
        )}

        {porTipo.timeout.length > 0 && (
          <BloqueAvisos
            titulo="La carga está tardando más de lo esperado"
            descripcion="Puede ser un problema temporal del servidor. Intenta recargar la página en unos segundos."
            items={porTipo.timeout}
          />
        )}

        {porTipo.generico.length > 0 && (
          <BloqueAvisos titulo="Otros avisos" descripcion="" items={porTipo.generico} />
        )}
      </div>
    </div>
  )
}

function BloqueAvisos({
  titulo,
  descripcion,
  items,
}: {
  titulo: string
  descripcion: string
  items: Aviso[]
}) {
  const muestra = items.slice(0, 5)
  const restantes = items.length - muestra.length

  return (
    <div>
      <p className="font-medium">{titulo}</p>
      {descripcion && <p className="text-xs text-red-700 mt-0.5">{descripcion}</p>}
      <ul className="mt-1 text-xs font-mono text-red-900 list-disc list-inside">
        {muestra.map((a) => (
          <li key={a.clave}>{a.detalle}</li>
        ))}
        {restantes > 0 && <li className="italic">…y {restantes} más</li>}
      </ul>
    </div>
  )
}
