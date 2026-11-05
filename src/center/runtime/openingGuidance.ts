import type { PlayerSceneState } from './playerSave'
import { commercialCafeNarrativeCursorKey, commercialCafeNarrativePhaseKey, commercialCafeStoryStatusKey } from './commercialCafeStory'
import { ruoyuCafeDepartedKey, ruoyuCafeMeetingCompleted, ruoyuCafeUnlockedKey } from './ruoyuCafeMeeting'

/** Commercial-street state: story-time label (HH:MM) at which Lao Zhou's arrival text was delivered. */
export const laoZhouArrivalTimeKey = 'laoZhouArrivalMessageTime'
export const laoZhouArrivalText = '我到咖啡馆了。'

/** Unknown historical evidence never becomes an assumed fresh game. */
export function laoZhouArrivalShouldDeliver(streetState: PlayerSceneState | undefined, cafeState: PlayerSceneState | undefined): boolean {
  if (classifyLaoZhouConversation({'commercial-street':streetState,'commercial-cafe':cafeState}).state === 'triggered') return false
  return streetState?.laoZhouOpeningPromptStatus === 'pending'
}

export function laoZhouArrivalLabel(streetState: PlayerSceneState | undefined): string | null {
  const value = streetState?.[laoZhouArrivalTimeKey] ?? streetState?.laoZhouOpeningPromptTime
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

export type LaoZhouTriggerEvidence = { state: 'triggered' | 'not-triggered' | 'unknown'; evidence: string[] }
/** Raw persisted evidence only. Never call a default-producing story sanitizer here. */
export function classifyLaoZhouConversation(scenes: Partial<Record<string, PlayerSceneState>> | undefined): LaoZhouTriggerEvidence {
  const positive: string[] = [], negative: string[] = []
  for (const id of ['commercial-cafe', 'commercial-street']) {
    const s = scenes?.[id]; if (!s) continue
    if (s.laoZhouConversationTriggered === true) positive.push(`${id}:explicit-trigger`)
    if (s.laoZhouTriggerEvidenceVersion === 1 && s.laoZhouConversationTriggered === false) negative.push(`${id}:explicit-not-triggered`)
    const phase = s[commercialCafeNarrativePhaseKey], cursor = s[commercialCafeNarrativeCursorKey], status = s[commercialCafeStoryStatusKey]
    if (['dialogue', 'coffee-delivery', 'coffee-returning', 'complete'].includes(String(phase))) positive.push(`${id}:phase:${phase}`)
    if (typeof cursor === 'number' && cursor > 0) positive.push(`${id}:cursor:${cursor}`)
    if (status === 'ready-to-leave' || status === 'complete') positive.push(`${id}:status:${status}`)
    if (['met-lao-zhou', 'coffee-delivered', 'intel-received', 'ready-to-leave', 'complete'].includes(String(s.commercialCafeStoryStage))) positive.push(`${id}:legacy-stage:${s.commercialCafeStoryStage}`)
    if (typeof s.commercialCafeAnalyticsMilestones === 'string' && s.commercialCafeAnalyticsMilestones.split('|').includes('meeting-started')) positive.push(`${id}:meeting-started`)
    // Old main-story defaults cannot disprove an unrecorded seat-guide dialogue.
  }
  // A durable positive event dominates an older initialized scene copy. An
  // explicit new trigger flag contradicting it is malformed evidence instead.
  if (positive.length) return negative.some(x => x.endsWith(':explicit-not-triggered')) ? { state: 'unknown', evidence: [...positive, ...negative] } : { state: 'triggered', evidence: positive }
  if (negative.length) return { state: 'not-triggered', evidence: negative }
  return { state: 'unknown', evidence: ['no-reliable-persisted-trigger-fact'] }
}
export function openingGuidancePatch<T extends { sceneState: Partial<Record<string, PlayerSceneState>> }>(save: T, evidence: LaoZhouTriggerEvidence, fresh = false): T {
  const status = fresh || evidence.state === 'not-triggered' ? 'pending' : evidence.state === 'triggered' ? 'suppressed' : 'unknown'
  return { ...save, sceneState: { ...save.sceneState, 'commercial-street': { ...save.sceneState['commercial-street'], laoZhouOpeningPromptStatus: status, laoZhouOpeningPromptEvidence: JSON.stringify(evidence), ...(fresh ? { laoZhouConversationTriggered: false, laoZhouTriggerEvidenceVersion: 1 } : {}) } } }
}
