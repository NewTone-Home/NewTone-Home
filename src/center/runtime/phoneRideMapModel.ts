import { mainlineScenePassageDoorway, type MainlineSceneDefinition, type MainlineSceneId } from './mainlineScenes'
import type { CollisionBox } from './sceneGeometry'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'

export type RideMapTargetZone = { id: string; bounds: CollisionBox; fillBounds: CollisionBox; fadeTowardTarget?: boolean; fadeAxis?: 'x' | 'y'; inwardDirection?: -1 | 1 }

function groundBoundsAtTarget(scene: MainlineSceneDefinition, target: CollisionBox, fallback: CollisionBox): CollisionBox {
  const targetGround = [
    ...scene.structures.filter((structure) => structure.type === 'lane' && structure.bounds).map((structure) => ({ bounds: structure.bounds!, priority: 0 })),
    ...scene.rooms.filter((room) => room.kind !== 'boundary').map((room) => ({ bounds: room.bounds, priority: 1 })),
  ]
  const overlaps = targetGround
    .map(({ bounds, priority }) => ({ bounds, priority, area: Math.max(0, Math.min(target.x + target.width, bounds.x + bounds.width) - Math.max(target.x, bounds.x)) * Math.max(0, Math.min(target.y + target.height, bounds.y + bounds.height) - Math.max(target.y, bounds.y)) }))
    .filter((room) => room.area > 0)
    .sort((a, b) => a.area - b.area || a.priority - b.priority)
  return overlaps[0]?.bounds ?? fallback
}

function intersectBounds(a: CollisionBox, b: CollisionBox): CollisionBox | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

function localExitFillBounds(target: CollisionBox, ground: CollisionBox, axis: 'x' | 'y', outwardDirection: -1 | 1, tangentSpan: number): CollisionBox | null {
  const targetX = target.x + target.width / 2
  const targetY = target.y + target.height / 2
  const tangentHalf = tangentSpan / 2
  // Keep the highlight local: derive its depth from half the actual opening or
  // channel span, then clip it to the available in-scene ground.
  const depth = Math.min(tangentSpan / 2, axis === 'x' ? ground.width : ground.height)
  const insideDirection = outwardDirection * -1
  const raw = axis === 'x'
    ? {
        x: insideDirection > 0 ? targetX : targetX - depth,
        y: targetY - tangentHalf,
        width: depth,
        height: tangentSpan,
      }
    : {
        x: targetX - tangentHalf,
        y: insideDirection > 0 ? targetY : targetY - depth,
        width: tangentSpan,
        height: depth,
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
      const preliminaryTarget = { x: exit.axis === 'x' ? exit.threshold - 1 : walkBounds.x + walkBounds.width / 2 - 1, y: exit.axis === 'x' ? walkBounds.y + walkBounds.height / 2 - 1 : exit.threshold - 1, width: 2, height: 2 }
      const ground = groundBoundsAtTarget(scene, preliminaryTarget, walkBounds)
      const tangentStart = exit.triggerSpan?.start ?? (exit.axis === 'x' ? boundary?.y ?? ground.y : boundary?.x ?? ground.x)
      const tangentEnd = exit.triggerSpan?.end ?? (
        exit.axis === 'x' && boundary ? boundary.y + boundary.height
          : exit.axis === 'y' && boundary ? boundary.x + boundary.width
            : exit.axis === 'x' ? ground.y + ground.height : ground.x + ground.width
      )
      if (tangentEnd <= tangentStart) return []
      const targetPoint = exit.axis === 'x'
        ? { x: exit.threshold, y: (tangentStart + tangentEnd) / 2 }
        : { x: (tangentStart + tangentEnd) / 2, y: exit.threshold }
      const bounds = {
        id: 'pickup-' + (exit.id ?? 'exit'),
        bounds: { x: targetPoint.x - 1, y: targetPoint.y - 1, width: 2, height: 2 },
      }
      const tangentSpan = tangentEnd - tangentStart
      const fillBounds = localExitFillBounds(bounds.bounds, ground, exit.axis, exit.direction, tangentSpan)
      return fillBounds ? [{ ...bounds, fillBounds, fadeTowardTarget: true, fadeAxis: exit.axis, inwardDirection: exit.direction * -1 as -1 | 1 }] : []
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
  const tangentSpan = axis === 'x' ? doorway.height : doorway.width
  const ground = groundBoundsAtTarget(scene, doorway, walkBounds)
  const fillBounds = localExitFillBounds(doorway, ground, axis, outwardDirection, tangentSpan)
  return fillBounds ? [{ id: 'pickup-' + passage.id, bounds: doorway, fillBounds, fadeTowardTarget: true, fadeAxis: axis, inwardDirection: outwardDirection * -1 as -1 | 1 }] : []
}
