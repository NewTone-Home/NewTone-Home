import { describe, expect, it } from 'vitest'
import { isOutsideMenuTap, trackOutsideMenuMove } from './entryMenuOutsideTap.mjs'

const start = { pointerId: 1, x: 20, y: 30, at: 100, outside: true }
const end = { ...start, at: 200 }
describe('outside menu short-tap gate', () => {
  it('accepts an outside short tap', () => { expect(isOutsideMenuTap(start, end)).toBe(true) })
  it('never turns an out-and-back path into a tap even with identical endpoints', () => {
    let tracked = trackOutsideMenuMove(start, { ...start, x: 80, at: 130 })
    tracked = trackOutsideMenuMove(tracked, { ...start, at: 160 })
    expect(tracked.exceeded).toBe(true)
    expect(isOutsideMenuTap(tracked, end)).toBe(false)
  })
  it('accepts small movement without permanently exceeding the threshold', () => {
    const tracked = trackOutsideMenuMove(start, { ...start, x: 24, y: 33 })
    expect(isOutsideMenuTap(tracked, end)).toBe(true)
  })
  it('isolates another pointer and ignores updates after cancellation', () => {
    expect(trackOutsideMenuMove(start, { ...start, pointerId: 2, x: 100 })).toBe(start)
    expect(trackOutsideMenuMove(null, { ...start, x: 100 })).toBeNull()
  })
  it.each([
    ['inside start', { ...start, outside: false }, end],
    ['inside end', start, { ...end, outside: false }],
    ['drag', start, { ...end, y: 90 }],
    ['long hold', start, { ...end, at: 900 }],
    ['other pointer', start, { ...end, pointerId: 2 }],
    ['cancelled/missing start', null, end],
  ])('ignores %s', (_, down, up) => { expect(isOutsideMenuTap(down, up)).toBe(false) })
})
