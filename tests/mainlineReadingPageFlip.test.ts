import { describe, expect, it } from 'vitest'
import {
  interpolateMainlineReadingPageLayout,
  mainlineReadingPageFlipDurationMs,
  mainlineReadingPageRollEnvelope,
  previousMainlineReadingPageForFlip,
  snapshotMainlineReadingPage,
} from '../src/center/runtime/mainlineReadingPageFlip'

describe('mainline reading page snapshot and roll envelope', () => {
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
})
