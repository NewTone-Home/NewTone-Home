import { describe, expect, it } from 'vitest'
import { isReaderReturnActivationKey } from '../src/components/reader/readerReturnKeyboard'

describe('reader return keyboard activation', () => {
  it('accepts Enter and Space', () => {
    expect(isReaderReturnActivationKey('Enter')).toBe(true)
    expect(isReaderReturnActivationKey(' ')).toBe(true)
  })

  it('rejects unrelated keys', () => {
    expect(isReaderReturnActivationKey('Escape')).toBe(false)
    expect(isReaderReturnActivationKey('ArrowDown')).toBe(false)
    expect(isReaderReturnActivationKey('Spacebar')).toBe(false)
  })
})
