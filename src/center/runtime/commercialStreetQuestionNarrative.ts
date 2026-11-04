import type { Point } from './sceneGeometry'
import { sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { sceneTextPresentationPosition } from './sceneTextPresentation'

/** Persisted only after the final internal-dialogue line has rolled away. */
export const commercialStreetQuestionNarrativeCompletedKey = 'commercialStreetQuestionNarrativeCompleted'

export const commercialStreetQuestionNarrativeLines = [
  '难道刚才是幻觉？',
  '不，不可能认错。',
  '那张脸，我太熟悉了。',
] as const

/** Keep this short inner monologue in the currently visible street page. The
 * renderer may still make a necessary pan for a viewport that cannot fit it. */
export function commercialStreetQuestionDialoguePosition(
  scene: MainlineSceneDefinition,
  protagonist: Point,
  text: string,
  screenMetrics: SceneScreenMetrics,
  worldScale: number,
  currentCameraOffset: Point,
) {
  return sceneTextPresentationPosition(scene, protagonist, text, screenMetrics, 'dialogue', worldScale, currentCameraOffset)
}

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

// Scene positions are percentages, while the glyph and actor hitboxes are CSS px.
// At the 1920×1080 design reference, the rendered mark is ~17×36px and protagonist
// ~11×21px. Convert their overlap extents back to percentages with a 1px margin.
const questionMarkOverlapMarginPx = 1
const questionMarkOverlapHalfWidthPx = (17.1 + 11) / 2 + questionMarkOverlapMarginPx
const questionMarkOverlapHalfHeightPx = (35.75 + 21) / 2 + questionMarkOverlapMarginPx
export const commercialStreetQuestionTriggerHalfWidth = (questionMarkOverlapHalfWidthPx / sceneDesignReferenceMetrics.width) * 100
export const commercialStreetQuestionTriggerHalfHeight = (questionMarkOverlapHalfHeightPx / sceneDesignReferenceMetrics.height) * 100

function pointInsideQuestionBounds(point: Point, anchor: Point) {
  return Math.abs(point.x - anchor.x) <= commercialStreetQuestionTriggerHalfWidth
    && Math.abs(point.y - anchor.y) <= commercialStreetQuestionTriggerHalfHeight
}

function segmentIntersectsQuestionBounds(start: Point, end: Point, anchor: Point) {
  let enter = 0
  let exit = 1
  const clip = (origin: number, delta: number, min: number, max: number) => {
    if (Math.abs(delta) <= Number.EPSILON) return origin >= min && origin <= max
    const a = (min - origin) / delta
    const b = (max - origin) / delta
    enter = Math.max(enter, Math.min(a, b))
    exit = Math.min(exit, Math.max(a, b))
    return enter <= exit
  }
  return clip(start.x, end.x - start.x,
    anchor.x - commercialStreetQuestionTriggerHalfWidth,
    anchor.x + commercialStreetQuestionTriggerHalfWidth)
    && clip(start.y, end.y - start.y,
      anchor.y - commercialStreetQuestionTriggerHalfHeight,
      anchor.y + commercialStreetQuestionTriggerHalfHeight)
}

/** Trigger when the protagonist reaches or crosses the visible marker footprint. */
export function commercialStreetQuestionNarrativeShouldTrigger(scene: MainlineSceneDefinition, position: Point, previousPosition?: Point, completed = false) {
  if (completed || scene.id !== 'commercial-street') return false
  const anchor = commercialStreetQuestionNarrativeAnchor(scene)
  if (pointInsideQuestionBounds(position, anchor)) return true
  if (!previousPosition) return false
  return segmentIntersectsQuestionBounds(previousPosition, position, anchor)
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
