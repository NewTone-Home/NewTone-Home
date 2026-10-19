import type { MainlineSceneGeometryUnit } from './mainlineScenes'
import type { Point } from './sceneGeometry'

/**
 * Storefront shell geometry belongs to the continuous commercial-street
 * world. It remains mounted while the player crosses room boundaries; room
 * ownership controls room contents, not the building shell.
 */
export function mainlineGeometryUnitShouldRender(
  sceneId: string,
  unit: MainlineSceneGeometryUnit,
  activeRoomId: string | undefined,
  layoutMode: boolean,
) {
  if (layoutMode) return true
  const shellRoomId = unit.sourceWallId?.endsWith('-shell')
    ? unit.sourceWallId.slice(0, -'-shell'.length)
    : undefined
  if (!shellRoomId) return true
  if (sceneId === 'commercial-street') return true
  return shellRoomId === activeRoomId
}

/** Cull only shell glyphs outside the translated viewport, with small text overdraw. */
export function mainlineGeometryCellWithinViewport(
  cell: { x: number; y: number },
  cameraOffset: Point,
  overscan = 5,
) {
  const viewportX = cell.x + cameraOffset.x
  const viewportY = cell.y + cameraOffset.y
  return viewportX >= -overscan && viewportX <= 100 + overscan
    && viewportY >= -overscan && viewportY <= 100 + overscan
}
