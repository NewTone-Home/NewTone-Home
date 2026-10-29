import { describe, expect, it } from 'vitest'
import { mainlineReadingLocalFadeMask, mainlineReadingMaskRegions } from './mainlineReadingOcclusion'

describe('reading local fade motion', () => {
  const object = { x: 0, y: 0, width: 100, height: 40 }
  it('keeps the protected glyph region fully clear and places the soft feather outside it', () => {
    expect(mainlineReadingMaskRegions([{ key: 'glyph', active: true, x: 20, y: 10, width: 16, height: 18 }])).toEqual([{
      key: 'glyph', active: true,
      core: { x: 20, y: 10, width: 16, height: 18 },
      feather: { x: 12, y: 2, width: 32, height: 34 },
    }])
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
