import { beforeEach, describe, expect, it } from 'vitest'
import { canCompleteReader, isReaderFinalLocation } from '../src/reader/readerCompletion'
import { createInitialProgressState } from '../src/stores/progressMigration'
import { useProgressStore } from '../src/stores/progressStore'

const completeExit = { action: 'complete-reader' }

describe('explicit Reader completion', () => {
  beforeEach(() => {
    useProgressStore.setState(createInitialProgressState())
  })

  it('does not complete on entering M4 or reaching the final page before its last beat', () => {
    expect(canCompleteReader({
      location: { phaseId: 'M4', pageId: 'm4-descent', beatIndex: 0 },
      forwardExit: { action: 'navigate' },
      readerCompleted: false,
    })).toBe(false)
    expect(canCompleteReader({
      location: { phaseId: 'M4', pageId: 'm4-core', beatIndex: 1 },
      forwardExit: completeExit,
      readerCompleted: false,
    })).toBe(false)
  })

  it('allows only the explicit forward exit at the final beat', () => {
    const finalLocation = { phaseId: 'M4', pageId: 'm4-core', beatIndex: 2 }
    expect(isReaderFinalLocation(finalLocation)).toBe(true)
    expect(canCompleteReader({
      location: finalLocation,
      forwardExit: completeExit,
      readerCompleted: false,
    })).toBe(true)
  })

  it('does not offer completion again after completion', () => {
    expect(canCompleteReader({
      location: { phaseId: 'M4', pageId: 'm4-core', beatIndex: 2 },
      forwardExit: completeExit,
      readerCompleted: true,
    })).toBe(false)
  })

  it('persists completion and unlock exactly once without changing the current view', () => {
    useProgressStore.setState({ currentView: 'reader' })
    const first = useProgressStore.getState().completeReader()
    const second = useProgressStore.getState().completeReader()
    const state = useProgressStore.getState()

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(state.readerCompleted).toBe(true)
    expect(state.centerUnlocked).toBe(true)
    expect(state.currentView).toBe('reader')
  })
})
