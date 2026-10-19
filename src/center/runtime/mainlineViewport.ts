import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'

const normalizedViewportCenter = 50

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
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
  const cameraEdgePadding = 2
  const minX = Math.min(0, 100 - (scene.walkBounds.x + scene.walkBounds.width) - cameraEdgePadding)
  const minY = Math.min(0, 100 - (scene.walkBounds.y + scene.walkBounds.height) - cameraEdgePadding)
  return {
    x: clamp(followAnchor - position.x, minX, 0),
    y: clamp(followAnchor - position.y, minY, 0),
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
  const minX = Math.min(0, 100 - (scene.walkBounds.x + scene.walkBounds.width) - 2)
  const minY = Math.min(0, 100 - (scene.walkBounds.y + scene.walkBounds.height) - 2)
  return { x: clamp(desired.x, minX, 0), y: clamp(desired.y, minY, 0) }
}

export function advanceMainlineCamera(current: Point, target: Point, elapsedMs: number): Point {
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / 140)
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
}
