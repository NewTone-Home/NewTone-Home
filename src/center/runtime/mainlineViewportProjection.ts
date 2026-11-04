import { sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

export type MainlineViewportMetrics = SceneScreenMetrics & {
  stableHeight?: number
  projectionScale?: number
  projectionPolicy?: 'device' | 'legacy' | 'preserved'
}

export type MainlineViewportSample = MainlineViewportMetrics & {
  devicePixelRatio: number
  visualViewportScale: number
  outerWidth?: number
  outerHeight?: number
  projectionBaselineDpr?: number
  projectionDpiGuard?: { expectedWidth: number; expectedHeight: number; outerWidth?: number; outerHeight?: number }
}

/** Historical area-based scale retained for the in-session comparison tool. */
export function mainlineLegacyAreaProjectionScale(viewport: MainlineViewportMetrics) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.stableHeight ?? viewport.height)
  const area = sceneDesignReferenceMetrics.width * sceneDesignReferenceMetrics.height
  return Math.max(.75, Math.min(1.125, Math.sqrt(width * height / area)))
}

/** Width-led device viewport scale, capped by the available CSS height. */
export function mainlineDeviceProjectionScale(viewport: MainlineViewportMetrics) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.stableHeight ?? viewport.height)
  const widthScale = width <= 480
    ? .65
    : width <= 720
      ? .65 + (width - 480) * .05 / 240
      : Math.min(1, .70 + (width - 720) * .30 / 560)
  return Math.min(widthScale, Math.max(.65, height / 720))
}

/** Pinch protection lasts only while zoom is active. DPR is ambiguous (page
 * zoom, monitor DPI or emulation), so protect its immediate layout transition.
 * Resume adaptation on reset to baseline DPR or a distinct window/aspect resize;
 * do not treat the expected reciprocal CSS resize as a new device viewport. */
export function resolveMainlineViewportProjection(
  previous: MainlineViewportSample | undefined,
  sample: MainlineViewportSample,
): MainlineViewportSample {
  const changedDpi = previous && Math.abs(previous.devicePixelRatio - sample.devicePixelRatio) > .001
  const baselineDpr = previous?.projectionBaselineDpr ?? previous?.devicePixelRatio ?? sample.devicePixelRatio
  const dpiReset = Math.abs(sample.devicePixelRatio - baselineDpr) <= .001
  let dpiGuard = dpiReset ? undefined : previous?.projectionDpiGuard
  if (changedDpi && !dpiReset) {
    const ratio = previous.devicePixelRatio / sample.devicePixelRatio
    dpiGuard = {
      expectedWidth: previous.width * ratio, expectedHeight: (previous.stableHeight ?? previous.height) * ratio,
      outerWidth: sample.outerWidth, outerHeight: sample.outerHeight,
    }
  } else if (previous && dpiGuard) {
    // Compare to the guard anchor, not the preceding resize event: a slow
    // one-pixel-at-a-time drag must eventually release protection too.
    const outerChanged = (sample.outerWidth !== undefined && dpiGuard.outerWidth !== undefined && Math.abs(sample.outerWidth - dpiGuard.outerWidth) > 2)
      || (sample.outerHeight !== undefined && dpiGuard.outerHeight !== undefined && Math.abs(sample.outerHeight - dpiGuard.outerHeight) > 2)
    const height = sample.stableHeight ?? sample.height
    const aspectChanged = Math.abs(Math.log((sample.width / height) / (dpiGuard.expectedWidth / dpiGuard.expectedHeight))) > .02
    const expectedZoomResize = Math.abs(sample.width - dpiGuard.expectedWidth) <= 2 && Math.abs(height - dpiGuard.expectedHeight) <= 2
    if ((outerChanged || aspectChanged) && !expectedZoomResize) dpiGuard = undefined
  }
  const preserve = previous && (sample.visualViewportScale > 1.001 || dpiGuard !== undefined)
  return {
    ...sample,
    projectionBaselineDpr: baselineDpr,
    projectionDpiGuard: dpiGuard,
    projectionScale: preserve ? previous.projectionScale ?? mainlineDeviceProjectionScale(previous) : mainlineDeviceProjectionScale(sample),
    projectionPolicy: preserve ? 'preserved' : 'device',
  }
}

// Shared by all scene mounts (including local-slide snapshots), never saved to
// player progress. A new scene cannot reset an active accessibility zoom.
let sessionSample: MainlineViewportSample | undefined

export function currentMainlineViewportMetrics(): MainlineViewportMetrics | undefined {
  return sessionSample
}

export function readMainlineViewportMetrics(stage: HTMLElement, stableViewport: HTMLElement): MainlineViewportSample | null {
  const rect = stage.getBoundingClientRect()
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  const smallHeight = stableViewport.getBoundingClientRect().height
  const stableHeight = stage.closest('.mainline-scene--map-only') && smallHeight > 0
    ? Math.min(rect.height, smallHeight) : rect.height
  const sample = resolveMainlineViewportProjection(sessionSample, {
    width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)),
    stableHeight: Number(stableHeight.toFixed(2)), viewportWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    visualViewportScale: window.visualViewport?.scale ?? 1,
    outerWidth: window.outerWidth, outerHeight: window.outerHeight,
  })
  sessionSample = sample
  return sample
}
