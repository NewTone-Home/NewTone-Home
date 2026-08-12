import { useTransitionStore } from '../stores/transitionStore'
import { useProgressStore } from '../stores/progressStore'
import { getDefinition, hasDefinition } from '../transitions/transitionDefinitions'
import { copy } from '../i18n/copy'
import { NewToneTransitionMark } from './landing/LandingTitleMark'
import './GlobalTransitionOverlay.css'

function GlobalTransitionOverlay({ surfaceStyle = {} }) {
  const phase = useTransitionStore(s => s.phase)
  const preset = useTransitionStore(s => s.preset)
  const motionMode = useProgressStore(s => s.motionMode)
  const language = useProgressStore(s => s.language)
  const isTransitioning = phase !== 'idle'

  if (!isTransitioning || phase === 'handoff') return null

  const safePreset = hasDefinition(preset) ? preset : 'fade-cover'
  const def = getDefinition(safePreset)
  const transitionLabel = safePreset === 'reader-to-surface'
    ? (copy[language] ?? copy.zh).transitionReturn
    : def.label
  return (
    <div
      className={`global-transition-overlay preset-${safePreset} phase-${phase} motion-${motionMode}`}
      style={{
        ...surfaceStyle,
        '--gt-cover-duration': `${def.timings.overlayCover}ms`,
        '--gt-enter-duration': `${def.timings.entering}ms`,
      }}
      aria-hidden="true"
    >
      <div className="global-transition-field" />
      <div className="global-transition-traces">
        <span className="global-transition-trace global-transition-trace--a" />
        <span className="global-transition-trace global-transition-trace--b" />
        <span className="global-transition-trace global-transition-trace--c" />
      </div>
      <NewToneTransitionMark
        className="global-transition-newtone"
        reduced={motionMode === 'reduced'}
        retracting={safePreset === 'reader-to-surface' && phase === 'entering'}
      />
      <div className="global-transition-label">
        <span className="global-transition-label-mark" />
        <span>{transitionLabel}</span>
      </div>
    </div>
  )
}

export default GlobalTransitionOverlay
