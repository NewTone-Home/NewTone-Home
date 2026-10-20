import type { MainlineSceneDefinition, MainlineStorefrontSlot } from './mainlineScenes'
import type { Point } from './sceneGeometry'

/** A same-world storefront connects an authored public corridor to a room.
 * Legacy cross-scene portals have no such pair and keep their old policy. */
export function storefrontRoomConnection(scene: MainlineSceneDefinition, storefront: MainlineStorefrontSlot) {
  const passage = scene.passages.find(candidate => candidate.portalId === storefront.portalId
    && candidate.fromRoomId && candidate.toRoomId && candidate.routeThrough && !candidate.targetSceneId)
  if (!passage) return null
  const publicRoom = scene.rooms.find(room => room.id === passage.fromRoomId && room.kind === 'corridor')
  const interiorRoom = scene.rooms.find(room => room.id === passage.toRoomId)
  return publicRoom && interiorRoom && publicRoom.id !== interiorRoom.id ? { passage, publicRoom, interiorRoom } : null
}

export function pointInStorefrontRoom(point: Point, room: { bounds: { x: number; y: number; width: number; height: number } }) {
  return point.x >= room.bounds.x && point.x <= room.bounds.x + room.bounds.width
    && point.y >= room.bounds.y && point.y <= room.bounds.y + room.bounds.height
}
