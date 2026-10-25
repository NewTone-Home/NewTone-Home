import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { freeRoamWaypointArrivalRadius } from './useFreeRoamMovement'

/** Persisted only after the final internal-dialogue line has rolled away. */
export const commercialStreetQuestionNarrativeCompletedKey = 'commercialStreetQuestionNarrativeCompleted'

export const commercialStreetQuestionNarrativeLines = [
  '难道刚刚是幻觉吗？',
  '不，不会认错的。',
  '那张脸修杰太过于熟悉。',
] as const

export type CommercialStreetQuestionNarrativePhase = 'active' | 'leaving'

export type CommercialStreetQuestionNarrativeState = {
  phase: CommercialStreetQuestionNarrativePhase
  segmentIndex: number
}

/**
 * The question mark belongs at the geometric centre of Commercial Street's
 * navigable lane. Deriving that authored anchor keeps presentation aligned
 * with the real scene bounds without adding collision or navigation geometry.
 */
export function commercialStreetQuestionNarrativeAnchor(scene: MainlineSceneDefinition): Point {
  return {
    x: scene.walkBounds.x + scene.walkBounds.width / 2,
    y: scene.walkBounds.y + scene.walkBounds.height / 2,
  }
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y)
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy))
}

/** Trigger only when the actor reaches the mark's finite waypoint tolerance or crosses it while moving. */
export function commercialStreetQuestionNarrativeShouldTrigger(scene: MainlineSceneDefinition, position: Point, previousPosition?: Point, completed = false) {
  if (completed || scene.id !== 'commercial-street') return false
  if (!previousPosition || (previousPosition.x === position.x && previousPosition.y === position.y)) return false
  const anchor = commercialStreetQuestionNarrativeAnchor(scene)
  if (Math.hypot(position.x - anchor.x, position.y - anchor.y) <= freeRoamWaypointArrivalRadius) return true
  return distanceToSegment(anchor, previousPosition, position) <= freeRoamWaypointArrivalRadius
}

export function nextCommercialStreetQuestionNarrative(state: CommercialStreetQuestionNarrativeState): CommercialStreetQuestionNarrativeState {
  if (state.phase === 'leaving') return state
  if (state.segmentIndex + 1 < commercialStreetQuestionNarrativeLines.length) {
    return { ...state, segmentIndex: state.segmentIndex + 1 }
  }
  return { ...state, phase: 'leaving' }
}

export function commercialStreetQuestionNarrativeCompleted(value: unknown) {
  return value === true
}
