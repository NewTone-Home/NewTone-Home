import { describe, expect, it } from 'vitest'
import { longestMainlineInteractionSegment, splitMainlineInteractionText } from '../src/center/runtime/mainlineTextSegments'

describe('mainline interaction text segments', () => {
  it('uses Chinese commas and full stops as invisible segment boundaries', () => {
    expect(splitMainlineInteractionText('桌上摆放着牌位，香炉里的火还没有熄灭。')).toEqual([
      '桌上摆放着牌位',
      '香炉里的火还没有熄灭',
    ])
  })

  it('uses ASCII commas and periods as invisible segment boundaries', () => {
    expect(splitMainlineInteractionText('I came back, but no one is here.')).toEqual([
      'I came back',
      'but no one is here',
    ])
  })

  it('keeps unaffected punctuation with the visible segment', () => {
    expect(splitMainlineInteractionText('你来了？我等了很久！稍等；现在：继续…甲、乙')).toEqual([
      '你来了？',
      '我等了很久！',
      '稍等；',
      '现在：',
      '继续…',
      '甲、',
      '乙',
    ])
  })

  it('does not leave closing quotes as their own segment', () => {
    expect(splitMainlineInteractionText('“先进去。”，再回头。')).toEqual(['“先进去”', '再回头'])
  })

  it('finds the stable per-interaction width candidate', () => {
    expect(longestMainlineInteractionSegment('短句，稍微长一点的句子。')).toBe('稍微长一点的句子')
  })
})
