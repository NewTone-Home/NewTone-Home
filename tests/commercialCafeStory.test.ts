import { describe, expect, it } from 'vitest'
import {
  commercialCafeBanknoteAttachedPropId,
  commercialCafeAnalyticsStageForCursor,
  commercialCafeCoffeeAttachedPropId,
  commercialCafeCompletionPresenceMs,
  commercialCafeLaoZhouCoffeeAttachedPropId,
  commercialCafeLaoZhouConversationSeatId,
  commercialCafeLaoZhouIsPresent,
  commercialCafeMilkTeaAttachedPropId,
  commercialCafeNarrativeDialogue,
  commercialCafeStoryCompleted,
  commercialCafeStoryReadyToLeave,
  commercialCafeStoryStateFromSceneState,
  commercialCafeStoryStatePatch,
  commercialCafeStoryWithCursor,
  commercialCafeVisibleAttachedPropIds,
  resolveCommercialCafeCoffeeDeliveryIntent,
  resolveCommercialCafeNpcInteraction,
  shouldCompleteCommercialCafeStoryOnTransition,
} from '../src/center/runtime/commercialCafeStory'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

describe('commercial cafe narrative state', () => {
  it.each([
    ['entered', { status: 'available', narrativeCursor: 0, coffeeOrdered: false, coffeeDelivered: false }],
    ['coffee-ordered', { status: 'available', narrativeCursor: 0, coffeeOrdered: true, coffeeDelivered: false }],
    ['met-lao-zhou', { status: 'available', narrativeCursor: 2, coffeeOrdered: true, coffeeDelivered: false }],
    ['coffee-delivered', { status: 'available', narrativeCursor: 2, coffeeOrdered: true, coffeeDelivered: true }],
    ['intel-received', { status: 'available', narrativeCursor: 12, coffeeOrdered: true, coffeeDelivered: true }],
    ['ready-to-leave', { status: 'ready-to-leave', narrativeCursor: commercialCafeNarrativeDialogue.lines.length, coffeeOrdered: true, coffeeDelivered: false }],
    ['complete', { status: 'complete', narrativeCursor: commercialCafeNarrativeDialogue.lines.length, coffeeOrdered: false, coffeeDelivered: false }],
  ] as const)('maps legacy %s saves to a safe new narrative state', (stage, expected) => {
    expect(commercialCafeStoryStateFromSceneState({ commercialCafeStoryStage: stage })).toMatchObject(expected)
  })

  it('keeps new state authoritative after migration while leaving the old stage untouched', () => {
    const migrated = commercialCafeStoryStateFromSceneState({ commercialCafeStoryStage: 'coffee-delivered' })
    const restored = commercialCafeStoryStateFromSceneState({ commercialCafeStoryStage: 'entered', ...commercialCafeStoryStatePatch(commercialCafeStoryWithCursor(migrated, 7)) })
    expect(restored).toMatchObject({ status: 'available', narrativeCursor: 7, coffeeOrdered: true, coffeeDelivered: true })
  })

  it('starts the narrative from a seat without requiring coffee', () => {
    const story = commercialCafeStoryStateFromSceneState(undefined)
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', story, playerSeatId: null })).toMatchObject({ kind: 'dialogue', promptSeatId: commercialCafeLaoZhouConversationSeatId })
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', story, playerSeatId: commercialCafeLaoZhouConversationSeatId })).toEqual({ kind: 'start-narrative' })
  })

  it('returns no legacy map-feedback resolution after the meeting is ready to leave or complete', () => {
    const ready = commercialCafeStoryReadyToLeave(commercialCafeStoryStateFromSceneState(undefined))
    const complete = commercialCafeStoryCompleted(ready, 1_000)
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', story: ready, playerSeatId: commercialCafeLaoZhouConversationSeatId })).toBeNull()
    expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-cafe', npcId: 'lao-zhou', story: complete, playerSeatId: commercialCafeLaoZhouConversationSeatId, now: 1_001 })).toBeNull()
  })

  it('keeps the approved independent, unconfirmed mine and Yonghe leads in the narrative', () => {
    const text = commercialCafeNarrativeDialogue.lines.map((line) => line.text).join('\n')
    expect(text).toContain('矿区外围的摄像头疑似拍到过几次陈副部长的身影')
    expect(text).toContain('有人在那边好像见过陈副部长几次')
    expect(text).toContain('我也不能确定是不是真的')
    expect(text).toContain('你还是不爱喝咖啡。')
  })

  it('marks only durable Café narrative milestones for analytics', () => {
    expect(commercialCafeAnalyticsStageForCursor(0)).toBe('meeting-started')
    expect(commercialCafeAnalyticsStageForCursor(5)).toBe('mine-lead')
    expect(commercialCafeAnalyticsStageForCursor(9)).toBe('yonghe-lead')
    expect(commercialCafeAnalyticsStageForCursor(1)).toBeNull()
  })

  it('keeps optional coffee delivery independent from narrative cursor', () => {
    const cafe = mainlineScenes['commercial-cafe']
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeOrdered: false, coffeeDelivered: false })).toBeNull()
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeOrdered: true, coffeeDelivered: false })).toMatchObject({ dutyId: 'server.deliver-coffee' })
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: cafe, coffeeOrdered: true, coffeeDelivered: true })).toBeNull()
  })

  it('keeps all café table icons visual-only and outside geometry', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const propIds = [commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeCoffeeAttachedPropId, commercialCafeMilkTeaAttachedPropId, commercialCafeBanknoteAttachedPropId]
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
    propIds.forEach((id) => {
      expect(cafe.attachedProps.find((prop) => prop.id === id)).toMatchObject({ interactive: false, parentEntityId: 'commercial-cafe-right-window-upper-group-table' })
      expect(snapshot.objects.has(id)).toBe(false)
    })
  })

  it('shows only the intended small table props for meeting and ready-to-leave states', () => {
    const base = commercialCafeStoryStateFromSceneState(undefined)
    expect(commercialCafeVisibleAttachedPropIds({ story: base, carriedMilkTea: false, meetingActive: false })).toEqual(new Set([commercialCafeLaoZhouCoffeeAttachedPropId]))
    const withCoffeeAndTea = { ...base, coffeeDelivered: true }
    expect(commercialCafeVisibleAttachedPropIds({ story: withCoffeeAndTea, carriedMilkTea: true, meetingActive: true })).toEqual(new Set([commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeCoffeeAttachedPropId, commercialCafeMilkTeaAttachedPropId]))
    expect(commercialCafeVisibleAttachedPropIds({ story: commercialCafeStoryReadyToLeave(withCoffeeAndTea), carriedMilkTea: false, meetingActive: false })).toEqual(new Set([commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeCoffeeAttachedPropId, commercialCafeBanknoteAttachedPropId]))
  })

  it('completes only on public departure after ready-to-leave and persists a timestamp', () => {
    const base = commercialCafeStoryStateFromSceneState(undefined)
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: 'commercial-cafe', story: base, targetSceneId: 'commercial-street' })).toBe(false)
    const ready = commercialCafeStoryReadyToLeave(base)
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: 'commercial-cafe', story: ready, targetSceneId: 'commercial-street' })).toBe(true)
    const complete = commercialCafeStoryCompleted(ready, 1_000)
    expect(complete).toMatchObject({ status: 'complete', completedAt: 1_000 })
  })

  it('keeps Lao Zhou for five minutes after complete, then removes him without a runtime timer', () => {
    const complete = commercialCafeStoryCompleted(commercialCafeStoryReadyToLeave(commercialCafeStoryStateFromSceneState(undefined)), 1_000)
    expect(commercialCafeLaoZhouIsPresent(complete, 1_000 + commercialCafeCompletionPresenceMs - 1)).toBe(true)
    expect(commercialCafeLaoZhouIsPresent(complete, 1_000 + commercialCafeCompletionPresenceMs)).toBe(false)
  })
})
