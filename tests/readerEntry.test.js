import { describe, expect, it } from 'vitest'
import { getReaderEntryIntent, hasStableReaderProgress } from '../src/reader/readerEntry'
import { createInitialProgressState, sanitizeProgress } from '../src/stores/progressMigration'

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

  it('keeps ordinary reading as the only visible mode, including legacy immersive progress', () => {
    expect(createInitialProgressState().readingMode).toBe('standard')
    expect(sanitizeProgress({ readingMode: 'immersive' }).readingMode).toBe('standard')
  })
})
