import { describe, expect, it } from 'vitest'
import { getNativeBoundaries } from '../src/components/reader/ReaderBeatStack'

describe('Reader native scroll boundary contract', () => {
  it('derives top and bottom from the scroll container, not from a guessed beat index', () => {
    expect(getNativeBoundaries({ scrollTop: 180, scrollHeight: 1200, clientHeight: 720 })).toEqual({
      scrollTop: 180,
      maxScrollTop: 480,
      atTop: false,
      atBottom: false,
    })
    expect(getNativeBoundaries({ scrollTop: 0, scrollHeight: 1200, clientHeight: 720 }).atTop).toBe(true)
    expect(getNativeBoundaries({ scrollTop: 480, scrollHeight: 1200, clientHeight: 720 }).atBottom).toBe(true)
    expect(getNativeBoundaries({ scrollTop: 472, scrollHeight: 1200, clientHeight: 720 }).atBottom).toBe(true)
  })
})
