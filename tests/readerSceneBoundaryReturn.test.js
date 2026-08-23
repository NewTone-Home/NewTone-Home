import { describe, expect, it } from 'vitest'
import { isSceneBoundaryReturnVisible } from '../src/reader/readerFlow'

describe('Reader Scene return boundary visibility', () => {
  const boundaries = [
    { fromIndex: 1, toIndex: 2 },
    { fromIndex: 4, toIndex: 5 },
  ]

  it('shows the complete entry only while the current Scene last beat is focused', () => {
    expect(isSceneBoundaryReturnVisible(0, boundaries)).toBe(false)
    expect(isSceneBoundaryReturnVisible(1, boundaries)).toBe(true)
    expect(isSceneBoundaryReturnVisible(2, boundaries)).toBe(false)
    expect(isSceneBoundaryReturnVisible(3, boundaries)).toBe(false)
    expect(isSceneBoundaryReturnVisible(4, boundaries)).toBe(true)
    expect(isSceneBoundaryReturnVisible(5, boundaries)).toBe(false)
  })
})
