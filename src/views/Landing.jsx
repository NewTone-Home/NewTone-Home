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

const GUIDE_SHAPES = [
  {
    at: 0,
    points: [[0, -2.1], [1.1, -1.8], [1.9, -1], [2.2, 0], [1.9, 1.1], [1.1, 1.9], [0, 2.2], [-1.1, 1.9], [-1.9, 1.1], [-2.2, 0], [-1.9, -1], [-1.1, -1.8], [0, -2.1], [0, -2.1], [0, -2.1], [0, -2.1], [0, -2.1], [0, -2.1]],
  },
  {
    at: .18,
    points: [[-11, 7.7], [-9.9, 8], [-9.1, 8.9], [-8.8, 10], [-9.2, 11.1], [-10.1, 11.9], [-11.2, 12.1], [-12.3, 11.7], [-13.1, 10.8], [-13.3, 9.7], [-12.9, 8.6], [-12.1, 7.9], [-11, 7.7], [-11, 7.7], [-11, 7.7], [-11, 7.7], [-11, 7.7], [-11, 7.7]],
  },
  {
    at: .34,
    points: [[-21, 16.6], [-19.8, 16.9], [-19, 17.8], [-18.8, 19], [-19.2, 20.1], [-20.1, 20.9], [-21.3, 21.1], [-22.4, 20.7], [-23.2, 19.8], [-23.4, 18.7], [-23, 17.6], [-22.2, 16.8], [-21, 16.6], [-21, 16.6], [-21, 16.6], [-21, 16.6], [-21, 16.6], [-21, 16.6]],
  },
  {
    at: .56,
    points: [[-17, 13], [-22, 15], [-19, 18], [-24, 20], [-29, 23], [-34, 27], [-39, 31], [-44, 36], [-48, 40], [-46, 42], [-42, 38], [-37, 34], [-32, 30], [-27, 26], [-22, 22], [-18, 19], [-19, 24], [-17, 13]],
  },
  {
    at: .78,
    points: [[-5, 3], [-18, 6], [-13, 11], [-21, 15], [-30, 21], [-40, 29], [-49, 37], [-58, 46], [-65, 52], [-63, 55], [-56, 49], [-48, 42], [-39, 35], [-29, 27], [-20, 21], [-12, 16], [-14, 25], [-5, 3]],
  },
  {
    at: 1,
    points: [[0, 0], [-14, 4], [-10, 8], [-19, 13], [-30, 20], [-42, 29], [-54, 39], [-66, 51], [-75, 59], [-72, 61], [-65, 54], [-54, 43], [-42, 33], [-30, 24], [-19, 17], [-10, 12], [-12, 19], [0, 0]],
  },
]

function guidePathAt(progress) {
  const upperIndex = GUIDE_SHAPES.findIndex(shape => progress <= shape.at)
  const upper = GUIDE_SHAPES[upperIndex < 0 ? GUIDE_SHAPES.length - 1 : upperIndex]
  const lower = GUIDE_SHAPES[Math.max(0, (upperIndex < 0 ? GUIDE_SHAPES.length - 1 : upperIndex) - 1)]
  const span = upper.at - lower.at
  const mix = span > 0 ? (progress - lower.at) / span : 0
  const points = lower.points.map(([x, y], index) => {
    const [toX, toY] = upper.points[index]
    return [x + (toX - x) * mix, y + (toY - y) * mix]
  })
  return `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join('')}Z`
}

function guideOpacityAt(progress) {
  if (progress <= .035) return progress / .035
  if (progress <= .34) return .88
  return .88 - ((progress - .34) / .66) * .28
}

function LandingGuideArrow({ phase, reduced }) {
  const inkRef = useRef(null)
  const progressRef = useRef(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const target = phase === 'visible' ? 1 : 0
    const ink = inkRef.current
    if (!ink) return undefined

    if (reduced) {
      progressRef.current = target
      ink.setAttribute('d', guidePathAt(target))
      ink.style.opacity = String(target ? .6 : 0)
      return undefined
    }

    let lastTime = performance.now()
    const animate = (time) => {
      const delta = Math.min(40, time - lastTime)
      lastTime = time
      const duration = target > progressRef.current ? 860 : 300
      const direction = target > progressRef.current ? 1 : -1
      const next = Math.max(0, Math.min(1, progressRef.current + direction * delta / duration))
      progressRef.current = direction > 0 ? Math.min(target, next) : Math.max(target, next)
      ink.setAttribute('d', guidePathAt(progressRef.current))
      ink.style.opacity = String(guideOpacityAt(progressRef.current))
      if (progressRef.current !== target) frameRef.current = requestAnimationFrame(animate)
    }
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [phase, reduced])

  if (phase === 'hidden') return null
  return (
    <svg
      className={`landing-guide-arrow landing-guide-arrow--main landing-guide-arrow--${phase}`}
      viewBox="-92 -8 100 82"
      aria-hidden="true"
    >
      <path
        ref={inkRef}
        className="landing-guide-arrow__ink"
        d={guidePathAt(progressRef.current)}
      />
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
                <span className="landing-title-n-host">
                  N
                  <span className="landing-title-n-origin">
                    <LandingGuideArrow phase={guidePhase} reduced={reducedMotion || motionMode === 'reduced'} />
                  </span>
                </span>
                {'ewTone'}
                <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
                <NewToneHandLines />
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
