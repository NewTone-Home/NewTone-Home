import type { PlayerSceneState } from './playerSave'
import { findMainlinePathToEntity, type MainlineNavigationOptions } from './mainlineNavigation'
import type { MainlineSceneDialoguePresentation, MainlineSceneId } from './mainlineSceneModel'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { SceneLayout } from './sceneLayout'
import type { Point } from './sceneGeometry'
import type { NpcIntent } from './npcCore'
import { npcRoles } from './npcRoles'
import { mainlineNpcStagedPoint } from './mainlineNpcStaging'

export const commercialCafeStoryStageKey = 'commercialCafeStoryStage'

export const commercialCafeStoryStages = [
  'entered',
  'coffee-ordered',
  'met-lao-zhou',
  'coffee-delivered',
  'intel-received',
  'ready-to-leave',
  'complete',
] as const

export type CommercialCafeStoryStage = typeof commercialCafeStoryStages[number]

export const initialCommercialCafeStoryStage: CommercialCafeStoryStage = 'entered'
export const commercialCafeLaoZhouConversationSeatId = 'commercial-cafe-right-window-upper-group-chair-bottom'
export const commercialCafeCoffeeAttachedPropId = 'commercial-cafe-coffee'
export const commercialCafeEmptyCupAttachedPropId = 'commercial-cafe-empty-cup'
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

/**
 * The café closes only after the authored resolution and an actual departure
 * through its public exit.  Rendering or opening a dialogue never completes
 * the story by itself.
 */
export function shouldCompleteCommercialCafeStoryOnTransition({
  sceneId,
  stage,
  targetSceneId,
}: {
  sceneId: string
  stage: CommercialCafeStoryStage
  targetSceneId?: string
}) {
  return sceneId === 'commercial-cafe' && stage === 'ready-to-leave' && targetSceneId === 'commercial-street'
}

export function hasReachedCommercialCafeStoryStage(stage: CommercialCafeStoryStage, threshold: CommercialCafeStoryStage) {
  return commercialCafeStoryStages.indexOf(stage) >= commercialCafeStoryStages.indexOf(threshold)
}

/**
 * Attached café details inherit the scene's saved story stage instead of
 * becoming separate scene entities with their own lifecycle.
 */
export function isCommercialCafeStoryDetailVisible(
  visibleFromStage: CommercialCafeStoryStage | undefined,
  stage: CommercialCafeStoryStage,
  hiddenFromStage?: CommercialCafeStoryStage,
) {
  return (visibleFromStage === undefined || hasReachedCommercialCafeStoryStage(stage, visibleFromStage))
    && (hiddenFromStage === undefined || !hasReachedCommercialCafeStoryStage(stage, hiddenFromStage))
}

/**
 * Coffee remains attached to its table. The table's existing interaction
 * contact is therefore the semantic delivery target; shared navigation owns
 * the actual route and arrival.
 */
export function resolveCommercialCafeCoffeeDeliveryIntent({
  scene,
  stage,
  from,
  layout = {},
  navigationOptions = {},
}: {
  scene: MainlineSceneDefinition
  stage: CommercialCafeStoryStage
  from: Point
  layout?: SceneLayout
  navigationOptions?: MainlineNavigationOptions
}): NpcIntent | null {
  if (scene.id !== 'commercial-cafe' || stage !== 'met-lao-zhou') return null
  const coffee = scene.attachedProps.find((prop) => prop.id === commercialCafeCoffeeAttachedPropId)
  if (!coffee) return null
  const serverNavigationOptions = { ...navigationOptions, actorId: npcRoles.server.id }
  const deliveryContact = findMainlinePathToEntity(scene, coffee.parentEntityId, from, layout, serverNavigationOptions)
  if (!deliveryContact.path) return null
  return {
    dutyId: npcRoles.server.duties.deliverCoffee.id,
    targetId: coffee.parentEntityId,
    target: deliveryContact.target,
  }
}

/** The behavior staging point is a semantic return target, not a route. */
export function resolveCommercialCafeReturnToCounterIntent(scene: MainlineSceneDefinition): NpcIntent | null {
  if (scene.id !== 'commercial-cafe') return null
  const target = mainlineNpcStagedPoint(scene, npcRoles.server.id)
  if (!target) return null
  return {
    dutyId: npcRoles.server.duties.returnToCounter.id,
    targetId: 'commercial-cafe-counter-service',
    target,
  }
}

export type CommercialCafeNpcInteractionResolution =
  | {
      kind: 'dialogue'
      dialogue: MainlineSceneDialoguePresentation
      /** Optional authored affordance to keep visible after this dialogue ends. */
      promptSeatId?: string
      /** The page applies this only when the shared dialogue surface finishes its final line. */
      stateChangeOnDialogueComplete?: {
        key: typeof commercialCafeStoryStageKey
        value: CommercialCafeStoryStage
      }
    }
  | {
      kind: 'feedback'
      feedback: string
    }

const laoZhouFirstDialogue = {
  triggerEntityId: 'lao-zhou',
  lines: [
    { id: 'commercial-cafe-lao-zhou-first-xiujie', speaker: '修杰', text: '老周，陈副部长还是没有消息吗？' },
    { id: 'commercial-cafe-lao-zhou-first-lao-zhou', speaker: '老周', text: '完全没有。' },
  ],
} as const satisfies MainlineSceneDialoguePresentation

const laoZhouSeatGuideDialogue = {
  triggerEntityId: 'lao-zhou',
  lines: [
    { id: 'commercial-cafe-lao-zhou-seat-guide', speaker: '老周', text: '你来了，坐吧。' },
  ],
} as const satisfies MainlineSceneDialoguePresentation

const coffeeAndIntelDialogue = {
  triggerEntityId: commercialCafeCoffeeAttachedPropId,
  lines: [
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
  ],
} as const satisfies MainlineSceneDialoguePresentation

const laoZhouResolutionDialogue = {
  triggerEntityId: 'lao-zhou',
  lines: [
    { id: 'commercial-cafe-resolution-xiujie', speaker: '修杰', text: '行，我知道了，有什么新信息再跟我说，继续帮我跟踪一下这件事儿。' },
    { id: 'commercial-cafe-resolution-lao-zhou', speaker: '老周', text: '好。' },
  ],
} as const satisfies MainlineSceneDialoguePresentation

/** Narrative rules stay separate from NPC approach and arrival. */
export function resolveCommercialCafeNpcInteraction({
  sceneId,
  npcId,
  stage,
  playerSeatId,
}: {
  sceneId: MainlineSceneId
  npcId: string
  stage: CommercialCafeStoryStage
  playerSeatId?: string | null
}): CommercialCafeNpcInteractionResolution | null {
  if (sceneId !== 'commercial-cafe' || npcId !== 'lao-zhou') return null
  if (stage === 'intel-received') {
    return {
      kind: 'dialogue',
      dialogue: laoZhouResolutionDialogue,
      stateChangeOnDialogueComplete: { key: commercialCafeStoryStageKey, value: 'ready-to-leave' },
    }
  }
  if (stage !== 'coffee-ordered') return null
  if (playerSeatId !== commercialCafeLaoZhouConversationSeatId) {
    return {
      kind: 'dialogue',
      dialogue: laoZhouSeatGuideDialogue,
      promptSeatId: commercialCafeLaoZhouConversationSeatId,
    }
  }
  return {
    kind: 'dialogue',
    dialogue: laoZhouFirstDialogue,
    stateChangeOnDialogueComplete: {
      key: commercialCafeStoryStageKey,
      value: 'met-lao-zhou',
    },
  }
}

/** Attached props remain presentation children; their story rule lives here, not in the renderer. */
export function resolveCommercialCafeAttachedPropInteraction({
  sceneId,
  propId,
  stage,
}: {
  sceneId: MainlineSceneId
  propId: string
  stage: CommercialCafeStoryStage
}): CommercialCafeNpcInteractionResolution | null {
  if (sceneId !== 'commercial-cafe') return null
  if (propId === commercialCafeCoffeeAttachedPropId && stage === 'coffee-delivered') {
    return {
      kind: 'dialogue',
      dialogue: coffeeAndIntelDialogue,
      stateChangeOnDialogueComplete: { key: commercialCafeStoryStageKey, value: 'intel-received' },
    }
  }
  if (propId === commercialCafeEmptyCupAttachedPropId && stage === 'ready-to-leave') return { kind: 'feedback', feedback: '咖啡杯空了，钞票压在杯子底下。' }
  if (propId === commercialCafeBanknoteAttachedPropId && stage === 'ready-to-leave') return { kind: 'feedback', feedback: '钞票压在空杯旁。' }
  return null
}
