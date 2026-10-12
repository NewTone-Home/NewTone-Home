import { mainlineRidePickupPositions } from './mainlineRide'
import type { MainlineSceneId } from './mainlineScenes'

export type PhoneRideMapPickupMarker = { id: string; position: readonly [number, number] }

/** Show a car at each authored Ride pickup exit only while the player is in that pickup scene. */
export function phoneRideMapPickupMarkers(sceneId: MainlineSceneId, pickupSceneId: MainlineSceneId): PhoneRideMapPickupMarker[] {
  if (sceneId !== pickupSceneId) return []
  return mainlineRidePickupPositions(sceneId).map((point, index) => ({
    id: 'pickup-exit-' + (index + 1),
    position: [point.x, point.y] as const,
  }))
}
