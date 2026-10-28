import { sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import type { Point } from './sceneGeometry'
import { mainlineMeasuredTextWidth, splitMainlineInteractionText, splitMainlineInteractionTextToFit } from './mainlineTextSegments'

export type MainlineEchoLayout = {
  widthPx: number
  heightPx: number
  fontSizePx: number
}

type MainlineEchoLayoutOptions = {
  speaker?: string
  maxWidthPx?: number
  fixedWidthPx?: number
  measureText?: (text: string, fontSizePx: number) => number
}

function clampFontSize(screenMetrics: SceneScreenMetrics) {
  const compactPortrait = screenMetrics.width <= 600 && screenMetrics.height > screenMetrics.width
  if (compactPortrait) return 12
  return Math.max(16, Math.min(20, (screenMetrics.viewportWidth ?? screenMetrics.width) * .0135))
}

function textWidthPx(text: string, fontSizePx: number, scale = 1, measureText = mainlineMeasuredTextWidth) {
  return Math.max(1, measureText(text, fontSizePx) * scale)
}

export function mainlineEchoLayout(text: string, screenMetrics: SceneScreenMetrics, options: MainlineEchoLayoutOptions = {}): MainlineEchoLayout {
  const compact = screenMetrics.width <= 600 && screenMetrics.height > screenMetrics.width
  const fontSizePx = clampFontSize(screenMetrics)
  const lineHeight = compact ? 1.5 : 1.62
  const paddingX = compact ? 16 : fontSizePx * 1.12
  const paddingY = compact ? 11 : fontSizePx * .8
  const speakerWidth = options.speaker ? textWidthPx(options.speaker, Math.max(12, fontSizePx * .74), 1.1, options.measureText) : 0
  const textLinesContent = text.split(/\r\n|\r|\n/u)
  const contentWidth = Math.max(speakerWidth, ...textLinesContent.map(line => textWidthPx(line, fontSizePx, 1, options.measureText)))
  const widthPx = Math.max(1, options.fixedWidthPx ?? Math.min(Math.max(1, options.maxWidthPx ?? screenMetrics.width - 24), contentWidth + paddingX))
  const lineWidthPx = Math.max(1, widthPx - paddingX)
  const textLines = textLinesContent.reduce((count, line) => count + Math.max(1, Math.ceil(textWidthPx(line, fontSizePx, 1, options.measureText) / lineWidthPx)), 0)
  let heightPx = paddingY + fontSizePx * lineHeight * textLines
  if (options.speaker) heightPx += 3 + Math.max(12, fontSizePx * .74) * 1.62
  return { widthPx, heightPx: Math.max(fontSizePx * 2, heightPx), fontSizePx }
}

/** The name uses the dialogue's reading envelope, never the current segment width. */
export function mainlineSpeakerAnchor(lines: readonly { text: string; speaker: string }[], screenMetrics: SceneScreenMetrics, position: Point, cameraOffset: Point, worldScale = 1, maxWidthPx = screenMetrics.width - 24, cachedWidthPx?: number) {
  const fontSizePx = clampFontSize(screenMetrics)
  const widthPx = cachedWidthPx ?? Math.max(0, ...lines.flatMap(line => splitMainlineInteractionTextToFit(line.text, maxWidthPx, fontSizePx)
    .map(text => mainlineEchoLayout(text, screenMetrics, { speaker: line.speaker, maxWidthPx }).widthPx)))
  const worldWidthPx = widthPx / worldScale
  const halfWidth = worldWidthPx / sceneDesignReferenceMetrics.width * 50
  // `position` is a world coordinate inside the transformed world layer. The
  // viewport camera is applied by that layer, so clamp-to-viewport here would
  // clamp before the camera translation and can move interior dialogue offscreen.
  const center = position.x + cameraOffset.x
  return { left: center - halfWidth, top: position.y + cameraOffset.y, widthPx, worldWidthPx }
}

/**
 * Keep the dialogue's stable center, but align the visible speaker label to
 * the current page box instead of the widest page in the full line envelope.
 */
export function mainlineSpeakerPageAnchor(envelope: ReturnType<typeof mainlineSpeakerAnchor>, layout: MainlineEchoLayout, worldScale = 1) {
  const worldWidthPx = layout.widthPx / Math.max(.001, worldScale)
  const center = envelope.left + envelope.worldWidthPx / sceneDesignReferenceMetrics.width * 50
  return {
    ...envelope,
    left: center - worldWidthPx / sceneDesignReferenceMetrics.width * 50,
    widthPx: layout.widthPx,
    worldWidthPx,
  }
}
