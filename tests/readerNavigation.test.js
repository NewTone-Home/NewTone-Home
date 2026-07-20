import { describe, expect, it } from 'vitest'
import { READER_INTENTS } from '../src/reader/readerInput'
import { READER_TRANSITIONS, beginReaderNavigation, createReaderNavigationState, finishReaderNavigation, getReaderTransitionKind, retargetReaderNavigation } from '../src/reader/readerNavigation'

const location = (pageId, beatIndex) => ({ phaseId: 'M1', pageId, beatIndex })

describe('Reader transition layers', () => {
  it('classifies beat and page transitions separately', () => {
    expect(getReaderTransitionKind(location('ancestral-home', 0), location('ancestral-home', 1))).toBe(READER_TRANSITIONS.BEAT)
    expect(getReaderTransitionKind(location('ancestral-home', 6), location('inner-street', 0))).toBe(READER_TRANSITIONS.PAGE)
  })

  it('keeps committed location stable until animation completion', () => {
    const initial = createReaderNavigationState(location('ancestral-home', 0))
    const started = beginReaderNavigation(initial, READER_INTENTS.FORWARD)
    expect(started.committedLocation.linearIndex).toBe(0)
    expect(started.displayLocation.linearIndex).toBe(1)
    expect(finishReaderNavigation(started).committedLocation.linearIndex).toBe(1)
  })

  it('retargets and reverses immediately without FIFO replay', () => {
    const initial = createReaderNavigationState(location('ancestral-home', 0))
    const forward = retargetReaderNavigation(initial, 3)
    const reversed = retargetReaderNavigation(forward, -2)
    expect(forward.displayLocation.linearIndex).toBe(3)
    expect(reversed.displayLocation.linearIndex).toBe(1)
  })

  it('commits immediately for reduced motion and respects the first boundary', () => {
    const initial = createReaderNavigationState(location('ancestral-home', 0))
    const next = beginReaderNavigation(initial, READER_INTENTS.FORWARD, { reducedMotion: true })
    expect(next.committedLocation.linearIndex).toBe(1)
    expect(beginReaderNavigation(initial, READER_INTENTS.BACKWARD)).toBe(initial)
  })
})
