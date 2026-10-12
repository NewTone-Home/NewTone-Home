import { describe, expect, it } from 'vitest'
import { centerReadingDimmerFullTransitionMs, centerReadingDimmerTargets, centerReadingDimmerTransitionDurationMs } from '../src/center/runtime/readingDimmer'

describe('center reading dimmer timing', () => {
  it('preserves the approved observation and dialogue opacity targets with a slow full transition', () => {
    expect(centerReadingDimmerTargets).toEqual({ observation: .18, dialogue: .42 })
    expect(centerReadingDimmerFullTransitionMs).toBe(800)
    expect(centerReadingDimmerTransitionDurationMs(0, .18, .18)).toBe(800)
    expect(centerReadingDimmerTransitionDurationMs(.18, 0, .18)).toBe(800)
    expect(centerReadingDimmerTransitionDurationMs(0, .42, .42)).toBe(800)
    expect(centerReadingDimmerTransitionDurationMs(.42, 0, .42)).toBe(800)
    expect(centerReadingDimmerTransitionDurationMs(.21, .42, .42)).toBe(400)
  })
})
