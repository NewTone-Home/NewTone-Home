import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { copy } from '../i18n/copy'
import { getReaderEntryIntent, hasStableReaderProgress } from '../reader/readerEntry'
import {
  TITLE_PHASE,
  readIntroCompleted,
  resolveScrollIntent,
  writeIntroCompleted,
} from '../landing/landingIntro'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useTitleRetrace } from '../hooks/useTitleRetrace'
import { LANDING_SCENES, resolveLandingScene } from '../landing/landingScene'
import { resolveLandingParallax } from '../landing/landingParallax'
import { detectBrowserReaderLanguage } from '../i18n/languages'
import ScrambleText from '../components/ScrambleText'
import LandingSketchLayer from '../components/landing/LandingSketchLayer'
import LandingJijiaScene from '../components/landing/LandingJijiaScene'
import LandingTitleMark from '../components/landing/LandingTitleMark'
import '../styles/sketchPrimitives.css'
import './Landing.css'

function TitleSignal({ active }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!active) {
      setParticles([])
      return
    }
    const chars = '·./\\|~'
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      char: chars[Math.floor(Math.random() * chars.length)],
      x: (Math.random() - 0.5) * 100,
      delay: 100 + Math.random() * 350,
      duration: 1000 + Math.random() * 600,
      fall: 15 + Math.random() * 35,
    }))
    setParticles(items)
  }, [active])

  return (
    <div className="title-signal">
      {active && particles.map(p => (
        <span
          key={p.id}
          className="title-signal-particle"
          style={{
            '--x': `${p.x}px`,
            '--fall': `${p.fall}px`,
            '--delay': `${p.delay}ms`,
            '--duration': `${p.duration}ms`,
          }}
        >
          {p.char}
        </span>
      ))}
    </div>
  )
}

function Landing({ onEnter, leaving, leavingMs, surfaceStyle, readingMode, environmentState }) {
  const language = useProgressStore(s => s.language)
  const hasInitializedLanguage = useProgressStore(s => s.hasInitializedLanguage)
  const readerStarted = useProgressStore(s => s.readerStarted)
  const readerCompleted = useProgressStore(s => s.readerCompleted)
  const motionMode = useProgressStore(s => s.motionMode)

  const [introCompleted, setIntroCompleted] = useState(() => readIntroCompleted())
  const [scrollTriggered, setScrollTriggered] = useState(false)
  const [retraceKey, setRetraceKey] = useState(0)
  const triggeredRef = useRef(false)
  const introRef = useRef(introCompleted)
  const titleVisualRef = useRef(null)

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
    const node = titleVisualRef.current
    if (!node || reducedMotion || motionMode === 'reduced') return undefined
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let frame = 0

    const render = () => {
      current.x += (target.x - current.x) * 0.11
      current.y += (target.y - current.y) * 0.11
      node.style.setProperty('--landing-parallax-x', `${current.x.toFixed(3)}px`)
      node.style.setProperty('--landing-parallax-y', `${current.y.toFixed(3)}px`)
      node.dataset.parallaxX = current.x.toFixed(3)
      node.dataset.parallaxY = current.y.toFixed(3)
      const unsettled = Math.abs(target.x - current.x) > 0.02 || Math.abs(target.y - current.y) > 0.02
      frame = unsettled ? requestAnimationFrame(render) : 0
    }
    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render)
    }
    const onPointerMove = event => {
      const next = resolveLandingParallax(event.clientX, event.clientY, window.innerWidth, window.innerHeight)
      target.x = next.x
      target.y = next.y
      requestRender()
    }
    const returnToCenter = () => {
      target.x = 0
      target.y = 0
      requestRender()
    }
    const onPointerOut = event => {
      if (event.relatedTarget === null) returnToCenter()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerout', onPointerOut)
    window.addEventListener('blur', returnToCenter)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('blur', returnToCenter)
      node.style.removeProperty('--landing-parallax-x')
      node.style.removeProperty('--landing-parallax-y')
      delete node.dataset.parallaxX
      delete node.dataset.parallaxY
    }
  }, [motionMode, reducedMotion])

  const activateTitle = useCallback(() => {
    if (phaseRef.current !== TITLE_PHASE.IDLE) return
    setRetraceKey(k => k + 1)
    begin()
  }, [begin, phaseRef])

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

    const requestLeave = (enter, markScrolled) => {
      if (triggeredRef.current) return
      const intent = resolveScrollIntent({
        phase: phaseRef.current,
        introCompleted: introRef.current,
      })
      // 'blocked' is the first-visit lock, 'ignore' is a retract already running.
      if (intent !== 'enter' && intent !== 'retract') return
      triggeredRef.current = true
      if (markScrolled) setScrollTriggered(true)
      if (intent === 'retract') {
        retract().then(enter)
        return
      }
      enter()
    }

    const onWheel = (e) => {
      if (e.deltaY > 8) {
        requestLeave(enterReader, true)
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
        requestLeave(enterReader, true)
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
  }, [onEnter, phaseRef, retract])

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
      className={`landing paper-surface${leaving ? ' landing--leaving' : ''}${landingScene ? ' landing--scene' : ''}`}
      style={{ ...surfaceStyle, '--landing-leave-ms': `${leavingMs}ms` }}
      data-reading-mode={readingMode}
      data-world-layer={environmentState.worldLayer}
      data-time-of-day={environmentState.time}
      data-weather={environmentState.weather}
    >
      {landingScene === LANDING_SCENES.JIJIA_COMPOUND && <LandingJijiaScene awake={titleTouched} />}

      <LandingSketchLayer
        titleActivated={titleTouched}
        archwayPhase={scrollTriggered ? 2 : titleTouched ? 1 : 0}
        retraceKey={retraceKey}
      />

      <div className="landing-main">
        <div className={['landing-title-stack', promptsRevealed ? 'landing-direction-prompts--revealed' : ''].filter(Boolean).join(' ')}>
          <h1
            className={[
              'landing-title',
              `landing-title--${phase}`,
              phase === TITLE_PHASE.REVEALED ? 'landing-title--drawn' : '',
            ].filter(Boolean).join(' ')}
            onPointerEnter={handleTitlePointerEnter}
            onClick={activateTitle}
          >
            <span ref={titleVisualRef} className="landing-title-text" data-landing-title-visual="true">
              NewTone
              <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
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

        {promptsRevealed && <TitleSignal active={promptsRevealed} />}
      </div>
    </div>
  )
}

export default Landing
