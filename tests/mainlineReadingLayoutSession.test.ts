import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineReadingSessionLayoutCache, mainlineReadingMeasurementKey, mainlineObservationMinimumPageHeight, mainlineReadingSessionMaxMeasuredWidths } from '../src/center/runtime/mainlineReadingLayoutSession'
import { subscribeToMainlineReadingFontCompletion } from '../src/center/runtime/useMainlineReadingFontRevision'
import { mainlineEchoLayout } from '../src/center/runtime/mainlineEchoLayout'
import { mainlineReadingCameraOffset } from '../src/center/runtime/mainlineTextReading'
import { mainlineReadingPageIndexForSourceOffset } from '../src/center/runtime/mainlineReadingProtection'
import { splitMainlineInteractionTextToFit } from '../src/center/runtime/mainlineTextSegments'

describe('mainline reading session layout cache', () => {
  it('keeps formal dialogue boxes at the session width for short and long lines', () => {
    const cache = createMainlineReadingSessionLayoutCache({
      sessionKey: 'dialogue:fixed-width',
      entries: [{ text: 'Short.', speaker: 'Speaker' }, { text: 'A much longer line of dialogue.', speaker: 'Speaker' }],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      maximumWidthPx: 180,
      measureText: (text, size) => Array.from(text).length * size,
    })

    const shortWidth = cache.pageLayoutAtOrBelow('Short.', 'Speaker', 180)!.widthPx
    const longWidth = cache.pageLayoutAtOrBelow('A much longer line of dialogue.', 'Speaker', 72)!.widthPx
    expect(shortWidth).toBe(180)
    expect(longWidth).toBe(shortWidth)
  })

  it('keeps the source character offset when a resized dialogue session creates new page boundaries', () => {
    const text = Array.from({ length: 954 }, (_, index) => String.fromCharCode(0x4e00 + index)).join('')
    const desktop = createMainlineReadingSessionLayoutCache({
      sessionKey: 'dialogue:resize-offset',
      entries: [{ text, speaker: 'Speaker' }],
      metrics: { width: 1280, height: 800, viewportWidth: 1280 },
      maximumWidthPx: 360,
    })
    const desktopSegments = desktop.fit({
      scene: mainlineScenes['commercial-street'],
      source: { x: 50, y: 50 }, text, speaker: 'Speaker', maximumWidthPx: 360,
      protectedVisuals: [], metrics: { width: 1280, height: 800, viewportWidth: 1280 },
      worldScale: .65, cameraOffset: { x: 0, y: 0 },
    }).segments
    const sourceOffset = desktopSegments[0]!.length
    const resized = createMainlineReadingSessionLayoutCache({
      sessionKey: 'dialogue:resize-offset',
      entries: [{ text, speaker: 'Speaker' }],
      metrics: { width: 411, height: 914, viewportWidth: 411 },
      maximumWidthPx: 180,
    })
    const resizedSegments = resized.fit({
      scene: mainlineScenes['commercial-street'],
      source: { x: 50, y: 50 }, text, speaker: 'Speaker', maximumWidthPx: 180,
      protectedVisuals: [], metrics: { width: 411, height: 914, viewportWidth: 411 },
      worldScale: .65, cameraOffset: { x: 0, y: 0 }, sourceOffset,
    }).segments

    expect(resizedSegments.join('')).toBe(text)
    const currentPageIndex = mainlineReadingPageIndexForSourceOffset(resizedSegments, sourceOffset)
    expect(resizedSegments.slice(0, currentPageIndex).join('').length).toBe(sourceOffset)
    expect(resizedSegments.slice(currentPageIndex).join('')).toBe(text.slice(sourceOffset))
  })

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

    const initialSegments = cache.fit(fitInput).segments
    expect(cache.fit({ ...fitInput, cameraOffset: { x: 4, y: -2 } }).segments).toEqual(initialSegments)
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

  it('consumes a loading-to-loaded transition that happens before effect subscription exactly once', async () => {
    const listeners = new Set<EventListener>()
    let resolveReady!: (value: FontFaceSet) => void
    let status: FontFaceSetLoadStatus = 'loading'
    const fakeFonts = {
      get status() { return status },
      ready: new Promise<FontFaceSet>(resolve => { resolveReady = resolve }),
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.add(listener as EventListener) },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.delete(listener as EventListener) },
    } as unknown as FontFaceSet
    let completed = 0
    status = 'loaded'
    subscribeToMainlineReadingFontCompletion(true, () => { completed += 1 }, fakeFonts, 'loading')
    resolveReady(fakeFonts)
    await Promise.resolve()

    expect(completed).toBe(1)
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


describe('whole observation layout', () => {
  it.each([{ width: 1920, height: 1080, viewportWidth: 1920 }, { width: 411, height: 914, viewportWidth: 411 }])('keeps short multi-line observations together on $width', metrics => {
    const text = '第一句内容。\n第二句内容。'
    const cache = createMainlineReadingSessionLayoutCache({ sessionKey: 'observation', entries: [{ text }], metrics, maximumWidthPx: 180, preferWholeText: true, measureText: (value, size) => Array.from(value).length * size })
    const scene = mainlineScenes['zhongshuyuan-office']
    const fit = cache.fit({ scene, source: scene.initialPlayerPosition, text, maximumWidthPx: 180, protectedVisuals: [], metrics, worldScale: .65, cameraOffset: mainlineReadingCameraOffset(scene, scene.initialPlayerPosition, metrics, .65, { x: 0, y: 0 }) })
    expect(fit.segments).toEqual([text])
    expect(fit.layout.heightPx).toBeGreaterThan(fit.layout.fontSizePx * 2)
  })
  it('splits a very long observation if the whole text does not fit', () => {
    const metrics = { width: 411, height: 914, viewportWidth: 411 }
    const text = '一段较长的合成观察文字，'.repeat(150)
    const cache = createMainlineReadingSessionLayoutCache({ sessionKey: 'observation', entries: [{ text }], metrics, maximumWidthPx: 180, preferWholeText: true, measureText: (value, size) => Array.from(value).length * size })
    const scene = mainlineScenes['zhongshuyuan-office']
    const fit = cache.fit({ scene, source: scene.initialPlayerPosition, text, maximumWidthPx: 180, protectedVisuals: [], metrics, worldScale: .65, cameraOffset: mainlineReadingCameraOffset(scene, scene.initialPlayerPosition, metrics, .65, { x: 0, y: 0 }) })
    expect(fit.segments.length).toBeGreaterThan(1)
    expect(fit.segments.join('')).toBe(text)
    expect(fit.fits).toBe(true)
    expect(fit.pageLayouts.some(page => page.heightPx > page.fontSizePx * 3)).toBe(true)
    const moved = cache.fit({ scene, source: scene.initialPlayerPosition, text, maximumWidthPx: 80, protectedVisuals: [], metrics, worldScale: .65, cameraOffset: { x: -999, y: 999 } })
    expect(moved.segments).toEqual(fit.segments)
    expect(moved.pageLayouts).toEqual(fit.pageLayouts)
    const offset = fit.segments[0]!.length
    const resizedMetrics = { width: 411, height: 1000, viewportWidth: 411 }
    const resized = cache.fit({ scene, source: scene.initialPlayerPosition, text, maximumWidthPx: 180, protectedVisuals: [], metrics: resizedMetrics, worldScale: .65, cameraOffset: mainlineReadingCameraOffset(scene, scene.initialPlayerPosition, resizedMetrics, .65, { x: 0, y: 0 }), sourceOffset: offset })
    expect(resized.segments.join('')).toBe(text)
    expect(resized.segments.some((_, index) => resized.segments.slice(0, index).join('').length === offset)).toBe(true)
  })
})


describe('observation resize and no-space fallback', () => {
  it('keys measurements by viewport and scale, independent of camera or actor position', () => {
    const desktop = { width: 1920, height: 1080, viewportWidth: 1920 }
    const mobile = { width: 411, height: 914, viewportWidth: 411 }
    expect(mainlineReadingMeasurementKey(desktop, .65)).not.toBe(mainlineReadingMeasurementKey(mobile, .65))
    expect(mainlineReadingMeasurementKey(mobile, .65)).not.toBe(mainlineReadingMeasurementKey(mobile, 1))
    const cache = createMainlineReadingSessionLayoutCache({ sessionKey: 'observation', entries: [{ text: '一段测试文字' }], metrics: mobile, maximumWidthPx: 200, worldScale: .65, preferWholeText: true })
    expect(cache.measurementKey).toBe(mainlineReadingMeasurementKey(mobile, .65))
    expect(cache.fontSizePx).toBe(12)
  })
  it('preserves the current source boundary when all protected space is blocked', () => {
    const metrics = { width: 411, height: 914, viewportWidth: 411 }
    const text = '第一部分内容第二部分内容第三部分内容'
    const cache = createMainlineReadingSessionLayoutCache({ sessionKey: 'observation', entries: [{ text }], metrics, maximumWidthPx: 120, worldScale: .65, preferWholeText: true, measureText: (value, size) => value.length * size })
    const scene = mainlineScenes['zhongshuyuan-office']
    const source = scene.initialPlayerPosition
    const offset = 4
    const fit = cache.fit({ scene, source, text, sourceOffset: offset, maximumWidthPx: 120, protectedVisuals: [{ x: -1000, y: -1000, width: 2000, height: 2000 }], metrics, worldScale: .65, cameraOffset: mainlineReadingCameraOffset(scene, source, metrics, .65, { x: 0, y: 0 }) })
    expect(fit.fits).toBe(false)
    expect(fit.segments.join('')).toBe(text)
    expect(fit.segments.some((_, i) => fit.segments.slice(0, i).join('').length === offset)).toBe(true)
    fit.segments.forEach((page, i) => {
      const fragments = splitMainlineInteractionTextToFit(page, Math.max(12, fit.maxWidthPx - 40), 12, value => value.length * 12)
      expect(fit.pageLayouts[i]!.heightPx).toBeGreaterThanOrEqual(mainlineObservationMinimumPageHeight(fragments, 12, true))
    })
  })
})


describe('observation line-height budget', () => {
  it('reserves a line for each measured width fragment, including punctuation breaks', () => {
    const chunks = ['第一句，', '第二句，', '第三句。']
    const wholeWidthEstimate = mainlineEchoLayout(chunks.join(''), { width: 411, height: 914, viewportWidth: 411 }, { maxWidthPx: 267.2, measureText: (value, size) => value.length * size })
    const safeHeight = mainlineObservationMinimumPageHeight(chunks, 12, true)
    expect(safeHeight).toBe(65)
    expect(safeHeight).toBeGreaterThan(wholeWidthEstimate.heightPx)
  })
  it('keeps the full source and reserves fragment-height on a long mobile observation', () => {
    const metrics = { width: 411, height: 914, viewportWidth: 411 }
    const text = '这段测试文字需要在窄屏中拆成多个阅读页，以验证打字机补全先于分页推进。'.repeat(30)
    const measureText = (value: string, size: number) => value.length * size
    const cache = createMainlineReadingSessionLayoutCache({ sessionKey: 'observation', entries: [{ text }], metrics, maximumWidthPx: 267.2, worldScale: .65, preferWholeText: true, measureText })
    const scene = mainlineScenes['zhongshuyuan-office']
    const source = scene.initialPlayerPosition
    const fit = cache.fit({ scene, source, text, maximumWidthPx: 267.2, protectedVisuals: [], metrics, worldScale: .65, cameraOffset: mainlineReadingCameraOffset(scene, source, metrics, .65, { x: 0, y: 0 }) })
    expect(fit.fits).toBe(true)
    expect(fit.segments.join('')).toBe(text)
    fit.segments.forEach((page, index) => {
      const chunks = splitMainlineInteractionTextToFit(page, Math.max(12, fit.maxWidthPx - 40), 12, value => measureText(value, 12))
      expect(fit.pageLayouts[index]!.heightPx).toBeGreaterThanOrEqual(mainlineObservationMinimumPageHeight(chunks, 12, true))
    })
  })
})


describe('observation line budget on every path', () => {
  it('does not count a newline twice across fragment boundaries', () => {
    const height = (chunks: string[]) => mainlineObservationMinimumPageHeight(chunks, 12, true)
    expect(height(['一\n', '二'])).toBe(47)
    expect(height(['一\n', '\n二'])).toBe(65)
    expect(height(['一\r', '\n二'])).toBe(47)
    expect(height(['一', '二'])).toBe(47)
  })
  it('uses the safe height for fallback pages and preserves the source offset', () => {
    const metrics = { width: 411, height: 914, viewportWidth: 411 }
    const text = '第一部分，第二部分，第三部分，第四部分，第五部分，第六部分'
    const measureText = (value: string, size: number) => value.length * size
    const cache = createMainlineReadingSessionLayoutCache({ sessionKey: 'fallback', entries: [{ text }, { text: '额外很长的一段'.repeat(300) }], metrics, maximumWidthPx: 120, worldScale: .65, preferWholeText: true, measureText })
    const scene = mainlineScenes['zhongshuyuan-office']
    const source = scene.initialPlayerPosition
    const fit = cache.fit({ scene, source, text, sourceOffset: 4, maximumWidthPx: 120, protectedVisuals: [{ x: -100, y: -100, width: 1, height: 1 }], metrics, worldScale: .65, cameraOffset: mainlineReadingCameraOffset(scene, source, metrics, .65, { x: 0, y: 0 }) })
    expect(fit.fits).toBe(true)
    expect(fit.segments.join('')).toBe(text)
    expect(fit.segments.some((_, i) => fit.segments.slice(0, i).join('').length === 4)).toBe(true)
    fit.segments.forEach((page, i) => {
      const fragments = splitMainlineInteractionTextToFit(page, Math.max(12, fit.maxWidthPx - 40), 12, value => measureText(value, 12))
      expect(fit.pageLayouts[i]!.heightPx).toBeGreaterThanOrEqual(mainlineObservationMinimumPageHeight(fragments, 12, true))
    })
  })
})
