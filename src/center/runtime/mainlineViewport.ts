import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'

const normalizedViewportCenter = 50

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function cameraOffsetRange(start: number, length: number) {
  const fitMinimum = 2 - start
  const fitMaximum = 98 - (start + length)
  if (fitMinimum <= fitMaximum) return { minimum: fitMinimum, maximum: fitMaximum }
  return { minimum: Math.min(0, 100 - (start + length) - 2), maximum: 0 }
}

/** Center a complete room frame as one visual unit, leaving a safe edge for glyphs. */
export function fixedFrameCameraOffset(scene: Pick<MainlineSceneDefinition, 'walkBounds'>): Point {
  return {
    x: normalizedViewportCenter - (scene.walkBounds.x + scene.walkBounds.width / 2),
    y: normalizedViewportCenter - (scene.walkBounds.y + scene.walkBounds.height / 2),
  }
}

function followPlayerCameraOffset(scene: Pick<MainlineSceneDefinition, 'walkBounds'>, position: Point): Point {
  const followAnchor = normalizedViewportCenter
  const xRange = cameraOffsetRange(scene.walkBounds.x, scene.walkBounds.width)
  const yRange = cameraOffsetRange(scene.walkBounds.y, scene.walkBounds.height)
  return {
    x: clamp(followAnchor - position.x, xRange.minimum, xRange.maximum),
    y: clamp(followAnchor - position.y, yRange.minimum, yRange.maximum),
  }
}

/** The only camera-policy selector for every mainline scene. */
export function mainlineCameraOffset(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'>,
  position: Point,
  embedded = false,
): Point {
  if (embedded) return { x: 0, y: 0 }
  return scene.viewport === 'fixed-frame'
    ? fixedFrameCameraOffset(scene)
    : followPlayerCameraOffset(scene, position)
}

/** Keep the central 30% free of camera motion; clamp against scene edges. */
export function mainlineCameraTarget(scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'>, position: Point, current: Point, embedded = false): Point {
  if (embedded || scene.viewport === 'fixed-frame') return mainlineCameraOffset(scene, position, embedded)
  const desired = { ...current }
  for (const axis of ['x', 'y'] as const) {
    const screen = position[axis] + current[axis]
    if (screen < 35) desired[axis] += 35 - screen
    if (screen > 65) desired[axis] += 65 - screen
  }
  const xRange = cameraOffsetRange(scene.walkBounds.x, scene.walkBounds.width)
  const yRange = cameraOffsetRange(scene.walkBounds.y, scene.walkBounds.height)
  return { x: clamp(desired.x, xRange.minimum, xRange.maximum), y: clamp(desired.y, yRange.minimum, yRange.maximum) }
}

export function advanceMainlineCamera(current: Point, target: Point, elapsedMs: number): Point {
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / 140)
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
}
