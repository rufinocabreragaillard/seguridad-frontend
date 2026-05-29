#!/usr/bin/env node
/**
 * Fija el locale efectivo de un usuario vía API (no por SQL directo).
 *
 * POR QUÉ API Y NO SQL: el backend (Railway) cachea el contexto del usuario en
 * memoria por 300s (`_ctx_cache` en app/dependencies.py). Un UPDATE directo a
 * `parametros_usuario`/`usuarios.locale` cambia la BD pero NO invalida ese caché,
 * así que el siguiente login sigue recibiendo el locale viejo hasta 5 min después.
 * El endpoint `PUT /usuarios/{codigo}` hace el upsert en `parametros_usuario`
 * (PREFERENCIAS/IDIOMA, mig 365) Y llama `invalidar_cache_usuario()`. Es la única
 * vía que surte efecto inmediato.
 *
 * Cascada real de `locale_efectivo` (fn_datos_usuario): parametros_usuario
 * PREFERENCIAS/IDIOMA → parametros_grupo → parametros_generales → usuarios.locale → 'es'.
 *
 * Uso:
 *   node locale-api.mjs <email> <password> <locale>
 * Env:
 *   SERVERLM_BACKEND  (default: producción)
 */
const BACKEND =
  process.env.SERVERLM_BACKEND ||
  'https://seguridad-backend-production-6250.up.railway.app'

const [, , email, password, locale] = process.argv

if (!email || !password || !locale) {
  console.error('uso: node locale-api.mjs <email> <password> <locale>')
  process.exit(2)
}

async function main() {
  const loginRes = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!loginRes.ok) {
    throw new Error(`login falló: HTTP ${loginRes.status} ${await loginRes.text()}`)
  }
  const { access_token } = await loginRes.json()
  if (!access_token) throw new Error('login no devolvió access_token')

  const putRes = await fetch(`${BACKEND}/usuarios/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locale }),
  })
  if (!putRes.ok) {
    throw new Error(`PUT locale falló: HTTP ${putRes.status} ${await putRes.text()}`)
  }
  console.log(`[locale-api] ${email} → locale='${locale}' OK (caché invalidado)`)
}

main().catch((e) => {
  console.error(`[locale-api] ERROR: ${e.message}`)
  process.exit(1)
})
