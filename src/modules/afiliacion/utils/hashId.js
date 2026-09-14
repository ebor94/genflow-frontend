// ============================================
// src/utils/hashId.js
// Descifra hashes AES-256-CBC generados por el backend.
// Usa Web Crypto API (built-in en browsers modernos, sin librerías externas).
// La misma clave debe estar en VITE_HASH_SECRET y en HASH_SECRET del backend.
// ============================================

function b64urlToB64(str) {
  return str.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (str.length % 4)) % 4)
}

/**
 * Descifra un hash generado por el backend y retorna el ID numérico.
 * @param {string} hash - base64url string generado por encodeId() del backend
 * @returns {Promise<number|null>}
 */
export async function decodeId(hash) {
  try {
    const secret = (import.meta.env.VITE_HASH_SECRET || 'serfunorte_mantix_hash_2026')
      .padEnd(32, '!').slice(0, 32)

    const rawKey = new TextEncoder().encode(secret)                          // 32 bytes
    const rawIv  = new TextEncoder().encode(secret.slice(0, 16).padEnd(16, '0')) // 16 bytes

    const key = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-CBC' }, false, ['decrypt']
    )

    const ciphertext = Uint8Array.from(
      atob(b64urlToB64(hash)),
      c => c.charCodeAt(0)
    )

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: rawIv },
      key,
      ciphertext
    )

    const id = parseInt(new TextDecoder().decode(decrypted).trim(), 10)
    return isNaN(id) ? null : id
  } catch {
    return null
  }
}
