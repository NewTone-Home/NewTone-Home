import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const TIMINGS = Object.freeze({
  textEnter: 320,
  frameEnter: 720,
  fillOpen: 520,
  textExit: 260,
  fillClose: 520,
  frameExit: 420,
})

const FILL_DIRECTIONS = ['left', 'right', 'top', 'bottom', 'center']
const FRAME_ORIGINS = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
const FRAME_PATHS = Object.freeze({
  'top-left': 'M 1 1 H 99 V 35 H 1 Z',
  'top-right': 'M 99 1 V 35 H 1 V 1 Z',
  'bottom-right': 'M 99 35 H 1 V 1 H 99 Z',
  'bottom-left': 'M 1 35 V 1 H 99 V 35 Z',
})

function createProgress() {
  return { text: 0, frame: 0, fill: 0 }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function nextFillDirection(queue) {
  if (queue.length === 0) queue.push(...[...FILL_DIRECTIONS].sort(() => Math.random() - 0.5))
  return queue.shift()
}

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function easeInOut(value) {
  return value * value * (3 - 2 * value)
}

function getFillStyle(direction, progress) {
  const amount = clamp(progress)
  const closed = 1 - amount
  const edge = 100 - amount * 100
  const centerEdge = 50 * closed

  if (direction === 'left') {
    return {
      opacity: amount,
      clipPath: `inset(0 ${edge}% 0 0)`,
      transformOrigin: 'left center',
      transform: `perspective(320px) rotateY(${-7 * closed}deg)`,
    }
  }

  if (direction === 'right') {
    return {
      opacity: amount,
      clipPath: `inset(0 0 0 ${edge}%)`,
      transformOrigin: 'right center',
      transform: `perspective(320px) rotateY(${7 * closed}deg)`,
    }
  }

  if (direction === 'top') {
    return {
      opacity: amount,
      clipPath: `inset(${edge}% 0 0 0)`,
      transformOrigin: 'center top',
      transform: `perspective(320px) rotateX(${7 * closed}deg)`,
    }
  }

  if (direction === 'bottom') {
    return {
      opacity: amount,
      clipPath: `inset(0 0 ${edge}% 0)`,
      transformOrigin: 'center bottom',
      transform: `perspective(320px) rotateX(${-7 * closed}deg)`,
    }
  }

  return {
    opacity: amount,
    clipPath: `inset(0 ${centerEdge}% 0 ${centerEdge}%)`,
    transformOrigin: 'center',
    transform: `perspective(320px) scale(${0.94 + amount * 0.06})`,
  }
}

/**
 * Portable Reader return entry.
 *
 * The host supplies only the boundary fact, input kind, world layer, and
 * navigation callbacks. This component owns the local visual state machine:
 * hidden -> entering -> visible -> exiting -> hidden.
 *
 * The visual model is deliberately small: one inset fill, one text layer,
 * and one outer frame. A new fill direction is selected for each complete
 * desktop activation, while the final-beat source stays with the host.
 */
function ReaderReturnControl({
  visible = false,
  mobile = false,
  worldLayer = 'surface',
  onReturnStart,
  onReturnComplete,
  language,
}) {
  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const returnLabel = ui.returnToLanding || ui.backToLanding || fallbackUi.returnToLanding
  const returnHint = ui.returnToLandingHint || ui.backToLanding || fallbackUi.returnToLandingHint

  const [phase, setPhase] = useState('hidden')
  const [progress, setProgress] = useState(createProgress)
  const [variant, setVariant] = useState(() => ({
    fillDirection: 'left',
    frameOrigin: randomItem(FRAME_ORIGINS),
  }))
  const phaseRef = useRef('hidden')
  const progressRef = useRef(createProgress())
  const mobileRef = useRef(mobile)
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const fillDirectionQueueRef = useRef([])
  const timelineRef = useRef({ token: 0, frame: 0 })
  const entryCompleteRef = useRef(false)
  const returnRequestedRef = useRef(false)
  const exitModeRef = useRef(null)
  const onReturnStartRef = useRef(onReturnStart)
  const onReturnCompleteRef = useRef(onReturnComplete)

  mobileRef.current = mobile
  onReturnStartRef.current = onReturnStart
  onReturnCompleteRef.current = onReturnComplete

  const setPhaseValue = useCallback(nextPhase => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const setProgressValue = useCallback((key, value) => {
    const next = { ...progressRef.current, [key]: value }
    progressRef.current = next
    setProgress(next)
  }, [])

  const cancelTimeline = useCallback(() => {
    if (timelineRef.current.frame) cancelAnimationFrame(timelineRef.current.frame)
    timelineRef.current = {
      token: timelineRef.current.token + 1,
      frame: 0,
    }
  }, [])

  const runTimeline = useCallback((steps, onComplete) => {
    cancelTimeline()
    const token = timelineRef.current.token
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    let stepIndex = 0

    const runNextStep = () => {
      if (token !== timelineRef.current.token) return
      const step = steps[stepIndex]
      if (!step) {
        timelineRef.current.frame = 0
        onComplete?.()
        return
      }

      stepIndex += 1
      const from = progressRef.current[step.key]
      const target = clamp(step.to)
      const distance = Math.abs(target - from)
      const duration = reducedMotion ? Math.min(120, step.duration) : step.duration

      if (distance < 0.001 || duration <= 0) {
        setProgressValue(step.key, target)
        runNextStep()
        return
      }

      const startedAt = performance.now()
      const tick = now => {
        if (token !== timelineRef.current.token) return
        const raw = Math.min(1, (now - startedAt) / duration)
        setProgressValue(step.key, from + (target - from) * easeInOut(raw))
        if (raw < 1) {
          timelineRef.current.frame = requestAnimationFrame(tick)
          return
        }
        timelineRef.current.frame = 0
        runNextStep()
      }

      timelineRef.current.frame = requestAnimationFrame(tick)
    }

    runNextStep()
  }, [cancelTimeline, setProgressValue])

  const activateFill = useCallback(() => {
    if (!entryCompleteRef.current || phaseRef.current !== 'visible') return

    if (progressRef.current.fill <= 0.001) {
      const nextDirection = nextFillDirection(fillDirectionQueueRef.current)
      setVariant(current => ({ ...current, fillDirection: nextDirection }))
    }

    runTimeline([{
      key: 'fill',
      to: 1,
      duration: TIMINGS.fillOpen,
    }])
  }, [runTimeline])

  const deactivateFill = useCallback(() => {
    if (!entryCompleteRef.current || phaseRef.current !== 'visible') return
    runTimeline([{
      key: 'fill',
      to: 0,
      duration: TIMINGS.fillClose,
    }])
  }, [runTimeline])

  const startEntry = useCallback(() => {
    if (phaseRef.current !== 'hidden' && phaseRef.current !== 'exiting') return
    if (phaseRef.current === 'hidden') {
      setVariant(current => ({
        ...current,
        frameOrigin: randomItem(FRAME_ORIGINS),
      }))
    }
    entryCompleteRef.current = false
    exitModeRef.current = null
    setPhaseValue('entering')
    runTimeline([
      { key: 'text', to: 1, duration: TIMINGS.textEnter },
      { key: 'frame', to: 1, duration: TIMINGS.frameEnter },
    ], () => {
      if (phaseRef.current !== 'entering') return
      entryCompleteRef.current = true
      setPhaseValue('visible')
      if (mobileRef.current || hoveredRef.current || focusedRef.current) activateFill()
    })
  }, [activateFill, runTimeline, setPhaseValue])

  const startExit = useCallback((mode) => {
    if (phaseRef.current === 'hidden' || phaseRef.current === 'exiting') return
    entryCompleteRef.current = false
    exitModeRef.current = mode
    setPhaseValue('exiting')
    runTimeline([
      { key: 'text', to: 0, duration: TIMINGS.textExit },
      { key: 'fill', to: 0, duration: TIMINGS.fillClose },
      { key: 'frame', to: 0, duration: TIMINGS.frameExit },
    ], () => {
      if (phaseRef.current !== 'exiting') return
      const completedMode = exitModeRef.current
      exitModeRef.current = null
      setPhaseValue('hidden')
      if (completedMode === 'return') onReturnCompleteRef.current?.()
    })
  }, [runTimeline, setPhaseValue])

  useEffect(() => {
    if (visible) {
      if (returnRequestedRef.current) return undefined
      if (phaseRef.current === 'hidden' || phaseRef.current === 'exiting') startEntry()
      return undefined
    }

    if (!returnRequestedRef.current && ['entering', 'visible'].includes(phaseRef.current)) {
      startExit('dismiss')
    }
    return undefined
  }, [startEntry, startExit, visible])

  useEffect(() => {
    if (mobile && phaseRef.current === 'visible') activateFill()
  }, [activateFill, mobile])

  useEffect(() => () => cancelTimeline(), [cancelTimeline])

  const handleReturnClick = useCallback(() => {
    if (!visible || returnRequestedRef.current || phaseRef.current === 'hidden' || phaseRef.current === 'exiting') return
    returnRequestedRef.current = true
    onReturnStartRef.current?.()
    startExit('return')
  }, [startExit, visible])

  const handlePointerEnter = useCallback(event => {
    if (event.pointerType !== 'mouse') return
    hoveredRef.current = true
    activateFill()
  }, [activateFill])

  const handlePointerLeave = useCallback(event => {
    if (event.pointerType !== 'mouse') return
    hoveredRef.current = false
    if (!focusedRef.current && !mobileRef.current) deactivateFill()
  }, [deactivateFill])

  const handleFocus = useCallback(() => {
    focusedRef.current = true
    activateFill()
  }, [activateFill])

  const handleBlur = useCallback(() => {
    focusedRef.current = false
    if (!hoveredRef.current && !mobileRef.current) deactivateFill()
  }, [deactivateFill])

  const present = phase !== 'hidden'
  const fillActive = progress.fill > 0.001
  const fillStyle = getFillStyle(variant.fillDirection, progress.fill)
  const textStyle = {
    opacity: progress.text,
    color: fillActive ? 'var(--return-text-active)' : 'var(--reader-muted)',
  }

  return (
    <button
      type="button"
      className="reader-return-control"
      style={{
        '--return-text-progress': progress.text,
        '--return-frame-progress': progress.frame,
        '--return-fill-progress': progress.fill,
      }}
      data-reader-return-control="true"
      data-return-visible={present ? 'true' : 'false'}
      data-return-phase={phase}
      data-return-active={fillActive ? 'true' : 'false'}
      data-return-mobile={mobile ? 'true' : 'false'}
      data-return-world-layer={worldLayer}
      data-return-fill-direction={variant.fillDirection}
      data-return-frame-origin={variant.frameOrigin}
      data-return-layer-model="frame>text>fill"
      data-return-text-progress={progress.text.toFixed(3)}
      data-return-fill-progress={progress.fill.toFixed(3)}
      data-return-frame-progress={progress.frame.toFixed(3)}
      aria-label={returnHint}
      aria-hidden={!present}
      aria-pressed={fillActive}
      aria-disabled={phase === 'exiting'}
      disabled={!present}
      tabIndex={present ? 0 : -1}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleReturnClick}
    >
      <span className="reader-return-content">
        <span className="reader-return-fill" style={fillStyle} aria-hidden="true" />
        <span className="reader-return-text" style={textStyle}>
          {returnLabel}
        </span>
        <svg className="reader-return-frame" viewBox="0 0 100 36" aria-hidden="true" focusable="false">
          <path
            d={FRAME_PATHS[variant.frameOrigin]}
            pathLength="1"
            style={{ strokeDashoffset: 1 - progress.frame }}
          />
        </svg>
      </span>
    </button>
  )
}

export default ReaderReturnControl
