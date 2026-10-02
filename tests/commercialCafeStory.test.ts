import { describe, expect, it } from 'vitest'
import {
  commercialCafeAnalyticsMilestonePatch,
  commercialCafeAnalyticsMilestonesFromSceneState,
  commercialCafeAnalyticsStageForCursor,
  commercialCafeBanknoteAttachedPropId,
  commercialCafeCoffeeAttachedPropId,
  commercialCafeCoffeeArrivedAtPrep,
  commercialCafeCoffeeDelivered,
  commercialCafeCoffeeOwnerNpcId,
  commercialCafeCoffeePreparationDurationMs,
  commercialCafeCoffeePreparationElapsed,
  commercialCafeCoffeePreparing,
  commercialCafeCoffeeReady,
  commercialCafeCoffeeStatusKey,
  commercialCafeCoffeeOrdered,
  commercialCafeCompletionPresenceMs,
  commercialCafeFinishCursorOne,
  commercialCafeFinishDeliveryBeat,
  commercialCafeFloorServerNpcId,
  commercialCafeLaoZhouCoffeeAttachedPropId,
  commercialCafeLaoZhouConversationSeatId,
  commercialCafeLaoZhouDepartureDue,
  commercialCafeLaoZhouIsPresent,
  commercialCafeMilkTeaAttachedPropId,
  commercialCafeNarrativeDialogue,
  commercialCafeNarrativePhaseKey,
  commercialCafePrepTargetId,
  commercialCafeStoryCompleted,
  commercialCafeStoryNeedsMigration,
  commercialCafeStoryReadyToLeave,
  commercialCafeStoryStateFromSceneState,
  commercialCafeStoryStatePatch,
  commercialCafeStoryWithCursor,
  commercialCafeVisibleAttachedPropIds,
  initialCommercialCafeStoryState,
  resolveCommercialCafeCoffeeDeliveryIntent,
  resolveCommercialCafeNpcInteraction,
  shouldCompleteCommercialCafeStoryOnTransition,
} from '../src/center/runtime/commercialCafeStory'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { npcRoles } from '../src/center/runtime/npcRoles'

describe('commercial café story contract', () => {
  it('uses exactly the approved fourteen dialogue ids, speakers, and text', () => {
    const expected = [
      ['commercial-cafe-lao-zhou-first-xiujie', '修杰', '陈副部长还是没有消息吗？'],
      ['commercial-cafe-lao-zhou-first-lao-zhou', '老周', '完全没有。'],
      ['commercial-cafe-coffee-xiujie', '修杰', '你还是不爱喝咖啡。'],
      ['commercial-cafe-coffee-lao-zhou', '老周', '是啊，我真喝不惯那玩意儿，而且上次喝完失眠了，我这把年纪了还是不要折腾比较好。'],
      ['commercial-cafe-intel-lao-zhou-document', '老周', '我昨天无意间看到了一份文件，不过我权限不够，只能看到一部分。'],
      ['commercial-cafe-intel-lao-zhou-camera', '老周', '说是在矿区附近的监控疑似拍到过陈副部长。不过没有照片，我也不能确定是不是真的。'],
      ['commercial-cafe-intel-xiujie-mine', '修杰', '矿区？'],
      ['commercial-cafe-intel-lao-zhou-mine', '老周', '对，按照陈副部长的生活工作范围来推测，不大可能会出现在那边。'],
      ['commercial-cafe-intel-xiujie-destination', '修杰', '整个矿区很大，能知道他去哪里了吗？'],
      ['commercial-cafe-intel-lao-zhou-eatery', '老周', '查不到去了哪里。不过我在那边有个线人，据说有人好像在永和小馆那块见过陈副部长。'],
      ['commercial-cafe-intel-xiujie-eatery', '修杰', '永和小馆？'],
      ['commercial-cafe-intel-lao-zhou-eatery-detail', '老周', '对，永和小馆，我也查过，一家苍蝇馆子，平常都是些工友在那里吃饭什么的，没什么很特别的地方。所以也只是有人貌似见过，并不能完全确定。'],
      ['commercial-cafe-resolution-xiujie', '修杰', '行，我知道了，有什么新信息再跟我说。'],
      ['commercial-cafe-resolution-lao-zhou', '老周', '好。'],
    ]
    expect(commercialCafeNarrativeDialogue.lines.map(({ id, speaker, text }) => [id, speaker, text])).toEqual(expected)
    expect(commercialCafeNarrativeDialogue.triggerEntityId).toBe('lao-zhou')
  })

  it('starts the narrative from a seat without requiring a coffee order', () => {
    const story = initialCommercialCafeStoryState()
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', story, playerSeatId: null })).toMatchObject({ kind: 'dialogue', promptSeatId: commercialCafeLaoZhouConversationSeatId })
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', story, playerSeatId: commercialCafeLaoZhouConversationSeatId })).toEqual({ kind: 'start-narrative' })
    expect(story.coffeeStatus).toBe('none')
  })

  it('keeps the two staff actors canonically distinct while presenting both as 店员', () => {
    const cafe = mainlineScenes['commercial-cafe']
    expect(commercialCafeCoffeeOwnerNpcId).not.toBe(commercialCafeFloorServerNpcId)
    expect(cafe.npcs.filter(({ id }) => [commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId].includes(id as never))).toHaveLength(2)
    expect(cafe.npcs.filter(({ id }) => [commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId].includes(id as never)).map(({ label }) => label)).toEqual(['店员', '店员'])
    expect(npcRoles.cafeCoffeeOwner.duties).toHaveProperty('prepare')
    expect(npcRoles.cafeCoffeeOwner.duties).toHaveProperty('deliverCoffee')
    expect(npcRoles.cafeCoffeeOwner.duties).not.toHaveProperty('tableService')
    expect(npcRoles.cafeFloorServer.duties).toHaveProperty('tableService')
    expect(npcRoles.cafeFloorServer.duties).not.toHaveProperty('prepare')
  })

  it('persists a single ordered → preparing → ready → delivered coffee status across reloads', () => {
    const order = commercialCafeCoffeeOrdered(initialCommercialCafeStoryState())
    expect(order.coffeeStatus).toBe('ordered')
    const preparing = commercialCafeCoffeePreparing(order, 20_000)
    expect(preparing).toMatchObject({ coffeeStatus: 'preparing', coffeePreparationStartedAt: 20_000 })
    expect(commercialCafeCoffeePreparationElapsed(preparing, 25_999)).toBe(false)
    expect(commercialCafeCoffeePreparationElapsed(preparing, 20_000 + commercialCafeCoffeePreparationDurationMs)).toBe(true)
    const persisted = commercialCafeStoryStatePatch(commercialCafeCoffeeReady(preparing))
    expect(persisted[commercialCafeCoffeeStatusKey]).toBe('ready')
    expect(commercialCafeStoryStateFromSceneState(persisted)).toMatchObject({ coffeeStatus: 'ready', coffeePreparationStartedAt: 20_000 })
    expect(commercialCafeCoffeeDelivered(commercialCafeStoryStateFromSceneState(persisted)).coffeeStatus).toBe('delivered')
  })

  it('keeps repeated orders idempotent and never clears or regresses existing coffee state', () => {
    const base = initialCommercialCafeStoryState()
    const ordered = commercialCafeCoffeeOrdered(base)
    const preparing = commercialCafeCoffeeArrivedAtPrep(ordered, 77_000)
    const ready = commercialCafeCoffeeReady(preparing)
    const delivered = commercialCafeCoffeeDelivered(ready)
    expect(commercialCafeCoffeeOrdered(preparing)).toEqual(preparing)
    expect(commercialCafeCoffeeOrdered(ready)).toEqual(ready)
    expect(commercialCafeCoffeeOrdered(delivered)).toEqual(delivered)
    expect(commercialCafeCoffeeReady(ordered)).toEqual(ordered)
  })

  it('starts the 6000 ms preparation clock only when the coffee owner arrives at prep', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const prep = cafe.npcBehaviorTargets?.find(({ id }) => id === commercialCafePrepTargetId)
    expect(prep).toBeDefined()
    const ordered = commercialCafeCoffeeOrdered(initialCommercialCafeStoryState())
    expect(ordered.coffeePreparationStartedAt).toBeNull()
    expect(commercialCafeCoffeePreparationElapsed(ordered, 999_999)).toBe(false)
    const arrival = commercialCafeCoffeeArrivedAtPrep(ordered, 123_456)
    expect(arrival).toMatchObject({ coffeeStatus: 'preparing', coffeePreparationStartedAt: 123_456 })
    expect(commercialCafeCoffeePreparationElapsed(arrival, 129_455)).toBe(false)
    expect(commercialCafeCoffeePreparationElapsed(arrival, 129_456)).toBe(true)
  })

  it('fast-forwards pending preparation in durable state at cursor 1 without coffee', () => {
    const result = commercialCafeFinishCursorOne(initialCommercialCafeStoryState())
    expect(result).toMatchObject({ narrativeCursor: 2, narrativePhase: 'dialogue', coffeeStatus: 'none' })
    expect(commercialCafeStoryStatePatch(result)).toMatchObject({ commercialCafeCoffeeStatus: 'none', [commercialCafeNarrativePhaseKey]: 'dialogue' })
  })

  it('uses exactly one optional cursor-1 delivery gate and resumes cursor 2 only after arrival', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const ready = commercialCafeFinishCursorOne(commercialCafeCoffeePreparing(commercialCafeCoffeeOrdered(initialCommercialCafeStoryState()), 1))
    expect(ready).toMatchObject({ narrativeCursor: 1, narrativePhase: 'coffee-delivery', coffeeStatus: 'ready' })
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeStatus: ready.coffeeStatus, narrativePhase: ready.narrativePhase })).toMatchObject({ dutyId: 'cafe-coffee-owner.deliver-coffee' })
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeStatus: 'ready', narrativePhase: 'dialogue' })).toBeNull()
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeStatus: 'ordered', narrativePhase: 'coffee-delivery' })).toBeNull()
    const delivered = commercialCafeCoffeeDelivered(ready)
    const resumed = commercialCafeFinishDeliveryBeat(delivered)
    expect(resumed).toMatchObject({ coffeeStatus: 'delivered', narrativeCursor: 2, narrativePhase: 'dialogue' })
    expect(commercialCafeStoryStatePatch(resumed)).toMatchObject({ commercialCafeCoffeeStatus: 'delivered', commercialCafeNarrativeCursor: 2 })
  })

  it('does not ready or deliver coffee before prep arrival when cursor 1 opens the gate early', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const ordered = commercialCafeCoffeeOrdered(initialCommercialCafeStoryState())
    const gate = commercialCafeFinishCursorOne(ordered)
    expect(gate).toMatchObject({ coffeeStatus: 'ordered', coffeePreparationStartedAt: null, narrativeCursor: 1, narrativePhase: 'coffee-delivery' })
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeStatus: gate.coffeeStatus, narrativePhase: gate.narrativePhase })).toBeNull()
    const actualArrival = commercialCafeCoffeeArrivedAtPrep(gate, 88_000)
    expect(actualArrival).toMatchObject({ coffeeStatus: 'ready', coffeePreparationStartedAt: 88_000, narrativePhase: 'coffee-delivery' })
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeStatus: actualArrival.coffeeStatus, narrativePhase: actualArrival.narrativePhase })).not.toBeNull()
    expect(commercialCafeCoffeeArrivedAtPrep(actualArrival, 99_000)).toEqual(actualArrival)
  })

  it('keeps story action independent of saved coffee preparation after reload', () => {
    const original = commercialCafeCoffeePreparing(commercialCafeCoffeeOrdered(initialCommercialCafeStoryState()), 5_000)
    const reloaded = commercialCafeStoryStateFromSceneState(commercialCafeStoryStatePatch(original))
    expect(reloaded).toMatchObject({ coffeeStatus: 'preparing', coffeePreparationStartedAt: 5_000 })
    expect(commercialCafeFinishCursorOne(reloaded)).toMatchObject({ coffeeStatus: 'ready', narrativeCursor: 1, narrativePhase: 'coffee-delivery' })
  })

  it('migrates a legacy save once, then clears all superseded Café save keys', () => {
    const legacy = commercialCafeStoryStateFromSceneState({ commercialCafeStoryStage: 'coffee-delivered', commercialCafeCoffeeOrdered: true, commercialCafeCoffeeDelivered: true })
    expect(legacy).toMatchObject({ narrativeCursor: 2, coffeeStatus: 'delivered' })
    const patch = commercialCafeStoryStatePatch(legacy)
    expect(patch).toMatchObject({ commercialCafeStoryStage: null, commercialCafeCoffeeOrdered: null, commercialCafeCoffeeDelivered: null })
    expect(commercialCafeStoryNeedsMigration(patch)).toBe(false)
    expect(commercialCafeStoryStateFromSceneState(patch)).toEqual(legacy)
  })

  it('marks only the original durable analytics cursors', () => {
    expect([0, 5, 9, 1, 2, 13].map(commercialCafeAnalyticsStageForCursor)).toEqual(['meeting-started', 'mine-lead', 'yonghe-lead', null, null, null])
    const started = commercialCafeAnalyticsMilestonePatch({}, 'meeting-started')
    const mineLead = commercialCafeAnalyticsMilestonePatch(started, 'mine-lead')
    expect(commercialCafeAnalyticsMilestonesFromSceneState(mineLead)).toEqual(new Set(['meeting-started', 'mine-lead']))
  })

  it('keeps attached props outside scene geometry and has no empty-cup prop', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
    expect(cafe.attachedProps.map(({ id }) => id)).not.toContain('commercial-cafe-empty-cup')
    cafe.attachedProps.forEach((prop) => {
      expect(prop.parentEntityId).toBe('commercial-cafe-right-window-upper-group-table')
      expect(snapshot.objects.has(prop.id)).toBe(false)
      expect(prop).not.toHaveProperty('offsetXPercent')
      expect(prop).not.toHaveProperty('offsetYPercent')
      expect(prop).not.toHaveProperty('interactive')
    })
  })

  it('shows only props backed by current story and inventory state', () => {
    const base = initialCommercialCafeStoryState()
    expect(commercialCafeVisibleAttachedPropIds({ story: base, carriedMilkTea: false, meetingActive: false })).toEqual(new Set([commercialCafeLaoZhouCoffeeAttachedPropId]))
    expect(commercialCafeVisibleAttachedPropIds({ story: base, carriedMilkTea: true, meetingActive: true })).toEqual(new Set([commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeMilkTeaAttachedPropId]))
    const delivered = { ...base, coffeeStatus: 'delivered' as const }
    expect(commercialCafeVisibleAttachedPropIds({ story: delivered, carriedMilkTea: false, meetingActive: false })).toEqual(new Set([commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeCoffeeAttachedPropId]))
    const ready = commercialCafeStoryReadyToLeave(delivered)
    expect(commercialCafeVisibleAttachedPropIds({ story: ready, carriedMilkTea: false, meetingActive: false })).toEqual(new Set([commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeCoffeeAttachedPropId, commercialCafeBanknoteAttachedPropId]))
    expect(commercialCafeVisibleAttachedPropIds({ story: commercialCafeStoryReadyToLeave(base), carriedMilkTea: false, meetingActive: false })).not.toContain(commercialCafeBanknoteAttachedPropId)
    expect(commercialCafeVisibleAttachedPropIds({ story: commercialCafeStoryCompleted(ready, 4), carriedMilkTea: true, meetingActive: true })).toEqual(new Set())
  })

  it('completes only on public departure and starts Lao Zhou’s five-minute presence clock', () => {
    const base = initialCommercialCafeStoryState()
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: 'commercial-cafe', story: base, targetSceneId: 'commercial-street' })).toBe(false)
    const ready = commercialCafeStoryReadyToLeave(base)
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: 'commercial-cafe', story: ready, targetSceneId: 'commercial-street' })).toBe(true)
    const complete = commercialCafeStoryCompleted(ready, 1_000)
    expect(complete).toMatchObject({ status: 'complete', completedAt: 1_000, laoZhouDeparture: 'seated' })
    expect(commercialCafeLaoZhouIsPresent(complete, 1_000 + commercialCafeCompletionPresenceMs)).toBe(true)
    expect(commercialCafeLaoZhouDepartureDue(complete, 1_000 + commercialCafeCompletionPresenceMs - 1)).toBe(false)
    expect(commercialCafeLaoZhouDepartureDue(complete, 1_000 + commercialCafeCompletionPresenceMs)).toBe(true)
  })
})
