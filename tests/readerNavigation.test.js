import { describe, expect, it } from 'vitest'
import { READER_INTENTS } from '../src/reader/readerInput'
import {
  READER_TRANSITIONS,
  beginReaderNavigation,
  createReaderNavigationState,
  finishReaderNavigation,
  getReaderTransitionKind,
} from '../src/reader/readerNavigation'

const location = (phaseId, pageId, beatIndex) => ({ phaseId, pageId, beatIndex })

describe('Reader transition layers', () => {
  it('classifies beat, page, and phase transitions separately', () => {
    expect(getReaderTransitionKind(
      location('M1', 'm1-arrival', 0),
      location('M1', 'm1-arrival', 1),
    )).toBe(READER_TRANSITIONS.BEAT)
    expect(getReaderTransitionKind(
      location('M1', 'm1-arrival', 2),
      location('M1', 'm1-signal', 0),
    )).toBe(READER_TRANSITIONS.PAGE)
    expect(getReaderTransitionKind(
      location('M1', 'm1-signal', 2),
      location('M2', 'm2-platform', 0),
    )).toBe(READER_TRANSITIONS.PHASE)
  })

  it('keeps committed location stable until animation completion', () => {
    const initial = createReaderNavigationState(location('M1', 'm1-arrival', 0))
    const started = beginReaderNavigation(initial, READER_INTENTS.FORWARD)

    expect(started.committedLocation.linearIndex).toBe(0)
    expect(started.displayLocation.linearIndex).toBe(1)
    expect(started.transitionTarget.linearIndex).toBe(1)

    const finished = finishReaderNavigation(started)
    expect(finished.committedLocation.linearIndex).toBe(1)
    expect(finished.transitionTarget).toBeNull()
  })

  it('commits immediately for reduced motion', () => {
    const initial = createReaderNavigationState(location('M1', 'm1-arrival', 0))
    const next = beginReaderNavigation(initial, READER_INTENTS.FORWARD, {
      reducedMotion: true,
    })

    expect(next.displayLocation.linearIndex).toBe(1)
    expect(next.committedLocation.linearIndex).toBe(1)
    expect(next.transitionTarget).toBeNull()
  })

  it('does not navigate beyond the first boundary', () => {
    const initial = createReaderNavigationState(location('M1', 'm1-arrival', 0))
    expect(beginReaderNavigation(initial, READER_INTENTS.BACKWARD)).toBe(initial)
  })
})
