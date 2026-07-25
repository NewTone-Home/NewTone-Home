import { describe, expect, it } from 'vitest'
import { getReaderEntryIntent, hasStableReaderProgress } from '../reader/readerEntry'
import { readerContentIndex } from '../reader/readerPosition'
import {
  createInitialProgressState,
  sanitizeV2Progress,
} from '../stores/progressMigration'
import { getDefinition } from '../transitions/transitionDefinitions'

function persistedLocation(entry) {
  return {
    phaseId: entry.phaseId,
    pageId: entry.pageId,
    beatIndex: entry.beatIndex,
  }
}

describe('V0.0 product protocol baseline', () => {
  it('distinguishes a first Reader entry from a stable resume entry', () => {
    expect(hasStableReaderProgress({ readerStarted: false, readerCompleted: false })).toBe(false)
    expect(getReaderEntryIntent({ readerStarted: false, readerCompleted: false })).toBe('start')

    expect(hasStableReaderProgress({ readerStarted: true, readerCompleted: false })).toBe(true)
    expect(getReaderEntryIntent({ readerStarted: true, readerCompleted: false })).toBe('continue')

    expect(hasStableReaderProgress({ readerStarted: false, readerCompleted: true })).toBe(true)
    expect(getReaderEntryIntent({ readerStarted: false, readerCompleted: true })).toBe('continue')
  })

  it('preserves confirmed onboarding and reading preferences through sanitization', () => {
    const clean = sanitizeV2Progress({
      ...createInitialProgressState(),
      language: 'en',
      hasInitializedLanguage: true,
      hasInitializedReadingMode: true,
      readingMode: 'standard',
      motionMode: 'reduced',
      themePosition: 1,
    })

    expect(clean.language).toBe('en')
    expect(clean.hasInitializedLanguage).toBe(true)
    expect(clean.hasInitializedReadingMode).toBe(true)
    expect(clean.readingMode).toBe('standard')
    expect(clean.motionMode).toBe('reduced')
    expect(clean.themePosition).toBe(1)
  })

  it('blocks a persisted Center route while Center is locked', () => {
    const clean = sanitizeV2Progress({
      ...createInitialProgressState(),
      currentView: 'center',
      centerUnlocked: false,
    })

    expect(clean.currentView).toBe('landing')
    expect(clean.centerUnlocked).toBe(false)
  })

  it('never lets furthestLocation fall behind committedLocation', () => {
    const first = persistedLocation(readerContentIndex.entries[0])
    const second = persistedLocation(readerContentIndex.entries[1])

    const clean = sanitizeV2Progress({
      ...createInitialProgressState(),
      committedLocation: second,
      furthestLocation: first,
      readerStarted: true,
    })

    expect(clean.committedLocation).toEqual(second)
    expect(clean.furthestLocation).toEqual(second)
  })

  it('keeps stable navigation targets in the transition definitions', () => {
    expect(getDefinition('surface-to-core').targetView).toBe('center')
    expect(getDefinition('reader-to-core').targetView).toBe('center')
    expect(getDefinition('core-to-reader').targetView).toBe('reader')
    expect(getDefinition('core-to-surface').targetView).toBe('landing')
  })
})
