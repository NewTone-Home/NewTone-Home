import { boundaryGridStepsFromReferenceSpacing, defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'

// Commercial-street uses the same 1920×1080 reference lattice as every other
// scene. Keep its authored x coordinates in that lattice; do not stretch x.
const authoredHorizontalStep = boundaryGridStepsFromReferenceSpacing().horizontal
const authoredVerticalStep = boundaryGridStepsFromReferenceSpacing().vertical

export function commercialStreetHorizontalScale(_metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  return 1
}

export function projectCommercialStreetX(x: number, _metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  return x
}

export function unprojectCommercialStreetX(x: number, _metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  return x
}

export function commercialStreetGridPitchPixels(metrics: SceneScreenMetrics = defaultSceneScreenMetrics) {
  return {
    horizontal: authoredHorizontalStep * metrics.width / 100,
    vertical: authoredVerticalStep * metrics.height / 100,
  }
}

export function expandCommercialStreetBoxForProjection<T extends { x: number; width: number }>(
  box: T,
  metrics: SceneScreenMetrics = defaultSceneScreenMetrics,
): T {
  return box
}
