import { describe, expect, it } from 'vitest'
import {
  clampCenterExpansion,
  createDefaultCenterViewSnapshot,
  isReaderPosition,
  normalizeCenterCamera,
  normalizeCenterViewSnapshot,
} from './invariants'

describe('Center domain invariants', () => {
  it('clamps expansion to a stable persisted range', () => {
    expect(clampCenterExpansion(-1)).toBe(0)
    expect(clampCenterExpansion(0.42)).toBe(0.42)
    expect(clampCenterExpansion(2)).toBe(1)
    expect(clampCenterExpansion(Number.NaN)).toBe(0)
  })

  it('normalizes camera values without storing transient runtime state', () => {
    expect(normalizeCenterCamera({ scrollX: 120, scrollY: 80, zoom: 1.5 })).toEqual({
      scrollX: 120,
      scrollY: 80,
      zoom: 1.5,
    })

    expect(normalizeCenterCamera({ scrollX: Number.NaN, scrollY: Infinity, zoom: 20 })).toEqual({
      scrollX: 0,
      scrollY: 0,
      zoom: 4,
    })
  })

  it('accepts only the V0.0 phase/page/beat Reader position shape', () => {
    expect(isReaderPosition({ phaseId: 'M1', pageId: 'ancestral-home', beatIndex: 0 })).toBe(true)
    expect(isReaderPosition({ chapterId: 'chapter-1', blockId: 'p1', progressRatio: 0.5 })).toBe(false)
    expect(isReaderPosition({ phaseId: 'M1', pageId: 'ancestral-home', beatIndex: -1 })).toBe(false)
  })

  it('creates and sanitizes a serializable Center view snapshot', () => {
    expect(createDefaultCenterViewSnapshot()).toEqual({
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      expansion: 0,
      activeLayer: null,
      selectedLandmarkId: null,
    })

    expect(normalizeCenterViewSnapshot({
      camera: { scrollX: 20, scrollY: 30, zoom: 2 },
      expansion: 1.4,
      activeLayer: 'surface',
      selectedLandmarkId: 'station',
    })).toEqual({
      camera: { scrollX: 20, scrollY: 30, zoom: 2 },
      expansion: 1,
      activeLayer: 'surface',
      selectedLandmarkId: 'station',
    })
  })
})
