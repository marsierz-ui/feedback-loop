// Project "publishable key" identifiers (like a Sentry DSN / Stripe
// publishable key): shipped inside the widget bundle on the host page, so
// they are not secret. Hashing before storage is hygiene, not
// confidentiality — SHA-256 (fast) is the right tool here, not a slow
// password hash like bcrypt/argon2, which would only slow the server down
// on every widget submission for no security benefit.
export async function hashApiKey(rawKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const b64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `fl_pub_${b64url}`
}
