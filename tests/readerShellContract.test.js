import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getPageSceneTrail } from '../src/components/reader/ReaderTraceProgress'
import { isFinalReaderBeat } from '../src/reader/readerPosition'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.jsx')
const landing = read('../src/views/Landing.jsx')
const landingCss = read('../src/views/Landing.css')
const stage = read('../src/views/ReaderStage.jsx')
const stageCss = read('../src/views/ReaderStage.css')
const contractCss = read('../src/views/ReaderShellContract.css')
const progress = read('../src/components/reader/ReaderTraceProgress.jsx')
const beatStack = read('../src/components/reader/ReaderBeatStack.jsx')
const transition = read('../src/components/ReadingTransition.jsx')
const languageWheel = read('../src/components/LanguageWheelSelector.jsx')
const transitionCss = read('../src/components/ReadingTransition.css')
const transitionStore = read('../src/stores/transitionStore.js')
const readingEntryController = read('../src/transitions/readingEntryController.js')
const copy = read('../src/i18n/copy.js')
const returnControl = read('../src/components/reader/ReaderReturnControl.jsx')
const returnSurface = read('../src/components/EntryButtonSurface.jsx')
const returnCss = read('../src/components/reader/ReaderReturnControl.css')
const sharedCss = read('../src/components/EntryButtonSurface.css')
const updatesPage = read('../src/components/LandingUpdatesPage.jsx')
const updatesCss = read('../src/components/LandingUpdatesPage.css')

describe('Reader shell contract boundaries', () => {
  it('keeps Reader shell, tools, progress and environment layers mounted', () => {
    expect(stage).toContain('<ReaderPrecipitation />')
    expect(stage).toContain('<ReaderTraceProgress')
    expect(stage).toContain('const returnVisible = emptyDocument || isFinalReaderBeat(focusBeatIndex, beats)')
    expect(stage).toContain('<ReaderTools')
    expect(stageCss).toContain('.reader-stage-page--standard .reader-stage-beat')
    expect(contractCss).toContain('.reader-stage-page--standard .reader-environment-light')
  })

  it('keeps the final-beat source singular', () => {
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

  it('uses one shared click group for language and reading mode', () => {
    expect(copy).toContain("landingPromptInitial: '开始读取'")
    expect(copy).toContain("landingPromptResume: '继续读取'")
    expect(transition).toContain("import EntryButtonGroup from './EntryButtonGroup'")
    expect(transition).toContain('data-selector-stage={currentStage.id}')
    expect(transition).toContain('className="language-init-title-anchor"')
    expect(transition).toContain('className="language-init-controls"')
    expect(transition).toContain("id: 'language-continue'")
    expect(transition).toContain("import LanguageWheelSelector from './LanguageWheelSelector'")
    expect(transition).not.toContain("id: 'language-change'")
    expect(transition).toContain('const [draftLanguage, setDraftLanguage]')
    expect(transition).toContain('onProceed(draftLanguage)')
    expect(transition).toContain('visible={!leaving}')
    expect(transition).toContain('}, [currentStage.id])')
    expect(transition).not.toContain('}, [currentStage.id, leaving, modeStage])')
    expect(languageWheel).toContain("openSelector('hover')")
    expect(app).toContain("recordRuntimeAudit('language-confirmed'")
    expect(transition).toContain("id: 'mode-immersive'")
    expect(transition).toContain("id: 'mode-standard'")
    expect(transition).not.toContain('RitualHandAffordance')
    expect(transition).not.toContain('LanguageExpandAffordance')
    expect(transition).not.toContain('onPointer')
    expect(transition).not.toContain('onTouch')
    expect(transition).not.toContain('resolveRitual')
    expect(transitionCss).toContain('.reading-transition-entry-group')
    expect(transitionCss).toContain('.language-init-controls')
    expect(transitionCss).toContain('position: absolute')
    expect(transitionCss).toContain('.reading-transition-entry-group .shared-entry-control')
    expect(app).not.toContain('resolveRitualWheelAction')
    expect(app).not.toContain('setHoldProgressPaused')
    expect(app).not.toContain("addEventListener('wheel'")
    expect(readingEntryController).toContain('FIRST_LANDING_LEAVE_MS: 1600')
    expect(readingEntryController).toContain('RETURN_LANDING_LEAVE_MS: 1600')
    expect(readingEntryController).toContain('LANG_LEAVING_MS: 1600')
    expect(readingEntryController).toContain('MODE_LEAVING_MS: 1600')
  })

  it('removes Landing arrows, guide lines and hover-driven entry activation', () => {
    expect(landing).not.toContain('LandingEntryArrow')
    expect(landing).not.toContain('NewToneHandLines')
    expect(landing).not.toContain('onPointerEnter')
    expect(landing).not.toContain('onWheel')
    expect(landingCss).not.toContain('landing-guide-arrow')
    expect(landingCss).not.toContain('landing-title:hover')
  })

  it('keeps Reader Return on the remote shared surface contract', () => {
    expect(returnControl).toContain("import EntryButtonSurface from '../EntryButtonSurface'")
    expect(returnControl).toContain('entryId="reader-return"')
    expect(returnControl).toContain('onActionStart={onReturnStart}')
    expect(returnControl).toContain('onActionComplete={onReturnComplete}')
    expect(returnControl).not.toContain('LandingEntryArrow')
    expect(returnSurface).toContain("entryId === 'reader-return'")
    expect(returnSurface).toContain('data-return-fill-direction')
    expect(returnSurface).toContain('data-return-frame-origin')
    expect(sharedCss).toContain('.shared-entry-control')
    expect(returnCss).toContain('z-index: 9')
  })

  it('keeps Reader return handoff in the live Landing surface', () => {
    expect(transitionStore).toContain("targetView === 'landing' && preset === 'reader-to-surface'")
    expect(transitionStore).toContain("landingArrivalKind: 'return'")
    expect(transitionStore).toContain('const committed = commitTargetView(targetView, preset, payload)')
    expect(landing).toContain("landingArrivalKind === 'return'")
    expect(landing).toContain('setReturnStatusFading(true)')
    expect(landing).toContain('setReturnStatusVisible(false)')
    expect(landing).toContain('await retract(')
    expect(app).toContain('landingHandoff={showLandingHandoffSurface}')
  })

  it('keeps Updates as a page phase with a bottom-left click entry', () => {
    expect(updatesPage).toContain('entryId="landing-updates-return"')
    expect(updatesPage).toContain('visible={interactive}')
    expect(updatesPage).toContain("recordRuntimeAudit('updates-return-intent'")
    expect(updatesPage).not.toContain('addEventListener')
    expect(updatesCss).toContain('left: var(--space-md, 1.5rem)')
    expect(updatesCss).toContain('bottom: var(--space-md, 1.5rem)')
  })

  it('keeps stable scene IDs and exact progress helpers', () => {
    const beats = [
      { worldState: { locationId: 'inner-street' } },
      { worldState: { locationId: 'inner-street' } },
      { worldState: { locationId: 'inner-commercial-street' } },
    ]
    expect(getPageSceneTrail(beats, 1)).toEqual([
      { locationId: 'inner-street', firstBeatIndex: 0, lastBeatIndex: 1, state: 'current' },
      { locationId: 'inner-commercial-street', firstBeatIndex: 2, lastBeatIndex: 2, state: 'future' },
    ])
    expect(progress).toContain('getPageSceneTrail(beats, focusBeatIndex)')
    expect(progress).toContain('Math.round((1 - visualProgress) * 100)')
    expect(progress).toContain('reader-reading-percent-value')
    expect(progress).not.toContain('pointedPercentage')
    expect(progress).not.toContain('linearIndex')
    expect(isFinalReaderBeat(2, [{}, {}, {}])).toBe(true)
    expect(isFinalReaderBeat(1, [{}, {}, {}])).toBe(false)
  })
})
