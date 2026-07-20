import { useTransitionStore } from '../stores/transitionStore'
import { useProgressStore } from '../stores/progressStore'
import { getDefinition, hasDefinition } from '../transitions/transitionDefinitions'
import { getReaderThemeVariables } from '../reader/readerTheme'
import './GlobalTransitionOverlay.css'

function GlobalTransitionOverlay() {
  const phase = useTransitionStore(s => s.phase)
  const preset = useTransitionStore(s => s.preset)
  const readingMode = useProgressStore(s => s.readingMode)
  const themePosition = useProgressStore(s => s.themePosition)
  const motionMode = useProgressStore(s => s.motionMode)
  const isTransitioning = phase !== 'idle'

  if (!isTransitioning) return null

  const safePreset = hasDefinition(preset) ? preset : 'fade-cover'
  const def = getDefinition(safePreset)
  const readerThemeStyle = readingMode === 'standard'
    ? getReaderThemeVariables(themePosition)
    : {}

  return (
    <div
      className={`global-transition-overlay preset-${safePreset} phase-${phase} motion-${motionMode}`}
      style={{
        ...readerThemeStyle,
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
      <div className="global-transition-label">
        <span className="global-transition-label-mark" />
        <span>{def.label}</span>
      </div>
    </div>
  )
}

export default GlobalTransitionOverlay
