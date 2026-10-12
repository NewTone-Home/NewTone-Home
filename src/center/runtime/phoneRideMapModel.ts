import { mainlineScenePassageDoorway, type MainlineSceneDefinition, type MainlineSceneId } from './mainlineScenes'
import type { CollisionBox } from './sceneGeometry'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'

export type RideMapTargetZone = { id: string; bounds: CollisionBox; fillBounds: CollisionBox; fadeTowardTarget?: boolean }

export type RideMapGradient = { x1: number; y1: number; x2: number; y2: number }

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

function fillBoundsForTarget(scene: MainlineSceneDefinition, target: CollisionBox, fallback: CollisionBox): CollisionBox {
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
      return [{ ...bounds, fillBounds: fillBoundsForTarget(scene, bounds.bounds, bounds.bounds), fadeTowardTarget: true }]
    }) : []
  }

  const passage = scene.passages.find((item) => item.targetSceneId === pickupSceneId)
  if (!passage) return []
  const doorway = snapshot?.passages.get(passage.id)?.doorway ?? mainlineScenePassageDoorway(scene, passage.id)
  return doorway ? [{ id: 'pickup-' + passage.id, bounds: doorway, fillBounds: fillBoundsForTarget(scene, doorway, walkBounds) }] : []
}
