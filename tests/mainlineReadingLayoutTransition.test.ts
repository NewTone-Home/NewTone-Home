import { describe, expect, it } from 'vitest'
import { interpolateMainlineReadingLayout, mainlineReadingLayoutTransitionProgress, mainlineReadingLayoutsHaveSameSize } from '../src/center/runtime/mainlineReadingLayoutTransition'
import { mainlineEchoLayout } from '../src/center/runtime/mainlineEchoLayout'

describe('mainline reading page layout transition', () => {
  it('folds out, resizes the empty frame, then opens the new page without scaling type', () => {
    const from = { widthPx: 320, heightPx: 62, fontSizePx: 16 }
    const to = { widthPx: 128, heightPx: 48, fontSizePx: 16 }
    const early = mainlineReadingLayoutTransitionProgress(120)
    const resize = mainlineReadingLayoutTransitionProgress(160)
    const late = mainlineReadingLayoutTransitionProgress(400)
    const midway = interpolateMainlineReadingLayout(from, to, resize)

    expect(early).toBeLessThan(1 / 3)
    expect(resize).toBeGreaterThan(1 / 3)
    expect(resize).toBeLessThan(2 / 3)
    expect(late).toBeGreaterThan(2 / 3)
    expect(midway.widthPx).toBeGreaterThan(128)
    expect(midway.widthPx).toBeLessThan(320)
    expect(midway.heightPx).toBeGreaterThan(48)
    expect(midway.heightPx).toBeLessThan(62)
    expect(midway.fontSizePx).toBe(16)
    expect(interpolateMainlineReadingLayout(from, to, 0)).toEqual(from)
    expect(interpolateMainlineReadingLayout(from, to, 1)).toEqual(to)
    expect(interpolateMainlineReadingLayout(from, to, early)).toEqual(from)
    expect(interpolateMainlineReadingLayout(from, to, late)).toEqual(to)
  })

  it('clamps progress and detects unchanged viewport/page sizes', () => {
    expect(mainlineReadingLayoutTransitionProgress(-10)).toBe(0)
    expect(mainlineReadingLayoutTransitionProgress(0)).toBe(0)
    expect(mainlineReadingLayoutTransitionProgress(500)).toBe(1)
    const progress = [0, 80, 160, 240, 320, 400, 480].map(time => mainlineReadingLayoutTransitionProgress(time))
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

  it('measures multiline page height so the frame can interpolate instead of being pushed by content', () => {
    const metrics = { width: 411, height: 914, viewportWidth: 411 }
    const longPage = mainlineEchoLayout('短行\n一段明显更长的文字内容需要在窄屏上继续换行显示', metrics, { maxWidthPx: 112 })
    const shortPage = mainlineEchoLayout('短行', metrics, { maxWidthPx: 112 })
    expect(longPage.heightPx).toBeGreaterThan(shortPage.heightPx)
    const halfway = interpolateMainlineReadingLayout(longPage, shortPage, .5)
    expect(halfway.heightPx).toBeLessThan(longPage.heightPx)
    expect(halfway.heightPx).toBeGreaterThan(shortPage.heightPx)
    expect(halfway.fontSizePx).toBe(longPage.fontSizePx)
  })
})
