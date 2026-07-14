import { useEffect, useRef, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import { copy } from '../i18n/copy'
import ScrambleText from '../components/ScrambleText'
import LandingSketchLayer from '../components/landing/LandingSketchLayer'
import '../styles/visualTokens.css'
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

function Landing({ onEnter, leaving, leavingMs }) {
  const language = useProgressStore(s => s.language)
  const transitionTo = useTransitionStore(s => s.transitionTo)
  const reset = useProgressStore(s => s.reset)
  const toggleLanguage = useProgressStore(s => s.toggleLanguage)
  const lastReadPhase = useProgressStore(s => s.lastReadPhase)
  const maxReadPhase = useProgressStore(s => s.maxReadPhase)
  const lastScrollY = useProgressStore(s => s.lastScrollY)
  const centerUnlocked = useProgressStore(s => s.centerUnlocked)

  const [isLandingAwake, setIsLandingAwake] = useState(false)
  const [scrollTriggered, setScrollTriggered] = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const triggeredRef = useRef(false)

  const activateTitle = () => {
    if (!isLandingAwake) {
      setIsLandingAwake(true)
    }
    setClickCount(c => c + 1)
  }

  useEffect(() => {
    triggeredRef.current = false

    const detectReader = () => {
      if (triggeredRef.current) return
      triggeredRef.current = true
      const state = useProgressStore.getState()
      const hasProgress = state.lastScrollY > 0 || (state.lastReadPhase ?? state.maxReadPhase) !== null
      if (hasProgress) {
        onEnter('continue')
      } else {
        onEnter('start')
      }
    }

    const detectCenter = () => {
      if (triggeredRef.current) return
      triggeredRef.current = true
      transitionTo('center', { preset: 'surface-to-core' })
    }

    const onWheel = (e) => {
      if (e.deltaY > 8) {
        if (!triggeredRef.current) setScrollTriggered(true)
        detectReader()
        return
      }
      if (centerUnlocked && e.deltaY < -8) {
        detectCenter()
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
        if (!triggeredRef.current) setScrollTriggered(true)
        detectReader()
        return
      }
      if (centerUnlocked && delta < -20) {
        detectCenter()
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
  }, [onEnter, centerUnlocked, transitionTo])

  const hasProgress = lastScrollY > 0 || (lastReadPhase ?? maxReadPhase) !== null
  const promptText = hasProgress
    ? copy[language].landingPromptResume
    : copy[language].landingPromptInitial
  const downPromptText = copy[language].scrollDownToContinue || promptText

  return (
    <div className={`landing paper-surface${leaving ? ' landing--leaving' : ''}`} style={{ '--landing-leave-ms': `${leavingMs}ms` }}>
      <LandingSketchLayer
        titleActivated={isLandingAwake}
        archwayPhase={scrollTriggered ? 2 : isLandingAwake ? 1 : 0}
        retraceKey={clickCount}
      />

      <button
        className="landing-lang-toggle"
        onClick={toggleLanguage}
      >
        {language === 'zh' ? 'EN' : '中'}
      </button>

      <div className="landing-main">
        <div className={['landing-title-stack', isLandingAwake ? 'landing-direction-prompts--revealed' : ''].filter(Boolean).join(' ')}>
          {centerUnlocked && isLandingAwake && (
            <div className="up-entry-group">
              <p className="landing-prompt landing-prompt--up">
                <ScrambleText
                  text={copy[language].scrollUpToEnterCenter}
                  active
                  duration={800}
                />
              </p>
              <svg className="entry-arrow entry-arrow--up" viewBox="-60 0 120 70" width="32" height="20" aria-hidden="true">
                <g className={isLandingAwake ? 'sketch-up-breathe' : ''}>
                  <path className="sketch-up-shaft" d="M 0,58 L 0,5" />
                  <path className="sketch-up-shaft-faint" d="M -2,55 L -2,8" />
                  <path className="sketch-up-head" d="M 0,5 L -10,18" />
                  <path className="sketch-up-head" d="M 0,5 L 10,18" />
                </g>
              </svg>
            </div>
          )}

          <h1
            className={[
              'landing-title',
              isLandingAwake ? 'landing-title--activated' : '',
              centerUnlocked ? 'landing-title--center-unlocked' : ''
            ].filter(Boolean).join(' ')}
            onMouseEnter={activateTitle}
            onClick={activateTitle}
          >
            <span className="landing-title-text">NewTone</span>
          </h1>

          {isLandingAwake && (
            <div className="down-entry-group">
              <p className="landing-prompt landing-prompt--down">
                <ScrambleText
                  text={centerUnlocked ? downPromptText : promptText}
                  active
                  duration={800}
                />
              </p>
              <svg className="entry-arrow entry-arrow--down" viewBox="-60 0 120 80" width="32" height="22" aria-hidden="true">
                <g className={isLandingAwake ? 'sketch-down-breathe' : ''}>
                  <path className="sketch-down-shaft" d="M 0,5 L 0,65" />
                  <path className="sketch-down-shaft-faint" d="M -2,8 L -2,62" />
                  <path className="sketch-down-head" d="M 0,65 L -10,50" />
                  <path className="sketch-down-head" d="M 0,65 L 10,50" />
                </g>
              </svg>
            </div>
          )}
        </div>

        {isLandingAwake && !centerUnlocked && <TitleSignal active={isLandingAwake} />}
      </div>

      <button className="landing-reset" onClick={() => { reset(); setIsLandingAwake(false) }}>
        {copy[language].reset}
      </button>
    </div>
  )
}

export default Landing
