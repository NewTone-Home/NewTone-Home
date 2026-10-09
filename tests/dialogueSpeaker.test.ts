import { describe, expect, it } from 'vitest'
import { completeSpeakerAnimation, dialogueSpeakerTransitionMs, requestSpeaker, type SpeakerPresentation } from '../src/center/runtime/DialogueSpeaker'
import { mainlineSpeakerAnchor, mainlineEchoLayout } from '../src/center/runtime/mainlineEchoLayout'

describe('speaker presentation', () => {
  const initial: SpeakerPresentation = { name: '修杰', phase: 'steady' }
  it('does not animate an unchanged name', () => expect(requestSpeaker(initial, '修杰')).toBe(initial))
  it('fades out then fades in a replacement over 260ms', () => {
    const leaving = requestSpeaker(initial, '老周')
    expect(leaving).toEqual({ name: '修杰', phase: 'exiting' })
    expect(completeSpeakerAnimation(leaving, '老周')).toEqual({ name: '老周', phase: 'entering' })
    expect(dialogueSpeakerTransitionMs).toBe(260)
  })
  it('consumes only the latest rapid replacement', () => {
    const leaving = requestSpeaker(initial, '老周')
    expect(requestSpeaker(leaving, '店员')).toBe(leaving)
    expect(completeSpeakerAnimation(leaving, '店员')).toEqual({ name: '店员', phase: 'entering' })
  })
  it('cancels replacement when the original speaker returns', () => expect(requestSpeaker(requestSpeaker(initial, '老周'), '修杰')).toEqual(initial))
  it('handles first appearance and clearing', () => {
    expect(requestSpeaker({ name: '', phase: 'steady' }, 'English Speaker')).toEqual({ name: 'English Speaker', phase: 'entering' })
    expect(completeSpeakerAnimation(requestSpeaker(initial, ''), '')).toEqual({ name: '', phase: 'steady' })
  })
  it.each([{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }])('anchors the reading envelope independently of segment width at $width', metrics => {
    const lines = [{ speaker: '一个较长的中文名字', text: '长句中的文字用来定义整个对话的阅读范围。短句。' }, { speaker: 'English Speaker', text: '好。' }]
    const anchor = mainlineSpeakerAnchor(lines, metrics, { x: 50, y: 50 }, { x: 0, y: 0 })
    expect(anchor.left).toBeGreaterThanOrEqual(2)
    expect(anchor.left + anchor.widthPx / metrics.width * 100).toBeLessThanOrEqual(98)
    expect(mainlineEchoLayout('短句', metrics).widthPx).toBeLessThan(anchor.widthPx)
  })
})
