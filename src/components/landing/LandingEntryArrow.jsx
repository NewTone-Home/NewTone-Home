import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const ARROW_SHAFT = 'M 0,5 L 0,65'
const ARROW_HEAD_LEFT = 'M 0,65 L -10,50'
const ARROW_HEAD_RIGHT = 'M 0,65 L 10,50'
const ENTRY_RING = 'M0 2.5C19 1 30.5 13.2 30 35C29.5 56.5 18 72.5-2 71.8C-22 71.1-30.5 56.9-29.5 35.4C-28.5 14.2-18.5 4.1 0 2.5'

function assignRef(ref, node) {
  if (!ref) return
  if (typeof ref === 'function') ref(node)
  else ref.current = node
}

/**
 * Shared arrow geometry with independent first-entry reveal state.
 *
 * The guide first emerges facing left, then immediately releases to the live
 * direction supplied by Landing. The Reader first emerges facing right, then
 * releases to its live direction. Because those turns use CSS transitions,
 * changing the live direction mid-turn interrupts and reverses from the current
 * rendered angle instead of waiting for a keyframe animation to finish.
 */
function LandingEntryArrow({
  className = '',
  direction = 'down',
  phase = 'steady',
  ringActive = false,
  ringRef,
  delayedBob = false,
  arrowDelayed = false,
}) {
  const localRingRef = useRef(null)
  const revealRef = useRef(null)
  const arrowRef = useRef(null)
  const inkRef = useRef(null)
  const [revealComplete, setRevealComplete] = useState(false)
  const [revealMeasured, setRevealMeasured] = useState(false)
  const [initialTurnActive, setInitialTurnActive] = useState(false)

  const classTokens = className.split(/\s+/).filter(Boolean)
  const revealVariant = classTokens.includes('landing-guide-entry-arrow')
    ? 'guide'
    : classTokens.includes('reader-entry-arrow')
      ? 'reader'
      : null
  const introDirection = revealVariant === 'guide'
    ? 'left'
    : revealVariant === 'reader'
      ? 'right'
      : direction
  const effectiveDirection = revealVariant && !revealComplete
    ? introDirection
    : direction
  const revealReady = revealVariant === 'guide'
    ? phase === 'visible'
    : revealVariant === 'reader'
      ? !arrowDelayed
      : true

  useLayoutEffect(() => {
    const ring = localRingRef.current
    if (!ring) return
    const length = ring.getTotalLength()
    ring.style.setProperty('--landing-entry-ring-length', String(length))
  }, [])

  useEffect(() => {
    if (revealVariant !== 'reader' || !arrowDelayed) return
    setRevealComplete(false)
    setRevealMeasured(false)
    setInitialTurnActive(false)
  }, [arrowDelayed, revealVariant])

  useLayoutEffect(() => {
    if (!revealVariant || !revealReady || revealComplete) return

    const reveal = revealRef.current
    const arrow = arrowRef.current
    const ink = inkRef.current
    if (!reveal || !arrow || !ink) return

    const title = revealVariant === 'guide'
      ? arrow.closest('.landing-title')
      : null
    const titleMark = title?.querySelector(
      '.landing-title-ink:not(.landing-title-ink--second)',
    ) ?? title?.querySelector('.landing-title-draft')
    const group = revealVariant === 'reader'
      ? arrow.closest('.down-entry-group')
      : null
    const promptText = group?.querySelector('.landing-prompt--down span')
    let frame = 0
    let active = true

    const measureReveal = () => {
      if (!active) return false

      const revealRect = reveal.getBoundingClientRect()
      const inkRect = ink.getBoundingClientRect()
      const sourceRect = revealVariant === 'guide'
        ? titleMark?.getBoundingClientRect()
        : promptText?.getBoundingClientRect()
      const sourceX = revealVariant === 'guide'
        ? sourceRect?.left
        : sourceRect?.right

      if (!Number.isFinite(sourceX)) return false

      if (revealVariant === 'guide') {
        reveal.style.setProperty(
          '--landing-entry-guide-edge-shift',
          `${sourceX - revealRect.right}px`,
        )
      }

      const sourceFacingInkX = revealVariant === 'guide'
        ? inkRect.right
        : inkRect.left
      arrow.style.setProperty(
        '--landing-entry-reveal-start-x',
        `${sourceX - sourceFacingInkX}px`,
      )
      setRevealMeasured(true)
      return true
    }

    const scheduleMeasure = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        measureReveal()
      })
    }

    measureReveal()

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(scheduleMeasure)
      : null
    ;[titleMark, promptText, ink, reveal].filter(Boolean).forEach((node) => {
      resizeObserver?.observe(node)
    })
    window.addEventListener('resize', scheduleMeasure)
    const fontReady = document.fonts?.ready?.then(scheduleMeasure)

    return () => {
      active = false
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      void fontReady
    }
  }, [revealComplete, revealReady, revealVariant])

  const setRingNode = (node) => {
    localRingRef.current = node
    assignRef(ringRef, node)
  }

  const handleAnimationEnd = (event) => {
    if (
      event.animationName !== 'landing-entry-guide-pull-out'
      && event.animationName !== 'reader-entry-arrow-pull-out'
    ) return

    const shouldTurn = direction !== introDirection
    setInitialTurnActive(shouldTurn)
    setRevealComplete(true)
  }

  const handleTransitionEnd = (event) => {
    if (
      initialTurnActive
      && event.propertyName === 'transform'
      && event.target.classList.contains('landing-entry-arrow__rotator')
    ) {
      setInitialTurnActive(false)
    }
  }

  const arrow = (
    <svg
      ref={arrowRef}
      className={[
        'landing-entry-arrow',
        `landing-entry-arrow--${effectiveDirection}`,
        `landing-entry-arrow--${phase}`,
        ringActive ? 'is-ring-active' : '',
        delayedBob ? 'has-delayed-bob' : '',
        arrowDelayed ? 'is-arrow-delayed' : '',
        className,
      ].filter(Boolean).join(' ')}
      viewBox="-60 0 120 80"
      width="32"
      height="22"
      style={revealVariant && !revealMeasured ? { animationPlayState: 'paused' } : undefined}
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
      onTransitionEnd={handleTransitionEnd}
    >
      <path ref={setRingNode} className="landing-entry-ring" d={ENTRY_RING} />

      <g className="landing-entry-arrow__rotator">
        <g ref={inkRef} className="landing-entry-arrow__ink">
          <path className="landing-entry-arrow__shaft" pathLength="1" d={ARROW_SHAFT} />
          <path className="landing-entry-arrow__head" pathLength="1" d={ARROW_HEAD_LEFT} />
          <path className="landing-entry-arrow__head" pathLength="1" d={ARROW_HEAD_RIGHT} />
        </g>
      </g>
    </svg>
  )

  if (!revealVariant) return arrow

  return (
    <span
      ref={revealRef}
      className={[
        'landing-entry-reveal',
        `landing-entry-reveal--${revealVariant}`,
        revealMeasured ? 'is-reveal-measured' : '',
        revealComplete ? 'is-reveal-complete' : '',
        initialTurnActive ? 'is-initial-turning' : '',
        arrowDelayed ? 'is-reveal-delayed' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {arrow}
    </span>
  )
}

export default LandingEntryArrow
