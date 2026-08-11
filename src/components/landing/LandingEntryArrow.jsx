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
 * One arrow vocabulary for every Landing entry target.
 *
 * The SVG geometry never changes and never lives inside NewTone's breathing
 * transform. Direction is a pure rotation of the same vectors; selection is a
 * separate ring around them. The two Landing entry arrows each receive their
 * own fixed reveal viewport so their first appearance is independent even
 * though they keep sharing the same arrow geometry.
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
  const [revealComplete, setRevealComplete] = useState(false)

  const classTokens = className.split(/\s+/).filter(Boolean)
  const revealVariant = classTokens.includes('landing-guide-entry-arrow')
    ? 'guide'
    : classTokens.includes('reader-entry-arrow')
      ? 'reader'
      : null

  useLayoutEffect(() => {
    const ring = localRingRef.current
    if (!ring) return
    const length = ring.getTotalLength()
    ring.style.setProperty('--landing-entry-ring-length', String(length))
  }, [])

  useEffect(() => {
    if (revealVariant === 'reader' && arrowDelayed) setRevealComplete(false)
  }, [arrowDelayed, revealVariant])

  const setRingNode = (node) => {
    localRingRef.current = node
    assignRef(ringRef, node)
  }

  const handleAnimationEnd = (event) => {
    if (
      event.animationName === 'landing-entry-guide-pull-out'
      || event.animationName === 'reader-entry-arrow-pull-out'
    ) {
      setRevealComplete(true)
    }
  }

  const arrow = (
    <svg
      className={[
        'landing-entry-arrow',
        `landing-entry-arrow--${direction}`,
        `landing-entry-arrow--${phase}`,
        ringActive ? 'is-ring-active' : '',
        delayedBob ? 'has-delayed-bob' : '',
        arrowDelayed ? 'is-arrow-delayed' : '',
        className,
      ].filter(Boolean).join(' ')}
      viewBox="-60 0 120 80"
      width="32"
      height="22"
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
    >
      <path ref={setRingNode} className="landing-entry-ring" d={ENTRY_RING} />

      <g className="landing-entry-arrow__rotator">
        <g className="landing-entry-arrow__ink">
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
      className={[
        'landing-entry-reveal',
        `landing-entry-reveal--${revealVariant}`,
        revealComplete ? 'is-reveal-complete' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {arrow}
    </span>
  )
}

export default LandingEntryArrow
