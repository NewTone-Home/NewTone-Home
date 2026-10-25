import { describe, expect, it } from 'vitest'
import { completeSpeakerAnimation, dialogueSpeakerTransitionMs, requestSpeaker, type SpeakerPresentation } from '../src/center/runtime/DialogueSpeaker'
import { mainlineSpeakerAnchor, mainlineSpeakerPageAnchor, mainlineEchoLayout } from '../src/center/runtime/mainlineEchoLayout'

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
    expect(anchor.left + anchor.worldWidthPx / 1920 * 100).toBeLessThanOrEqual(98)
    expect(mainlineEchoLayout('短句', metrics).widthPx).toBeLessThan(anchor.widthPx)
  })
})

describe('speaker page placement', () => {
  it.each([{ width: 1280, height: 720, scale: 1 }, { width: 411, height: 914, scale: .65 }])('aligns the visible speaker box to the current page while preserving the envelope center at $width', viewport => {
    const metrics = { width: viewport.width, height: viewport.height, viewportWidth: viewport.width }
    const lines = [
      { speaker: 'Speaker', text: 'A considerably longer dialogue page that defines the stable reading envelope.' },
      { speaker: 'Speaker', text: 'Short.' },
    ]
    const envelope = mainlineSpeakerAnchor(lines, metrics, { x: 52, y: 44 }, { x: 0, y: 0 }, viewport.scale, 520)
    const currentPage = mainlineEchoLayout('Short.', metrics, { speaker: 'Speaker', maxWidthPx: 520 })
    const visible = mainlineSpeakerPageAnchor(envelope, currentPage, viewport.scale)
    const envelopeCenter = envelope.left + envelope.worldWidthPx / 1920 * 50
    const visibleCenter = visible.left + visible.worldWidthPx / 1920 * 50

    expect(visibleCenter).toBeCloseTo(envelopeCenter, 8)
    expect(visible.widthPx).toBe(currentPage.widthPx)
    expect(visible.worldWidthPx).toBeCloseTo(currentPage.widthPx / viewport.scale, 8)
    expect(visible.left).toBeCloseTo(envelopeCenter - currentPage.widthPx / viewport.scale / 1920 * 50, 8)
    expect(visible.widthPx).toBeLessThan(envelope.widthPx)
    const fullPage = mainlineSpeakerPageAnchor(envelope, mainlineEchoLayout(lines[0].text, metrics, { speaker: 'Speaker', maxWidthPx: 520 }), viewport.scale)
    expect(fullPage.left).toBeCloseTo(envelope.left, 8)
  })
})
