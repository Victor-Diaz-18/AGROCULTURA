/**
 * A random identifier for things the phone creates (a story draft, a photo).
 * `crypto.randomUUID` only exists on secure pages (https or localhost), so there is a fallback.
 * Always matches the server's rule for a draft id: letters, digits, "-" and "_", 8 to 64 characters.
 */
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
