import type { PlayerSceneState } from './playerSave'
import type { MainlineSceneDialoguePresentation, MainlineSceneId } from './mainlineSceneModel'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { NpcIntent } from './npcCore'
import { npcRoles } from './npcRoles'
import { mainlineNpcStagedPoint } from './mainlineNpcStaging'

/** Read only when migrating old saves. New Café play never writes this stage. */
export const commercialCafeStoryStageKey = 'commercialCafeStoryStage'
export const commercialCafeStoryStages = ['entered', 'coffee-ordered', 'met-lao-zhou', 'coffee-delivered', 'intel-received', 'ready-to-leave', 'complete'] as const
export type CommercialCafeStoryStage = typeof commercialCafeStoryStages[number]
export const initialCommercialCafeStoryStage: CommercialCafeStoryStage = 'entered'

export const commercialCafeNarrativeCursorKey = 'commercialCafeNarrativeCursor'
export const commercialCafeStoryStatusKey = 'commercialCafeStoryStatus'
export const commercialCafeCoffeeStatusKey = 'commercialCafeCoffeeStatus'
export const commercialCafeCoffeePreparationStartedAtKey = 'commercialCafeCoffeePreparationStartedAt'
export const commercialCafeNarrativePhaseKey = 'commercialCafeNarrativePhase'
export const commercialCafeLaoZhouDepartureKey = 'commercialCafeLaoZhouDeparture'
export const commercialCafeCompletedAtKey = 'commercialCafeCompletedAt'
export const commercialCafeAnalyticsMilestonesKey = 'commercialCafeAnalyticsMilestones'
export const commercialCafeCompletionPresenceMs = 5 * 60 * 1000
export const commercialCafeCoffeePreparationDurationMs = 6000

// These keys are migration inputs only. Patches clear them after translating
// the former booleans into the one persisted coffee status.
const legacyCommercialCafeCoffeeOrderedKey = 'commercialCafeCoffeeOrdered'
const legacyCommercialCafeCoffeeDeliveredKey = 'commercialCafeCoffeeDelivered'

export type CommercialCafeStoryStatus = 'available' | 'ready-to-leave' | 'complete'
export type CommercialCafeCoffeeStatus = 'none' | 'ordered' | 'preparing' | 'ready' | 'delivered'
export type CommercialCafeNarrativePhase = 'not-started' | 'dialogue' | 'coffee-delivery' | 'complete'
export type CommercialCafeLaoZhouDeparture = 'seated' | 'walking-out' | 'departed'
export type CommercialCafeStoryState = {
  status: CommercialCafeStoryStatus
  narrativeCursor: number
  coffeeStatus: CommercialCafeCoffeeStatus
  coffeePreparationStartedAt: number | null
  narrativePhase: CommercialCafeNarrativePhase
  laoZhouDeparture: CommercialCafeLaoZhouDeparture
  completedAt: number | null
}

export const commercialCafeLaoZhouConversationSeatId = 'commercial-cafe-right-window-upper-group-chair-bottom'
export const commercialCafeDepartureText = '修杰离开，老周看向窗外。'
export const commercialCafeCoffeeOwnerNpcId = 'cafe-coffee-owner'
export const commercialCafeFloorServerNpcId = 'cafe-floor-server'
export const commercialCafeStoryTableId = 'commercial-cafe-right-window-upper-group-table'
export const commercialCafeCounterTargetId = 'commercial-cafe-counter-service'
export const commercialCafePrepTargetId = 'commercial-cafe-prep-station'

export function isCommercialCafeStoryStage(value: unknown): value is CommercialCafeStoryStage {
  return typeof value === 'string' && commercialCafeStoryStages.includes(value as CommercialCafeStoryStage)
}

function legacyStoryStage(sceneState: PlayerSceneState | undefined): CommercialCafeStoryStage {
  const value = sceneState?.[commercialCafeStoryStageKey]
  return isCommercialCafeStoryStage(value) ? value : initialCommercialCafeStoryStage
}

export const commercialCafeNarrativeDialogue = {
  triggerEntityId: 'lao-zhou',
  lines: [
    { id: 'commercial-cafe-lao-zhou-first-xiujie', speaker: '修杰', text: '陈副部长还是没有消息吗？' },
    { id: 'commercial-cafe-lao-zhou-first-lao-zhou', speaker: '老周', text: '完全没有。' },
    { id: 'commercial-cafe-coffee-xiujie', speaker: '修杰', text: '你还是不爱喝咖啡。' },
    { id: 'commercial-cafe-coffee-lao-zhou', speaker: '老周', text: '是啊，我真喝不惯那玩意儿，而且上次喝完失眠了，我这把年纪了还是不要折腾比较好。' },
    { id: 'commercial-cafe-intel-lao-zhou-document', speaker: '老周', text: '我昨天无意间看到了一份文件，不过我权限不够，只能看到一部分。' },
    { id: 'commercial-cafe-intel-lao-zhou-camera', speaker: '老周', text: '说是在矿区附近的监控疑似拍到过陈副部长。不过没有照片，我也不能确定是不是真的。' },
    { id: 'commercial-cafe-intel-xiujie-mine', speaker: '修杰', text: '矿区？' },
    { id: 'commercial-cafe-intel-lao-zhou-mine', speaker: '老周', text: '对，按照陈副部长的生活工作范围来推测，不大可能会出现在那边。' },
    { id: 'commercial-cafe-intel-xiujie-destination', speaker: '修杰', text: '整个矿区很大，能知道他去哪里了吗？' },
    { id: 'commercial-cafe-intel-lao-zhou-eatery', speaker: '老周', text: '查不到去了哪里。不过我在那边有个线人，据说有人好像在永和小馆那块见过陈副部长。' },
    { id: 'commercial-cafe-intel-xiujie-eatery', speaker: '修杰', text: '永和小馆？' },
    { id: 'commercial-cafe-intel-lao-zhou-eatery-detail', speaker: '老周', text: '对，永和小馆，我也查过，一家苍蝇馆子，平常都是些工友在那里吃饭什么的，没什么很特别的地方。所以也只是有人貌似见过，并不能完全确定。' },
    { id: 'commercial-cafe-resolution-xiujie', speaker: '修杰', text: '行，我知道了，有什么新信息再跟我说。' },
    { id: 'commercial-cafe-resolution-lao-zhou', speaker: '老周', text: '好。' },
  ],
} as const satisfies MainlineSceneDialoguePresentation

export const commercialCafeDeliveryDialogueLine = {
  id: 'commercial-cafe-coffee-delivery',
  speaker: '店员',
  text: '您的咖啡。',
} as const

/** Only durable story beats are analytics-worthy; punctuation segments are not. */
export function commercialCafeAnalyticsStageForCursor(cursor: number) {
  if (cursor === 0) return 'meeting-started' as const
  if (cursor === 5) return 'mine-lead' as const
  if (cursor === 9) return 'yonghe-lead' as const
  return null
}

export const commercialCafeAnalyticsStages = ['meeting-started', 'mine-lead', 'yonghe-lead', 'ready-to-leave', 'complete'] as const
export type CommercialCafeAnalyticsStage = typeof commercialCafeAnalyticsStages[number]

export function commercialCafeAnalyticsMilestonesFromSceneState(sceneState: PlayerSceneState | undefined) {
  const stored = sceneState?.[commercialCafeAnalyticsMilestonesKey]
  if (typeof stored !== 'string') return new Set<CommercialCafeAnalyticsStage>()
  return new Set(stored.split('|').filter((stage): stage is CommercialCafeAnalyticsStage => commercialCafeAnalyticsStages.includes(stage as CommercialCafeAnalyticsStage)))
}

export function commercialCafeAnalyticsMilestonePatch(sceneState: PlayerSceneState | undefined, stage: CommercialCafeAnalyticsStage) {
  const milestones = commercialCafeAnalyticsMilestonesFromSceneState(sceneState)
  milestones.add(stage)
  return { [commercialCafeAnalyticsMilestonesKey]: [...milestones].join('|') }
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
function isCoffeeStatus(value: unknown): value is CommercialCafeCoffeeStatus { return value === 'none' || value === 'ordered' || value === 'preparing' || value === 'ready' || value === 'delivered' }
function isNarrativePhase(value: unknown): value is CommercialCafeNarrativePhase { return value === 'not-started' || value === 'dialogue' || value === 'coffee-delivery' || value === 'complete' }
function isDeparture(value: unknown): value is CommercialCafeLaoZhouDeparture { return value === 'seated' || value === 'walking-out' || value === 'departed' }
function validCursor(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= commercialCafeNarrativeDialogue.lines.length }

function legacyCoffeeStatus(sceneState: PlayerSceneState | undefined, stage: CommercialCafeStoryStage): CommercialCafeCoffeeStatus {
  if (sceneState?.[legacyCommercialCafeCoffeeDeliveredKey] === true || stage === 'coffee-delivered' || stage === 'intel-received') return 'delivered'
  if (sceneState?.[legacyCommercialCafeCoffeeOrderedKey] === true || ['coffee-ordered', 'met-lao-zhou', 'ready-to-leave'].includes(stage)) return 'ordered'
  return 'none'
}

export function initialCommercialCafeStoryState(): CommercialCafeStoryState {
  return { status: 'available', narrativeCursor: 0, coffeeStatus: 'none', coffeePreparationStartedAt: null, narrativePhase: 'not-started', laoZhouDeparture: 'seated', completedAt: null }
}

export function commercialCafeStoryStateFromSceneState(sceneState: PlayerSceneState | undefined): CommercialCafeStoryState {
  const stage = legacyStoryStage(sceneState)
  const storedStatus = sceneState?.[commercialCafeStoryStatusKey]
  const storedCursor = sceneState?.[commercialCafeNarrativeCursorKey]
  const status = isStoryStatus(storedStatus) ? storedStatus : stage === 'ready-to-leave' ? 'ready-to-leave' : stage === 'complete' ? 'complete' : 'available'
  const narrativeCursor = validCursor(storedCursor) ? storedCursor : legacyCursorByStage[stage]
  const migratedCoffeeStatus = legacyCoffeeStatus(sceneState, stage)
  const coffeeStatus = isCoffeeStatus(sceneState?.[commercialCafeCoffeeStatusKey]) ? sceneState[commercialCafeCoffeeStatusKey] as CommercialCafeCoffeeStatus : migratedCoffeeStatus
  const narrativePhase = isNarrativePhase(sceneState?.[commercialCafeNarrativePhaseKey])
    ? sceneState[commercialCafeNarrativePhaseKey] as CommercialCafeNarrativePhase
    : status === 'complete' || status === 'ready-to-leave' ? 'complete' : validCursor(storedCursor) && narrativeCursor > 0 ? 'dialogue' : 'not-started'
  const laoZhouDeparture = isDeparture(sceneState?.[commercialCafeLaoZhouDepartureKey]) ? sceneState[commercialCafeLaoZhouDepartureKey] as CommercialCafeLaoZhouDeparture : 'seated'
  const completedAt = typeof sceneState?.[commercialCafeCompletedAtKey] === 'number' ? sceneState[commercialCafeCompletedAtKey] as number : status === 'complete' ? 0 : null
  const coffeePreparationStartedAt = typeof sceneState?.[commercialCafeCoffeePreparationStartedAtKey] === 'number' ? sceneState[commercialCafeCoffeePreparationStartedAtKey] as number : null
  return {
    status,
    narrativeCursor: status === 'ready-to-leave' || status === 'complete' ? commercialCafeNarrativeDialogue.lines.length : narrativeCursor,
    coffeeStatus,
    coffeePreparationStartedAt,
    narrativePhase,
    laoZhouDeparture,
    completedAt,
  }
}

export function commercialCafeStoryStatePatch(state: CommercialCafeStoryState) {
  return {
    [commercialCafeStoryStatusKey]: state.status,
    [commercialCafeNarrativeCursorKey]: state.narrativeCursor,
    [commercialCafeCoffeeStatusKey]: state.coffeeStatus,
    [commercialCafeCoffeePreparationStartedAtKey]: state.coffeePreparationStartedAt,
    [commercialCafeNarrativePhaseKey]: state.narrativePhase,
    [commercialCafeLaoZhouDepartureKey]: state.laoZhouDeparture,
    [commercialCafeCompletedAtKey]: state.completedAt,
    [commercialCafeStoryStageKey]: null,
    [legacyCommercialCafeCoffeeOrderedKey]: null,
    [legacyCommercialCafeCoffeeDeliveredKey]: null,
  }
}

export function commercialCafeStoryNeedsMigration(sceneState: PlayerSceneState | undefined) {
  return !isStoryStatus(sceneState?.[commercialCafeStoryStatusKey])
    || !validCursor(sceneState?.[commercialCafeNarrativeCursorKey])
    || !isCoffeeStatus(sceneState?.[commercialCafeCoffeeStatusKey])
    || !(typeof sceneState?.[commercialCafeCoffeePreparationStartedAtKey] === 'number' || sceneState?.[commercialCafeCoffeePreparationStartedAtKey] === null)
    || !isNarrativePhase(sceneState?.[commercialCafeNarrativePhaseKey])
    || !isDeparture(sceneState?.[commercialCafeLaoZhouDepartureKey])
    || !(typeof sceneState?.[commercialCafeCompletedAtKey] === 'number' || sceneState?.[commercialCafeCompletedAtKey] === null)
    || sceneState?.[commercialCafeStoryStageKey] !== null
    || sceneState?.[legacyCommercialCafeCoffeeOrderedKey] !== null
    || sceneState?.[legacyCommercialCafeCoffeeDeliveredKey] !== null
}

export function commercialCafeStoryWithCursor(story: CommercialCafeStoryState, narrativeCursor: number): CommercialCafeStoryState {
  return { ...story, narrativeCursor: Math.max(0, Math.min(commercialCafeNarrativeDialogue.lines.length, narrativeCursor)) }
}
export function commercialCafeNarrativeStarted(story: CommercialCafeStoryState): CommercialCafeStoryState { return { ...story, narrativePhase: 'dialogue' } }
export function commercialCafeCoffeeOrdered(story: CommercialCafeStoryState): CommercialCafeStoryState {
  return story.coffeeStatus === 'none'
    ? { ...story, coffeeStatus: 'ordered', coffeePreparationStartedAt: null }
    : story
}
export function commercialCafeCoffeePreparing(story: CommercialCafeStoryState, startedAt: number): CommercialCafeStoryState {
  return story.coffeeStatus === 'ordered' ? { ...story, coffeeStatus: 'preparing', coffeePreparationStartedAt: startedAt } : story
}
/** Arrival owns the preparation timestamp; an already-open story gate skips the wait here. */
export function commercialCafeCoffeeArrivedAtPrep(story: CommercialCafeStoryState, startedAt: number): CommercialCafeStoryState {
  const preparing = commercialCafeCoffeePreparing(story, startedAt)
  return preparing.narrativePhase === 'coffee-delivery' ? commercialCafeCoffeeReady(preparing) : preparing
}
export function commercialCafeCoffeeReady(story: CommercialCafeStoryState): CommercialCafeStoryState {
  return story.coffeeStatus === 'preparing' ? { ...story, coffeeStatus: 'ready' } : story
}
export function commercialCafeCoffeePreparationElapsed(story: CommercialCafeStoryState, now: number): boolean {
  return story.coffeeStatus === 'preparing'
    && story.coffeePreparationStartedAt !== null
    && now - story.coffeePreparationStartedAt >= commercialCafeCoffeePreparationDurationMs
}
export function commercialCafeCoffeeDelivered(story: CommercialCafeStoryState): CommercialCafeStoryState {
  return story.coffeeStatus === 'ready' ? { ...story, coffeeStatus: 'delivered' } : story
}
export function commercialCafeCoffeeOrderedState(story: CommercialCafeStoryState) { return story.coffeeStatus !== 'none' }
export function commercialCafeCoffeeDeliveredState(story: CommercialCafeStoryState) { return story.coffeeStatus === 'delivered' }

/** Cursor 1's completion owns the one optional delivery gate. */
export function commercialCafeFinishCursorOne(story: CommercialCafeStoryState) {
  if (story.coffeeStatus === 'none') return { ...story, narrativeCursor: 2, narrativePhase: 'dialogue' as const }
  const coffee = commercialCafeCoffeeReady(story)
  return { ...coffee, narrativeCursor: 1, narrativePhase: 'coffee-delivery' as const }
}
export function commercialCafeFinishDeliveryLine(story: CommercialCafeStoryState) {
  return story.coffeeStatus === 'delivered' && story.narrativeCursor === 1 && story.narrativePhase === 'coffee-delivery'
    ? { ...story, narrativeCursor: 2, narrativePhase: 'dialogue' as const }
    : story
}

export function commercialCafeStoryReadyToLeave(story: CommercialCafeStoryState): CommercialCafeStoryState {
  return { ...story, status: 'ready-to-leave', narrativeCursor: commercialCafeNarrativeDialogue.lines.length, narrativePhase: 'complete' }
}
export function commercialCafeStoryCompleted(story: CommercialCafeStoryState, now: number): CommercialCafeStoryState {
  return { ...story, status: 'complete', narrativeCursor: commercialCafeNarrativeDialogue.lines.length, narrativePhase: 'complete', completedAt: now, laoZhouDeparture: 'seated' }
}
export function commercialCafeLaoZhouDepartureDue(story: CommercialCafeStoryState, now: number) {
  return story.status === 'complete' && story.completedAt !== null && now - story.completedAt >= commercialCafeCompletionPresenceMs
}
export function commercialCafeLaoZhouIsPresent(story: CommercialCafeStoryState, _now: number) {
  return story.laoZhouDeparture === 'seated'
}
export function commercialCafeStoryWithLaoZhouDeparture(story: CommercialCafeStoryState, departure: CommercialCafeLaoZhouDeparture): CommercialCafeStoryState {
  return { ...story, laoZhouDeparture: departure }
}
export function shouldCompleteCommercialCafeStoryOnTransition({ sceneId, story, targetSceneId }: { sceneId: string; story: CommercialCafeStoryState; targetSceneId?: string }) {
  return sceneId === 'commercial-cafe' && story.status === 'ready-to-leave' && targetSceneId === 'commercial-street'
}

export function resolveCommercialCafeCoffeePrepIntent(scene: MainlineSceneDefinition): NpcIntent | null {
  if (scene.id !== 'commercial-cafe') return null
  const target = scene.npcBehaviorTargets?.find((candidate) => candidate.id === commercialCafePrepTargetId)
  return target ? { dutyId: npcRoles.cafeCoffeeOwner.duties.prepare.id, targetId: commercialCafePrepTargetId, target: { ...target.position } } : null
}
export function resolveCommercialCafeCoffeeDeliveryIntent({ scene, coffeeStatus, narrativePhase }: { scene: MainlineSceneDefinition; coffeeStatus: CommercialCafeCoffeeStatus; narrativePhase: CommercialCafeNarrativePhase }): NpcIntent | null {
  if (scene.id !== 'commercial-cafe' || coffeeStatus !== 'ready' || narrativePhase !== 'coffee-delivery') return null
  const table = scene.objects.find((entity) => entity.id === commercialCafeStoryTableId)
  return table ? { dutyId: npcRoles.cafeCoffeeOwner.duties.deliverCoffee.id, targetId: table.id, targetEntityId: table.id } : null
}
export function resolveCommercialCafeReturnToCounterIntent(scene: MainlineSceneDefinition): NpcIntent | null {
  if (scene.id !== 'commercial-cafe') return null
  const target = mainlineNpcStagedPoint(scene, commercialCafeCoffeeOwnerNpcId)
  return target ? { dutyId: npcRoles.cafeCoffeeOwner.duties.returnToCounter.id, targetId: commercialCafeCounterTargetId, target: { ...target } } : null
}
export function resolveCommercialCafeFloorServiceIntent(scene: MainlineSceneDefinition, rotation = 0): NpcIntent | null {
  if (scene.id !== 'commercial-cafe') return null
  const publicTables = scene.objects.filter((entity) => entity.kind === 'table' && entity.id !== commercialCafeStoryTableId)
  const table = publicTables.length ? publicTables[rotation % publicTables.length] : undefined
  return table ? { dutyId: npcRoles.cafeFloorServer.duties.tableService.id, targetId: table.id, targetEntityId: table.id } : null
}

export type CommercialCafeNpcInteractionResolution = { kind: 'dialogue'; dialogue: MainlineSceneDialoguePresentation; promptSeatId?: string } | { kind: 'start-narrative' }
export function resolveCommercialCafeNpcInteraction({ sceneId, npcId, story, playerSeatId }: { sceneId: MainlineSceneId; npcId: string; story: CommercialCafeStoryState; playerSeatId?: string | null }): CommercialCafeNpcInteractionResolution | null {
  if (sceneId !== 'commercial-cafe' || npcId !== 'lao-zhou') return null
  if (story.status === 'complete' || story.status === 'ready-to-leave' || story.laoZhouDeparture !== 'seated') return null
  if (playerSeatId !== commercialCafeLaoZhouConversationSeatId) return { kind: 'dialogue', dialogue: commercialCafeSeatGuideDialogue, promptSeatId: commercialCafeLaoZhouConversationSeatId }
  return { kind: 'start-narrative' }
}
