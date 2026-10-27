import { describe, expect, it } from 'vitest'
import { mainlineDialogueClickAction, mainlineDialogueFurnitureGroupIds, mainlineDialogueHandoffDurationMs, mainlineDialogueHandoffLockShouldRelease, mainlineDialogueShouldHandoff, mainlineDialogueSpeakerActorId, mainlineDialogueSpeakerOutsidePosition, mainlineDialogueStageActorOpacity, mainlineDialogueStageHiddenEntityIds, mainlineDialogueTurnAllowsOptions } from '../src/center/runtime/mainlineDialogueStage'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

describe('formal dialogue stage rules', () => {
  it('releases the reading advance lock only when a speaker handoff finishes', () => {
    expect(mainlineDialogueHandoffLockShouldRelease(false, true)).toBe(false)
    expect(mainlineDialogueHandoffLockShouldRelease(true, true)).toBe(false)
    expect(mainlineDialogueHandoffLockShouldRelease(true, false)).toBe(true)
    expect(mainlineDialogueHandoffLockShouldRelease(false, false)).toBe(false)
  })

  it('lets a fresh click advance after typing was completed without consuming that page on the skip click', () => {
    let motion: 'typing' | 'static' = 'typing'
    let consumed = false

    const firstClick = mainlineDialogueClickAction({ motion, handoffActive: false })
    expect(firstClick).toBe('complete-typing')
    if (firstClick === 'complete-typing') motion = 'static'
    expect(consumed).toBe(false)

    const freshClick = mainlineDialogueClickAction({ motion, handoffActive: false })
    expect(freshClick).toBe('advance')
    if (freshClick === 'advance') consumed = true
    expect(consumed).toBe(true)
  })

  it('ignores rapid clicks during speaker handoff without queuing an advance for the incoming line', () => {
    for (const motion of ['typing', 'static'] as const) {
      expect(mainlineDialogueClickAction({ motion, handoffActive: true })).toBe('ignore')
    }
    expect(mainlineDialogueClickAction({ motion: 'static', handoffActive: false })).toBe('advance')
    expect(mainlineDialogueClickAction({ motion: 'deleting', handoffActive: false })).toBe('ignore')
  })

  it('resolves explicit NPC IDs and unambiguous authored names without mistaking the protagonist for an NPC', () => {
    const cafe = mainlineScenes['commercial-cafe']
    expect(mainlineDialogueSpeakerActorId({ speaker: '老周', speakerNpcId: 'lao-zhou', npcs: cafe.npcs, protagonistLabel: '修杰' })).toBe('lao-zhou')
    expect(mainlineDialogueSpeakerActorId({ speaker: cafe.npcs.find(npc => npc.id === 'lao-zhou')!.label, npcs: cafe.npcs, protagonistLabel: '修杰' })).toBe('lao-zhou')
    expect(mainlineDialogueSpeakerActorId({ speaker: '修杰', npcs: cafe.npcs, protagonistLabel: '修杰' })).toBe('protagonist')
    expect(mainlineDialogueSpeakerActorId({ speaker: 'unknown', npcs: cafe.npcs, protagonistLabel: '修杰' })).toBeNull()
  })

  it('sets only the scene-selected furniture group aside, without hard-coding a Cafe table', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const seat = cafe.objects.find(entity => entity.id === 'cafe-trial-table-group-4-chair-bottom')!
    const groups = mainlineDialogueFurnitureGroupIds(cafe.objects, new Set([seat.id]))
    expect(groups).toEqual(new Set(['cafe-trial-table-group-4']))
    const hidden = mainlineDialogueStageHiddenEntityIds({ entities: cafe.objects, roomId: 'commercial-north-cafe-interior', protectedEntityIds: new Set(), protectedFurnitureGroupIds: groups })
    expect(hidden.has(seat.id)).toBe(false)
    expect(hidden.has(cafe.objects.find(entity => entity.groupId === seat.groupId && entity.kind === 'table')!.id)).toBe(false)
  })

  it('leaves other rooms, doors and required service surfaces alone', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const door = { id: 'door', label: 'door', kind: 'door' as const, weight: 'gateway' as const, surface: 'wall' as const, roomId: 'room', position: { x: 20, y: 20 } }
    const unrelatedRoom = { id: 'other-room-table', label: 'table', kind: 'table' as const, weight: 'fixture' as const, surface: 'floor' as const, roomId: 'other-room', position: { x: 20, y: 20 } }
    const service = { id: 'service-counter', label: 'counter', kind: 'fixture' as const, weight: 'fixture' as const, surface: 'floor' as const, roomId: 'room', position: { x: 20, y: 20 }, counterSurfaceId: 'service-counter', counterService: true }
    const entities = [door, unrelatedRoom, service]
    const hidden = mainlineDialogueStageHiddenEntityIds({ entities, roomId: 'room', protectedEntityIds: new Set(), serviceRequired: true })
    expect(hidden.has(door.id)).toBe(false)
    expect(hidden.has(unrelatedRoom.id)).toBe(false)
    expect(hidden.has(service.id)).toBe(false)
    expect(mainlineDialogueStageHiddenEntityIds({ entities, roomId: 'room', protectedEntityIds: new Set() }).has(service.id)).toBe(true)
  })

  it('keeps the current speaker at full brightness, the other participant at half, and unrelated room people out of the stage', () => {
    const common = { active: true, currentSpeakerActorId: 'lao-zhou', participantActorIds: new Set(['protagonist', 'lao-zhou']), stageRoomId: 'cafe' }
    expect(mainlineDialogueStageActorOpacity({ ...common, actorId: 'lao-zhou', actorRoomId: 'cafe' })).toBe(1)
    expect(mainlineDialogueStageActorOpacity({ ...common, actorId: 'protagonist', actorRoomId: 'cafe' })).toBe(.5)
    expect(mainlineDialogueStageActorOpacity({ ...common, actorId: 'shopkeeper', actorRoomId: 'cafe' })).toBe(0)
    expect(mainlineDialogueStageActorOpacity({ ...common, actorId: 'street-person', actorRoomId: 'street' })).toBe(1)
    expect(mainlineDialogueStageActorOpacity({ ...common, actorId: 'lao-zhou', actorRoomId: 'cafe', active: false })).toBe(1)
  })

  it('enforces a 300 ms handoff floor and lets longer lines follow the deletion pace', () => {
    expect(mainlineDialogueHandoffDurationMs(1)).toBe(300)
    expect(mainlineDialogueHandoffDurationMs(7)).toBe(300)
    expect(mainlineDialogueHandoffDurationMs(20)).toBe(855)
  })

  it('waits until the current line’s last segment before fading to the next speaker', () => {
    const base = { currentSpeaker: 'Lao Zhou', nextSpeaker: 'Xiujie', segmentCount: 4, isInterior: true }
    expect(mainlineDialogueShouldHandoff({ ...base, currentSegmentIndex: 0 })).toBe(false)
    expect(mainlineDialogueShouldHandoff({ ...base, currentSegmentIndex: 2 })).toBe(false)
    expect(mainlineDialogueShouldHandoff({ ...base, currentSegmentIndex: 3 })).toBe(true)
    expect(mainlineDialogueShouldHandoff({ ...base, currentSegmentIndex: 3, nextSpeaker: 'Lao Zhou' })).toBe(false)
    expect(mainlineDialogueShouldHandoff({ ...base, currentSegmentIndex: 3, isInterior: false })).toBe(false)
  })

  it('keeps choices hidden until the current utterance last page is ready, settled, and any handoff has finished', () => {
    const ready = { hasDialogue: true, ready: true, motion: 'static' as const, handoffActive: false, currentSegmentIndex: 0, segmentCount: 1, currentOverflowPageIndex: 0, overflowPageCount: 1, layoutTransitioning: false }
    expect(mainlineDialogueTurnAllowsOptions({ ...ready, motion: 'typing' })).toBe(false)
    expect(mainlineDialogueTurnAllowsOptions({ ...ready, currentOverflowPageIndex: 0, overflowPageCount: 2 })).toBe(false)
    expect(mainlineDialogueTurnAllowsOptions({ ...ready, currentSegmentIndex: 0, segmentCount: 2 })).toBe(false)
    expect(mainlineDialogueTurnAllowsOptions({ ...ready, handoffActive: true })).toBe(false)
    expect(mainlineDialogueTurnAllowsOptions({ ...ready, layoutTransitioning: true })).toBe(false)
    expect(mainlineDialogueTurnAllowsOptions({ ...ready, ready: false })).toBe(false)
    expect(mainlineDialogueTurnAllowsOptions(ready)).toBe(true)
    expect(mainlineDialogueTurnAllowsOptions({ ...ready, hasDialogue: false, ready: false, motion: 'typing', handoffActive: true })).toBe(true)
  })

  it('chooses an external position inside the room and away from the other actor', () => {
    const result = mainlineDialogueSpeakerOutsidePosition({ speaker: { x: 25, y: 50 }, other: { x: 65, y: 50 }, bounds: { x: 10, y: 10, width: 80, height: 80 }, verticalGap: 10 })
    expect(result.x).toBeGreaterThanOrEqual(10)
    expect(result.x).toBeLessThanOrEqual(90)
    expect(result.y).toBeGreaterThanOrEqual(10)
    expect(result.y).toBeLessThanOrEqual(90)
    expect(Math.hypot(result.x - 65, result.y - 50)).toBeGreaterThan(Math.hypot(25 - 65, 50 - 50))
  })
})
