import { describe, expect, it, vi } from 'vitest'
import { fitWithin, shrinkToLimit } from './media.js'

const blobOfSize = (size) => ({ size })

describe('fitWithin', () => {
  it('scales the long side down to the limit, keeping proportions', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 })
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 })
  })

  it('never makes a small photo bigger', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })
})

describe('shrinkToLimit', () => {
  it('keeps the best quality that fits under the limit', async () => {
    const encode = vi.fn(async (quality) => blobOfSize(Math.round(quality * 2_000_000))) // 0.8 -> 1.6 MB, 0.6 -> 1.2 MB, 0.5 -> 1.0 MB
    const result = await shrinkToLimit(encode, { maxBytes: 1_000_000 })

    expect(result.size).toBe(1_000_000)
    expect(encode.mock.calls.map(([quality]) => quality)).toEqual([0.8, 0.7, 0.6, 0.5])
  })

  it('stops at the first quality that already fits', async () => {
    const encode = vi.fn(async () => blobOfSize(400_000))

    await shrinkToLimit(encode, { maxBytes: 1_000_000 })

    expect(encode).toHaveBeenCalledTimes(1)
  })

  it('returns the smallest result when nothing fits', async () => {
    const encode = vi.fn(async (quality) => blobOfSize(Math.round(quality * 10_000_000)))

    const result = await shrinkToLimit(encode, { maxBytes: 1_000_000 })

    expect(result.size).toBe(4_000_000) // quality 0.4, the lowest tried
  })
})
