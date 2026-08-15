import { useEffect, useId } from 'react'
import { useTitleRetrace } from '../../hooks/useTitleRetrace'
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

export function NewToneHandLines() {
  return (
    <svg className="newtone-hand-lines" viewBox="0 0 240 26" preserveAspectRatio="none" aria-hidden="true">
      <path pathLength="1" d="M4 5.8C43 2.8 86 8.1 129 5.2C169 2.6 205 7.1 236 3.9" />
      <path className="newtone-hand-lines__second" pathLength="1" d="M15 18.4C50 14.2 88 20.7 126 16.8C160 13.1 190 19.8 220 15.3" />
    </svg>
  )
}

export function NewToneTransitionMark({ reduced = false, className = '' }) {
  const { phase, sweepRef, begin } = useTitleRetrace({
    introCompleted: false,
    reduced,
    onIntroComplete: undefined,
  })

  useEffect(() => {
    const frame = requestAnimationFrame(begin)
    return () => cancelAnimationFrame(frame)
  }, [begin])

  return (
    <div className={`newtone-transition-mark${className ? ` ${className}` : ''}`} data-title-phase={phase}>
      <span className="newtone-transition-mark__visual">
        NewTone
        <LandingTitleMark text="NewTone" sweepRef={sweepRef} />
      </span>
    </div>
  )
}

export default LandingTitleMark
