import { describe, expect, it } from 'vitest'
import { readerContent } from '../src/data/readerContent'
import { createStaticStageView, getBeatVisualState } from '../src/reader/readerStageModel'

describe('ReaderStage static model', () => {
  it('maps focus, near, and far states deterministically', () => {
    expect(getBeatVisualState(1, 1)).toBe('focus')
    expect(getBeatVisualState(0, 1)).toBe('near')
    expect(getBeatVisualState(2, 1)).toBe('near')
    expect(getBeatVisualState(3, 1)).toBe('far')
  })

  it('creates a stable static view without navigation or persistence', () => {
    const view = createStaticStageView(readerContent[0])

    expect(view.phaseId).toBe('M1')
    expect(view.page.id).toBe('ancestral-home')
    expect(view.focusBeatIndex).toBe(1)
    expect(view.progress).toBe(0)
  })

  it('rejects a phase without a preview page', () => {
    expect(() => createStaticStageView({ id: 'M1', pages: [] })).toThrow(
      'Static ReaderStage preview requires a page',
    )
  })
})
