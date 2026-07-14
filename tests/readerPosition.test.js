import { describe, expect, it } from 'vitest'
import {
  READER_PAGE_MODES,
  readerContent,
  validateReaderContent,
} from '../src/data/readerContent'
import {
  comparePosition,
  createReaderIndex,
  getOverallProgress,
  nextPosition,
  previousPosition,
  readerContentIndex,
  resolvePosition,
} from '../src/reader/readerPosition'

const position = (phaseId, pageId, beatIndex) => ({ phaseId, pageId, beatIndex })
const cloneContent = () => structuredClone(readerContent)

describe('reader content model', () => {
  it('represents M1–M4 with multiple pages and beats', () => {
    expect(readerContent.map(phase => phase.id)).toEqual(['M1', 'M2', 'M3', 'M4'])
    expect(readerContent.every(phase => phase.pages.length > 1)).toBe(true)
    expect(readerContent.every(phase => phase.pages.every(page => page.beats.length > 1))).toBe(true)
  })

  it('expresses focus-sequence, future flow support, scenes, and two-way exits', () => {
    const pages = readerContent.flatMap(phase => phase.pages)

    expect(pages.every(page => page.mode === READER_PAGE_MODES.FOCUS_SEQUENCE)).toBe(true)
    expect(pages.every(page => page.supportedModes.includes(READER_PAGE_MODES.FLOW))).toBe(true)
    expect(pages.every(page => page.scene.id && page.scene.label)).toBe(true)
    expect(pages.every(page => page.exits.backward && page.exits.forward)).toBe(true)
  })

  it('accepts flow as a valid future page mode', () => {
    const content = cloneContent()
    content[0].pages[0].mode = READER_PAGE_MODES.FLOW

    expect(validateReaderContent(content)).toBe(content)
  })

  it('rejects duplicate phase IDs', () => {
    const content = cloneContent()
    content[1].id = 'M1'

    expect(() => validateReaderContent(content)).toThrow('Duplicate phase ID: M1')
  })

  it('rejects duplicate page IDs', () => {
    const content = cloneContent()
    content[1].pages[0].id = content[0].pages[0].id

    expect(() => validateReaderContent(content)).toThrow('Duplicate page ID')
  })

  it('rejects duplicate beat IDs', () => {
    const content = cloneContent()
    content[0].pages[1].beats[0].id = content[0].pages[0].beats[0].id

    expect(() => validateReaderContent(content)).toThrow('Duplicate beat ID')
  })

  it('rejects empty pages', () => {
    const content = cloneContent()
    content[0].pages[0].beats = []

    expect(() => validateReaderContent(content)).toThrow('Empty page')
  })

  it('rejects unknown and missing phases', () => {
    const unknown = cloneContent()
    unknown[0].id = 'M0'
    const missing = cloneContent().slice(0, 3)

    expect(() => validateReaderContent(unknown)).toThrow('Invalid phase ID: M0')
    expect(() => validateReaderContent(missing)).toThrow('Missing phase IDs: M4')
  })
})

describe('reader position navigation', () => {
  const first = position('M1', 'm1-arrival', 0)
  const last = position('M4', 'm4-core', 2)

  it('creates a stable, gap-free linear index', () => {
    expect(Object.isFrozen(readerContent)).toBe(true)
    expect(Object.isFrozen(readerContentIndex.entries)).toBe(true)
    expect(Object.isFrozen(readerContentIndex.pageLookup)).toBe(true)
    expect(readerContentIndex.entries.length).toBe(24)
    expect(readerContentIndex.entries.map(entry => entry.linearIndex)).toEqual(
      Array.from({ length: 24 }, (_, index) => index),
    )
  })

  it('resolves a canonical position without DOM state', () => {
    expect(resolvePosition(position('M2', 'm2-platform', 1))).toEqual({
      phaseId: 'M2',
      pageId: 'm2-platform',
      beatIndex: 1,
      beatId: 'm2-platform-02',
      linearIndex: 7,
    })
  })

  it('rejects invalid phase, page, and beatIndex values', () => {
    expect(() => resolvePosition(position('M9', 'm1-arrival', 0))).toThrow('Invalid phase')
    expect(() => resolvePosition(position('M1', 'missing', 0))).toThrow('Invalid page')
    expect(() => resolvePosition(position('M1', 'm1-arrival', -1))).toThrow('Invalid beatIndex')
    expect(() => resolvePosition(position('M1', 'm1-arrival', 3))).toThrow('Invalid beatIndex')
    expect(() => resolvePosition(position('M1', 'm1-arrival', 1.5))).toThrow('Invalid beatIndex')
  })

  it('does not navigate beyond the first or last position', () => {
    expect(previousPosition(first)).toBeNull()
    expect(nextPosition(last)).toBeNull()
  })

  it('navigates in both directions across a page boundary', () => {
    const endOfPage = position('M1', 'm1-arrival', 2)
    const startOfNextPage = position('M1', 'm1-signal', 0)

    expect(nextPosition(endOfPage)).toMatchObject(startOfNextPage)
    expect(previousPosition(startOfNextPage)).toMatchObject(endOfPage)
  })

  it('navigates in both directions across a phase boundary', () => {
    const endOfM1 = position('M1', 'm1-signal', 2)
    const startOfM2 = position('M2', 'm2-platform', 0)

    expect(nextPosition(endOfM1)).toMatchObject(startOfM2)
    expect(previousPosition(startOfM2)).toMatchObject(endOfM1)
  })

  it('compares positions by stable content order', () => {
    expect(comparePosition(first, first)).toBe(0)
    expect(comparePosition(first, last)).toBe(-1)
    expect(comparePosition(last, first)).toBe(1)
  })

  it('calculates exact start, intermediate, and end progress', () => {
    expect(getOverallProgress(first)).toBe(0)
    expect(getOverallProgress(position('M3', 'm3-archive', 0))).toBeCloseTo(12 / 23)
    expect(getOverallProgress(last)).toBe(1)
  })

  it('can build and navigate a separately validated content value', () => {
    const content = cloneContent()
    const index = createReaderIndex(content)

    expect(index.entries).toHaveLength(24)
    expect(nextPosition(first, content)).toMatchObject(position('M1', 'm1-arrival', 1))
  })
})
