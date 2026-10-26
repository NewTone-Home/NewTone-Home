import { describe, expect, it } from 'vitest'
import {
  interpolateMainlineReadingPageLayout,
  mainlineReadingPageFlipDurationMs,
  mainlineReadingPageRollEnvelope,
  previousMainlineReadingPageForFlip,
  settleMainlineReadingPageFlip,
  snapshotMainlineReadingPage,
} from '../src/center/runtime/mainlineReadingPageFlip'
import { mainlineReadingPageKey } from '../src/center/runtime/mainlineReadingPageKey'

describe('mainline reading page snapshot and roll envelope', () => {
  it('uses one page identity for the current session, authored segment, fitted page, and displayed text', () => {
    const current = mainlineReadingPageKey({ sessionKey: 'commercial-street:observation:echo:810:street-cafe-entry', segmentIndex: 1, overflowIndex: 0, text: '��ҳ' })
    expect(current).toBe('commercial-street:observation:echo:810:street-cafe-entry:1:0:��ҳ')
    expect(mainlineReadingPageKey({ sessionKey: 'commercial-street:observation:echo:811:street-cafe-entry', segmentIndex: 1, overflowIndex: 0, text: '��ҳ' })).not.toBe(current)
    expect(mainlineReadingPageKey({ sessionKey: 'commercial-street:observation:echo:810:street-cafe-entry', segmentIndex: 2, overflowIndex: 0, text: '��ҳ' })).not.toBe(current)
    expect(mainlineReadingPageKey({ sessionKey: 'commercial-street:observation:echo:810:street-cafe-entry', segmentIndex: 1, overflowIndex: 1, text: '��ҳ' })).not.toBe(current)
  })

  it('uses the faster reading-only roll duration without changing storefront timing', () => {
    expect(mainlineReadingPageFlipDurationMs).toBe(500)
  })

  it('freezes the exact outgoing visible text and its own layout', () => {
    const old = snapshotMainlineReadingPage({
      continuityKey: 'echo:1',
      pageKey: 'echo:1:0',
      visibleText: '旧句，已经显示到这里',
      layout: { widthPx: 280, heightPx: 61, fontSizePx: 16 },
      worldScale: 0.75,
    })

    expect(old.visibleText).toBe('旧句，已经显示到这里')
    expect(old.layout).toEqual({ widthPx: 280, heightPx: 61, fontSizePx: 16 })
    expect(previousMainlineReadingPageForFlip(old, { continuityKey: 'echo:1', pageKey: 'echo:1:1' })).toBe(old)
    expect(previousMainlineReadingPageForFlip(old, { continuityKey: 'echo:2', pageKey: 'echo:2:1' })).toBeNull()
    expect(previousMainlineReadingPageForFlip(old, { continuityKey: 'echo:1', pageKey: 'echo:1:0' })).toBeNull()
    expect(Object.isFrozen(old)).toBe(true)
    expect(Object.isFrozen(old.layout)).toBe(true)
  })

  it('keeps the outgoing clip dimensions through a long-to-short roll, then allows smooth resize', () => {
    const oldLayout = { widthPx: 320, heightPx: 76, fontSizePx: 16 }
    const nextLayout = { widthPx: 128, heightPx: 48, fontSizePx: 16 }
    const envelope = mainlineReadingPageRollEnvelope(oldLayout, nextLayout)

    expect(envelope).toEqual(oldLayout)
    expect(interpolateMainlineReadingPageLayout(oldLayout, envelope, 0.5)).toEqual(oldLayout)
    const afterRoll = interpolateMainlineReadingPageLayout(envelope, nextLayout, 0.5)
    expect(afterRoll.widthPx).toBeLessThan(oldLayout.widthPx)
    expect(afterRoll.widthPx).toBeGreaterThan(nextLayout.widthPx)
    expect(afterRoll.heightPx).toBeLessThan(oldLayout.heightPx)
    expect(afterRoll.heightPx).toBeGreaterThan(nextLayout.heightPx)
    expect(afterRoll.fontSizePx).toBe(16)
  })

  it('expands the shared clip envelope when the incoming page is larger', () => {
    const oldLayout = { widthPx: 128, heightPx: 48, fontSizePx: 16 }
    const nextLayout = { widthPx: 320, heightPx: 76, fontSizePx: 16 }
    const envelope = mainlineReadingPageRollEnvelope(oldLayout, nextLayout)

    expect(envelope).toEqual(nextLayout)
    const midway = interpolateMainlineReadingPageLayout(oldLayout, envelope, 0.5)
    expect(midway.widthPx).toBeGreaterThan(oldLayout.widthPx)
    expect(midway.widthPx).toBeLessThan(nextLayout.widthPx)
    expect(midway.heightPx).toBeGreaterThan(oldLayout.heightPx)
    expect(midway.heightPx).toBeLessThan(nextLayout.heightPx)
  })

  it('keeps punctuation, multiline text, and outgoing dimensions immutable across the full roll', () => {
    const old = snapshotMainlineReadingPage({
      continuityKey: 'dialogue:session-a',
      pageKey: 'dialogue:session-a:page-0',
      visibleText: '第一行，旧句还在这里，\n第二行也保持原样。',
      layout: { widthPx: 312, heightPx: 84, fontSizePx: 18 },
      worldScale: .65,
    })
    const shorterNext = { continuityKey: old.continuityKey, pageKey: 'dialogue:session-a:page-1' }

    for (let elapsed = 0; elapsed <= mainlineReadingPageFlipDurationMs; elapsed += 16) {
      const outgoing = previousMainlineReadingPageForFlip(old, shorterNext)
      expect(outgoing).toBe(old)
      expect(outgoing?.visibleText).toBe('第一行，旧句还在这里，\n第二行也保持原样。')
      expect(outgoing?.layout).toEqual({ widthPx: 312, heightPx: 84, fontSizePx: 18 })
      expect(mainlineReadingPageRollEnvelope(outgoing!.layout, { widthPx: 80, heightPx: 38, fontSizePx: 18 })).toEqual(old.layout)
    }
  })

  it('releases the immutable outgoing snapshot when the flip settles, including reduced-motion completion', () => {
    const old = snapshotMainlineReadingPage({
      continuityKey: 'dialogue:reduced',
      pageKey: 'dialogue:reduced:0',
      visibleText: '旧页内容。',
      layout: { widthPx: 160, heightPx: 48, fontSizePx: 16 },
      worldScale: 1,
    })
    const rolling = { key: 'dialogue:reduced:1', continuityKey: 'dialogue:reduced', previous: old, flipping: true }

    expect(settleMainlineReadingPageFlip(rolling, 'dialogue:reduced:1')).toEqual({
      ...rolling,
      previous: null,
      flipping: false,
    })
    expect(settleMainlineReadingPageFlip(rolling, 'dialogue:reduced:0')).toBe(rolling)
  })
})
