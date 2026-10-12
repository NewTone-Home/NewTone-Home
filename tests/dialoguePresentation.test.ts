import { describe, expect, it } from 'vitest'
import { dialoguePresentationText, mainlineVisiblePresentationText } from '../src/center/runtime/dialoguePresentation'
import { splitMainlineInteractionText } from '../src/center/runtime/mainlineTextSegments'

describe('dialogue presentation text', () => {
  it('preserves internal punctuation and quotes without changing its source', () => {
    const source = '“你好，”他说：“你来了吗？！”'
    expect(dialoguePresentationText(source)).toBe('“你好，”他说：“你来了吗”')
    expect(source).toBe('“你好，”他说：“你来了吗？！”')
  })
  it.each([
    ['我跟你说，事情不是这样的。', '我跟你说，事情不是这样的'],
    ['句中。仍继续。', '句中。仍继续'],
    ['你来了吗？还没？', '你来了吗？还没'],
    ['别急！等一下！', '别急！等一下'],
    ['先说；再说；', '先说；再说'],
    ['他说：别急：', '他说：别急'],
    ['不，不对？！再想想。', '不，不对？！再想想'],
    ['“你来了？”', '“你来了”'], ['‘你来了！’', '‘你来了’'],
    ['“他说：‘你来了？’”', '“他说：‘你来了’”'],
    ['“你来了？”，', '“你来了”'], ['没有标点', '没有标点'],
    ['', ''], ['？！', ''], ['“”', '“”'], ['你好。  ', '你好  '],
    ['中文，', '中文'], ['中文、', '中文'], ['hello,', 'hello'],
    ['hello?', 'hello'], ['hello!', 'hello'], ['hello;', 'hello'], ['hello:', 'hello'],
  ])('formats %s as %s for both reading modes', (source, expected) => {
    expect(mainlineVisiblePresentationText(source)).toBe(expected)
    expect(dialoguePresentationText(source)).toBe(expected)
  })
  it('keeps authored segment boundaries and playback order intact', () => {
    const segments = splitMainlineInteractionText('桌上摆放着牌位，香炉里的火还没有熄灭。')
    expect(segments).toEqual(['桌上摆放着牌位，', '香炉里的火还没有熄灭。'])
    expect(segments.map(mainlineVisiblePresentationText)).toEqual(['桌上摆放着牌位', '香炉里的火还没有熄灭'])
  })
})
