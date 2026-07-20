import { describe, expect, it } from 'vitest'
import { READER_PAGE_MODES, READER_TRANSITION_TYPES, readerContent, validateReaderContent } from '../src/data/readerContent'
import { comparePosition, createReaderIndex, getOverallProgress, nextPosition, previousPosition, readerContentIndex, resolvePosition } from '../src/reader/readerPosition'

const position = (pageId, beatIndex) => ({ phaseId: 'M1', pageId, beatIndex })
const cloneContent = () => structuredClone(readerContent)

describe('first chapter Reader content model', () => {
  it('represents one internal M with five configured reading pages', () => {
    expect(readerContent.map(phase => phase.id)).toEqual(['M1'])
    expect(readerContent[0].pages).toHaveLength(5)
    expect(readerContent[0].pages.map(page => page.beats.length)).toEqual([14, 5, 7, 19, 8])
  })

  it('keeps scene, beats, boundary classification, and transition type on every page', () => {
    const pages = readerContent[0].pages
    expect(pages.every(page => page.mode === READER_PAGE_MODES.FOCUS_SEQUENCE)).toBe(true)
    expect(pages.every(page => page.supportedModes.includes(READER_PAGE_MODES.FLOW))).toBe(true)
    expect(pages.every(page => page.scene.label && page.boundary?.kind && page.transitionType)).toBe(true)
    expect(pages.some(page => page.leftExit || page.rightExit || page.exits)).toBe(false)
    expect(pages.map(page => page.transitionType)).toEqual([
      READER_TRANSITION_TYPES.STANDARD,
      READER_TRANSITION_TYPES.STANDARD,
      READER_TRANSITION_TYPES.STANDARD,
      READER_TRANSITION_TYPES.STANDARD,
      READER_TRANSITION_TYPES.CHAPTER_END,
    ])
    expect(pages.find(page => page.id === 'threshold-passage').beats.at(-1).sceneState.boundaryVisual).toBe('white-flash')
    expect(pages.flatMap(page => page.beats).some(beat => beat.sceneState?.autoAdvanceMs)).toBe(false)
    expect(pages.find(page => page.id === 'commercial-street').beats.filter(beat => beat.sceneState?.sceneState === 'chase')).toHaveLength(5)
  })

  it('accepts flow as a future page mode', () => {
    const content = cloneContent()
    content[0].pages[0].mode = READER_PAGE_MODES.FLOW
    expect(validateReaderContent(content)).toBe(content)
  })

  it('rejects duplicate phase, page, and beat IDs', () => {
    const duplicatePhase = cloneContent()
    duplicatePhase.push(structuredClone(duplicatePhase[0]))
    expect(() => validateReaderContent(duplicatePhase)).toThrow('Duplicate phase ID')

    const duplicatePage = cloneContent()
    duplicatePage[0].pages[1].id = duplicatePage[0].pages[0].id
    expect(() => validateReaderContent(duplicatePage)).toThrow('Duplicate page ID')

    const duplicateBeat = cloneContent()
    duplicateBeat[0].pages[1].beats[0].id = duplicateBeat[0].pages[0].beats[0].id
    expect(() => validateReaderContent(duplicateBeat)).toThrow('Duplicate beat ID')
  })

  it('rejects empty content, unknown phases, and empty pages', () => {
    expect(() => validateReaderContent([])).toThrow('non-empty')
    const unknown = cloneContent()
    unknown[0].id = 'M0'
    expect(() => validateReaderContent(unknown)).toThrow('Invalid phase ID')
    const empty = cloneContent()
    empty[0].pages[0].beats = []
    expect(() => validateReaderContent(empty)).toThrow('Empty page')
  })
})

describe('reader position navigation', () => {
  const first = position('ancestral-home', 0)
  const last = position('crowd-corner', 7)

  it('creates a stable, gap-free 53-beat index', () => {
    expect(Object.isFrozen(readerContent)).toBe(true)
    expect(readerContentIndex.entries).toHaveLength(53)
    expect(readerContentIndex.entries.map(entry => entry.linearIndex)).toEqual(Array.from({ length: 53 }, (_, index) => index))
  })

  it('resolves canonical positions and rejects invalid input', () => {
    expect(resolvePosition(position('inner-street', 1))).toMatchObject({ beatId: 'street-02', linearIndex: 20 })
    expect(() => resolvePosition({ phaseId: 'M9', pageId: 'ancestral-home', beatIndex: 0 })).toThrow('Invalid phase')
    expect(() => resolvePosition(position('missing', 0))).toThrow('Invalid page')
    expect(() => resolvePosition(position('ancestral-home', 14))).toThrow('Invalid beatIndex')
  })

  it('navigates and compares across page boundaries without gaps', () => {
    expect(previousPosition(first)).toBeNull()
    expect(nextPosition(last)).toBeNull()
    expect(nextPosition(position('ancestral-home', 13))).toMatchObject(position('threshold-passage', 0))
    expect(previousPosition(position('inner-street', 0))).toMatchObject(position('threshold-passage', 4))
    expect(comparePosition(first, last)).toBe(-1)
    expect(getOverallProgress(first)).toBe(0)
    expect(getOverallProgress(last)).toBe(1)
  })

  it('can build a separately validated content index', () => {
    expect(createReaderIndex(cloneContent()).entries).toHaveLength(53)
  })
})
