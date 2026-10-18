import type { CollisionBox, Point } from './sceneGeometry'

/** A render-only slice of a continuous scene. It never owns gameplay state. */
export type MainlineSceneDisplayRegion = {
  id: string
  bounds: CollisionBox
  /** Geometry owner ids visible while this region is active. Shared boundaries may be listed by both adjacent regions. */
  visibleGeometryGroupIds: readonly string[]
  cameraAnchor: Point
  passageLinks: readonly {
    passageId: string
    targetRegionId: string
  }[]
}

export type MainlineDisplayCrossingEvent = {
  /** True only after the existing passage lifecycle confirms a threshold crossing. */
  crossed: boolean
}

export function mainlineDisplayRegionContains(region: MainlineSceneDisplayRegion, position: Point) {
  return position.x >= region.bounds.x
    && position.x <= region.bounds.x + region.bounds.width
    && position.y >= region.bounds.y
    && position.y <= region.bounds.y + region.bounds.height
}

export function mainlineDisplayRegionShowsGeometry(region: MainlineSceneDisplayRegion, geometryOwnerId: string) {
  return region.visibleGeometryGroupIds.includes(geometryOwnerId)
}

/** Resolve a region from the live world position, retaining the previous region on boundary ambiguity. */
export function resolveMainlineDisplayRegion(
  regions: readonly MainlineSceneDisplayRegion[],
  worldPosition: Point,
  currentRegionId?: string | null,
) {
  const current = regions.find(region => region.id === currentRegionId)
  if (current && mainlineDisplayRegionContains(current, worldPosition)) return current
  return regions.find(region => mainlineDisplayRegionContains(region, worldPosition)) ?? current ?? null
}

/** Switch render region only after the existing passage code reports a real crossing. */
export function resolveMainlineDisplayTransition(
  regions: readonly MainlineSceneDisplayRegion[],
  currentRegionId: string,
  passageId: string,
  crossingEvent: MainlineDisplayCrossingEvent,
) {
  if (!crossingEvent.crossed) return regions.find(region => region.id === currentRegionId) ?? null
  const current = regions.find(region => region.id === currentRegionId)
  const link = current?.passageLinks.find(candidate => candidate.passageId === passageId)
  return link ? regions.find(region => region.id === link.targetRegionId) ?? current ?? null : current ?? null
}
