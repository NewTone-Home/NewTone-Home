import type { MainlineSceneDefinition } from './mainlineScenes'
import type { MainlineSceneEntity } from './mainlineScenes'

/**
 * Occupancy is a scene condition rather than chair or NPC identity. NPC scene
 * staging supplies the static seats; the optional player seat is runtime-only.
 */
export function mainlineSceneOccupiedSeatIds(scene: MainlineSceneDefinition, playerSeatId: string | null = null) {
  const occupiedSeatIds = new Set(scene.npcPlacements.flatMap((placement) => placement.seatId ? [placement.seatId] : []))
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

/** A seat hint belongs to this moment's interaction state, never to the chair itself. */
export function isMainlineSeatPrompted(entity: MainlineSceneEntity, promptedSeatId: string | null, playerSeatId: string | null) {
  return entity.kind === 'seat' && entity.id === promptedSeatId && playerSeatId !== promptedSeatId
}
