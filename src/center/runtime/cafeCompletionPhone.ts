import type { PlayerSceneState } from './playerSave'
import type { PhoneDevice } from './phoneState'
import { commercialCafeStoryStatusKey } from './commercialCafeStory'

export const commercialCafeCompletionPhonePendingKey = 'commercialCafeCompletionPhonePending'
export const commercialCafeCompletionPhoneDisplayedKey = 'commercialCafeCompletionPhoneDisplayed'

/** Add a durable request only on the live ready-to-leave -> complete transition. */
export function commercialCafeCompletionPhoneStoryPatch(
  sceneState: PlayerSceneState | undefined,
  storyPatch: PlayerSceneState,
): PlayerSceneState {
  const completesNow = sceneState?.[commercialCafeStoryStatusKey] === 'ready-to-leave'
    && storyPatch[commercialCafeStoryStatusKey] === 'complete'
  if (!completesNow || sceneState?.[commercialCafeCompletionPhoneDisplayedKey] === true) return storyPatch
  return { ...storyPatch, [commercialCafeCompletionPhonePendingKey]: true }
}

export function commercialCafeCompletionPhoneCanRequest(
  sceneState: PlayerSceneState | undefined,
  options: {
    insideCafe: boolean
    phoneDevice: PhoneDevice
    readingActive: boolean
    phoneOpen: boolean
    phoneRetracted: boolean
    traveling: boolean
    rideBoarding: boolean
  },
) {
  return sceneState?.[commercialCafeCompletionPhonePendingKey] === true
    && sceneState[commercialCafeCompletionPhoneDisplayedKey] !== true
    && !options.insideCafe
    && options.phoneDevice === 'inner'
    && !options.readingActive
    && !options.phoneOpen
    && options.phoneRetracted
    && !options.traveling
    && !options.rideBoarding
}

/** Clear pending only after WorldPhone confirms the Lao Zhou thread is mounted. */
export function commercialCafeCompletionPhoneDisplayedPatch(sceneState: PlayerSceneState | undefined): PlayerSceneState | null {
  if (sceneState?.[commercialCafeCompletionPhonePendingKey] !== true
    || sceneState[commercialCafeCompletionPhoneDisplayedKey] === true) return null
  return {
    [commercialCafeCompletionPhonePendingKey]: false,
    [commercialCafeCompletionPhoneDisplayedKey]: true,
  }
}

export function commercialCafeCompletionPhoneMessageReadyForAck(options: {
  requested: boolean
  phoneOpen: boolean
  activeApp: string | null
  contactView: string
  selectedContactId: string
  messageThreadMounted: boolean
}) {
  return options.requested
    && options.phoneOpen
    && options.activeApp === 'contacts'
    && options.contactView === 'messages'
    && options.selectedContactId === 'lao-zhou'
    && options.messageThreadMounted
}
