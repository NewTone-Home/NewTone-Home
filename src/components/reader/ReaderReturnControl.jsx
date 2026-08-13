import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const TIMINGS = Object.freeze({
  textEnter: 320,
  frameEnter: 720,
  doorOpen: 520,
  textExit: 260,
  doorClose: 520,
  frameExit: 420,
})

const MASK_DIRECTIONS = ['left', 'right', 'top', 'bottom', 'center']
const FRAME_ORIGINS = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
const FRAME_PATHS = Object.freeze({
  'top-left': 'M 1 1 H 99 V 35 H 1 Z',
  'top-right': 'M 99 1 V 35 H 1 V 1 Z',
  'bottom-right': 'M 99 35 H 1 V 1 H 99 Z',
  'bottom-left': 'M 1 35 V 1 H 99 V 35 Z',
})

function createProgress() {
  return { text: 0, frame: 0, door: 0 }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function nextMaskDirection(queue) {
  if (queue.length === 0) queue.push(...[...MASK_DIRECTIONS].sort(() => Math.random() - 0.5))
  return queue.shift()
}

function createVariant(queue) {
  return {
    maskDirection: nextMaskDirection(queue),
    frameOrigin: randomItem(FRAME_ORIGINS),
  }
}

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function easeInOut(value) {
  return value * value * (3 - 2 * value)
}

function getDoorStyle(direction, side, progress) {
  const amount = clamp(progress)
  const closed = 1 - amount
  const scale = 0.12 + 0.88 * amount

  if (direction === 'left') {
    return {
      opacity: amount,
      transformOrigin: 'left center',
      transform: `perspective(220px) rotateY(${-72 * closed}deg) scaleX(${scale}) translateX(${-16 * closed}%)`,
    }
  }

  if (direction === 'right') {
    return {
      opacity: amount,
      transformOrigin: 'right center',
      transform: `perspective(220px) rotateY(${72 * closed}deg) scaleX(${scale}) translateX(${16 * closed}%)`,
    }
  }

  if (direction === 'top') {
    return {
      opacity: amount,
      transformOrigin: 'center top',
      transform: `perspective(220px) rotateX(${72 * closed}deg) scaleY(${scale}) translateY(${-16 * closed}%)`,
    }
  }

  if (direction === 'bottom') {
    return {
      opacity: amount,
      transformOrigin: 'center bottom',
      transform: `perspective(220px) rotateX(${-72 * closed}deg) scaleY(${scale}) translateY(${16 * closed}%)`,
    }
  }

  return {
    opacity: amount,
    transformOrigin: side === 'one' ? 'right center' : 'left center',
    transform: `perspective(220px) rotateY(${side === 'one' ? -8 : 8}deg) translateX(${side === 'one' ? -50 * closed : 50 * closed}%)`,
  }
}

/**
 * Portable Reader return entry.
 *
 * The host supplies only the boundary fact, input kind, world layer, and
 * navigation callbacks. This component owns the whole visual state machine:
 * hidden -> entering -> visible -> exiting -> hidden.
 *
 * The frame is the outermost layer. The text and door are inset inside it.
 * The door is a visual state, never a permanent background layer.
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
  const phaseRef = useRef('hidden')
  const progressRef = useRef(createProgress())
  const mobileRef = useRef(mobile)
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const directionQueueRef = useRef([])
  const variantRef = useRef(null)
  const timelineRef = useRef({ token: 0, frame: 0 })
  const entryCompleteRef = useRef(false)
  const returnRequestedRef = useRef(false)
  const exitModeRef = useRef(null)
  const onReturnStartRef = useRef(onReturnStart)
  const onReturnCompleteRef = useRef(onReturnComplete)

  mobileRef.current = mobile
  onReturnStartRef.current = onReturnStart
  onReturnCompleteRef.current = onReturnComplete

  if (!variantRef.current) variantRef.current = createVariant(directionQueueRef.current)

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

  const animateDoor = useCallback((open) => {
    if (!entryCompleteRef.current || phaseRef.current !== 'visible') return
    runTimeline([{
      key: 'door',
      to: open ? 1 : 0,
      duration: open ? TIMINGS.doorOpen : TIMINGS.doorClose,
    }])
  }, [runTimeline])

  const startEntry = useCallback(() => {
    if (phaseRef.current !== 'hidden' && phaseRef.current !== 'exiting') return
    if (phaseRef.current === 'hidden') variantRef.current = createVariant(directionQueueRef.current)
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
      if (mobileRef.current || hoveredRef.current || focusedRef.current) animateDoor(true)
    })
  }, [animateDoor, runTimeline, setPhaseValue])

  const startExit = useCallback((mode) => {
    if (phaseRef.current === 'hidden' || phaseRef.current === 'exiting') return
    entryCompleteRef.current = false
    exitModeRef.current = mode
    setPhaseValue('exiting')
    runTimeline([
      { key: 'text', to: 0, duration: TIMINGS.textExit },
      { key: 'door', to: 0, duration: TIMINGS.doorClose },
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
    if (mobile && phaseRef.current === 'visible') animateDoor(true)
  }, [animateDoor, mobile])

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
    animateDoor(true)
  }, [animateDoor])

  const handlePointerLeave = useCallback(event => {
    if (event.pointerType !== 'mouse') return
    hoveredRef.current = false
    if (!focusedRef.current && !mobileRef.current) animateDoor(false)
  }, [animateDoor])

  const handleFocus = useCallback(() => {
    focusedRef.current = true
    animateDoor(true)
  }, [animateDoor])

  const handleBlur = useCallback(() => {
    focusedRef.current = false
    if (!hoveredRef.current && !mobileRef.current) animateDoor(false)
  }, [animateDoor])

  const present = phase !== 'hidden'
  const doorActive = progress.door > 0.001
  const variant = variantRef.current
  const spaceStyle = {
    opacity: progress.door * 0.42,
    transform: `scale(${0.82 + progress.door * 0.18})`,
  }
  const doorOne = (
    <span
      className="reader-return-door reader-return-door--one"
      style={getDoorStyle(variant.maskDirection, 'one', progress.door)}
    />
  )
  const doors = variant.maskDirection === 'center'
    ? (
      <>
        {doorOne}
        <span
          className="reader-return-door reader-return-door--two"
          style={getDoorStyle(variant.maskDirection, 'two', progress.door)}
        />
      </>
    )
    : doorOne

  return (
    <button
      type="button"
      className="reader-return-control"
      style={{
        '--return-text-progress': progress.text,
        '--return-frame-progress': progress.frame,
        '--return-door-progress': progress.door,
      }}
      data-reader-return-control="true"
      data-return-visible={present ? 'true' : 'false'}
      data-return-phase={phase}
      data-return-active={doorActive ? 'true' : 'false'}
      data-return-mobile={mobile ? 'true' : 'false'}
      data-return-world-layer={worldLayer}
      data-return-mask-direction={variant.maskDirection}
      data-return-frame-origin={variant.frameOrigin}
      data-return-layer-model="frame>text>door>space"
      data-return-text-progress={progress.text.toFixed(3)}
      data-return-door-progress={progress.door.toFixed(3)}
      data-return-frame-progress={progress.frame.toFixed(3)}
      aria-label={returnHint}
      aria-hidden={!present}
      aria-pressed={doorActive}
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
        <span className="reader-return-mask" aria-hidden="true">
          <span className="reader-return-space" style={spaceStyle} />
          {doors}
        </span>
        <span className="reader-return-text" style={{ opacity: progress.text }}>
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
