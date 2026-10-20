import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { projectCommercialStreetX } from './commercialStreetGridProjection'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

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

type CameraScene = Pick<MainlineSceneDefinition, 'walkBounds'> & Partial<Pick<MainlineSceneDefinition, 'id'>>

function projectedX(scene: CameraScene, x: number, screenMetrics: SceneScreenMetrics) {
  return scene.id === 'commercial-street' ? projectCommercialStreetX(x, screenMetrics) : x
}

function followPlayerCameraOffset(scene: CameraScene, position: Point, screenMetrics: SceneScreenMetrics): Point {
  const followAnchor = normalizedViewportCenter
  const cameraEdgePadding = 2
  const left = projectedX(scene, scene.walkBounds.x, screenMetrics)
  const right = projectedX(scene, scene.walkBounds.x + scene.walkBounds.width, screenMetrics)
  const minX = Math.min(0, 100 - right - cameraEdgePadding)
  const maxX = Math.max(0, cameraEdgePadding - left)
  const minY = Math.min(0, 100 - (scene.walkBounds.y + scene.walkBounds.height) - cameraEdgePadding)
  const maxY = Math.max(0, cameraEdgePadding - scene.walkBounds.y)
  return {
    x: clamp(followAnchor - projectedX(scene, position.x, screenMetrics), minX, maxX),
    y: clamp(followAnchor - position.y, minY, maxY),
  }
}

/** The only camera-policy selector for every mainline scene. */
export function mainlineCameraOffset(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'> & Partial<Pick<MainlineSceneDefinition, 'id'>>,
  position: Point,
  embedded = false,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): Point {
  if (embedded) return { x: 0, y: 0 }
  if (scene.viewport === 'fixed-frame') {
    const offset = fixedFrameCameraOffset(scene)
    return scene.id === 'commercial-street'
      ? { ...offset, x: normalizedViewportCenter - projectedX(scene, scene.walkBounds.x + scene.walkBounds.width / 2, screenMetrics) }
      : offset
  }
  return followPlayerCameraOffset(scene, position, screenMetrics)
}

/** Keep the central 30% free of camera motion; clamp against scene edges. */
export function mainlineCameraTarget(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'> & Partial<Pick<MainlineSceneDefinition, 'id'>>,
  position: Point,
  current: Point,
  embedded = false,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): Point {
  if (embedded || scene.viewport === 'fixed-frame') return mainlineCameraOffset(scene, position, embedded, screenMetrics)
  const desired = { ...current }
  for (const axis of ['x', 'y'] as const) {
    const screen = (axis === 'x' ? projectedX(scene, position.x, screenMetrics) : position.y) + current[axis]
    if (screen < 35) desired[axis] += 35 - screen
    if (screen > 65) desired[axis] += 65 - screen
  }
  const left = projectedX(scene, scene.walkBounds.x, screenMetrics)
  const right = projectedX(scene, scene.walkBounds.x + scene.walkBounds.width, screenMetrics)
  const minX = Math.min(0, 100 - right - 2)
  const maxX = Math.max(0, 2 - left)
  const minY = Math.min(0, 100 - (scene.walkBounds.y + scene.walkBounds.height) - 2)
  const maxY = Math.max(0, 2 - scene.walkBounds.y)
  return { x: clamp(desired.x, minX, maxX), y: clamp(desired.y, minY, maxY) }
}

export function advanceMainlineCamera(current: Point, target: Point, elapsedMs: number): Point {
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / 140)
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
}
