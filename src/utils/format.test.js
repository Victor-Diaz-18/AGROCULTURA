import { describe, expect, it } from 'vitest'
import { formatBytes, formatDate, formatDuration } from './format.js'

describe('formatDate', () => {
  it('writes the date as in the design', () => {
    expect(formatDate('2026-09-14T15:00:00Z')).toBe('14 sep 2026')
    expect(formatDate('2026-01-02T15:00:00Z')).toBe('2 ene 2026')
  })

  it('returns nothing for an empty or invalid date', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate('not a date')).toBe('')
  })
})

describe('formatDuration', () => {
  it('shows minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(95)).toBe('1:35')
    expect(formatDuration(600)).toBe('10:00')
  })
})

describe('formatBytes', () => {
  it('uses a decimal comma and the right unit', () => {
    expect(formatBytes(1_250_000)).toBe('1,3 MB')
    expect(formatBytes(230_000)).toBe('230 KB')
    expect(formatBytes(10)).toBe('1 KB')
  })
})
