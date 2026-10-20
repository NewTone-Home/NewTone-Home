import { describe, expect, it } from 'vitest'
import { commercialStreetGridPitchPixels, commercialStreetHorizontalScale, projectCommercialStreetX, unprojectCommercialStreetX } from './commercialStreetGridProjection'
import { boundaryGridStepsFromReferenceSpacing, sceneDesignReferenceMetrics, sharedBoundaryScreenSpacingPx, sharedFurnitureGlyphSpacingPx } from './sceneBoundaryGrid'

describe('commercial street reference projection', () => {
  it('uses 28px wall anchors and 16px internal object glyphs at the 1920×1080 reference', () => {
    const wallSteps = boundaryGridStepsFromReferenceSpacing(sharedBoundaryScreenSpacingPx)
    const objectSteps = boundaryGridStepsFromReferenceSpacing(sharedFurnitureGlyphSpacingPx)
    const metrics = sceneDesignReferenceMetrics
    const pitch = commercialStreetGridPitchPixels(metrics)

    expect(metrics).toEqual({ width: 1920, height: 1080 })
    expect(wallSteps.horizontal * metrics.width / 100).toBeCloseTo(28, 2)
    expect(wallSteps.vertical * metrics.height / 100).toBeCloseTo(28, 2)
    expect(objectSteps.horizontal * metrics.width / 100).toBeCloseTo(16, 2)
    expect(objectSteps.vertical * metrics.height / 100).toBeCloseTo(16, 2)
    expect(pitch.horizontal).toBeCloseTo(28, 2)
    expect(pitch.vertical).toBeCloseTo(28, 2)
  })

  it('keeps world x coordinates unchanged for rendering, clicks and collision footprints', () => {
    const metrics = { width: 1920, height: 945 }
    const authoredX = 83.25
    expect(commercialStreetHorizontalScale(metrics)).toBe(1)
    expect(projectCommercialStreetX(authoredX, metrics)).toBe(authoredX)
    expect(unprojectCommercialStreetX(authoredX, metrics)).toBe(authoredX)
  })
})
