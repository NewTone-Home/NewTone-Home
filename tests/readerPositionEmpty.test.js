import { describe, expect, it } from 'vitest'
import { createReaderIndex } from '../src/reader/readerPosition'

describe('empty Reader index bootstrap', () => {
  it('allows the public Landing shell to load before a publication exists', () => {
    expect(createReaderIndex([], { allowEmpty: true })).toEqual({ entries: [], pageLookup: {} })
    expect(() => createReaderIndex([])).toThrow('non-empty array')
  })
})
