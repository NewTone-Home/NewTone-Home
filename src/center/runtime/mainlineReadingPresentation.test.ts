import { describe, expect, it } from 'vitest'
import {
  mainlineDialogueHandoffPresentationForId,
  mainlineReadingPresentationForPhase,
  type MainlineReadingPresentationSnapshot,
} from './mainlineReadingPresentation'

describe('dialogue handoff presentation', () => {
  it('freezes the exact third visible page with its original anchor and layout', () => {
    const pages: MainlineReadingPresentationSnapshot[] = [
      { sessionKey: 'line-a', anchorSessionKey: 'line-a', position: { x: 31, y: 40 }, cameraOffset: { x: 0, y: 0 }, layout: { widthPx: 220, heightPx: 68, fontSizePx: 16 }, maxWidthPx: 220, text: '第一页的内容', overflowIndex: 0 },
      { sessionKey: 'line-a', anchorSessionKey: 'line-a', position: { x: 31, y: 40 }, cameraOffset: { x: 0, y: 0 }, layout: { widthPx: 238, heightPx: 86, fontSizePx: 16 }, maxWidthPx: 238, text: '第二页的内容', overflowIndex: 1 },
      { sessionKey: 'line-a', anchorSessionKey: 'line-a', position: { x: 31, y: 40 }, cameraOffset: { x: 0, y: 0 }, layout: { widthPx: 246, heightPx: 104, fontSizePx: 16 }, maxWidthPx: 246, text: '第三页末尾独有的文字', overflowIndex: 2 },
    ]

    let retained: MainlineReadingPresentationSnapshot | null = null
    for (const page of pages) {
      retained = mainlineReadingPresentationForPhase('active', page.sessionKey, page, retained)
    }

    const outgoing = mainlineDialogueHandoffPresentationForId(12, null, retained)
    const incoming = pages[0] && { ...pages[0], sessionKey: 'line-b', text: '新说话人的首句' }
    const afterAdvance = mainlineDialogueHandoffPresentationForId(12, outgoing, incoming)

    expect(afterAdvance).toBe(outgoing)
    expect(afterAdvance?.presentation).toBe(pages[2])
    expect(afterAdvance?.presentation).toMatchObject({
      text: '第三页末尾独有的文字',
      overflowIndex: 2,
      position: { x: 31, y: 40 },
      layout: { widthPx: 246, heightPx: 104, fontSizePx: 16 },
    })
  })

  it('does not carry a previous handoff snapshot into a new handoff id', () => {
    const retained: MainlineReadingPresentationSnapshot = {
      sessionKey: 'line-b', position: { x: 54, y: 52 }, cameraOffset: { x: 0, y: 0 },
      layout: { widthPx: 210, heightPx: 72, fontSizePx: 16 }, maxWidthPx: 210,
      text: '新一轮目前显示的页面', overflowIndex: 0,
    }
    const previous = mainlineDialogueHandoffPresentationForId(12, null, null)

    expect(mainlineDialogueHandoffPresentationForId(13, previous, retained)).toEqual({ id: 13, presentation: retained })
    expect(mainlineDialogueHandoffPresentationForId(null, previous, retained)).toBeNull()
  })
})
