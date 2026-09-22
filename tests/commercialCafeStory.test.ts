import { describe, expect, it } from 'vitest'
import {
  advanceCommercialCafeStoryStage,
  commercialCafeLaoZhouConversationSeatId,
  commercialCafeStoryStageFromSceneState,
  commercialCafeStoryStageKey,
  initialCommercialCafeStoryStage,
  isCommercialCafeStoryDetailVisible,
  resolveCommercialCafeNpcInteraction,
} from '../src/center/runtime/commercialCafeStory'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineInteractionTarget } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineSceneSlices } from '../src/center/runtime/mainlineScenes'
import {
  createInitialPlayerSave,
  loadPlayerSave,
  recordPlayerSceneState,
  savePlayerSave,
} from '../src/center/runtime/playerSave'
import { PUBLIC_RELEASE_CUTOVER_ID, PUBLIC_RELEASE_CUTOVER_STORAGE_KEY } from '../src/services/publicReleaseMigration'

function createStorage() {
  const values = new Map([[PUBLIC_RELEASE_CUTOVER_STORAGE_KEY, PUBLIC_RELEASE_CUTOVER_ID]])
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('commercial cafe story stage', () => {
  it('starts at entered when the cafe has no saved stage', () => {
    expect(commercialCafeStoryStageFromSceneState(undefined)).toBe(initialCommercialCafeStoryStage)
    expect(commercialCafeStoryStageFromSceneState({ [commercialCafeStoryStageKey]: 'unexpected' })).toBe('entered')
  })

  it('advances through the authored cafe sequence without moving past complete', () => {
    expect(advanceCommercialCafeStoryStage('entered')).toBe('coffee-ordered')
    expect(advanceCommercialCafeStoryStage('coffee-ordered')).toBe('met-lao-zhou')
    expect(advanceCommercialCafeStoryStage('met-lao-zhou')).toBe('coffee-delivered')
    expect(advanceCommercialCafeStoryStage('coffee-delivered')).toBe('intel-received')
    expect(advanceCommercialCafeStoryStage('intel-received')).toBe('ready-to-leave')
    expect(advanceCommercialCafeStoryStage('ready-to-leave')).toBe('complete')
    expect(advanceCommercialCafeStoryStage('complete')).toBe('complete')
  })

  it('survives save reload without changing incense or blinds state', () => {
    const storage = createStorage()
    let save = createInitialPlayerSave('commercial-cafe')
    save = recordPlayerSceneState(save, 'commercial-cafe', commercialCafeStoryStageKey, 'intel-received')
    save = recordPlayerSceneState(save, 'jijia-ancestral-interior', 'incenseLitAt', 1234)
    save = recordPlayerSceneState(save, 'zhongshuyuan-office', 'blindsOpen', false)

    savePlayerSave(save, storage, 5678)
    const restored = loadPlayerSave(storage)

    expect(commercialCafeStoryStageFromSceneState(restored.sceneState['commercial-cafe'])).toBe('intel-received')
    expect(restored.sceneState['jijia-ancestral-interior']).toEqual({ incenseLitAt: 1234 })
    expect(restored.sceneState['zhongshuyuan-office']).toEqual({ blindsOpen: false })
  })

  it('persists a coffee order without changing incense or blinds state', () => {
    const storage = createStorage()
    let save = createInitialPlayerSave('commercial-cafe')
    save = recordPlayerSceneState(save, 'commercial-cafe', commercialCafeStoryStageKey, 'coffee-ordered')
    save = recordPlayerSceneState(save, 'jijia-ancestral-interior', 'incenseLitAt', 1234)
    save = recordPlayerSceneState(save, 'zhongshuyuan-office', 'blindsOpen', false)

    savePlayerSave(save, storage, 5678)
    const restored = loadPlayerSave(storage)

    expect(commercialCafeStoryStageFromSceneState(restored.sceneState['commercial-cafe'])).toBe('coffee-ordered')
    expect(restored.sceneState['jijia-ancestral-interior']).toEqual({ incenseLitAt: 1234 })
    expect(restored.sceneState['zhongshuyuan-office']).toEqual({ blindsOpen: false })
  })

  it('resolves Lao Zhou\'s first formal exchange only after coffee has been ordered', () => {
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'entered' })).toBeNull()
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'server', stage: 'coffee-ordered' })).toBeNull()
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'coffee-ordered' })).toEqual({ kind: 'feedback', feedback: '请先坐下。' })

    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'coffee-ordered', playerSeatId: commercialCafeLaoZhouConversationSeatId })).toEqual({
      kind: 'dialogue',
      dialogue: {
        triggerEntityId: 'lao-zhou',
        lines: [
          { id: 'commercial-cafe-lao-zhou-first-xiujie', speaker: '修杰', text: '老周，陈副部长还是没有消息吗？' },
          { id: 'commercial-cafe-lao-zhou-first-lao-zhou', speaker: '老周', text: '完全没有。' },
        ],
      },
      stateChangeOnDialogueComplete: { key: commercialCafeStoryStageKey, value: 'met-lao-zhou' },
    })
  })

  it('keeps the cafe stage unchanged until Lao Zhou\'s dialogue completion state is applied, then persists it', () => {
    const interaction = resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'coffee-ordered', playerSeatId: commercialCafeLaoZhouConversationSeatId })
    expect(interaction).toMatchObject({ kind: 'dialogue' })
    if (!interaction || interaction.kind !== 'dialogue') throw new Error('Expected seated Lao Zhou dialogue resolution')

    let save = createInitialPlayerSave('commercial-cafe')
    save = recordPlayerSceneState(save, 'commercial-cafe', commercialCafeStoryStageKey, 'coffee-ordered')
    expect(commercialCafeStoryStageFromSceneState(save.sceneState['commercial-cafe'])).toBe('coffee-ordered')

    save = recordPlayerSceneState(
      save,
      'commercial-cafe',
      interaction.stateChangeOnDialogueComplete.key,
      interaction.stateChangeOnDialogueComplete.value,
    )
    const storage = createStorage()
    savePlayerSave(save, storage, 5678)

    expect(commercialCafeStoryStageFromSceneState(loadPlayerSave(storage).sceneState['commercial-cafe'])).toBe('met-lao-zhou')
  })

  it.each(['met-lao-zhou', 'coffee-delivered', 'intel-received', 'ready-to-leave', 'complete'] as const)(
    'does not replay Lao Zhou\'s first exchange at %s',
    (stage) => {
      expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage, playerSeatId: commercialCafeLaoZhouConversationSeatId })).toBeNull()
    },
  )

  it('keeps lao zhou and the server as cafe NPCs, outside spatial scene entities', () => {
    const cafe = mainlineScenes['commercial-cafe']

    expect(cafe.npcs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'lao-zhou', roleId: 'lao-zhou', interactionTargetEntityId: 'commercial-cafe-right-window-upper-group-table' }),
      expect.objectContaining({ id: 'server', roleId: 'server', interactionTargetEntityId: 'commercial-cafe-counter' }),
    ]))
    expect(cafe.objects.some((entity) => entity.id === 'lao-zhou' || entity.id === 'server')).toBe(false)
    expect(mainlineSceneSlices['commercial-cafe'].actorIds).toEqual(['lao-zhou', 'server'])
  })

  it('anchors coffee to an existing table without creating collision or navigation data of its own', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const coffee = cafe.attachedProps.find((prop) => prop.id === 'commercial-cafe-coffee')
    const parentTable = cafe.objects.find((entity) => entity.id === coffee?.parentEntityId)
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)

    expect(coffee).toMatchObject({
      parentEntityId: 'commercial-cafe-right-window-upper-group-table',
      interactionTargetEntityId: 'commercial-cafe-right-window-upper-group-table',
    })
    expect(parentTable).toMatchObject({ kind: 'table', collision: expect.any(Object), approach: expect.any(Object) })
    expect(cafe.objects.some((entity) => entity.id === coffee?.id)).toBe(false)
    expect(snapshot.objects.has(coffee?.id ?? '')).toBe(false)
    expect(mainlineInteractionTarget(cafe, coffee?.id ?? '', cafe.initialPlayerPosition)).toEqual(cafe.initialPlayerPosition)
    expect(mainlineInteractionTarget(cafe, coffee?.interactionTargetEntityId ?? '', cafe.initialPlayerPosition)).toEqual(parentTable?.approach)
  })

  it('reveals coffee only after its delivered story stage while leaving existing cafe geometry intact', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const coffee = cafe.attachedProps.find((prop) => prop.id === 'commercial-cafe-coffee')
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)

    expect(isCommercialCafeStoryDetailVisible(coffee?.visibleFromStage, 'met-lao-zhou')).toBe(false)
    expect(isCommercialCafeStoryDetailVisible(coffee?.visibleFromStage, 'coffee-delivered')).toBe(true)
    expect(cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-window-upper-group-table')).toMatchObject({ kind: 'table' })
    expect(cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')).toMatchObject({ kind: 'fixture' })
    const counter = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')
    expect(counter).toMatchObject({ kind: 'fixture', interactionBehavior: 'cafe-order', collision: expect.any(Object), approach: expect.any(Object) })
    expect(mainlineInteractionTarget(cafe, 'commercial-cafe-counter', cafe.initialPlayerPosition)).toEqual(counter?.approach)
    expect(snapshot.objects.get('commercial-cafe-right-window-upper-group-table')?.collision).toBeDefined()
    expect(cafe.passages.find((passage) => passage.entityId === 'street-cafe-entry')).toMatchObject({ targetSceneId: 'commercial-street', access: 'open' })
  })
})
