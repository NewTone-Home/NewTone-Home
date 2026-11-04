import { advanceMainlineCamera } from './mainlineViewport'
import type { Point } from './sceneGeometry'

export const commercialStreetQuestionCameraHandoffMaxFrameMs = 32
export const commercialStreetQuestionCameraHandoffEpsilon = 0.005

/** Follow the normal street camera target with its existing 140ms easing.
 * Clamp a resumed-frame delta so a suspended tab cannot snap the handoff. */
export function advanceCommercialStreetQuestionCameraHandoff(current: Point, target: Point, elapsedMs: number): Point {
  return advanceMainlineCamera(current, target, Math.min(commercialStreetQuestionCameraHandoffMaxFrameMs, Math.max(0, elapsedMs)))
}

export function commercialStreetQuestionCameraHandoffSettled(current: Point, target: Point): boolean {
  return Math.hypot(target.x - current.x, target.y - current.y) < commercialStreetQuestionCameraHandoffEpsilon
}
