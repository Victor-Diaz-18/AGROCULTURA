/**
 * POST /api/blob-token: lets a signed-in person upload ONE video straight to Vercel Blob (F13).
 *
 * The video never passes through here (a Vercel function takes about 4.5 MB per request and a video can weigh 25 MB):
 * this function only checks the session and hands the phone a short-lived upload token. The rules are in
 * api/_lib/video.js. The phone sends the session token the API gave at sign-in as "Authorization: Bearer ...".
 */

import { handleUpload } from '@vercel/blob/client'
import { UploadRefused, bearerToken, checkUpload, verifyToken } from './_lib/video.js'

const send = (response, status, body) => response.status(status).json(body)

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { detail: 'Método no permitido.' })

  const secret = process.env.JWT_SECRET
  if (!secret) return send(response, 503, { detail: 'Falta configurar JWT_SECRET en el servidor.' })
  if (!process.env.BLOB_READ_WRITE_TOKEN) return send(response, 503, { detail: 'Falta configurar el almacenamiento de archivos (Blob) en el servidor.' })

  const claims = verifyToken(bearerToken(request.headers.authorization), secret)
  if (!claims) return send(response, 401, { detail: 'Tu sesión no es válida o venció. Ingresa de nuevo.' })

  try {
    const result = await handleUpload({
      request,
      body: request.body,
      onBeforeGenerateToken: async (pathname) => checkUpload(pathname, claims.sub),
    })
    return send(response, 200, result)
  } catch (error) {
    if (error instanceof UploadRefused) return send(response, 400, { detail: error.message })
    console.error('blob-token failed:', error?.name, error?.message)
    return send(response, 500, { detail: 'No pudimos preparar la subida del video. Intenta de nuevo.' })
  }
}
