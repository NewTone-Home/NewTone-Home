import { useEffect, useId, useRef } from 'react'
import { useTitleRetrace } from '../../hooks/useTitleRetrace'
import { resolveLandingParallax } from '../../landing/landingParallax'
import './LandingTitleMark.css'

/**
 * The sweep runs in object-bounding-box units, so it fits the word whatever the
 * font resolves to: -0.04 starts just off the left edge of the N, 1.05 finishes
 * past the right edge of the final e. Butt caps only — a round cap in this
 * anisotropic space would overshoot horizontally and reveal the whole word.
 */
const SWEEP_PATH = 'M -0.04,0.52 C 0.16,0.47 0.34,0.56 0.5,0.5 C 0.68,0.44 0.86,0.55 1.05,0.49'

function LandingTitleMark({ text, sweepRef }) {
  const sweepMaskId = `newtone-title-sweep-${useId().replaceAll(':', '')}`

  return (
    <svg className="landing-title-canvas" aria-hidden="true" focusable="false">
      <defs>
        <mask
          id={sweepMaskId}
          maskContentUnits="objectBoundingBox"
          x="-0.3"
          y="-1.3"
          width="1.6"
          height="3.6"
        >
          <path ref={sweepRef} className="landing-title-sweep" pathLength="1" d={SWEEP_PATH} />
        </mask>
      </defs>

      <text
        className="landing-title-draft"
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>

      <g mask={`url(#${sweepMaskId})`}>
        <text
          className="landing-title-ink"
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {text}
        </text>
        <text
          className="landing-title-ink landing-title-ink--second"
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {text}
        </text>
      </g>
    </svg>
  )
}

export function NewToneTransitionMark({ reduced = false, className = '' }) {
  const visualRef = useRef(null)
  const { phase, sweepRef, begin } = useTitleRetrace({
    introCompleted: false,
    reduced,
    onIntroComplete: undefined,
  })

  useEffect(() => {
    const frame = requestAnimationFrame(begin)
    return () => cancelAnimationFrame(frame)
  }, [begin])

  useEffect(() => {
    const node = visualRef.current
    if (!node || reduced) return undefined
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let frame = 0

    const render = () => {
      current.x += (target.x - current.x) * 0.11
      current.y += (target.y - current.y) * 0.11
      node.style.setProperty('--newtone-transition-x', `${current.x.toFixed(3)}px`)
      node.style.setProperty('--newtone-transition-y', `${current.y.toFixed(3)}px`)
      const unsettled = Math.abs(target.x - current.x) > 0.02 || Math.abs(target.y - current.y) > 0.02
      frame = unsettled ? requestAnimationFrame(render) : 0
    }
    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render)
    }
    const handlePointerMove = event => {
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

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('blur', returnToCenter)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', returnToCenter)
    }
  }, [reduced])

  return (
    <div className={`newtone-transition-mark${className ? ` ${className}` : ''}`} data-title-phase={phase}>
      <span ref={visualRef} className="newtone-transition-mark__visual">
        NewTone
        <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
      </span>
    </div>
  )
}

export default LandingTitleMark
