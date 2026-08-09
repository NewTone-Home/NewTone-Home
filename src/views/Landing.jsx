import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import { copy } from '../i18n/copy'
import { getReaderEntryIntent, hasStableReaderProgress } from '../reader/readerEntry'
import {
  LANDING_GUIDE_DELAY_MS,
  LANDING_GUIDE_RETRACT_MS,
  TITLE_PHASE,
  readIntroCompleted,
  resolveScrollIntent,
  shouldScheduleLandingGuide,
  writeIntroCompleted,
} from '../landing/landingIntro'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSceneParallax } from '../hooks/useSceneParallax'
import { useTitleRetrace } from '../hooks/useTitleRetrace'
import { LANDING_SCENES, resolveLandingScene } from '../landing/landingScene'
import { detectBrowserReaderLanguage } from '../i18n/languages'
import ScrambleText from '../components/ScrambleText'
import LandingJijiaScene from '../components/landing/LandingJijiaScene'
import LandingTitleMark, { NewToneHandLines } from '../components/landing/LandingTitleMark'
import '../styles/sketchPrimitives.css'
import './Landing.css'

const RETURN_TITLE_DRAW_MS = 1450
const RETURN_STATUS_BLINK_MS = 800
const RETURN_STATUS_BLINK_COUNT = 2
const RETURN_STATUS_TOTAL_MS = RETURN_STATUS_BLINK_MS * RETURN_STATUS_BLINK_COUNT
const RETURN_GUIDE_DELAY_MS = 1600

function LandingGuideArrow({ phase }) {
  if (phase === 'hidden') return null
  return (
    <svg
      className={`landing-guide-arrow landing-guide-arrow--main landing-guide-arrow--${phase}`}
      viewBox="0 0 92 72"
      aria-hidden="true"
    >
      <circle className="landing-guide-arrow__seed" cx="64" cy="12" r="2.15" />
      <g className="landing-guide-arrow__wash">
        <path d="M8 64C13 48 22 39 36 32C47 26 55 20 64 12" />
        <path d="M53 15C58 14 62 13 66 10C65 15 64 20 62 24" />
      </g>
      <g className="landing-guide-arrow__strokes">
        <path className="landing-guide-arrow__curve" d="M8 64C13 48 22 39 36 32C47 26 55 20 64 12" />
        <path className="landing-guide-arrow__head" d="M53 15C58 14 62 13 66 10C65 15 64 20 62 24" />
      </g>
    </svg>
  )
}

function Landing({
  onEnter,
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
  const [guidePhase, setGuidePhase] = useState(() => returnArrival ? 'hidden' : 'quiet')
  const guidePhaseRef = useRef(guidePhase)
  const triggeredRef = useRef(false)
  const introRef = useRef(introCompleted)
  const landingRef = useRef(null)
  const activationPendingRef = useRef(false)
  const activationTimerRef = useRef(0)
  const returnSequenceStartedRef = useRef(false)

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

  useEffect(() => {
    introRef.current = introCompleted
  }, [introCompleted])

  useEffect(() => {
    guidePhaseRef.current = guidePhase
  }, [guidePhase])

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
      const drawDuration = reduced ? 0 : RETURN_TITLE_DRAW_MS
      const guideDelay = reduced ? 300 : RETURN_GUIDE_DELAY_MS

      await Promise.all([
        begin({ duration: drawDuration, markIntroComplete: false }),
        wait(statusDuration),
      ])
      if (cancelled) return

      setReturnStatusVisible(false)
      await retract({ duration: reduced ? 0 : undefined })
      if (cancelled) return

      await wait(guideDelay)
      if (cancelled) return

      setGuidePhase('visible')
      setReturnSequenceActive(false)
    })

    return () => {
      cancelled = true
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
    if (phase === TITLE_PHASE.IDLE && guidePhaseRef.current === 'visible') return undefined
    if (!shouldScheduleLandingGuide({ phase, activationPending: activationPendingRef.current })) {
      setGuidePhase('hidden')
      return undefined
    }
    setGuidePhase('quiet')
    const timer = window.setTimeout(() => {
      if (!activationPendingRef.current && phaseRef.current === TITLE_PHASE.IDLE) setGuidePhase('visible')
    }, LANDING_GUIDE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [guidePaused, phase, phaseRef, returnSequenceActive])

  useEffect(() => () => window.clearTimeout(activationTimerRef.current), [])

  const withdrawGuide = useCallback(() => {
    if (guidePhaseRef.current !== 'visible' || reducedMotion || motionMode === 'reduced') {
      setGuidePhase('hidden')
      return Promise.resolve()
    }
    setGuidePhase('retracting')
    return new Promise((resolve) => {
      window.clearTimeout(activationTimerRef.current)
      activationTimerRef.current = window.setTimeout(() => {
        setGuidePhase('hidden')
        resolve()
      }, LANDING_GUIDE_RETRACT_MS)
    })
  }, [motionMode, reducedMotion])

  const activateTitle = useCallback(() => {
    if (returnSequenceActive || phaseRef.current !== TITLE_PHASE.IDLE || activationPendingRef.current) return
    activationPendingRef.current = true
    withdrawGuide().then(() => {
      activationPendingRef.current = false
      begin()
    })
  }, [begin, phaseRef, returnSequenceActive, withdrawGuide])

  const handleTitlePointerEnter = (event) => {
    if (event.pointerType === 'touch') return
    activateTitle()
  }

  useEffect(() => {
    triggeredRef.current = false

    const enterReader = () => {
      const state = useProgressStore.getState()
      onEnter(getReaderEntryIntent(state))
    }

    const requestLeave = (enter) => {
      if (returnSequenceActive || triggeredRef.current) return
      const intent = resolveScrollIntent({
        phase: phaseRef.current,
        introCompleted: introRef.current,
      })
      if (intent !== 'enter' && intent !== 'retract') return
      triggeredRef.current = true
      if (intent === 'retract') {
        Promise.all([withdrawGuide(), retract()]).then(enter)
        return
      }
      withdrawGuide().then(enter)
    }

    const onWheel = (e) => {
      if (e.deltaY > 8) requestLeave(enterReader)
    }

    let touchStartY = 0
    const onTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      const delta = touchStartY - e.touches[0].clientY
      if (delta > 20) requestLeave(enterReader)
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [onEnter, phaseRef, retract, returnSequenceActive, withdrawGuide])

  const hasProgress = hasStableReaderProgress({ readerStarted, readerCompleted })
  const landingLanguage = hasInitializedLanguage
    ? language
    : detectBrowserReaderLanguage(navigator.languages || [navigator.language])
  const promptText = hasProgress
    ? copy[landingLanguage].landingPromptResume
    : copy[landingLanguage].landingPromptInitial
  const downPromptText = promptText
  const returnStatusBase = copy[landingLanguage]?.transitionReturn
    || copy[landingLanguage]?.backToLanding
    || copy.zh.transitionReturn
  const returnStatusText = `${returnStatusBase}${landingLanguage === 'zh' ? '……' : '…'}`

  const promptsRevealed = !returnSequenceActive && phase === TITLE_PHASE.REVEALED
  const titleTouched = phase !== TITLE_PHASE.IDLE
  const showSignatureLines = !returnArrival

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
    >
      {landingScene === LANDING_SCENES.JIJIA_COMPOUND && <LandingJijiaScene awake={titleTouched} />}

      <div className="landing-main">
        <div className={['landing-title-stack', promptsRevealed ? 'landing-direction-prompts--revealed' : ''].filter(Boolean).join(' ')}>
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
                <span className="landing-title-n-host">
                  N
                  <span className="landing-title-n-origin">
                    <LandingGuideArrow phase={guidePhase} />
                  </span>
                </span>
                {'ewTone'}
                <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
                {showSignatureLines && <NewToneHandLines />}
              </span>
            </span>
          </h1>

          {returnStatusVisible && (
            <div className="landing-return-status" aria-live="polite">
              <span className="landing-return-status__text">{returnStatusText}</span>
            </div>
          )}

          {promptsRevealed && (
            <div className="down-entry-group">
              <p className="landing-prompt landing-prompt--down">
                <ScrambleText
                  text={downPromptText}
                  active
                  duration={800}
                />
              </p>
              <svg className="entry-arrow entry-arrow--down" viewBox="-60 0 120 80" width="32" height="22" aria-hidden="true">
                <g className={promptsRevealed ? 'sketch-down-breathe' : ''}>
                  <path className="sketch-down-shaft" d="M 0,5 L 0,65" />
                  <path className="sketch-down-shaft-faint" d="M -2,8 L -2,62" />
                  <path className="sketch-down-head" d="M 0,65 L -10,50" />
                  <path className="sketch-down-head" d="M 0,65 L 10,50" />
                </g>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Landing
