import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineReadingSessionLayoutCache, mainlineReadingSessionMaxMeasuredWidths } from '../src/center/runtime/mainlineReadingLayoutSession'
import { mainlineEchoLayout } from '../src/center/runtime/mainlineEchoLayout'
import { splitMainlineInteractionTextToFit } from '../src/center/runtime/mainlineTextSegments'

describe('mainline reading session layout cache', () => {
  it('measures the session text budget once and reuses it for pages, movement, and viewport projection changes', () => {
    let measureCalls = 0
    let layoutCalls = 0
    let splitCalls = 0
    const measureText = (text: string, fontSizePx: number) => {
      measureCalls += 1
      return Array.from(text).length * fontSizePx
    }
    const entries = [
      { text: '这是一段较长的观察文字，包含两页内容。' },
      { text: '短句。' },
      { text: '说话人', speaker: '店员甲' },
    ] as const
    const cache = createMainlineReadingSessionLayoutCache({
      sessionKey: 'echo:reading-1',
      entries,
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      maximumWidthPx: 220,
      fontKey: 'font-ready',
      measureText,
      layoutText: (...args) => { layoutCalls += 1; return mainlineEchoLayout(...args) },
      splitTextToFit: (...args) => { splitCalls += 1; return splitMainlineInteractionTextToFit(...args) },
    })
    const initialCalls = measureCalls
    const initialEnvelope = cache.envelopeAtOrBelow(220)
    const scene = mainlineScenes['commercial-street']
    const fitInput = {
      scene,
      source: { x: 50, y: 50 },
      text: entries[0].text,
      maximumWidthPx: 180,
      protectedVisuals: [],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      worldScale: .65,
      cameraOffset: { x: 0, y: 0 },
    }

    cache.fit(fitInput)
    const sessionSetupCounts = { measureCalls, layoutCalls, splitCalls }
    cache.fit({ ...fitInput, cameraOffset: { x: 4, y: -2 }, protectedVisuals: [{ x: 48, y: 48, width: 4, height: 4 }] })
    cache.fit({ ...fitInput, maximumWidthPx: 150, metrics: { width: 360, height: 844, viewportWidth: 360 }, worldScale: .65 })
    cache.envelopeAtOrBelow(150)
    cache.pageLayoutAtOrBelow(entries[0].text, undefined, 150, 0)
    cache.addEntries(entries)
    const countsAfterSetup = cache.counts
    for (let frame = 0; frame < 60; frame += 1) {
      const offset = { x: frame * .4, y: -frame * .25 }
      const activeText = entries[frame % entries.length]!
      cache.fit({
        ...fitInput,
        text: activeText.text,
        speaker: activeText.speaker,
        cameraOffset: offset,
        protectedVisuals: [{ x: 40 + frame * .01, y: 42, width: 3, height: 5 }],
      })
    }

    expect(initialCalls).toBeGreaterThan(0)
    expect({ measureCalls, layoutCalls, splitCalls }).toEqual(sessionSetupCounts)
    expect(cache.counts.fitCalls).toBe(countsAfterSetup.fitCalls + 60)
    expect(cache.counts.splitCalls).toBe(countsAfterSetup.splitCalls)
    expect(cache.counts.layoutCalls).toBe(countsAfterSetup.layoutCalls)
    expect(cache.counts.textMeasureCalls).toBe(countsAfterSetup.textMeasureCalls)
    expect(cache.envelopeAtOrBelow(220)).toEqual(initialEnvelope)
  })

  it('measures only newly introduced text and keeps the prior envelope unless the new text exceeds it', () => {
    let measureCalls = 0
    const measureText = (text: string, fontSizePx: number) => {
      measureCalls += 1
      return Array.from(text).length * fontSizePx
    }
    const cache = createMainlineReadingSessionLayoutCache({
      sessionKey: 'dialogue:line-budget',
      entries: [{ text: '原有最长句子包含多行文字。', speaker: '店员' }],
      metrics: { width: 1920, height: 1080, viewportWidth: 1920 },
      maximumWidthPx: 360,
      measureText,
    })
    const initialCalls = measureCalls
    const initialEnvelope = cache.envelopeAtOrBelow(360)

    expect(cache.addEntries([{ text: '短句。' }])).toBe(1)
    const afterShortCalls = measureCalls
    expect(afterShortCalls).toBeGreaterThan(initialCalls)
    expect(cache.envelopeAtOrBelow(360)).toEqual(initialEnvelope)
    expect(cache.addEntries([{ text: '短句。' }, { text: '原有最长句子包含多行文字。', speaker: '店员' }])).toBe(0)
    expect(measureCalls).toBe(afterShortCalls)

    cache.addEntries([{ text: '这是在同一会话里后来新增的超长内容'.repeat(12) }])
    const expandedEnvelope = cache.envelopeAtOrBelow(360)
    expect(measureCalls).toBeGreaterThan(afterShortCalls)
    expect(expandedEnvelope.heightPx).toBeGreaterThanOrEqual(initialEnvelope.heightPx)
  })

  it('creates a fresh measurement budget for a new reading session', () => {
    let measureCalls = 0
    const measureText = (text: string, fontSizePx: number) => {
      measureCalls += 1
      return Array.from(text).length * fontSizePx
    }
    const common = {
      entries: [{ text: '新会话文字。' }],
      metrics: { width: 1280, height: 800, viewportWidth: 1280 },
      maximumWidthPx: 300,
      measureText,
    } as const
    const first = createMainlineReadingSessionLayoutCache({ ...common, sessionKey: 'echo:1' })
    const afterFirst = measureCalls
    const second = createMainlineReadingSessionLayoutCache({ ...common, sessionKey: 'echo:2' })

    expect(second.sessionKey).not.toBe(first.sessionKey)
    expect(measureCalls).toBeGreaterThan(afterFirst)
  })

  it('bounds retained session text entries while keeping the active text available', () => {
    let measureCalls = 0
    const cache = createMainlineReadingSessionLayoutCache({
      sessionKey: 'echo:bounded',
      entries: [{ text: '初始。' }],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      maximumWidthPx: 88,
      measureText: (text, fontSizePx) => { measureCalls += 1; return Array.from(text).length * fontSizePx },
    })
    for (let index = 0; index < 140; index += 1) cache.addEntries([{ text: `动态段落${index}。` }])
    const retainedText = '当前可见页。'
    cache.fit({
      scene: mainlineScenes['commercial-street'],
      source: { x: 50, y: 50 },
      text: retainedText,
      maximumWidthPx: 88,
      protectedVisuals: [],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      worldScale: .65,
      cameraOffset: { x: 0, y: 0 },
    })

    expect(cache.cachedTextCount).toBe(128)
    expect(cache.pageLayoutAtOrBelow(retainedText, undefined, 88)).toBeTruthy()
    expect(measureCalls).toBeGreaterThan(0)
  })

  it('bounds the per-session canvas width memo even when a splitter probes many unique strings', () => {
    let measureCalls = 0
    const cache = createMainlineReadingSessionLayoutCache({
      sessionKey: 'echo:bounded-measurements',
      entries: [{ text: 'short' }],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      maximumWidthPx: 64,
      measureText: () => { measureCalls += 1; return 1 },
      splitTextToFit: (text, _width, _fontSize, measure) => {
        for (let index = 0; index <= mainlineReadingSessionMaxMeasuredWidths; index += 1) measure(`probe-${index}`)
        return [text]
      },
    })

    expect(measureCalls).toBeGreaterThan(mainlineReadingSessionMaxMeasuredWidths)
    expect(cache.cachedMeasureCount).toBeLessThanOrEqual(mainlineReadingSessionMaxMeasuredWidths)
  })
})
