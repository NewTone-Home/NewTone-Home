import { boundaryGridStepsFromScreenSpacing, defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

// Commercial-street's authored cells share the default stage coordinate
// system. Project only its x axis so each horizontal cell uses the same
// physical pixel pitch as the existing vertical cells at the measured stage.
const authoredHorizontalStep = boundaryGridStepsFromScreenSpacing().horizontal
const authoredVerticalStep = boundaryGridStepsFromScreenSpacing().vertical

export function commercialStreetHorizontalScale(metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  const width = Number.isFinite(metrics.width) && metrics.width > 0 ? metrics.width : defaultSceneScreenMetrics.width
  const height = Number.isFinite(metrics.height) && metrics.height > 0 ? metrics.height : defaultSceneScreenMetrics.height
  return (authoredVerticalStep * height) / (authoredHorizontalStep * width)
}

export function projectCommercialStreetX(x: number, metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  return 50 + (x - 50) * commercialStreetHorizontalScale(metrics)
}

export function unprojectCommercialStreetX(x: number, metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  return 50 + (x - 50) / commercialStreetHorizontalScale(metrics)
}

export function commercialStreetGridPitchPixels(metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  const scale = commercialStreetHorizontalScale(metrics)
  return {
    horizontal: authoredHorizontalStep * metrics.width * scale / 100,
    vertical: authoredVerticalStep * metrics.height / 100,
  }
}

export function expandCommercialStreetBoxForProjection<T extends { x: number; width: number }>(
  box: T,
  metrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): T {
  const scale = commercialStreetHorizontalScale(metrics)
  const width = box.width / scale
  return { ...box, x: box.x + (box.width - width) / 2, width }
}
