import { describe, expect, it } from 'vitest'
import { sceneFocusFrameVisibilityChanged } from '../src/center/runtime/sceneFocusFrameVisibilityObserver'

describe('focus-frame visibility transitions', () => {
  it('remeasures when hidden visibility changes in either direction', () => {
    expect(sceneFocusFrameVisibilityChanged('hidden', 'visible')).toBe(true)
    expect(sceneFocusFrameVisibilityChanged('visible', 'hidden')).toBe(true)
  })

  it('does not remeasure for unrelated style changes or an initial sample', () => {
    expect(sceneFocusFrameVisibilityChanged('hidden', 'hidden')).toBe(false)
    expect(sceneFocusFrameVisibilityChanged(undefined, 'visible')).toBe(false)
  })
})
