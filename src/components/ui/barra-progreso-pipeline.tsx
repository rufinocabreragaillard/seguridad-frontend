interface SegmentoProgreso {
  color: string
  total: number
  completados: number
  estado: 'esperando' | 'activo' | 'listo' | 'error'
}

interface BarraProgresoPipelineProps {
  segmentos: SegmentoProgreso[]
  altura?: number
}

export function BarraProgresoPipeline({ segmentos, altura = 32 }: BarraProgresoPipelineProps) {
  return (
    <div className="flex w-full overflow-hidden rounded-lg" style={{ height: altura, gap: 3 }}>
      {segmentos.map((seg, i) => {
        const pct =
          seg.estado === 'listo' || seg.estado === 'error'
            ? 100
            : seg.total > 0
            ? (seg.completados / seg.total) * 100
            : 0

        const isFirst = i === 0
        const isLast = i === segmentos.length - 1
        const radius = `${isFirst ? '8px' : '3px'} ${isLast ? '8px' : '3px'} ${isLast ? '8px' : '3px'} ${isFirst ? '8px' : '3px'}`
        const fillColor = seg.estado === 'error' ? '#EF4444' : seg.color

        return (
          <div
            key={i}
            className="flex-1 relative overflow-hidden"
            style={{ borderRadius: radius, backgroundColor: '#E5E7EB' }}
          >
            {/* Barra de progreso */}
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: fillColor,
                opacity: seg.estado === 'esperando' ? 0.3 : 1,
              }}
            />
            {/* Pulso cuando está activo */}
            {seg.estado === 'activo' && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{ backgroundColor: fillColor, opacity: 0.12 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
