import { describe, expect, it } from 'vitest'
import { mainlineReadingLocalFadeMask } from './mainlineReadingOcclusion'

describe('reading local fade motion', () => {
  const object = { x: 0, y: 0, width: 100, height: 40 }
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
})
