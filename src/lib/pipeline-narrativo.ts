// Mapa de etiquetas técnicas del pipeline → copy humano para usuario final.
// Fuente técnica: PASOS de /process-pipeline (CARGAR, EXTRAER, ANALIZAR, CHUNKEAR, VECTORIZAR)
// y estados de docs (CARGADO, METADATA, ESCANEADO, CHUNKEADO, VECTORIZADO).

export type ClavePaso = 'CARGAR' | 'EXTRAER' | 'ANALIZAR' | 'CHUNKEAR' | 'VECTORIZAR'
export type ClaveEstadoDoc = 'CARGADO' | 'METADATA' | 'ESCANEADO' | 'CHUNKEADO' | 'VECTORIZADO'

export interface FaseNarrativa {
  clave: ClavePaso
  estadoDestino: ClaveEstadoDoc
  etiquetaCorta: string  // "CARGANDO" — para tarjetas del pipeline narrativo
  etiquetaLarga: string  // "Cargando documentos" — para mensaje conversacional
  color: string
  i18nKey: string        // clave para useTranslations('pipelineNarrativo')
}

// Las cuatro fases visibles para el usuario final. Mapean a las 5 fases técnicas
// pero presentamos LISTOS como destino final (estado VECTORIZADO) y absorbemos
// EXTRAER+ANALIZAR en una sola "LEYENDO TEXTO" porque son ambas lectura textual.
export const FASES_NARRATIVAS: FaseNarrativa[] = [
  {
    clave: 'CARGAR',
    estadoDestino: 'CARGADO',
    etiquetaCorta: 'CARGANDO',
    etiquetaLarga: 'Cargando documentos',
    color: '#0EA5E9',
    i18nKey: 'faseCargando',
  },
  {
    clave: 'ANALIZAR',
    estadoDestino: 'ESCANEADO',
    etiquetaCorta: 'LEYENDO TEXTO',
    etiquetaLarga: 'Leyendo texto',
    color: '#F97316',
    i18nKey: 'faseLeyendoTexto',
  },
  {
    clave: 'CHUNKEAR',
    estadoDestino: 'CHUNKEADO',
    etiquetaCorta: 'DIVIDIENDO',
    etiquetaLarga: 'Dividiendo en piezas',
    color: '#84CC16',
    i18nKey: 'faseDividiendo',
  },
  {
    clave: 'VECTORIZAR',
    estadoDestino: 'VECTORIZADO',
    etiquetaCorta: 'INDEXANDO',
    etiquetaLarga: 'Indexando',
    color: '#22C55E',
    i18nKey: 'faseIndexando',
  },
]

// Estados terminales que cuentan como "LISTOS" visualmente (no son una fase
// activa, pero su contador se muestra como la 5ª tarjeta).
export const ESTADO_LISTOS = 'VECTORIZADO'

// Estados intermedios que se cuentan como "pendientes" (recuperables).
export const ESTADOS_INTERMEDIOS: ClaveEstadoDoc[] = ['CARGADO', 'METADATA', 'ESCANEADO', 'CHUNKEADO']

// Estados terminales de error (no recuperables).
export const ESTADOS_NO_VECTORIZABLES = [
  'NO_ENCONTRADO', 'NO_METADATA', 'NO_ESCANEABLE', 'NO_ANALIZABLE', 'NO_CHUNKEADO', 'NO_VECTORIZADO',
] as const

// Formatea minutos como texto humano ("~10 min", "~2 h 15 min", "<1 min").
export function formatearMinutos(min: number | null | undefined): string {
  if (min == null) return '—'
  if (min < 1) return '<1 min'
  if (min < 60) return `~${Math.ceil(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m > 0 ? `~${h} h ${m} min` : `~${h} h`
}

// Mensaje conversacional "antes de empezar". Si tardará >5 min, lo dice.
export function mensajeAntesDeEmpezar(
  totalDocs: number,
  carpeta: string | null,
  etaMinutos: number | null,
): { lineaPrincipal: string; lineaTiempo: string | null } {
  const docsTxt = totalDocs.toLocaleString()
  const carpetaTxt = carpeta ? ` en ${carpeta}` : ''
  const lineaPrincipal = `Encontré ${docsTxt} documentos${carpetaTxt}. Si te parece, los preparo para que puedas hacerles preguntas.`
  const lineaTiempo = etaMinutos != null && etaMinutos >= 1
    ? `Tardará unos ${formatearMinutos(etaMinutos).replace('~', '')} la primera vez.`
    : null
  return { lineaPrincipal, lineaTiempo }
}

// Mensaje conversacional "en proceso".
export function mensajeEnProceso(
  completados: number,
  total: number,
  etaMinutos: number | null,
): string {
  if (total === 0) return 'Empezando…'
  const completadosTxt = completados.toLocaleString()
  const totalTxt = total.toLocaleString()
  const cola = etaMinutos != null
    ? `. Quedan unos ${formatearMinutos(etaMinutos).replace('~', '')}.`
    : '.'
  return `${completadosTxt} de ${totalTxt} documentos${cola}`
}
