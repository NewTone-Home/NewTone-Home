import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

const normalizedViewportCenter = 50
const noCameraTranslation = 0
const portraitViewportMaximumWidth = 600
const portraitScaleDefault = 0.8
const portraitScaleMinimum = 0.65
const portraitScaleAtWidth = 487.5

export type MainlineCameraProjection = { offset: Point; scale: number; worldSize: SceneScreenMetrics }

function isPortraitViewport(viewport: SceneScreenMetrics, embedded = false) {
  return !embedded && viewport.width <= portraitViewportMaximumWidth && viewport.height > viewport.width
}

/** Geometry keeps the desktop design basis while the portrait viewport measures its own camera window. */
export function mainlineWorldDesignMetrics(viewport: SceneScreenMetrics, embedded = false): SceneScreenMetrics {
  return isPortraitViewport(viewport, embedded) ? defaultSceneScreenMetrics : viewport
}

/** Fit a 16:9 virtual canvas to viewport height so portrait only crops its sides. */
export function mainlineWorldPixelSize(viewport: SceneScreenMetrics, embedded = false): SceneScreenMetrics {
  if (!isPortraitViewport(viewport, embedded)) return viewport
  const scale = viewport.height / defaultSceneScreenMetrics.height
  return {
    width: defaultSceneScreenMetrics.width * scale,
    height: defaultSceneScreenMetrics.height * scale,
  }
}

/** Narrow phones can pull back slightly farther, while 390px phones retain the 0.8 default. */
export function mainlinePortraitCameraScale(viewport: SceneScreenMetrics, embedded = false): number {
  if (!isPortraitViewport(viewport, embedded)) return 1
  return clamp(viewport.width / portraitScaleAtWidth, portraitScaleMinimum, portraitScaleDefault)
}

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

function followPlayerCameraOffset(scene: Pick<MainlineSceneDefinition, 'walkBounds'>, position: Point, scale = 1): Point {
  const followAnchor = normalizedViewportCenter
  const cameraEdgePadding = 2
  const minX = Math.min(0, 100 - (scene.walkBounds.x + scene.walkBounds.width) * scale - cameraEdgePadding)
  const minY = Math.min(0, 100 - (scene.walkBounds.y + scene.walkBounds.height) * scale - cameraEdgePadding)
  return {
    x: clamp(followAnchor - position.x * scale, minX, 0),
    y: clamp(followAnchor - position.y * scale, minY, 0),
  }
}

function followPlayerVirtualCanvasOffset(
  scene: Pick<MainlineSceneDefinition, 'walkBounds'>,
  position: Point,
  viewport: SceneScreenMetrics,
  worldSize: SceneScreenMetrics,
  scale: number,
): Point {
  const visibleWidthPercent = (viewport.width / worldSize.width) * 100
  const visibleHeightPercent = (viewport.height / worldSize.height) * 100
  const cameraEdgePadding = 2
  const horizontalPadding = visibleWidthPercent * cameraEdgePadding / 100
  const verticalPadding = visibleHeightPercent * cameraEdgePadding / 100
  const minX = visibleWidthPercent - (scene.walkBounds.x + scene.walkBounds.width) * scale - horizontalPadding
  const maxX = -scene.walkBounds.x * scale + horizontalPadding
  const minY = visibleHeightPercent - (scene.walkBounds.y + scene.walkBounds.height) * scale - verticalPadding
  const maxY = -scene.walkBounds.y * scale + verticalPadding
  const x = minX > maxX
    ? visibleWidthPercent / 2 - (scene.walkBounds.x + scene.walkBounds.width / 2) * scale
    : clamp(visibleWidthPercent / 2 - position.x * scale, minX, maxX)
  const y = minY > maxY
    ? visibleHeightPercent / 2 - (scene.walkBounds.y + scene.walkBounds.height / 2) * scale
    : clamp(visibleHeightPercent / 2 - position.y * scale, minY, maxY)
  return {
    x,
    y,
  }
}

/** Use a small, scene-specific portrait zoom while leaving landscape and embedded scenes unchanged. */
export function mainlineCameraProjection(
  scene: Pick<MainlineSceneDefinition, 'id' | 'viewport' | 'walkBounds'>,
  position: Point,
  viewport: { width: number; height: number },
  embedded = false,
): MainlineCameraProjection {
  const worldSize = mainlineWorldPixelSize(viewport, embedded)
  if (embedded) return { offset: { x: noCameraTranslation, y: noCameraTranslation }, scale: 1, worldSize }

  const portrait = isPortraitViewport(viewport, embedded)
  const scale = mainlinePortraitCameraScale(viewport, embedded)
  const followPlayer = portrait || scene.viewport !== 'fixed-frame'
  const offset = portrait
    ? followPlayerVirtualCanvasOffset(scene, position, viewport, worldSize, scale)
    : followPlayer
    ? followPlayerCameraOffset(scene, position, scale)
    : fixedFrameCameraOffset(scene)

  return { offset, scale, worldSize }
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
