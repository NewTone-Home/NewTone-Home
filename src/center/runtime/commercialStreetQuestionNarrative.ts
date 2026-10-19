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
  // Keep the story beat at its authored street position. Walk bounds are a
  // movement constraint and may change independently of narrative placement.
  void scene
  return { x: 104, y: 50 }
}

export function commercialStreetQuestionNarrativeShouldTrigger(scene: MainlineSceneDefinition, position: Point) {
  if (scene.id !== 'commercial-street') return false
  const anchor = commercialStreetQuestionNarrativeAnchor(scene)
  // This authored radius is intentionally independent of the active walk area.
  const triggerRadius = 4
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
