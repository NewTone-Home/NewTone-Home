import type { Point } from './sceneGeometry'
import type { NavigationActorSnapshot } from './navigationCore'

export const ambientNpcStoreVisitMinimumMs = 5_000
export const ambientNpcStoreVisitMaximumMs = 12_000
export const ambientNpcOffstreetMinimumMs = 10_000
export const ambientNpcOffstreetMaximumMs = 25_000

export function ambientNpcDwellDuration(minimumMs: number, maximumMs: number, random = Math.random) {
  if (maximumMs <= minimumMs) return minimumMs
  return minimumMs + Math.round(random() * (maximumMs - minimumMs))
}

/**
 * Ambient dwell belongs to presentation, so it yields before its physical
 * actor can become a long-lived obstacle for the protagonist. The distance
 * comes from the two real occupancy footprints rather than scene coordinates.
 */
export function ambientNpcShouldYieldToProtagonist(
  protagonist: NavigationActorSnapshot | undefined,
  ambient: NavigationActorSnapshot | undefined,
) {
  if (!protagonist || !ambient || !protagonist.visible || !ambient.visible) return false
  const clearance = Math.max(
    protagonist.footprint.width,
    protagonist.footprint.height,
    ambient.footprint.width,
    ambient.footprint.height,
  )
  return Math.hypot(protagonist.position.x - ambient.position.x, protagonist.position.y - ambient.position.y) <= clearance
}

export function ambientNpcReentryPoint(point: Point): Point {
  return { ...point }
}
