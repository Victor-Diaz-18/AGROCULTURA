import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id.js'

const SERVER_RULE = /^[A-Za-z0-9_-]{8,64}$/

afterEach(() => vi.restoreAllMocks())

describe('newId', () => {
  it('makes different identifiers that the server accepts', () => {
    const ids = new Set(Array.from({ length: 50 }, newId))

    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(SERVER_RULE)
  })

  it('still works on a page without crypto.randomUUID (http on a local network)', () => {
    vi.spyOn(crypto, 'randomUUID', 'get').mockReturnValue(undefined)

    const id = newId()

    expect(id).toMatch(SERVER_RULE)
    expect(id).not.toBe(newId())
  })
})
