import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'

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

export function commercialStreetQuestionNarrativeShouldTrigger(scene: MainlineSceneDefinition, position: Point) {
  if (scene.id !== 'commercial-street') return false
  const anchor = commercialStreetQuestionNarrativeAnchor(scene)
  // The narrow trigger is one twentieth of the authored lane height. It is a
  // presentation region, not collision or an additional navigation target.
  const triggerRadius = scene.walkBounds.height / 20
  return Math.hypot(position.x - anchor.x, position.y - anchor.y) <= triggerRadius
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
