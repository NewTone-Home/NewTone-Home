import type { SceneScreenMetrics } from './sceneBoundaryGrid'

export type MainlineEchoLayout = {
  widthPx: number
  heightPx: number
}

type MainlineEchoLayoutOptions = {
  speaker?: string
  choices?: readonly string[]
}

function clampFontSize(screenMetrics: SceneScreenMetrics) {
  return screenMetrics.width <= 720
    ? 12
    : Math.max(13, Math.min(16, screenMetrics.width * .011))
}

function textWidthPx(text: string, fontSizePx: number, scale = 1) {
  return Math.max(fontSizePx * 4, Array.from(text).length * fontSizePx * scale)
}

export function mainlineEchoLayout(text: string, screenMetrics: SceneScreenMetrics, options: MainlineEchoLayoutOptions = {}): MainlineEchoLayout {
  const compact = screenMetrics.width <= 720
  const fontSizePx = clampFontSize(screenMetrics)
  const lineHeight = compact ? 1.5 : 1.6
  const paddingX = compact ? 16 : fontSizePx * 1.12
  const paddingY = compact ? 11 : fontSizePx * .8
  const speakerWidth = options.speaker ? textWidthPx(options.speaker, fontSizePx * .72, 1.1) : 0
  const choicesWidth = options.choices && options.choices.length > 0
    ? options.choices.reduce((total, choice) => total + textWidthPx(choice, fontSizePx * .86, 1.1) + 8, 0) + (options.choices.length - 1) * 14
    : 0
  const contentWidth = Math.max(textWidthPx(text, fontSizePx), speakerWidth, choicesWidth)
  const widthPx = Math.min(Math.max(1, screenMetrics.width - 24), contentWidth + paddingX)
  let heightPx = paddingY + fontSizePx * lineHeight
  if (options.speaker) heightPx += 3 + fontSizePx * .72 * 1.6
  if (options.choices && options.choices.length > 0) heightPx += 7 + fontSizePx * .86 * 1.6
  return { widthPx, heightPx: Math.max(fontSizePx * 2, heightPx) }
}
