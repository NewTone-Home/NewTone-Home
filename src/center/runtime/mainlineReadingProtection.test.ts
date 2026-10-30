import { describe, expect, it } from 'vitest'
import type { MainlineContinuousStructure, MainlineSceneEntity } from './mainlineSceneModel'
import { mainlineScenes } from './mainlineScenes'
import { currentMainlineReadingTargetIds, mainlineReadingActionCameraAnchor } from './mainlineReadingProtection'
import { mainlineDialogueStageActorOpacity, mainlineDialogueStageHiddenEntityIds } from './mainlineDialogueStage'

describe('reading protection identity relationships', () => {
  it('keeps an action camera anchor until the viewport changes, then rebases it to the live camera', () => {
    const first = mainlineReadingActionCameraAnchor({ previous: null, actionId: 4, viewportKey: '390x844', authoredOffset: { x: 12, y: 18 }, currentOffset: { x: 12, y: 18 } })
    const whileStable = mainlineReadingActionCameraAnchor({ previous: first, actionId: 4, viewportKey: '390x844', authoredOffset: first.offset, currentOffset: { x: 12, y: 18 } })
    expect(whileStable.offset).toEqual({ x: 12, y: 18 })
    const rotated = mainlineReadingActionCameraAnchor({ previous: whileStable, actionId: 4, viewportKey: '844x390', authoredOffset: first.offset, currentOffset: { x: -24, y: 7 } })
    expect(rotated.offset).toEqual({ x: -24, y: 7 })
    const nextAction = mainlineReadingActionCameraAnchor({ previous: rotated, actionId: 5, viewportKey: '844x390', authoredOffset: { x: 31, y: 9 }, currentOffset: { x: 0, y: 0 } })
    expect(nextAction.offset).toEqual({ x: 31, y: 9 })
  })

  it('protects a physical counter surface when reading its semantic service alias', () => {
    const objects = [
      { id: 'commercial-cafe-counter', interactionStructureId: 'cafe-trial-counter-long-body', counterSurfaceId: 'cafe-trial-L-counter' },
      { id: 'cafe-trial-counter-long-0', interactionStructureId: 'cafe-trial-counter-long-body', counterSurfaceId: 'cafe-trial-L-counter' },
      { id: 'cafe-trial-pickup', interactionStructureId: 'cafe-trial-counter-long-body', counterSurfaceId: 'cafe-trial-L-counter' },
    ] as unknown as MainlineSceneEntity[]
    const structures = [
      { id: 'cafe-trial-counter-long-body', kind: 'counter', counterSurface: {
        groupId: 'cafe-trial-L-counter', roomId: 'commercial-north-cafe-interior',
        interactionEntityId: 'cafe-trial-counter-long-0', labelEntityId: 'cafe-trial-counter-long-0', orientation: 'vertical',
      } },
      { id: 'cafe-trial-counter-front-body', kind: 'counter', counterSurface: {
        groupId: 'cafe-trial-L-counter', roomId: 'commercial-north-cafe-interior',
        interactionEntityId: 'cafe-trial-counter-front-0', labelEntityId: 'cafe-trial-counter-front-0', orientation: 'horizontal',
      } },
    ] as unknown as MainlineContinuousStructure[]

    const protectedIds = currentMainlineReadingTargetIds({
      readingMode: true,
      sceneActionEntityId: 'commercial-cafe-counter',
      objects,
      continuousStructures: structures,
    })

    for (const id of [
      'commercial-cafe-counter', 'cafe-trial-counter-long-body', 'cafe-trial-counter-long-0',
      'cafe-trial-pickup', 'cafe-trial-L-counter', 'cafe-trial-counter-front-body', 'cafe-trial-counter-front-0',
    ]) expect(protectedIds.has(id)).toBe(true)
  })

  it('does not expand unrelated wall-feature identities or protect anything outside reading mode', () => {
    const objects = [
      { id: 'commercial-cafe-blackboard', surface: 'wall' },
      { id: 'cafe-trial-coffee-machine', interactionStructureId: 'cafe-trial-worktop-body', counterSurfaceId: 'cafe-trial-worktop' },
    ] as unknown as MainlineSceneEntity[]
    const structures = [{ id: 'cafe-trial-worktop-body', kind: 'counter', counterSurface: {
      groupId: 'cafe-trial-worktop', roomId: 'commercial-north-cafe-interior',
      interactionEntityId: 'cafe-trial-worktop-0', labelEntityId: 'cafe-trial-worktop-0', orientation: 'vertical',
    } }] as unknown as MainlineContinuousStructure[]

    const blackboardIds = currentMainlineReadingTargetIds({ readingMode: true, sceneEchoEntityId: 'commercial-cafe-blackboard', objects, continuousStructures: structures })
    expect(blackboardIds.has('commercial-cafe-blackboard')).toBe(true)
    expect(blackboardIds.has('cafe-trial-worktop-body')).toBe(false)

    const inactiveIds = currentMainlineReadingTargetIds({ readingMode: false, sceneEchoEntityId: 'commercial-cafe-blackboard', objects, continuousStructures: structures })
    expect(inactiveIds.size).toBe(0)
  })

  it('resolves the authored Cafe service and worktop IDs to their actual surface IDs', () => {
    const cafe = mainlineScenes['commercial-street']
    const counterIds = currentMainlineReadingTargetIds({
      readingMode: true,
      sceneActionEntityId: 'commercial-cafe-counter',
      objects: cafe.objects,
      continuousStructures: cafe.continuousStructures,
    })
    const worktopIds = currentMainlineReadingTargetIds({
      readingMode: true,
      sceneActionEntityId: 'cafe-trial-coffee-machine',
      objects: cafe.objects,
      continuousStructures: cafe.continuousStructures,
    })

    expect(counterIds.has('cafe-trial-counter-long-0')).toBe(true)
    expect(counterIds.has('cafe-trial-counter-front-0')).toBe(true)
    expect(worktopIds.has('cafe-trial-worktop-0')).toBe(true)
    expect(worktopIds.has('cafe-trial-worktop-body')).toBe(true)
  })

  it('keeps the actual Cafe counter/worktop and nearby Cafe wall/menu identities protected throughout story dialogue', () => {
    const cafe = mainlineScenes['commercial-street']
    const readingIds = currentMainlineReadingTargetIds({
      readingMode: true, objects: cafe.objects, continuousStructures: cafe.continuousStructures,
      geometry: cafe.geometry, rooms: cafe.rooms, preserveServiceEntities: true,
    })
    for (const id of ['commercial-cafe-counter', 'commercial-cafe-menu', 'commercial-cafe-blackboard', 'cafe-trial-counter-long-0', 'cafe-trial-counter-front-0']) {
      expect(readingIds.has(id), id).toBe(true)
    }
    for (const surface of cafe.continuousStructures.filter(structure => structure.readingProtection === 'preserve').map(structure => structure.counterSurface).filter(Boolean)) {
      expect(readingIds.has(surface!.groupId)).toBe(true)
      expect(readingIds.has(surface!.interactionEntityId)).toBe(true)
    }
    const hidden = mainlineDialogueStageHiddenEntityIds({
      entities: cafe.objects, structures: cafe.continuousStructures, roomId: 'commercial-north-cafe-interior',
      protectedEntityIds: new Set(), serviceRequired: true,
    })
    for (const id of ['commercial-cafe-counter', 'commercial-cafe-menu', 'commercial-cafe-blackboard', 'cafe-trial-counter-long-0', 'cafe-trial-counter-front-0']) {
      expect(hidden.has(id)).toBe(false)
    }
    expect(mainlineDialogueStageActorOpacity({
      active: true, actorId: 'cafe-floor-server', currentSpeakerActorId: 'lao-zhou',
      participantActorIds: new Set(['protagonist', 'lao-zhou']), protectedActorIds: new Set(cafe.npcs.filter(npc => npc.readingProtection === 'preserve').map(npc => npc.id)),
      actorRoomId: 'commercial-north-cafe-interior', stageRoomId: 'commercial-north-cafe-interior',
    })).toBe(.5)
  })
})
