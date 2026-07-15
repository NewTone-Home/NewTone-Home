import { describe, expect, it } from 'vitest'
import { readerContent } from '../src/data/readerContent'
import {
  getReaderProgressPercentage,
  hasReaderSceneChanged,
} from '../src/reader/readerPresentation'
import { getOverallProgress, readerContentIndex } from '../src/reader/readerPosition'
import { sanitizeV2Progress, serializeProgressV2 } from '../src/stores/progressMigration'

describe('Reader data-driven presentation', () => {
  it('derives continuous progress from the stable content index in both directions', () => {
    const percentages = readerContentIndex.entries.map(location => (
      getReaderProgressPercentage(getOverallProgress(location))
    ))

    expect(percentages[0]).toBe(0)
    expect(percentages.at(-1)).toBe(100)
    expect(percentages.every((value, index) => index === 0 || value >= percentages[index - 1])).toBe(true)
    expect([...percentages].reverse().every((value, index, values) => index === 0 || value <= values[index - 1])).toBe(true)
  })

  it('keeps progress continuous across page and phase boundaries', () => {
    const pageBoundary = readerContentIndex.entries.findIndex(location => location.pageId === 'm1-signal')
    const phaseBoundary = readerContentIndex.entries.findIndex(location => location.phaseId === 'M2')

    expect(pageBoundary).toBeGreaterThan(0)
    expect(phaseBoundary).toBeGreaterThan(pageBoundary)
    expect(getOverallProgress(readerContentIndex.entries[pageBoundary]))
      .toBeGreaterThan(getOverallProgress(readerContentIndex.entries[pageBoundary - 1]))
    expect(getOverallProgress(readerContentIndex.entries[phaseBoundary]))
      .toBeGreaterThan(getOverallProgress(readerContentIndex.entries[phaseBoundary - 1]))
  })

  it('changes the scene only when its metadata changes', () => {
    const scene = readerContent[0].pages[0].scene
    expect(hasReaderSceneChanged(scene, { ...scene })).toBe(false)
    expect(hasReaderSceneChanged(scene, { ...scene, label: '另一处' })).toBe(true)
    expect(hasReaderSceneChanged(scene, readerContent[0].pages[1].scene)).toBe(true)
  })

  it('clamps invalid progress props without reading browser scroll state', () => {
    expect(getReaderProgressPercentage(-1)).toBe(0)
    expect(getReaderProgressPercentage(2)).toBe(100)
    expect(getReaderProgressPercentage(Number.NaN)).toBe(0)
  })

  it('persists the dismissed exit tutorial state across v2 reloads', () => {
    const serialized = serializeProgressV2({ exitTutorialSeen: true })
    expect(sanitizeV2Progress(serialized).exitTutorialSeen).toBe(true)
  })
})
