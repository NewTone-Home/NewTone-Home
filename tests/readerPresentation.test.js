import { describe, expect, it } from 'vitest'
import { readerContent } from '../src/data/readerContent'
import { getReaderProgressPercentage, hasReaderSceneChanged } from '../src/reader/readerPresentation'
import { getOverallProgress, readerContentIndex } from '../src/reader/readerPosition'
import { sanitizeV2Progress, serializeProgressV2 } from '../src/stores/progressMigration'

describe('Reader data-driven presentation', () => {
  it('derives monotonic chapter progress from the stable content index', () => {
    const percentages = readerContentIndex.entries.map(location => getReaderProgressPercentage(getOverallProgress(location)))
    expect(percentages[0]).toBe(0)
    expect(percentages.at(-1)).toBe(100)
    expect(percentages.every((value, index) => index === 0 || value >= percentages[index - 1])).toBe(true)
  })

  it('keeps every page boundary ordered', () => {
    for (const pageId of ['threshold-passage', 'inner-street', 'commercial-street', 'crowd-corner']) {
      const boundary = readerContentIndex.entries.findIndex(location => location.pageId === pageId)
      expect(boundary).toBeGreaterThan(0)
      expect(getOverallProgress(readerContentIndex.entries[boundary])).toBeGreaterThan(getOverallProgress(readerContentIndex.entries[boundary - 1]))
    }
  })

  it('changes scene metadata only when needed and clamps percentages', () => {
    const scene = readerContent[0].pages[0].scene
    expect(hasReaderSceneChanged(scene, { ...scene })).toBe(false)
    expect(hasReaderSceneChanged(scene, { ...scene, label: '另一处' })).toBe(true)
    expect(getReaderProgressPercentage(-1)).toBe(0)
    expect(getReaderProgressPercentage(2)).toBe(100)
    expect(getReaderProgressPercentage(Number.NaN)).toBe(0)
  })

  it('persists tutorial and chapter endpoint state without obsolete wheel-stepped transitions', () => {
    const serialized = serializeProgressV2({
      readerExitGestureLearned: true,
      chapterTrialEnded: true,
    })
    const restored = sanitizeV2Progress(serialized)
    expect(restored.readerExitGestureLearned).toBe(true)
    expect(restored.narrativeTransition).toBeUndefined()
    expect(restored.chapterTrialEnded).toBe(true)
  })
})
