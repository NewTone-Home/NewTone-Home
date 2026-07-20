import { useEffect, useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { resolveEffectiveMotion, themeKeyFromPosition } from '../theme/themeLabModel'
import ThemeLabToolbar from '../components/theme-lab/ThemeLabToolbar'
import SceneStage from '../components/theme-lab/SceneStage'
import InteractionField from '../components/theme-lab/InteractionField'
import MotionSamples from '../components/theme-lab/MotionSamples'
import LayerStackSample from '../components/theme-lab/LayerStackSample'
import '../styles/themePrimitives.css'
import '../styles/themeSemantic.css'
import '../styles/themeComponents.css'
import './ThemeLab.css'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function getSystemReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(getSystemReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const handleChange = event => setReduced(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reduced
}

function ThemeLab() {
  const themePosition = useProgressStore(s => s.themePosition)
  const motionMode = useProgressStore(s => s.motionMode)
  const setThemePosition = useProgressStore(s => s.setThemePosition)
  const toggleMotionMode = useProgressStore(s => s.toggleMotionMode)
  const systemReducedMotion = useSystemReducedMotion()
  const [replayToken, setReplayToken] = useState(0)

  const effectiveMotion = resolveEffectiveMotion(motionMode, systemReducedMotion)

  return (
    <div
      className={`theme-lab nt-motion-${effectiveMotion}`}
      data-nt-theme={themeKeyFromPosition(themePosition)}
    >
      <ThemeLabToolbar
        themePosition={themePosition}
        motionMode={motionMode}
        systemReducedMotion={systemReducedMotion}
        onThemePosition={setThemePosition}
        onMotionToggle={toggleMotionMode}
        onReplay={() => setReplayToken(token => token + 1)}
      />
      <main className="lab-world">
        <SceneStage replayToken={replayToken} />
        <InteractionField
          themePosition={themePosition}
          effectiveMotion={effectiveMotion}
          onThemePosition={setThemePosition}
        />
        <MotionSamples replayToken={replayToken} />
        <LayerStackSample />
      </main>
    </div>
  )
}

export default ThemeLab
