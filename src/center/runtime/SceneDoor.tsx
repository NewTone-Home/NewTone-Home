import { useCallback, useEffect, useRef, type CSSProperties, type TransitionEvent } from 'react'
import { defaultSceneDoorBehavior, sceneDoorIsVisuallyOpen, sceneDoorMotion, sceneDoorVisualMode, type SceneDoorBehavior, type SceneDoorRuntimePhase } from './sceneDoorConfig'

export type SceneDoorTransitionCompletion = 'opened' | 'closed'

type SceneDoorProps = {
  phase: SceneDoorRuntimePhase
  behavior?: SceneDoorBehavior
  label?: string
  glyph?: string
  heightEm?: number
  onTransitionComplete?: (completion: SceneDoorTransitionCompletion) => void
}

/**
 * Shared door presentation for every mainline scene opening.
 * The behavior record supplies the visual style; the lifecycle owns the
 * opening state and this component renders one entrance surface.
 */
export function SceneDoor({ phase, behavior = defaultSceneDoorBehavior, label = '门', glyph = label, heightEm = 1.2, onTransitionComplete }: SceneDoorProps) {
  const runtimePhase = phase
  const visualMode = sceneDoorVisualMode(behavior)
  const notifiedPhaseRef = useRef<SceneDoorRuntimePhase | null>(null)
  const onTransitionCompleteRef = useRef(onTransitionComplete)
  useEffect(() => {
    onTransitionCompleteRef.current = onTransitionComplete
  }, [onTransitionComplete])
  const completePhase = useCallback((phaseToComplete: SceneDoorRuntimePhase) => {
    if (notifiedPhaseRef.current === phaseToComplete) return
    notifiedPhaseRef.current = phaseToComplete
    onTransitionCompleteRef.current?.(phaseToComplete === 'opening' ? 'opened' : 'closed')
  }, [])

  useEffect(() => {
    if (runtimePhase !== 'opening' && runtimePhase !== 'closing') {
      notifiedPhaseRef.current = null
      return
    }
    if (visualMode !== 'static' || notifiedPhaseRef.current === runtimePhase) return
    completePhase(runtimePhase)
  }, [completePhase, runtimePhase, visualMode])

  const handleTransitionEnd = (event: TransitionEvent<HTMLSpanElement>) => {
    if (visualMode !== 'fade' || event.propertyName !== 'opacity') return
    if (runtimePhase !== 'opening' && runtimePhase !== 'closing') return
    completePhase(runtimePhase)
  }

  return (
    <span className={`scene-door scene-door--${visualMode} scene-door--phase-${runtimePhase} ${sceneDoorIsVisuallyOpen(behavior, runtimePhase) ? 'is-open' : ''}`} style={{ '--door-height': `${heightEm}em`, '--door-label-width': `${Math.max(1.15, Array.from(glyph).length * .72)}em`, '--scene-door-transition-duration': `${runtimePhase === 'opening' ? sceneDoorMotion.openingMs : runtimePhase === 'closing' ? sceneDoorMotion.closingMs : 0}ms` } as CSSProperties} onTransitionEnd={handleTransitionEnd} data-door-label={label} data-door-glyph={glyph} data-door-presentation={visualMode} data-door-phase={runtimePhase} data-door-visual-mode={visualMode} data-door-leaf-count={behavior.leafCount} data-door-open-leaves={behavior.openLeaves} aria-hidden="true">
      <span className="scene-door__surface">{glyph}</span>
    </span>
  )
}
