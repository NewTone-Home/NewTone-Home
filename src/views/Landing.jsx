import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import { copy } from '../i18n/copy'
import { getReaderEntryIntent, hasStableReaderProgress } from '../reader/readerEntry'
import { LANDING_LEAVE_FADE_DELAY_MS, TITLE_PHASE, readIntroCompleted, writeIntroCompleted } from '../landing/landingIntro'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSceneParallax } from '../hooks/useSceneParallax'
import { useTitleRetrace } from '../hooks/useTitleRetrace'
import { LANDING_SCENES, resolveLandingScene } from '../landing/landingScene'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import { detectBrowserReaderLanguage } from '../i18n/languages'
import EntryButtonGroup from '../components/EntryButtonGroup'
import LandingJijiaScene from '../components/landing/LandingJijiaScene'
import LandingTitleMark from '../components/landing/LandingTitleMark'
import '../styles/sketchPrimitives.css'
import './Landing.css'
import './LandingUpdatesEntry.css'

const RETURN_STATUS_BLINK_MS = 800
const RETURN_STATUS_BLINK_COUNT = 2
const RETURN_STATUS_TOTAL_MS = RETURN_STATUS_BLINK_MS * RETURN_STATUS_BLINK_COUNT
const RETURN_STATUS_FADE_MS = 260

function Landing({
  onEnter,
  onEnterUpdates,
  leaving,
  leavingMs,
  surfaceStyle,
  readingMode,
  environmentState,
  updatesPhase,
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
  const landingRef = useRef(null)
  const landingLeaveRetractStartedRef = useRef(false)

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
    && ([TITLE_PHASE.DRAWING, TITLE_PHASE.REVEALED].includes(phase)
      || (returnArrival && phase === TITLE_PHASE.IDLE))

  useSceneParallax({
    rootRef: landingRef,
    enabled: true,
    reduced: reducedMotion || motionMode === 'reduced',
  })

  useEffect(() => {
    if (returnArrival) useTransitionStore.getState().clearLandingArrival()
  }, [returnArrival])

  useEffect(() => {
    if (returnArrival || returnSequenceActive || phaseRef.current !== TITLE_PHASE.IDLE) return undefined
    const frame = window.requestAnimationFrame(() => { begin() })
    return () => window.cancelAnimationFrame(frame)
  }, [begin, phaseRef, returnArrival, returnSequenceActive])

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
      const statusDuration = reduced ? 320 : RETURN_STATUS_TOTAL_MS
      const statusFadeDuration = reduced ? 0 : RETURN_STATUS_FADE_MS

      await Promise.all([
        begin({ duration: 0, markIntroComplete: false }),
        wait(statusDuration),
      ])
      if (cancelled) return

      setReturnStatusFading(true)
      await wait(statusFadeDuration)
      if (cancelled) return

      setReturnStatusVisible(false)
      await retract({ duration: reduced ? 0 : undefined })
      if (cancelled) return

      setReturnSequenceActive(false)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [begin, motionMode, reducedMotion, retract, returnArrival])

  const hasProgress = hasStableReaderProgress({ readerStarted, readerCompleted })
  const landingLanguage = hasInitializedLanguage
    ? language
    : detectBrowserReaderLanguage(navigator.languages || [navigator.language])
  const readerEntryId = hasProgress ? 'reader-continue' : 'reader-start'
  const landingEntries = useMemo(() => ([
    {
      id: 'updates',
      label: copy[landingLanguage]?.updates || (landingLanguage === 'zh' ? '更新公告' : 'Updates'),
      materialMode: 'background',
    },
    {
      id: readerEntryId,
      label: hasProgress
        ? (copy[landingLanguage]?.continueReading || copy[landingLanguage]?.transitionResume)
        : copy[landingLanguage]?.transitionStart,
      materialMode: hasProgress ? 'world' : 'background',
      worldLayer: environmentState.worldLayer,
    },
  ]), [environmentState.worldLayer, hasProgress, landingLanguage, readerEntryId])
  const returnStatusBase = copy[landingLanguage]?.transitionReturn
    || copy[landingLanguage]?.backToLanding
    || copy.zh.transitionReturn
  const returnStatusText = `${returnStatusBase}${landingLanguage === 'zh' ? '……' : '…'}`
  const titleTouched = phase !== TITLE_PHASE.IDLE
   const landingEntriesVisible = !leaving && entryPromptsActive && updatesPhase === UPDATES_PHASE.LANDING

  const handleEntryNavigate = useCallback((entryId) => {
    if (entryId === 'updates') {
      onEnterUpdates?.()
      return
    }
    const state = useProgressStore.getState()
    onEnter?.(getReaderEntryIntent(state))
  }, [onEnter, onEnterUpdates])

  return (
    <div
      ref={landingRef}
      className={`landing paper-surface${leaving ? ' landing--leaving' : ''}${landingScene ? ' landing--scene' : ''}${returnSequenceActive ? ' landing--return-sequence' : ''}`}
      style={{
        ...surfaceStyle,
        '--landing-leave-ms': `${leavingMs}ms`,
        '--landing-leave-delay-ms': `${LANDING_LEAVE_FADE_DELAY_MS}ms`,
        '--landing-return-blink-ms': `${RETURN_STATUS_BLINK_MS}ms`,
      }}
      data-reading-mode={readingMode}
      data-world-layer={environmentState.worldLayer}
      data-time-of-day={environmentState.time}
      data-weather={environmentState.weather}
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

          {landingEntriesVisible && (
            <EntryButtonGroup
              groupId="landing-entries"
              entries={landingEntries}
              onNavigate={handleEntryNavigate}
              className="landing-entry-button-group"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Landing
