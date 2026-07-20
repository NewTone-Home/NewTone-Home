import { describe, expect, it } from 'vitest'
import {
  getReaderThemeVariables,
  legacyThemeName,
  magnetizeThemePosition,
  migrateThemePosition,
  nearestThemeNode,
  themePositionForWheel,
  themePositionFromPointer,
  themePositionFromPointerX,
  themeName,
} from '../src/reader/readerTheme'

describe('reader theme position', () => {
  it('migrates legacy strings and clamps numeric values', () => {
    expect(migrateThemePosition(undefined, 'light')).toBe(0)
    expect(migrateThemePosition(undefined, 'soft')).toBe(0.5)
    expect(migrateThemePosition(undefined, 'dark')).toBe(1)
    expect(migrateThemePosition(0.37, 'dark')).toBe(0.37)
    expect(migrateThemePosition(4)).toBe(1)
  })

  it('uses true nearest-node snapping and compatibility names', () => {
    expect(nearestThemeNode(0.12)).toBe(0)
    expect(nearestThemeNode(0.37)).toBe(0.5)
    expect(nearestThemeNode(0.84)).toBe(1)
    expect(legacyThemeName(0.37)).toBe('soft')
  })

  it('maps horizontal pointer positions inside the thumb-safe track', () => {
    const trackRect = { left: 100, right: 300 }
    expect(themePositionFromPointerX(110, trackRect, 20)).toBe(0)
    expect(themePositionFromPointerX(200, trackRect, 20)).toBe(0.5)
    expect(themePositionFromPointerX(290, trackRect, 20)).toBe(1)
    expect(themePositionFromPointerX(50, trackRect, 20)).toBe(0)
    expect(themePositionFromPointerX(400, trackRect, 20)).toBe(1)
    expect(themePositionFromPointerX(200, { left: 100, right: 100 }, 20)).toBe(0.5)
  })

  it('shows semantic names only when exactly settled on an anchor', () => {
    expect(themeName(0)).toBe('明亮')
    expect(themeName(0.00001)).toBe('')
    expect(themeName(0.37)).toBe('')
    expect(themeName(0.5)).toBe('柔和')
    expect(themeName(0.94)).toBe('')
    expect(themeName(1)).toBe('夜间')
  })

  it('interpolates all reader color variables continuously', () => {
    const atQuarter = getReaderThemeVariables(0.25)
    expect(atQuarter['--reader-paper']).toBe('rgb(239, 233, 222)')
    expect(atQuarter).toHaveProperty('--reader-ink')
    expect(atQuarter).toHaveProperty('--reader-muted')
    expect(atQuarter).toHaveProperty('--reader-control')
    expect(atQuarter).toHaveProperty('--reader-border')
    expect(atQuarter).toHaveProperty('--reader-surface')
  })

  it('maps pointer coordinates inside thumb-safe track endpoints', () => {
    const trackRect = { top: 100, bottom: 266 }
    expect(themePositionFromPointer(109, trackRect, 18)).toBe(0)
    expect(themePositionFromPointer(183, trackRect, 18)).toBe(0.5)
    expect(themePositionFromPointer(257, trackRect, 18)).toBe(1)
    expect(themePositionFromPointer(40, trackRect, 18)).toBe(0)
    expect(themePositionFromPointer(320, trackRect, 18)).toBe(1)
  })

  it('uses one wheel model for full microsteps and reduced anchors', () => {
    expect(themePositionForWheel(0.37, 1, 'full')).toBeCloseTo(0.41)
    expect(themePositionForWheel(0.37, -1, 'full')).toBeCloseTo(0.33)
    expect(themePositionForWheel(0.5, 1, 'reduced')).toBe(1)
    expect(themePositionForWheel(0.5, -1, 'reduced')).toBe(0)
    expect(themePositionForWheel(1, 1, 'reduced')).toBe(1)
  })

  it('adds a small escapable magnetic detent in full motion', () => {
    expect(magnetizeThemePosition(0.48)).toBe(0.5)
    expect(magnetizeThemePosition(0.52)).toBe(0.5)
    expect(magnetizeThemePosition(0.44)).toBe(0.44)
    expect(themePositionForWheel(0.45, 1, 'full')).toBe(0.5)
    expect(themePositionForWheel(0.5, 1, 'full')).toBeCloseTo(0.54)
  })
})
