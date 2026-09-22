import type { PlayerSceneState } from './playerSave'
import type { MainlineSceneDialoguePresentation, MainlineSceneId } from './mainlineSceneModel'

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
) {
  return visibleFromStage === undefined || hasReachedCommercialCafeStoryStage(stage, visibleFromStage)
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
  if (sceneId !== 'commercial-cafe' || npcId !== 'lao-zhou' || stage !== 'coffee-ordered') return null
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
