import type { MainlineSceneId } from './mainlineSceneModel'
import type { Point } from './sceneGeometry'

/**
 * Presentation metadata emitted only after a passage has genuinely crossed
 * and its target safe-entry position has been resolved.
 */
export type MainlineWalkingPassageTransitionIntent = {
  kind: 'walking-passage'
  presentation: 'local-slide'
  passageId: string
  sourceSceneId: MainlineSceneId
  targetSceneId: MainlineSceneId
  sourceCrossingPosition: Point
  safeEntryPosition: Point
  slideDirection: 'left' | 'right' | 'up' | 'down'
}

export const localSlidePrototypeDurationMs = 280

/** The world moves opposite to the actor's final doorway crossing direction. */
export function localSlideDirectionForCrossing(from: Point, to: Point): MainlineWalkingPassageTransitionIntent['slideDirection'] {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? 'left' : 'right'
  return deltaY >= 0 ? 'up' : 'down'
}

export function isLocalSlidePrototypeIntent(intent: MainlineWalkingPassageTransitionIntent | undefined): intent is MainlineWalkingPassageTransitionIntent {
  return intent?.kind === 'walking-passage' && intent.presentation === 'local-slide'
}
