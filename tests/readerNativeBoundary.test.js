import { describe, expect, it } from 'vitest'
import {
  getNativeBoundaries,
  getNativeEdgeSpace,
  getSceneEntryPresentation,
} from '../src/components/reader/ReaderBeatStack'

describe('Reader native scroll boundary contract', () => {
  it('derives top and bottom from the scroll container, not from a guessed beat index', () => {
    expect(getNativeBoundaries({ scrollTop: 180, scrollHeight: 1200, clientHeight: 720 })).toEqual({
      scrollTop: 180,
      maxScrollTop: 480,
      atTop: false,
      atBottom: false,
    })
    expect(getNativeBoundaries({ scrollTop: 0, scrollHeight: 1200, clientHeight: 720 }).atTop).toBe(true)
    expect(getNativeBoundaries({ scrollTop: 480, scrollHeight: 1200, clientHeight: 720 }).atBottom).toBe(true)
    expect(getNativeBoundaries({ scrollTop: 472, scrollHeight: 1200, clientHeight: 720 }).atBottom).toBe(true)
  })

  it('keeps the first and last beats centerable without a fixed mobile bottom spacer', () => {
    expect(getNativeEdgeSpace(
      { clientHeight: 620 },
      { children: [{ offsetHeight: 88 }, { offsetHeight: 124 }] },
    )).toBe(248)
  })

  it('keeps the first entry sentence clear while its scene moves up from below', () => {
    expect(getSceneEntryPresentation(0, 0)).toEqual({
      opacity: 1,
      liftPx: 240,
      blurPx: 0,
      scale: 1,
    })
    expect(getSceneEntryPresentation(0, 0.5)).toEqual({
      opacity: 1,
      liftPx: 120,
      blurPx: 0,
      scale: 1,
    })
    expect(getSceneEntryPresentation(1, 0)).toMatchObject({
      opacity: 0.001,
      liftPx: 120,
      scale: 0.985,
    })
    expect(getSceneEntryPresentation(1, 0).blurPx).toBeCloseTo(3.4)
  })
})
