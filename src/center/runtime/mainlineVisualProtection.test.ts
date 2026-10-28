import { describe, expect, it } from 'vitest'
import type { MainlineContinuousStructure, MainlineSceneEntity, MainlineSceneNpc } from './mainlineSceneModel'
import { mainlineDialogueStageActorOpacity, mainlineDialogueStageHiddenEntityIds } from './mainlineDialogueStage'
import { currentMainlineReadingTargetIds } from './mainlineReadingProtection'
import { mainlineProtectedVisualIdentityIds } from './mainlineVisualProtection'

describe('shared authored visual protection', () => {
  it('propagates an unknown protected identity through aliases, structures, groups, and parent wall cells', () => {
    const entities = [
      { id: 'semantic-service-entry', label: 'service', kind: 'fixture', weight: 'fixture', surface: 'floor', position: { x: 1, y: 1 }, roomId: 'fictional-room', readingProtection: 'preserve', interactionAliasId: 'future-alias', interactionStructureId: 'future-parent', counterSurfaceId: 'future-group', groupId: 'future-group' },
      { id: 'future-child-added-later', label: 'child', kind: 'fixture', weight: 'fixture', surface: 'floor', position: { x: 2, y: 1 }, roomId: 'fictional-room', groupId: 'future-group' },
      { id: 'unprotected-prop', label: 'prop', kind: 'fixture', weight: 'fixture', surface: 'floor', position: { x: 3, y: 1 }, roomId: 'fictional-room' },
    ] as unknown as MainlineSceneEntity[]
    const structures = [{ id: 'future-parent', kind: 'counter', readingProtection: 'preserve', counterSurface: {
      groupId: 'future-group', roomId: 'fictional-room', interactionEntityId: 'future-child-added-later', labelEntityId: 'future-child-added-later', orientation: 'horizontal' as const,
    } }] as unknown as MainlineContinuousStructure[]
    const geometry = [{ id: 'future-wall-unit', ownerId: 'future-wall', sourceWallId: 'future-wall', x: 5, y: 5, width: 20, height: 2, readingProtection: 'preserve' as const, visual: { cells: [{ id: 'future-wall-cell', entityId: 'future-wall-child' }] } }]
    const rooms = [{ id: 'fictional-room', bounds: { x: 0, y: 0, width: 30, height: 30 } }]
    const protectedIds = currentMainlineReadingTargetIds({ readingMode: true, objects: entities, continuousStructures: structures, geometry, rooms, roomId: 'fictional-room' })
    for (const id of ['semantic-service-entry', 'future-alias', 'future-parent', 'future-group', 'future-child-added-later', 'future-wall-unit', 'future-wall-cell', 'future-wall-child']) {
      expect(protectedIds.has(id)).toBe(true)
    }
    expect(currentMainlineReadingTargetIds({ readingMode: false, objects: entities, continuousStructures: structures, geometry, rooms, roomId: 'fictional-room' }).size).toBe(0)

    const hidden = mainlineDialogueStageHiddenEntityIds({ entities, structures, roomId: 'fictional-room', protectedEntityIds: new Set(), serviceRequired: true })
    expect(hidden.has('semantic-service-entry')).toBe(false)
    expect(hidden.has('future-child-added-later')).toBe(false)
    expect(hidden.has('unprotected-prop')).toBe(true)
  })

  it('keeps authored actors visible at supporting brightness, preserves speaker brightness, and resets after dialogue', () => {
    const actors = [{ id: 'new-service-actor', roleId: 'future-role', label: 'worker', roomId: 'fictional-room', readingProtection: 'preserve' }] as unknown as MainlineSceneNpc[]
    const protectedActors = mainlineProtectedVisualIdentityIds({ entities: [], npcs: actors, roomId: 'fictional-room' })
    const common = { active: true, currentSpeakerActorId: 'speaker', participantActorIds: new Set<string>(), protectedActorIds: protectedActors, actorRoomId: 'fictional-room', stageRoomId: 'fictional-room' }
    expect(mainlineDialogueStageActorOpacity({ ...common, actorId: 'new-service-actor' })).toBe(.5)
    expect(mainlineDialogueStageActorOpacity({ ...common, actorId: 'speaker' })).toBe(1)
    expect(mainlineDialogueStageActorOpacity({ ...common, active: false, actorId: 'new-service-actor' })).toBe(1)
    expect(mainlineProtectedVisualIdentityIds({ entities: [], npcs: actors, roomId: 'other-room' }).size).toBe(0)
  })
})
