import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../i18n/copy'
import { landingIntroState } from '../services/entryPresentation.mjs'
import { getReaderEntryIntent, hasStableReaderProgress } from '../reader/readerEntry'
import { LANDING_LEAVE_FADE_DELAY_MS, LANDING_RETURN_RETRACT_MS, TITLE_PHASE, writeIntroCompleted } from '../services/landingIntro'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSceneParallax } from '../hooks/useSceneParallax'
import { useTitleRetrace } from '../hooks/useTitleRetrace'
import { LANDING_SCENES, resolveLandingScene } from '../landing/landingScene'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import { resolveDisplayedReaderLanguage } from '../i18n/languages'
import EntryButtonGroup from '../components/EntryButtonGroup'
import LandingJijiaScene from '../components/landing/LandingJijiaScene'
import LandingTitleMark from '../components/landing/LandingTitleMark'
import '../styles/sketchPrimitives.css'
import './Landing.css'
import './LandingUpdatesEntry.css'

const RETURN_STATUS_BLINK_MS = 800
const RETURN_STATUS_FADE_MS = 260

function Landing({
  onEnter,
  onEnterUpdates,
  leaving,
  leavingMs,
  surfaceStyle,
  readingMode,
  environmentState,
  worldEntryPhase = 'idle',
  onWorldCoverComplete,
  updatesPhase,
  worldMode = false,
  entryUI,
  preferences = {},
  landingIntroPreview,
  inspectionSettled = false,
}) {
  const { language = 'zh', hasInitializedLanguage = false, motionMode = 'full' } = preferences
  const readerStarted = false
  const readerCompleted = false

  const introPreviewState = landingIntroState(landingIntroPreview)
  const [introCompleted, setIntroCompleted] = useState(null)
  useEffect(() => {
    setIntroCompleted(introPreviewState === 'unknown' ? null : introPreviewState === 'learned')
  }, [introPreviewState])
  const [returnArrival] = useState(false)
  const [returnSequenceActive, setReturnSequenceActive] = useState(returnArrival)
  const [returnStatusVisible, setReturnStatusVisible] = useState(returnArrival)
  const [returnStatusFading, setReturnStatusFading] = useState(false)
  const landingRef = useRef(null)
  const landingLeaveRetractStartedRef = useRef(false)
  const worldCoverCompleteRef = useRef(false)

  useLayoutEffect(() => {
    // A user may have scrolled the short idle menu. Restore the original origin
    // before either existing transition paints; never persist UI scroll in save.
    if (worldEntryPhase !== 'idle' || updatesPhase !== UPDATES_PHASE.LANDING) {
      if (landingRef.current) landingRef.current.scrollTop = 0
    }
  }, [worldEntryPhase, updatesPhase])

  const reducedMotion = useReducedMotion()
  const [landingScene] = useState(() => resolveLandingScene(window.location.search))

  const handleIntroComplete = useCallback(() => {
    if (introPreviewState !== 'not-learned') return
    writeIntroCompleted()
    setIntroCompleted(true)
  }, [introPreviewState])

  const { phase, phaseRef, sweepRef, begin, retract } = useTitleRetrace({
    introCompleted,
    reduced: reducedMotion || motionMode === 'reduced',
    onIntroComplete: handleIntroComplete,
  })

  const entryPromptsActive = !returnSequenceActive
    && ([TITLE_PHASE.DRAWING, TITLE_PHASE.REVEALED].includes(phase)
      || (returnArrival && phase === TITLE_PHASE.IDLE))

  useSceneParallax({
    rootRef: landingRef,
    enabled: true,
    reduced: reducedMotion || motionMode === 'reduced',
  })

  useEffect(() => {
    // Reader return state is retired; entry state is owned by the save entry controller.
  }, [returnArrival])

  useEffect(() => {
    if (!inspectionSettled || returnArrival || returnSequenceActive || phaseRef.current !== TITLE_PHASE.IDLE) return undefined
    const frame = window.requestAnimationFrame(() => { begin({ markIntroComplete: introPreviewState === 'not-learned' }) })
    return () => window.cancelAnimationFrame(frame)
  }, [begin, phaseRef, returnArrival, returnSequenceActive, inspectionSettled, introPreviewState])

  useEffect(() => {
    if (!leaving) {
      landingLeaveRetractStartedRef.current = false
      return undefined
    }
    if (landingLeaveRetractStartedRef.current) return undefined
    landingLeaveRetractStartedRef.current = true
    const duration = reducedMotion || motionMode === 'reduced'
      ? 0
      : Math.max(0, leavingMs - LANDING_LEAVE_FADE_DELAY_MS)
    retract({ duration })
    return undefined
  }, [leaving, motionMode, reducedMotion, retract])

  useEffect(() => {
    if (!returnArrival) return undefined

    let cancelled = false
    let frame = 0
    const timers = []
    const wait = ms => new Promise(resolve => {
      const timer = window.setTimeout(resolve, ms)
      timers.push(timer)
    })

    frame = window.requestAnimationFrame(async () => {
      const reduced = reducedMotion || motionMode === 'reduced'
      const statusFadeDuration = reduced ? 0 : RETURN_STATUS_FADE_MS

      await begin({ duration: 0, markIntroComplete: false })
      if (cancelled) return

      setReturnStatusFading(true)
      await Promise.all([
        retract({ duration: reduced ? 0 : LANDING_RETURN_RETRACT_MS }),
        wait(statusFadeDuration),
      ])
      if (cancelled) return

      setReturnStatusVisible(false)
      setReturnSequenceActive(false)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [begin, motionMode, reducedMotion, retract, returnArrival])

  const hasProgress = hasStableReaderProgress({ readerStarted, readerCompleted })
  const { language: landingLanguage } = resolveDisplayedReaderLanguage({
    language,
    hasInitializedLanguage,
    browserLanguages: navigator.languages || [navigator.language || ''],
  })
  const readerEntryId = hasProgress ? 'reader-continue' : 'reader-start'
  const landingEntries = useMemo(() => {
    const entries = [{
      id: 'updates',
      label: copy[landingLanguage]?.updates || (landingLanguage === 'zh' ? '更新公告' : 'Updates'),
      materialMode: 'background',
    }]
    if (worldMode) {
      entries.push({
        id: 'world',
        label: '进入世界',
        materialMode: 'world',
        worldLayer: environmentState.worldLayer,
      })
      return entries
    }
    entries.push({
      id: readerEntryId,
      label: hasProgress
        ? (copy[landingLanguage]?.continueReading || copy[landingLanguage]?.transitionResume)
        : copy[landingLanguage]?.transitionStart,
      materialMode: hasProgress ? 'world' : 'background',
      worldLayer: environmentState.worldLayer,
    })
    return entries
  }, [environmentState.worldLayer, hasProgress, landingLanguage, readerEntryId, worldMode])
  const returnStatusBase = copy[landingLanguage]?.transitionReturn
    || copy[landingLanguage]?.backToLanding
    || copy.zh.transitionReturn
  const returnStatusText = `${returnStatusBase}${landingLanguage === 'zh' ? '……' : '…'}`
  const titleTouched = phase !== TITLE_PHASE.IDLE
  const landingEntriesVisible = !leaving && entryPromptsActive && updatesPhase === UPDATES_PHASE.LANDING

  useEffect(() => {
    if (worldEntryPhase !== 'covering') {
      worldCoverCompleteRef.current = false
      return undefined
    }
    if (worldCoverCompleteRef.current || !(reducedMotion || motionMode === 'reduced')) return undefined
    worldCoverCompleteRef.current = true
    onWorldCoverComplete?.()
    return undefined
  }, [motionMode, onWorldCoverComplete, reducedMotion, worldEntryPhase])

  const handleWorldEntryAnimationEnd = useCallback((event) => {
    if (event.animationName !== 'landing-world-surface-cover' || worldCoverCompleteRef.current) return
    worldCoverCompleteRef.current = true
    onWorldCoverComplete?.()
  }, [onWorldCoverComplete])

  const handleEntryNavigate = useCallback((entryId) => {
    if (entryId === 'updates') {
      onEnterUpdates?.()
      return
    }
    if (entryId === 'world' && worldMode) {
      onEnter?.()
      return
    }
    onEnter?.(getReaderEntryIntent({ readerStarted, readerCompleted }))
  }, [onEnter, onEnterUpdates, worldMode])

  return (
    <div
      ref={landingRef}
      className={`landing paper-surface${leaving ? ' landing--leaving' : ''}${landingScene ? ' landing--scene' : ''}${returnSequenceActive ? ' landing--return-sequence' : ''}${worldEntryPhase !== 'idle' ? ` landing--world-entry landing--world-entry-${worldEntryPhase}` : ''}`}
      onAnimationEnd={handleWorldEntryAnimationEnd}
      style={{
        ...surfaceStyle,
        '--landing-leave-ms': `${leavingMs}ms`,
        '--landing-leave-delay-ms': `${LANDING_LEAVE_FADE_DELAY_MS}ms`,
        '--landing-return-blink-ms': `${RETURN_STATUS_BLINK_MS}ms`,
      }}
      data-landing-intro-status={introPreviewState}
      data-reading-mode={readingMode}
      data-world-layer={environmentState.worldLayer}
      data-time-of-day={environmentState.time}
      data-weather={environmentState.weather}
      data-world-entry-phase={worldEntryPhase}
      data-landing-arrival={returnArrival ? 'return' : 'main'}
      data-entry-phase={entryPromptsActive ? 'visible' : 'hidden'}
      data-updates-phase={updatesPhase}
    >
      {landingScene === LANDING_SCENES.JIJIA_COMPOUND && <LandingJijiaScene awake={titleTouched} />}

      <div className="landing-main">
        <div className="landing-title-stack">
          <h1
            className={[
              'landing-title',
              `landing-title--${phase}`,
              phase === TITLE_PHASE.REVEALED ? 'landing-title--drawn' : '',
            ].filter(Boolean).join(' ')}
            data-motion-parallax-trigger="true"
          >
            <span className="landing-title-text" data-landing-title-visual="true">
              <span className="landing-title-breath">
                <span className="landing-title-n-host">N</span>
                {'ewTone'}
                <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
              </span>
            </span>
          </h1>

          {returnStatusVisible && (
            <div className={`landing-return-status${returnStatusFading ? ' landing-return-status--fading' : ''}`} aria-live="polite">
              <span className="landing-return-status__text">{returnStatusText}</span>
            </div>
          )}

          {landingEntriesVisible && worldEntryPhase === 'idle' && (
            <>
              {entryUI ? <div className="landing-entry-button-group landing-entry-area">
                <div className="landing-entry-row">
                  <EntryButtonGroup groupId="landing-updates"
                    entries={landingEntries.filter(entry => entry.id === 'updates')}
                    onNavigate={handleEntryNavigate} />
                  {entryUI}
                </div>
              {worldMode && (
                <p className="landing-device-hint" data-world-mode="true" role="note">
                  当前仍处于开发阶段，电脑或 iPad 体验更佳
                </p>
              )}
              </div> : <>
                <EntryButtonGroup groupId="landing-entries" entries={landingEntries}
                  onNavigate={handleEntryNavigate} className="landing-entry-button-group" />
              {worldMode && (
                <p className="landing-device-hint" data-world-mode="true" role="note">
                  当前仍处于开发阶段，电脑或 iPad 体验更佳
                </p>
              )}
              </>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Landing
