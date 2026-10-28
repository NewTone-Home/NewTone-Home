import { describe, expect, it } from 'vitest'
import { mainlineReadingLocalFadeMask } from './mainlineReadingOcclusion'

describe('reading local fade motion', () => {
  const object = { x: 0, y: 0, width: 100, height: 40 }
  const reading = { x: 10, y: 5, width: 80, height: 30 }
  it('begins clear, moves the masked area and opacity with progress, then restores', () => {
    expect(mainlineReadingLocalFadeMask(object, reading, 8, 12, 0)).toBeNull()
    const quarter = mainlineReadingLocalFadeMask(object, reading, 8, 12, .25)!
    const half = mainlineReadingLocalFadeMask(object, reading, 8, 12, .5)!
    const full = mainlineReadingLocalFadeMask(object, reading, 8, 12, 1)!
    expect(quarter).toContain('rgba(0,0,0,0.75)')
    expect(half).toContain('rgba(0,0,0,0.5)')
    expect(full).toContain('rgba(0,0,0,0)')
    expect(new Set([quarter, half, full]).size).toBe(3)
    expect(quarter).toContain('at 20%')
    expect(half).toContain('at 30%')
    expect(full).toContain('at 50%')
  })
})
