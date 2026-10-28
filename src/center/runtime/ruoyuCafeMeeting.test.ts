import { describe, expect, it } from 'vitest'
import {
  ruoyuCafeConversationSeatId,
  ruoyuCafeMineExitPatch,
  ruoyuCafeSeatFromSceneState,
  ruoyuCafeMeetingLines,
  ruoyuCafeFollowupLine,
  ruoyuCafeMeetingCompleted,
  ruoyuCafeUnlockedKey,
  ruoyuCafeXiujieFollowupCountKey,
  ruoyuCafeRuoyuFollowupCountKey,
  ruoyuCafeMeetingStatusKey,
} from './ruoyuCafeMeeting'
import { defaultLaoZhouCafeSeatId } from './commercialCafeSeatSelection'
import { mainlineScenes } from './mainlineScenes'
import { withRuoyuCafeSeat } from './commercialCafeSeatSelection'
import { mainlineSceneOccupiedSeatIds } from './mainlineSeating'

describe('Ruoyu Cafe meeting state', () => {
  it('unlocks exactly once and persists a legal non-conflicting table seat', () => {
    const patch = ruoyuCafeMineExitPatch(undefined, defaultLaoZhouCafeSeatId, () => 0.25)!
    const seat = ruoyuCafeSeatFromSceneState(patch)!
    expect(patch[ruoyuCafeUnlockedKey]).toBe(true)
    expect(ruoyuCafeConversationSeatId(seat)).not.toBe(seat)
    expect(seat).not.toBe(defaultLaoZhouCafeSeatId)
    expect(ruoyuCafeMineExitPatch(patch, defaultLaoZhouCafeSeatId)).toBeNull()
    expect(ruoyuCafeSeatFromSceneState(patch)).toBe(seat)
    const absent = withRuoyuCafeSeat(mainlineScenes['commercial-street'], seat, false)
    const present = withRuoyuCafeSeat(mainlineScenes['commercial-street'], seat, true)
    expect(absent.npcs.some(npc => npc.id === 'ruoyu')).toBe(false)
    expect(present.npcs.some(npc => npc.id === 'ruoyu')).toBe(true)
    expect(mainlineSceneOccupiedSeatIds(present)).toContain(seat)
  })

  it('contains the approved twelve lines and keeps follow-up counters independent', () => {
    expect(ruoyuCafeMeetingLines).toHaveLength(12)
    expect(ruoyuCafeMeetingLines.map(line => line.text)).toEqual([
      '查到什么了？',
      '我把近几个月的转运记录过了一遍。大部分都正常，只有两笔调度单是后来补进去的。',
      '后补？',
      '货先出去的，单子是后来过了好几天才补进去系统的。正常流程是系统录入，才出货的。不过特殊情况是允许这样做的，只不过这种情况不多。',
      '走的是哪条线？',
      '都是从核心区往外围中转站转的。审批人是周建华，核心区有签字权的就那么几个人，手续上是没什么问题的。',
      '那问题在哪？',
      '巧就巧在这里。',
      '这两笔是周建华签的最后两笔单子。签完没多久，他就调岗了，去了后勤保障那边，彻底不管转运了。',
      '单看哪一件都正常，但是补进系统的时候他刚好已经不在这个位子上了，要继续查下去，就会很麻烦了。',
      '知道了。你继续查，先别让他们察觉。',
      '明白。',
    ])
    const firstXiujie = ruoyuCafeFollowupLine({ [ruoyuCafeXiujieFollowupCountKey]: 0, [ruoyuCafeRuoyuFollowupCountKey]: 0 }, 'xiujie')!
    const secondXiujie = ruoyuCafeFollowupLine({ [ruoyuCafeXiujieFollowupCountKey]: 1, [ruoyuCafeRuoyuFollowupCountKey]: 0 }, 'xiujie')!
    expect([firstXiujie.text, secondXiujie.text]).toEqual(['还有什么事吗？', '还有事吗？'])
    expect(ruoyuCafeFollowupLine({ [ruoyuCafeXiujieFollowupCountKey]: 1, [ruoyuCafeRuoyuFollowupCountKey]: 0 }, 'ruoyu')?.text).toBe('还有事吗？')
    expect(ruoyuCafeMeetingCompleted({ [ruoyuCafeMeetingStatusKey]: 'complete' })).toBe(true)
  })
})
