import { beforeEach, describe, expect, it } from 'vitest'
import { isReaderFinalLocation } from '../src/reader/readerCompletion'
import { createInitialProgressState } from '../src/stores/progressMigration'
import { useProgressStore } from '../src/stores/progressStore'

describe('first chapter safe endpoint', () => {
  beforeEach(() => useProgressStore.setState(createInitialProgressState()))

  it('recognizes only the final independent beat as the chapter end', () => {
    expect(isReaderFinalLocation({ phaseId: 'M1', pageId: 'crowd-corner', beatIndex: 6 })).toBe(false)
    expect(isReaderFinalLocation({ phaseId: 'M1', pageId: 'crowd-corner', beatIndex: 7 })).toBe(true)
  })

  it('records the trial endpoint without completing Reader or entering Center', () => {
    useProgressStore.setState({ currentView: 'reader' })
    useProgressStore.getState().endChapterTrial()
    const state = useProgressStore.getState()
    expect(state.chapterTrialEnded).toBe(true)
    expect(state.readerCompleted).toBe(false)
    expect(state.currentView).toBe('reader')
  })
})
