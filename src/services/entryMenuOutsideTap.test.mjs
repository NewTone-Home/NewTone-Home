import { describe, expect, it } from 'vitest'
import { isOutsideMenuTap } from './entryMenuOutsideTap.mjs'

const start = { pointerId: 1, x: 20, y: 30, at: 100, outside: true }
const end = { ...start, at: 200 }
describe('outside menu short-tap gate', () => {
  it('accepts an outside short tap', () => { expect(isOutsideMenuTap(start, end)).toBe(true) })
  it.each([
    ['inside start', { ...start, outside: false }, end],
    ['inside end', start, { ...end, outside: false }],
    ['drag', start, { ...end, y: 90 }],
    ['long hold', start, { ...end, at: 900 }],
    ['other pointer', start, { ...end, pointerId: 2 }],
    ['cancelled/missing start', null, end],
  ])('ignores %s', (_, down, up) => { expect(isOutsideMenuTap(down, up)).toBe(false) })
})
