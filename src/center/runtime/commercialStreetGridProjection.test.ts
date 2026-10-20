import { describe, expect, it } from 'vitest'
import { commercialStreetGridPitchPixels, commercialStreetHorizontalScale, projectCommercialStreetX, unprojectCommercialStreetX } from './commercialStreetGridProjection'

describe('commercial street equal-pitch projection', () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 1920, height: 945 },
    { width: 844, height: 390 },
    { width: 390, height: 560 },
  ])('matches the existing vertical pitch at $width×$height and reverses pointer coordinates', (metrics) => {
    const pitch = commercialStreetGridPitchPixels(metrics)
    expect(pitch.horizontal).toBeCloseTo(pitch.vertical, 6)
    expect(unprojectCommercialStreetX(projectCommercialStreetX(83.25, metrics), metrics)).toBeCloseTo(83.25, 8)
  })

  it('keeps the default stage unchanged and scopes desktop compression to the measured scene shape', () => {
    expect(commercialStreetHorizontalScale({ width: 1280, height: 720 })).toBeCloseTo(1)
    expect(commercialStreetHorizontalScale({ width: 1920, height: 945 })).toBeLessThan(1)
  })
})
