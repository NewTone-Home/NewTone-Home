import { mainlineScenePassageDoorway, type MainlineSceneDefinition, type MainlineSceneId } from './mainlineScenes'
import type { CollisionBox } from './sceneGeometry'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'

export type RideMapTargetZone = { id: string; bounds: CollisionBox; fillBounds: CollisionBox; fadeTowardTarget?: boolean }

export type RideMapGradient = { x1: number; y1: number; x2: number; y2: number }

const LOCAL_EXIT_FILL_DEPTH = 10
const LOCAL_EXIT_FILL_WIDTH = 10

/** Fade the pickup highlight toward its real exit, keeping the interior strongest. */
export function phoneRideMapTargetGradient(target: CollisionBox, floor: CollisionBox): RideMapGradient {
  const targetX = target.x + target.width / 2
  const targetY = target.y + target.height / 2
  const centerX = floor.x + floor.width / 2
  const centerY = floor.y + floor.height / 2
  const dx = targetX - centerX
  const dy = targetY - centerY
  const scaleX = Math.abs(dx) > 1e-6 ? floor.width / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY
  const scaleY = Math.abs(dy) > 1e-6 ? floor.height / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY
  const scale = Math.min(scaleX, scaleY)

  if (!Number.isFinite(scale)) {
    return { x1: centerX - floor.width / 2, y1: centerY, x2: centerX + floor.width / 2, y2: centerY }
  }

  return { x1: centerX - dx * scale, y1: centerY - dy * scale, x2: targetX, y2: targetY }
}

function groundBoundsAtTarget(scene: MainlineSceneDefinition, target: CollisionBox, fallback: CollisionBox): CollisionBox {
  const targetGround = [
    ...scene.rooms.filter((room) => room.kind !== 'boundary').map((room) => room.bounds),
    ...scene.structures.filter((structure) => structure.type === 'lane' && structure.bounds).map((structure) => structure.bounds!),
  ]
  const overlaps = targetGround
    .map((bounds) => ({ bounds, area: Math.max(0, Math.min(target.x + target.width, bounds.x + bounds.width) - Math.max(target.x, bounds.x)) * Math.max(0, Math.min(target.y + target.height, bounds.y + bounds.height) - Math.max(target.y, bounds.y)) }))
    .filter((room) => room.area > 0)
    .sort((a, b) => a.area - b.area)
  return overlaps[0]?.bounds ?? fallback
}

function intersectBounds(a: CollisionBox, b: CollisionBox): CollisionBox | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

function localExitFillBounds(target: CollisionBox, ground: CollisionBox, axis: 'x' | 'y', outwardDirection: -1 | 1): CollisionBox | null {
  const targetX = target.x + target.width / 2
  const targetY = target.y + target.height / 2
  const tangentHalf = LOCAL_EXIT_FILL_WIDTH / 2
  const insideDirection = outwardDirection * -1
  const raw = axis === 'x'
    ? {
        x: insideDirection > 0 ? targetX : targetX - LOCAL_EXIT_FILL_DEPTH,
        y: targetY - tangentHalf,
        width: LOCAL_EXIT_FILL_DEPTH,
        height: LOCAL_EXIT_FILL_WIDTH,
      }
    : {
        x: targetX - tangentHalf,
        y: insideDirection > 0 ? targetY : targetY - LOCAL_EXIT_FILL_DEPTH,
        width: LOCAL_EXIT_FILL_WIDTH,
        height: LOCAL_EXIT_FILL_DEPTH,
      }
  return intersectBounds(raw, ground)
}

/** Build presentation regions from the same real exit span or authored portal doorway used by navigation. */
export function phoneRideMapTargetZones(
  scene: MainlineSceneDefinition,
  sceneId: MainlineSceneId,
  pickupSceneId: MainlineSceneId,
  walkBounds: CollisionBox = scene.walkBounds,
  snapshot?: MainlineSceneGeometrySnapshot,
): RideMapTargetZone[] {
  if (sceneId === pickupSceneId) {
    // Every authored external exit is a valid Ride pickup in the current Ride
    // contract. Show a small floor patch at each one, not a whole corridor.
    return scene.externalExits.flatMap((exit) => {
      const boundary = exit.triggerEntityId
        ? scene.geometry.find((unit) => unit.geometryKind === 'boundary' && unit.entityId === exit.triggerEntityId)
        : undefined
      const tangentStart = exit.triggerSpan?.start ?? (exit.axis === 'x' ? boundary?.y ?? walkBounds.y : boundary?.x ?? walkBounds.x)
      const tangentEnd = exit.triggerSpan?.end ?? (
        exit.axis === 'x' && boundary ? boundary.y + boundary.height
          : exit.axis === 'y' && boundary ? boundary.x + boundary.width
            : exit.axis === 'x' ? walkBounds.y + walkBounds.height : walkBounds.x + walkBounds.width
      )
      if (tangentEnd <= tangentStart) return []
      const targetPoint = exit.axis === 'x'
        ? { x: exit.threshold, y: (tangentStart + tangentEnd) / 2 }
        : { x: (tangentStart + tangentEnd) / 2, y: exit.threshold }
      const bounds = {
        id: 'pickup-' + (exit.id ?? 'exit'),
        bounds: { x: targetPoint.x - 1, y: targetPoint.y - 1, width: 2, height: 2 },
      }
      const ground = groundBoundsAtTarget(scene, bounds.bounds, walkBounds)
      const fillBounds = localExitFillBounds(bounds.bounds, ground, exit.axis, exit.direction)
      return fillBounds ? [{ ...bounds, fillBounds, fadeTowardTarget: true }] : []
    })
  }

  const passage = scene.passages.find((item) => item.targetSceneId === pickupSceneId)
  if (!passage) return []
  const doorway = snapshot?.passages.get(passage.id)?.doorway ?? mainlineScenePassageDoorway(scene, passage.id)
  if (!doorway) return []
  const axis = doorway.width <= doorway.height ? 'x' : 'y'
  const groundCenter = axis === 'x' ? walkBounds.x + walkBounds.width / 2 : walkBounds.y + walkBounds.height / 2
  const targetCenter = axis === 'x' ? doorway.x + doorway.width / 2 : doorway.y + doorway.height / 2
  const outwardDirection = (targetCenter < groundCenter ? -1 : 1) as -1 | 1
  const fillBounds = localExitFillBounds(doorway, walkBounds, axis, outwardDirection)
  return fillBounds ? [{ id: 'pickup-' + passage.id, bounds: doorway, fillBounds, fadeTowardTarget: true }] : []
}
