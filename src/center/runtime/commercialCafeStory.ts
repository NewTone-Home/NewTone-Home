import type { PlayerSceneState } from './playerSave'

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
