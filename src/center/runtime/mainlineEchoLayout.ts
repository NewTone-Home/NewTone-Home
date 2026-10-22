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
}

function clampFontSize(screenMetrics: SceneScreenMetrics) {
  const compactPortrait = screenMetrics.width <= 600 && screenMetrics.height > screenMetrics.width
  if (compactPortrait) return 12
  return Math.max(16, Math.min(20, (screenMetrics.viewportWidth ?? screenMetrics.width) * .0135))
}

function textWidthPx(text: string, fontSizePx: number, scale = 1) {
  return Math.max(1, mainlineMeasuredTextWidth(text, fontSizePx) * scale)
}

export function mainlineEchoLayout(text: string, screenMetrics: SceneScreenMetrics, options: MainlineEchoLayoutOptions = {}): MainlineEchoLayout {
  const compact = screenMetrics.width <= 600 && screenMetrics.height > screenMetrics.width
  const fontSizePx = clampFontSize(screenMetrics)
  const lineHeight = compact ? 1.5 : 1.62
  const paddingX = compact ? 16 : fontSizePx * 1.12
  const paddingY = compact ? 11 : fontSizePx * .8
  const speakerWidth = options.speaker ? textWidthPx(options.speaker, Math.max(12, fontSizePx * .74), 1.1) : 0
  const contentWidth = Math.max(textWidthPx(text, fontSizePx), speakerWidth)
  const widthPx = Math.min(Math.max(1, options.maxWidthPx ?? screenMetrics.width - 24), contentWidth + paddingX)
  let heightPx = paddingY + fontSizePx * lineHeight
  if (options.speaker) heightPx += 3 + Math.max(12, fontSizePx * .74) * 1.62
  return { widthPx, heightPx: Math.max(fontSizePx * 2, heightPx), fontSizePx }
}

/** The name uses the dialogue's reading envelope, never the current segment width. */
export function mainlineSpeakerAnchor(lines: readonly { text: string; speaker: string }[], screenMetrics: SceneScreenMetrics, position: Point, cameraOffset: Point, worldScale = 1, maxWidthPx = screenMetrics.width - 24) {
  const fontSizePx = clampFontSize(screenMetrics)
  const widthPx = Math.max(0, ...lines.flatMap(line => splitMainlineInteractionTextToFit(line.text, maxWidthPx, fontSizePx)
    .map(text => mainlineEchoLayout(text, screenMetrics, { speaker: line.speaker, maxWidthPx }).widthPx)))
  const worldWidthPx = widthPx / worldScale
  const halfWidth = worldWidthPx / sceneDesignReferenceMetrics.width * 50
  const center = Math.max(halfWidth + 2, Math.min(98 - halfWidth, position.x + cameraOffset.x))
  return { left: center - halfWidth, top: Math.max(10, Math.min(85, position.y + cameraOffset.y)), widthPx, worldWidthPx }
}
