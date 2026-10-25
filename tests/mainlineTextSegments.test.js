import { describe, expect, it } from 'vitest'
import { longestMainlineInteractionSegment, mainlineDisplaySourceText, splitMainlineInteractionText, splitMainlineInteractionTextToFit } from '../src/center/runtime/mainlineTextSegments'

describe('mainline interaction text segments', () => {
  const asDisplayedSegments = segments => segments.map(mainlineDisplaySourceText)

  it('uses natural comma boundaries and preserves visible punctuation', () => {
    expect(splitMainlineInteractionText('桌上摆放着牌位，香炉里的火还没有熄灭。')).toEqual(asDisplayedSegments([
      '桌上摆放着牌位，',
      '香炉里的火还没有熄灭。',
    ]))
  })

  it('keeps the approved Café question intact while exposing independent clue clauses', () => {
    expect(splitMainlineInteractionText('老周，陈副部长还是没有消息吗？')).toEqual(asDisplayedSegments([
      '老周，陈副部长还是没有消息吗？',
    ]))
    expect(splitMainlineInteractionText('矿区外围旧摄像头曾多次疑似拍到陈副部长，不过画面始终太远，无法确认那个人的身份。')).toEqual(asDisplayedSegments([
      '矿区外围旧摄像头曾多次疑似拍到陈副部长，',
      '不过画面始终太远，',
      '无法确认那个人的身份。',
    ]))
  })

  it('keeps short vocatives and particles with the following clause', () => {
    expect(splitMainlineInteractionText('老周，陈副部长还是没有消息吗？')).toEqual(asDisplayedSegments([
      '老周，陈副部长还是没有消息吗？',
    ]))
    expect(splitMainlineInteractionText('不，不会认错的。')).toEqual(asDisplayedSegments(['不，不会认错的。']))
  })

  it('uses strong punctuation as readable boundaries and preserves it', () => {
    expect(splitMainlineInteractionText('你来了？我等了很久！稍等；现在继续。')).toEqual(asDisplayedSegments([
      '你来了？我等了很久！',
      '稍等；现在继续。',
    ]))
  })

  it('does not leave closing quotes as their own segment', () => {
    expect(splitMainlineInteractionText('“先进去。”，再回头。')).toEqual(asDisplayedSegments(['“先进去。”，再回头。']))
  })

  it('splits a genuinely long clause at its readable comma boundary', () => {
    const text = '矿区外围旧摄像头曾多次疑似拍到陈副部长，不过画面始终太远，无法确认那个人的身份。'
    expect(splitMainlineInteractionText(text)).toEqual(asDisplayedSegments([
      '矿区外围旧摄像头曾多次疑似拍到陈副部长，',
      '不过画面始终太远，',
      '无法确认那个人的身份。',
    ]))
    expect(longestMainlineInteractionSegment(text)).toBe('矿区外围旧摄像头曾多次疑似拍到陈副部长，')
  })

  it('uses measured width for an unpunctuated narrow-space split and preserves every original character', () => {
    const text = '一二三四五六七八九十'
    const segments = splitMainlineInteractionTextToFit(text, 80, 16, value => Array.from(value).length * 16)
    expect(segments).toEqual(['一二三四五', '六七八九十'])
    expect(segments.join('')).toBe(text)
  })

  it('keeps punctuation at the end of the preceding width-fitted segment', () => {
    const text = '一二三四五，六七八九十。'
    const segments = splitMainlineInteractionTextToFit(text, 96, 16, value => Array.from(value).length * 16)
    expect(segments.join('')).toBe(mainlineDisplaySourceText(text))
    expect(segments[0]).toBe('一二三四五，')
  })
  it('removes a terminal Chinese full stop before desktop and mobile width fitting', () => {
    const source = '\u8fd9\u91cc\u662f\u539f\u67dc\u53f0\u7684\u70b9\u5355\u63a5\u89e6\u4f4d\u7f6e\u3002'
    const display = '\u8fd9\u91cc\u662f\u539f\u67dc\u53f0\u7684\u70b9\u5355\u63a5\u89e6\u4f4d\u7f6e'
    const measure = value => Array.from(value).length * 20
    expect(mainlineDisplaySourceText(source)).toBe(display)
    expect(splitMainlineInteractionTextToFit(source, 270, 20, measure)).toEqual([display])
    expect(splitMainlineInteractionTextToFit(source, 230, 20, measure)).toEqual([
      '\u8fd9\u91cc\u662f\u539f\u67dc\u53f0\u7684\u70b9\u5355\u63a5\u89e6',
      '\u4f4d\u7f6e',
    ])
    expect(splitMainlineInteractionText(source)).toEqual([display])
    expect(mainlineDisplaySourceText('\u539f\u6587\u3002\u5185\u90e8\u53e5\u53f7\u3002')).toBe('\u539f\u6587\u3002\u5185\u90e8\u53e5\u53f7')
    expect(mainlineDisplaySourceText('\u539f\u6587.')).toBe('\u539f\u6587.')
    expect(mainlineDisplaySourceText('\u539f\u6587\uff01')).toBe('\u539f\u6587\uff01')
  })

})
