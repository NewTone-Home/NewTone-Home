import { describe, expect, it } from 'vitest'
import { advanceCommercialStreetQuestionCameraHandoff, commercialStreetQuestionCameraHandoffSettled } from '../src/center/runtime/commercialStreetQuestionCameraHandoff'

describe('commercial street question camera handoff', () => {
  it('moves from the retained reading camera toward the current normal camera target over frames', () => {
    const retained = { x: -25.137286569185648, y: -0.2590666666666692 }
    const normal = { x: -47.2429219733245, y: -0.25906666666669054 }
    const first = advanceCommercialStreetQuestionCameraHandoff(retained, normal, 1000 / 60)

    expect(first.x).toBeLessThan(retained.x)
    expect(first.x).toBeGreaterThan(normal.x)
    expect(Math.abs(first.x - retained.x)).toBeLessThan(Math.abs(normal.x - retained.x))
    expect(commercialStreetQuestionCameraHandoffSettled(first, normal)).toBe(false)
  })

  it('tracks a changed normal target and clamps a resumed-frame delta instead of snapping', () => {
    const current = { x: -30, y: 1 }
    const target = { x: -48, y: -2 }
    const regular = advanceCommercialStreetQuestionCameraHandoff(current, target, 1000 / 60)
    const resumed = advanceCommercialStreetQuestionCameraHandoff(current, target, 10_000)
    const retargeted = advanceCommercialStreetQuestionCameraHandoff(regular, { x: -22, y: 0 }, 1000 / 60)

    expect(resumed).toEqual(advanceCommercialStreetQuestionCameraHandoff(current, target, 32))
    expect(resumed.x).toBeLessThan(current.x)
    expect(resumed.x).toBeGreaterThan(target.x)
    expect(regular.x).toBeLessThan(current.x)
    expect(retargeted.x).toBeGreaterThan(regular.x)
    expect(commercialStreetQuestionCameraHandoffSettled(target, target)).toBe(true)
  })
})
