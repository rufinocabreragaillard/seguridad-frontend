/**
 * Descifrado AES-256-GCM de contenido ofuscado por el backend.
 *
 * El backend (app/helpers/encriptacion.py) cifra ciertos textos (texto_fuente,
 * chunks.texto) antes de enviarlos. Este helper revierte esa operación en el
 * navegador usando Web Crypto.
 *
 * Objetivo: visual-only. No protege contra acceso a la BD — solo esconde el
 * contenido a vistas accidentales en las pantallas del panel admin.
 *
 * La clave plana se normaliza con SHA-256 (igual que el backend) para obtener
 * los 32 bytes de AES-256.
 */

export interface PayloadCifrado {
  cifrado: boolean
  iv: string
  texto_cifrado: string
  nivel_clave: string
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derivarClave(clavePlana: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode(clavePlana)
  const hash = await crypto.subtle.digest('SHA-256', material)
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['decrypt'])
}

/**
 * Descifra un payload cifrado. Lanza Error('clave-incorrecta') si la clave no
 * puede verificar el tag GCM — usar para mostrar "Llave incorrecta" al usuario.
 *
 * Si el payload indica `cifrado: false`, devuelve string vacío (nada que mostrar).
 */
export async function descifrarPayload(
  payload: PayloadCifrado,
  clavePlana: string,
): Promise<string> {
  if (!payload.cifrado) return ''
  if (!clavePlana) throw new Error('clave-vacia')

  const iv = b64ToBytes(payload.iv)
  const ciphertext = b64ToBytes(payload.texto_cifrado)
  const key = await derivarClave(clavePlana)

  try {
    const plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    )
    return new TextDecoder().decode(plano)
  } catch {
    throw new Error('clave-incorrecta')
  }
}

/** Cache en memoria de la clave ingresada por el usuario en la sesión actual. */
let _claveSesion: string | null = null

export function setClaveSesion(clave: string) {
  _claveSesion = clave
}

export function getClaveSesion(): string | null {
  return _claveSesion
}

export function limpiarClaveSesion() {
  _claveSesion = null
}
