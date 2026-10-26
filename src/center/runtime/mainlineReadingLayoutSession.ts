import type { CollisionBox, Point } from './sceneGeometry'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { mainlineEchoLayout, type MainlineEchoLayout } from './mainlineEchoLayout'
import { mainlineReadingFontSizePx } from './mainlineTextReading'
import { mainlinePlaceReadingBox } from './mainlineReadingProtection'
import { mainlineMeasuredTextWidth, splitMainlineInteractionTextToFit } from './mainlineTextSegments'

export type MainlineReadingCachedPages = Readonly<{
  segments: readonly string[]
  layouts: readonly MainlineEchoLayout[]
}>
export type MainlineReadingSessionTextEntry = Readonly<{ text: string; speaker?: string }>
export type MainlineReadingSessionLayoutCounts = Readonly<{
  fitCalls: number
  splitCalls: number
  layoutCalls: number
  textMeasureCalls: number
}>
export const mainlineReadingSessionMaxMeasuredWidths = 32_768

type WidthCandidate = {
  widthPx: number
  pages: Map<string, MainlineReadingCachedPages>
  envelopeLayout: MainlineEchoLayout
  speakerWidthPx: number
}

export type MainlineReadingSessionLayoutCache = {
  readonly sessionKey: string
  readonly fontKey: string
  readonly fontSizePx: number
  readonly metrics: SceneScreenMetrics
  readonly widths: readonly WidthCandidate[]
  readonly maxMeasuredTextWidthPx: number
  readonly cachedTextCount: number
  readonly cachedMeasureCount: number
  readonly counts: MainlineReadingSessionLayoutCounts
  pageLayoutAtOrBelow(text: string, speaker: string | undefined, maximumWidthPx: number, pageIndex?: number): MainlineEchoLayout | null
  addEntries(entries: readonly MainlineReadingSessionTextEntry[]): number
  envelopeAtOrBelow(maximumWidthPx: number): MainlineEchoLayout
  speakerWidthAtOrBelow(maximumWidthPx: number): number
  fit(input: {
    scene: MainlineSceneDefinition
    source: Point
    text: string
    speaker?: string
    maximumWidthPx: number
    protectedVisuals: readonly CollisionBox[]
    metrics: SceneScreenMetrics
    worldScale: number
    cameraOffset: Point
  }): { segments: readonly string[]; pageLayouts: readonly MainlineEchoLayout[]; position: Point; layout: MainlineEchoLayout; maxWidthPx: number; fits: boolean }
}

/**
 * Build the text-measurement budget once for a reading session. Width/height
 * placement remains live, but page splitting and canvas measurements are
 * retained. The supplied measurement hook exists for deterministic call-count
 * tests; production uses the same canvas measurement function as the renderer.
 */
export function createMainlineReadingSessionLayoutCache(input: {
  sessionKey: string
  entries: readonly MainlineReadingSessionTextEntry[]
  metrics: SceneScreenMetrics
  maximumWidthPx: number
  fontKey?: string
  measureText?: (text: string, fontSizePx: number) => number
  layoutText?: typeof mainlineEchoLayout
  splitTextToFit?: typeof splitMainlineInteractionTextToFit
}): MainlineReadingSessionLayoutCache {
  const metrics = { ...input.metrics }
  const fontSizePx = mainlineReadingFontSizePx(metrics)
  const minimumWidthPx = fontSizePx * 2 + 32
  const stepPx = Math.max(4, fontSizePx / 2)
  const widths: WidthCandidate[] = []
  const knownEntries = new Map<string, MainlineReadingSessionTextEntry>()
  const measuredWidths = new Map<string, number>()
  const counts = { fitCalls: 0, splitCalls: 0, layoutCalls: 0, textMeasureCalls: 0 }
  const entryKey = ({ text, speaker }: MainlineReadingSessionTextEntry) => JSON.stringify([text, speaker ?? null])
  const measure = (text: string, size: number) => {
    const key = `${size}\u0000${text}`
    const cached = measuredWidths.get(key)
    if (cached !== undefined) return cached
    if (measuredWidths.size >= mainlineReadingSessionMaxMeasuredWidths) measuredWidths.clear()
    counts.textMeasureCalls += 1
    const result = (input.measureText ?? mainlineMeasuredTextWidth)(text, size)
    measuredWidths.set(key, result)
    return result
  }
  const layoutText = input.layoutText ?? mainlineEchoLayout
  const splitTextToFit = input.splitTextToFit ?? splitMainlineInteractionTextToFit
  let maxMeasuredTextWidthPx = 0

  const makeCandidate = (widthPx: number): WidthCandidate => ({ widthPx, pages: new Map(), envelopeLayout: { widthPx: 0, heightPx: 0, fontSizePx }, speakerWidthPx: 0 })
  for (let widthPx = input.maximumWidthPx; widthPx >= minimumWidthPx; widthPx -= stepPx) widths.push(makeCandidate(widthPx))
  if (widths.length === 0) widths.push(makeCandidate(minimumWidthPx))

  const populate = (candidate: WidthCandidate, entry: MainlineReadingSessionTextEntry) => {
    const { text, speaker } = entry
    const key = entryKey(entry)
    if (candidate.pages.has(key)) return
    counts.splitCalls += 1
    const segments = splitTextToFit(text, Math.max(fontSizePx, candidate.widthPx - 40), fontSizePx, value => measure(value, fontSizePx))
    const layouts = segments.map(segment => {
      counts.layoutCalls += 1
      return layoutText(segment, metrics, {
      speaker,
      maxWidthPx: candidate.widthPx,
      measureText: measure,
      })
    })
    counts.layoutCalls += 1
    const fullLayout = layoutText(text, metrics, {
      speaker,
      maxWidthPx: candidate.widthPx,
      measureText: measure,
    })
    candidate.pages.set(key, { segments, layouts })
    if (speaker) candidate.speakerWidthPx = Math.max(candidate.speakerWidthPx, ...layouts.map(layout => layout.widthPx))
    candidate.envelopeLayout = {
      widthPx: Math.max(candidate.envelopeLayout.widthPx, fullLayout.widthPx),
      heightPx: Math.max(candidate.envelopeLayout.heightPx, fullLayout.heightPx),
      fontSizePx,
    }
  }

  const addEntries = (entries: readonly MainlineReadingSessionTextEntry[]) => {
    let added = 0
    for (const entry of new Map(entries.map(value => [entryKey(value), value])).values()) {
      const key = entryKey(entry)
      if (knownEntries.has(key)) continue
      // Entries are scoped to one reading session and the cache is discarded
      // when that session ends. Keep every authored line so revisiting a line
      // in a long conversation cannot trigger layout work again.
      knownEntries.set(key, entry)
      added += 1
      for (const candidate of widths) populate(candidate, entry)
    }
    maxMeasuredTextWidthPx = Math.max(maxMeasuredTextWidthPx, ...[...measuredWidths.values()])
    return added
  }
  addEntries(input.entries)

  const cache: MainlineReadingSessionLayoutCache = {
    sessionKey: input.sessionKey,
    fontKey: input.fontKey ?? `${fontSizePx}:${metrics.width <= 600 && metrics.height > metrics.width ? 'compact' : 'regular'}`,
    fontSizePx,
    metrics,
    widths,
    get maxMeasuredTextWidthPx() { return maxMeasuredTextWidthPx },
    get cachedTextCount() { return knownEntries.size },
    get cachedMeasureCount() { return measuredWidths.size },
    get counts() { return { ...counts } },
    addEntries,
    pageLayoutAtOrBelow(text, speaker, maximumWidthPx, pageIndex = 0) {
      const candidate = widths.find(item => item.widthPx <= maximumWidthPx + .001) ?? widths[widths.length - 1]!
      return candidate.pages.get(entryKey({ text, speaker }))?.layouts[pageIndex] ?? null
    },
    envelopeAtOrBelow(maximumWidthPx) {
      return widths.find(candidate => candidate.widthPx <= maximumWidthPx + .001)?.envelopeLayout
        ?? widths[widths.length - 1]!.envelopeLayout
    },
    speakerWidthAtOrBelow(maximumWidthPx) {
      return widths.find(candidate => candidate.widthPx <= maximumWidthPx + .001)?.speakerWidthPx
        ?? widths[widths.length - 1]!.speakerWidthPx
    },
    fit(fitInput) {
      counts.fitCalls += 1
      addEntries([{ text: fitInput.text, speaker: fitInput.speaker }])
      for (const candidate of widths) {
        if (candidate.widthPx > fitInput.maximumWidthPx + .001) continue
        const page = candidate.pages.get(entryKey({ text: fitInput.text, speaker: fitInput.speaker }))!
        const layout = page.layouts[0] ?? layoutText(fitInput.text, metrics, { speaker: fitInput.speaker, maxWidthPx: candidate.widthPx, measureText: measure })
        const envelope = candidate.envelopeLayout
        const position = mainlinePlaceReadingBox(fitInput.scene, fitInput.source, { width: envelope.widthPx, height: envelope.heightPx }, fitInput.protectedVisuals, fitInput.metrics, fitInput.worldScale, fitInput.cameraOffset)
        if (position) return { segments: page.segments, pageLayouts: page.layouts, position, layout, maxWidthPx: candidate.widthPx, fits: true }
      }
      const fallback = widths[widths.length - 1]!
      const page = fallback.pages.get(entryKey({ text: fitInput.text, speaker: fitInput.speaker }))!
      return {
        segments: page.segments,
        pageLayouts: page.layouts,
        position: fitInput.source,
        layout: page.layouts[0] ?? fallback.envelopeLayout,
        maxWidthPx: fallback.widthPx,
        fits: false,
      }
    },
  }
  return cache
}
