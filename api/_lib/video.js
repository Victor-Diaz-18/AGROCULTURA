/**
 * The rules of a video upload (F13), kept apart from the Vercel function so they can be tested on their own.
 * (A folder or file starting with "_" in api/ is not deployed as a function.)
 *
 * The video goes from the phone straight to Vercel Blob (a function accepts only about 4.5 MB per request).
 * The function only answers one question: "may this person upload this file?", with a short-lived token that is
 * good for ONE path inside the person's own folder, of video types only and at most 25 MB.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** The most a video may weigh: 25 MB as phones count them (millions of bytes). The same number is in src/config/constants.js. */
export const MAX_VIDEO_BYTES = 25_000_000

/** What we accept as a video, and the extension of each. */
export const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov', // what an iPhone records
  'video/webm': 'webm',
}

/** Roles that may upload: whoever can tell a story (a narrator) or upload one for the team (an administrator). */
const ROLES = ['narrador', 'administrador']

/** Same rule as lib/core/security.py: a short secret is a configuration mistake, not something to run with. */
export const MIN_SECRET_LENGTH = 32

const LEEWAY_SECONDS = 10

/** Said to the person: it reaches the screen as the reason the video could not go up. */
export class UploadRefused extends Error {}

const base64url = (buffer) => buffer.toString('base64url')

function decodePart(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** The token of an "Authorization: Bearer <token>" header, or null. */
export function bearerToken(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return match ? match[1] : null
}

/**
 * Checks a session token made by the API (HS256, same secret) with node:crypto and returns its claims, or null when it
 * is not valid: another algorithm (including "none"), a wrong signature, expired, or without who and what role.
 */
export function verifyToken(token, secret, nowMs = Date.now()) {
  if (!token || !secret || secret.length < MIN_SECRET_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, signature] = parts

  const header = decodePart(head)
  if (!header || header.alg !== 'HS256') return null // never trust the token to choose its own algorithm

  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest()
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  const claims = decodePart(body)
  if (!claims || typeof claims.exp !== 'number' || claims.exp * 1000 + LEEWAY_SECONDS * 1000 <= nowMs) return null
  if (typeof claims.sub !== 'string' || !claims.sub || !ROLES.includes(claims.rol)) return null
  return claims
}

/**
 * What the token will allow, or an UploadRefused. The file must be in the person's own folder (the API only accepts
 * stories that point at files in `historias/<their id>/`), with a plain name and a video extension.
 */
export function checkUpload(pathname, userId) {
  const prefix = `historias/${userId}/`
  const name = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null
  if (!name || !/^[A-Za-z0-9._-]{1,100}$/.test(name) || name.startsWith('.') || name.includes('..')) {
    throw new UploadRefused('No se puede subir el video a esa dirección.')
  }
  const extension = name.split('.').pop().toLowerCase()
  if (!Object.values(VIDEO_TYPES).includes(extension)) {
    throw new UploadRefused('Solo se pueden subir videos MP4, MOV o WebM.')
  }
  return {
    allowedContentTypes: Object.keys(VIDEO_TYPES),
    maximumSizeInBytes: MAX_VIDEO_BYTES,
    addRandomSuffix: true, // two videos with the same name never overwrite each other
    allowOverwrite: false,
    tokenPayload: JSON.stringify({ userId }),
  }
}
