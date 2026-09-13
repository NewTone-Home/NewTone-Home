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
