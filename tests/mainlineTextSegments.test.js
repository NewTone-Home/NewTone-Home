import { describe, expect, it } from 'vitest'
import { longestMainlineInteractionSegment, splitMainlineInteractionText } from '../src/center/runtime/mainlineTextSegments'

describe('mainline interaction text segments', () => {
  it('keeps ordinary comma clauses together and preserves visible punctuation', () => {
    expect(splitMainlineInteractionText('桌上摆放着牌位，香炉里的火还没有熄灭。')).toEqual([
      '桌上摆放着牌位，香炉里的火还没有熄灭。',
    ])
  })

  it('keeps short vocatives and particles with the following clause', () => {
    expect(splitMainlineInteractionText('老周，陈副部长还是没有消息吗？')).toEqual([
      '老周，陈副部长还是没有消息吗？',
    ])
    expect(splitMainlineInteractionText('不，不会认错的。')).toEqual(['不，不会认错的。'])
  })

  it('uses strong punctuation as readable boundaries and preserves it', () => {
    expect(splitMainlineInteractionText('你来了？我等了很久！稍等；现在继续。')).toEqual([
      '你来了？我等了很久！',
      '稍等；现在继续。',
    ])
  })

  it('does not leave closing quotes as their own segment', () => {
    expect(splitMainlineInteractionText('“先进去。”，再回头。')).toEqual(['“先进去。”，再回头。'])
  })

  it('splits a genuinely long clause at its readable comma boundary', () => {
    const text = '矿区外围旧摄像头曾多次疑似拍到陈副部长，不过画面始终太远，无法确认那个人的身份。'
    expect(splitMainlineInteractionText(text)).toEqual([
      '矿区外围旧摄像头曾多次疑似拍到陈副部长，',
      '不过画面始终太远，无法确认那个人的身份。',
    ])
    expect(longestMainlineInteractionSegment(text)).toBe('矿区外围旧摄像头曾多次疑似拍到陈副部长，')
  })
})
