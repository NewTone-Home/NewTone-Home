import { mainlineScenePassageDoorway, type MainlineSceneDefinition, type MainlineSceneId } from './mainlineScenes'
import type { CollisionBox } from './sceneGeometry'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'

type RideMapTargetZone = { id: string; bounds: CollisionBox }

/** Build presentation regions from the same real exit span or authored portal doorway used by navigation. */
export function phoneRideMapTargetZones(
  scene: MainlineSceneDefinition,
  sceneId: MainlineSceneId,
  pickupSceneId: MainlineSceneId,
  walkBounds: CollisionBox = scene.walkBounds,
  snapshot?: MainlineSceneGeometrySnapshot,
): RideMapTargetZone[] {
  if (sceneId === pickupSceneId) {
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
      return [exit.axis === 'x'
        ? { id: 'pickup-' + (exit.id ?? 'exit'), bounds: { x: exit.threshold - 1, y: tangentStart, width: 2, height: tangentEnd - tangentStart } }
        : { id: 'pickup-' + (exit.id ?? 'exit'), bounds: { x: tangentStart, y: exit.threshold - 1, width: tangentEnd - tangentStart, height: 2 } }]
    })
  }

  const passage = scene.passages.find((item) => item.targetSceneId === pickupSceneId)
  if (!passage) return []
  const doorway = snapshot?.passages.get(passage.id)?.doorway ?? mainlineScenePassageDoorway(scene, passage.id)
  return doorway ? [{ id: 'pickup-' + passage.id, bounds: doorway }] : []
}
