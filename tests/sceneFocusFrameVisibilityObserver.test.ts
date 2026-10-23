import { describe, expect, it } from 'vitest'
import { sceneFocusFrameHiddenAncestors, sceneFocusFrameVisibilityChanged } from '../src/center/runtime/sceneFocusFrameVisibilityObserver'

describe('focus-frame visibility transitions', () => {
  it('remeasures when hidden visibility changes in either direction', () => {
    expect(sceneFocusFrameVisibilityChanged('hidden', 'visible')).toBe(true)
    expect(sceneFocusFrameVisibilityChanged('visible', 'hidden')).toBe(true)
  })

  it('does not remeasure for unrelated style changes or an initial sample', () => {
    expect(sceneFocusFrameVisibilityChanged('hidden', 'hidden')).toBe(false)
    expect(sceneFocusFrameVisibilityChanged(undefined, 'visible')).toBe(false)
  })

  it('includes the hidden scene layer outside the stage, but only through the document root', () => {
    const docRoot = { parentElement: null }
    const appRoot = { parentElement: docRoot }
    const sceneLayer = { parentElement: appRoot }
    const stage = { parentElement: sceneLayer }
    const glyph = { parentElement: stage }
    const hidden = new Set([sceneLayer])
    const ancestors = sceneFocusFrameHiddenAncestors(
      [glyph as unknown as HTMLElement],
      docRoot as unknown as HTMLElement,
      element => hidden.has(element) ? 'hidden' : 'visible',
    )

    expect(ancestors).toEqual([sceneLayer])
    expect(ancestors).not.toContain(stage)
    expect(ancestors).not.toContain(docRoot)
  })
})
