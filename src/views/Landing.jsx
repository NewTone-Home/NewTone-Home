import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import { copy } from '../i18n/copy'
import { getReaderEntryIntent, hasStableReaderProgress } from '../reader/readerEntry'
import {
  LANDING_GUIDE_DELAY_MS,
  TITLE_PHASE,
  readIntroCompleted,
  shouldScheduleLandingGuide,
  writeIntroCompleted,
} from '../landing/landingIntro'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSceneParallax } from '../hooks/useSceneParallax'
import { useTitleRetrace } from '../hooks/useTitleRetrace'
import { LANDING_SCENES, resolveLandingScene } from '../landing/landingScene'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import { detectBrowserReaderLanguage } from '../i18n/languages'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import EntryButtonSurface from '../components/EntryButtonSurface'
import LandingJijiaScene from '../components/landing/LandingJijiaScene'
import LandingEntryArrow from '../components/landing/LandingEntryArrow'
import LandingTitleMark, { NewToneHandLines } from '../components/landing/LandingTitleMark'
import '../styles/sketchPrimitives.css'
import './Landing.css'
import './LandingGuideArrow.css'

const RETURN_TITLE_DRAW_MS = 1450
const RETURN_STATUS_BLINK_MS = 800
const RETURN_STATUS_BLINK_COUNT = 2
const RETURN_STATUS_TOTAL_MS = RETURN_STATUS_BLINK_MS * RETURN_STATUS_BLINK_COUNT
const RETURN_STATUS_FADE_MS = 260
const RETURN_GUIDE_DELAY_MS = 1600

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function Landing({
  onEnter,
  onEnterUpdates,
  updatesPhase = UPDATES_PHASE.LANDING,
  leaving,
  leavingMs,
  surfaceStyle,
  readingMode,
  environmentState,
  guidePaused = false,
}) {
  const language = useProgressStore(s => s.language)
  const hasInitializedLanguage = useProgressStore(s => s.hasInitializedLanguage)
  const readerStarted = useProgressStore(s => s.readerStarted)
  const readerCompleted = useProgressStore(s => s.readerCompleted)
  const motionMode = useProgressStore(s => s.motionMode)

  const [introCompleted, setIntroCompleted] = useState(() => readIntroCompleted())
  const [returnArrival] = useState(() => useTransitionStore.getState().landingArrivalKind === 'return')
  const [returnSequenceActive, setReturnSequenceActive] = useState(returnArrival)
  const [returnStatusVisible, setReturnStatusVisible] = useState(returnArrival)
  const [returnStatusFading, setReturnStatusFading] = useState(false)
  const [guidePhase, setGuidePhase] = useState(() => returnArrival ? 'hidden' : 'quiet')
  const [entryActivationPending, setEntryActivationPending] = useState(null)
  const guidePhaseRef = useRef(guidePhase)
  const entryActivationRef = useRef(null)
  const activationTimerRef = useRef(0)
  const returnSequenceStartedRef = useRef(false)
  const returnInputLockedRef = useRef(returnArrival)
  const landingRef = useRef(null)
  const introRef = useRef(introCompleted)

  const reducedMotion = useReducedMotion()
  const [landingScene] = useState(() => resolveLandingScene(window.location.search))

  const handleIntroComplete = useCallback(() => {
    writeIntroCompleted()
    setIntroCompleted(true)
  }, [])

  const { phase, phaseRef, sweepRef, begin, retract } = useTitleRetrace({
    introCompleted,
    reduced: reducedMotion || motionMode === 'reduced',
    onIntroComplete: handleIntroComplete,
  })

  const entryPromptsActive = !returnSequenceActive
    && updatesPhase === UPDATES_PHASE.LANDING
    && [TITLE_PHASE.DRAWING, TITLE_PHASE.REVEALED].includes(phase)

  const guideVisible = !entryPromptsActive && !leaving

  useEffect(() => {
    introRef.current = introCompleted
  }, [introCompleted])

  useEffect(() => {
    guidePhaseRef.current = guidePhase
  }, [guidePhase])

  useEffect(() => {
    if (updatesPhase === UPDATES_PHASE.LANDING && !leaving) {
      entryActivationRef.current = null
      setEntryActivationPending(null)
    }
  }, [leaving, updatesPhase])

  useSceneParallax({
    rootRef: landingRef,
    enabled: true,
    reduced: reducedMotion || motionMode === 'reduced',
  })

  useEffect(() => {
    if (returnArrival) useTransitionStore.getState().clearLandingArrival()
  }, [returnArrival])

  useEffect(() => {
    if (!returnArrival || returnSequenceStartedRef.current) return undefined
    returnSequenceStartedRef.current = true

    let cancelled = false
    let frame = 0
    const timers = []
    const wait = ms => new Promise(resolve => {
      const timer = window.setTimeout(resolve, ms)
      timers.push(timer)
    })

    frame = window.requestAnimationFrame(async () => {
      const reduced = reducedMotion || motionMode === 'reduced'
      const statusDuration = reduced ? 320 : RETURN_STATUS_TOTAL_MS
      const statusFadeDuration = reduced ? 0 : RETURN_STATUS_FADE_MS
      const drawDuration = reduced ? 0 : RETURN_TITLE_DRAW_MS
      const guideDelay = reduced ? 300 : RETURN_GUIDE_DELAY_MS

      await Promise.all([
        begin({ duration: drawDuration, markIntroComplete: false }),
        wait(statusDuration),
      ])
      if (cancelled) return

      setReturnStatusFading(true)
      await wait(statusFadeDuration)
      if (cancelled) return

      setReturnStatusVisible(false)
      await retract({ duration: reduced ? 0 : undefined })
      if (cancelled) return

      returnInputLockedRef.current = false

      await wait(guideDelay)
      if (cancelled) return

      setGuidePhase('visible')
      setReturnSequenceActive(false)
    })

    return () => {
      cancelled = true
      returnSequenceStartedRef.current = false
      window.cancelAnimationFrame(frame)
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [begin, motionMode, reducedMotion, retract, returnArrival])

  useEffect(() => {
    if (returnSequenceActive) {
      if (guidePhaseRef.current !== 'hidden') setGuidePhase('hidden')
      return undefined
    }
    if (guidePaused) {
      setGuidePhase('hidden')
      return undefined
    }
    if (
      guidePhaseRef.current === 'visible'
      && [TITLE_PHASE.IDLE, TITLE_PHASE.DRAWING, TITLE_PHASE.REVEALED].includes(phase)
    ) return undefined
    if (phase !== TITLE_PHASE.IDLE) {
      if (guidePhaseRef.current !== 'retracting') setGuidePhase('hidden')
      return undefined
    }
    if (!shouldScheduleLandingGuide({
      phase,
      activationPending: Boolean(entryActivationRef.current),
    })) {
      setGuidePhase('hidden')
      return undefined
    }
    setGuidePhase('quiet')
    const timer = window.setTimeout(() => {
      if (!entryActivationRef.current && phaseRef.current === TITLE_PHASE.IDLE) {
        setGuidePhase('visible')
      }
    }, LANDING_GUIDE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [guidePaused, phase, phaseRef, returnSequenceActive])

  useEffect(() => () => window.clearTimeout(activationTimerRef.current), [])

  const activateTitle = useCallback(() => {
    if (returnSequenceActive || phaseRef.current !== TITLE_PHASE.IDLE || entryActivationRef.current) return
    begin()
  }, [begin, phaseRef, returnSequenceActive])

  const handleTitlePointerEnter = event => {
    if (event.pointerType === 'touch') return
    activateTitle()
  }

  const handleEntryActionStart = useCallback(({ entryId, inputType }) => {
    if (entryActivationRef.current && entryActivationRef.current !== entryId) return
    entryActivationRef.current = entryId
    setEntryActivationPending(entryId)
    recordRuntimeAudit('entry-action-start', {
      entryId,
      inputType,
      source: 'button',
    })
  }, [])

  const handleEntryActionComplete = useCallback(({ entryId, inputType }) => {
    if (entryActivationRef.current !== entryId) return
    recordRuntimeAudit('entry-navigation-ready', {
      entryId,
      inputType,
      source: 'button',
    })
    if (entryId === 'landing-updates') {
      onEnterUpdates?.()
      return
    }
    onEnter?.(getReaderEntryIntent(useProgressStore.getState()))
  }, [onEnter, onEnterUpdates])

  const hasProgress = hasStableReaderProgress({ readerStarted, readerCompleted })
  const landingLanguage = hasInitializedLanguage
    ? language
    : detectBrowserReaderLanguage(navigator.languages || [navigator.language])
  const languageCopy = copy[landingLanguage] || copy.zh
  const promptText = hasProgress
    ? languageCopy.landingPromptResume
    : languageCopy.landingPromptInitial
  const updatesPromptText = landingLanguage === 'zh' ? '更新公告' : 'Updates'
  const returnStatusBase = languageCopy.transitionReturn
    || languageCopy.backToLanding
    || copy.zh.transitionReturn
  const returnStatusText = `${returnStatusBase}${landingLanguage === 'zh' ? '……' : '…'}`
  const readerEntryId = hasProgress ? 'reader-continue' : 'reader-start'
  const coarsePointer = isCoarsePointer()
  const buttonDisabled = Boolean(entryActivationPending)

  return (
    <div
      ref={landingRef}
      className={`landing paper-surface${leaving ? ' landing--leaving' : ''}${landingScene ? ' landing--scene' : ''}${returnSequenceActive ? ' landing--return-sequence' : ''}`}
      style={{ ...surfaceStyle, '--landing-leave-ms': `${leavingMs}ms`, '--landing-return-blink-ms': `${RETURN_STATUS_BLINK_MS}ms` }}
      data-reading-mode={readingMode}
      data-world-layer={environmentState.worldLayer}
      data-time-of-day={environmentState.time}
      data-weather={environmentState.weather}
      data-landing-arrival={returnArrival ? 'return' : 'main'}
      data-updates-phase={updatesPhase}
    >
      {landingScene === LANDING_SCENES.JIJIA_COMPOUND && <LandingJijiaScene awake={phase !== TITLE_PHASE.IDLE} />}

      <div className="landing-main">
        <div className={['landing-title-stack', entryPromptsActive ? 'landing-direction-prompts--revealed' : ''].filter(Boolean).join(' ')}>
          <h1
            className={[
              'landing-title',
              `landing-title--${phase}`,
              phase === TITLE_PHASE.REVEALED ? 'landing-title--drawn' : '',
              phase === TITLE_PHASE.IDLE && guidePhase === 'visible' ? 'landing-title--guiding' : '',
            ].filter(Boolean).join(' ')}
            onPointerEnter={handleTitlePointerEnter}
            onClick={activateTitle}
            data-motion-parallax-trigger="true"
          >
            <span className="landing-title-text" data-landing-title-visual="true">
              <span className="landing-title-breath">
                <span className="landing-title-n-host">N</span>
                {'ewTone'}
                <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
                {!returnSequenceActive && <NewToneHandLines />}
              </span>
            </span>

            <span className="landing-guide-anchor" aria-hidden="true">
              <LandingEntryArrow
                className="landing-guide-entry-arrow"
                direction="right"
                phase={guideVisible ? guidePhase : 'hidden'}
                showRing={false}
              />
            </span>
          </h1>

          {returnStatusVisible && (
            <div className={`landing-return-status${returnStatusFading ? ' landing-return-status--fading' : ''}`} aria-live="polite">
              <span className="landing-return-status__text">{returnStatusText}</span>
            </div>
          )}

          {!returnSequenceActive && (
            <>
              <div className="updates-entry-group landing-entry-group--timed" data-landing-entry="updates">
                <EntryButtonSurface
                  visible={entryPromptsActive}
                  mobile={coarsePointer}
                  materialMode="background"
                  entryId="landing-updates"
                  label={updatesPromptText}
                  ariaLabel={updatesPromptText}
                  className="landing-entry-button"
                  disabled={buttonDisabled}
                  onActionStart={handleEntryActionStart}
                  onActionComplete={handleEntryActionComplete}
                />
              </div>
              <div className="down-entry-group landing-entry-group--timed" data-landing-entry="reader">
                <EntryButtonSurface
                  visible={entryPromptsActive}
                  mobile={coarsePointer}
                  materialMode={hasProgress ? 'world' : 'background'}
                  worldLayer={environmentState.worldLayer}
                  entryId={readerEntryId}
                  label={promptText}
                  ariaLabel={promptText}
                  className="landing-entry-button"
                  disabled={buttonDisabled}
                  onActionStart={handleEntryActionStart}
                  onActionComplete={handleEntryActionComplete}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Landing
