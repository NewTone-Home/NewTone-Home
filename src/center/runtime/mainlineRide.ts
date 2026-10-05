import { mainlineScenes, type MainlineSceneId } from './mainlineScenes'
import { canActorReachPassageApproach, findMainlinePath } from './mainlineNavigation'
import { createMainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { movementDurationMsForPath, protagonistCharacterMovementOptions } from './useFreeRoamMovement'
import type { Point } from './sceneGeometry'
import type { SceneLayout } from './sceneLayout'
import type { PlayerSceneState } from './playerSave'

export const mainlineRideZones: readonly { pickupSceneId: MainlineSceneId; scenes: readonly MainlineSceneId[] }[] = [
  { pickupSceneId: 'zhongshuyuan-office', scenes: ['zhongshuyuan-office'] },
  { pickupSceneId: 'commercial-street', scenes: ['commercial-street', 'commercial-cafe'] },
  { pickupSceneId: 'yonghe-mining-perimeter', scenes: ['yonghe-mining-perimeter', 'yonghe-eatery'] },
]
export type MainlineRideOrder = { sourceSceneId: MainlineSceneId; targetSceneId: MainlineSceneId; driverArrivesAt: number }
export type MainlineRideWalkingContext = { layout: SceneLayout; screenMetrics: SceneScreenMetrics; cameraOffset?: Point }
export function mainlineRideZone(sceneId: MainlineSceneId) { return mainlineRideZones.find(zone => zone.scenes.includes(sceneId)) }
export function mainlineRidePickupPosition(sceneId: MainlineSceneId) { return mainlineScenes[sceneId].rideArrivalPosition }
export function mainlineRideAtPickup(order: MainlineRideOrder, sceneId: MainlineSceneId, position: Point, metrics = defaultSceneScreenMetrics) {
  if (order.sourceSceneId !== sceneId) return false
  const pickup = mainlineRidePickupPosition(sceneId)
  return Math.hypot((position.x - pickup.x) * metrics.width / 100, (position.y - pickup.y) * metrics.height / 100) <= 18
}
/** Estimate legal walking legs once, independent of subsequent player progress. */
export function mainlineRideWalkingEtaMs(sceneId: MainlineSceneId, position: Point, context: MainlineRideWalkingContext): number | null {
  const zone = mainlineRideZone(sceneId)
  if (!zone) return null
  let currentSceneId = sceneId
  let start = position
  let duration = 0
  const visited = new Set<MainlineSceneId>()
  while (!visited.has(currentSceneId)) {
    visited.add(currentSceneId)
    const scene = mainlineScenes[currentSceneId]
    const layout = currentSceneId === sceneId ? context.layout : {}
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, start, layout, context.screenMetrics)
    const options = { geometrySnapshot, screenMetrics: context.screenMetrics, actorId: 'protagonist', openPassageIds: new Set(scene.passages.filter(p => p.access === 'open').map(p => p.id)) }
    const movement = { ...protagonistCharacterMovementOptions(context.screenMetrics), preserveNavigationRoute: true }
    if (currentSceneId === zone.pickupSceneId) {
      const pickup = mainlineRidePickupPosition(currentSceneId)
      const path = findMainlinePath(start, pickup, scene, layout, options)
      return path ? duration + movementDurationMsForPath(path, start, movement) : null
    }
    const exit = scene.passages.find(p => p.targetSceneId && zone.scenes.includes(p.targetSceneId))
    if (!exit?.targetSceneId) return null
    const approach = canActorReachPassageApproach(scene, exit, start, layout, options)
    if (!approach) return null
    duration += movementDurationMsForPath(approach.path, start, movement)
    currentSceneId = exit.targetSceneId
    start = exit.entryPosition ?? mainlineScenes[currentSceneId].initialPlayerPosition
  }
  return null
}
export function mainlineRideOrderPatch(order: MainlineRideOrder | null): PlayerSceneState {
  return { rideDestination: order?.targetSceneId ?? null, rideDriverArrivesAt: order?.driverArrivesAt ?? null }
}
export function mainlineRideOrderFromState(sceneState: Partial<Record<MainlineSceneId, PlayerSceneState>>): MainlineRideOrder | null {
  for (const zone of mainlineRideZones) {
    const state = sceneState[zone.pickupSceneId]
    if (typeof state?.rideDestination === 'string' && mainlineScenes[state.rideDestination as MainlineSceneId] && typeof state.rideDriverArrivesAt === 'number') {
      return { sourceSceneId: zone.pickupSceneId, targetSceneId: state.rideDestination as MainlineSceneId, driverArrivesAt: state.rideDriverArrivesAt }
    }
  }
  return null
}
