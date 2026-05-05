'use client'

import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'

interface VisorState {
  url: string
  nombre: string
}

export function VisorDocumento() {
  const [visor, setVisor] = useState<VisorState | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const { url, nombre } = (e as CustomEvent<VisorState>).detail
      setVisor({ url, nombre })
    }
    window.addEventListener('serverlm:preview', handler)
    return () => window.removeEventListener('serverlm:preview', handler)
  }, [])

  if (!visor) return null

  const cerrar = () => {
    URL.revokeObjectURL(visor.url)
    setVisor(null)
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/90">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a2e] border-b border-white/10 shrink-0">
        <span className="text-sm text-white/80 font-medium truncate max-w-[70%]" title={visor.nombre}>
          {visor.nombre}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={visor.url}
            download={visor.nombre}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
          >
            <Download size={13} />
            Descargar
          </a>
          <button
            onClick={cerrar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
          >
            <X size={13} />
            Cerrar
          </button>
        </div>
      </div>
      {/* Contenido */}
      <div className="flex-1 min-h-0">
        <iframe
          src={visor.url}
          className="w-full h-full border-0"
          title={visor.nombre}
        />
      </div>
    </div>
  )
}
