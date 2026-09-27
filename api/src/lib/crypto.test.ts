import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './crypto.js'

// A fixed 32-byte test key, base64-encoded. Never used outside this test.
const TEST_KEY = btoa('01234567890123456789012345678901'.slice(0, 32))

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext secret', async () => {
    const plaintext = 'sk-ant-example-not-a-real-key'
    const encrypted = await encryptSecret(plaintext, TEST_KEY)
    expect(encrypted).not.toContain(plaintext)
    const decrypted = await decryptSecret(encrypted, TEST_KEY)
    expect(decrypted).toBe(plaintext)
  })

  it('produces a different ciphertext each time (random IV)', async () => {
    const a = await encryptSecret('same-input', TEST_KEY)
    const b = await encryptSecret('same-input', TEST_KEY)
    expect(a).not.toBe(b)
  })

  it('rejects a key that is not exactly 32 bytes', async () => {
    await expect(encryptSecret('x', btoa('too-short'))).rejects.toThrow()
  })

  it('fails to decrypt with the wrong key', async () => {
    const encrypted = await encryptSecret('secret', TEST_KEY)
    const otherKey = btoa('98765432109876543210987654321098'.slice(0, 32))
    await expect(decryptSecret(encrypted, otherKey)).rejects.toThrow()
  })
})
