import { describe, expect, it } from 'vitest'
import { mainlineObservationPageIsSettled } from '../src/center/runtime/mainlineObservationTyping'

describe('mainline observation typewriter page gate', () => {
  it('holds the incoming page until its own flip reports settled', () => {
    expect(mainlineObservationPageIsSettled('office-window:2', 'office-window:1')).toBe(false)
    expect(mainlineObservationPageIsSettled('office-window:2', null)).toBe(false)
    expect(mainlineObservationPageIsSettled('office-window:2', 'office-window:2')).toBe(true)
  })

  it('does not let a late completion from an older page unlock the current page', () => {
    const currentPageKey = 'office-window:3'
    const lateSettledPageKey = 'office-window:2'
    expect(mainlineObservationPageIsSettled(currentPageKey, lateSettledPageKey)).toBe(false)
  })
})
