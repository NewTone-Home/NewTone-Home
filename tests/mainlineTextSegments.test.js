import { describe, expect, it } from 'vitest'
import { longestMainlineInteractionSegment, mainlineDisplaySourceText, mainlineReadingPageDisplayText, splitMainlineInteractionText, splitMainlineInteractionTextToFit } from '../src/center/runtime/mainlineTextSegments'

describe('mainline interaction text segments', () => {
  const asDisplayedSegments = segments => segments.map(mainlineDisplaySourceText)

  it('adds display-only continuation marks before the last page without changing source segments', () => {
    const sourcePages = ['A long first page', 'and the complete last page']
    expect(mainlineReadingPageDisplayText(sourcePages, 0)).toBe('A long first page...')
    expect(mainlineReadingPageDisplayText(sourcePages, 1)).toBe('and the complete last page')
    expect(sourcePages.join('')).toBe('A long first pageand the complete last page')
  })

  it('preserves authored punctuation and a final ellipsis alongside continuation marks', () => {
    const source = '\u7532\u3002\u4e59\uff1f...'
    const pages = ['\u7532\u3002', '\u4e59\uff1f...']
    expect(mainlineDisplaySourceText(source)).toBe(source)
    expect(pages.join('')).toBe(source)
    expect(mainlineReadingPageDisplayText(pages, 0)).toBe('\u7532\u3002...')
    expect(mainlineReadingPageDisplayText(pages, 1)).toBe('\u4e59\uff1f...')
  })

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

  it('keeps every authored separator and mark in the same order across semantic pages', () => {
    const source = '一二三四， 五六；\r\n七八！！九'
    const pages = splitMainlineInteractionText(source)
    expect(pages.join('')).toBe(mainlineDisplaySourceText(source))
    expect(pages.join('')).toContain('四， 五六；\r\n七八！！九')
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

  it('balances a one-character tail without punctuation and keeps an impossible tiny-width fallback intact', () => {
    const measure = value => Array.from(value).length * 16
    const balanced = splitMainlineInteractionTextToFit('一二三四五六七八九十', 144, 16, measure)
    expect(balanced).toEqual(['一二三四五六七', '八九十'])
    expect(balanced.every(page => measure(page) <= 144)).toBe(true)
    expect(balanced.join('')).toBe('一二三四五六七八九十')

    const tiny = splitMainlineInteractionTextToFit('甲乙丙丁', 16, 16, measure)
    expect(tiny).toEqual(['甲', '乙', '丙', '丁'])
    expect(tiny.join('')).toBe('甲乙丙丁')
  })

  it('rebalances punctuation without changing its order in the source', () => {
    const measure = value => Array.from(value).length * 16
    for (const [source, expected] of [
      ['一二三四，五六', ['一二三', '四，五六']],
      ['一二三四、五六', ['一二三', '四、五六']],
      ['一二三四！！五六', ['一二三', '四！！五六']],
    ]) {
      const pages = splitMainlineInteractionTextToFit(source, 96, 16, measure)
      expect(pages).toEqual(expected)
      expect(pages.join('')).toBe(mainlineDisplaySourceText(source))
      expect(pages.every(page => measure(page) <= 96)).toBe(true)
    }
  })

  it('never leaves trailing punctuation or whitespace as a readable page by itself', () => {
    const measure = value => Array.from(value).length * 16
    const punctuationTail = splitMainlineInteractionTextToFit('一二三四五六！', 96, 16, measure)
    expect(punctuationTail).toEqual(['一二三四五', '六！'])
    expect(punctuationTail.join('')).toBe('一二三四五六！')
    expect(punctuationTail.every(page => measure(page) <= 96)).toBe(true)

    const whitespaceTail = splitMainlineInteractionTextToFit('一二三四五六   ', 96, 16, measure)
    expect(whitespaceTail).toHaveLength(1)
    expect(whitespaceTail.join('')).toBe('一二三四五六   ')

    const impossibleWidth = splitMainlineInteractionTextToFit('甲！', 16, 16, measure)
    expect(impossibleWidth).toEqual(['甲！'])
    expect(impossibleWidth.join('')).toBe('甲！')
  })

  it('preserves all source punctuation through width fitting and pagination', () => {
    const source = '这里是原柜台的点单接触位置。原文自带...“好吗？！”'
    const measure = value => Array.from(value).length * 20
    expect(mainlineDisplaySourceText(source)).toBe(source)
    for (const width of [230, 240, 270]) {
      const pages = splitMainlineInteractionTextToFit(source, width, 20, measure)
      expect(pages.join('')).toBe(source)
      expect(pages.every(page => measure(page) <= width)).toBe(true)
    }
    expect(splitMainlineInteractionText(source).join('')).toBe(source)
  })

})
