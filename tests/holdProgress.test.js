import { describe, expect, it } from 'vitest'
import { HOLD_PROGRESS_TIMINGS, stepHoldProgress } from '../src/interactions/holdProgress'

describe('sustained hover progress', () => {
  it('draws continuously only toward the active target', () => {
    const first = stepHoldProgress(0, 1, 300)
    const second = stepHoldProgress(first, 1, 300)
    expect(first).toBeCloseTo(0.2)
    expect(second).toBeCloseTo(0.4)
  })

  it('retracts continuously after the pointer leaves', () => {
    const next = stepHoldProgress(0.6, 0, HOLD_PROGRESS_TIMINGS.RETRACT_MS / 2)
    expect(next).toBeCloseTo(0.1)
    expect(stepHoldProgress(next, 0, HOLD_PROGRESS_TIMINGS.RETRACT_MS)).toBe(0)
  })

  it('clamps at both endpoints', () => {
    expect(stepHoldProgress(0.98, 1, HOLD_PROGRESS_TIMINGS.DRAW_MS)).toBe(1)
    expect(stepHoldProgress(0.02, 0, HOLD_PROGRESS_TIMINGS.RETRACT_MS)).toBe(0)
  })
})
