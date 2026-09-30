import type { PlayerSceneState } from './playerSave'
import type { MainlineSceneDialoguePresentation, MainlineSceneId } from './mainlineSceneModel'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { NpcIntent } from './npcCore'
import { npcRoles } from './npcRoles'
import { mainlineNpcStagedPoint } from './mainlineNpcStaging'

/** The former stage is retained as a migration input only. New Café play never writes or branches on it. */
export const commercialCafeStoryStageKey = 'commercialCafeStoryStage'
export const commercialCafeStoryStages = ['entered', 'coffee-ordered', 'met-lao-zhou', 'coffee-delivered', 'intel-received', 'ready-to-leave', 'complete'] as const
export type CommercialCafeStoryStage = typeof commercialCafeStoryStages[number]
export const initialCommercialCafeStoryStage: CommercialCafeStoryStage = 'entered'

export const commercialCafeNarrativeCursorKey = 'commercialCafeNarrativeCursor'
export const commercialCafeStoryStatusKey = 'commercialCafeStoryStatus'
export const commercialCafeCoffeeOrderedKey = 'commercialCafeCoffeeOrdered'
export const commercialCafeCoffeeDeliveredKey = 'commercialCafeCoffeeDelivered'
export const commercialCafeCompletedAtKey = 'commercialCafeCompletedAt'
export const commercialCafeCompletionPresenceMs = 5 * 60 * 1000
export type CommercialCafeStoryStatus = 'available' | 'ready-to-leave' | 'complete'
export type CommercialCafeStoryState = { status: CommercialCafeStoryStatus; narrativeCursor: number; coffeeOrdered: boolean; coffeeDelivered: boolean; completedAt: number | null }

export const commercialCafeLaoZhouConversationSeatId = 'commercial-cafe-right-window-upper-group-chair-bottom'
export const commercialCafeCoffeeAttachedPropId = 'commercial-cafe-xiujie-coffee'
export const commercialCafeLaoZhouCoffeeAttachedPropId = 'commercial-cafe-lao-zhou-coffee'
export const commercialCafeMilkTeaAttachedPropId = 'commercial-cafe-xiujie-milk-tea'
export const commercialCafeBanknoteAttachedPropId = 'commercial-cafe-banknote'
export const commercialCafeDepartureText = '修杰离开，老周看向窗外。'

export function isCommercialCafeStoryStage(value: unknown): value is CommercialCafeStoryStage {
  return typeof value === 'string' && commercialCafeStoryStages.includes(value as CommercialCafeStoryStage)
}

export function commercialCafeStoryStageFromSceneState(sceneState: PlayerSceneState | undefined): CommercialCafeStoryStage {
  const value = sceneState?.[commercialCafeStoryStageKey]
  return isCommercialCafeStoryStage(value) ? value : initialCommercialCafeStoryStage
}

export function advanceCommercialCafeStoryStage(stage: CommercialCafeStoryStage): CommercialCafeStoryStage {
  const nextIndex = commercialCafeStoryStages.indexOf(stage) + 1
  return commercialCafeStoryStages[nextIndex] ?? stage
}

export const commercialCafeNarrativeDialogue = {
  triggerEntityId: 'lao-zhou',
  lines: [
    { id: 'commercial-cafe-lao-zhou-first-xiujie', speaker: '修杰', text: '老周，陈副部长还是没有消息吗？' },
    { id: 'commercial-cafe-lao-zhou-first-lao-zhou', speaker: '老周', text: '完全没有。' },
    { id: 'commercial-cafe-coffee-xiujie', speaker: '修杰', text: '你还是不爱喝咖啡。' },
    { id: 'commercial-cafe-coffee-lao-zhou', speaker: '老周', text: '是啊，我真喝不惯那玩意儿，而且上次喝完失眠了，我这把年纪了还是不要折腾比较好。' },
    { id: 'commercial-cafe-intel-lao-zhou-document', speaker: '老周', text: '我昨天无意间看到了一份文档，不过我的权限不足，无法完整地看到内容。' },
    { id: 'commercial-cafe-intel-lao-zhou-camera', speaker: '老周', text: '不过我能看到一些大概，因为这个档案并不是结论，而是调查报告，说是在矿区外围的摄像头疑似拍到过几次陈副部长的身影。不过我没法看到照片，我也不能确定是不是真的。' },
    { id: 'commercial-cafe-intel-xiujie-mine', speaker: '修杰', text: '矿区外围？' },
    { id: 'commercial-cafe-intel-lao-zhou-mine', speaker: '老周', text: '对，矿区外围，依照陈副部长的职责和日常活动范围，陈副部长不太可能出现在那边。' },
    { id: 'commercial-cafe-intel-xiujie-destination', speaker: '修杰', text: '整个矿区很大，能知道目的地吗？' },
    { id: 'commercial-cafe-intel-lao-zhou-eatery', speaker: '老周', text: '不能。不过我在那边有个线人，得到的情报是一家叫永和小馆的苍蝇馆子，有人在那边好像见过陈副部长几次。' },
    { id: 'commercial-cafe-intel-xiujie-eatery', speaker: '修杰', text: '永和小馆？' },
    { id: 'commercial-cafe-intel-lao-zhou-eatery-detail', speaker: '老周', text: '对，永和小馆，我也查过，这是一家小饭馆，平常都是服务于矿区里面的工友，开了也有些年头了。这种小地方信息量太少了，我也只是打听才知道的。' },
    { id: 'commercial-cafe-resolution-xiujie', speaker: '修杰', text: '行，我知道了，有什么新信息再跟我说，继续帮我跟踪一下这件事儿。' },
    { id: 'commercial-cafe-resolution-lao-zhou', speaker: '老周', text: '好。' },
  ],
} as const satisfies MainlineSceneDialoguePresentation

/** Only durable story beats are analytics-worthy; punctuation segments are not. */
export function commercialCafeAnalyticsStageForCursor(cursor: number) {
  if (cursor === 0) return 'meeting-started' as const
  if (cursor === 5) return 'mine-lead' as const
  if (cursor === 9) return 'yonghe-lead' as const
  return null
}

export const commercialCafeSeatGuideDialogue = {
  triggerEntityId: 'lao-zhou',
  lines: [{ id: 'commercial-cafe-lao-zhou-seat-guide', speaker: '老周', text: '你来了，坐吧。' }],
} as const satisfies MainlineSceneDialoguePresentation

const legacyCursorByStage: Record<CommercialCafeStoryStage, number> = {
  entered: 0, 'coffee-ordered': 0, 'met-lao-zhou': 2, 'coffee-delivered': 2, 'intel-received': 12,
  'ready-to-leave': commercialCafeNarrativeDialogue.lines.length, complete: commercialCafeNarrativeDialogue.lines.length,
}
function isStoryStatus(value: unknown): value is CommercialCafeStoryStatus { return value === 'available' || value === 'ready-to-leave' || value === 'complete' }
function validCursor(value: unknown) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= commercialCafeNarrativeDialogue.lines.length }

export function commercialCafeStoryStateFromSceneState(sceneState: PlayerSceneState | undefined): CommercialCafeStoryState {
  const legacyStage = commercialCafeStoryStageFromSceneState(sceneState)
  const status = isStoryStatus(sceneState?.[commercialCafeStoryStatusKey]) ? sceneState![commercialCafeStoryStatusKey] as CommercialCafeStoryStatus : legacyStage === 'ready-to-leave' ? 'ready-to-leave' : legacyStage === 'complete' ? 'complete' : 'available'
  const narrativeCursor = validCursor(sceneState?.[commercialCafeNarrativeCursorKey]) ? sceneState![commercialCafeNarrativeCursorKey] as number : legacyCursorByStage[legacyStage]
  const coffeeOrdered = sceneState?.[commercialCafeCoffeeOrderedKey] === true || ['coffee-ordered', 'met-lao-zhou', 'coffee-delivered', 'intel-received', 'ready-to-leave'].includes(legacyStage)
  const coffeeDelivered = sceneState?.[commercialCafeCoffeeDeliveredKey] === true || legacyStage === 'coffee-delivered' || legacyStage === 'intel-received'
  const completedAt = typeof sceneState?.[commercialCafeCompletedAtKey] === 'number' ? sceneState![commercialCafeCompletedAtKey] as number : status === 'complete' ? 0 : null
  return { status, narrativeCursor: status === 'ready-to-leave' || status === 'complete' ? commercialCafeNarrativeDialogue.lines.length : narrativeCursor, coffeeOrdered, coffeeDelivered, completedAt }
}

export function commercialCafeStoryStatePatch(state: CommercialCafeStoryState) {
  return { [commercialCafeStoryStatusKey]: state.status, [commercialCafeNarrativeCursorKey]: state.narrativeCursor, [commercialCafeCoffeeOrderedKey]: state.coffeeOrdered, [commercialCafeCoffeeDeliveredKey]: state.coffeeDelivered, [commercialCafeCompletedAtKey]: state.completedAt }
}
export function commercialCafeStoryNeedsMigration(sceneState: PlayerSceneState | undefined) {
  return !isStoryStatus(sceneState?.[commercialCafeStoryStatusKey]) || !validCursor(sceneState?.[commercialCafeNarrativeCursorKey]) || typeof sceneState?.[commercialCafeCoffeeOrderedKey] !== 'boolean' || typeof sceneState?.[commercialCafeCoffeeDeliveredKey] !== 'boolean' || !(typeof sceneState?.[commercialCafeCompletedAtKey] === 'number' || sceneState?.[commercialCafeCompletedAtKey] === null)
}
export function commercialCafeStoryWithCursor(story: CommercialCafeStoryState, narrativeCursor: number): CommercialCafeStoryState { return { ...story, narrativeCursor: Math.max(0, Math.min(commercialCafeNarrativeDialogue.lines.length, narrativeCursor)) } }
export function commercialCafeStoryReadyToLeave(story: CommercialCafeStoryState): CommercialCafeStoryState { return { ...story, status: 'ready-to-leave', narrativeCursor: commercialCafeNarrativeDialogue.lines.length } }
export function commercialCafeStoryCompleted(story: CommercialCafeStoryState, now: number): CommercialCafeStoryState { return { ...story, status: 'complete', narrativeCursor: commercialCafeNarrativeDialogue.lines.length, completedAt: now } }
export function commercialCafeLaoZhouIsPresent(story: CommercialCafeStoryState, now: number) { return story.status !== 'complete' || (story.completedAt !== null && story.completedAt > 0 && now - story.completedAt < commercialCafeCompletionPresenceMs) }
export function shouldCompleteCommercialCafeStoryOnTransition({ sceneId, story, targetSceneId }: { sceneId: string; story: CommercialCafeStoryState; targetSceneId?: string }) { return sceneId === 'commercial-cafe' && story.status === 'ready-to-leave' && targetSceneId === 'commercial-street' }
export function commercialCafeVisibleAttachedPropIds({ story, carriedMilkTea, meetingActive }: { story: CommercialCafeStoryState; carriedMilkTea: boolean; meetingActive: boolean }) {
  if (story.status === 'complete') return new Set<string>()
  const visible = new Set<string>([commercialCafeLaoZhouCoffeeAttachedPropId])
  if (story.coffeeDelivered) visible.add(commercialCafeCoffeeAttachedPropId)
  if (carriedMilkTea && meetingActive) visible.add(commercialCafeMilkTeaAttachedPropId)
  if (story.status === 'ready-to-leave') visible.add(commercialCafeBanknoteAttachedPropId)
  return visible
}

export function resolveCommercialCafeCoffeeDeliveryIntent({ scene, coffeeOrdered, coffeeDelivered }: { scene: MainlineSceneDefinition; coffeeOrdered: boolean; coffeeDelivered: boolean }): NpcIntent | null {
  if (scene.id !== 'commercial-cafe' || !coffeeOrdered || coffeeDelivered) return null
  const coffee = scene.attachedProps.find((prop) => prop.id === commercialCafeCoffeeAttachedPropId)
  return coffee ? { dutyId: npcRoles.server.duties.deliverCoffee.id, targetId: coffee.parentEntityId, targetEntityId: coffee.parentEntityId } : null
}
export function resolveCommercialCafeReturnToCounterIntent(scene: MainlineSceneDefinition): NpcIntent | null {
  if (scene.id !== 'commercial-cafe') return null
  const target = mainlineNpcStagedPoint(scene, npcRoles.server.id)
  return target ? { dutyId: npcRoles.server.duties.returnToCounter.id, targetId: 'commercial-cafe-counter-service', target } : null
}

export type CommercialCafeNpcInteractionResolution = { kind: 'dialogue'; dialogue: MainlineSceneDialoguePresentation; promptSeatId?: string } | { kind: 'start-narrative' } | { kind: 'feedback'; feedback: string }
export function resolveCommercialCafeNpcInteraction({ sceneId, npcId, story, playerSeatId, now = Date.now() }: { sceneId: MainlineSceneId; npcId: string; story: CommercialCafeStoryState; playerSeatId?: string | null; now?: number }): CommercialCafeNpcInteractionResolution | null {
  if (sceneId !== 'commercial-cafe' || npcId !== 'lao-zhou') return null
  if (story.status === 'complete') return commercialCafeLaoZhouIsPresent(story, now) ? { kind: 'feedback', feedback: '老周还坐在窗边。' } : null
  if (story.status === 'ready-to-leave') return { kind: 'feedback', feedback: '该走了。' }
  if (playerSeatId !== commercialCafeLaoZhouConversationSeatId) return { kind: 'dialogue', dialogue: commercialCafeSeatGuideDialogue, promptSeatId: commercialCafeLaoZhouConversationSeatId }
  return { kind: 'start-narrative' }
}
