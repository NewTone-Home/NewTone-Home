import { sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

export type MainlineViewportMetrics = SceneScreenMetrics & {
  stableHeight?: number
  projectionScale?: number
  projectionPolicy?: 'area' | 'preserved'
}

export type MainlineViewportSample = MainlineViewportMetrics & {
  devicePixelRatio: number
  visualViewportScale: number
}

/** Readability is a CSS-pixel policy, not a measurement of physical distance. */
export function mainlineAreaProjectionScale(viewport: MainlineViewportMetrics) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.stableHeight ?? viewport.height)
  const area = sceneDesignReferenceMetrics.width * sceneDesignReferenceMetrics.height
  return Math.max(.75, Math.min(1.125, Math.sqrt(width * height / area)))
}

/** Preserve the automatic basis for the session on ambiguous zoom/DPI changes.
 * Current CSS dimensions still update culling, camera limits and input inverse.
 * Latching is deliberate: a later resize must not undo the user's enlargement. */
export function resolveMainlineViewportProjection(
  previous: MainlineViewportSample | undefined,
  sample: MainlineViewportSample,
): MainlineViewportSample {
  const changedDpi = previous && Math.abs(previous.devicePixelRatio - sample.devicePixelRatio) > .001
  const changedPinch = previous && Math.abs(previous.visualViewportScale - sample.visualViewportScale) > .001
  const preserve = previous && (previous.projectionPolicy === 'preserved' || changedDpi || changedPinch || sample.visualViewportScale > 1.001)
  return {
    ...sample,
    projectionScale: preserve ? previous.projectionScale ?? mainlineAreaProjectionScale(previous) : mainlineAreaProjectionScale(sample),
    projectionPolicy: preserve ? 'preserved' : 'area',
  }
}

// Shared by all scene mounts (including local-slide snapshots), never saved to
// player progress. A new scene cannot reset an already detected user zoom.
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
  })
  sessionSample = sample
  return sample
}
