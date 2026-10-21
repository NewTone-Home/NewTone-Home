import type { MainlineSceneDefinition } from './mainlineScenes'
import type { MainlineSceneEntity } from './mainlineScenes'
import type { Point } from './sceneGeometry'
import type { NpcRuntimeSnapshot } from './npcCore'
import { mainlineNpcStagedSeatId, mainlineNpcStagingBehavior } from './mainlineNpcStaging'

/**
 * Occupancy is a scene condition rather than chair or NPC identity. NPC scene
 * staging supplies the static seats; the optional player seat is runtime-only.
 */
export function mainlineSceneOccupiedSeatIds(scene: MainlineSceneDefinition, playerSeatId: string | null = null, releasedNpcIds: ReadonlySet<string> = new Set()) {
  const occupiedSeatIds = new Set(scene.npcs.flatMap((npc) => {
    if (releasedNpcIds.has(npc.id)) return []
    const seatId = mainlineNpcStagedSeatId(scene, npc.id)
    return seatId ? [seatId] : []
  }))
  if (playerSeatId) occupiedSeatIds.add(playerSeatId)
  return occupiedSeatIds
}

export function isMainlineSeatAvailable(scene: MainlineSceneDefinition, seatId: string, playerSeatId: string | null = null) {
  const seat = scene.objects.find((entity) => entity.id === seatId)
  return Boolean(seat?.seat) && !mainlineSceneOccupiedSeatIds(scene, playerSeatId).has(seatId)
}

/** The page owns this transient value; no player seating state is saved. */
export function nextMainlinePlayerSeatId(scene: MainlineSceneDefinition, currentSeatId: string | null, requestedSeatId: string | null) {
  if (!requestedSeatId) return null
  return isMainlineSeatAvailable(scene, requestedSeatId, currentSeatId) ? requestedSeatId : currentSeatId
}

export function isMainlineSeatLabelSuppressed(entity: MainlineSceneEntity, occupiedSeatIds: ReadonlySet<string>) {
  return entity.kind === 'seat' && occupiedSeatIds.has(entity.id)
}

/** Renderer-only semantics: a seated protagonist is represented by their label, not the map dot. */
export function mainlineProtagonistPresentation(playerSeatId: string | null) {
  return playerSeatId ? { kind: 'seated' as const, label: '修杰' } : { kind: 'dot' as const }
}

/**
 * A seated actor keeps its collision-safe runtime point, but its occupant
 * label belongs on the seat's final rendered center.
 */
export function mainlineSeatedActorVisualPosition(
  runtimePosition: Point,
  seatId: string | null | undefined,
  renderedSeatCenter: Point | undefined,
): Point {
  return seatId && renderedSeatCenter ? renderedSeatCenter : runtimePosition
}

/** Staging is an initial sitting pose, not a permanent visual constraint on
 * a different live duty. Occupancy release remains owned by movement. */
export function mainlineNpcVisualSeatId(scene: MainlineSceneDefinition, npcId: string, snapshot?: Pick<NpcRuntimeSnapshot, 'phase' | 'dutyId'>) {
  const seatId = mainlineNpcStagedSeatId(scene, npcId)
  if (!seatId) return undefined
  const staging = mainlineNpcStagingBehavior(scene, npcId)
  if (snapshot?.phase === 'moving' || snapshot?.dutyId && snapshot.dutyId !== staging?.dutyId) return undefined
  return seatId
}

/** A seat hint belongs to this moment's interaction state, never to the chair itself. */
export function isMainlineSeatPrompted(entity: MainlineSceneEntity, promptedSeatId: string | null, playerSeatId: string | null) {
  return entity.kind === 'seat' && entity.id === promptedSeatId && playerSeatId !== promptedSeatId
}
