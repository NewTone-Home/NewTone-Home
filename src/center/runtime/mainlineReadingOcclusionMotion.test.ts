import { describe, expect, it } from 'vitest'
import { mainlineReadingLocalFadeMask } from './mainlineReadingOcclusion'
import { mainlineReadingAlphaAt, mainlineReadingAlphaCellLimit, mainlineReadingAlphaCellSize, mainlineReadingAlphaTransitionValue, rasterizeMainlineReadingAlphaField } from './mainlineReadingLocalAlpha'

describe('reading local fade motion', () => {
  const object = { x: 0, y: 0, width: 100, height: 40 }
  it('keeps a stable local grid and caps cells for large background planes', () => {
    const bounds = { x: 0, y: 0, width: 195, height: 503 }
    const size = mainlineReadingAlphaCellSize(bounds)
    const field = rasterizeMainlineReadingAlphaField(bounds, [{ x: 40, y: 60, width: 18, height: 22 }], size)
    expect(Math.ceil(bounds.width / size) * Math.ceil(bounds.height / size)).toBeLessThanOrEqual(mainlineReadingAlphaCellLimit)
    expect(field.length).toBeGreaterThan(0)
    expect(field.every(cell => Math.abs(cell.x / size - Math.round(cell.x / size)) < .00001 && Math.abs(cell.y / size - Math.round(cell.y / size)) < .00001 && cell.target > 0)).toBe(true)
    const shifted = rasterizeMainlineReadingAlphaField(bounds, [{ x: 41, y: 60, width: 18, height: 22 }], size)
    expect(shifted.some(cell => field.some(previous => previous.key === cell.key && previous.x === cell.x && previous.y === cell.y))).toBe(true)
  })

  it('clears the core, preserves the soft spatial feather and interpolates opacity at fixed cells', () => {
    const rect = { x: 20, y: 10, width: 16, height: 18 }
    expect(mainlineReadingAlphaAt({ x: 22, y: 14 }, rect)).toBe(1)
    expect(mainlineReadingAlphaAt({ x: 44, y: 14 }, rect)).toBeCloseTo(.5, 2)
    expect(mainlineReadingAlphaAt({ x: 60, y: 14 }, rect)).toBeLessThan(.01)
    expect(mainlineReadingAlphaTransitionValue(0, 1, 100, 80, 100)).toBe(0)
    expect(mainlineReadingAlphaTransitionValue(0, 1, 100, 80, 140)).toBeCloseTo(.5, 2)
    expect(mainlineReadingAlphaTransitionValue(0, 1, 100, 80, 180)).toBe(1)
  })
  it('keeps separate current glyph and frame regions protected without globally weakening the mask', () => {
    const mask = mainlineReadingLocalFadeMask(object, [
      { x: 10, y: 5, width: 22, height: 12 },
      { x: 58, y: 20, width: 24, height: 2 },
    ], 2, 6)!
    expect(mask.match(/radial-gradient/g)).toHaveLength(2)
    expect(mask.match(/transparent 0%, transparent/g)).toHaveLength(2)
    expect(mask).not.toContain('rgba(')
    expect(mask).toContain('at 21% 27.5%')
    expect(mask).toContain('at 70% 52.5%')
  })

  it('drops only cleared regions while preserving full protection around remaining visible ink', () => {
    const before = mainlineReadingLocalFadeMask(object, [
      { x: 10, y: 5, width: 22, height: 12 },
      { x: 58, y: 20, width: 24, height: 2 },
    ], 2, 6)!
    const after = mainlineReadingLocalFadeMask(object, [{ x: 58, y: 20, width: 24, height: 2 }], 2, 6)!
    expect(before.match(/radial-gradient/g)).toHaveLength(2)
    expect(after.match(/radial-gradient/g)).toHaveLength(1)
    expect(after).toContain('at 70% 52.5%')
  })

  it('uses one contiguous soft safe area for framed menu text and its inter-line gaps', () => {
    const mask = mainlineReadingLocalFadeMask(object, [
      { x: 25, y: 4, width: 50, height: 10 },
      { x: 20, y: 20, width: 60, height: 2 },
      { x: 25, y: 32, width: 50, height: 10 },
    ], 8, 8, true)!
    expect(mask.match(/radial-gradient/g)).toHaveLength(1)
    expect(mask).toContain('transparent 0%, transparent 74.838%')
    expect(mask).not.toContain('rgba(')
  })
})
