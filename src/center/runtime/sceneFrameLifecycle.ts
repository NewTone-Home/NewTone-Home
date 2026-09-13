export type SceneFramePolicy = 'interactive' | 'exploration' | 'passage' | 'gate'

export type SceneFramePhase = 'hidden' | 'appearing' | 'visible' | 'retracting'

export type SceneFrameTarget = {
  group: string
  policy: SceneFramePolicy
  phase: string
  gateTriggered: boolean
  interactionBusy: boolean
  interactionActive: boolean
  retractRequested: boolean
  suppressed: boolean
}

export type SceneFrameRuntime = {
  corner: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
  phase: SceneFramePhase
  fullyCollapsed: boolean
  initialized: boolean
  hovered: boolean
  locked: boolean
}

export function frameShouldCollapse(target: SceneFrameTarget, runtime: SceneFrameRuntime) {
  if (target.suppressed) return true
  if (target.retractRequested) return true
  if (target.policy === 'interactive') return false
  if (target.policy === 'exploration') return !target.interactionActive && !runtime.hovered && !runtime.locked
  if (target.policy === 'gate') return target.gateTriggered
  return target.phase !== 'closed'
}

export function frameVisualPhase(runtime: SceneFrameRuntime) {
  return runtime.phase === 'hidden' ? 'collapsed' : runtime.phase
}
