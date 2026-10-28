import type { PlayerSceneState } from './playerSave'
import type { MainlineSceneDialoguePresentation } from './mainlineSceneModel'
import { laoZhouCafeSeatPairs } from './commercialCafeSeatSelection'

export const ruoyuCafeUnlockedKey = 'commercialCafeRuoyuUnlocked'
export const ruoyuCafeSeatIdKey = 'commercialCafeRuoyuSeatId'
export const ruoyuCafeMeetingStatusKey = 'commercialCafeRuoyuMeetingStatus'
export const ruoyuCafeMeetingCursorKey = 'commercialCafeRuoyuMeetingCursor'
export const ruoyuCafeXiujieFollowupCountKey = 'commercialCafeRuoyuXiujieFollowupCount'
export const ruoyuCafeRuoyuFollowupCountKey = 'commercialCafeRuoyuRuoyuFollowupCount'
export const ruoyuCafeMeetingNpcId = 'ruoyu'

export const ruoyuCafeMeetingLines = [
  { id: 'ruoyu-cafe-0', speaker: '修杰', text: '查到什么了？' },
  { id: 'ruoyu-cafe-1', speaker: '若雨', speakerNpcId: ruoyuCafeMeetingNpcId, text: '我把近几个月的转运记录过了一遍。大部分都正常，只有两笔调度单是后来补进去的。' },
  { id: 'ruoyu-cafe-2', speaker: '修杰', text: '后补？' },
  { id: 'ruoyu-cafe-3', speaker: '若雨', speakerNpcId: ruoyuCafeMeetingNpcId, text: '货先出去的，单子是后来过了好几天才补进去系统的。正常流程是系统录入，才出货的。不过特殊情况是允许这样做的，只不过这种情况不多。' },
  { id: 'ruoyu-cafe-4', speaker: '修杰', text: '走的是哪条线？' },
  { id: 'ruoyu-cafe-5', speaker: '若雨', speakerNpcId: ruoyuCafeMeetingNpcId, text: '都是从核心区往外围中转站转的。审批人是周建华，核心区有签字权的就那么几个人，手续上是没什么问题的。' },
  { id: 'ruoyu-cafe-6', speaker: '修杰', text: '那问题在哪？' },
  { id: 'ruoyu-cafe-7', speaker: '若雨', speakerNpcId: ruoyuCafeMeetingNpcId, text: '巧就巧在这里。' },
  { id: 'ruoyu-cafe-8', speaker: '若雨', speakerNpcId: ruoyuCafeMeetingNpcId, text: '这两笔是周建华签的最后两笔单子。签完没多久，他就调岗了，去了后勤保障那边，彻底不管转运了。' },
  { id: 'ruoyu-cafe-9', speaker: '若雨', speakerNpcId: ruoyuCafeMeetingNpcId, text: '单看哪一件都正常，但是补进系统的时候他刚好已经不在这个位子上了，要继续查下去，就会很麻烦了。' },
  { id: 'ruoyu-cafe-10', speaker: '修杰', text: '知道了。你继续查，先别让他们察觉。' },
  { id: 'ruoyu-cafe-11', speaker: '若雨', speakerNpcId: ruoyuCafeMeetingNpcId, text: '明白。' },
] as const
export const ruoyuCafeMeetingDialogue = {
  triggerEntityId: 'ruoyu-cafe-meeting',
  lines: ruoyuCafeMeetingLines,
} as const satisfies MainlineSceneDialoguePresentation

/** Reserve a different real table pair for Ruoyu; never use a trial-only scene or a table occupied by Lao Zhou. */
export function selectRuoyuCafeSeat(laoZhouSeatId: string, random: () => number = Math.random): string {
  const pairs = laoZhouCafeSeatPairs().filter(pair => !pair.some(seat => seat.id === laoZhouSeatId))
  const candidates = pairs.flatMap(pair => pair.map(seat => seat.id))
  if (!candidates.length) return 'commercial-cafe-right-window-upper-group-chair-top'
  const sample = random()
  const index = Number.isFinite(sample) ? Math.min(candidates.length - 1, Math.max(0, Math.floor(sample * candidates.length))) : 0
  return candidates[index] ?? 'commercial-cafe-right-window-upper-group-chair-top'
}

export function ruoyuCafeConversationSeatId(ruoyuSeatId: string): string {
  return laoZhouCafeSeatPairs().find(pair => pair.some(seat => seat.id === ruoyuSeatId))
    ?.find(seat => seat.id !== ruoyuSeatId)?.id
    ?? 'commercial-cafe-right-window-upper-group-chair-bottom'
}

/** Durable, idempotent unlock and seat selection on the first qualified mine exit. */
export function ruoyuCafeMineExitPatch(sceneState: PlayerSceneState | undefined, laoZhouSeatId: string, random: () => number = Math.random): PlayerSceneState | null {
  if (sceneState?.[ruoyuCafeUnlockedKey] === true) return null
  return {
    [ruoyuCafeUnlockedKey]: true,
    [ruoyuCafeSeatIdKey]: typeof sceneState?.[ruoyuCafeSeatIdKey] === 'string'
      ? sceneState[ruoyuCafeSeatIdKey] as string
      : selectRuoyuCafeSeat(laoZhouSeatId, random),
  }
}

export function ruoyuCafeSeatFromSceneState(sceneState: PlayerSceneState | undefined): string | null {
  const id = sceneState?.[ruoyuCafeSeatIdKey]
  return typeof id === 'string' ? id : null
}

export function ruoyuCafeMeetingCursorFromSceneState(sceneState: PlayerSceneState | undefined): number {
  const cursor = sceneState?.[ruoyuCafeMeetingCursorKey]
  return typeof cursor === 'number' && Number.isInteger(cursor) ? Math.max(0, Math.min(ruoyuCafeMeetingLines.length, cursor)) : 0
}

export function ruoyuCafeMeetingCompleted(sceneState: PlayerSceneState | undefined): boolean {
  return sceneState?.[ruoyuCafeMeetingStatusKey] === 'complete'
}

export function ruoyuCafeFollowupLine(sceneState: PlayerSceneState | undefined, npcId: string) {
  const xiujieCount = typeof sceneState?.[ruoyuCafeXiujieFollowupCountKey] === 'number' ? sceneState[ruoyuCafeXiujieFollowupCountKey] as number : 0
  const ruoyuCount = typeof sceneState?.[ruoyuCafeRuoyuFollowupCountKey] === 'number' ? sceneState[ruoyuCafeRuoyuFollowupCountKey] as number : 0
  if (npcId === 'xiujie') return { key: ruoyuCafeXiujieFollowupCountKey, text: xiujieCount % 2 === 0 ? '还有什么事吗？' : '还有事吗？' }
  if (npcId === ruoyuCafeMeetingNpcId) return { key: ruoyuCafeRuoyuFollowupCountKey, text: ruoyuCount % 2 === 0 ? '还有事吗？' : '还有什么事吗？' }
  return null
}
