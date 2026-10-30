import type { CollisionBox, Point } from './sceneGeometry'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { mainlineEchoLayout, type MainlineEchoLayout } from './mainlineEchoLayout'
import { mainlineReadingBounds, mainlineReadingFontSizePx } from './mainlineTextReading'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { mainlinePlaceReadingBox } from './mainlineReadingProtection'
import { mainlineDisplaySourceText, mainlineMeasuredTextWidth, splitMainlineInteractionTextToFit } from './mainlineTextSegments'
import { mainlineWorldPointAtViewportPercent } from './mainlineViewport'

export type MainlineReadingCachedPages = Readonly<{
  segments: readonly string[]
  layouts: readonly MainlineEchoLayout[]
  fullLayout: MainlineEchoLayout
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

function pageIndexAtSourceOffset(segments: readonly string[], sourceOffset: number) {
  let start = 0
  for (let index = 0; index < segments.length; index += 1) {
    const end = start + segments[index]!.length
    if (sourceOffset < end) return index
    start = end
  }
  return Math.max(0, segments.length - 1)
}

/** Reserve one rendered line per width-fit fragment. Whole-string canvas
 * width can underestimate the number of browser lines around punctuation. */
export function mainlineObservationMinimumPageHeight(chunks: readonly string[], fontSizePx: number, compact: boolean) {
  let lines = 0
  let previous = ''
  for (const chunk of chunks) {
    if (!chunk) continue
    lines += chunk.split(/\r\n|\r|\n/u).length
    if (previous && /[\r\n]$/u.test(previous)) lines -= 1
    if (previous.endsWith('\r') && chunk.startsWith('\n')) lines -= 1
    previous = chunk
  }
  lines = Math.max(1, lines)
  return (compact ? 11 : fontSizePx * .8) + fontSizePx * (compact ? 1.5 : 1.62) * lines
}

export function mainlineReadingMeasurementKey(metrics: SceneScreenMetrics, worldScale: number) {
  return JSON.stringify([metrics.width, metrics.height, metrics.viewportWidth ?? null, worldScale])
}

export type MainlineReadingSessionLayoutCache = {
  readonly sessionKey: string
  readonly measurementKey: string
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
    sourceOffset?: number
    outside?: { side: 'above' | 'below'; speakerY: number }
    subtitle?: boolean
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
  fontSizePx?: number
  fontKey?: string
  worldScale?: number
  measureText?: (text: string, fontSizePx: number) => number
  layoutText?: typeof mainlineEchoLayout
  splitTextToFit?: typeof splitMainlineInteractionTextToFit
  preferWholeText?: boolean
}): MainlineReadingSessionLayoutCache {
  const metrics = { ...input.metrics }
  const fontSizePx = input.fontSizePx ?? mainlineReadingFontSizePx(metrics)
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
  const observationLayout = (text: string, widthPx: number, speaker?: string, parts: readonly string[] = [text], subtitle = false) => {
    const measured = layoutText(text, metrics, { speaker, maxWidthPx: widthPx, fixedWidthPx: input.preferWholeText ? undefined : widthPx, fontSizePx, lineHeight: subtitle ? 1.5 : undefined, measureText: measure })
    if (subtitle) {
      const compact = metrics.width <= 600 && metrics.height > metrics.width
      const bodyHeight = mainlineObservationMinimumPageHeight(parts, measured.fontSizePx, compact)
      const speakerHeight = speaker ? 3 + Math.max(12, measured.fontSizePx * .74) * 1.5 : 0
      return { ...measured, heightPx: Math.max(measured.heightPx, bodyHeight + speakerHeight) }
    }
    if (!input.preferWholeText) return measured
    const compact = metrics.width <= 600 && metrics.height > metrics.width
    const refitted = splitTextToFit(text, Math.max(fontSizePx, widthPx - 40), fontSizePx, value => measure(value, fontSizePx))
    return { ...measured, heightPx: Math.max(measured.heightPx, mainlineObservationMinimumPageHeight(parts, measured.fontSizePx, compact), mainlineObservationMinimumPageHeight(refitted, measured.fontSizePx, compact)) }
  }
  let maxMeasuredTextWidthPx = 0
  let observationPlan: { key: string; text: string; segments: readonly string[]; pageLayouts: readonly MainlineEchoLayout[]; position: Point; maxWidthPx: number } | null = null

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
      return observationLayout(segment, candidate.widthPx, speaker)
    })
    counts.layoutCalls += 1
    const fullLayout = observationLayout(text, candidate.widthPx, speaker)
    candidate.pages.set(key, { segments, layouts, fullLayout })
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
  // Formal dialogue keeps the width selected when its session starts. Camera
  // motion and changing nearby geometry may affect placement, but do not cause
  // the same speaker's box to grow or shrink between lines.
  const dialogueWidth = widths[0]!
  const dialogueSpeakerWidths = new Map<string, WidthCandidate>()

  const cache: MainlineReadingSessionLayoutCache = {
    sessionKey: input.sessionKey,
    measurementKey: mainlineReadingMeasurementKey(metrics, input.worldScale ?? 1),
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
      const candidate = input.preferWholeText
        ? widths.find(item => item.widthPx <= maximumWidthPx + .001) ?? widths[widths.length - 1]!
        : dialogueSpeakerWidths.get(speaker ?? '') ?? dialogueWidth
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
      // Freeze a complete page plan for this viewport, independent of camera
      // and actor movement. Resize builds a new plan; the renderer maps the
      // currently displayed source offset into that new plan.
      if (input.preferWholeText || fitInput.subtitle) {
        const viewportKey = JSON.stringify([fitInput.metrics.width, fitInput.metrics.height, fitInput.metrics.viewportWidth, fitInput.worldScale, fitInput.subtitle ? fitInput.cameraOffset : null])
        if (observationPlan?.key === viewportKey && observationPlan.text === fitInput.text) {
          const page = observationPlan
          return { segments: page.segments, pageLayouts: page.pageLayouts, position: page.position, layout: page.pageLayouts[0]!, maxWidthPx: page.maxWidthPx, fits: true }
        }
        const bounds = fitInput.subtitle ? null : mainlineReadingBounds(fitInput.scene, fitInput.source, fitInput.metrics, fitInput.worldScale, fitInput.cameraOffset)
        const availableWidth = fitInput.subtitle
          ? Math.max(1, fitInput.metrics.width - 40)
          : bounds!.width / 100 * sceneDesignReferenceMetrics.width * fitInput.worldScale
        // The compact mobile subtitle reserves 22px above and at least 64px
        // below its shared text/choice area. Keep the same 27vh/224px window
        // budget as the renderer when fitting text pages.
        const availableHeight = fitInput.subtitle ? Math.max(1, Math.min(fitInput.metrics.height * .27, 224) - 86) : bounds!.height / 100 * sceneDesignReferenceMetrics.height * fitInput.worldScale
        for (const candidate of widths) {
          if (candidate.widthPx > fitInput.maximumWidthPx + .001) continue
          const fittedChunks = candidate.pages.get(entryKey({ text: fitInput.text, speaker: fitInput.speaker }))!.segments
          // The normal source path already removed the display-only terminal
          // full stop. Preserve exact input for other callers of the cache.
          const lineChunks = [...fittedChunks]
          if (lineChunks.join('') !== fitInput.text && lineChunks.join('') === mainlineDisplaySourceText(fitInput.text)) {
            const suffix = fitInput.text.match(/。(\s*)$/u)
            if (suffix && lineChunks.length) lineChunks[lineChunks.length - 1] = lineChunks[lineChunks.length - 1]!.replace(/\s*$/u, '') + suffix[0]
          }
          // On resize, retain a page boundary at the current source offset.
          // Earlier text stays in earlier pages even if the viewport grew.
          const offset = Math.max(0, Math.min(fitInput.sourceOffset ?? 0, fitInput.text.length))
          const chunks: string[] = []
          let chunkOffset = 0
          for (const chunk of lineChunks) {
            const cut = offset - chunkOffset
            if (cut > 0 && cut < chunk.length) chunks.push(chunk.slice(0, cut), chunk.slice(cut))
            else chunks.push(chunk)
            chunkOffset += chunk.length
          }
          const segments: string[] = []
          const pageLayouts: MainlineEchoLayout[] = []
          let current: string[] = []
          let consumed = 0
          const pageFits = (parts: readonly string[]) => {
            const text = parts.join('')
            const layout = observationLayout(text, candidate.widthPx, fitInput.speaker, parts, fitInput.subtitle)
            if (layout.widthPx > availableWidth || layout.heightPx > availableHeight) return null
            if (fitInput.subtitle) return layout
            return mainlinePlaceReadingBox(fitInput.scene, fitInput.source, { width: layout.widthPx, height: layout.heightPx }, fitInput.protectedVisuals, fitInput.metrics, fitInput.worldScale, fitInput.cameraOffset, fitInput.outside) ? layout : null
          }
          for (const chunk of chunks) {
            if (consumed === offset && offset > 0 && current.length) {
              segments.push(current.join(''))
              pageLayouts.push(pageFits(current)!)
              current = []
            }
            const combined = [...current, chunk]
            if (pageFits(combined)) { current = combined; consumed += chunk.length; continue }
            if (!current.length) { current = []; break }
            segments.push(current.join(''))
            pageLayouts.push(pageFits(current)!)
            current = pageFits([chunk]) ? [chunk] : []
            if (!current.length) break
            consumed += chunk.length
          }
          if (current.length) { segments.push(current.join('')); pageLayouts.push(pageFits(current)!) }
          if (!segments.length || segments.join('') !== fitInput.text) continue
          const envelope = { width: Math.max(...pageLayouts.map(layout => layout.widthPx)), height: Math.max(...pageLayouts.map(layout => layout.heightPx)) }
          // Legacy multi-segment callers still share a stable envelope.
          if (knownEntries.size > 1 && input.preferWholeText) {
            envelope.width = Math.max(envelope.width, candidate.envelopeLayout.widthPx)
            envelope.height = Math.max(envelope.height, candidate.envelopeLayout.heightPx)
          }
          const position = fitInput.subtitle
            ? mainlineWorldPointAtViewportPercent({ x: 50, y: 90 - envelope.height / Math.max(1, fitInput.metrics.height) * 50 }, fitInput.metrics, fitInput.cameraOffset)
            : mainlinePlaceReadingBox(fitInput.scene, fitInput.source, envelope, fitInput.protectedVisuals, fitInput.metrics, fitInput.worldScale, fitInput.cameraOffset, fitInput.outside)
          if (!position) continue
          observationPlan = { key: viewportKey, text: fitInput.text, segments, pageLayouts, position, maxWidthPx: candidate.widthPx }
          return { segments, pageLayouts, position, layout: pageLayouts[0]!, maxWidthPx: candidate.widthPx, fits: true }
        }
      }
      const fallbackPages = (candidate: WidthCandidate) => {
        const page = candidate.pages.get(entryKey({ text: fitInput.text, speaker: fitInput.speaker }))!
        const offset = fitInput.sourceOffset ?? 0
        if (offset <= 0) return page
        let start = 0
        const segments = page.segments.flatMap(segment => {
          const cut = offset - start
          start += segment.length
          return cut > 0 && cut < segment.length ? [segment.slice(0, cut), segment.slice(cut)] : [segment]
        })
        const layouts = segments.map(segment => observationLayout(segment, candidate.widthPx, fitInput.speaker))
        return { segments, layouts }
      }
      for (const candidate of widths) {
        const selected = dialogueSpeakerWidths.get(fitInput.speaker ?? '')
        if (!input.preferWholeText && selected && candidate !== selected) continue
        if (candidate.widthPx > fitInput.maximumWidthPx + .001) continue
        const page = fallbackPages(candidate)
        const pageIndex = pageIndexAtSourceOffset(page.segments, fitInput.sourceOffset ?? 0)
        const layout = page.layouts[pageIndex] ?? observationLayout(fitInput.text, candidate.widthPx, fitInput.speaker)
        const envelope = input.preferWholeText
          ? { widthPx: Math.max(...page.layouts.map(item => item.widthPx)), heightPx: Math.max(...page.layouts.map(item => item.heightPx)) }
          : { widthPx: candidate.widthPx, heightPx: layout.heightPx }
        if (input.preferWholeText) {
          const bounds = mainlineReadingBounds(fitInput.scene, fitInput.source, fitInput.metrics, fitInput.worldScale, fitInput.cameraOffset)
          if (envelope.widthPx > bounds.width / 100 * sceneDesignReferenceMetrics.width * fitInput.worldScale || envelope.heightPx > bounds.height / 100 * sceneDesignReferenceMetrics.height * fitInput.worldScale) continue
        }
        const position = mainlinePlaceReadingBox(fitInput.scene, fitInput.source, { width: envelope.widthPx, height: envelope.heightPx }, fitInput.protectedVisuals, fitInput.metrics, fitInput.worldScale, fitInput.cameraOffset, fitInput.outside)
        if (position) {
          if (!input.preferWholeText) dialogueSpeakerWidths.set(fitInput.speaker ?? '', candidate)
          return { segments: page.segments, pageLayouts: page.layouts, position, layout, maxWidthPx: candidate.widthPx, fits: true }
        }
      }
      const fallback = widths[widths.length - 1]!
      const stableFallback = input.preferWholeText ? fallback : dialogueSpeakerWidths.get(fitInput.speaker ?? '') ?? dialogueWidth
      const page = fallbackPages(stableFallback)
      const pageIndex = pageIndexAtSourceOffset(page.segments, fitInput.sourceOffset ?? 0)
      return {
        segments: page.segments,
        pageLayouts: page.layouts,
        position: fitInput.source,
        layout: page.layouts[pageIndex] ?? stableFallback.envelopeLayout,
        maxWidthPx: stableFallback.widthPx,
        fits: false,
      }
    },
  }
  return cache
}
