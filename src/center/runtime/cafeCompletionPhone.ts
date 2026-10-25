import type { PlayerSceneState } from './playerSave'
import type { PhoneDevice } from './phoneState'
import { commercialCafeStoryStatusKey } from './commercialCafeStory'

export const commercialCafeCompletionPhoneOpenedKey = 'commercialCafeCompletionPhoneOpened'

/** The completed Cafe handoff is consumed only after the player has walked back outside. */
export function commercialCafeCompletionPhonePatch(
  sceneState: PlayerSceneState | undefined,
  options: { insideCafe: boolean; phoneDevice: PhoneDevice; readingActive?: boolean },
): PlayerSceneState | null {
  if (sceneState?.[commercialCafeStoryStatusKey] !== 'complete') return null
  if (sceneState[commercialCafeCompletionPhoneOpenedKey] === true) return null
  if (options.insideCafe || options.phoneDevice !== 'inner' || options.readingActive) return null
  return { [commercialCafeCompletionPhoneOpenedKey]: true }
}
