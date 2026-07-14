import { useTransitionStore } from '../stores/transitionStore'
import { getDefinition, hasDefinition } from '../transitions/transitionDefinitions'
import './GlobalTransitionOverlay.css'

function GlobalTransitionOverlay() {
  const phase = useTransitionStore(s => s.phase)
  const preset = useTransitionStore(s => s.preset)
  const isTransitioning = phase !== 'idle'

  if (!isTransitioning) return null

  const safePreset = hasDefinition(preset) ? preset : 'fade-cover'
  const def = getDefinition(safePreset)

  return (
    <div
      className={`global-transition-overlay preset-${safePreset} phase-${phase}`}
      style={{
        '--gt-cover-duration': `${def.timings.overlayCover}ms`,
        '--gt-enter-duration': `${def.timings.entering}ms`,
      }}
      aria-hidden="true"
    >
      <div className="global-transition-label">{def.label}</div>
    </div>
  )
}

export default GlobalTransitionOverlay
