'use client'

/**
 * Dial de 3 anillos concéntricos — "reloj invertido".
 *
 * - Anillo externo  → progreso de LOTES (paquete X de Y)
 * - Anillo medio    → progreso de ETAPAS dentro del lote actual (4 etapas)
 * - Anillo interno  → progreso de la ETAPA activa (archivo N de M)
 *
 * Los tres anillos arrancan en las 12 en punto y avanzan en sentido ANTIHORARIO
 * (efecto "reloj invertido"): visualmente el aro se llena hacia la izquierda.
 *
 * Centro: % global del trabajo total + nombre de la etapa activa abajo en chico.
 */

interface AnilloProps {
  /** Progreso normalizado 0..1 */
  progreso: number
  /** Radio del anillo en px */
  radio: number
  /** Grosor del trazo */
  grosor: number
  /** Color de la parte llena */
  color: string
  /** Color del track (parte vacía). Default gris suave. */
  colorTrack?: string
  /** Si true, el anillo activo "pulsa" suavemente */
  activo?: boolean
}

function Anillo({ progreso, radio, grosor, color, colorTrack = '#E5E7EB', activo = false }: AnilloProps) {
  const circunferencia = 2 * Math.PI * radio
  const lleno = Math.max(0, Math.min(1, progreso)) * circunferencia
  const vacio = circunferencia - lleno

  return (
    <g>
      {/* Track (fondo del anillo) */}
      <circle
        cx={0}
        cy={0}
        r={radio}
        fill="none"
        stroke={colorTrack}
        strokeWidth={grosor}
      />
      {/* Llenado.  transform invierte el sentido a antihorario y arranca en 12:00. */}
      <circle
        cx={0}
        cy={0}
        r={radio}
        fill="none"
        stroke={color}
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeDasharray={`${lleno} ${vacio}`}
        // rotate(-90) lleva el inicio del stroke a las 12 en punto.
        // scale(-1,1) invierte el sentido del dibujo del stroke → antihorario.
        transform="rotate(-90) scale(-1,1)"
        style={{
          transition: 'stroke-dasharray 500ms ease-out',
          opacity: activo ? 1 : 0.85,
        }}
      >
        {activo && (
          <animate
            attributeName="opacity"
            values="0.7;1;0.7"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    </g>
  )
}

interface DialTripleProps {
  /** Lote actual y total de lotes (anillo externo). */
  lote: { actual: number; total: number }
  /** Etapas: índice activo (0..total-1) y total (anillo medio). */
  etapa: { indiceActivo: number; total: number; nombre?: string }
  /** Etapa activa: completados y total (anillo interno). */
  actual: { completados: number; total: number }
  /** Indica qué anillo está pulsando ahora. */
  pulsando?: 'externo' | 'medio' | 'interno' | null
  /** Colores por anillo. */
  colorExterno?: string
  colorMedio?: string
  colorInterno?: string
  /** Diámetro total del dial en px. Default 220. */
  tamano?: number
  /** Si false, los tres anillos y el % se renderizan en 0 (estado "no iniciado"). Default true. */
  ejecutando?: boolean
}

export function DialTriple({
  lote,
  etapa,
  actual,
  pulsando = 'interno',
  colorExterno = '#074B91',
  colorMedio = '#0EA5E9',
  colorInterno = '#22C55E',
  tamano = 220,
  ejecutando = true,
}: DialTripleProps) {
  const cx = tamano / 2
  const cy = tamano / 2

  // Grosor y radios calculados para que los 3 aros entren cómodos.
  const grosor = Math.max(6, Math.round(tamano * 0.045))
  const margen = Math.round(tamano * 0.03)
  const rExterno = cx - grosor / 2 - margen
  const rMedio = rExterno - grosor - margen
  const rInterno = rMedio - grosor - margen

  // Progresos normalizados. Si !ejecutando, se fuerzan a 0 (estado "no iniciado")
  // para que la rueda no aparezca "llena" cuando aún no se ha empezado nada.
  const progLote = ejecutando && lote.total > 0 ? lote.actual / lote.total : 0
  const progEtapa = ejecutando && etapa.total > 0 ? (etapa.indiceActivo + 1) / etapa.total : 0
  const progActual = ejecutando && actual.total > 0 ? actual.completados / actual.total : 0

  // % global = combinación ponderada. Cada lote vale 1/lote.total del total.
  // Dentro del lote, el progreso es (etapa completas + fracción de etapa activa) / etapa.total.
  const fraccionLote = etapa.total > 0
    ? (etapa.indiceActivo + progActual) / etapa.total
    : 0
  const pctGlobal = !ejecutando
    ? 0
    : lote.total > 0
      ? Math.min(100, Math.round(((Math.max(0, lote.actual - 1) + fraccionLote) / lote.total) * 100))
      : Math.round(progActual * 100)

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg
        width={tamano}
        height={tamano}
        viewBox={`0 0 ${tamano} ${tamano}`}
        role="img"
        aria-label={`Progreso: ${pctGlobal}% — lote ${lote.actual} de ${lote.total}, etapa ${etapa.indiceActivo + 1} de ${etapa.total}`}
      >
        <g transform={`translate(${cx} ${cy})`}>
          <Anillo
            progreso={progLote}
            radio={rExterno}
            grosor={grosor}
            color={colorExterno}
            activo={pulsando === 'externo'}
          />
          <Anillo
            progreso={progEtapa}
            radio={rMedio}
            grosor={grosor}
            color={colorMedio}
            activo={pulsando === 'medio'}
          />
          <Anillo
            progreso={progActual}
            radio={rInterno}
            grosor={grosor}
            color={colorInterno}
            activo={pulsando === 'interno'}
          />
        </g>
        {/* Centro: % global + nombre de etapa */}
        <text
          x={cx}
          y={cy - (etapa.nombre ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-texto"
          style={{ fontSize: Math.round(tamano * 0.18), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {pctGlobal}%
        </text>
        {etapa.nombre && (() => {
          const fontEtapa = Math.round(tamano * 0.055)
          const maxAncho = Math.round(rInterno * 2 * 0.85)
          // Ancho natural estimado (≈0.62·fontSize por glifo en mayúsculas + letterSpacing).
          // Solo COMPRIMIMOS etiquetas que se saldrían; nunca estiramos las cortas
          // (textLength con lengthAdjust estira los glifos → efecto "ensanchado").
          const anchoNatural = etapa.nombre.length * fontEtapa * 0.62 + (etapa.nombre.length - 1) * fontEtapa * 0.04
          const necesitaComprimir = anchoNatural > maxAncho
          return (
            <text
              x={cx}
              y={cy + Math.round(tamano * 0.13)}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-texto-muted"
              {...(necesitaComprimir ? { textLength: maxAncho, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
              style={{ fontSize: fontEtapa, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              {etapa.nombre}
            </text>
          )
        })()}
      </svg>

      {/* Leyenda mínima debajo del dial: lote actual / etapa actual / archivo actual */}
      <div className="flex items-center gap-3 text-[10px] tabular-nums text-texto-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colorExterno }} />
          Lote {lote.actual}/{lote.total}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colorMedio }} />
          Etapa {Math.min(etapa.indiceActivo + 1, etapa.total)}/{etapa.total}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colorInterno }} />
          {actual.completados.toLocaleString()}/{actual.total.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
