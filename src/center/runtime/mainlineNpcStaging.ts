import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'

/**
 * Scene staging is behavior data.  It may place an NPC at a seat or a named
 * service point, but it never becomes an identity property of that NPC.
 */
export function mainlineNpcStagingBehavior(scene: MainlineSceneDefinition, npcId: string) {
  return scene.npcBehaviors?.find((behavior) => behavior.npcId === npcId)
}

export function mainlineNpcStagedSeatId(scene: MainlineSceneDefinition, npcId: string) {
  const behavior = mainlineNpcStagingBehavior(scene, npcId)
  if (behavior?.targetKind === 'seat') return behavior.targetId
  return scene.npcPlacements.find((placement) => placement.npcId === npcId)?.seatId
}

export function mainlineNpcStagedPoint(scene: MainlineSceneDefinition, npcId: string): Point | undefined {
  const behavior = mainlineNpcStagingBehavior(scene, npcId)
  if (behavior?.targetKind === 'point') {
    const target = scene.npcBehaviorTargets?.find((candidate) => candidate.id === behavior.targetId)
    if (target) return { ...target.position }
  }
  const placement = scene.npcPlacements.find((candidate) => candidate.npcId === npcId)
  return placement?.position ? { ...placement.position } : undefined
}

/** A current behavior may expose a service surface without defining NPC identity. */
export function mainlineNpcStagedInteractionContactEntityId(scene: MainlineSceneDefinition, npcId: string) {
  return mainlineNpcStagingBehavior(scene, npcId)?.interactionContactEntityId
}
