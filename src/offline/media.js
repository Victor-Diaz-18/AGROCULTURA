/**
 * Photo compression on the phone, before uploading.
 * A Vercel function accepts about 4.5 MB per request and mobile data is scarce,
 * so every photo is reduced to at most 1280 px on its long side and under 1 MB.
 * Re-drawing it on a canvas also drops its metadata (including the GPS position
 * a camera may have stored), which helps keep other people's data private.
 */

export const PHOTO_MAX_SIDE = 1280
export const PHOTO_MAX_BYTES = 1_000_000
const QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4]

/** Size after scaling the long side down to `maxSide` (never scales up). */
export function fitWithin(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Encodes with the best quality that fits `maxBytes`; if none fits, returns the smallest one tried. */
export async function shrinkToLimit(encode, { maxBytes = PHOTO_MAX_BYTES, qualities = QUALITIES } = {}) {
  let blob = null
  for (const quality of qualities) {
    blob = await encode(quality)
    if (blob.size <= maxBytes) return blob
  }
  return blob
}

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return createImageBitmap(file) // browsers that do not know the options
  }
}

/** Reduces a photo the person picked. Rejects if the file cannot be read as an image. */
export async function compressImage(file, { maxSide = PHOTO_MAX_SIDE, maxBytes = PHOTO_MAX_BYTES } = {}) {
  const bitmap = await decode(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff' // a PNG with transparency must not turn black as a JPEG
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const encode = (quality) =>
    new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo reducir la foto.'))), 'image/jpeg', quality),
    )
  return shrinkToLimit(encode, { maxBytes })
}
