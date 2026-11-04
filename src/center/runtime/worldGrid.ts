import type { CollisionBox, Point } from './sceneGeometry'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'

/** One authored lattice; its cell edges may be half-integer coordinates. */
export function createWorldGrid(origin: Point, pitchPx = 28) {
  const step = { x: pitchPx / sceneDesignReferenceMetrics.width * 100, y: pitchPx / sceneDesignReferenceMetrics.height * 100 }
  const point = (column: number, row: number): Point => ({ x: origin.x + column * step.x, y: origin.y + row * step.y })
  const box = (column: number, row: number, width: number, height: number): CollisionBox => ({ ...point(column,row), width: width*step.x, height: height*step.y })
  return { origin, pitchPx, step, point, box }
}

/** Preserve local proportions without scaling an entity's own dimensions. */
export function mapPointBetweenRegions(point: Point, before: CollisionBox, after: CollisionBox): Point {
  return { x: after.x+(point.x-before.x)/before.width*after.width, y: after.y+(point.y-before.y)/before.height*after.height }
}
