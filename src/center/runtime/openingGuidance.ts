import type { PlayerSceneState } from './playerSave'
import { commercialCafeNarrativeCursorKey, commercialCafeNarrativePhaseKey, commercialCafeStoryStatusKey } from './commercialCafeStory'
import { ruoyuCafeDepartedKey, ruoyuCafeMeetingCompleted, ruoyuCafeUnlockedKey } from './ruoyuCafeMeeting'

/** Commercial-street state: story-time label (HH:MM) at which Lao Zhou's arrival text was delivered. */
export const laoZhouArrivalTimeKey = 'laoZhouArrivalMessageTime'
export const laoZhouArrivalText = '我到咖啡馆了。'

/** Fresh games only: the cafe story has not started (a new save already reads 'available') and the text was not yet delivered. */
export function laoZhouArrivalShouldDeliver(streetState: PlayerSceneState | undefined, cafeState: PlayerSceneState | undefined): boolean {
  if (typeof streetState?.[laoZhouArrivalTimeKey] === 'string') return false
  const status = cafeState?.[commercialCafeStoryStatusKey]
  const phase = cafeState?.[commercialCafeNarrativePhaseKey]
  const cursor = cafeState?.[commercialCafeNarrativeCursorKey]
  // A new game starts as 'available' / 'not-started' / cursor 0; anything further means the story has begun.
  return (status === undefined || status === 'available')
    && (phase === undefined || phase === 'not-started')
    && (cursor === undefined || cursor === 0)
}

export function laoZhouArrivalLabel(streetState: PlayerSceneState | undefined): string | null {
  const value = streetState?.[laoZhouArrivalTimeKey]
  return typeof value === 'string' && value ? value : null
}

/**
 * The commercial street glows on the world map while the player is elsewhere and the next story
 * character is waiting in the cafe there: first Lao Zhou, then Ruoyu after her text arrives.
 */
export function commercialStreetMapGuideActive(sceneId: string, cafeState: PlayerSceneState | undefined): boolean {
  if (sceneId === 'commercial-street' || sceneId === 'commercial-cafe') return false
  if (cafeState?.[commercialCafeStoryStatusKey] !== 'complete') return true
  return cafeState[ruoyuCafeUnlockedKey] === true
    && cafeState[ruoyuCafeDepartedKey] !== true
    && !ruoyuCafeMeetingCompleted(cafeState)
}
