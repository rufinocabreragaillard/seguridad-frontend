#!/usr/bin/env node
/**
 * Juez DETERMINISTA de traducción para UNA pantalla ya capturada.
 *
 * Lee los artefactos de `test-results/traducciones/<CODIGO>/*.{txt,html}` y los
 * mensajes `messages/{es,en}.json`, y emite hallazgos de ALTA CONFIANZA. El juicio
 * visual (mirar screenshots) lo hace el agente DESPUÉS, sumando hallazgos que el
 * texto no capta. Este script NO pretende ser exhaustivo: prioriza cero/bajos
 * falsos positivos.
 *
 * Tres tipos de hallazgo:
 *  - TAG_LITERAL    : se ve un `namespace.key` literal que ADEMÁS es una clave real
 *                     de es.json → el i18n no resolvió (clave falta en es y en).
 *  - SPANISH_LEAK   : string visible cuyo valor ∈ es.json pero ∉ en.json → fallback
 *                     de next-intl mostrando español porque la clave falta en en.json.
 *  - HARDCODED_ES   : string visible que "parece español" (acentos/ñ/¿¡ o palabra UI
 *                     castellana de lista curada) y NO está en en.json NI en es.json
 *                     → texto hardcodeado que ni pasa por i18n.
 *
 * Uso:  node juez.mjs <CODIGO>
 * Salida: JSON a stdout + persistido en test-results/traducciones/<CODIGO>-juez.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(__dirname, '../../../..') // _helpers → _traducciones → e2e → tests → frontend
const MESSAGES = join(FRONTEND, 'messages')
const RESULTS = join(FRONTEND, 'artefactos-traducciones')

const codigo = process.argv[2]
if (!codigo) {
  console.error('uso: node juez.mjs <CODIGO>')
  process.exit(2)
}

// ── messages: aplanar a valores hoja y a claves con path punteado ──────────────
function aplanar(obj, prefijo, outVals, outKeys) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefijo ? `${prefijo}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      aplanar(v, path, outVals, outKeys)
    } else if (typeof v === 'string') {
      outVals.push(v)
      outKeys.add(path)
    }
  }
}

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ')

const esRaw = JSON.parse(readFileSync(join(MESSAGES, 'es.json'), 'utf8'))
const enRaw = JSON.parse(readFileSync(join(MESSAGES, 'en.json'), 'utf8'))

const esVals = [], esKeys = new Set()
const enVals = [], enKeys = new Set()
aplanar(esRaw, '', esVals, esKeys)
aplanar(enRaw, '', enVals, enKeys)

// normalizado → valor original (es.json), para reportar el texto canónico
const esByNorm = new Map()
for (const v of esVals) if (!esByNorm.has(norm(v))) esByNorm.set(norm(v), v)
const enSet = new Set(enVals.map(norm))

// ── heurística "parece español" para HARDCODED_ES ─────────────────────────────
// Palabras UI castellanas inequívocas (verbos/labels), no nombres propios ni datos.
const PALABRAS_ES = new Set([
  'fecha', 'fechas', 'usuario', 'usuarios', 'nuevo', 'nueva', 'tipo', 'guardar',
  'cancelar', 'eliminar', 'borrar', 'crear', 'editar', 'buscar', 'cerrar',
  'aceptar', 'configuración', 'configuracion', 'contraseña', 'correo', 'idioma',
  'administrador', 'sistema', 'activo', 'inactivo', 'aplicar', 'regenerar',
  'agregar', 'añadir', 'seleccionar', 'cargar', 'descargar', 'enviar', 'recibir',
  'inicial', 'final', 'estado', 'acciones', 'nombre', 'descripción', 'descripcion',
  'español', 'inglés', 'ingles', 'portugués', 'portugues', 'francés', 'frances',
  'alemán', 'aleman', 'mostrando', 'página', 'pagina', 'siguiente', 'anterior',
])
const STOPWORDS_ES = new Set(['de', 'la', 'los', 'las', 'para', 'por', 'con', 'del', 'una', 'que', 'su'])

// Para HARDCODED_ES: distinguir etiqueta de UI (alta confianza) de prosa/contenido
// (baja confianza). En pantallas con texto libre —el chat— las burbujas de
// conversación están legítimamente en español (datos, no UI) y son frases largas.
// No las ocultamos: las marcamos `confianza:'baja'` para que el agente las filtre
// en su juicio visual. Las etiquetas cortas ("FECHA INICIAL", "Crear Espacio") son
// `alta`. SPANISH_LEAK y TAG_LITERAL son siempre alta (van atadas a una clave i18n).
function clasificarConfianza(s) {
  const palabras = s.trim().split(/\s+/).filter(Boolean)
  const terminaEnPuntuacion = /[.?!…]$/.test(s.trim())
  if (palabras.length >= 7) return 'baja'
  if (terminaEnPuntuacion && palabras.length >= 4) return 'baja'
  return 'alta'
}

function pareceEspanol(s) {
  if (/[ñ¿¡áéíóúü]/i.test(s)) return true
  const palabras = norm(s).split(/[^a-záéíóúüñ]+/i).filter(Boolean)
  if (palabras.some((p) => PALABRAS_ES.has(p))) return true
  // Rama por stopwords: exigir ≥2 stopwords distintas. Una sola (p.ej. "de" del
  // código de idioma DE en "(ES, EN, PT, FR, DE)") dispara falsos positivos en
  // texto inglés. Dos o más sí indican una frase castellana real.
  const stop = new Set(palabras.filter((p) => STOPWORDS_ES.has(p)))
  if (palabras.length >= 2 && stop.size >= 2) return true
  return false
}

// candidatos que se descartan siempre (datos, no UI)
const EXCLUIR = [
  /^v?\d+[\d.,:/\s-]*$/,            // versiones, números, fechas, horas
  /@/,                              // emails
  /^https?:\/\//i,                  // urls
  /\.(png|jpe?g|svg|js|ts|tsx|css|json|md)$/i, // nombres de archivo
  /^[A-Z]$/,                        // iniciales sueltas (avatares)
  /^[A-Z0-9]+([-_/][A-Z0-9]+)+$/,  // códigos (roles, permisos): DOCS-USUARIO-FINAL
  /^(server\s*lm|client\s*lm|serverlm)$/i, // marca (token exacto, no substring)
  /TEST_TRAD_/,                     // sentinel
]
// length < 3 descarta códigos de 2 letras ("en","es","de") que son ruido, no UI.
const esExcluible = (s) => s.length < 3 || EXCLUIR.some((re) => re.test(s))

// ── recorrer artefactos ────────────────────────────────────────────────────────
const dir = join(RESULTS, codigo)
if (!existsSync(dir)) {
  console.error(`no existe ${dir} — ¿corriste el spec ${codigo}.spec.ts?`)
  process.exit(1)
}
const archivos = readdirSync(dir)

// hallazgos dedup por (tipo + normalizado); acumula etapas donde aparece
const hallazgos = new Map()
function registrar(tipo, valor, etapa, extra = {}) {
  const clave = `${tipo}::${norm(valor)}`
  if (hallazgos.has(clave)) {
    hallazgos.get(clave).etapas.add(etapa)
  } else {
    hallazgos.set(clave, { tipo, valor, etapas: new Set([etapa]), ...extra })
  }
}

const RE_TAG = /\b([a-zA-Z_][a-zA-Z0-9_]*\.)+[a-zA-Z_][a-zA-Z0-9_]*\b/g

for (const archivo of archivos) {
  const etapa = archivo.replace(/\.[^.]+$/, '')
  const ruta = join(dir, archivo)

  if (archivo.endsWith('.txt')) {
    const texto = readFileSync(ruta, 'utf8')
    // tokenizar por líneas y por celdas separadas por tab (cabeceras de tabla)
    const tokens = texto.split('\n').flatMap((l) => l.split('\t'))
    for (const tokRaw of tokens) {
      const s = tokRaw.trim()
      if (!s || esExcluible(s)) continue
      const n = norm(s)
      if (enSet.has(n)) continue // ya es un string válido del lado inglés
      if (esByNorm.has(n)) {
        registrar('SPANISH_LEAK', esByNorm.get(n), etapa, {
          explicacion: 'Valor presente en es.json y ausente en en.json (fallback next-intl).',
        })
      } else if (pareceEspanol(s)) {
        registrar('HARDCODED_ES', s, etapa, {
          confianza: clasificarConfianza(s),
          explicacion: 'Parece español y no está en es.json ni en.json → texto hardcodeado fuera de i18n.',
        })
      }
    }
  }

  if (archivo.endsWith('.html')) {
    const html = readFileSync(ruta, 'utf8')
    const matches = html.match(RE_TAG) || []
    for (const m of matches) {
      if (esKeys.has(m)) {
        registrar('TAG_LITERAL', m, etapa, {
          explicacion: 'Clave i18n literal visible en el DOM (existe en es.json pero no resolvió).',
        })
      }
    }
  }
}

const lista = [...hallazgos.values()]
  .map((h) => ({
    tipo: h.tipo,
    valor: h.valor,
    confianza: h.confianza ?? 'alta',
    etapas: [...h.etapas].sort(),
    explicacion: h.explicacion,
  }))
  // alta antes que baja; luego por tipo y valor
  .sort((a, b) =>
    (a.confianza === b.confianza ? 0 : a.confianza === 'alta' ? -1 : 1) ||
    a.tipo.localeCompare(b.tipo) ||
    a.valor.localeCompare(b.valor),
  )

const alta = lista.filter((h) => h.confianza === 'alta')
const reporte = {
  pantalla: codigo,
  generado: new Date().toISOString(),
  fuente: 'juez-determinista',
  totales: {
    TAG_LITERAL: lista.filter((h) => h.tipo === 'TAG_LITERAL').length,
    SPANISH_LEAK: lista.filter((h) => h.tipo === 'SPANISH_LEAK').length,
    HARDCODED_ES: lista.filter((h) => h.tipo === 'HARDCODED_ES').length,
    alta_confianza: alta.length,
    baja_confianza: lista.length - alta.length,
  },
  // El veredicto determinista solo cuenta hallazgos de ALTA confianza. Los de baja
  // (prosa/posible contenido de usuario) quedan para que el agente los confirme.
  veredicto_determinista: alta.length === 0 ? 'SIN_HALLAZGOS_ALTA_CONFIANZA' : 'HALLAZGOS',
  hallazgos: lista,
  nota: 'Hallazgos de baja confianza = prosa larga que parece español pero podría ser contenido del usuario (p.ej. mensajes de chat). El agente debe confirmarlos visualmente. El juicio visual también puede SUMAR hallazgos que el texto no capta (tooltips en imágenes, etc.).',
}

const salida = join(RESULTS, `${codigo}-juez.json`)
writeFileSync(salida, JSON.stringify(reporte, null, 2))
console.log(JSON.stringify(reporte, null, 2))
