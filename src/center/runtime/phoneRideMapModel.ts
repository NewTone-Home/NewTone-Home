import { mainlineScenePassageDoorway, type MainlineSceneDefinition, type MainlineSceneId } from './mainlineScenes'
import type { CollisionBox } from './sceneGeometry'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'

export type RideMapTargetZone = { id: string; bounds: CollisionBox; fillBounds: CollisionBox }

function fillBoundsForTarget(scene: MainlineSceneDefinition, target: CollisionBox, fallback: CollisionBox): CollisionBox {
  const overlaps = scene.rooms
    .filter((room) => room.kind !== 'boundary')
    .map((room) => ({ bounds: room.bounds, area: Math.max(0, Math.min(target.x + target.width, room.bounds.x + room.bounds.width) - Math.max(target.x, room.bounds.x)) * Math.max(0, Math.min(target.y + target.height, room.bounds.y + room.bounds.height) - Math.max(target.y, room.bounds.y)) }))
    .filter((room) => room.area > 0)
    .sort((a, b) => a.area - b.area)
  return overlaps[0]?.bounds ?? fallback
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
    // Ride navigation resolves one pickup point: the first authored exit.
    // Keep the map target aligned with that contract instead of highlighting
    // every unrelated world exit in the same scene.
    const pickupExit = scene.externalExits[0]
    return pickupExit ? [pickupExit].flatMap((exit) => {
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
      const bounds = exit.axis === 'x'
        ? { id: 'pickup-' + (exit.id ?? 'exit'), bounds: { x: exit.threshold - 1, y: tangentStart, width: 2, height: tangentEnd - tangentStart } }
        : { id: 'pickup-' + (exit.id ?? 'exit'), bounds: { x: tangentStart, y: exit.threshold - 1, width: tangentEnd - tangentStart, height: 2 } }
      return [{ ...bounds, fillBounds: fillBoundsForTarget(scene, bounds.bounds, bounds.bounds) }]
    }) : []
  }

  const passage = scene.passages.find((item) => item.targetSceneId === pickupSceneId)
  if (!passage) return []
  const doorway = snapshot?.passages.get(passage.id)?.doorway ?? mainlineScenePassageDoorway(scene, passage.id)
  return doorway ? [{ id: 'pickup-' + passage.id, bounds: doorway, fillBounds: fillBoundsForTarget(scene, doorway, walkBounds) }] : []
}
