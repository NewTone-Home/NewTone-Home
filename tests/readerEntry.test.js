import { describe, expect, it } from 'vitest'
import { getReaderEntryIntent, hasStableReaderProgress } from '../src/reader/readerEntry'

describe('Landing Reader entry intent', () => {
  it('starts only when v2 has no stable Reader progress', () => {
    expect(getReaderEntryIntent({
      readerStarted: false,
      readerCompleted: false,
      lastScrollY: 5000,
      lastReadPhase: 'M4',
    })).toBe('start')
  })

  it('continues from v2 started or completed state without legacy scroll evidence', () => {
    expect(hasStableReaderProgress({ readerStarted: true })).toBe(true)
    expect(getReaderEntryIntent({ readerStarted: true, lastScrollY: 0 })).toBe('continue')
    expect(getReaderEntryIntent({ readerCompleted: true, readerStarted: false })).toBe('continue')
  })
})
