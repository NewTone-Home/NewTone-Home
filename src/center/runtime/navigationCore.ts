import { defaultEdgeContactDirection, type CollisionBox, type Point } from './sceneGeometry'
import { createPolygonNavigationMesh } from './scenePathfinding'
import { sharedFurnitureGeometry } from './twoSeatFurniture'

/**
 * Every playable scene supplies geometry and policy through this adapter.
 * Route search itself must stay here so café, mainline, and future scenes
 * cannot grow separate pathfinding implementations.
 */
export type UnifiedNavigationAdapter = {
  bounds: CollisionBox
  obstacles: readonly CollisionBox[]
  /** Dynamic actor reservations come from the same navigation runtime. */
  dynamicObstacles?: readonly CollisionBox[]
  obstacleClearance?: number
  canTravel?: (start: Point, end: Point) => boolean
}

export function findNavigationPath(start: Point, destination: Point, adapter: UnifiedNavigationAdapter): Point[] | null {
  const mesh = createPolygonNavigationMesh({
    ...adapter,
    obstacles: [...adapter.obstacles, ...(adapter.dynamicObstacles ?? [])],
  })
  const path = mesh.findPath(start, destination)
  if (!path || !adapter.canTravel) return path

  // The mesh owns static geometry. The movement adapter remains the final
  // shared occupancy check so a dynamic actor or a lifecycle-owned door can
  // invalidate a segment without changing the click target.
  for (let index = 1; index < path.length; index += 1) {
    if (!adapter.canTravel(path[index - 1]!, path[index]!)) return null
  }
  return path
}

export function canTravelAlongSegment(
  start: Point,
  target: Point,
  canOccupy: (point: Point) => boolean,
  maxStep = .35,
) {
  const distance = Math.hypot(target.x - start.x, target.y - start.y)
  const steps = Math.max(1, Math.ceil(distance / maxStep))
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps
    const point = {
      x: start.x + (target.x - start.x) * progress,
      y: start.y + (target.y - start.y) * progress,
    }
    if (!canOccupy(point)) return false
  }
  return true
}

/** Resolve the nearest clear point beside any rectangular scene object. */
export function edgeContactPoint(center: Point, collision: CollisionBox, from: Point, actorRadius = sharedFurnitureGeometry.playerRadius): Point {
  const dx = from.x - center.x
  const dy = from.y - center.y
  const length = Math.hypot(dx, dy)
  const direction = length > .001 ? { x: dx / length, y: dy / length } : defaultEdgeContactDirection
  const halfWidth = collision.width / 2
  const halfHeight = collision.height / 2
  const distanceToEdge = Math.min(
    Math.abs(direction.x) > .001 ? halfWidth / Math.abs(direction.x) : Infinity,
    Math.abs(direction.y) > .001 ? halfHeight / Math.abs(direction.y) : Infinity,
  )
  const clearance = actorRadius + (collision.padding ?? 0) + sharedFurnitureGeometry.actorContactGap
  const hitsVerticalEdge = Math.abs(direction.x) > .001
    && halfWidth / Math.abs(direction.x) <= halfHeight / Math.max(Math.abs(direction.y), .001)

  if (hitsVerticalEdge) {
    return {
      x: center.x + Math.sign(direction.x) * (halfWidth + clearance),
      y: center.y + direction.y * distanceToEdge,
    }
  }

  return {
    x: center.x + direction.x * distanceToEdge,
    y: center.y + Math.sign(direction.y) * (halfHeight + clearance),
  }
}

export type NavigationActorSnapshot = {
  actorId: string
  position: Point
  radius: number
  visible: boolean
}

export type NavigationRuntime = {
  registerActor: (actorId: string, position: Point, radius?: number, visible?: boolean) => void
  updateActor: (actorId: string, position: Point, visible?: boolean) => void
  removeActor: (actorId: string) => void
  getActor: (actorId: string) => NavigationActorSnapshot | undefined
  getActors: () => readonly NavigationActorSnapshot[]
  /** Collision footprints of every other visible actor for one route query. */
  dynamicObstaclesFor: (actorId?: string) => readonly CollisionBox[]
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

/**
 * Shared multi-actor navigation registry. NPCs and the protagonist keep
 * independent intents and positions, but route queries consume one dynamic
 * occupancy source. Doors remain a separate lifecycle consumer of the same
 * actor ids, so two actors cannot create competing door state machines.
 */
export function createNavigationRuntime(): NavigationRuntime {
  const actors = new Map<string, NavigationActorSnapshot>()

  return {
    registerActor: (actorId, position, radius = sharedFurnitureGeometry.playerRadius, visible = true) => {
      actors.set(actorId, { actorId, position: copyPoint(position), radius, visible })
    },
    updateActor: (actorId, position, visible = true) => {
      const previous = actors.get(actorId)
      actors.set(actorId, {
        actorId,
        position: copyPoint(position),
        radius: previous?.radius ?? sharedFurnitureGeometry.playerRadius,
        visible,
      })
    },
    removeActor: (actorId) => { actors.delete(actorId) },
    getActor: (actorId) => {
      const actor = actors.get(actorId)
      return actor ? { ...actor, position: copyPoint(actor.position) } : undefined
    },
    getActors: () => [...actors.values()].map((actor) => ({ ...actor, position: copyPoint(actor.position) })),
    dynamicObstaclesFor: (actorId) => [...actors.values()]
      .filter((actor) => actor.visible && actor.actorId !== actorId)
      .map((actor) => ({
        x: actor.position.x - actor.radius,
        y: actor.position.y - actor.radius,
        width: actor.radius * 2,
        height: actor.radius * 2,
      })),
  }
}
