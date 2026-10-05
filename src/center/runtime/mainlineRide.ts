import { isMainlineExternalExitTriggered } from './mainlineExternalExit'
import { mainlineScenes, type MainlineSceneId } from './mainlineScenes'
import { canActorReachPassageApproach, findMainlinePath } from './mainlineNavigation'
import { createMainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { type SceneScreenMetrics } from './sceneBoundaryGrid'
import { movementDurationMsForPath, protagonistCharacterMovementOptions } from './useFreeRoamMovement'
import type { Point } from './sceneGeometry'
import type { SceneLayout } from './sceneLayout'
import type { PlayerSceneState } from './playerSave'

export const mainlineRideZones: readonly { pickupSceneId: MainlineSceneId; scenes: readonly MainlineSceneId[]; waitingLabel: string; guidanceText: string }[] = [
  { pickupSceneId: 'zhongshuyuan-office', scenes: ['zhongshuyuan-office'], waitingLabel: '办公室出口', guidanceText: '请到办公室出口等车' },
  { pickupSceneId: 'commercial-street', scenes: ['commercial-street', 'commercial-cafe'], waitingLabel: '商业街口', guidanceText: '请回到商业街口等车' },
  { pickupSceneId: 'yonghe-mining-perimeter', scenes: ['yonghe-mining-perimeter', 'yonghe-eatery'], waitingLabel: '矿区入口', guidanceText: '请到矿区入口等车' },
]
export type MainlineRideOrder = { sourceSceneId: MainlineSceneId; targetSceneId: MainlineSceneId; driverArrivesAt: number }
export type MainlineRideWalkingContext = { layout: SceneLayout; screenMetrics: SceneScreenMetrics; cameraOffset?: Point }
export function mainlineRideZone(sceneId: MainlineSceneId) { return mainlineRideZones.find(zone => zone.scenes.includes(sceneId)) }
/** Waiting positions are the actual external exits, never the arrival spawn. */
export function mainlineRidePickupPositions(sceneId: MainlineSceneId): Point[] {
  const scene = mainlineScenes[sceneId]
  return scene.externalExits.map(exit => {
    const trigger = exit.triggerEntityId ? scene.geometry.find(unit => unit.geometryKind === 'boundary' && unit.entityId === exit.triggerEntityId) : undefined
    const tangent = exit.triggerSpan ? (exit.triggerSpan.start + exit.triggerSpan.end) / 2 : trigger ? (exit.axis === 'x' ? trigger.y + trigger.height / 2 : trigger.x + trigger.width / 2) : (exit.axis === 'x' ? scene.initialPlayerPosition.y : scene.initialPlayerPosition.x)
    return exit.axis === 'x' ? { x: exit.threshold, y: tangent } : { x: tangent, y: exit.threshold }
  })
}
export function mainlineRidePickupPosition(sceneId: MainlineSceneId) { return mainlineRidePickupPositions(sceneId)[0] }
export function mainlineRideWaitingGuidance(sceneId: MainlineSceneId) {
  return mainlineRideZone(sceneId) ?? { waitingLabel: '院门', guidanceText: '请到院门等车' }
}
export function mainlineRideAtPickup(order: MainlineRideOrder, sceneId: MainlineSceneId, position: Point) {
  if (order.sourceSceneId !== sceneId) return false
  const scene = mainlineScenes[sceneId]
  return scene.externalExits.some(exit => isMainlineExternalExitTriggered(position, exit, scene))
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
      const durations = mainlineRidePickupPositions(currentSceneId).map(pickup => {
        const path = findMainlinePath(start, pickup, scene, layout, options)
        return path ? movementDurationMsForPath(path, start, movement) : Infinity
      })
      const shortest = Math.min(...durations)
      return Number.isFinite(shortest) ? duration + shortest : null
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
