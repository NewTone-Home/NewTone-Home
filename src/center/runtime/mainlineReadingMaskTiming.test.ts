import { describe, expect, it } from 'vitest'
import { mainlineReadingMaskTargetFraction, mainlineReadingMaskLeadMs, mainlineReadingMaskReleaseDelayMs } from './mainlineReadingTextMotion'

describe('reading mask timing lead', () => {
  it('leads typing and trails deletion by about three 45ms glyphs', () => {
    expect(mainlineReadingMaskLeadMs).toBe(100)
    expect(mainlineReadingMaskReleaseDelayMs).toBe(120)
    expect(mainlineReadingMaskTargetFraction(0, 20, 'typing', 45)).toBe(.15)
    expect(mainlineReadingMaskTargetFraction(5, 20, 'deleting', 45)).toBe(.4)
    expect(mainlineReadingMaskTargetFraction(19, 20, 'typing', 45)).toBe(1)
    expect(mainlineReadingMaskTargetFraction(20, 20, 'static', 45)).toBe(1)
    expect(mainlineReadingMaskTargetFraction(0, 20, 'deleted', 45)).toBe(0)
  })
})
