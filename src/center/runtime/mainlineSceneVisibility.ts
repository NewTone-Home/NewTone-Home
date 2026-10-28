import type { MainlineSceneGeometryUnit } from './mainlineScenes'
import type { Point } from './sceneGeometry'
import type { MainlineSceneEntity } from './mainlineSceneModel'
import { projectCommercialStreetX } from './commercialStreetGridProjection'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineVisibleWorldSpan } from './mainlineViewport'

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
  return true
}

/** Door glyphs with an authored space owner appear only from that space. */
export function mainlineDoorPortalShouldRender(
  entity: Pick<MainlineSceneEntity, 'spaceId'> | undefined,
  activeSpaceId: string | undefined,
) {
  return !entity?.spaceId || entity.spaceId === activeSpaceId
}

/** Cull only shell glyphs outside the translated viewport, with small text overdraw. */
export function mainlineGeometryCellWithinViewport(
  cell: { x: number; y: number },
  cameraOffset: Point,
  overscan = 5,
  sceneId?: string,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
  viewportMetrics: SceneScreenMetrics = screenMetrics,
  visibleWorldSpan = mainlineVisibleWorldSpan(viewportMetrics),
) {
  const worldX = sceneId === 'commercial-street' ? projectCommercialStreetX(cell.x, screenMetrics) : cell.x
  const viewportX = 50 + (worldX + cameraOffset.x - 50) / visibleWorldSpan.x * 100
  const viewportY = 50 + (cell.y + cameraOffset.y - 50) / visibleWorldSpan.y * 100
  return viewportX >= -overscan && viewportX <= 100 + overscan
    && viewportY >= -overscan && viewportY <= 100 + overscan
}
