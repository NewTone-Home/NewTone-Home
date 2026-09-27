import type { MainlineRegionAccess } from './mainlineSceneModel'

/** Shared geometric primitives used by every playable scene. */
export type Point = { x: number; y: number }

export function createPoint(x: number, y: number): Point {
  return { x, y }
}

/** Shared fallback direction for edge-contact resolution when centers overlap. */
export const defaultEdgeContactDirection = createPoint(-1, 0)

/** Shared physical thickness used when a floor entity is attached to a wall. */
export const mainlineWallThickness = 1.4

export type CollisionBox = {
  x: number
  y: number
  width: number
  height: number
  padding?: number
}

/** A route-crossing restriction with no occupied area. */
export type NavigationBarrierSegment = {
  id: string
  start: Point
  end: Point
  /** Relation barriers apply to every actor; access boundaries are filtered by actor access. */
  kind?: 'relation' | 'access-boundary'
  regionId?: string
  requiredAccess?: MainlineRegionAccess
}
