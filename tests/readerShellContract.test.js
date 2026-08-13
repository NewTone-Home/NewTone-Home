import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getPageSceneTrail } from '../src/components/reader/ReaderTraceProgress'
import { isFinalReaderBeat } from '../src/reader/readerPosition'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const landing = read('../src/views/Landing.jsx')
const landingCss = read('../src/views/Landing.css')
const landingGuideCss = read('../src/views/LandingGuideArrow.css')
const stage = read('../src/views/ReaderStage.jsx')
const stageCss = read('../src/views/ReaderStage.css')
const contractCss = read('../src/views/ReaderShellContract.css')
const progress = read('../src/components/reader/ReaderTraceProgress.jsx')
const returnControl = read('../src/components/reader/ReaderReturnControl.jsx')
const returnSurface = read('../src/components/EntryButtonSurface.jsx')
const returnCss = read('../src/components/reader/ReaderReturnControl.css')
const sharedCss = read('../src/components/EntryButtonSurface.css')
const updatesPage = read('../src/components/LandingUpdatesPage.jsx')
const updatesCss = read('../src/components/LandingUpdatesPage.css')
const copy = read('../src/i18n/copy.js')
const beatStack = read('../src/components/reader/ReaderBeatStack.jsx')

describe('Reader shell contract boundaries', () => {
  it('keeps the Reader shell and environment layers mounted', () => {
    expect(stage).toContain('<ReaderPrecipitation />')
    expect(stage).toContain('<ReaderTraceProgress')
    expect(stage).toContain('const returnVisible = emptyDocument || isFinalReaderBeat(focusBeatIndex, beats)')
    expect(stage).toContain('<ReaderTools')
    expect(stageCss).toContain('.reader-stage-page--standard .reader-stage-beat')
    expect(contractCss).toContain('.reader-stage-page--standard .reader-environment-light')
  })

  it('keeps the Reader final-beat source singular', () => {
    expect(stage).toContain("import { isFinalReaderBeat } from '../reader/readerPosition'")
    expect(stage).toContain('isFinalReaderBeat(focusBeatIndex, beats)')
    expect(stage).toContain('mobile={directReaderInput}')
    expect(stage).toContain('worldLayer={environmentState.worldLayer}')
    expect(stage).not.toContain('window.addEventListener')
    expect(stage).not.toContain('FORWARD_GESTURE')
    expect(stage).not.toContain('REVERSE_GESTURE')
    expect(beatStack).not.toContain('returnArmed')
    expect(beatStack).not.toContain("viewport.addEventListener('wheel'")
    expect(beatStack).toContain('onViewportBoundaryChange?.({')
  })

  it('uses the shared button wrapper without reintroducing an arrow or local state machine', () => {
    expect(returnControl).toContain("import EntryButtonSurface from '../EntryButtonSurface'")
    expect(returnControl).toContain('entryId="reader-return"')
    expect(returnControl).toContain('onActionStart={onReturnStart}')
    expect(returnControl).toContain('onActionComplete={onReturnComplete}')
    expect(returnControl).not.toContain('LandingEntryArrow')
    expect(returnControl).not.toContain('setTimeout')
    expect(returnSurface).toContain("entryId === 'reader-return'")
    expect(returnSurface).toContain('data-return-fill-direction')
    expect(returnSurface).toContain('data-return-frame-origin')
    expect(sharedCss).toContain('color-mix(')
    expect(returnCss).toContain('z-index: 9')
  })

  it('keeps Landing entry semantics explicit and arrow-free', () => {
    expect(landing).toContain('entryId="landing-updates"')
    expect(landing).toContain('entryId={readerEntryId}')
    expect(landing).toContain("const readerEntryId = hasProgress ? 'reader-continue' : 'reader-start'")
    expect(landing).toContain("materialMode={hasProgress ? 'world' : 'background'}")
    expect(landing).toContain('worldLayer={environmentState.worldLayer}')
    expect(landing).toContain('className="landing-guide-entry-arrow"')
    expect(landing.match(/<LandingEntryArrow/g)).toHaveLength(1)
    expect(landing).not.toContain('resolveScrollIntent')
    expect(landing).not.toContain('onUpdatesBarrier')
    expect(copy).toContain("landingPromptInitial: '开始读取'")
    expect(copy).toContain("landingPromptResume: '继续读取'")
    expect(copy).toContain("landingPromptInitial: 'Begin reading'")
  })

  it('keeps the initial guide geometry independent from Updates phases', () => {
    expect(landingGuideCss).toContain('left: 0')
    expect(landingGuideCss).toContain('top: 50%')
    expect(landingGuideCss).toContain('transform-origin: 0 35px')
    expect(landingGuideCss).toContain('transform-box: view-box')
    expect(landingGuideCss).not.toContain('landing[data-updates-phase="enter-arrow-turn"]')
    expect(landingGuideCss).not.toContain('landing-updates-arrow-retract')
    expect(landingCss).toContain('calc(var(--landing-leave-ms, 1600ms) - 360ms) ease-in 360ms')
  })

  it('keeps Updates as a page phase with a bottom-left click entry', () => {
    expect(updatesPage).toContain('entryId="landing-updates-return"')
    expect(updatesPage).toContain('visible={interactive}')
    expect(updatesPage).toContain("recordRuntimeAudit('updates-return-intent'")
    expect(updatesPage).not.toContain('addEventListener')
    expect(updatesPage).not.toContain('LandingUpdatesReturnEntry')
    expect(updatesCss).toContain('left: var(--space-md, 1.5rem)')
    expect(updatesCss).toContain('bottom: var(--space-md, 1.5rem)')
    expect(updatesCss).not.toContain('data-return-state')
  })

  it('preserves the current-page progress contract', () => {
    expect(progress).toContain('getPageSceneTrail(beats, focusBeatIndex)')
    expect(progress).toContain('Math.round((1 - visualProgress) * 100)')
    expect(progress).toContain('reader-reading-percent-value')
    expect(progress).not.toContain('onClick=')
    expect(progress).not.toContain('pointedPercentage')
    expect(progress).not.toContain('linearIndex')
  })

  it('keeps stable scene IDs without rendering scene icons', () => {
    const beats = [
      { worldState: { locationId: 'inner-street' } },
      { worldState: { locationId: 'inner-street' } },
      { worldState: { locationId: 'inner-commercial-street' } },
    ]
    expect(getPageSceneTrail(beats, 1)).toEqual([
      { locationId: 'inner-street', firstBeatIndex: 0, lastBeatIndex: 1, state: 'current' },
      { locationId: 'inner-commercial-street', firstBeatIndex: 2, lastBeatIndex: 2, state: 'future' },
    ])
    expect(progress).not.toContain('<ReaderSceneGlyph')
  })

  it('keeps the final beat helper exact', () => {
    expect(isFinalReaderBeat(2, [{}, {}, {}])).toBe(true)
    expect(isFinalReaderBeat(1, [{}, {}, {}])).toBe(false)
  })
})
