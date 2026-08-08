import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
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

function LandingGuideArrow({ phase }) {
  if (phase === 'hidden') return null
  return (
    <svg
      className={`landing-guide-arrow landing-guide-arrow--main landing-guide-arrow--${phase}`}
      viewBox="0 0 92 72"
      aria-hidden="true"
    >
      <path className="landing-guide-arrow__curve" pathLength="1" d="M8 64C13 48 22 39 36 32C47 26 55 20 64 12" />
      <path className="landing-guide-arrow__head" pathLength="1" d="M53 15C58 14 62 13 66 10C65 15 64 20 62 24" />
    </svg>
  )
}

function Landing({ onEnter, leaving, leavingMs, surfaceStyle, readingMode, environmentState, guidePaused = false }) {
  const language = useProgressStore(s => s.language)
  const hasInitializedLanguage = useProgressStore(s => s.hasInitializedLanguage)
  const readerStarted = useProgressStore(s => s.readerStarted)
  const readerCompleted = useProgressStore(s => s.readerCompleted)
  const motionMode = useProgressStore(s => s.motionMode)

  const [introCompleted, setIntroCompleted] = useState(() => readIntroCompleted())
  const [guidePhase, setGuidePhase] = useState('quiet')
  const guidePhaseRef = useRef(guidePhase)
  const triggeredRef = useRef(false)
  const introRef = useRef(introCompleted)
  const landingRef = useRef(null)
  const activationPendingRef = useRef(false)
  const activationTimerRef = useRef(0)

  const reducedMotion = useReducedMotion()
  // 视觉原型开关，只影响背景层：?landing-scene=jijia_compound
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
    if (guidePaused) {
      setGuidePhase('hidden')
      return undefined
    }
    if (!shouldScheduleLandingGuide({ phase, activationPending: activationPendingRef.current })) {
      setGuidePhase('hidden')
      return undefined
    }
    setGuidePhase('quiet')
    const timer = window.setTimeout(() => {
      if (!activationPendingRef.current && phaseRef.current === TITLE_PHASE.IDLE) setGuidePhase('visible')
    }, LANDING_GUIDE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [guidePaused, phase, phaseRef])

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
    if (phaseRef.current !== TITLE_PHASE.IDLE || activationPendingRef.current) return
    activationPendingRef.current = true
    withdrawGuide().then(() => {
      activationPendingRef.current = false
      begin()
    })
  }, [begin, phaseRef, withdrawGuide])

  const handleTitlePointerEnter = (event) => {
    // Touch synthesises a pointerenter on tap; let the click path own that case.
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
      if (triggeredRef.current) return
      const intent = resolveScrollIntent({
        phase: phaseRef.current,
        introCompleted: introRef.current,
      })
      // 'blocked' is the first-visit lock, 'ignore' is a retract already running.
      if (intent !== 'enter' && intent !== 'retract') return
      triggeredRef.current = true
      if (intent === 'retract') {
        Promise.all([withdrawGuide(), retract()]).then(enter)
        return
      }
      withdrawGuide().then(enter)
    }

    const onWheel = (e) => {
      if (e.deltaY > 8) {
        requestLeave(enterReader)
        return
      }
    }

    let touchStartY = 0
    const onTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      const delta = touchStartY - e.touches[0].clientY
      if (delta > 20) {
        requestLeave(enterReader)
        return
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [onEnter, phaseRef, retract, withdrawGuide])

  const hasProgress = hasStableReaderProgress({ readerStarted, readerCompleted })
  const landingLanguage = hasInitializedLanguage
    ? language
    : detectBrowserReaderLanguage(navigator.languages || [navigator.language])
  const promptText = hasProgress
    ? copy[landingLanguage].landingPromptResume
    : copy[landingLanguage].landingPromptInitial
  const downPromptText = promptText

  // The prompt is the reward for finishing *this* stroke, not a permanent label:
  // it follows the visual phase only, never the persisted flag.
  const promptsRevealed = phase === TITLE_PHASE.REVEALED
  const titleTouched = phase !== TITLE_PHASE.IDLE

  return (
    <div
      ref={landingRef}
      className={`landing paper-surface${leaving ? ' landing--leaving' : ''}${landingScene ? ' landing--scene' : ''}`}
      style={{ ...surfaceStyle, '--landing-leave-ms': `${leavingMs}ms` }}
      data-reading-mode={readingMode}
      data-world-layer={environmentState.worldLayer}
      data-time-of-day={environmentState.time}
      data-weather={environmentState.weather}
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
                NewTone
                <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
                <NewToneHandLines />
                <LandingGuideArrow phase={guidePhase} />
              </span>
            </span>
          </h1>

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
