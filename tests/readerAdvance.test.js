import { describe, expect, it } from 'vitest'
import { readerContent } from '../src/data/readerContent'
import { READER_STEP_ACTIONS, resolveReaderStep } from '../src/reader/readerAdvance'
import { resolvePosition } from '../src/reader/readerPosition'

const getPage = pageId => readerContent[0].pages.find(page => page.id === pageId)
const at = (pageId, beatIndex) => resolvePosition({ phaseId: 'M1', pageId, beatIndex })
const beatIndexOf = (pageId, beatId) => getPage(pageId).beats.findIndex(beat => beat.id === beatId)

const step = (pageId, beatId, steps, options = {}) => resolveReaderStep({
  page: getPage(pageId),
  location: at(pageId, beatIndexOf(pageId, beatId)),
  steps,
  ...options,
})

describe('reading cursor is only moved by explicit input steps', () => {
  it('keeps no auto-advance data on any beat', () => {
    const beats = readerContent.flatMap(phase => phase.pages.flatMap(page => page.beats))
    expect(beats.some(beat => beat.sceneState?.autoAdvanceMs)).toBe(false)
  })

  it.each([
    ['commercial-street', 'chase-01'],
    ['commercial-street', 'chase-03'],
    ['threshold-passage', 'threshold-05'],
    ['inner-street', 'street-01'],
    ['ancestral-home', 'home-05'],
  ])('does not move without steps at %s/%s', (pageId, beatId) => {
    expect(step(pageId, beatId, 0)).toEqual({ type: READER_STEP_ACTIONS.NONE })
  })

  it('advances the chase sequence exactly one beat per forward step', () => {
    const chaseIds = ['chase-01', 'chase-02', 'chase-03', 'chase-04', 'chase-05']
    let location = at('commercial-street', beatIndexOf('commercial-street', 'commercial-14'))
    for (const chaseId of chaseIds) {
      const action = resolveReaderStep({ page: getPage('commercial-street'), location, steps: 1 })
      expect(action.type).toBe(READER_STEP_ACTIONS.BEAT)
      expect(action.location.beatIndex).toBe(beatIndexOf('commercial-street', chaseId))
      location = at('commercial-street', action.location.beatIndex)
    }
  })

  it('allows backward review inside the chase sequence', () => {
    const action = step('commercial-street', 'chase-03', -1)
    expect(action.type).toBe(READER_STEP_ACTIONS.BEAT)
    expect(action.location.beatIndex).toBe(beatIndexOf('commercial-street', 'chase-02'))
  })

  it('clamps one gesture to the page boundary instead of crossing it', () => {
    const action = step('commercial-street', 'chase-03', 99)
    expect(action.type).toBe(READER_STEP_ACTIONS.BEAT)
    expect(action.location.beatIndex).toBe(beatIndexOf('commercial-street', 'chase-05'))
    expect(action.reachedBoundary).toBe(true)
  })
})

describe('doorway white-flash boundary', () => {
  it('requires a fresh forward step at threshold-05 and lands exactly on street-01', () => {
    const action = step('threshold-passage', 'threshold-05', 1)
    expect(action).toEqual({
      type: READER_STEP_ACTIONS.PAGE,
      location: { phaseId: 'M1', pageId: 'inner-street', beatIndex: 0 },
      boundaryVisual: 'white-flash',
    })
  })

  it('street-01 continues only with a new forward step', () => {
    const action = step('inner-street', 'street-01', 1)
    expect(action.type).toBe(READER_STEP_ACTIONS.BEAT)
    expect(action.location.beatIndex).toBe(beatIndexOf('inner-street', 'street-02'))
  })

  it('street-01 can step back across the boundary to threshold-05', () => {
    const action = step('inner-street', 'street-01', -1)
    expect(action.type).toBe(READER_STEP_ACTIONS.PAGE)
    expect(action.location.pageId).toBe('threshold-passage')
    expect(action.location.beatIndex).toBe(beatIndexOf('threshold-passage', 'threshold-05'))
    expect(action.boundaryVisual).toBe(null)
  })

  it('ordinary page boundaries carry no boundary visual', () => {
    const lastHomeBeat = getPage('ancestral-home').beats.at(-1).id
    const action = step('ancestral-home', lastHomeBeat, 1)
    expect(action.type).toBe(READER_STEP_ACTIONS.PAGE)
    expect(action.boundaryVisual).toBe(null)
  })
})

describe('chapter end boundary', () => {
  it('emits chapter-end on a fresh forward step at the final beat', () => {
    const lastCornerBeat = getPage('crowd-corner').beats.at(-1).id
    expect(step('crowd-corner', lastCornerBeat, 1)).toEqual({ type: READER_STEP_ACTIONS.CHAPTER_END })
  })

  it('stays inert at the final beat once the chapter trial has ended', () => {
    const lastCornerBeat = getPage('crowd-corner').beats.at(-1).id
    expect(step('crowd-corner', lastCornerBeat, 1, { chapterTrialEnded: true }))
      .toEqual({ type: READER_STEP_ACTIONS.NONE })
  })
})
