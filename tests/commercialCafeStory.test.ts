import { describe, expect, it } from 'vitest'
import {
  advanceCommercialCafeStoryStage,
  commercialCafeCoffeeAttachedPropId,
  commercialCafeDepartureText,
  commercialCafeEmptyCupAttachedPropId,
  commercialCafeLaoZhouConversationSeatId,
  commercialCafeStoryStageFromSceneState,
  commercialCafeStoryStageKey,
  initialCommercialCafeStoryStage,
  isCommercialCafeStoryDetailVisible,
  resolveCommercialCafeCoffeeDeliveryIntent,
  resolveCommercialCafeAttachedPropInteraction,
  resolveCommercialCafeNpcInteraction,
  resolveCommercialCafeReturnToCounterIntent,
  shouldCompleteCommercialCafeStoryOnTransition,
} from '../src/center/runtime/commercialCafeStory'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, mainlineInteractionTarget, resolveMainlineNpcPosition, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineSceneSlices } from '../src/center/runtime/mainlineScenes'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { npcRoles } from '../src/center/runtime/npcRoles'
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
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'coffee-ordered' })).toEqual({
      kind: 'dialogue',
      dialogue: {
        triggerEntityId: 'lao-zhou',
        lines: [
          { id: 'commercial-cafe-lao-zhou-seat-guide', speaker: '老周', text: '你来了，坐吧。' },
        ],
      },
      promptSeatId: commercialCafeLaoZhouConversationSeatId,
    })

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

  it('keeps the seat guide separate from the formal exchange and does not advance the story', () => {
    const guide = resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'coffee-ordered' })
    const otherSeat = 'commercial-cafe-right-window-lower-group-chair-bottom'

    expect(guide).toMatchObject({ kind: 'dialogue', promptSeatId: commercialCafeLaoZhouConversationSeatId })
    expect(guide).not.toHaveProperty('stateChangeOnDialogueComplete')
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'coffee-ordered', playerSeatId: otherSeat })).toMatchObject({
      kind: 'dialogue',
      promptSeatId: commercialCafeLaoZhouConversationSeatId,
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

  it.each(['met-lao-zhou', 'coffee-delivered', 'ready-to-leave', 'complete'] as const)(
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
    const leftContact = mainlineInteractionTarget(cafe, coffee?.interactionTargetEntityId ?? '', {
      x: parentTable!.collision!.x - parentTable!.collision!.width,
      y: parentTable!.collision!.y + parentTable!.collision!.height * 2,
    })
    const rightContact = mainlineInteractionTarget(cafe, coffee?.interactionTargetEntityId ?? '', {
      x: parentTable!.collision!.x + parentTable!.collision!.width * 2,
      y: parentTable!.collision!.y + parentTable!.collision!.height * 2,
    })
    expect(leftContact).not.toEqual(rightContact)
    expect(isWalkableMainlinePoint(leftContact, cafe)).toBe(true)
    expect(isWalkableMainlinePoint(rightContact, cafe)).toBe(true)
    expect(findMainlinePathToEntity(cafe, coffee!.interactionTargetEntityId, cafe.initialPlayerPosition).path).not.toBeNull()
    const interactionRuntime = createNavigationRuntime()
    interactionRuntime.registerActor('protagonist', cafe.initialPlayerPosition)
    interactionRuntime.registerActor('lao-zhou', resolveMainlineNpcPosition(cafe, 'lao-zhou'))
    interactionRuntime.registerActor('server', resolveMainlineNpcPosition(cafe, 'server'))
    expect(findMainlinePathToEntity(cafe, coffee!.interactionTargetEntityId, cafe.initialPlayerPosition, {}, {
      navigationRuntime: interactionRuntime,
      actorId: 'protagonist',
    }).path).not.toBeNull()
  })

  it('reveals coffee only after its delivered story stage while leaving existing cafe geometry intact', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const coffee = cafe.attachedProps.find((prop) => prop.id === 'commercial-cafe-coffee')
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)

    expect(isCommercialCafeStoryDetailVisible(coffee?.visibleFromStage, 'met-lao-zhou', coffee?.hiddenFromStage)).toBe(false)
    expect(isCommercialCafeStoryDetailVisible(coffee?.visibleFromStage, 'coffee-delivered', coffee?.hiddenFromStage)).toBe(true)
    expect(isCommercialCafeStoryDetailVisible(coffee?.visibleFromStage, 'ready-to-leave', coffee?.hiddenFromStage)).toBe(false)
    expect(cafe.attachedProps.find((prop) => prop.id === commercialCafeEmptyCupAttachedPropId)).toMatchObject({ visibleFromStage: 'ready-to-leave' })
    expect(cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-window-upper-group-table')).toMatchObject({ kind: 'table' })
    expect(cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')).toMatchObject({ kind: 'fixture' })
    const counter = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')
    expect(counter).toMatchObject({ kind: 'fixture', interactionBehavior: 'cafe-order', collision: expect.any(Object), approach: expect.any(Object) })
    expect(mainlineInteractionTarget(cafe, 'commercial-cafe-counter', cafe.initialPlayerPosition)).toEqual(expect.objectContaining({ y: expect.any(Number) }))
    expect(snapshot.objects.get('commercial-cafe-right-window-upper-group-table')?.collision).toBeDefined()
    expect(cafe.passages.find((passage) => passage.entityId === 'street-cafe-entry')).toMatchObject({ targetSceneId: 'commercial-street', access: 'open' })
  })

  it('derives delivery from coffee\'s parent table and the existing shared contact point', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const coffee = cafe.attachedProps.find((prop) => prop.id === commercialCafeCoffeeAttachedPropId)!
    const runtime = createNavigationRuntime()
    const serverHome = resolveMainlineNpcPosition(cafe, npcRoles.server.id)
    runtime.registerActor('protagonist', resolveMainlineSeatSitPosition(cafe, commercialCafeLaoZhouConversationSeatId)!)
    runtime.registerActor(npcRoles.laoZhou.id, resolveMainlineNpcPosition(cafe, npcRoles.laoZhou.id))
    runtime.registerActor(npcRoles.server.id, serverHome)
    const navigationOptions = {
      navigationRuntime: runtime,
      screenMetrics: defaultSceneScreenMetrics,
      geometrySnapshot: createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition, {}, defaultSceneScreenMetrics),
    }

    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, stage: 'coffee-ordered', from: serverHome, navigationOptions })).toBeNull()
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, stage: 'coffee-delivered', from: serverHome, navigationOptions })).toBeNull()
    const intent = resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, stage: 'met-lao-zhou', from: serverHome, navigationOptions })
    const { navigationRuntime: _navigationRuntime, ...staticNavigationOptions } = navigationOptions
    const deliveryContact = findMainlinePathToEntity(cafe, coffee.parentEntityId, serverHome, {}, { ...staticNavigationOptions, actorId: npcRoles.server.id })

    expect(intent).toEqual({
      dutyId: npcRoles.server.duties.deliverCoffee.id,
      targetId: coffee.parentEntityId,
      target: deliveryContact.target,
    })
    expect(intent && isWalkableMainlinePoint(intent.target, cafe, {}, { ...staticNavigationOptions, actorId: npcRoles.server.id })).toBe(true)
    const path = intent && findMainlinePath(serverHome, intent.target, cafe, {}, { ...navigationOptions, actorId: npcRoles.server.id })
    expect(intent?.target).not.toEqual(serverHome)
    expect(path).not.toBeNull()
    expect(path?.length).toBeGreaterThan(1)
    expect(resolveCommercialCafeReturnToCounterIntent(cafe)).toEqual({
      dutyId: npcRoles.server.duties.returnToCounter.id,
      targetId: 'commercial-cafe-counter-service',
      target: serverHome,
    })
  })

  it('keeps a semantic delivery duty available when a live actor blocks its route', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const runtime = createNavigationRuntime()
    const serverHome = resolveMainlineNpcPosition(cafe, npcRoles.server.id)
    const coffeeTable = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-window-upper-group-table')!
    runtime.registerActor('e2e-blocker', coffeeTable.position, 15)

    const intent = resolveCommercialCafeCoffeeDeliveryIntent({
      scene: cafe,
      stage: 'met-lao-zhou',
      from: serverHome,
      navigationOptions: { navigationRuntime: runtime },
    })

    expect(intent).toMatchObject({ dutyId: npcRoles.server.duties.deliverCoffee.id, targetId: coffeeTable.id })
    expect(findMainlinePath(serverHome, intent!.target, cafe, {}, { navigationRuntime: runtime, actorId: npcRoles.server.id })).toBeNull()
  })

  it('uses the attached coffee and Lao Zhou resolutions to complete the authored information and departure beats', () => {
    const coffee = resolveCommercialCafeAttachedPropInteraction({ sceneId: 'commercial-cafe', propId: commercialCafeCoffeeAttachedPropId, stage: 'coffee-delivered' })
    expect(coffee).toMatchObject({ kind: 'dialogue', stateChangeOnDialogueComplete: { value: 'intel-received' } })
    expect(coffee?.kind === 'dialogue' && coffee.dialogue.lines.map((line) => line.text)).toEqual(expect.arrayContaining([
      '你还是不爱喝咖啡。',
      '矿区外围？',
      '永和小馆？',
    ]))
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', stage: 'intel-received' })).toMatchObject({
      kind: 'dialogue', stateChangeOnDialogueComplete: { value: 'ready-to-leave' },
    })
  })

  it('writes complete only when the resolved cafe story actually crosses back to commercial street', () => {
    expect(commercialCafeDepartureText).toBe('修杰离开，老周看向窗外。')
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: 'commercial-cafe', stage: 'ready-to-leave', targetSceneId: 'commercial-street' })).toBe(true)
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: 'commercial-cafe', stage: 'ready-to-leave', targetSceneId: 'yonghe-mining-perimeter' })).toBe(false)
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: 'commercial-cafe', stage: 'intel-received', targetSceneId: 'commercial-street' })).toBe(false)
  })
})
