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
