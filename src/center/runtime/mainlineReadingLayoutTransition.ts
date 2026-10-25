import type { MainlineEchoLayout } from './mainlineEchoLayout'

/** Keep page text roll and its reading frame on the same visual beat. */
export const mainlineReadingPageTransitionDurationMs = 360

function bezierCoordinate(time: number, first: number, second: number) {
  const inverse = 1 - time
  return 3 * inverse * inverse * time * first + 3 * inverse * time * time * second + time * time * time
}

export function mainlineReadingLayoutTransitionProgress(elapsedMs: number, durationMs = mainlineReadingPageTransitionDurationMs) {
  if (durationMs <= 0 || elapsedMs <= 0) return 0
  if (elapsedMs >= durationMs) return 1
  const progress = durationMs > 0 ? Math.max(0, Math.min(1, elapsedMs / durationMs)) : 1
  // Match the storefront label roll curve: cubic-bezier(.4, 0, .2, 1).
  let low = 0
  let high = 1
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const middle = (low + high) / 2
    if (bezierCoordinate(middle, .4, .2) < progress) low = middle
    else high = middle
  }
  return bezierCoordinate((low + high) / 2, 0, 1)
}

export function interpolateMainlineReadingLayout(from: MainlineEchoLayout, to: MainlineEchoLayout, progress: number): MainlineEchoLayout {
  const amount = Math.max(0, Math.min(1, progress))
  return {
    widthPx: from.widthPx + (to.widthPx - from.widthPx) * amount,
    heightPx: from.heightPx + (to.heightPx - from.heightPx) * amount,
    fontSizePx: to.fontSizePx,
  }
}

export function mainlineReadingLayoutsHaveSameSize(first: MainlineEchoLayout, second: MainlineEchoLayout) {
  return first.widthPx === second.widthPx
    && first.heightPx === second.heightPx
    && first.fontSizePx === second.fontSizePx
}
