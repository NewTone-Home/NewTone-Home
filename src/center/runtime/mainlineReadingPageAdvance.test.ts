import { describe, expect, it } from 'vitest'
import { mainlineReadingPageAdvanceStartupWatchdogMs, mainlineReadingPageAdvanceTokenIsCurrent, mainlineReadingPageAdvanceWatchdogMayRelease } from './mainlineReadingPageAdvance'

describe('reading page advance lock timing', () => {
  it('uses a startup watchdog only until the real animation reports its start', () => {
    expect(mainlineReadingPageAdvanceStartupWatchdogMs).toBe(5000)
    expect(mainlineReadingPageAdvanceWatchdogMayRelease(13, 13, null)).toBe(true)
    // Once started, even a very delayed/low-frame roll owns its own unlock.
    expect(mainlineReadingPageAdvanceWatchdogMayRelease(13, 13, 13)).toBe(false)
  })

  it('ignores callbacks from a prior page after a newer lock has been issued', () => {
    const previousToken = 12
    const currentToken = 13

    expect(mainlineReadingPageAdvanceTokenIsCurrent(currentToken, previousToken)).toBe(false)
    expect(mainlineReadingPageAdvanceTokenIsCurrent(currentToken, currentToken)).toBe(true)
    expect(mainlineReadingPageAdvanceWatchdogMayRelease(currentToken, previousToken, null)).toBe(false)
    expect(mainlineReadingPageAdvanceWatchdogMayRelease(currentToken, currentToken, previousToken)).toBe(true)
  })
})
