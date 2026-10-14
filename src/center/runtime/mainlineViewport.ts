import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'

export const MAINLINE_WORLD_SIZE = { width: 1280, height: 720 } as const
export const DEFAULT_MAINLINE_VIEWPORT_SIZE = { width: 1280, height: 720 } as const
export const mainlineCameraDeadzone = { start: 35, end: 65 } as const
export const mainlineCameraEdgePadding = 2
export type MainlineViewportScaleMode = 'current' | 'C' | 'D'

export type MainlineViewportSize = { width: number; height: number }

export type MainlineViewportProjection = {
  worldSize: typeof MAINLINE_WORLD_SIZE
  viewportSize: MainlineViewportSize
  scaleMode: MainlineViewportScaleMode
  scale: number
  /** Screen-pixel offset that centers the scaled logical canvas in the stage. */
  offset: Point
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function positive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * A continuous area/aspect projection. The portrait relief keeps a 390×844
 * viewport near the previously approved 0.8 zoom while allowing smaller
 * screens to ease toward the shared 0.65 floor. No device classes are used.
 */
export function mainlineViewportScale(size: MainlineViewportSize, mode: MainlineViewportScaleMode = 'current') {
  const width = positive(size.width, DEFAULT_MAINLINE_VIEWPORT_SIZE.width)
  const height = positive(size.height, DEFAULT_MAINLINE_VIEWPORT_SIZE.height)
  if (mode === 'C') return clamp(height / MAINLINE_WORLD_SIZE.height, .85, 1.5)
  if (mode === 'D') return clamp(Math.min(width / MAINLINE_WORLD_SIZE.width, height / MAINLINE_WORLD_SIZE.height), .85, 1.5)
  const areaScale = Math.sqrt((width / MAINLINE_WORLD_SIZE.width) * (height / MAINLINE_WORLD_SIZE.height))
  const aspect = width / height
  const portraitRelief = .275 * Math.max(0, 1 - aspect / (MAINLINE_WORLD_SIZE.width / MAINLINE_WORLD_SIZE.height))
  return clamp(areaScale + portraitRelief, .65, 1.5)
}

export function resolveMainlineViewportScaleMode(search: string): MainlineViewportScaleMode {
  const mode = new URLSearchParams(search).get('viewportScale')
  return mode === 'C' || mode === 'D' ? mode : 'current'
}

export function createMainlineViewportProjection(size: MainlineViewportSize, scaleMode: MainlineViewportScaleMode = 'current'): MainlineViewportProjection {
  const viewportSize = {
    width: positive(size.width, DEFAULT_MAINLINE_VIEWPORT_SIZE.width),
    height: positive(size.height, DEFAULT_MAINLINE_VIEWPORT_SIZE.height),
  }
  const scale = mainlineViewportScale(viewportSize, scaleMode)
  return {
    worldSize: MAINLINE_WORLD_SIZE,
    viewportSize,
    scaleMode,
    scale,
    offset: {
      x: (viewportSize.width - MAINLINE_WORLD_SIZE.width * scale) / 2,
      y: (viewportSize.height - MAINLINE_WORLD_SIZE.height * scale) / 2,
    },
  }
}

/** Project a 0–100 world point into stage-local screen pixels. */
export function projectMainlineWorldPoint(point: Point, cameraOffset: Point, projection: MainlineViewportProjection): Point {
  return {
    x: projection.offset.x + (point.x + cameraOffset.x) * projection.worldSize.width / 100 * projection.scale,
    y: projection.offset.y + (point.y + cameraOffset.y) * projection.worldSize.height / 100 * projection.scale,
  }
}

/** Invert the same projection for clicks, touch walks, and layout dragging. */
export function unprojectMainlineViewportPoint(point: Point, cameraOffset: Point, projection: MainlineViewportProjection): Point {
  return {
    x: ((point.x - projection.offset.x) / projection.scale) / projection.worldSize.width * 100 - cameraOffset.x,
    y: ((point.y - projection.offset.y) / projection.scale) / projection.worldSize.height * 100 - cameraOffset.y,
  }
}

/** Screen-percent projection used by the cross-scene actor handoff. */
export function projectMainlineWorldPointPercent(point: Point, cameraOffset: Point, projection: MainlineViewportProjection): Point {
  const projected = projectMainlineWorldPoint(point, cameraOffset, projection)
  return {
    x: projected.x / projection.viewportSize.width * 100,
    y: projected.y / projection.viewportSize.height * 100,
  }
}

/** One transform contract for every mainline world layer. */
export function mainlineWorldTransform(projection: MainlineViewportProjection, cameraOffset: Point) {
  const x = projection.offset.x + cameraOffset.x * projection.worldSize.width / 100 * projection.scale
  const y = projection.offset.y + cameraOffset.y * projection.worldSize.height / 100 * projection.scale
  return `translate3d(${Number(x.toFixed(4))}px, ${Number(y.toFixed(4))}px, 0) scale(${Number(projection.scale.toFixed(6))})`
}

function visibleWorldSpan(projection: MainlineViewportProjection, axis: 'x' | 'y') {
  const pixels = axis === 'x' ? projection.viewportSize.width : projection.viewportSize.height
  const worldPixels = axis === 'x' ? projection.worldSize.width : projection.worldSize.height
  return pixels / (projection.scale * worldPixels) * 100
}

function staticWorldOrigin(projection: MainlineViewportProjection, axis: 'x' | 'y') {
  const offset = axis === 'x' ? projection.offset.x : projection.offset.y
  const worldPixels = axis === 'x' ? projection.worldSize.width : projection.worldSize.height
  return -offset / (projection.scale * worldPixels) * 100
}

type CenterFrameAxes = boolean | { x: boolean; y: boolean }

function centerFrameOnAxis(centerFrame: CenterFrameAxes, axis: 'x' | 'y') {
  return typeof centerFrame === 'boolean' ? centerFrame : centerFrame[axis]
}

export function mainlineCameraFollowAxes(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'>,
  projection: MainlineViewportProjection,
) {
  return {
    x: scene.viewport === 'follow-player' || visibleWorldSpan(projection, 'x') < scene.walkBounds.width,
    y: scene.viewport === 'follow-player' || visibleWorldSpan(projection, 'y') < scene.walkBounds.height,
  }
}

function clampCameraOffset(scene: Pick<MainlineSceneDefinition, 'walkBounds'>, offset: Point, projection: MainlineViewportProjection, centerFrame: CenterFrameAxes = false, focusPosition?: Point): Point {
  const result = { ...offset }
  for (const axis of ['x', 'y'] as const) {
    const keepFrameCentered = centerFrameOnAxis(centerFrame, axis)
    const boundsStart = scene.walkBounds[axis]
    const boundsEnd = boundsStart + (axis === 'x' ? scene.walkBounds.width : scene.walkBounds.height)
    const span = visibleWorldSpan(projection, axis)
    if (span >= boundsEnd - boundsStart) {
      // A follow camera can shift either way when a smaller viewport crops
      // the logical canvas; at the authored 1280x720 frame it remains
      // left-anchored. A fixed-frame room keeps its centered pose.
      if (!keepFrameCentered) result[axis] = Math.min(result[axis], Math.max(0, staticWorldOrigin(projection, axis) - boundsStart + mainlineCameraEdgePadding))
      continue
    }
    const origin = staticWorldOrigin(projection, axis)
    const minimum = origin + span * mainlineCameraDeadzone.end / 100 - boundsEnd
    const maximum = keepFrameCentered
      ? origin - boundsStart + mainlineCameraEdgePadding
      : origin + span * mainlineCameraDeadzone.start / 100 - boundsStart
    result[axis] = clamp(result[axis], minimum, maximum)

    // Authored spawns can sit outside their walk-bounds. Keep the actor in
    // the deadzone even when that requires relaxing the normal map-edge clamp.
    if (focusPosition) {
      const screenPercent = (focusPosition[axis] + result[axis] - origin) / span * 100
      if (screenPercent < mainlineCameraDeadzone.start) result[axis] += (mainlineCameraDeadzone.start - screenPercent) * span / 100
      if (screenPercent > mainlineCameraDeadzone.end) result[axis] += (mainlineCameraDeadzone.end - screenPercent) * span / 100
    }
  }
  return result
}

/** Center a fixed-frame room as one visual unit in the shared logical world. */
export function fixedFrameCameraOffset(
  scene: Pick<MainlineSceneDefinition, 'walkBounds'>,
  projection = createMainlineViewportProjection(DEFAULT_MAINLINE_VIEWPORT_SIZE),
  focusPosition?: Point,
): Point {
  return clampCameraOffset(scene, {
    x: 50 - (scene.walkBounds.x + scene.walkBounds.width / 2),
    y: 50 - (scene.walkBounds.y + scene.walkBounds.height / 2),
  }, projection, true, focusPosition)
}

function followPlayerCameraOffset(
  scene: Pick<MainlineSceneDefinition, 'walkBounds'>,
  position: Point,
  projection: MainlineViewportProjection,
): Point {
  return clampCameraOffset(scene, { x: 50 - position.x, y: 50 - position.y }, projection, false, position)
}

/** The only camera-policy selector for every mainline scene. */
export function mainlineCameraOffset(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'>,
  position: Point,
  embedded = false,
  projection = createMainlineViewportProjection(DEFAULT_MAINLINE_VIEWPORT_SIZE),
): Point {
  if (embedded) return { x: 0, y: 0 }
  if (scene.viewport === 'follow-player') return followPlayerCameraOffset(scene, position, projection)
  const followAxes = mainlineCameraFollowAxes(scene, projection)
  if (!followAxes.x && !followAxes.y) return fixedFrameCameraOffset(scene, projection, position)
  return mainlineCameraTarget(scene, position, fixedFrameCameraOffset(scene, projection), false, projection)
}

/** Keep the actor in a 35–65% screen-space deadzone and clamp at world edges. */
export function mainlineCameraTarget(
  scene: Pick<MainlineSceneDefinition, 'viewport' | 'walkBounds'>,
  position: Point,
  current: Point,
  embedded = false,
  projection = createMainlineViewportProjection(DEFAULT_MAINLINE_VIEWPORT_SIZE),
): Point {
  if (embedded) return mainlineCameraOffset(scene, position, embedded, projection)
  const followAxes = mainlineCameraFollowAxes(scene, projection)
  if (scene.viewport === 'fixed-frame' && !followAxes.x && !followAxes.y) return fixedFrameCameraOffset(scene, projection, position)
  const desired = { ...current }
  for (const axis of ['x', 'y'] as const) {
    if (scene.viewport === 'fixed-frame' && !followAxes[axis]) {
      desired[axis] = axis === 'x'
        ? 50 - (scene.walkBounds.x + scene.walkBounds.width / 2)
        : 50 - (scene.walkBounds.y + scene.walkBounds.height / 2)
      continue
    }
    const screenPercent = 50 + (position[axis] + current[axis] - 50) / visibleWorldSpan(projection, axis) * 100
    const viewportPercentDelta = screenPercent < mainlineCameraDeadzone.start
      ? mainlineCameraDeadzone.start - screenPercent
      : screenPercent > mainlineCameraDeadzone.end
        ? mainlineCameraDeadzone.end - screenPercent
        : 0
    desired[axis] += viewportPercentDelta * visibleWorldSpan(projection, axis) / 100
  }
  return clampCameraOffset(scene, desired, projection, scene.viewport === 'fixed-frame'
    ? { x: !followAxes.x, y: !followAxes.y }
    : false, position)
}

export function advanceMainlineCamera(current: Point, target: Point, elapsedMs: number): Point {
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / 140)
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend }
}
