import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineLabelFootprint } from './sceneLayout'
import { sceneFocusStrokeInsetPx, sceneFocusVisualGapPx } from './sceneVisualBounds'
import { mainlineDeviceProjectionScale, type MainlineViewportMetrics } from './mainlineViewportProjection'

const normalizedViewportCenter = 50

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

/** Uniform CSS-pixel projection from the fixed authored world to the stage. */
export function mainlineWorldScale(viewport: MainlineViewportMetrics) {
  // The applied basis also serves camera/culling/input, even while browser
  // chrome changes the current drawable height or user zoom is preserved.
  return viewport.projectionScale ?? mainlineDeviceProjectionScale(viewport)
}

/** Logical percentage span visible through the uniformly projected world. */
export function mainlineVisibleWorldSpan(viewport: SceneScreenMetrics) {
  const scale = mainlineWorldScale(viewport)
  return {
    x: viewport.width / (sceneDesignReferenceMetrics.width * scale) * 100,
    y: viewport.height / (sceneDesignReferenceMetrics.height * scale) * 100,
  }
}

/** Overlay coordinates (percent of the live viewport), including local slides. */
export function mainlineViewportPointFromWorld(point: Point, viewport: SceneScreenMetrics, cameraOffset: Point): Point {
  const span = mainlineVisibleWorldSpan(viewport)
  return {
    x: 50 + (point.x + cameraOffset.x - 50) / span.x * 100,
    y: 50 + (point.y + cameraOffset.y - 50) / span.y * 100,
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

/** Boundary anchors are glyph centers. Include their text box and focus frame
 * when deciding whether the complete scene fits, without changing world scale. */
export function mainlineCameraVisualOutset(_viewport: SceneScreenMetrics): Point {
  const glyph = mainlineLabelFootprint('字', { x: 0, y: 0 }, sceneDesignReferenceMetrics)
  const frameGap = sceneFocusVisualGapPx + sceneFocusStrokeInsetPx
  return {
    x: glyph.width / 2 + frameGap / (sceneDesignReferenceMetrics.width) * 100,
    y: glyph.height / 2 + frameGap / (sceneDesignReferenceMetrics.height) * 100,
  }
}

function cameraOffsetForView(scene: CameraScene, position: Point, viewport: SceneScreenMetrics): Point {
  const visible = mainlineVisibleWorldSpan(viewport)
  const visualOutset = mainlineCameraVisualOutset(viewport)
  const axes = ['x', 'y'] as const
  const output = {} as Point
  axes.forEach((axis) => {
    const start = scene.walkBounds[axis]
    const size = axis === 'x' ? scene.walkBounds.width : scene.walkBounds.height
    const span = visible[axis]
    const padding = Math.max(visualOutset[axis], Math.min(2, span * .04))
    // Overscan outside the authored bounds so edge walls and their frames fit.
    // Adding padding to the minimum center instead clips that outer edge.
    const centerMin = start + span / 2 - padding
    const centerMax = start + size - span / 2 + padding
    const fits = size + 2 * visualOutset[axis] <= span
    const center = fits ? start + size / 2 : clamp(position[axis], centerMin, centerMax)
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
  // Center only when the full boundary glyphs/frames fit. Otherwise follow on
  // the overflowing axis, including a small pan for an almost-fitting scene.
  return cameraOffsetForView(scene, position, viewport)
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
  return cameraOffsetForView(scene, targetCenter, viewport)
}

export function advanceMainlineCamera(current: Point, target: Point, elapsedMs: number): Point {
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / 140)
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
}

/** Limit a camera-policy handoff by its visible screen movement, without
 * changing the target, world position, or the shared input projection. */
export function advanceMainlineCameraHandoff(
  current: Point,
  target: Point,
  elapsedMs: number,
  viewport: SceneScreenMetrics,
  maxScreenDeltaPx = 6,
): Point {
  const eased = advanceMainlineCamera(current, target, elapsedMs)
  const scale = mainlineWorldScale(viewport as MainlineViewportMetrics)
  const screenDelta = {
    x: (eased.x - current.x) / 100 * sceneDesignReferenceMetrics.width * scale,
    y: (eased.y - current.y) / 100 * sceneDesignReferenceMetrics.height * scale,
  }
  const distance = Math.hypot(screenDelta.x, screenDelta.y)
  if (distance <= maxScreenDeltaPx || distance === 0) return eased
  const ratio = maxScreenDeltaPx / distance
  return {
    x: current.x + (eased.x - current.x) * ratio,
    y: current.y + (eased.y - current.y) * ratio,
  }
}
