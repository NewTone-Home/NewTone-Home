import { describe, expect, it } from 'vitest'
import { advanceAdminSequence, createAdminSequenceState } from '../src/admin/adminAccessSequence'

function enter(keys, times = keys.map((_, index) => index * 100)) {
  let state = createAdminSequenceState()
  let matched = false
  keys.forEach((key, index) => ({ state, matched } = advanceAdminSequence(state, key, times[index])))
  return { state, matched }
}

describe('owner admin entry sequence', () => {
  it('matches only the exact 9989 sequence', () => {
    expect(enter(['9', '9', '8', '9']).matched).toBe(true)
    expect(enter(['9', '9', '9', '8', '9']).matched).toBe(false)
  })

  it('expires and resets the discovery sequence', () => {
    expect(enter(['9', '9', '8', '9'], [0, 100, 200, 2000]).matched).toBe(false)
    expect(enter(['9', 'x', '9', '8', '9']).matched).toBe(false)
  })
})
