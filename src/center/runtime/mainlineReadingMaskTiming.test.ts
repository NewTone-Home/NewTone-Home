import { describe, expect, it } from 'vitest'
import { mainlineReadingMaskReleaseDelayMs, mainlineReadingTypingDelayMs } from './mainlineReadingTextMotion'

describe('reading region timing', () => {
  it('lets the first local background fade finish before typing and retains regions briefly on exit', () => {
    expect(mainlineReadingTypingDelayMs).toBe(140)
    expect(mainlineReadingMaskReleaseDelayMs).toBe(120)
  })
})
