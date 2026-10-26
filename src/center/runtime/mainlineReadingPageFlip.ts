import type { MainlineEchoLayout } from './mainlineEchoLayout'

/** Reading pages roll faster than storefront labels; this does not affect doors or signs. */
export const mainlineReadingPageFlipDurationMs = 500

export type MainlineReadingPageSnapshot = Readonly<{
  continuityKey: string
  pageKey: string
  visibleText: string
  layout: Readonly<MainlineEchoLayout>
  worldScale: number
}>

export function snapshotMainlineReadingPage(input: MainlineReadingPageSnapshot): MainlineReadingPageSnapshot {
  return Object.freeze({
    ...input,
    layout: Object.freeze({ ...input.layout }),
  })
}

export function previousMainlineReadingPageForFlip(
  previous: MainlineReadingPageSnapshot | null,
  next: Pick<MainlineReadingPageSnapshot, 'continuityKey' | 'pageKey'>,
): MainlineReadingPageSnapshot | null {
  if (!previous || previous.continuityKey !== next.continuityKey || previous.pageKey === next.pageKey) return null
  return previous
}

/** Keep the old page's full clip area available until its roll completes. */
export function mainlineReadingPageRollEnvelope(from: MainlineEchoLayout, to: MainlineEchoLayout): MainlineEchoLayout {
  return {
    widthPx: Math.max(from.widthPx, to.widthPx),
    heightPx: Math.max(from.heightPx, to.heightPx),
    fontSizePx: to.fontSizePx,
  }
}

export function interpolateMainlineReadingPageLayout(from: MainlineEchoLayout, to: MainlineEchoLayout, progress: number): MainlineEchoLayout {
  const amount = Math.max(0, Math.min(1, progress))
  return {
    widthPx: from.widthPx + (to.widthPx - from.widthPx) * amount,
    heightPx: from.heightPx + (to.heightPx - from.heightPx) * amount,
    fontSizePx: to.fontSizePx,
  }
}
