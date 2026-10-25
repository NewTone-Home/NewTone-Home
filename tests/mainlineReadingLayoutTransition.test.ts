import { describe, expect, it } from 'vitest'
import { interpolateMainlineReadingLayout, mainlineReadingLayoutTransitionProgress, mainlineReadingLayoutsHaveSameSize } from '../src/center/runtime/mainlineReadingLayoutTransition'

describe('mainline reading page layout transition', () => {
  it('smoothly interpolates the visible box while keeping the target font size', () => {
    const from = { widthPx: 320, heightPx: 62, fontSizePx: 16 }
    const to = { widthPx: 128, heightPx: 48, fontSizePx: 16 }
    const progress = mainlineReadingLayoutTransitionProgress(180)
    const halfway = interpolateMainlineReadingLayout(from, to, progress)

    expect(progress).toBeGreaterThan(.5)
    expect(progress).toBeLessThan(1)
    expect(halfway.widthPx).toBeCloseTo(320 + (128 - 320) * progress, 8)
    expect(halfway.heightPx).toBeCloseTo(62 + (48 - 62) * progress, 8)
    expect(halfway.fontSizePx).toBe(16)
    expect(interpolateMainlineReadingLayout(from, to, 0)).toEqual(from)
    expect(interpolateMainlineReadingLayout(from, to, 1)).toEqual(to)
  })

  it('clamps progress and detects unchanged viewport/page sizes', () => {
    expect(mainlineReadingLayoutTransitionProgress(-10)).toBe(0)
    expect(mainlineReadingLayoutTransitionProgress(0)).toBe(0)
    expect(mainlineReadingLayoutTransitionProgress(500)).toBe(1)
    const progress = [0, 60, 120, 180, 240, 300, 360].map(time => mainlineReadingLayoutTransitionProgress(time))
    expect(progress).toEqual([...progress].sort((first, second) => first - second))
    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(1)
    expect(mainlineReadingLayoutsHaveSameSize(
      { widthPx: 140, heightPx: 48, fontSizePx: 12 },
      { widthPx: 140, heightPx: 48, fontSizePx: 12 },
    )).toBe(true)
    expect(mainlineReadingLayoutsHaveSameSize(
      { widthPx: 140, heightPx: 48, fontSizePx: 12 },
      { widthPx: 141, heightPx: 48, fontSizePx: 12 },
    )).toBe(false)
  })
})
