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
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import { detectBrowserReaderLanguage } from '../i18n/languages'
import ScrambleText from '../components/ScrambleText'
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
const LANDING_ENTRY_TURN_MS = 260
const LANDING_ENTRY_PROMPT_DURATION_MS = 1900
const LANDING_ENTRY_ARROW_PREP_MS = 320
const LANDING_UPDATES_ARROW_EXIT_MS = 900
const LANDING_RING_DEBUG_QUERY = 'landing-ring-debug'

function landingRingDebugEnabled() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get(LANDING_RING_DEBUG_QUERY) === '1'
}

function readLandingRingDebugSnapshot(root) {
  if (!root || typeof window === 'undefined') return null
  const rings = [...root.querySelectorAll('.landing-entry-ring')]

  return {
    capturedAtMs: Math.round(window.performance?.now?.() ?? 0),
    root: {
      target: root.dataset.entryTarget ?? null,
    },
    rings: rings.map((ring, index) => {
      const style = window.getComputedStyle(ring)
      const arrow = ring.closest('.landing-entry-arrow')

      return {
        index,
        role: index === 0 ? 'guide' : 'reader',
        arrowClass: arrow?.getAttribute('class') ?? '',
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationDelay: style.animationDelay,
        animationPlayState: style.animationPlayState,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        transitionDelay: style.transitionDelay,
        strokeDashoffset: style.strokeDashoffset,
      }
    }),
  }
}

function Landing({
  onEnter,
  onEnterUpdates,
  updatesPhase = UPDATES_PHASE.LANDING,
  onUpdatesBarrier,
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
  const [entryTarget, setEntryTarget] = useState('reader')
  const [entryPromptsSettled, setEntryPromptsSettled] = useState(false)
  const entryPromptsSettleFrameRef = useRef(0)
  const entryPromptsSettleTimerRef = useRef(0)
  const guidePhaseRef = useRef(guidePhase)
  const triggeredRef = useRef(false)
  const introRef = useRef(introCompleted)
  const landingRef = useRef(null)
  const landingRingDebugRef = useRef({ enabled: false, sequence: 0, events: [] })
  const entryTargetRef = useRef(entryTarget)
  const activationPendingRef = useRef(false)
  const activationTimerRef = useRef(0)
  const returnSequenceStartedRef = useRef(false)
  const returnInputLockedRef = useRef(returnArrival)

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
    && [TITLE_PHASE.DRAWING, TITLE_PHASE.REVEALED].includes(phase)
  const updatesFlowActive = updatesPhase !== UPDATES_PHASE.LANDING

  const recordLandingRingDebug = useCallback((label, context = {}) => {
    const debug = landingRingDebugRef.current
    if (!debug.enabled) return

    const event = {
      sequence: ++debug.sequence,
      label,
      context,
      snapshot: readLandingRingDebugSnapshot(landingRef.current),
    }
    debug.events.push(event)

    if (typeof console !== 'undefined') {
      console.groupCollapsed(`[Landing ring debug] ${label}`)
      console.log(JSON.stringify(event))
      console.table(event.snapshot?.rings ?? [])
      console.groupEnd()
    }
  }, [])

  useEffect(() => {
    const debug = landingRingDebugRef.current
    debug.enabled = landingRingDebugEnabled()
    if (!debug.enabled || typeof window === 'undefined') return undefined

    const api = {
      events: debug.events,
      snapshot: () => readLandingRingDebugSnapshot(landingRef.current),
      clear: () => {
        debug.events.length = 0
        debug.sequence = 0
      },
    }
    window.__NEW_TONE_LANDING_RING_DEBUG__ = api
    console.info('[Landing ring debug] enabled; use window.__NEW_TONE_LANDING_RING_DEBUG__ for the latest snapshot')
    return undefined
  }, [])

  useEffect(() => {
    const debug = landingRingDebugRef.current
    if (!debug.enabled || typeof window === 'undefined') return undefined

    const context = {
      entryTarget,
      entryPromptsSettled,
      entryPromptsActive,
    }
    const timerIds = []
    const frameIds = []
    const sample = (label) => recordLandingRingDebug(label, context)

    sample('state-commit')
    frameIds.push(window.requestAnimationFrame(() => {
      sample('requestAnimationFrame-1')
      frameIds.push(window.requestAnimationFrame(() => sample('requestAnimationFrame-2')))
    }))

    for (const delay of [50, 180, 360, 1000, 2200]) {
      timerIds.push(window.setTimeout(() => sample(`timeout-${delay}ms`), delay))
    }

    return () => {
      for (const timerId of timerIds) window.clearTimeout(timerId)
      for (const frameId of frameIds) window.cancelAnimationFrame(frameId)
    }
  }, [entryPromptsActive, entryPromptsSettled, entryTarget, recordLandingRingDebug])

  useEffect(() => {
    introRef.current = introCompleted
  }, [introCompleted])

  useEffect(() => {
    guidePhaseRef.current = guidePhase
  }, [guidePhase])

  useEffect(() => {
    entryTargetRef.current = entryTarget
  }, [entryTarget])

  useEffect(() => {
    if (entryPromptsSettleFrameRef.current) {
      window.cancelAnimationFrame(entryPromptsSettleFrameRef.current)
      entryPromptsSettleFrameRef.current = 0
    }
    if (entryPromptsSettleTimerRef.current) {
      window.clearTimeout(entryPromptsSettleTimerRef.current)
      entryPromptsSettleTimerRef.current = 0
    }
    if (entryPromptsActive) return
    setEntryTarget('reader')
    setEntryPromptsSettled(false)
  }, [entryPromptsActive])

  useEffect(() => () => {
    if (entryPromptsSettleFrameRef.current) {
      window.cancelAnimationFrame(entryPromptsSettleFrameRef.current)
    }
    if (entryPromptsSettleTimerRef.current) {
      window.clearTimeout(entryPromptsSettleTimerRef.current)
    }
  }, [])

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
    if (guidePhaseRef.current !== 'visible') {
      guidePhaseRef.current = 'visible'
      setGuidePhase('visible')
    }
    begin().finally(() => {
      activationPendingRef.current = false
    })
  }, [begin, phaseRef, returnSequenceActive])

  const handleTitlePointerEnter = (event) => {
    if (event.pointerType === 'touch') return
    activateTitle()
  }

  const activateUpdatesTarget = useCallback(() => {
    if (!entryPromptsActive) return
    setEntryTarget('updates')
  }, [entryPromptsActive])

  const activateReaderTarget = useCallback(() => {
    if (!entryPromptsActive) return
    setEntryTarget('reader')
  }, [entryPromptsActive])

  const handleUpdatesPointerEnter = useCallback((event) => {
    if (event.pointerType === 'touch') return
    activateUpdatesTarget()
  }, [activateUpdatesTarget])

  const handleUpdatesPointerLeave = useCallback((event) => {
    if (event.pointerType === 'touch') return
    activateReaderTarget()
  }, [activateReaderTarget])

  const handleEntryPromptsRevealed = useCallback(() => {
    entryPromptsSettleFrameRef.current = window.requestAnimationFrame(() => {
      entryPromptsSettleFrameRef.current = window.requestAnimationFrame(() => {
        entryPromptsSettleFrameRef.current = 0
        entryPromptsSettleTimerRef.current = window.setTimeout(() => {
          entryPromptsSettleTimerRef.current = 0
          setEntryPromptsSettled(true)
        }, LANDING_ENTRY_ARROW_PREP_MS)
      })
    })
  }, [])

  useEffect(() => {
    triggeredRef.current = false

    const enterReader = () => {
      const state = useProgressStore.getState()
      onEnter(getReaderEntryIntent(state))
    }

    const enterSelectedTarget = () => {
      if (entryTargetRef.current === 'updates') {
        onEnterUpdates?.()
        return
      }
      enterReader()
    }

    const requestLeave = (enter) => {
      if (returnInputLockedRef.current || triggeredRef.current) return
      const intent = resolveScrollIntent({
        phase: phaseRef.current,
        introCompleted: introRef.current,
      })
      if (intent !== 'enter' && intent !== 'retract') return
      triggeredRef.current = true
      if (entryTargetRef.current === 'updates') {
        onEnterUpdates?.()
        return
      }
      if (intent === 'retract') {
        Promise.all([withdrawGuide(), retract()]).then(enter)
        return
      }
      withdrawGuide().then(enter)
    }

    const onWheel = (e) => {
      if (updatesFlowActive) return
      if (e.deltaY > 8) requestLeave(enterSelectedTarget)
    }

    let touchStartY = 0
    const onTouchStart = (e) => {
      if (updatesFlowActive) return
      touchStartY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      if (updatesFlowActive) return
      const delta = touchStartY - e.touches[0].clientY
      if (delta > 20) requestLeave(enterSelectedTarget)
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [onEnter, onEnterUpdates, phaseRef, retract, returnSequenceActive, updatesFlowActive, withdrawGuide])

  const hasProgress = hasStableReaderProgress({ readerStarted, readerCompleted })
  const landingLanguage = hasInitializedLanguage
    ? language
    : detectBrowserReaderLanguage(navigator.languages || [navigator.language])
  const promptText = hasProgress
    ? copy[landingLanguage].landingPromptResume
    : copy[landingLanguage].landingPromptInitial
  const downPromptText = promptText
  const updatesPromptText = landingLanguage === 'zh' ? '更新公告' : 'Updates'
  const returnStatusBase = copy[landingLanguage]?.transitionReturn
    || copy[landingLanguage]?.backToLanding
    || copy.zh.transitionReturn
  const returnStatusText = `${returnStatusBase}${landingLanguage === 'zh' ? '……' : '…'}`

  const titleTouched = phase !== TITLE_PHASE.IDLE
  const updatesSelected = entryPromptsActive && entryTarget === 'updates'
  const arrowTurningIn = updatesPhase === UPDATES_PHASE.ENTER_ARROW_TURN
  const arrowsRetracting = updatesPhase === UPDATES_PHASE.ENTER_ARROWS
  const arrowsEmerging = updatesPhase === UPDATES_PHASE.RETURN_ARROWS
  const arrowsTurning = updatesPhase === UPDATES_PHASE.RETURN_ARROW_TURN
  const arrowsReturning = arrowsEmerging || arrowsTurning
  const arrowsHidden = updatesFlowActive && !arrowTurningIn && !arrowsRetracting && !arrowsReturning
  const guideDirection = arrowTurningIn || arrowsRetracting
    ? 'left'
    : arrowsEmerging
      ? 'left'
      : arrowsTurning
        ? 'down'
      : entryPromptsActive
    ? (updatesSelected ? 'down' : 'left')
    : 'right'

  const handleUpdatesAnimationEnd = useCallback((event) => {
    if (!onUpdatesBarrier) return
    if (
      event.animationName === 'landing-updates-arrow-retract'
      || event.animationName === 'landing-updates-arrow-return'
    ) {
      const key = event.target.classList.contains('landing-guide-entry-arrow') ? 'updates' : 'reader'
      onUpdatesBarrier('arrows', key)
    }
  }, [onUpdatesBarrier])

  const handleUpdatesTransitionEnd = useCallback((event) => {
    if (
      updatesPhase !== UPDATES_PHASE.ENTER_ARROW_TURN
      && updatesPhase !== UPDATES_PHASE.RETURN_ARROW_TURN
      || event.propertyName !== 'transform'
      || !event.target.classList.contains('landing-entry-arrow__rotator')
    ) return
    const key = event.target.closest('.landing-guide-entry-arrow') ? 'updates' : 'reader'
    onUpdatesBarrier?.('turns', key)
  }, [onUpdatesBarrier, updatesPhase])

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
      data-entry-target={entryTarget}
      data-updates-phase={updatesPhase}
      onAnimationEnd={handleUpdatesAnimationEnd}
      onTransitionEnd={handleUpdatesTransitionEnd}
    >
      {landingScene === LANDING_SCENES.JIJIA_COMPOUND && <LandingJijiaScene awake={titleTouched} />}

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
                direction={guideDirection}
                phase={arrowsHidden ? 'hidden' : guidePhase}
                showRing={false}
                entryTurnFirst={updatesSelected}
                delayedBob={updatesSelected}
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
              <div
                className="updates-entry-group landing-entry-group--timed"
                data-landing-entry="updates"
                data-entry-selected={updatesSelected ? 'true' : 'false'}
                style={{ '--landing-entry-prompt-delay': `${LANDING_ENTRY_TURN_MS}ms` }}
                onPointerEnter={handleUpdatesPointerEnter}
                onPointerLeave={handleUpdatesPointerLeave}
                onClick={activateUpdatesTarget}
              >
                <p className="landing-prompt landing-prompt--updates">
                   <ScrambleText
                     text={updatesPromptText}
                     active={entryPromptsActive}
                     startDelay={LANDING_ENTRY_TURN_MS}
                     duration={LANDING_ENTRY_PROMPT_DURATION_MS}
                     withdrawing={updatesPhase === UPDATES_PHASE.ENTER_ARROWS}
                     withdrawalDuration={LANDING_UPDATES_ARROW_EXIT_MS}
                   />
                </p>
              </div>
              <div
                className="down-entry-group landing-entry-group--timed"
                data-entry-selected={entryTarget === 'reader' ? 'true' : 'false'}
                style={{ '--landing-entry-prompt-delay': `${LANDING_ENTRY_TURN_MS}ms` }}
                onClick={activateReaderTarget}
              >
                <p className="landing-prompt landing-prompt--down">
                   <ScrambleText
                     text={downPromptText}
                     active={entryPromptsActive}
                     startDelay={LANDING_ENTRY_TURN_MS}
                     duration={LANDING_ENTRY_PROMPT_DURATION_MS}
                     withdrawing={updatesPhase === UPDATES_PHASE.ENTER_ARROWS}
                     withdrawalDuration={LANDING_UPDATES_ARROW_EXIT_MS}
                     onRevealed={handleEntryPromptsRevealed}
                   />
                </p>
                <LandingEntryArrow
                  className="reader-entry-arrow"
                  direction={arrowTurningIn || arrowsRetracting || arrowsEmerging || updatesSelected ? 'left' : 'down'}
                  phase={arrowsHidden ? 'hidden' : 'steady'}
                  showRing={false}
                  entryTurnFirst={!updatesSelected}
                  delayedBob={!leaving && entryPromptsSettled && entryTarget === 'reader'}
                  arrowDelayed={leaving || !entryPromptsSettled}
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
