import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineReadingSessionLayoutCache, mainlineReadingSessionMaxMeasuredWidths } from '../src/center/runtime/mainlineReadingLayoutSession'
import { subscribeToMainlineReadingFontCompletion } from '../src/center/runtime/useMainlineReadingFontRevision'
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

  it('retains all authored text entries for a long session without remeasuring old pages', () => {
    let measureCalls = 0
    let splitCalls = 0
    const cache = createMainlineReadingSessionLayoutCache({
      sessionKey: 'echo:long-session',
      entries: [{ text: 'start' }],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      maximumWidthPx: 88,
      measureText: (text, fontSizePx) => { measureCalls += 1; return Array.from(text).length * fontSizePx },
      splitTextToFit: (...args) => { splitCalls += 1; return splitMainlineInteractionTextToFit(...args) },
    })
    const entries = Array.from({ length: 140 }, (_, index) => ({ text: `segment-${index}` }))
    for (const entry of entries) cache.addEntries([entry])
    const countsAfterFirstPass = { measureCalls, splitCalls, layoutCalls: cache.counts.layoutCalls }
    const oldestText = entries[0]!.text
    cache.addEntries([{ text: oldestText }])
    cache.fit({
      scene: mainlineScenes['commercial-street'],
      source: { x: 50, y: 50 },
      text: oldestText,
      maximumWidthPx: 88,
      protectedVisuals: [],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      worldScale: .65,
      cameraOffset: { x: 0, y: 0 },
    })

    expect(cache.cachedTextCount).toBe(141)
    expect(cache.pageLayoutAtOrBelow(oldestText, undefined, 88)).toBeTruthy()
    expect({ measureCalls, splitCalls, layoutCalls: cache.counts.layoutCalls }).toEqual(countsAfterFirstPass)
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

  it('rebuilds font metrics once when loading fonts complete and removes the listener', async () => {
    const listeners = new Set<EventListener>()
    let resolveReady!: (value: FontFaceSet) => void
    const fakeFonts = {
      status: 'loading',
      ready: new Promise<FontFaceSet>(resolve => { resolveReady = resolve }),
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.add(listener as EventListener) },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.delete(listener as EventListener) },
    } as unknown as FontFaceSet
    let completed = 0
    subscribeToMainlineReadingFontCompletion(true, () => { completed += 1 }, fakeFonts)
    const listener = [...listeners][0]!
    listener(new Event('loadingdone'))
    resolveReady(fakeFonts)
    await Promise.resolve()

    expect(completed).toBe(1)
    expect(listeners.size).toBe(0)
  })

  it('does not listen for font completion when inactive or fonts are already ready', () => {
    const listeners = new Set<EventListener>()
    const fakeFonts = {
      status: 'loaded',
      ready: Promise.resolve(null),
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.add(listener as EventListener) },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.delete(listener as EventListener) },
    } as unknown as FontFaceSet

    subscribeToMainlineReadingFontCompletion(true, () => undefined, fakeFonts)
    subscribeToMainlineReadingFontCompletion(false, () => undefined, fakeFonts)
    expect(listeners.size).toBe(0)
  })

  it('does not rebuild after a reading session ends before fonts finish loading', async () => {
    const listeners = new Set<EventListener>()
    let resolveReady!: (value: FontFaceSet) => void
    const fakeFonts = {
      status: 'loading',
      ready: new Promise<FontFaceSet>(resolve => { resolveReady = resolve }),
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.add(listener as EventListener) },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.delete(listener as EventListener) },
    } as unknown as FontFaceSet
    let completed = 0
    const cleanup = subscribeToMainlineReadingFontCompletion(true, () => { completed += 1 }, fakeFonts)
    cleanup()
    resolveReady(fakeFonts)
    await Promise.resolve()

    expect(completed).toBe(0)
    expect(listeners.size).toBe(0)
  })

})
