import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const TEXT_ENTER_MS = 320
const FRAME_DRAW_MS = 720
const DOOR_OPEN_MS = 520
const TEXT_EXIT_MS = 260
const DOOR_CLOSE_MS = 520
const FRAME_RETRACT_MS = 420

const MASK_DIRECTIONS = ['left', 'right', 'top', 'bottom', 'center']
const FRAME_ORIGINS = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
const FRAME_PATHS = Object.freeze({
  'top-left': 'M 1 1 H 99 V 35 H 1 Z',
  'top-right': 'M 99 1 V 35 H 1 V 1 Z',
  'bottom-right': 'M 99 35 H 1 V 1 H 99 Z',
  'bottom-left': 'M 1 35 V 1 H 99 V 35 Z',
})

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function nextMaskDirection(queue) {
  if (queue.length === 0) queue.push(...[...MASK_DIRECTIONS].sort(() => Math.random() - 0.5))
  return queue.shift()
}

function createVisualVariant(queue) {
  return {
    maskDirection: nextMaskDirection(queue),
    frameOrigin: randomItem(FRAME_ORIGINS),
  }
}

function easeInOut(value) {
  return value * value * (3 - 2 * value)
}

function getDoorStyle(direction, side, progress) {
  const amount = Math.max(0, Math.min(1, progress))
  const closed = 1 - amount

  if (direction === 'left') {
    return {
      opacity: amount,
      transform: `perspective(160px) rotateY(${-82 * closed}deg) scaleX(${0.24 + 0.76 * amount}) translateX(${-14 * closed}%)`,
    }
  }

  if (direction === 'right') {
    return {
      opacity: amount,
      transform: `perspective(160px) rotateY(${82 * closed}deg) scaleX(${0.24 + 0.76 * amount}) translateX(${14 * closed}%)`,
    }
  }

  if (direction === 'top') {
    return {
      opacity: amount,
      transform: `perspective(160px) rotateX(${82 * closed}deg) scaleY(${0.24 + 0.76 * amount}) translateY(${-14 * closed}%)`,
    }
  }

  if (direction === 'bottom') {
    return {
      opacity: amount,
      transform: `perspective(160px) rotateX(${-82 * closed}deg) scaleY(${0.24 + 0.76 * amount}) translateY(${14 * closed}%)`,
    }
  }

  return {
    opacity: amount * 0.84,
    transform: `translateX(${side === 'one' ? -100 * amount : 100 * amount}%)`,
  }
}

/**
 * Portable Reader return entry.
 *
 * The host supplies only visibility, input kind, world layer, and navigation
 * callbacks. This component owns one explicit visual timeline:
 * text -> frame -> door on entry, and text -> door -> frame on exit.
 * The frame is always the outer layer; the door is always inset inside it.
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
  const [progress, setProgress] = useState({ text: 0, frame: 0, door: 0 })
  const phaseRef = useRef('hidden')
  const progressRef = useRef({ text: 0, frame: 0, door: 0 })
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const directionQueueRef = useRef([])
  const variantRef = useRef(null)
  if (!variantRef.current) variantRef.current = createVisualVariant(directionQueueRef.current)
  const animationFrameRef = useRef(0)
  const animationTokenRef = useRef(0)
  const entryCompleteRef = useRef(false)
  const returnRequestedRef = useRef(false)
  const exitModeRef = useRef(null)
  const onReturnStartRef = useRef(onReturnStart)
  const onReturnCompleteRef = useRef(onReturnComplete)
  onReturnStartRef.current = onReturnStart
  onReturnCompleteRef.current = onReturnComplete

  const setPhaseValue = useCallback(nextPhase => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const setProgressValue = useCallback((key, value) => {
    progressRef.current = { ...progressRef.current, [key]: value }
    setProgress(progressRef.current)
  }, [])

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = 0
    animationTokenRef.current += 1
  }, [])

  const animateValue = useCallback((key, target, duration, onComplete) => {
    stopAnimation()
    const token = animationTokenRef.current
    const from = progressRef.current[key]
    const distance = Math.abs(target - from)
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const actualDuration = reducedMotion ? Math.min(120, duration) : duration

    if (distance < 0.001 || actualDuration <= 0) {
      setProgressValue(key, target)
      onComplete?.()
      return
    }

    const startedAt = performance.now()
    const step = now => {
      if (token !== animationTokenRef.current) return
      const raw = Math.min(1, (now - startedAt) / actualDuration)
      setProgressValue(key, from + (target - from) * easeInOut(raw))
      if (raw < 1) {
        animationFrameRef.current = requestAnimationFrame(step)
        return
      }
      animationFrameRef.current = 0
      onComplete?.()
    }

    animationFrameRef.current = requestAnimationFrame(step)
  }, [setProgressValue, stopAnimation])

  const animateDoor = useCallback((open) => {
    if (!entryCompleteRef.current || phaseRef.current !== 'visible') return
    animateValue('door', open ? 1 : 0, open ? DOOR_OPEN_MS : DOOR_CLOSE_MS)
  }, [animateValue])

  const startEntry = useCallback(() => {
    if (phaseRef.current === 'hidden') variantRef.current = createVisualVariant(directionQueueRef.current)
    stopAnimation()
    entryCompleteRef.current = false
    exitModeRef.current = null
    setPhaseValue('entering')
    animateValue('text', 1, TEXT_ENTER_MS, () => {
      animateValue('frame', 1, FRAME_DRAW_MS, () => {
        entryCompleteRef.current = true
        setPhaseValue('visible')
        if (mobile || hoveredRef.current || focusedRef.current) animateDoor(true)
      })
    })
  }, [animateDoor, animateValue, mobile, setPhaseValue, stopAnimation])

  const startExit = useCallback((mode) => {
    if (phaseRef.current === 'hidden' || phaseRef.current === 'exiting') return
    stopAnimation()
    exitModeRef.current = mode
    setPhaseValue('exiting')
    animateValue('text', 0, TEXT_EXIT_MS, () => {
      animateValue('door', 0, DOOR_CLOSE_MS, () => {
        animateValue('frame', 0, FRAME_RETRACT_MS, () => {
          const completedMode = exitModeRef.current
          entryCompleteRef.current = false
          exitModeRef.current = null
          setPhaseValue('hidden')
          if (completedMode === 'return') onReturnCompleteRef.current?.()
        })
      })
    })
  }, [animateValue, setPhaseValue, stopAnimation])

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

  useEffect(() => () => stopAnimation(), [stopAnimation])

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
    if (!focusedRef.current && !mobile) animateDoor(false)
  }, [animateDoor, mobile])

  const handleFocus = useCallback(() => {
    focusedRef.current = true
    animateDoor(true)
  }, [animateDoor])

  const handleBlur = useCallback(() => {
    focusedRef.current = false
    if (!hoveredRef.current && !mobile) animateDoor(false)
  }, [animateDoor, mobile])

  const present = phase !== 'hidden'
  const active = progress.door > 0.001
  const variant = variantRef.current

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
      data-return-active={active ? 'true' : 'false'}
      data-return-mobile={mobile ? 'true' : 'false'}
      data-return-world-layer={worldLayer}
      data-return-mask-direction={variant.maskDirection}
      data-return-frame-origin={variant.frameOrigin}
      data-return-text-progress={progress.text.toFixed(3)}
      data-return-door-progress={progress.door.toFixed(3)}
      data-return-frame-progress={progress.frame.toFixed(3)}
      aria-label={returnHint}
      aria-hidden={!present}
      aria-pressed={active}
      disabled={!present || phase === 'exiting'}
      tabIndex={present ? 0 : -1}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleReturnClick}
    >
      <span className="reader-return-content">
        <span className="reader-return-mask" aria-hidden="true">
          {variant.maskDirection === 'center' && (
            <span
              className="reader-return-room"
              style={{ opacity: progress.door, transform: `scaleX(${progress.door})` }}
            />
          )}
          <span className="reader-return-door reader-return-door--one" style={getDoorStyle(variant.maskDirection, 'one', progress.door)} />
          <span className="reader-return-door reader-return-door--two" style={getDoorStyle(variant.maskDirection, 'two', progress.door)} />
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
