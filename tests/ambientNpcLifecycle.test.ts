import { describe, expect, it } from 'vitest'
import {
  ambientNpcDwellDuration,
  ambientNpcOffstreetMaximumMs,
  ambientNpcOffstreetMinimumMs,
  ambientNpcShouldYieldToProtagonist,
  ambientNpcStoreVisitMaximumMs,
  ambientNpcStoreVisitMinimumMs,
} from '../src/center/runtime/ambientNpcLifecycle'
import { ambientNpcYieldEncounterDecision } from '../src/center/runtime/AmbientNpcMotion'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

describe('ambient NPC lifecycle', () => {
  it('keeps virtual storefront and offstreet dwell durations inside their approved ranges', () => {
    expect(ambientNpcDwellDuration(ambientNpcStoreVisitMinimumMs, ambientNpcStoreVisitMaximumMs, () => 0)).toBe(ambientNpcStoreVisitMinimumMs)
    expect(ambientNpcDwellDuration(ambientNpcStoreVisitMinimumMs, ambientNpcStoreVisitMaximumMs, () => 1)).toBe(ambientNpcStoreVisitMaximumMs)
    expect(ambientNpcDwellDuration(ambientNpcOffstreetMinimumMs, ambientNpcOffstreetMaximumMs, () => 0)).toBe(ambientNpcOffstreetMinimumMs)
    expect(ambientNpcDwellDuration(ambientNpcOffstreetMinimumMs, ambientNpcOffstreetMaximumMs, () => 1)).toBe(ambientNpcOffstreetMaximumMs)
  })

  it('makes a visible ambient dweller yield from proximity using the real occupancy footprints', () => {
    const street = mainlineScenes['commercial-street']
    const footprint = { width: street.wallDensity.horizontalBaselineEvery, height: street.wallDensity.verticalBaselineEvery }
    const protagonist = { actorId: 'protagonist', position: street.initialPlayerPosition, footprint, visible: true }
    const nearAmbient = { actorId: 'ambient', position: street.initialPlayerPosition, footprint, visible: true }
    const farAmbient = { actorId: 'ambient', position: { x: street.walkBounds.x, y: street.walkBounds.y }, footprint, visible: true }
    expect(ambientNpcShouldYieldToProtagonist(protagonist, nearAmbient)).toBe(true)
    expect(ambientNpcShouldYieldToProtagonist(protagonist, farAmbient)).toBe(false)
  })

  it('yields once per nearby encounter instead of rescheduling an ambient route every scene-clock frame', () => {
    expect(ambientNpcYieldEncounterDecision(true, false)).toEqual({ shouldYield: true, resetLatch: false })
    expect(ambientNpcYieldEncounterDecision(true, true)).toEqual({ shouldYield: false, resetLatch: false })
    expect(ambientNpcYieldEncounterDecision(false, true)).toEqual({ shouldYield: false, resetLatch: true })
    expect(ambientNpcYieldEncounterDecision(true, false)).toEqual({ shouldYield: true, resetLatch: false })
  })
})
