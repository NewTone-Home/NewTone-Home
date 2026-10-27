import type { MainlineSceneEntity, MainlineSceneNpc } from './mainlineSceneModel'
import type { Point } from './sceneGeometry'

export const mainlineDialogueHandoffMinimumMs = 300
export const mainlineDialogueTypingIntervalMs = 45

export function mainlineDialogueClickAction(input: {
  motion: 'typing' | 'static' | 'deleting' | 'deleted'
  handoffActive: boolean
}): 'ignore' | 'complete-typing' | 'advance' {
  if (input.handoffActive || input.motion === 'deleting' || input.motion === 'deleted') return 'ignore'
  return input.motion === 'typing' ? 'complete-typing' : 'advance'
}

/** A speaker handoff belongs after the last source segment, never between pages. */
export function mainlineDialogueShouldHandoff(input: {
  currentSpeaker: string | null | undefined
  nextSpeaker: string | null | undefined
  currentSegmentIndex: number
  segmentCount: number
  isInterior: boolean
}) {
  return input.isInterior
    && Boolean(input.currentSpeaker && input.nextSpeaker && input.currentSpeaker !== input.nextSpeaker)
    && input.currentSegmentIndex >= input.segmentCount - 1
}

/** Choices must wait for the whole current utterance/page, including layout settling. */
export function mainlineDialogueTurnAllowsOptions(input: {
  hasDialogue: boolean
  ready: boolean
  motion: 'typing' | 'static' | 'deleting' | 'deleted'
  handoffActive: boolean
  currentSegmentIndex: number
  segmentCount: number
  currentOverflowPageIndex: number
  overflowPageCount: number
  layoutTransitioning: boolean
}) {
  if (!input.hasDialogue) return true
  return input.ready
    && input.motion === 'static'
    && !input.handoffActive
    && input.currentSegmentIndex >= input.segmentCount - 1
    && input.currentOverflowPageIndex >= input.overflowPageCount - 1
    && !input.layoutTransitioning
}

/** Resolve authored speaker identity without guessing when NPC labels collide. */
export function mainlineDialogueSpeakerActorId(input: {
  speaker: string
  speakerNpcId?: string
  npcs: readonly Pick<MainlineSceneNpc, 'id' | 'label'>[]
  protagonistLabel: string
}) {
  if (input.speakerNpcId && input.npcs.some(npc => npc.id === input.speakerNpcId)) return input.speakerNpcId
  if (input.speaker === input.protagonistLabel) return 'protagonist'
  const matches = input.npcs.filter(npc => npc.label === input.speaker)
  return matches.length === 1 ? matches[0]!.id : null
}

/** Fade out with the typewriter deletion, but keep even a one-character line visible for 300 ms. */
export function mainlineDialogueHandoffDurationMs(textLength: number, minimumMs = mainlineDialogueHandoffMinimumMs, intervalMs = mainlineDialogueTypingIntervalMs) {
  return Math.max(minimumMs, Math.max(0, textLength - 1) * intervalMs)
}

/** The selected table and chairs come from the live seat's authored group. */
export function mainlineDialogueFurnitureGroupIds(entities: readonly MainlineSceneEntity[], seatIds: ReadonlySet<string>) {
  return new Set(entities
    .filter(entity => seatIds.has(entity.id) && entity.groupId)
    .map(entity => entity.groupId!))
}

/** Only current-room visuals can leave the formal-dialogue stage. */
export function mainlineDialogueStageHiddenEntityIds(input: {
  entities: readonly MainlineSceneEntity[]
  roomId: string | null
  protectedEntityIds: ReadonlySet<string>
  protectedFurnitureGroupIds?: ReadonlySet<string>
  serviceRequired?: boolean
}) {
  if (!input.roomId) return new Set<string>()
  return new Set(input.entities
    .filter(entity => entity.roomId === input.roomId
      && entity.kind !== 'door'
      && entity.surface !== 'wall'
      && !input.protectedEntityIds.has(entity.id)
      && !(entity.groupId && input.protectedFurnitureGroupIds?.has(entity.groupId))
      && !(input.serviceRequired && entity.counterService))
    .map(entity => entity.id))
}

export function mainlineDialogueStageActorOpacity(input: {
  active: boolean
  actorId: string
  currentSpeakerActorId: string | null
  participantActorIds: ReadonlySet<string>
  protectedActorIds?: ReadonlySet<string>
  actorRoomId?: string
  stageRoomId?: string | null
}) {
  if (!input.active || !input.stageRoomId || input.actorRoomId !== input.stageRoomId) return 1
  if (input.actorId === input.currentSpeakerActorId) return 1
  if (input.participantActorIds.has(input.actorId) || input.protectedActorIds?.has(input.actorId)) return .5
  return 0
}

/** Choose a point above or below the speaker, biased away from the other actor. */
export function mainlineDialogueSpeakerOutsidePosition(input: {
  speaker: Point
  other: Point
  bounds: { x: number; y: number; width: number; height: number }
  verticalGap: number
}): Point {
  const candidates = [
    { x: input.speaker.x, y: input.speaker.y - input.verticalGap },
    { x: input.speaker.x, y: input.speaker.y + input.verticalGap },
    { x: input.speaker.x - input.verticalGap, y: input.speaker.y },
    { x: input.speaker.x + input.verticalGap, y: input.speaker.y },
  ].map((point) => ({
    x: Math.max(input.bounds.x, Math.min(input.bounds.x + input.bounds.width, point.x)),
    y: Math.max(input.bounds.y, Math.min(input.bounds.y + input.bounds.height, point.y)),
  }))
  return candidates.reduce((best, point) => {
    const distance = (point.x - input.other.x) ** 2 + (point.y - input.other.y) ** 2
    const bestDistance = (best.x - input.other.x) ** 2 + (best.y - input.other.y) ** 2
    return distance > bestDistance ? point : best
  }, candidates[0]!)
}
