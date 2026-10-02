import { defaultEdgeContactDirection, type CollisionBox, type NavigationBarrierSegment, type Point } from './sceneGeometry'
import { createPolygonNavigationMesh, type PolygonNavigationMesh, type PolygonNavigationResolution } from './scenePathfinding'
import { sharedFurnitureGeometry } from './twoSeatFurniture'

/**
 * Route preparation, planner validation, and live movement must inspect the
 * same maximum travel increment. A coarser planner sample can approve a
 * shortcut that live locomotion later rejects between samples.
 */
export const sharedNavigationTraversalStep = .18

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
  /** Non-occupying route-crossing restrictions from the shared scene snapshot. */
  barriers?: readonly NavigationBarrierSegment[]
  /** The same rectangular footprint used by route planning and travel checks. */
  actorFootprint?: NavigationActorFootprint
  /** A scene-owned static mesh may be reused across contact candidates. */
  navigationMesh?: PolygonNavigationMesh
  canTravel?: (start: Point, end: Point) => boolean
}

export function findNavigationPath(start: Point, destination: Point, adapter: UnifiedNavigationAdapter): Point[] | null {
  const mesh = adapter.navigationMesh ?? createPolygonNavigationMesh({
    ...adapter,
    obstacles: [...adapter.obstacles, ...(adapter.dynamicObstacles ?? [])],
    obstacleInset: adapter.actorFootprint ? { x: adapter.actorFootprint.width / 2, y: adapter.actorFootprint.height / 2 } : undefined,
    actorFootprint: adapter.actorFootprint,
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

/**
 * One shared static-world target resolution. Callers may apply live dynamic
 * occupancy through canTravel afterwards, but it must not change the raw
 * requested target or select a different permanent destination.
 */
export function resolveNavigationPath(
  start: Point,
  requestedTarget: Point,
  adapter: UnifiedNavigationAdapter,
): PolygonNavigationResolution | null {
  const mesh = adapter.navigationMesh ?? createPolygonNavigationMesh({
    ...adapter,
    obstacles: adapter.obstacles,
    obstacleInset: adapter.actorFootprint ? { x: adapter.actorFootprint.width / 2, y: adapter.actorFootprint.height / 2 } : undefined,
    actorFootprint: adapter.actorFootprint,
  })
  const resolution = mesh.resolvePath(start, requestedTarget)
  if (!resolution || !adapter.canTravel) return resolution
  for (let index = 1; index < resolution.path.length; index += 1) {
    if (!adapter.canTravel(resolution.path[index - 1]!, resolution.path[index]!)) return null
  }
  return resolution
}

export type NavigationActorFootprint = {
  width: number
  height: number
}

export function navigationActorBox(position: Point, footprint: NavigationActorFootprint): CollisionBox {
  return {
    x: position.x - footprint.width / 2,
    y: position.y - footprint.height / 2,
    width: footprint.width,
    height: footprint.height,
  }
}

export function canTravelAlongSegment(
  start: Point,
  target: Point,
  canOccupy: (point: Point) => boolean,
  maxStep = sharedNavigationTraversalStep,
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
export function edgeContactPoint(center: Point, collision: CollisionBox, from: Point, actorFootprint: NavigationActorFootprint): Point {
  const dx = from.x - center.x
  const dy = from.y - center.y
  const length = Math.hypot(dx, dy)
  const direction = length > .001 ? { x: dx / length, y: dy / length } : defaultEdgeContactDirection
  const halfWidth = collision.width / 2 + actorFootprint.width / 2 + sharedFurnitureGeometry.actorContactGap
  const halfHeight = collision.height / 2 + actorFootprint.height / 2 + sharedFurnitureGeometry.actorContactGap
  const distanceToEdge = Math.min(
    Math.abs(direction.x) > .001 ? halfWidth / Math.abs(direction.x) : Infinity,
    Math.abs(direction.y) > .001 ? halfHeight / Math.abs(direction.y) : Infinity,
  )
  const hitsVerticalEdge = Math.abs(direction.x) > .001
    && halfWidth / Math.abs(direction.x) <= halfHeight / Math.max(Math.abs(direction.y), .001)

  if (hitsVerticalEdge) {
    return {
      x: center.x + Math.sign(direction.x) * (halfWidth + (collision.padding ?? 0)),
      y: center.y + direction.y * distanceToEdge,
    }
  }

  return {
    x: center.x + direction.x * distanceToEdge,
    y: center.y + Math.sign(direction.y) * (halfHeight + (collision.padding ?? 0)),
  }
}

export type NavigationActorSnapshot = {
  actorId: string
  position: Point
  footprint: NavigationActorFootprint
  visible: boolean
}

export type NavigationRuntime = {
  registerActor: (actorId: string, position: Point, footprint: NavigationActorFootprint, visible?: boolean) => void
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
    registerActor: (actorId, position, footprint, visible = true) => {
      actors.set(actorId, { actorId, position: copyPoint(position), footprint: { ...footprint }, visible })
    },
    updateActor: (actorId, position, visible = true) => {
      const previous = actors.get(actorId)
      if (!previous) throw new Error(`Navigation actor ${actorId} must register a presentation footprint before updating`)
      actors.set(actorId, {
        actorId,
        position: copyPoint(position),
        footprint: previous.footprint,
        visible,
      })
    },
    removeActor: (actorId) => { actors.delete(actorId) },
    getActor: (actorId) => {
      const actor = actors.get(actorId)
      return actor ? { ...actor, position: copyPoint(actor.position), footprint: { ...actor.footprint } } : undefined
    },
    getActors: () => [...actors.values()].map((actor) => ({ ...actor, position: copyPoint(actor.position), footprint: { ...actor.footprint } })),
    dynamicObstaclesFor: (actorId) => [...actors.values()]
      .filter((actor) => actor.visible && actor.actorId !== actorId)
      .map((actor) => navigationActorBox(actor.position, actor.footprint)),
  }
}
