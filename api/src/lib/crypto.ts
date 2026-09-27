// AES-256-GCM for provider_credentials.encrypted_key. Uses Web Crypto
// (available on Node 20+, Vercel Edge Functions and Cloudflare Workers
// alike) so this runs unchanged regardless of where the API ends up
// deployed. The key is a 32-byte secret from CREDENTIALS_ENCRYPTION_KEY
// (base64), never derived from anything request-controlled.

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

// Built via `new Uint8Array(length)` rather than `Uint8Array.from(...)`
// deliberately: the latter's return type widens to Uint8Array<ArrayBufferLike>,
// which newer lib.dom.d.ts's BufferSource (ArrayBufferView<ArrayBuffer>) rejects.
function fromBase64(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key)
  if (raw.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

// Wire format: base64(iv) + "." + base64(ciphertext-with-auth-tag).
export async function encryptSecret(plaintext: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`
}

export async function decryptSecret(encrypted: string, base64Key: string): Promise<string> {
  const [ivB64, ciphertextB64] = encrypted.split('.')
  if (!ivB64 || !ciphertextB64) throw new Error('Malformed encrypted secret')
  const key = await importKey(base64Key)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) },
    key,
    fromBase64(ciphertextB64),
  )
  return new TextDecoder().decode(plaintext)
}
