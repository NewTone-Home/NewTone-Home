import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

const normalizedViewportCenter = 50

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

/** Uniform CSS-pixel projection from the fixed authored world to the stage. */
export function mainlineWorldScale(viewport: SceneScreenMetrics) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  const referenceAspect = sceneDesignReferenceMetrics.width / sceneDesignReferenceMetrics.height
  return width / height < referenceAspect
    ? height / sceneDesignReferenceMetrics.height
    : Math.min(width / sceneDesignReferenceMetrics.width, height / sceneDesignReferenceMetrics.height)
}

/** Logical percentage span visible through the uniformly projected world. */
export function mainlineVisibleWorldSpan(viewport: SceneScreenMetrics) {
  const scale = mainlineWorldScale(viewport)
  return {
    x: viewport.width / (sceneDesignReferenceMetrics.width * scale) * 100,
    y: viewport.height / (sceneDesignReferenceMetrics.height * scale) * 100,
  }
}

/** Map a stage pointer back through the single world projection and camera. */
export function mainlineWorldPointFromClient(
  client: Point,
  stage: { left: number; top: number; width: number; height: number },
  viewport: SceneScreenMetrics,
  cameraOffset: Point,
): Point {
  const scale = mainlineWorldScale(viewport)
  return {
    x: ((client.x - stage.left - stage.width / 2) / scale / sceneDesignReferenceMetrics.width + .5) * 100 - cameraOffset.x,
    y: ((client.y - stage.top - stage.height / 2) / scale / sceneDesignReferenceMetrics.height + .5) * 100 - cameraOffset.y,
  }
}

/** Center a complete room frame as one visual unit, leaving a safe edge for glyphs. */
export function fixedFrameCameraOffset(scene: Pick<MainlineSceneDefinition, 'walkBounds'>): Point {
  return {
    x: normalizedViewportCenter - (scene.walkBounds.x + scene.walkBounds.width / 2),
    y: normalizedViewportCenter - (scene.walkBounds.y + scene.walkBounds.height / 2),
  }
}

type CameraScene = Pick<MainlineSceneDefinition, 'walkBounds'> & Partial<Pick<MainlineSceneDefinition, 'id'>>

function cameraOffsetForView(scene: CameraScene, position: Point, viewport: SceneScreenMetrics, follow: boolean): Point {
  const visible = mainlineVisibleWorldSpan(viewport)
  const axes = ['x', 'y'] as const
  const output = {} as Point
  axes.forEach((axis) => {
    const start = scene.walkBounds[axis]
    const size = axis === 'x' ? scene.walkBounds.width : scene.walkBounds.height
    const span = visible[axis]
    const padding = Math.min(2, span * .04)
    const centerMin = start + Math.min(size / 2, span / 2 + (size > span ? padding : 0))
    const centerMax = start + size - Math.min(size / 2, span / 2 + (size > span ? padding : 0))
    const preferredCenter = follow ? position[axis] : start + size / 2
    const center = size <= span ? start + size / 2 : clamp(preferredCenter, centerMin, centerMax)
    output[axis] = normalizedViewportCenter - center
  })
  return output
}

/** The only camera-policy selector for every mainline scene. */
export function mainlineCameraOffset(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'> & Partial<Pick<MainlineSceneDefinition, 'id'>>,
  position: Point,
  embedded = false,
  viewport: SceneScreenMetrics = sceneDesignReferenceMetrics,
): Point {
  if (embedded) return { x: 0, y: 0 }
  // Fixed-frame scenes remain fully centered when they fit; on a smaller
  // viewport, follow the actor on whichever axis no longer fits.
  return cameraOffsetForView(scene, position, viewport, scene.viewport !== 'fixed-frame' || mainlineVisibleWorldSpan(viewport).x < scene.walkBounds.width || mainlineVisibleWorldSpan(viewport).y < scene.walkBounds.height)
}

/** Keep the central 30% free of camera motion, then clamp to authored bounds. */
export function mainlineCameraTarget(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'> & Partial<Pick<MainlineSceneDefinition, 'id'>>,
  position: Point,
  current: Point,
  embedded = false,
  viewport: SceneScreenMetrics = sceneDesignReferenceMetrics,
): Point {
  if (embedded) return { x: 0, y: 0 }
  const visible = mainlineVisibleWorldSpan(viewport)
  const offset = { ...current }
  for (const axis of ['x', 'y'] as const) {
    const screen = 50 + (position[axis] + current[axis] - 50) / visible[axis] * 100
    if (screen < 35) offset[axis] += (35 - screen) / 100 * visible[axis]
    if (screen > 65) offset[axis] -= (screen - 65) / 100 * visible[axis]
  }
  const targetCenter = { x: 50 - offset.x, y: 50 - offset.y }
  return cameraOffsetForView(scene, targetCenter, viewport, true)
}

export function advanceMainlineCamera(current: Point, target: Point, elapsedMs: number): Point {
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / 140)
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
}
