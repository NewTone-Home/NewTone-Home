import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import type { Point } from './sceneGeometry'
import { splitMainlineInteractionText } from './mainlineTextSegments'

export type MainlineEchoLayout = {
  widthPx: number
  heightPx: number
}

type MainlineEchoLayoutOptions = {
  speaker?: string
}

function clampFontSize(screenMetrics: SceneScreenMetrics) {
  const compactPortrait = screenMetrics.width <= 600 && screenMetrics.height > screenMetrics.width
  return compactPortrait
    ? 12
    : Math.max(16, Math.min(20, screenMetrics.width * .0135))
}

function textWidthPx(text: string, fontSizePx: number, scale = 1) {
  return Math.max(fontSizePx * 4, Array.from(text).length * fontSizePx * scale)
}

export function mainlineEchoLayout(text: string, screenMetrics: SceneScreenMetrics, options: MainlineEchoLayoutOptions = {}): MainlineEchoLayout {
  const compact = screenMetrics.width <= 600 && screenMetrics.height > screenMetrics.width
  const fontSizePx = clampFontSize(screenMetrics)
  const lineHeight = compact ? 1.5 : 1.62
  const paddingX = compact ? 16 : fontSizePx * 1.12
  const paddingY = compact ? 11 : fontSizePx * .8
  const speakerWidth = options.speaker ? textWidthPx(options.speaker, Math.max(12, fontSizePx * .74), 1.1) : 0
  const contentWidth = Math.max(textWidthPx(text, fontSizePx), speakerWidth)
  const widthPx = Math.min(Math.max(1, screenMetrics.width - 24), contentWidth + paddingX)
  let heightPx = paddingY + fontSizePx * lineHeight
  if (options.speaker) heightPx += 3 + Math.max(12, fontSizePx * .74) * 1.62
  return { widthPx, heightPx: Math.max(fontSizePx * 2, heightPx) }
}

/** The name uses the dialogue's reading envelope, never the current segment width. */
export function mainlineSpeakerAnchor(lines: readonly { text: string; speaker: string }[], screenMetrics: SceneScreenMetrics, position: Point, cameraOffset: Point) {
  const widthPx = Math.max(0, ...lines.flatMap(line => splitMainlineInteractionText(line.text)
    .map(text => mainlineEchoLayout(text, screenMetrics, { speaker: line.speaker }).widthPx)))
  const halfWidth = widthPx / screenMetrics.width * 50
  const center = Math.max(halfWidth + 2, Math.min(98 - halfWidth, position.x + cameraOffset.x))
  return { left: center - halfWidth, top: Math.max(10, Math.min(85, position.y + cameraOffset.y)), widthPx }
}
